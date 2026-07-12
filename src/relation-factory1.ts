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

export class RelationFactory1 implements RelationFactory {

	#doCheckP: boolean;
	#doCheckD: boolean;
	#doCheckM: boolean;
	#doCheckT: boolean;

	#tarDiffP: number;
	#tarDiffD: number;
	#tarDiffM: number;
	#tarDiffT: number;

	#maxDiff: number;

	#doPreserveHue : boolean;
	#doPreserveTone: boolean;
	#hueTol        : number;
	#toneTol       : number;

	#dHueMax : number;
	#dToneMax: number;

	#doCheckConspicuity: boolean;
	#conspicuityRate   : number;
	#conspicuityArray  : number[];

	/**
	 * Initializes the RelationFactory1 with a color scheme and parameter settings.
	 *
	 * @param s - Scheme instance providing color data.
	 * @param p - Parameters instance for configuration values.
	 */
	constructor(s: Scheme, p: Parameters) {
		this.#doCheckP = p.doCheckVision(Vision.PROTANOPIA);
		this.#doCheckD = p.doCheckVision(Vision.DEUTERANOPIA);
		this.#doCheckM = p.doCheckVision(Vision.MONOCHROMACY);
		this.#doCheckT = p.doCheckVision(Vision.TRICHROMACY);

		this.#tarDiffP = p.getTargetDifference(Vision.PROTANOPIA);
		this.#tarDiffD = p.getTargetDifference(Vision.DEUTERANOPIA);
		this.#tarDiffM = p.getTargetDifference(Vision.MONOCHROMACY);
		this.#tarDiffT = p.getTargetDifference(Vision.TRICHROMACY);

		const ds: number[] = [0];
		if (this.#doCheckP) ds.push(this.#tarDiffP - s.getLowestDifference(Vision.PROTANOPIA));
		if (this.#doCheckD) ds.push(this.#tarDiffD - s.getLowestDifference(Vision.DEUTERANOPIA));
		if (this.#doCheckM) ds.push(this.#tarDiffM - s.getLowestDifference(Vision.MONOCHROMACY));
		if (this.#doCheckT) ds.push(this.#tarDiffT - s.getLowestDifference(Vision.TRICHROMACY));
		this.#maxDiff = Math.max(...ds);

		this.#doPreserveHue  = p.doPreserveHue();
		this.#doPreserveTone = p.doPreserveTone();
		this.#hueTol         = p.getHueTolerance();
		this.#toneTol        = p.getToneTolerance();

		this.#dHueMax  = p.getMaximumHueDifference();
		this.#dToneMax = p.getMaximumToneDifference();

		this.#doCheckConspicuity = p.doCheckConspicuity();
		this.#conspicuityRate    = p.getConspicuityRate();
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
	 * @param v0 - Value instance of the first color.
	 * @param v1 - Value instance of the second color.
	 * @returns Satisfaction scale for separation constraints.
	 */
	sepScale(v0: Value, v1: Value): number {
		let dP: number = 1024, dD: number = 1024, dM: number = 1024;
		let dT: number = 1024;

		if (this.#doCheckP) {
			dP = this.#s2s(v0.differenceFrom(v1, Vision.PROTANOPIA), this.#tarDiffP);
		}
		if (this.#doCheckD) {
			dD = this.#s2s(v0.differenceFrom(v1, Vision.DEUTERANOPIA), this.#tarDiffD);
		}
		if (this.#doCheckM) {
			dM = this.#s2s(v0.differenceFrom(v1, Vision.MONOCHROMACY), this.#tarDiffM);
		}
		if (this.#doCheckT) {
			dT = this.#s2s(v0.differenceFrom(v1), this.#tarDiffT);
		}
		return Math.min(dP, dD, dM, dT);
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
		if (org.getColor().asInteger() === mod.getColor().asInteger()) {
			return 1;
		}
		if (!this.#doPreserveHue && !this.#doPreserveTone) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		if (this.#doPreserveHue) {
			const as: number = Math.abs(m0 - o0);
			const d : number = Math.min(as, 24 - as);
			sH = this.#p2s(idx, d, this.#hueTol, this.#dHueMax);
		}
		if (this.#doPreserveTone) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = this.#p2s(idx, d, this.#toneTol, this.#dToneMax);
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
		return (maxD - d) / (maxD - tol);
	}

}

/**
 * Applies a sigmoid function for satisfaction adjustment.
 *
 * @param s - Satisfaction scale.
 * @returns The sigmoid-adjusted satisfaction.
 */
function sig(s: number): number {
	return 1 / (1 + Math.exp(-12 * (s - 0.5)));
}
