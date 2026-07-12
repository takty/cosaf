/**
 * Class for generating domains of approximate colors in fixed or ratio mode.
 * This factory selects colors that satisfy all of the following conditions:
 * 1) Colors within the Voronoi-partitioned region.
 * 2) Colors representable in RGB.
 * 3) Colors within a maximum distance to adjacent colors in CIELAB.
 * 4) Colors within certain limits for hue and tone in PCCS.
 *
 * @author Takuto Yanagida
 * @version 2026-07-12
 */

import { Voronoi } from 'voronoi/voronoi';
import { Scheme } from './scheme';
import { Value } from './value';
import { Parameters } from './parameters';
import { Candidates } from './candidates';

type Triplet = [number, number, number];

export const MAX_DELTA_HUE : number = 12;  // Based on PCCS standard
export const MAX_DELTA_TONE: number = Math.sqrt(10 * 10 + 10 * 10);  // Based on PCCS standard

export class DomainFactory {

	static DEBUG: boolean = true;

	#scheme: Scheme;
	#res   : number;

	#doPreserveHue : boolean;
	#doPreserveTone: boolean;
	#isRatioMode   : boolean;

	#dHueMax      : number;
	#dToneMax     : number;
	#commonMaxDiff: number = Number.NaN;

	constructor(s: Scheme, p: Parameters) {
		this.#scheme = s;
		this.#res    = p.getResolution();

		this.#doPreserveHue  = p.doPreserveHue();
		this.#doPreserveTone = p.doPreserveTone();

		this.#isRatioMode = p.isRatioModeEnabled();

		if (this.#isRatioMode) {
			this.#dHueMax  = Math.min(p.getHueTolerance() * 2, MAX_DELTA_HUE);
			this.#dToneMax = Math.min(p.getToneTolerance() * 2, MAX_DELTA_TONE);
		} else {
			this.#dHueMax       = p.getMaximumHueDifference();
			this.#dToneMax      = p.getMaximumToneDifference();
			this.#commonMaxDiff = p.getMaximumDifference();
		}
	}

	/**
	 * Builds an array of color candidate domains.
	 *
	 * @returns An array of `Candidates` instances representing the color domains.
	 */
	build(): Candidates[] {
		const ret: Candidates[] = [];
		const at : number[][]   = this.#scheme.getAdjacencyTable();
		const vp : Voronoi      = this.#createVoronoiPartition(at);

		for (let i: number = 0; i < this.#scheme.size(); ++i) {
			const cd: Candidates = new Candidates();

			if (!this.#scheme.isFixed(i)) {
				const grid   : Triplet[] = vp.getGrids(i, this.#res);
				const maxDiff: number    = this.#getMaxDiff(at, i);

				for (const c of grid) {
					const cv: Value | null = Value.newInstance(c);
					if (cv) {  // check saturation
						if (this.#isCandidate(i, cv, maxDiff)) {
							cd.values().push(cv);
						}
					}
				}
			}
			if (!cd.values().length) {
				cd.values().push(this.#createOriginalValue(i));
			}
			ret.push(cd);
		}
		this.#printCandidateSize(ret);
		return ret;
	}

	/**
	 * Builds color domain candidates for bottleneck resolution.
	 *
	 * @param bottleneckIndex - Index of the bottleneck color to resolve.
	 * @returns An array of Candidates arrays, representing possible color approximations.
	 */
	buildWithBottleneck(bottleneckIndex: number): Candidates[] {
		const ret: (Candidates | null)[] = [];
		const at : number[][]            = this.#scheme.getAdjacencyTable(bottleneckIndex);
		const vp : Voronoi               = this.#createVoronoiPartition(at);

		let fullDom: Candidates | null = null;

		for (let i: number = 0; i < this.#scheme.size(); ++i) {
			if (i === bottleneckIndex) {
				ret.push(null);
				continue;
			}
			const cd  : Candidates = new Candidates();
			const full: Candidates = new Candidates();
			const grid: Triplet[]  = vp.getGrids(i, this.#res);

			const isFixed: boolean = this.#scheme.isFixed(i);
			const maxDiff: number  = isFixed ? Number.NaN : this.#getMaxDiff(at, i);

			for (const c of grid) {
				const cv: Value | null = Value.newInstance(c);
				if (cv) {  // check saturation
					if (!isFixed && this.#isCandidate(i, cv, maxDiff)) {
						cd.values().push(cv);
					}
					full.values().push(cv);
				}
			}
			if (!cd.values().length) {
				cd.values().push(this.#createOriginalValue(i));
			}
			ret.push(cd);

			if (fullDom === null || fullDom.values().length < full.values().length) {
				fullDom = full;
			}
		}
		if (fullDom === null || !fullDom.values().length) {
			fullDom = new Candidates();
			fullDom.values().push(this.#createOriginalValue(bottleneckIndex));
		}
		fullDom.setOriginal(this.#createOriginalValue(bottleneckIndex));
		ret[bottleneckIndex] = fullDom;

		this.#printCandidateSize(ret as Candidates[]);
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
	 * Creates the color value of original color.
	 *
	 * @param idx - Index of the color in the scheme.
	 * @returns Color value.
	 */
	#createOriginalValue(idx: number): Value {
		const lab: Triplet      = this.#scheme.getColor(idx).asLab();
		const cv : Value | null = Value.newInstance(lab);

		if (!cv) {
			throw new RangeError(`Invalid original color: ${idx}`);
		}
		return cv;
	}

	/**
	 * Logs the size of each candidate set if debugging is enabled.
	 *
	 * @param ret - Array of Candidates representing potential colors.
	 */
	#printCandidateSize(ret: Candidates[]): void {
		if (DomainFactory.DEBUG) {
			for (const r of ret) {
				console.log('DomainFactory: Candidate Size: ' + r.values().length);
			}
		}
	}

	/**
	 * Calculates the maximum difference for the adjacent colors of a given index.
	 *
	 * @param adjTab - Adjacency table for the color scheme.
	 * @param idx - Index for which to calculate the maximum adjacent color difference.
	 * @returns The maximum difference to an adjacent color.
	 */
	#getMaxDiff(adjTab: number[][], idx: number): number {
		if (this.#isRatioMode) {
			const rel: number[] = adjTab[idx];
			let max  : number   = 0;

			for (let i of rel) {
				const d: number = this.#scheme.getDifference(idx, i);
				if (max < d) max = d;
			}
			if (DomainFactory.DEBUG) console.log('DomainFactory: Max Distance: ' + max);
			return max;
		} else {
			return this.#commonMaxDiff;
		}
	}

}
