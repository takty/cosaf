/**
 * Class for generating relations between colors.
 * This class establishes constraints for color separation and preservation relations based on given parameters.
 *
 * Conditions are checked for various vision types and perceptual constraints.
 *
 * @author Takuto Yanagida
 * @version 2024-11-12
 */

import { FuzzyRelation, Relation } from 'stlics/stlics';
import { Adjuster } from './adjuster';
import { Scheme } from './scheme';
import { Value } from './value';
import { Vision } from './vision';
import { Parameters } from './parameters';
import { Candidates } from './candidates';
import { RelationFactory } from './relation-factory';
import { DomainFactory2 } from './domain-factory2';

export class RelationFactory2 implements RelationFactory {

	#scheme: Scheme;

	#doCheckP: boolean;
	#doCheckD: boolean;
	#doCheckM: boolean;

	#ratioToTri: number = 1;  // Target color difference relative to trichromacy
	#maxDiff   : number = Number.NaN;

	#doKeepHue: boolean;
	#hueTol   : number;
	#maxHueD  : number;

	#doKeepTone: boolean;
	#toneTol   : number;
	#maxToneD  : number;

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

		this.#doKeepHue = p.doPreserveHue();
		this.#hueTol    = p.getHueTolerance();
		this.#maxHueD   = Math.min(this.#hueTol * 2, DomainFactory2.MAX_DELTA_HUE);

		this.#doKeepTone = p.doPreserveTone();
		this.#toneTol    = p.getToneTolerance();
		this.#maxToneD   = Math.min(this.#toneTol * 2, DomainFactory2.MAX_DELTA_TONE);

		this.#bottleneckColor = bottleneckColor;
	}

	/**
	 * Creates a new Relation instance between two colors.
	 *
	 * @param _idx0 - Index of the first color.
	 * @param _idx1 - Index of the second color.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 * @param noPreservation - Specifies which index should skip preservation constraints; defaults to -1.
	 * @returns A new Relation instance based on color separation and preservation constraints.
	 */
	newInstance(_idx0: number, _idx1: number, cans0: Candidates, cans1: Candidates, noPreservation: number = -1): Relation {
		if (noPreservation !== 0 && noPreservation !== 1) {
			this.#updateRatioToTrichromacy(cans0, cans1);
		}
		return new ColorRelation(this, this.#ratioToTri, cans0, cans1, noPreservation);
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
		let maxDiff: number = 0;

		for (const v0 of cans0.values()) {
			if (this.preScale(orig0, v0) < 1) {
				continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
			}
			for (const v1 of cans1.values()) {
				if (this.preScale(orig1, v1) < 1) {
					continue;  // Since 1 is not obtained through the sigmoid function, compare with Scale
				}
				let dP: number = 1024, dD: number = 1024, dM: number = 1024;
				let sum: number = 0;
				let div: number = 0;

				if (this.#doCheckP) {
					dP = v0.differenceFrom(v1, Vision.PROTANOPIA);
					sum += dP;
					div += 1;
				}
				if (this.#doCheckD) {
					dD = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
					sum += dD;
					div += 1;
				}
				if (this.#doCheckM) {
					dM = v0.differenceFrom(v1, Vision.MONOCHROMACY);
					sum += dM;
					div += 1;
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
	validateMaxDiff(): void {
		if (!Number.isNaN(this.#maxDiff)) {
			return;
		}
		if (Adjuster.DEBUG) {
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
			let sum: number = 0;
			let div: number = 0;

			if (this.#doCheckP) {
				dP = this.#scheme.getDifference(i0, i1, Vision.PROTANOPIA);
				sum += dP;
				div += 1;
			}
			if (this.#doCheckD) {
				dD = this.#scheme.getDifference(i0, i1, Vision.DEUTERANOPIA);
				sum += dD;
				div += 1;
			}
			if (this.#doCheckM) {
				dM = this.#scheme.getDifference(i0, i1, Vision.MONOCHROMACY);
				sum += dM;
				div += 1;
			}
			// const min: number = Math.min(dP, dD, dM);
			const ave: number = sum / div;

			const d: number = ave;  // Using average (ave) gives slightly better results
			const D: number = Math.abs(dT * this.#ratioToTri - d);  // Use absolute value when calculating MaxDeltaDst
			if (max < D) max = D;
		}
		if (Adjuster.DEBUG) {
			console.log('RelationFactory: Max Delta Distance: ' + max);
		}
		this.#maxDiff = max;
	}


	// -------------------------------------------------------------------------


	/**
	 * Calculates satisfaction for separation constraints based on target color difference.
	 *
	 * @param v0 - Value instance of the first color.
	 * @param v1 - Value instance of the second color.
	 * @param tarDiff - Target difference to satisfy.
	 * @returns Satisfaction scale for separation constraints.
	 */
	sepScale(v0: Value, v1: Value, tarDiff: number): number {
		let dP: number = 1024, dD: number = 1024, dM: number = 1024;
		let sum: number = 0;
		let div: number = 0;

		if (this.#doCheckP) {
			dP = v0.differenceFrom(v1, Vision.PROTANOPIA);
			sum += dP;
			div += 1;
		}
		if (this.#doCheckD) {
			dD = v0.differenceFrom(v1, Vision.DEUTERANOPIA);
			sum += dD;
			div += 1;
		}
		if (this.#doCheckM) {
			dM = v0.differenceFrom(v1, Vision.MONOCHROMACY);
			sum += dM;
			div += 1;
		}
		const min: number = Math.min(dP, dD, dM);
		// const ave: number = sum / div;

		const d: number = min;  // AVE or MIN
		return 1 - Math.abs(tarDiff - d) / this.#maxDiff;  // Based on distance to target color difference
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
		if (!this.#doKeepHue && !this.#doKeepTone) {
			return 1;
		}
		const [o0, o1, o2]: number[] = org.tone;
		const [m0, m1, m2]: number[] = mod.tone;

		let sH: number = 1024, sT: number = 1024;
		let sum: number = 0;
		let div: number = 0;

		if (this.#doKeepHue) {
			const d: number = Math.abs(m0 - o0);
			const D: number = Math.min(d, 24 - d);
			sH = 1 - (D - this.#hueTol) / (this.#maxHueD - this.#hueTol);
			sum += sH;
			div += 1;
		}
		if (this.#doKeepTone) {
			const d: number = Math.sqrt((m1 - o1) * (m1 - o1) + (m2 - o2) * (m2 - o2));
			sT = 1 - (d - this.#toneTol) / (this.#maxToneD - this.#toneTol);
			sum += sT;
			div += 1;
		}
		const min: number = Math.min(sH, sT);
		// const ave: number = sum / div;

		return min;  // AVE or MIN
	}

}

class ColorRelation implements FuzzyRelation {

	#that: RelationFactory2;
	#nop : number;  // Specifies which color index skips preservation (0 or 1)

	#cans0: Candidates;
	#cans1: Candidates;
	#orig0: Value;
	#orig1: Value;

	#tarDiff: number;

	/**
	 * Initializes a new SeparationRelation with specified candidates and constraints.
	 *
	 * @param that - The RelationFactory2 instance containing constraint data.
	 * @param ratioToTri - Ratio to trichromacy for target difference.
	 * @param cans0 - Candidates instance for the first color.
	 * @param cans1 - Candidates instance for the second color.
	 * @param nop - Specifies which color index skips preservation constraints; 0 for the first color, 1 for the second color.
	 */
	constructor(that: RelationFactory2, ratioToTri: number, cans0: Candidates, cans1: Candidates, nop: number) {
		this.#that = that;
		this.#nop  = nop;

		this.#cans0 = cans0;
		this.#cans1 = cans1;
		this.#orig0 = cans0.getOriginal();
		this.#orig1 = cans1.getOriginal();

		this.#tarDiff = this.#orig0.differenceFrom(this.#orig1) * ratioToTri;
	}

	/**
	 * Calculates the satisfaction degree based on values of two colors.
	 *
	 * @param val0 - Index of the first color candidate.
	 * @param val1 - Index of the second color candidate.
	 * @returns The degree of satisfaction for the relationship.
	 */
	satisfactionDegree(val0: number, val1: number): number {
		this.#that.validateMaxDiff();  // Called here as it needs to be evaluated after all constraints are created
		const cv0: Value = this.#cans0.values()[val0];
		const cv1: Value = this.#cans1.values()[val1];

		const s : number = this.#sig(this.#that.sepScale(cv0, cv1, this.#tarDiff));
		const p0: number = (this.#nop === 0) ? 1 : this.#sig(this.#that.preScale(this.#orig0, cv0));
		const p1: number = (this.#nop === 1) ? 1 : this.#sig(this.#that.preScale(this.#orig1, cv1));

		// const ave: number = ((p0 + p1) / 2 + s) / 2;
		const min: number = Math.min(s, p0, p1);
		return min;  // AVE or MIN
	}

	/**
	 * Applies a sigmoid function for satisfaction adjustment.
	 *
	 * @param s - Satisfaction scale.
	 * @returns The sigmoid-adjusted satisfaction.
	 */
	#sig(s: number): number {
		return 1 / (1 + Math.exp(-9.19 * (s - 0.5)));  // 12 -> 9.19
	}

}
