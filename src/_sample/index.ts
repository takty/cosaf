/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2026-07-13
 */

import { ColorUtil } from 'iroay/iroay';
import { Scheme, Adjuster, Parameters, SolverType } from '../../cosaf';

const orig = new Scheme([
	ColorUtil.fromString('#f00')?.asInteger() as number,
	ColorUtil.fromString('#090')?.asInteger() as number,
	ColorUtil.fromString('#009')?.asInteger() as number,
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

function log(s: Scheme): void {
	for (const v of s) {
		console.log(v.getColor().toString());
	}
	console.log(s.toString());
}
