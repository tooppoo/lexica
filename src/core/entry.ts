import * as v from "valibot";
import type { Entry, Meaning, Score, Term } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";
import { defaultScore } from "./score";

const nonEmptyStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const meaningsSchema = v.pipe(v.array(nonEmptyStringSchema), v.minLength(1));

const parseNonEmpty = (value: string): Result<string> => {
  const parsed = v.safeParse(nonEmptyStringSchema, value);
  if (!parsed.success) {
    return failInvalidInput("Value must not be empty");
  }
  return succeed(parsed.output);
};

/**
 * Parses a raw term string into a Term.
 */
export const parseTerm = (value: string): Result<Term> => {
  const parsed = parseNonEmpty(value);
  if (parsed.type === "Failure") {
    return parsed;
  }
  return succeed(parsed.value as Term);
};

/**
 * Parses a raw meaning string into a Meaning.
 */
export const parseMeaning = (value: string): Result<Meaning> => {
  const parsed = parseNonEmpty(value);
  if (parsed.type === "Failure") {
    return parsed;
  }
  return succeed(parsed.value as Meaning);
};

/**
 * Parses a raw example string.
 */
export const parseExample = (value: string): Result<string> => {
  const parsed = parseNonEmpty(value);
  if (parsed.type === "Failure") {
    return parsed;
  }
  return succeed(parsed.value);
};

/**
 * Parses an array of meaning strings into Meaning[] with at least one entry.
 */
export const parseMeanings = (values: string[]): Result<Meaning[]> => {
  const parsed = v.safeParse(meaningsSchema, values);
  if (!parsed.success) {
    return failInvalidInput("Meanings must not be empty");
  }
  return succeed(parsed.output.map((meaning) => meaning as Meaning));
};

/**
 * Creates an Entry from parsed inputs.
 */
export const createEntry = (
  term: Term,
  meanings: Meaning[],
  examples?: string[],
  score?: Score,
): Entry => {
  const resolvedScore = score ?? defaultScore();
  if (examples === undefined) {
    return { term, meanings, score: resolvedScore };
  }
  return { term, meanings, examples, score: resolvedScore };
};

/**
 * Overwrites entry examples with a new list.
 */
export const overwriteExamples = (entry: Entry, examples: string[]): Entry => {
  return { ...entry, examples };
};

/**
 * Appends a new example to the entry.
 */
export const appendExample = (entry: Entry, example: string): Entry => {
  return { ...entry, examples: [...(entry.examples ?? []), example] };
};

/**
 * Overwrites entry score with a new value.
 */
export const overwriteScore = (entry: Entry, score: Score): Entry => {
  return { ...entry, score };
};
