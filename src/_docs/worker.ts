/**
 * Worker for Cosaf Sample
 *
 * @author Takuto Yanagida
 * @version 2026-07-13
 */

import { Adjuster, Parameters, Scheme, SolverType } from '../../cosaf';
import { DomainFactory } from '../domain-factory';
import { RelationFactory } from '../relation-factory';

type AdjustTask = {
	colors    : number[];
	solverType: SolverType;
	target    : number | null;
	timeLimit : number | null;
	bnResolved: boolean;
	debug     : boolean;
};

onmessage = (e: MessageEvent<unknown>): void => {
	const data = e.data as Record<string, unknown>;
	if (data.task !== 'adjust' || !Array.isArray(data.args)) return;
	const [task] = data.args;
	adjust(task);
};

function adjust(task: AdjustTask): void {
	const originalLog = console.log;
	console.log = (...args: unknown[]): void => { if (task.debug) postMessage({ log: args.map(String).join(' ') }); };

	try {
		Adjuster.DEBUG        = task.debug;
		DomainFactory.DEBUG   = task.debug;
		RelationFactory.DEBUG = task.debug;

		const params = new Parameters();
		params.setSolver(task?.solverType ?? SolverType.FC);
		params.setTargetDesirability(task?.target ?? 0.8);
		params.setTimeLimit(task?.timeLimit ?? 4000);
		params.setBottleneckResolved(task?.bnResolved ?? false);

		const original = new Scheme(task.colors);
		const start    = Date.now();
		const modified = new Adjuster(params).adjust(original);
		const time     = Date.now() - start;

		postMessage({
			result: {
				colors : modified ? colorsOf(modified)    : null,
				quality: modified ? modified.getQuality() : null,
				time,
			},
		});
	} catch (error) {
		postMessage({ error: error instanceof Error ? error.message : String(error) });
	} finally {
		console.log = originalLog;
	}
}

function colorsOf(scheme: Scheme): number[] {
	const colors: number[] = [];
	for (let i = 0; i < scheme.size(); ++i) {
		colors.push(scheme.getColor(i).asInteger());
	}
	return colors;
}
