/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2024-12-12
 */

import 'klales/klales.min.css';
import { Color } from 'iroay/iroay';
import { Scheme, Adjuster, Parameters, SolverType } from '../../cosaf';

document.addEventListener('DOMContentLoaded', (): void => {
	const s = new Scheme([
		Color.fromString('#f00')?.asInteger() as number,
		Color.fromString('#090')?.asInteger() as number,
		Color.fromString('#091')?.asInteger() as number,
	]);

	const p = new Parameters();
	p.setRatioModeEnabled(false);
	// p.setHuePreserved(false);
	// p.setTonePreserved(false);
	p.setTargetDesirability(null);
	p.setSolver(SolverType.FC);
	// p.setSolver(SolverType.FUZZY_BREAKOUT);
	// p.setSolver(SolverType.SRS3);
	const a = new Adjuster(p);

	a.addListener((s: Scheme, degree: number): boolean => {
		console.log(degree.toFixed(2), '--', s.toString());
		return 0.8 < degree;
	});
	const mod: Scheme | null = a.adjust(s);
	if (mod) {
		for (const v of mod) {
			console.log(v.getColor().toString());
		}
	}
});
