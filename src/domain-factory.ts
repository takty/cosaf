/**
 * Interface for generating domains of approximate colors.
 *
 * @author Takuto Yanagida
 * @version 2024-10-31
 */

import { Candidates } from './candidates';

export const MAX_DELTA_HUE : number = 12;  // Based on PCCS standard
export const MAX_DELTA_TONE: number = Math.sqrt(10 * 10 + 10 * 10);  // Based on PCCS standard

export interface DomainFactory {

	/**
	 * Builds an array of color candidate domains, with an option to omit a specific index.
	 *
	 * @param omitIdx - The index to omit from the domain, or `-1` if no index should be omitted.
	 * @returns An array of `Candidates` instances representing the color domains.
	 */
	build(omitIdx: number): Candidates[];

}
