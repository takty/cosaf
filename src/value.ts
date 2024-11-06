/**
 * Class representing color information in various color spaces, including Lab, Protanopia, and Deuteranopia.
 * Provides methods for creating color instances and calculating differences in Lab color space.
 *
 * @author Takuto Yanagida
 * @version 2024-11-06
 */

import { Color, ColorSpace } from 'iroay/iroay';
import { Vision } from './vision';

type Triplet = [number, number, number];

export class Value {

	/**
	 * Creates a new `Value` instance if the specified Lab color is within RGB gamut.
	 *
	 * @param lab - The Lab color values as a triplet.
	 * @returns A new `Value` instance or `null` if the color is not within RGB gamut.
	 */
	static newInstance(lab: Triplet): Value | null {
		const c = new Color(ColorSpace.Lab, lab);
		if (c.isRGBSaturated(true)) {
			return null;
		}
		return new Value(c);
	}

	#cv: Color;
	#cP: Color;
	#cD: Color;
	#cM: Color;

	/** Color triplets, accessible within the package for derivation reference */
	lab : Triplet;
	labP: Triplet;
	labD: Triplet;
	tone: Triplet;

	/**
	 * Constructs a `Value` instance from either a color integer or a `Color` object.
	 *
	 * @param colorInt_c - The color as an integer (with alpha set to 255) or as a `Color` object.
	 */
	constructor(colorInt_c: number | Color) {
		if (colorInt_c instanceof Color) {
			this.#cv = colorInt_c;
		} else {
			this.#cv = Color.fromInteger(colorInt_c);
		}
		this.#cP = this.#cv.toProtanopia();
		this.#cD = this.#cv.toDeuteranopia();
		this.#cM = new Color(ColorSpace.Lab, [this.#cv.asLab()[0], 0, 0]);

		this.lab  = this.#cv.asLab();
		this.labP = this.#cP.asLab();
		this.labD = this.#cD.asLab();
		this.tone = this.#cv.asTone();
	}

	/**
	 * Retrieves the color.
	 *
	 * @returns The color.
	 */
	getColor(vis: Vision = Vision.TRICHROMACY): Color {
		switch (vis) {
			case Vision.PROTANOPIA  : return this.#cP;
			case Vision.DEUTERANOPIA: return this.#cD;
			case Vision.MONOCHROMACY: return this.#cM;
			default                 : return this.#cv;
		}
	}

	/**
	 * Calculates the color difference between this color and another in the Lab color space.
	 *
	 * @param v - The other `Value` instance to compare with.
	 * @returns The color difference calculated using the CIE76 formula.
	 */
	differenceFrom(v: Value, vis: Vision = Vision.TRICHROMACY): number {
		switch (vis) {
			case Vision.PROTANOPIA  : return this.#cP.differenceFrom(v.#cP);
			case Vision.DEUTERANOPIA: return this.#cD.differenceFrom(v.#cD);
			case Vision.MONOCHROMACY: return this.#cM.differenceFrom(v.#cM);
			default                 : return this.#cv.differenceFrom(v.#cv);
		}
	}

}
