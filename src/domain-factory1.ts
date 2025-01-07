/**
 * Class for generating domains of approximate colors.
 * This factory produces candidates based on various color constraints.
 *
 * @author Takuto Yanagida
 * @version 2025-01-07
 */

import { Voronoi } from 'voronoi/voronoi';
import { Scheme } from './scheme';
import { Value } from './value';
import { Parameters } from './parameters';
import { DomainFactory } from './domain-factory';
import { Candidates } from './candidates';

type Triplet = [number, number, number];

export class DomainFactory1 implements DomainFactory {

	static DEBUG: boolean = false;

	#scheme        : Scheme;
	#res           : number;
	#doPreserveHue : boolean;
	#doPreserveTone: boolean;
	#dHueMax       : number;
	#dToneMax      : number;
	#maxDiff       : number;

	/**
	 * Initializes the DomainFactory1 with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance for color data.
	 * @param param - Parameters instance for configuration values.
	 */
	constructor(s: Scheme, param: Parameters) {
		this.#scheme = s;
		this.#res    = param.getResolution();

		this.#doPreserveHue  = param.doPreserveHue();
		this.#doPreserveTone = param.doPreserveTone();

		this.#dHueMax  = param.getMaximumHueDifference();
		this.#dToneMax = param.getMaximumToneDifference();
		this.#maxDiff  = param.getMaximumDifference();
	}

	/**
	 * Builds the color domain candidates, optionally omitting a specified index.
	 *
	 * @param omitIdx - Index to omit from domain construction; defaults to -1.
	 * @returns An array of Candidates arrays, representing possible color approximations.
	 */
	build(omitIdx: number = -1): Candidates[] {
		const ret: (Candidates | null)[] = [];
		const at : number[][]            = this.#scheme.getAdjacencyTable(omitIdx);
		const vp : Voronoi               = this.#createVoronoiPartition(at);

		if (-1 === omitIdx) {
			for (let i: number = 0; i < this.#scheme.size(); ++i) {
				const cd: Candidates = new Candidates();

				if (!this.#scheme.isFixed(i)) {
					const grid: Triplet[] = vp.getGrids(i, this.#res);

					for (const c of grid) {
						const cv: Value | null = Value.newInstance(c);
						if (cv === null) {
							continue;  // check saturation
						}
						if (this.#isCandidate(i, cv, this.#maxDiff)) {
							cd.values().push(cv);
						}
					}
				}
				if (!cd.values().length) {
					const lab: Triplet      = this.#scheme.getColor(i).asLab();
					const cv : Value | null = Value.newInstance(lab);

					if (cv !== null) {
						cd.values().push(cv);
					}
				}
				ret.push(cd);
			}
		} else {
			let fullDom: Candidates | null = null;

			for (let i: number = 0; i < this.#scheme.size(); ++i) {
				if (i === omitIdx) {
					ret.push(null);
					continue;
				}
				const cd  : Candidates = new Candidates();
				const full: Candidates = new Candidates();

				if (!this.#scheme.isFixed(i)) {
					const grid: Triplet[] = vp.getGrids(i, this.#res);

					for (const c of grid) {
						const cv: Value | null = Value.newInstance(c);

						if (cv === null) {
							continue;  // check saturation
						}
						if (this.#isCandidate(i, cv, this.#maxDiff)) {
							cd.values().push(cv);
						}
						full.values().push(cv);
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

				if (fullDom === null || fullDom.values().length < full.values().length) {
					fullDom = full;
				}
			}
			ret[omitIdx] = fullDom as Candidates;

		}
		if (DomainFactory1.DEBUG) {
			for (const can of ret) {
				console.log('Candidate size: ' + (can as Candidates).values().length);
			}
			this.#printCandidateSize(ret as Candidates[]);
		}
		return ret as Candidates[];
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
	 * Checks if a Value instance qualifies as a valid candidate based on max differences.
	 *
	 * @param idx - Index of the color in the scheme.
	 * @param cv - Value instance to evaluate.
	 * @param maxDiff - Maximum allowable difference to adjacent colors.
	 * @returns True if the candidate is valid; otherwise, false.
	 */
	#isCandidate(idx: number, cv: Value, maxDiff: number): boolean {
		const d: number = this.#scheme.getColor(idx).differenceFrom(cv.getColor());
		if (maxDiff < d) {
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
		for (const r of ret) {
			console.log('DomainFactory: Candidate Size: ' + r.values().length);
		}
	}

}
