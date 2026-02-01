import * as v from "valibot";
import type { Score } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";

const scoreSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

/**
 * Parses an unknown value into a Score.
 */
export const parseScore = (value: unknown): Result<Score> => {
  const parsed = v.safeParse(scoreSchema, value);
  if (!parsed.success) {
    return failInvalidInput("Score must be a non-negative integer");
  }
  return succeed(parsed.output as Score);
};

/**
 * Returns the default score value.
 */
export const defaultScore = (): Score => 0 as Score;

/**
 * Increments a score by 1.
 */
export const incrementScore = (score: Score): Score => ((score as number) + 1) as Score;

/**
 * Decrements a score by 1 with a lower bound of 0.
 */
export const decrementScore = (score: Score): Score => Math.max(0, (score as number) - 1) as Score;

/**
 * Converts a score to a number.
 */
export const scoreToNumber = (score: Score): number => score as number;
