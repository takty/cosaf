/**
 * Class for generating relations between colors.
 * This class creates separation and preservation constraints in either
 * standard target-difference mode or ratio-to-trichromacy mode.
 *
 * @author Takuto Yanagida
 * @version 2026-07-12
 */

import { Scheme } from './scheme';
import { Value } from './value';
import { Vision } from './vision';
import { Parameters } from './parameters';
import { Candidates } from './candidates';
import { MAX_DELTA_HUE, MAX_DELTA_TONE } from './domain-factory';

export const SIGMOID_GAIN: number = 2 * Math.log(99);  // Maps scale 0 and 1 approximately to 0.01 and 0.99

export class RelationFactory {

	static DEBUG: boolean = true;

	#scheme     : Scheme;
	#isRatioMode: boolean;

	#doCheckP: boolean;
	#doCheckD: boolean;
	#doCheckM: boolean;

	#doKeepHue: boolean;
	#doKeepTon: boolean;
	#tolHue   : number;
	#tolTon   : number;

	#doCheckConspicuity: boolean;
	#conspicuityRate   : number;
	#conspicuityArray  : number[];

	#dMaxHue: number;
	#dMaxTon: number;
	#maxDiff: number = Number.NaN;

	// ---

	#doCheckT: boolean = false;
	#dTarP   : number = 0;
	#dTarD   : number = 0;
	#dTarM   : number = 0;
	#dTarT   : number = 0;

	// ---

	#rToTri: number = 1;  // Target color difference relative to trichromacy
	#bnC   : number = -1;

	/**
	 * Initializes the RelationFactory with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance providing color data.
	 * @param p - Parameters instance for configuration values.
	 * @param bottleneckColor - Optional index for the bottleneck color; defaults to -1.
	 */
	constructor(s: Scheme, p: Parameters, bottleneckColor: number = -1) {
		this.#scheme      = s;
		this.#isRatioMode = p.isRatioModeEnabled();

		this.#doCheckP = p.doCheckVision(Vision.PROTANOPIA);
		this.#doCheckD = p.doCheckVision(Vision.DEUTERANOPIA);
		this.#doCheckM = p.doCheckVision(Vision.MONOCHROMACY);

		this.#doKeepHue = p.doPreserveHue();
		this.#doKeepTon = p.doPreserveTone();
		this.#tolHue    = p.getHueTolerance();
		this.#tolTon    = p.getToneTolerance();

		this.#doCheckConspicuity = p.doCheckConspicuity();
		this.#conspicuityRate    = p.getConspicuityRate();
		this.#conspicuityArray   = this.#doCheckConspicuity ? s.getConspicuityArray() : [];

		if (this.#isRatioMode) {
			this.#dMaxHue = Math.min(this.#tolHue * 2, MAX_DELTA_HUE);
			this.#dMaxTon = Math.min(this.#tolTon * 2, MAX_DELTA_TONE);

			if (!this.#doCheckP && !this.#doCheckD && !this.#doCheckM) throw new RangeError();
			this.#bnC = bottleneckColor;
		} else {
			this.#dMaxHue = p.getMaximumHueDifference();
			this.#dMaxTon = p.getMaximumToneDifference();

			this.#doCheckT = p.doCheckVision(Vision.TRICHROMACY);

			this.#dTarP = p.getTargetDifference(Vision.PROTANOPIA);
			this.#dTarD = p.getTargetDifference(Vision.DEUTERANOPIA);
			this.#dTarM = p.getTargetDifference(Vision.MONOCHROMACY);
			this.#dTarT = p.getTargetDifference(Vision.TRICHROMACY);

			const ds: number[] = [0];
			if (this.#doCheckP) ds.push(this.#dTarP - s.getLowestDifference(Vision.PROTANOPIA));
			if (this.#doCheckD) ds.push(this.#dTarD - s.getLowestDifference(Vision.DEUTERANOPIA));
			if (this.#doCheckM) ds.push(this.#dTarM - s.getLowestDifference(Vision.MONOCHROMACY));
			if (this.#doCheckT) ds.push(this.#dTarT - s.getLowestDifference(Vision.TRICHROMACY));
			this.#maxDiff = Math.max(...ds);
		}
	}

	/**
	 * Creates a new instance of a color relation between two color candidates.
	 *
	 * @param index1 - The index of the first color.
	 * @param index2 - The index of the second color.
	 * @param cvs1 - The first set of color candidates.
	 * @param cvs2 - The second set of color candidates.
	 * @param skipPres - Index to skip preservation checks for; -1 skips none.
	 * @returns A new `Relation` function representing the color relationship.
	 */
	newInstance(index1: number, index2: number, cvs1: Candidates, cvs2: Candidates, skipPres: number = -1): (v0: number, v1: number) => number {
		if (this.#isRatioMode) {
			return this.#newInstanceRatio(index1, index2, cvs1, cvs2, skipPres);
		} else {
			return this.#newInstanceStandard(index1, index2, cvs1, cvs2, skipPres);
		}
	}

	/**
	 * Creates a new Relation instance between two colors.
	 *
	 * @param idx0 - Index of the first color.
	 * @param idx1 - Index of the second color.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 * @param skipPres - Index to skip preservation checks for; -1 skips none.
	 * @returns A new Relation instance based on color separation and preservation constraints.
	 */
	#newInstanceStandard(idx0: number, idx1: number, cans0: Candidates, cans1: Candidates, skipPres: number = -1): (v0: number, v1: number) => number {
		const o0: Value = cans0.getOriginal();
		const o1: Value = cans1.getOriginal();

		return (val0: number, val1: number): number => {
			const cv0: Value = cans0.values()[val0];
			const cv1: Value = cans1.values()[val1];

			const s : number = sig(this.#sepScaleStandard(cv0, cv1));
			const p0: number = (skipPres === 0 || val0 === 0) ? 1 : sig(this.#preScale(idx0, o0, cv0));
			const p1: number = (skipPres === 1 || val1 === 0) ? 1 : sig(this.#preScale(idx1, o1, cv1));

			return Math.min(s, p0, p1);
		}
	}

	// ---

	/**
	 * Creates a new Relation instance between two colors.
	 *
	 * @param idx0 - Index of the first color.
	 * @param idx1 - Index of the second color.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
 	 * @param skipPres - Index to skip preservation checks for; -1 skips none.
 	 * @returns A new Relation instance based on color separation and preservation constraints.
	 */
	#newInstanceRatio(idx0: number, idx1: number, cans0: Candidates, cans1: Candidates, skipPres: number = -1): (v0: number, v1: number) => number {
		if (skipPres !== 0 && skipPres !== 1) {
			this.#updateRatioToTrichromacy(idx0, idx1, cans0, cans1);
		}
		const o0: Value = cans0.getOriginal();
		const o1: Value = cans1.getOriginal();

		const diff: number = o0.differenceFrom(o1);

		return (val0: number, val1: number): number => {
			if (Number.isNaN(this.#maxDiff)) {
				this.#maxDiff = this.#getRatioMaxDiff();  // Called here as it needs to be evaluated after all constraints are created
			}
			const cv0: Value = cans0.values()[val0];
			const cv1: Value = cans1.values()[val1];

			const s : number = sig(this.#sepScaleRatio(cv0, cv1, diff * this.#rToTri));
			const p0: number = (skipPres === 0 || val0 === 0) ? 1 : sig(this.#preScale(idx0, o0, cv0));
			const p1: number = (skipPres === 1 || val1 === 0) ? 1 : sig(this.#preScale(idx1, o1, cv1));

			return Math.min(s, p0, p1);
		};
	}

	/**
	 * Updates the ratio to trichromacy using the average color difference
	 * across the selected deficient vision types.
	 *
	 * The average is used here to stabilize the global ratio estimate, while
	 * actual separation satisfaction is evaluated by the minimum deficient-vision
	 * difference.
	 *
	 * @param idx0 - Index of the first color.
	 * @param idx1 - Index of the second color.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 */
	#updateRatioToTrichromacy(idx0: number, idx1: number, cans0: Candidates, cans1: Candidates): void {
		const o0: Value = cans0.getOriginal();
		const o1: Value = cans1.getOriginal();
		let max: number = 0;

		for (const v0 of cans0.values()) {
			if (this.#preScale(idx0, o0, v0) < 1) {
				continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
			}
			for (const v1 of cans1.values()) {
				if (this.#preScale(idx1, o1, v1) < 1) {
					continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
				}
				let sum: number = 0, div: number = 0;
				if (this.#doCheckP && ++div) sum += v0.differenceFrom(v1, Vision.PROTANOPIA);
				if (this.#doCheckD && ++div) sum += v0.differenceFrom(v1, Vision.DEUTERANOPIA);
				if (this.#doCheckM && ++div) sum += v0.differenceFrom(v1, Vision.MONOCHROMACY);
				const a: number = sum / div;

				if (max < a) max = a;
			}
		}
		const od: number = o0.differenceFrom(o1);
		if (max <= 0 || od <= 0) {
			return;
		}
		const r: number = max / od;
		if (r < this.#rToTri) this.#rToTri = r;
	}

	/**
	 * Calculates the normalization range for ratio-mode separation constraints.
	 *
	 * The average deficient-vision difference is used for this global
	 * normalization step, while the actual separation scale uses the minimum
	 * deficient-vision difference.
	 */
	#getRatioMaxDiff(): number {
		if (RelationFactory.DEBUG) console.log('RelationFactory: Ratio to trichromacy: ' + this.#rToTri);
		let max: number = 0;

		for (const [i0, i1] of this.#scheme.getAdjacencies()) {
			if (i0 === this.#bnC || i1 === this.#bnC) {
				continue;
			}
			if (this.#scheme.isFixed(i0) && this.#scheme.isFixed(i1)) {
				continue;  // No constraints if both colors are fixed
			}
			let sum: number = 0, div: number = 0;
			if (this.#doCheckP && ++div) sum += this.#scheme.getDifference(i0, i1, Vision.PROTANOPIA);
			if (this.#doCheckD && ++div) sum += this.#scheme.getDifference(i0, i1, Vision.DEUTERANOPIA);
			if (this.#doCheckM && ++div) sum += this.#scheme.getDifference(i0, i1, Vision.MONOCHROMACY);
			const a: number = sum / div;

			const dT: number = this.#scheme.getDifference(i0, i1, Vision.TRICHROMACY);
			const d : number = Math.abs(dT * this.#rToTri - a);  // Use absolute value when calculating MaxDeltaDst
			if (max < d) max = d;
		}
		if (RelationFactory.DEBUG) console.log('RelationFactory: Max Delta Distance: ' + max);
		return max;
	}

	// -------------------------------------------------------------------------

	/**
	 * Computes the constraint satisfaction for separation constraints.
	 *
	 * @param v0 - Value instance of the first color.
	 * @param v1 - Value instance of the second color.
	 * @returns Satisfaction scale for separation constraints.
	 */
	#sepScaleStandard(v0: Value, v1: Value): number {
		let dP: number = 1024, dD: number = 1024, dM: number = 1024, dT: number = 1024;

		if (this.#doCheckP) dP = this.#s2sLowerBound(v0.differenceFrom(v1, Vision.PROTANOPIA), this.#dTarP);
		if (this.#doCheckD) dD = this.#s2sLowerBound(v0.differenceFrom(v1, Vision.DEUTERANOPIA), this.#dTarD);
		if (this.#doCheckM) dM = this.#s2sLowerBound(v0.differenceFrom(v1, Vision.MONOCHROMACY), this.#dTarM);
		if (this.#doCheckT) dT = this.#s2sLowerBound(v0.differenceFrom(v1), this.#dTarT);

		return Math.min(dP, dD, dM, dT);
	}

	/**
	 * Converts a color difference to a satisfaction scale.
	 *
	 * @param d - Calculated color difference.
	 * @param tarD - Target color difference.
	 * @returns Satisfaction scale based on how far the difference falls below the target.
	 */
	#s2sLowerBound(d: number, tarD: number): number {
		if (this.#maxDiff <= 0) {
			return tarD <= d ? 1 : 0;
		}
		return 1 - (tarD - d) / this.#maxDiff;
	}

	// ---

	/**
	 * Computes the constraint satisfaction for separation constraints.
	 *
	 * @param v0 - Value instance of the first color.
	 * @param v1 - Value instance of the second color.
	 * @param tarDiff - Target difference to satisfy.
	 * @returns Satisfaction scale for separation constraints.
	 */
	#sepScaleRatio(v0: Value, v1: Value, tarDiff: number): number {
		let dP: number = 1024, dD: number = 1024, dM: number = 1024;

		if (this.#doCheckP) dP = v0.differenceFrom(v1, Vision.PROTANOPIA);
		if (this.#doCheckD) dD = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
		if (this.#doCheckM) dM = v0.differenceFrom(v1, Vision.MONOCHROMACY);

		return this.#s2sIdealValue(Math.min(dP, dD, dM), tarDiff);
	}

	/**
	 * Converts a color difference to a satisfaction scale.
	 *
	 * @param d - Calculated color difference.
	 * @param tarD - Target color difference.
	 * @returns Satisfaction scale based on the absolute deviation from the target.
	 */
	#s2sIdealValue(d: number, tarD: number): number {
		if (this.#maxDiff <= 0) {
			return Math.abs(tarD - d) <= Number.EPSILON ? 1 : 0;
		}
		return 1 - Math.abs(tarD - d) / this.#maxDiff;
	}

	// -------------------------------------------------------------------------

	/**
	 * Computes the constraint satisfaction for preservation constraints.
	 *
	 * @param idx - Index of the color.
	 * @param org - Original Value instance.
	 * @param mod - Modified Value instance.
	 * @returns Satisfaction scale for preservation constraints.
	 */
	#preScale(idx: number, org: Value, mod: Value): number {
		if (org.getColor().asInteger() === mod.getColor().asInteger()) {
			return 1;
		}
		if (!this.#doKeepHue && !this.#doKeepTon) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		if (this.#doKeepHue) {
			const as: number = Math.abs(m0 - o0);
			const d : number = Math.min(as, 24 - as);
			sH = this.#p2s(idx, d, this.#tolHue, this.#dMaxHue);
		}
		if (this.#doKeepTon) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = this.#p2s(idx, d, this.#tolTon, this.#dMaxTon);
		}
		return Math.min(sH, sT);
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
	#p2s(idx: number, d: number, tol: number, maxD: number): number {
		if (this.#doCheckConspicuity) {
			tol = tol * (1 - this.#conspicuityRate * this.#conspicuityArray[idx]);
		}
		if (maxD <= tol) {
			return d <= tol ? 1 : 0;
		}
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
	return 1 / (1 + Math.exp(-SIGMOID_GAIN * (s - 0.5)));
}
