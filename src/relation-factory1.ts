/**
 * Class for generating relations between colors.
 * This class establishes constraints for color separation and preservation relations based on given parameters.
 *
 * Conditions are checked for various vision types and perceptual constraints.
 *
 * @author Takuto Yanagida
 * @version 2025-01-25
 */

import { Scheme } from './scheme';
import { Value } from './value';
import { Vision } from './vision';
import { Parameters } from './parameters';
import { Candidates } from './candidates';
import { RelationFactory } from './relation-factory';

export class RelationFactory1 implements RelationFactory {

	#doCheckT: boolean;
	#doCheckP: boolean;
	#doCheckD: boolean;
	#doCheckM: boolean;

	#tarDiffT: number;
	#tarDiffP: number;
	#tarDiffD: number;
	#tarDiffL: number;
	#maxDiff : number;

	#doKeepHue: boolean;
	#hueTol   : number;
	#maxHueTol: number;

	#doKeepTone: boolean;
	#toneTol   : number;
	#maxToneTol: number;

	#doCheckConspicuity: boolean;
	#conspicuityRate   : number;
	#conspicuityArray  : number[];

	/**
	 * Initializes the RelationFactory1 with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance providing color data.
	 * @param param - Parameters instance for configuration values.
	 */
	constructor(s: Scheme, param: Parameters) {
		this.#doCheckT = param.doCheckVision(Vision.TRICHROMACY);
		this.#doCheckP = param.doCheckVision(Vision.PROTANOPIA);
		this.#doCheckD = param.doCheckVision(Vision.DEUTERANOPIA);
		this.#doCheckM = param.doCheckVision(Vision.MONOCHROMACY);

		this.#tarDiffT = param.getTargetDifference(Vision.TRICHROMACY);
		this.#tarDiffP = param.getTargetDifference(Vision.PROTANOPIA);
		this.#tarDiffD = param.getTargetDifference(Vision.DEUTERANOPIA);
		this.#tarDiffL = param.getTargetDifference(Vision.MONOCHROMACY);

		const ds: number[] = [0];
		if (this.#doCheckT) ds.push(this.#tarDiffT - s.getLowestDifference(Vision.TRICHROMACY));
		if (this.#doCheckP) ds.push(this.#tarDiffP - s.getLowestDifference(Vision.PROTANOPIA));
		if (this.#doCheckD) ds.push(this.#tarDiffD - s.getLowestDifference(Vision.DEUTERANOPIA));
		if (this.#doCheckM) ds.push(this.#tarDiffL - s.getLowestDifference(Vision.MONOCHROMACY));
		this.#maxDiff = Math.max(...ds);

		this.#doKeepHue = param.doPreserveHue();
		this.#hueTol    = param.getHueTolerance();
		this.#maxHueTol = param.getMaximumHueDifference();

		this.#doKeepTone = param.doPreserveTone();
		this.#toneTol    = param.getToneTolerance();
		this.#maxToneTol = param.getMaximumToneDifference();

		this.#doCheckConspicuity = param.doCheckConspicuity();
		this.#conspicuityRate    = param.getConspicuityRate();
		this.#conspicuityArray   = this.#doCheckConspicuity ? s.getConspicuityArray() : [];
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
		const orig0: Value = cans0.getOriginal();
		const orig1: Value = cans1.getOriginal();

		return (val0: number, val1: number): number => {
			const cv0: Value = cans0.values()[val0];
			const cv1: Value = cans1.values()[val1];

			const s : number = sig(this.sepScale(cv0, cv1));
			const p0: number = (noPreservation === 0 || val0 === 0) ? 1 : sig(this.preScale(idx0, orig0, cv0));
			const p1: number = (noPreservation === 1 || val1 === 0) ? 1 : sig(this.preScale(idx1, orig1, cv1));
			return Math.min(s, p0, p1);
		}
	}


	// -------------------------------------------------------------------------


	/**
	 * Computes the constraint satisfaction for separation constraints.
	 *
	 * @param cv0 - Value instance of the first color.
	 * @param cv1 - Value instance of the second color.
	 * @returns Satisfaction scale for separation constraints.
	 */
	sepScale(cv0: Value, cv1: Value): number {
		let dT: number = 1024, dP: number = 1024, dD: number = 1024, dM: number = 1024;
		if (this.#doCheckT) dT = this.#s2s(cv0.differenceFrom(cv1), this.#tarDiffT);
		if (this.#doCheckP) dP = this.#s2s(cv0.differenceFrom(cv1, Vision.PROTANOPIA), this.#tarDiffP);
		if (this.#doCheckD) dD = this.#s2s(cv0.differenceFrom(cv1, Vision.DEUTERANOPIA), this.#tarDiffD);
		if (this.#doCheckM) dM = this.#s2s(cv0.differenceFrom(cv1, Vision.MONOCHROMACY), this.#tarDiffL);
		return Math.min(dT, dP, dD, dM);
	}

	/**
	 * Converts the distance to a satisfaction scale based on target difference.
	 *
	 * @param d - Calculated difference.
	 * @param tarD - Target difference for satisfaction.
	 * @returns The satisfaction scale based on the difference to the target.
	 */
	#s2s(d: number, tarD: number): number {
		return 1 - (tarD - d) / this.#maxDiff;  // Proportional to the distance from the target difference
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
		if (!this.#doKeepHue && !this.#doKeepTone) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		if (this.#doKeepHue) {
			const d: number = Math.abs(m0 - o0);
			sH = this.#p2s(idx, d, this.#hueTol, this.#maxHueTol);
		}
		if (this.#doKeepTone) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = this.#p2s(idx, d, this.#toneTol, this.#maxToneTol);
		}
		return Math.min(sH, sT);
	}

	/**
	 * Converts the preservation difference to a satisfaction scale.
	 *
	 * @param idx - Index of the color.
	 * @param d - Calculated difference.
	 * @param tol - Tolerance value for satisfaction.
	 * @param maxTol - Maximum allowed tolerance.
	 * @returns The satisfaction scale based on preservation tolerance.
	 */
	#p2s(idx: number, d: number, tol: number, maxTol: number): number {
		if (this.#doCheckConspicuity) {
			tol = tol * (1 - this.#conspicuityRate * this.#conspicuityArray[idx]);
		}
		return (maxTol - d) / (maxTol - tol);
	}

}

/**
 * Sigmoid function for adjusting satisfaction levels.
 *
 * @param s - Satisfaction scale.
 * @returns The sigmoid-adjusted satisfaction.
 */
function sig(s: number): number {
	return 1 / (1 + Math.exp(-12 * (s - 0.5)));
}
