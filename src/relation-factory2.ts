/**
 * Class for generating relations between colors.
 * This class establishes constraints for color separation and preservation relations based on given parameters.
 *
 * Conditions are checked for various vision types and perceptual constraints.
 *
 * @author Takuto Yanagida
 * @version 2026-07-12
 */

import { Scheme } from './scheme';
import { Value } from './value';
import { Vision } from './vision';
import { Parameters } from './parameters';
import { Candidates } from './candidates';
import { RelationFactory } from './relation-factory';
import { MAX_DELTA_HUE, MAX_DELTA_TONE } from './domain-factory';

export class RelationFactory2 implements RelationFactory {

	static DEBUG: boolean = true;

	#scheme: Scheme;

	#doCheckP: boolean;
	#doCheckD: boolean;
	#doCheckM: boolean;

	#ratioToTri: number = 1;  // Target color difference relative to trichromacy
	#maxDiff   : number = Number.NaN;

	#doPreserveHue : boolean;
	#doPreserveTone: boolean;
	#hueTol        : number;
	#toneTol       : number;

	#dHueMax : number;
	#dToneMax: number;

	#bottleneckColor: number;

	/**
	 * Initializes the RelationFactory2 with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance providing color data.
	 * @param p - Parameters instance for configuration values.
	 * @param bottleneckColor - Optional index for the bottleneck color; defaults to -1.
	 */
	constructor(s: Scheme, p: Parameters, bottleneckColor: number = -1) {
		this.#scheme = s;

		this.#doCheckP = p.doCheckVision(Vision.PROTANOPIA);
		this.#doCheckD = p.doCheckVision(Vision.DEUTERANOPIA);
		this.#doCheckM = p.doCheckVision(Vision.MONOCHROMACY);
		if (!this.#doCheckP && !this.#doCheckD && !this.#doCheckM) {
			throw new RangeError();
		}

		this.#doPreserveHue  = p.doPreserveHue();
		this.#doPreserveTone = p.doPreserveTone();
		this.#hueTol         = p.getHueTolerance();
		this.#toneTol        = p.getToneTolerance();

		this.#dHueMax  = Math.min(this.#hueTol * 2, MAX_DELTA_HUE);
		this.#dToneMax = Math.min(this.#toneTol * 2, MAX_DELTA_TONE);

		this.#bottleneckColor = bottleneckColor;
	}

	/**
	 * Creates a new Relation instance between two colors.
	 *
	 * @param idx0 - Index of the first color.
	 * @param idx1 - Index of the second color.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 * @param noPreservation - Specifies which index should skip preservation constraints; defaults to -1.
	 * @returns A new Relation instance based on color separation and preservation constraints.
	 */
	newInstance(idx0: number, idx1: number, cans0: Candidates, cans1: Candidates, noPreservation: number = -1): (v0: number, v1: number) => number {
		if (noPreservation !== 0 && noPreservation !== 1) {
			this.#updateRatioToTrichromacy(idx0, idx1, cans0, cans1);
		}
		const orig0: Value = cans0.getOriginal();
		const orig1: Value = cans1.getOriginal();

		const tarDiff: number = orig0.differenceFrom(orig1) * this.#ratioToTri;

		return (val0: number, val1: number): number => {
			if (Number.isNaN(this.#maxDiff)) this.#maxDiff = this.validateMaxDiff();  // Called here as it needs to be evaluated after all constraints are created
			const cv0: Value = cans0.values()[val0];
			const cv1: Value = cans1.values()[val1];

			const s : number = sig(this.sepScale(cv0, cv1, tarDiff));
			const p0: number = (noPreservation === 0 || val0 === 0) ? 1 : sig(this.preScale(idx0, orig0, cv0));
			const p1: number = (noPreservation === 1 || val1 === 0) ? 1 : sig(this.preScale(idx1, orig1, cv1));

			// return ((p0 + p1) / 2 + s) / 2;
			return Math.min(s, p0, p1);
		};
	}

	/**
	 * Updates the ratio to trichromacy by calculating the average color difference for vision types.
	 *
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 */
	#updateRatioToTrichromacy(idx0: number, idx1: number, cans0: Candidates, cans1: Candidates): void {
		const orig0: Value = cans0.getOriginal();
		const orig1: Value = cans1.getOriginal();
		let maxDiff: number = 0;

		for (const v0 of cans0.values()) {
			if (this.preScale(idx0, orig0, v0) < 1) {
				continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
			}
			for (const v1 of cans1.values()) {
				if (this.preScale(idx1, orig1, v1) < 1) {
					continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
				}
				let dP: number = 1024, dD: number = 1024, dM: number = 1024;
				let sum: number = 0, div: number = 0;

				if (this.#doCheckP) {
					dP = v0.differenceFrom(v1, Vision.PROTANOPIA);
					sum += dP; div += 1;
				}
				if (this.#doCheckD) {
					dD = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
					sum += dD; div += 1;
				}
				if (this.#doCheckM) {
					dM = v0.differenceFrom(v1, Vision.MONOCHROMACY);
					sum += dM; div += 1;
				}
				// const min: number = Math.min(dP, dD, dM);
				const ave: number = sum / div;
				const d: number = ave;  // Using average (ave) gives slightly better results
				if (maxDiff < d) maxDiff = d;
			}
		}
		const r: number = maxDiff / orig0.differenceFrom(orig1);
		if (r < this.#ratioToTri) this.#ratioToTri = r;
	}

	/**
	 * Calculates the maximum difference between the target color difference
	 * and the current color difference for each adjacent color in the specified color vision type.
	 */
	validateMaxDiff(): number {
		if (RelationFactory2.DEBUG) {
			console.log('RelationFactory: Ratio to trichromacy: ' + this.#ratioToTri);
		}
		let max: number = 0;
		for (const [i0, i1] of this.#scheme.getAdjacencies()) {
			if (i0 === this.#bottleneckColor || i1 === this.#bottleneckColor) {
				continue;
			}
			if (this.#scheme.isFixed(i0) && this.#scheme.isFixed(i1)) {
				continue;  // No constraints if both colors are fixed
			}
			const dT: number = this.#scheme.getDifference(i0, i1, Vision.TRICHROMACY);
			let dP: number = 1024, dD: number = 1024, dM: number = 1024;
			let sum: number = 0, div: number = 0;

			if (this.#doCheckP) {
				dP = this.#scheme.getDifference(i0, i1, Vision.PROTANOPIA);
				sum += dP; div += 1;
			}
			if (this.#doCheckD) {
				dD = this.#scheme.getDifference(i0, i1, Vision.DEUTERANOPIA);
				sum += dD; div += 1;
			}
			if (this.#doCheckM) {
				dM = this.#scheme.getDifference(i0, i1, Vision.MONOCHROMACY);
				sum += dM; div += 1;
			}
			// const d: number = Math.min(dP, dD, dM);
			const ave: number = sum / div;
			const d: number = ave;  // Using average (ave) gives slightly better results
			const D: number = Math.abs(dT * this.#ratioToTri - d);  // Use absolute value when calculating MaxDeltaDst
			if (max < D) max = D;
		}
		if (RelationFactory2.DEBUG) {
			console.log('RelationFactory: Max Delta Distance: ' + max);
		}
		return max;
	}


	// -------------------------------------------------------------------------


	/**
	 * Computes the constraint satisfaction for separation constraints.
	 *
	 * @param v0 - Value instance of the first color.
	 * @param v1 - Value instance of the second color.
	 * @param tarDiff - Target difference to satisfy.
	 * @returns Satisfaction scale for separation constraints.
	 */
	sepScale(v0: Value, v1: Value, tarDiff: number): number {
		let dP: number = 1024, dD: number = 1024, dM: number = 1024;
		let sum: number = 0, div: number = 0;

		if (this.#doCheckP) {
			dP = v0.differenceFrom(v1, Vision.PROTANOPIA);
			sum += dP; div += 1;
		}
		if (this.#doCheckD) {
			dD = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
			sum += dD; div += 1;
		}
		if (this.#doCheckM) {
			dM = v0.differenceFrom(v1, Vision.MONOCHROMACY);
			sum += dM; div += 1;
		}
		const d: number = Math.min(dP, dD, dM);  // sum / div;
		return this.#s2s(d, tarDiff);
	}

	/**
	 * Converts the distance to a satisfaction scale based on target difference.
	 *
	 * @param d - Calculated difference.
	 * @param tarD - Target difference for satisfaction.
	 * @returns The satisfaction scale based on the difference to the target.
	 */
	#s2s(d: number, tarD: number): number {
		return 1 - Math.abs(tarD - d) / this.#maxDiff;  // Proportional to the distance from the target difference
	}

	/**
	 * Computes the constraint satisfaction for preservation constraints.
	 *
	 * @param idx - Index of the color.
	 * @param org - Original Value instance.
	 * @param mod - Modified Value instance.
	 * @returns Satisfaction scale for preservation constraints.
	 */
	preScale(idx: number, org: Value, mod: Value): number {
		if (org.getColor().asInteger() === mod.getColor().asInteger()) {
			return 1;
		}
		if (!this.#doPreserveHue && !this.#doPreserveTone) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		let sum: number = 0, div: number = 0;

		if (this.#doPreserveHue) {
			const as: number = Math.abs(m0 - o0);
			const d : number = Math.min(as, 24 - as);
			sH = this.#p2s(idx, d, this.#hueTol, this.#dHueMax);
			sum += sH; div += 1;
		}
		if (this.#doPreserveTone) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = this.#p2s(idx, d, this.#toneTol, this.#dToneMax);
			sum += sT; div += 1;
		}
		return Math.min(sH, sT);  // sum / div;
	}

	/**
	 * Converts the preservation difference to a satisfaction scale.
	 *
	 * @param idx - Index of the color.
	 * @param d - Calculated difference.
	 * @param tol - Tolerance value for satisfaction.
	 * @param maxD - Maximum difference.
	 * @returns The satisfaction scale based on preservation tolerance.
	 */
	#p2s(_idx: number, d: number, tol: number, maxD: number): number {
		return 1 - (d - tol) / (maxD - tol);
	}

}

/**
 * Applies a sigmoid function for satisfaction adjustment.
 *
 * @param s - Satisfaction scale.
 * @returns The sigmoid-adjusted satisfaction.
 */
function sig(s: number): number {
	return 1 / (1 + Math.exp(-9.19 * (s - 0.5)));
}
