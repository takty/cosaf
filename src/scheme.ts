/**
 * A class representing color schemes and related information.
 *
 * @author Takuto Yanagida
 * @version 2024-12-12
 */

import { Color } from 'iroay/iroay';
import { Voronoi } from 'voronoi/voronoi';

import { Value } from './value';
import { Vision } from "./vision";

type Triplet = [number, number, number];

class Combination {

	/**
	 * Represents a combination of two color indices with a color difference and a vision type.
	 *
	 * @param index1 - The index of the first color.
	 * @param c1 - The color value of the first color.
	 * @param index2 - The index of the second color.
	 * @param c2 - The color value of the second color.
	 * @param diff - The difference value between the two colors.
	 * @param vision - The type of vision used in comparison.
	 */
	constructor(public index1: number, public c1: number, public index2: number, public c2: number, public diff: number, public vision: Vision) {}

}

export class Scheme {

	/**
	 * Creates an adjacency list for all combinations of color pairs.
	 *
	 * @param size - The total number of colors.
	 * @returns An array of index pairs representing all color adjacencies.
	 */
	private static createAllAdjacencyList(size: number): [number, number][] {
		const ret: [number, number][] = [];
		for (let i: number = 0; i < size; ++i) {
			for (let j: number = i + 1; j < size; ++j) {
				ret.push([i, j]);
			}
		}
		return ret;
	}

	#ads    : [number, number][];  // Adjacency list
	#vals   : Value[] = [];        // List of color values
	#fixed  : boolean[];           // Fixed flag for each color
	#combs  : Combination[];       // List of color combinations
	#quality: number;              // Quality metric for the scheme

	#bnSize! : number;  // Size of the bottleneck color
	#bnIndex!: number;  // Index of the bottleneck color

	#lowDiffT!: Combination;  // Lowest difference for trichromatic vision
	#lowDiffP!: Combination;  // Lowest difference for protanopia
	#lowDiffD!: Combination;  // Lowest difference for deuteranopia
	#lowDiffM!: Combination;  // Lowest difference for monochromatic vision

	/**
	 * Initializes the Scheme with color values, adjacencies, fixed flags, and quality.
	 *
	 * @param colorInts - Array of color values in integer format.
	 * @param adjacencies - Array of adjacency pairs; if null, defaults to all pairs.
	 * @param fixed - Array indicating if each color is fixed; defaults to all false.
	 * @param quality - A quality metric for the scheme.
	 */
	constructor(colorInts: number[], adjacencies: [number, number][] | null = null, fixed: boolean[] | null = null, quality: number = 1) {
		if (adjacencies === null) {
			adjacencies = Scheme.createAllAdjacencyList(colorInts.length);
		}
		this.#ads = [...adjacencies];
		for (const ci of colorInts) {
			this.#vals.push(new Value(ci));
		}
		if (fixed === null) {
			this.#fixed = new Array(this.#vals.length);
			this.#fixed.fill(false);
		} else {
			this.#fixed = [...fixed];
		}
		this.#deriveBottleneck();
		this.#combs   = this.#createAllCombinationList();
		this.#quality = quality;
	}

	/**
	 * Sets the fixed flags for the colors in the scheme.
	 *
	 * @param fs - Array of boolean flags indicating if each color is fixed.
	 */
	setFixedFlags(fs: boolean[]): void {
		this.#fixed = [...fs];
	}

	/**
	 * Sets the internal quality metric for the scheme.
	 *
	 * @param quality - The quality value to set.
	 */
	setQualityInternally(quality: number): void {
		this.#quality = quality;
	}

	/**
	 * Determines the bottleneck color based on Voronoi partition sizes.
	 */
	#deriveBottleneck(): void {
		const sizes: number[] = this.#calcSizeList();
		let min: number = 0;

		for (let i: number = 0; i < sizes.length; ++i) {
			if (sizes[i] < sizes[min]) {
				min = i;
			}
		}
		this.#bnIndex = min;
		this.#bnSize  = sizes[min];
	}

	/**
	 * Calculates an array representing the sizes of each Voronoi partition,
	 * used to identify bottleneck colors.
	 *
	 * @returns An array of partition sizes.
	 */
	#calcSizeList(): number[] {
		const vd: Voronoi = new Voronoi(0, 100, -127, 127, -127, 127);  // L, a, b
		for (let i: number = 0; i < this.#vals.length; ++i) {
			vd.addSite(this.getColor(i).asLab());
		}
		vd.createCells(this.getAdjacencyTable());

		const ret: number[] = [];
		for (let i: number = 0; i < this.#vals.length; ++i) {
			ret.push(vd.countGrids(i, 5));
		}
		return ret;
	}

	/**
	 * Creates a list of all color combinations based on adjacency and vision type.
	 *
	 * @returns An array of all possible color combinations.
	 */
	#createAllCombinationList(): Combination[] {
		const combs: Combination[] = [];
		const table: number[][] = this.getAdjacencyTable();

		this.#lowDiffT = this.addCombinations(table, Vision.TRICHROMACY,  combs) as Combination;
		this.#lowDiffP = this.addCombinations(table, Vision.PROTANOPIA,   combs) as Combination;
		this.#lowDiffD = this.addCombinations(table, Vision.DEUTERANOPIA, combs) as Combination;
		this.#lowDiffM = this.addCombinations(table, Vision.MONOCHROMACY, combs) as Combination;

		combs.sort(
			(o1: Combination, o2: Combination) => {
				if (o1.diff < o2.diff) return -1;
				if (o1.diff > o2.diff) return 1;
				return 0;
			}
		);
		return combs;
	}

	/**
	 * Adds color combinations to the destination array and finds the lowest difference.
	 *
	 * @param table - Adjacency table of color pairs.
	 * @param vis - Vision type for comparison.
	 * @param dest - Array to store the color combinations.
	 * @returns The combination with the lowest difference.
	 */
	private addCombinations(table: number[][], vis: Vision, dest: Combination[]):  Combination | null {
		let lowDiff: Combination | null = null;
		for (let i: number = 0; i < table.length; ++i) {
			for (const j of table[i]) {
				if (i >= j) {
					continue;
				}
				const diff: number = this.getDifference(i, j, vis);
				const c: Combination = new Combination(i, this.getColor(i, vis).asInteger(), j, this.getColor(j, vis).asInteger(), diff, vis);
				dest.push(c);
				if (lowDiff == null || diff < lowDiff.diff) {
					lowDiff = c;
				}
			}
		}
		return lowDiff;
	}


	// -------------------------------------------------------------------------


	/**
	 * Returns the list of adjacency pairs.
	 *
	 * @returns A copy of the adjacency list.
	 */
	getAdjacencies(): [number, number][] {
		return [...this.#ads];
	}

	/**
	 * Provides the adjacency table, optionally omitting a specified index.
	 *
	 * @param omittedIndex - Index to omit from the adjacency table; defaults to -1.
	 * @returns A 2D array representing the adjacency table.
	 */
	getAdjacencyTable(omittedIndex: number = -1): number[][] {
		const table: number[][] = [];

		for (let i: number = 0; i < this.#vals.length; ++i) {
			const rel: number[] = [];
			for (const [idx0, idx1] of this.#ads) {
				if (idx0 === omittedIndex || idx1 === omittedIndex) {
					continue;
				}
				if (idx0 === i) rel.push(idx1);
				else if (idx1 === i) rel.push(idx0);
			}
			table.push(rel);
		}
		return table;
	}

	/**
	 * Computes the conspicuity array, normalizing values between 0 and 1.
	 *
	 * @returns An array of normalized conspicuity values for each color.
	 */
	getConspicuityArray(): number[] {
		const ret: number[] = [];

		let min: number = Number.MAX_VALUE;
		let max: number = Number.MIN_VALUE;

		for (let i: number = 0; i < this.#vals.length; ++i) {
			const c: number = this.#vals[i].getColor().asConspicuity();
			if (c < min) {
				min = c;
			} else if (max < c) {
				max = c;
			}
		}
		for (let i: number = 0; i < this.#vals.length; ++i) {
			ret.push((this.#vals[i].getColor().asConspicuity() - min) / (max - min));
		}
		return ret;
	}

	/**
	 * Returns the total number of colors in the scheme.
	 *
	 * @returns The size of the color scheme.
	 */
	size(): number {
		return this.#vals.length;
	}

	/**
	 * Checks if a color at a given index is fixed.
	 *
	 * @param idx - Index of the color.
	 * @returns True if the color is fixed, otherwise false.
	 */
	isFixed(idx: number): boolean {
		return this.#fixed[idx];
	}

	/**
	 * Retrieves the color at a specified index for a given vision type.
	 *
	 * @param idx - Index of the color.
	 * @param vis - Vision type; defaults to TRICHROMACY.
	 * @returns The color object for the specified index.
	 */
	getColor(idx: number, vis: Vision = Vision.TRICHROMACY): Color {
		return this.#vals[idx].getColor(vis);
	}

	/**
	 * Gets the iterator of the values.
	 */
	[Symbol.iterator](): Iterator<Value> {
		return this.#vals[Symbol.iterator]();
	}

	/**
	 * Returns the index of the bottleneck color in the scheme.
	 *
	 * @returns The index of the bottleneck color.
	 */
	getBottleneckIndex(): number {
		return this.#bnIndex;
	}

	/**
	 * Returns the size of the bottleneck color in the scheme.
	 *
	 * @returns The size of the bottleneck color.
	 */
	getBottleneckSize(): number {
		return this.#bnSize;
	}

	/**
	 * Calculates the color difference between two indices for a given vision type.
	 *
	 * @param idx0 - Index of the first color.
	 * @param idx1 - Index of the second color.
	 * @param vis - Vision type; defaults to TRICHROMACY.
	 * @returns The difference between the two colors.
	 */
	getDifference(idx0: number, idx1: number, vis: Vision = Vision.TRICHROMACY): number {
		return this.#vals[idx0].differenceFrom(this.#vals[idx1], vis);
	}

	/**
	 * Retrieves the combination with the lowest difference for a given vision type.
	 *
	 * @param vis - Vision type; defaults to TRICHROMACY.
	 * @returns The combination with the lowest color difference.
	 */
	getLowestDifferenceCombination(vis: Vision = Vision.TRICHROMACY): Combination {
		if (null === vis) {
			let com: Combination = this.#lowDiffT;
			if (this.#lowDiffP.diff < com.diff) com = this.#lowDiffP;
			if (this.#lowDiffD.diff < com.diff) com = this.#lowDiffD;
			if (this.#lowDiffM.diff < com.diff) com = this.#lowDiffM;
			return com;
		}
		switch (vis) {
			case Vision.PROTANOPIA  : return this.#lowDiffP;
			case Vision.DEUTERANOPIA: return this.#lowDiffD;
			case Vision.MONOCHROMACY: return this.#lowDiffM;
			default                 : return this.#lowDiffT;
		}
	}

	/**
	 * Retrieves all combinations that match specified vision types.
	 *
	 * @param T - Include trichromacy combinations.
	 * @param P - Include protanopia combinations.
	 * @param D - Include deuteranopia combinations.
	 * @param M - Include monochromacy combinations.
	 * @returns An array of color combinations matching the specified vision types.
	 */
	getCombinationList(T: boolean, P: boolean, D: boolean, M: boolean): Combination[] {
		const com: Combination[] = [];

		for (const c of this.#combs) {
			     if (T && c.vision == Vision.TRICHROMACY)  com.push(c);
			else if (P && c.vision == Vision.PROTANOPIA)   com.push(c);
			else if (D && c.vision == Vision.DEUTERANOPIA) com.push(c);
			else if (M && c.vision == Vision.MONOCHROMACY) com.push(c);
		}
		return com;
	}

	/**
	 * Retrieves the lowest color difference for a given vision type.
	 *
	 * @param vis - Vision type.
	 * @returns The lowest color difference value for the specified vision type.
	 */
	getLowestDifference(vis: Vision): number {
		switch (vis) {
			case Vision.PROTANOPIA  : return this.#lowDiffP.diff;
			case Vision.DEUTERANOPIA: return this.#lowDiffD.diff;
			case Vision.MONOCHROMACY: return this.#lowDiffM.diff;
			default                 : return this.#lowDiffT.diff;
		}
	}

	/**
	 * Computes the total color difference from another Scheme.
	 *
	 * @param cs - The other color scheme.
	 * @returns The total difference value.
	 */
	totalDifferenceFrom(cs: Scheme): number {
		let sum: number = 0;

		for (let i: number = 0; i < this.#vals.length; ++i) {
			sum += this.#vals[i].differenceFrom(cs.#vals[i]);
		}
		return sum;
	}

	/**
	 * Retrieves the quality metric of the scheme.
	 *
	 * @returns The quality value.
	 */
	getQuality(): number {
		return this.#quality;
	}

	/**
	 * Calculates the average normalized difference for a vision type.
	 *
	 * @param vis - Vision type.
	 * @returns The average normalized difference.
	 */
	aveNablaE(vis: Vision): number {
		let sum: number = 0;

		for (const [idx0, idx1] of this.#ads) {
			const dE: number = this.#vals[idx0].differenceFrom(this.#vals[idx1]);
			const de: number = this.getDifference(idx0, idx1, vis);
			sum += Math.abs(dE - de) / dE;
		}
		return sum / this.#ads.length;
	}

	/**
	 * Calculates the average delta E (color difference) between two schemes.
	 *
	 * @param org - Original scheme.
	 * @param mod - Modified scheme.
	 * @returns The average color difference.
	 */
	static aveDeltaE(org: Scheme, mod: Scheme): number {
		let sum: number = 0;

		for (let i: number = 0; i < org.#vals.length; ++i) {
			const dE: number = org.#vals[i].differenceFrom(mod.#vals[i]);
			sum += dE;
		}
		return sum / org.size();
	}

	/**
	 * Calculates the average delta H (hue difference) between two schemes.
	 *
	 * @param org - Original scheme.
	 * @param mod - Modified scheme.
	 * @returns The average hue difference.
	 */
	static aveDeltaH(org: Scheme, mod: Scheme): number {
		let sum: number = 0;

		for (let i: number = 0; i < org.#vals.length; ++i) {
			const o: Triplet = org.getColor(i).asPccs();
			const m: Triplet = mod.getColor(i).asPccs();
			const asH: number = Math.abs(m[0] - o[0]);
			const dH: number = Math.min(asH, 24 - asH);
			sum += dH;
		}
		return sum / org.size();
	}

	/**
	 * Calculates the average delta T (tint difference) between two schemes.
	 *
	 * @param org - Original scheme.
	 * @param mod - Modified scheme.
	 * @returns The average tint difference.
	 */
	static aveDeltaT(org: Scheme, mod: Scheme): number {
		let sum: number = 0;

		for (let i: number = 0; i < org.#vals.length; ++i) {
			const o: Triplet = org.getColor(i).asPccs();
			const m: Triplet = mod.getColor(i).asPccs();
			sum += Math.sqrt((m[1] - o[1]) * (m[1] - o[1]) + (m[2] - o[2]) * (m[2] - o[2]));
		}
		return sum / org.size();
	}

	/**
	 * Generates a string representing the lowest difference combinations by vision type.
	 *
	 * @returns A formatted string of the lowest difference combinations.
	 */
	toString(): string {
		const tn: string[] = ['T', 'P', 'D', 'M'];
		const vs: Vision[] = Object.keys(Vision).map(x => parseInt(x)).filter(x => !isNaN(x)) as Vision[];
		const lc: Combination = this.getLowestDifferenceCombination();
		let sb: string = '';

		for (const [i, vis] of vs.entries()) {
			const com: Combination = this.getLowestDifferenceCombination(vis);
			sb += `${(com == lc ? '*' : ' ')}${tn[i]}<${String(com.index1).padStart(2, '0')}, ${String(com.index2).padStart(2, '0')}>${com.diff.toFixed(2)}`;
			if (i < vs.length - 1) {
				sb += ', ';
			}
		}
		return sb;
	}

}
