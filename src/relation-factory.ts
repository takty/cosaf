/**
 * Interface for generating relationships between colors.
 * Defines a method to create a new color relation instance.
 *
 * @author Takuto Yanagida
 * @version 2024-11-06
 */

import { Relation } from 'stlics/stlics';
import { Candidates } from './candidates';

export interface RelationFactory {

	/**
	 * Creates a new instance of a color relation between two color candidates.
	 *
	 * @param index1 - The index of the first color.
	 * @param index2 - The index of the second color.
	 * @param cvs1 - The first set of color candidates.
	 * @param cvs2 - The second set of color candidates.
	 * @param noPreserve - An optional parameter for skipping preservation checks.
	 * @returns A new `Relation` instance representing the color relationship.
	 */
	newInstance(index1: number, index2: number, cvs1: Candidates, cvs2: Candidates, noPreserve: number): Relation;

}
