/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2024-11-12
 */

import 'klales/klales.min.css';
import { Color, ColorSpace } from 'iroay/iroay';
import { Scheme, Adjuster } from '../../cosaf';

type Triplet = [number, number, number];

document.addEventListener('DOMContentLoaded', (): void => {
	const cs = [
		Color.fromString('#f00')?.asInteger() as number,
		Color.fromString('#090')?.asInteger() as number,
	];
	new Scheme(cs);
});
