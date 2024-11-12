/**
 * Class representing a color adjustment system.
 * Provides methods to adjust color schemes based on a variety of parameters and constraints.
 *
 * @author Takuto Yanagida
 * @version 2024-11-12
 */

import { Problem, Domain, Solver, AssignmentList, FuzzyForwardChecking, SRS3, FuzzyBreakout } from 'stlics/stlics';

import { Parameters, SolverType } from './parameters';
import { Scheme } from './scheme';
import { Candidates } from './candidates';
import { Value } from './value';
import { RelationFactory } from './relation-factory';
import { RelationFactory1 } from './relation-factory1';
import { RelationFactory2 } from './relation-factory2';
import { DomainFactory1 } from './domain-factory1';
import { DomainFactory2 } from './domain-factory2';

export class Adjuster {

	static DEBUG: boolean = true;

	#param: Parameters = new Parameters();
	#als  : ((s: Scheme) => boolean)[] = [];

	#org! : Scheme;
	#cans!: Candidates[];
	#mod! : Scheme;

	/**
	 * Initializes an instance of `Adjuster` with optional parameters.
	 *
	 * @param param - Optional parameters for the color adjustment system.
	 */
	constructor(param: Parameters | null = null) {
		if (param) {
			this.#param = param;
		}
	}

	/**
	 * Retrieves the current parameters for color adjustment.
	 *
	 * @returns The current `Parameters` instance.
	 */
	getParameters(): Parameters {
		return this.#param;
	}

	/**
	 * Sets the parameters for color adjustment.
	 *
	 * @param param - The `Parameters` instance to set.
	 */
	setParameters(param: Parameters): void {
		this.#param = param;
	}

	/**
	 * Adds a listener to the adjuster, which will be notified of proposed color adjustments.
	 *
	 * @param al - The `AdjusterListener` instance to add.
	 */
	addListener(al: ((s: Scheme) => boolean)): void {
		this.#als.push(al);
	}

	/**
	 * Removes a listener from the adjuster.
	 *
	 * @param al - The `AdjusterListener` instance to remove.
	 */
	removeListener(al: ((s: Scheme) => boolean)): void {
		const i: number = this.#als.indexOf(al);
		if (-1 !== i) {
			this.#als.splice(i, 1);
		}
	}

	/**
	 * Adjusts the color scheme based on the provided original scheme and constraints.
	 *
	 * @param org - The original color scheme to adjust.
	 * @returns The adjusted color scheme or `null` if no solution was found.
	 */
	adjust(org: Scheme): Scheme | null {
		this.#org = org;

		let p: Problem;
		if (this.#param.isBottleneckResolved()) {
			p = this.#createProblemWithBottleneck(this.#org.getBottleneckIndex());
		} else {
			p = this.#createProblem();
		}
		org.setQualityInternally(p.worstSatisfactionDegree());

		const s: Solver = this.#createSolver(p);
		try {
			if (!s.solve()) {
				if (Adjuster.DEBUG) {
					console.log('Adjuster: No solution found.');
				}
				return null;
			}
		} catch (ex) {
			if (Adjuster.DEBUG) {
				console.log('Adjuster: Exception occurred: ' + (ex as Error).toString());
			}
			return null;
		}
		return this.#mod;
	}

	/**
	 * Creates a `Problem` instance representing the constraints and relations between colors.
	 *
	 * @returns A `Problem` instance based on the current parameters.
	 */
	#createProblem(): Problem {
		let rf: RelationFactory;
		if (this.#param.isRatioModeEnabled()) {
			rf         = new RelationFactory2(this.#org, this.#param);
			this.#cans = new DomainFactory2(this.#org, this.#param).build();
		} else {
			rf         = new RelationFactory1(this.#org, this.#param);
			this.#cans = new DomainFactory1(this.#org, this.#param).build();
		}
		const p: Problem = new Problem();
		for (const can of this.#cans) {
			p.createVariable({
				name  : 'v',
				domain: p.createDomain({
					min: 0,
					max: can.values().length - 1
				}) as Domain,
				value: 0,
			});
		}
		for (const [idx0, idx1] of this.#org.getAdjacencies()) {
			if (this.#org.isFixed(idx0) && this.#org.isFixed(idx1)) {  // No constraints if both are fixed colors
				continue;
			}
			let nom: number = -1;
			if (this.#org.isFixed(idx0)) nom = 0;
			if (this.#org.isFixed(idx1)) nom = 1;

			p.createConstraint({
				relation : rf.newInstance(idx0, idx1, this.#cans[idx0], this.#cans[idx1], nom),
				variables: [p.variableAt(idx0), p.variableAt(idx1)],
			});
		}
		return p;
	}

	/**
	 * Creates a `Problem` instance while considering a bottleneck constraint.
	 *
	 * @param bottleneck - The index of the bottleneck to consider.
	 * @returns A `Problem` instance with bottleneck constraints applied.
	 */
	#createProblemWithBottleneck(bottleneck: number): Problem {
		let rf: RelationFactory;
		if (this.#param.isRatioModeEnabled()) {
			rf         = new RelationFactory2(this.#org, this.#param, bottleneck);
			this.#cans = new DomainFactory2(this.#org, this.#param).build(bottleneck);
		} else {
			rf         = new RelationFactory1(this.#org, this.#param);
			this.#cans = new DomainFactory1(this.#org, this.#param).build(bottleneck);
		}
		const p: Problem = new Problem();
		for (const can of this.#cans) {
			p.createVariable({
				name  : 'v',
				domain: p.createDomain({
					min: 0,
					max: can.values().length - 1
				}) as Domain,
				value : 0
			});
		}
		for (const [idx0, idx1] of this.#org.getAdjacencies()) {
			if (this.#org.isFixed(idx0) && this.#org.isFixed(idx1)) {  // No constraints if both are fixed colors
				continue;
			}
			let nom: number = -1;
			if (idx0 == bottleneck || this.#org.isFixed(idx0)) nom = 0;
			if (idx1 == bottleneck || this.#org.isFixed(idx1)) nom = 1;

			p.createConstraint({
				relation : rf.newInstance(idx0, idx1, this.#cans[idx0], this.#cans[idx1], nom),
				variables: [p.variableAt(idx0), p.variableAt(idx1)],
			});
		}
		return p;
	}

	/**
	 * Creates a solver for the specified problem, based on the solver type in the parameters.
	 *
	 * @param p - The problem to solve.
	 * @returns A `Solver` instance configured with the current parameters.
	 */
	#createSolver(p: Problem): Solver {
		let s: Solver;

		switch (this.#param.getSolverType()) {
			case SolverType.FC:
			default:
				s = new FuzzyForwardChecking(p);
				(s as FuzzyForwardChecking).setUsingMinimumRemainingValuesHeuristics(true);
				(s as FuzzyForwardChecking).setIncrementStepOfWorstSatisfactionDegree(0.05);
				break;
			case SolverType.SRS3:
				s = new SRS3(p);
				(s as SRS3).setRandomness(false);
				break;
			case SolverType.FUZZY_BREAKOUT:
				s = new FuzzyBreakout(p);
				(s as FuzzyBreakout).setRandomness(false);
				break;
		}
		s.setTimeLimit(this.#param.getTimeLimit());
		s.setTargetRate(this.#param.getTargetDesirability());

		s.addListener({
			foundSolution: (solution: AssignmentList, worstDegree: number): boolean => {
				return this.#notifyResult(solution, worstDegree);
			}
		});
		return s;
	}

	/**
	 * Notifies listeners with the results of the color adjustment solution.
	 *
	 * @param solution - The solution obtained by the solver.
	 * @param worstDegree - The worst satisfaction degree of the solution.
	 * @returns `true` if the search should finish; otherwise, `false`.
	 */
	#notifyResult(solution: AssignmentList, worstDegree: number): boolean {
		const res: number[] = [];

		for (let i: number = 0; i < this.#org.size(); ++i) {
			const val: number = solution.at(i).value();
			const cv : Value  = this.#cans[i].values()[val];
			res.push(cv.getColor().asInteger());
		}

		this.#mod = new Scheme(res, this.#org.getAdjacencies(), null, worstDegree);
		let finish: boolean = (worstDegree > 0.999);  // Automatic termination

		for (const al of this.#als) {
			if (al(this.#mod)) {
				finish = true;
			}
		}
		return finish;
	}

}
