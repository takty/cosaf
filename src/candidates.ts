/**
 * Represents a collection of candidate values, with one designated as the original.
 * Provides methods to access and modify the original value and check if it has been assigned.
 *
 * @author Takuto Yanagida
 * @version 2024-11-01
 */

import { Value } from './value';

export class Candidates {

	#orig: Value;
	#vs  : Value[] = [];

	/**
	 * Retrieves the original value if assigned; otherwise, returns the first value in the candidates list.
	 *
	 * @returns The original value if assigned, or the first value in the candidate list.
	 */
	getOriginal(): Value {
		if (this.#orig !== null) {
			return this.#orig;
		}
		return this.#vs[0];
	}

	/**
	 * Sets the specified value as the original value.
	 *
	 * @param original - The value to designate as the original.
	 */
	setOriginal(original: Value): void {
		this.#orig = original;
	}

	/**
	 * Checks if an original value has been assigned.
	 *
	 * @returns `true` if an original value has been assigned; otherwise, `false`.
	 */
	isOriginalAssigned(): boolean {
		return this.#orig !== null;
	}

	/**
	 * Retrieves the list of candidate values.
	 *
	 * @returns An array of candidate values.
	 */
	values(): Value[] {
		return this.#vs;
	}

}
