/**
 * Class for generating relations between colors.
 * This class establishes constraints for color separation and preservation relations based on given parameters.
 *
 * Conditions are checked for various vision types and perceptual constraints.
 *
 * @author Takuto Yanagida
 * @version 2025-01-25
 */

import { Adjuster } from './adjuster';
import { Scheme } from './scheme';
import { Value } from './value';
import { Vision } from './vision';
import { Parameters } from './parameters';
import { Candidates } from './candidates';
import { RelationFactory } from './relation-factory';
import { DomainFactory2 } from './domain-factory2';

export class RelationFactory3 implements RelationFactory {

	#scheme: Scheme;

	doCheckP: boolean;
	doCheckD: boolean;
	doCheckM: boolean;

	ratioToTriP: number = 1;  // Target color difference relative to trichromacy
	ratioToTriD: number = 1;  // Target color difference relative to trichromacy
	ratioToTriM: number = 1;  // Target color difference relative to trichromacy
	maxDiffP   : number = Number.NaN;
	maxDiffD   : number = Number.NaN;
	maxDiffM   : number = Number.NaN;

	doKeepHue: boolean;
	hueTol   : number;
	maxHueD  : number;

	doKeepTone: boolean;
	toneTol   : number;
	maxToneD  : number;

	constructor(s: Scheme, param: Parameters) {
		this.#scheme = s;

		this.doCheckP = param.doCheckVision(Vision.PROTANOPIA);
		this.doCheckD = param.doCheckVision(Vision.DEUTERANOPIA);
		this.doCheckM = param.doCheckVision(Vision.MONOCHROMACY);

		this.doKeepHue = param.doPreserveHue();
		this.hueTol    = param.getHueTolerance();
		this.maxHueD   = Math.min(this.hueTol * 2, DomainFactory2.MAX_DELTA_HUE);

		this.doKeepTone = param.doPreserveTone();
		this.toneTol    = Math.min(this.maxToneD * 2, DomainFactory2.MAX_DELTA_TONE);
		this.maxToneD   = param.getToneTolerance();
	}

	newInstance(_idx0: number, _idx1: number, cans0: Candidates, cans1: Candidates, noPreservation: number = -1): (v0: number, v1: number) => number {
		this.#updateRatioToTrichromacy(cans0, cans1);
		const orig0: Value = cans0.getOriginal();
		const orig1: Value = cans1.getOriginal();

		const od: number = orig0.differenceFrom(orig1);
		const tarDiffP: number = od * this.ratioToTriP;
		const tarDiffD: number = od * this.ratioToTriD;
		const tarDiffM: number = od * this.ratioToTriM;

		return (val0: number, val1: number): number => {
			this.validateMaxDiff();  // Called here as it needs to be evaluated after all constraints are created
			const cv0: Value = cans0.values()[val0];
			const cv1: Value = cans1.values()[val1];

			const s : number = sig(this.sepScale(cv0, cv1, tarDiffP, tarDiffD, tarDiffM));
			const p0: number = (noPreservation === 0) ? 1 : sig(this.preScale(orig0, cv0));
			const p1: number = (noPreservation === 1) ? 1 : sig(this.preScale(orig1, cv1));

			const ave: number = ((p0 + p1) / 2 + s) / 2;
			const min: number = Math.min(s, p0, p1);
			return min;  // AVE or MIN
		}
	}

	/**
	 * Updates the ratio to trichromacy by calculating the average color difference for vision types.
	 *
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 */
	#updateRatioToTrichromacy(cans0: Candidates, cans1: Candidates): void {
		const orig0: Value = cans0.getOriginal();
		const orig1: Value = cans1.getOriginal();
		let maxDiffP: number = 0;
		let maxDiffD: number = 0;
		let maxDiffM: number = 0;

		for (const v0 of cans0.values()) {
			if (this.preScale(orig0, v0) < 1) {
				continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
			}
			for (const v1 of cans1.values()) {
				if (this.preScale(orig1, v1) < 1) {
					continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
				}
				if (this.doCheckP) {
					const d: number = v0.differenceFrom(v1, Vision.PROTANOPIA);
					if (maxDiffP < d) maxDiffP = d;
				}
				if (this.doCheckD) {
					const d: number = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
					if (maxDiffD < d) maxDiffD = d;
				}
				if (this.doCheckM) {
					const d: number = v0.differenceFrom(v1, Vision.MONOCHROMACY);
					if (maxDiffM < d) maxDiffM = d;
				}
			}
		}
		const od: number = orig0.differenceFrom(orig1);
		const rP: number = maxDiffP / od;
		const rD: number = maxDiffD / od;
		const rM: number = maxDiffM / od;
		if (rP < this.ratioToTriP) this.ratioToTriP = rP;
		if (rD < this.ratioToTriD) this.ratioToTriD = rD;
		if (rM < this.ratioToTriM) this.ratioToTriM = rM;
	}

	/**
	 * Calculates the maximum difference between the target color difference
	 * and the current color difference for each adjacent color in the specified color vision type.
	 */
	validateMaxDiff(): void {
		if (!Number.isNaN(this.maxDiffP) || !Number.isNaN(this.maxDiffD) || !Number.isNaN(this.maxDiffM)) {
			return;
		}
		if (Adjuster.DEBUG) {
			console.log(`RelationFactory: Ratio to trichromacy: (P) ${this.ratioToTriP}, (D) ${this.ratioToTriD}, (M) ${this.ratioToTriM}`);
		}
		let maxP: number = 0;
		let maxD: number = 0;
		let maxM: number = 0;
		for (const [i0, i1] of this.#scheme.getAdjacencies()) {
			if (this.#scheme.isFixed(i0) && this.#scheme.isFixed(i1)) {
				continue;  // No constraints if both colors are fixed
			}
			const dT: number = this.#scheme.getDifference(i0, i1, Vision.TRICHROMACY);
			if (this.doCheckP) {
				const d: number = this.#scheme.getDifference(i0, i1, Vision.PROTANOPIA);
				const D: number = Math.abs(dT * this.ratioToTriP - d);  // Use absolute value when calculating MaxDeltaDst
				if (maxP < D) maxP = D;
			}
			if (this.doCheckD) {
				const d: number = this.#scheme.getDifference(i0, i1, Vision.DEUTERANOPIA);
				const D: number = Math.abs(dT * this.ratioToTriD - d);  // Use absolute value when calculating MaxDeltaDst
				if (maxD < D) maxD = D;
			}
			if (this.doCheckM) {
				const d: number = this.#scheme.getDifference(i0, i1, Vision.MONOCHROMACY);
				const D: number = Math.abs(dT * this.ratioToTriM - d);  // Use absolute value when calculating MaxDeltaDst
				if (maxM < D) maxM = D;
			}
		}
		if (Adjuster.DEBUG) {
			console.log(`RelationFactory: Max Delta Distance: (P) ${maxP}, (D) ${maxD}, (M) ${maxM}`);
		}
		this.maxDiffP = maxP;
		this.maxDiffD = maxD;
		this.maxDiffM = maxM;
	}


	// -------------------------------------------------------------------------


	/**
	 * Calculates the satisfaction level for separation constraints between two color values,
	 * adjusted for various vision types (Protanopia, Deuteranopia, and Monochromacy).
	 *
	 * @param v0 - The first color Value instance.
	 * @param v1 - The second color Value instance.
	 * @param tarDiffP - Target color difference for Protanopia.
	 * @param tarDiffD - Target color difference for Deuteranopia.
	 * @param tarDiffM - Target color difference for Monochromacy.
	 * @returns Satisfaction scale for separation constraints.
	 */
	sepScale(v0: Value, v1: Value, tarDiffP: number, tarDiffD: number, tarDiffM: number): number {
		let sP: number = 1024, sD: number = 1024, sM: number = 1024;

		if (this.doCheckP) {
			const d: number = v0.differenceFrom(v1, Vision.PROTANOPIA);
			sP = 1 - Math.abs(tarDiffP - d) / this.maxDiffP;  // Based on distance to target color difference
		}
		if (this.doCheckD) {
			const d: number = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
			sD = 1 - Math.abs(tarDiffD - d) / this.maxDiffD;  // Based on distance to target color difference
		}
		if (this.doCheckM) {
			const d: number = v0.differenceFrom(v1, Vision.MONOCHROMACY);
			sM = 1 - Math.abs(tarDiffM - d) / this.maxDiffM;  // Based on distance to target color difference
		}
		return Math.min(sP, sD, sM);
	}

	/**
	 * Calculates satisfaction for preservation constraints based on hue and tone tolerance.
	 *
	 * @param org - Original Value instance.
	 * @param mod - Modified Value instance.
	 * @returns Satisfaction scale for preservation constraints.
	 */
	preScale(org: Value, mod: Value): number {
		if (org.getColor().asInteger() === mod.getColor().asInteger()) {
			return 1;
		}
		if (!this.doKeepHue && !this.doKeepTone) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		let sum: number = 0;
		let div: number = 0;

		if (this.doKeepHue) {
			const d: number = Math.abs(m0 - o0);
			const D: number = Math.min(d, 24 - d);
			sH = 1 - (D - this.hueTol) / (this.maxHueD - this.hueTol);
			sum += sH;
			div += 1;
		}
		if (this.doKeepTone) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = 1 - (d - this.maxToneD) / (this.toneTol - this.maxToneD);
			sum += sT;
			div += 1;
		}
		const min: number = Math.min(sH, sT);
		// const ave: number = sum / div;

		return min;  // AVE or MIN
	}

}

/**
 * Applies a sigmoid function for satisfaction adjustment.
 *
 * @param s - Satisfaction scale.
 * @returns The sigmoid-adjusted satisfaction.
 */
function sig(s: number): number {
	return 1 / (1 + Math.exp(-9.19 * (s - 0.5)));  // 12 -> 9.19
}
