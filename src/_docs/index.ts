/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2024-12-10
 */

import 'klales/klales.min.css';
import { Color, ColorSpace } from 'iroay/iroay';
import { Scheme, Adjuster, Parameters, SolverType } from '../../cosaf';

type Triplet = [number, number, number];

document.addEventListener('DOMContentLoaded', (): void => {
	const cs = [
		Color.fromString('#f00')?.asInteger() as number,
		Color.fromString('#090')?.asInteger() as number,
		Color.fromString('#091')?.asInteger() as number,
	];
	const p = new Parameters();
	p.setRatioModeEnabled(false);
	p.setTargetDesirability(0.8);
	p.setSolver(SolverType.FC);
	// p.setSolver(SolverType.FUZZY_BREAKOUT);
	// p.setSolver(SolverType.SRS3);
	const s = new Scheme(cs);
	const a = new Adjuster(p);
	const mod: Scheme | null = a.adjust(s);
	if (mod) {
		console.log(s.toString());
		console.log(mod.toString());
	}
});
