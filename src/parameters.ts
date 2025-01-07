/**
 * Represents parameters for a color adjustment system, including differences, tolerances,
 * color vision checks, and solver settings.
 *
 * @author Takuto Yanagida
 * @version 2025-01-07
 */

import { Vision } from './vision';

export class Parameters {

	// Domain settings -----------------------------------------------------------

	#maxDiff    : number = 50;
	#maxHueDiff : number = 3.5;
	#maxToneDiff: number = 4;
	#resolution : number = 5;

	/**
	 * Sets the maximum allowable color difference.
	 *
	 * @param diff - The maximum color difference.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setMaximumDifference(diff: number): Parameters {
		this.#maxDiff = diff;
		return this;
	}

	/**
	 * Retrieves the maximum allowable color difference.
	 *
	 * @returns The maximum color difference.
	 */
	getMaximumDifference(): number {
		return this.#maxDiff;
	}

	/**
	 * Sets the maximum allowable hue difference.
	 *
	 * @param diff - The maximum hue difference.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setMaximumHueDifference(diff: number): Parameters {
		this.#maxHueDiff = diff;
		return this;
	}

	/**
	 * Retrieves the maximum allowable hue difference.
	 *
	 * @returns The maximum hue difference.
	 */
	getMaximumHueDifference(): number {
		return this.#maxHueDiff;
	}

	/**
	 * Sets the maximum allowable tone difference.
	 *
	 * @param diff - The maximum tone difference.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setMaximumToneDifference(diff: number): Parameters {
		this.#maxToneDiff = diff;
		return this;
	}

	/**
	 * Retrieves the maximum allowable tone difference.
	 *
	 * @returns The maximum tone difference.
	 */
	getMaximumToneDifference(): number {
		return this.#maxToneDiff;
	}

	/**
	 * Sets the resolution for color adjustments.
	 *
	 * @param resolution - The color resolution.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setResolution(resolution: number): Parameters {
		this.#resolution = resolution;
		return this;
	}

	/**
	 * Retrieves the resolution for color adjustments.
	 *
	 * @returns The color resolution.
	 */
	getResolution(): number {
		return this.#resolution;
	}

	// Constraint settings -------------------------------------------------------

	#doCheckT: boolean = false;
	#doCheckP: boolean = true;
	#doCheckD: boolean = true;
	#doCheckM: boolean = false;

	// Traditional Method
	#tarDiffT: number = 20;
	#tarDiffP: number = 20;
	#tarDiffD: number = 20;
	#tarDiffM: number = 20;

	// Method to Store Ratio for Trichromacy
	#isRatioMode: boolean = true;

	#doKeepHue : boolean = true;
	#hueTol    : number  = 1.75;  // 0: same, 1: adjacent, 2-3: similar (max: 3.5)
	#doKeepTone: boolean = true;
	#toneTol   : number  = 2;  // 0.5: same, 2: similar (max: 4)

	#conspicuity    : boolean = false;
	#conspicuityRate: number  = 0.5;  // [0.01, 0.99]

	/**
	 * Sets the color vision checks for trichromacy, protanopia, deuteranopia, and monochromacy.
	 *
	 * @param trichromacy - Whether to check trichromacy.
	 * @param protanopia - Whether to check protanopia.
	 * @param deuteranopia - Whether to check deuteranopia.
	 * @param monochromacy - Whether to check monochromacy.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setVisionChecked(trichromacy: boolean, protanopia: boolean, deuteranopia: boolean, monochromacy: boolean): Parameters {
		this.#doCheckT = trichromacy;
		this.#doCheckP = protanopia;
		this.#doCheckD = deuteranopia;
		this.#doCheckM = monochromacy;
		return this;
	}

	/**
	 * Checks if a specific type of color vision (trichromacy, protanopia, deuteranopia, or monochromacy) is enabled.
	 *
	 * @param vis - The vision type to check.
	 * @returns `true` if the specified vision check is enabled, `false` otherwise.
	 */
	doCheckVision(vis: Vision): boolean {
		switch (vis) {
			case Vision.TRICHROMACY : return this.#doCheckT;
			case Vision.PROTANOPIA  : return this.#doCheckP;
			case Vision.DEUTERANOPIA: return this.#doCheckD;
			case Vision.MONOCHROMACY: return this.#doCheckM;
		}
	}


	// Start - Traditional Method

	/**
	 * Sets the target color differences for trichromacy, protanopia, deuteranopia, and monochromacy.
	 *
	 * @param trichromacy - Target difference for trichromacy.
	 * @param protanopia - Target difference for protanopia.
	 * @param deuteranopia - Target difference for deuteranopia.
	 * @param monochromacy - Target difference for monochromacy.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setTargetDifferences(trichromacy: number, protanopia: number, deuteranopia: number, monochromacy: number): Parameters {
		this.#tarDiffT = trichromacy;
		this.#tarDiffP = protanopia;
		this.#tarDiffD = deuteranopia;
		this.#tarDiffM = monochromacy;
		return this;
	}

	/**
	 * Retrieves the target difference for a specified color vision type.
	 *
	 * @param vis - The vision type.
	 * @returns The target difference for the specified vision type.
	 */
	getTargetDifference(vis: Vision): number {
		switch (vis) {
			case Vision.TRICHROMACY : return this.#tarDiffT;
			case Vision.PROTANOPIA  : return this.#tarDiffP;
			case Vision.DEUTERANOPIA: return this.#tarDiffD;
			case Vision.MONOCHROMACY: return this.#tarDiffM;
		}
	}

	// End - Traditional Method


	// Start - Method to Store Ratio for Trichromacy

	/**
	 * Enables or disables ratio mode.
	 *
	 * @param enabled - Whether to enable ratio mode.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setRatioModeEnabled(enabled: boolean): Parameters {
		this.#isRatioMode = enabled;
		return this;
	}

	/**
	 * Checks if ratio mode is enabled.
	 *
	 * @returns `true` if ratio mode is enabled, `false` otherwise.
	 */
	isRatioModeEnabled(): boolean {
		return this.#isRatioMode;
	}

	// End - Method to Store Ratio for Trichromacy


	/**
	 * Sets whether hue should be preserved.
	 *
	 * @param f - Whether to preserve hue.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setHuePreserved(f: boolean): Parameters {
		this.#doKeepHue = f;
		return this;
	}

	/**
	 * Checks if hue is set to be preserved.
	 *
	 * @returns `true` if hue is preserved, `false` otherwise.
	 */
	doPreserveHue(): boolean {
		return this.#doKeepHue;
	}

	/**
	 * Sets the tolerance for hue difference.
	 *
	 * @param difference - The allowable hue difference.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setHueTolerance(difference: number): Parameters {
		this.#hueTol = difference;
		return this;
	}

	/**
	 * Retrieves the hue tolerance.
	 *
	 * @returns The allowable hue difference.
	 */
	getHueTolerance(): number {
		return this.#hueTol;
	}

	/**
	 * Sets whether tone should be preserved.
	 *
	 * @param f - Whether to preserve tone.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setTonePreserved(f: boolean): Parameters {
		this.#doKeepTone = f;
		return this;
	}

	/**
	 * Checks if tone is set to be preserved.
	 *
	 * @returns `true` if tone is preserved, `false` otherwise.
	 */
	doPreserveTone(): boolean {
		return this.#doKeepTone;
	}

	/**
	 * Sets the tolerance for tone difference.
	 *
	 * @param difference - The allowable tone difference.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setToneTolerance(difference: number): Parameters {
		this.#toneTol = difference;
		return this;
	}

	/**
	 * Retrieves the tone tolerance.
	 *
	 * @returns The allowable tone difference.
	 */
	getToneTolerance(): number {
		return this.#toneTol;
	}

	/**
	 * Sets whether conspicuity is checked.
	 *
	 * @param enabled - Whether conspicuity check is enabled.
	 */
	setConspicuityChecked(enabled: boolean): void {
		this.#conspicuity = enabled;
	}

	/**
	 * Checks if conspicuity is set to be checked.
	 *
	 * @returns `true` if conspicuity is checked, `false` otherwise.
	 */
	doCheckConspicuity(): boolean {
		return this.#conspicuity;
	}

	/**
	 * Sets the conspicuity rate.
	 *
	 * @param rate - The conspicuity rate (range [0.01, 0.99]).
	 */
	setConspicuityRate(rate: number): void {
		this.#conspicuityRate = rate;
	}

	/**
	 * Retrieves the conspicuity rate.
	 *
	 * @returns The conspicuity rate.
	 */
	getConspicuityRate(): number {
		return this.#conspicuityRate;
	}

	// Solver settings -----------------------------------------------------------

	#timeLimit           : number | null = 8000;
	#targetDesirability  : number | null = 0.8;
	#solver              : SolverType    = SolverType.FC;
	#isBottleneckResolved: boolean       = false;

	/**
	 * Sets the time limit for the solver in milliseconds.
	 *
	 * @param timeLimit - The time limit in milliseconds.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setTimeLimit(timeLimit: number | null): Parameters {
		this.#timeLimit = timeLimit;
		return this;
	}

	/**
	 * Retrieves the time limit for the solver.
	 *
	 * @returns The time limit in milliseconds.
	 */
	getTimeLimit(): number | null {
		return this.#timeLimit;
	}

	/**
	 * Sets the desirability target value for the solver.
	 *
	 * @param d - The desirability value.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setTargetDesirability(d: number | null): Parameters {
		this.#targetDesirability = d;
		return this;
	}

	/**
	 * Retrieves the desirability target for the solver.
	 *
	 * @returns The desirability target value.
	 */
	getTargetDesirability(): number | null {
		return this.#targetDesirability;
	}

	/**
	 * Sets the solver to use for color adjustment.
	 *
	 * @param s - The solver algorithm.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setSolver(s: SolverType): Parameters {
		this.#solver = s;
		return this;
	}

	/**
	 * Retrieves the solver in use for color adjustment.
	 *
	 * @returns The solver algorithm.
	 */
	getSolverType(): SolverType {
		return this.#solver;
	}

	/**
	 * Sets whether the bottleneck should be resolved in the color adjustment.
	 *
	 * @param resolved - Whether bottleneck resolution is enabled.
	 * @returns The current `Parameters` instance for method chaining.
	 */
	setBottleneckResolved(resolved: boolean): Parameters {
		this.#isBottleneckResolved = resolved;
		return this;
	}

	/**
	 * Checks if bottleneck resolution is enabled for color adjustment.
	 *
	 * @returns `true` if bottleneck resolution is enabled, `false` otherwise.
	 */
	isBottleneckResolved(): boolean {
		return this.#isBottleneckResolved;
	}

}

export enum SolverType {
	FC,
	SRS3,
	FUZZY_BREAKOUT
};
