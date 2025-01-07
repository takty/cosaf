/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2025-01-07
 */

import 'klales/klales.min.css';
import { Color } from 'iroay/iroay';
import { Scheme, Adjuster, Parameters, SolverType } from '../../cosaf';

document.addEventListener('DOMContentLoaded', (): void => {
	const orig = new Scheme([
		Color.fromString('#f00')?.asInteger() as number,
		Color.fromString('#090')?.asInteger() as number,
		Color.fromString('#009')?.asInteger() as number,
	]);
	log(orig);

	const p = new Parameters();
	// p.setRatioModeEnabled(false);
	// p.setHuePreserved(false);
	// p.setTonePreserved(false);

	p.setSolver(SolverType.FC);
	// p.setSolver(SolverType.FUZZY_BREAKOUT);
	// p.setSolver(SolverType.SRS3);

	const a = new Adjuster(p);
	const mod: Scheme | null = a.adjust(orig);
	if (mod) log(mod);
});

function log(s: Scheme): void {
	for (const v of s) {
		console.log(v.getColor().toString());
	}
	console.log(s.toString());
}
