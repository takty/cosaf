/**
 * Class for generating a domain of approximate colors.
 * This factory selects colors that satisfy all of the following conditions:
 * 1) Colors within the Voronoi-partitioned region.
 * 2) Colors representable in RGB.
 * 3) Colors within a maximum distance to adjacent colors in CIELAB.
 * 4) Colors within double the tolerance or maximum standard limits for hue and tone in PCCS.
 *
 * @author Takuto Yanagida
 * @version 2024-11-12
 */

import { Voronoi } from '@/voronoi/voronoi';
import { Scheme } from './scheme';
import { Value } from './value';
import { Parameters } from './parameters';
import { DomainFactory } from './domain-factory';
import { Candidates } from './candidates';

type Triplet = [number, number, number];

export class DomainFactory2 implements DomainFactory {

	static DEBUG: boolean = false;

	static MAX_DELTA_HUE : number = 12;  // Based on PCCS standard
	static MAX_DELTA_TONE: number = Math.sqrt(10 * 10 + 10 * 10);  // Based on PCCS standard

	#scheme        : Scheme;
	#res           : number;
	#doPreserveHue : boolean;
	#doPreserveTone: boolean;
	#dHueMax       : number;
	#dToneMax      : number;

	/**
	 * Initializes the DomainFactory2 with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance for color data.
	 * @param param - Parameters instance for configuration values.
	 */
	constructor(s: Scheme, param: Parameters) {
		this.#scheme = s;
		this.#res    = param.getResolution();

		this.#doPreserveHue  = param.doPreserveHue();
		this.#doPreserveTone = param.doPreserveTone();

		this.#dHueMax  = Math.min(param.getHueTolerance() * 2, DomainFactory2.MAX_DELTA_HUE);
		this.#dToneMax = Math.min(param.getToneTolerance() * 2, DomainFactory2.MAX_DELTA_TONE);
	}

	/**
	 * Builds the color domain candidates, optionally omitting a specified index.
	 *
	 * @param omitIdx - Index to omit from domain construction; defaults to -1.
	 * @returns An array of Candidates arrays, representing possible color approximations.
	 */
	build(omitIdx: number = -1): Candidates[] {
		const ret: (Candidates | null)[] = [];
		const at : number[][] = this.#scheme.getAdjacencyTable(omitIdx);
		const vp : Voronoi = this.#createVoronoiPartition(at);

		if (-1 === omitIdx) {
			for (let i: number = 0; i < this.#scheme.size(); ++i) {
				const cd: Candidates = new Candidates();

				if (!this.#scheme.isFixed(i)) {
					const grid   : Triplet[] = vp.calcGrids(i, this.#res);
					const maxDiff: number = this.#getMaxDiff(at, i);

					for (const c of grid) {
						const cv: Value | null = Value.newInstance(c);
						if (cv === null) {
							continue;  // check saturation
						}
						if (this.#isCandidate(i, cv, maxDiff)) {
							cd.values().push(cv);
						}
					}
				}
				if (!cd.values().length) {
					const lab: Triplet = this.#scheme.getColor(i).asLab();
					const cv : Value | null = Value.newInstance(lab);

					if (cv !== null) {
						cd.values().push(cv);
					}
				}
				ret.push(cd);
			}
		} else {
			let fullDomSize : number = 0;
			let fullDomIndex: number = -1;

			for (let i: number = 0; i < this.#scheme.size(); ++i) {
				if (i === omitIdx) {
					ret.push(null);
					continue;
				}
				const cd  : Candidates = new Candidates();
				const grid: Triplet[] = vp.calcGrids(i, this.#res);

				if (!this.#scheme.isFixed(i)) {
					const maxDiff: number = this.#getMaxDiff(at, i);

					for (const c of grid) {
						const cv: Value | null = Value.newInstance(c);

						if (cv === null) {
							continue;  // check saturation
						}
						if (this.#isCandidate(i, cv, maxDiff)) {
							cd.values().push(cv);
						}
					}
				}
				if (!cd.values().length) {
					const lab: Triplet = this.#scheme.getColor(i).asLab();
					const cv : Value | null = Value.newInstance(lab);

					if (cv !== null) {
						cd.values().push(cv);
					}
				}
				ret.push(cd);

				if (fullDomSize < grid.length) {
					fullDomSize  = grid.length;
					fullDomIndex = i;
				}
			}
			ret[omitIdx] = this.#createFullDomain(fullDomIndex, vp);
			ret[omitIdx].setOriginal(Value.newInstance(this.#scheme.getColor(omitIdx).asLab()) as Value);
		}
		if (DomainFactory2.DEBUG) {
			for (const can of ret) {
				console.log('Candidate size: ' + (can as Candidates).values().length);
			}
		}
		this.#printCandidateSize(ret as Candidates[]);
		return ret as Candidates[];
	}

	/**
	 * Calculates the maximum difference for the adjacent colors of a given index.
	 *
	 * @param adjTab - Adjacency table for the color scheme.
	 * @param idx - Index for which to calculate the maximum adjacent color difference.
	 * @returns The maximum difference to an adjacent color.
	 */
	#getMaxDiff(adjTab: number[][], idx: number): number {
		const rel: number[] = adjTab[idx];
		let max: number = 0;

		for (let i of rel) {
			const d: number = this.#scheme.getDifference(idx, i);
			if (max < d) {
				max = d;
			}
		}
		if (DomainFactory2.DEBUG) {
			console.log('DomainFactory: Max Distance: ' + max);
		}
		return max;
	}

	/**
	 * Creates a full domain of candidates for a specified index.
	 *
	 * @param idx - Index for which to create the full domain.
	 * @param vp - Voronoi instance for partitioning.
	 * @returns A Candidates instance representing the full color domain for the index.
	 */
	#createFullDomain(idx: number, vp: Voronoi): Candidates {
		const full = new Candidates();
		const grid: Triplet[] = vp.calcGrids(idx, this.#res);

		for (const g of grid) {
			const cv: Value | null = Value.newInstance(g);
			if (cv) {
				full.values().push(cv);
			}
		}
		return full;
	}

	/**
	 * Creates a Voronoi partition based on an adjacency table.
	 *
	 * @param adjTab - Adjacency table defining relationships between color sites.
	 * @returns A Voronoi instance representing the partitioned color space.
	 */
	#createVoronoiPartition(adjTab: number[][]): Voronoi {
		const vp: Voronoi = new Voronoi(0, 100, -127, 127, -127, 127);  // L, a, b

		for (let i: number = 0; i < this.#scheme.size(); ++i) {
			vp.addSite(this.#scheme.getColor(i).asLab());
		}
		vp.createCells(adjTab);
		return vp;
	}

	/**
	 * Determines if a Value instance qualifies as a valid candidate based on max differences.
	 *
	 * @param idx - Index of the color in the scheme.
	 * @param cv - Value instance to evaluate.
	 * @param maxDiff - Maximum allowable difference to adjacent colors.
	 * @returns True if the candidate is valid; otherwise, false.
	 */
	#isCandidate(idx: number, cv: Value, maxDiff: number): boolean {
		if (maxDiff < this.#scheme.getColor(idx).differenceFrom(cv.getColor())) {
			return false;
		}
		const org: Triplet = this.#scheme.getColor(idx).asTone();
		const can: Triplet = cv.getColor().asTone();

		if (this.#doPreserveHue) {
			const as: number = Math.abs(can[0] - org[0]);
			const d : number = Math.min(as, 24 - as);

			if (this.#dHueMax < d) {
				return false;
			}
		}
		if (this.#doPreserveTone) {
			const d: number = (can[1] - org[1]) * (can[1] - org[1]) + (can[2] - org[2]) * (can[2] - org[2]);

			if (this.#dToneMax * this.#dToneMax < d) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Logs the size of each candidate set if debugging is enabled.
	 *
	 * @param ret - Array of Candidates representing potential colors.
	 */
	#printCandidateSize(ret: Candidates[]): void {
		if (DomainFactory2.DEBUG) {
			for (const r of ret) {
				console.log('DomainFactory: Candidate Size: ' + r.values().length);
			}
		}
	}

}
