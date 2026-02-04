import * as v from "valibot";
import type { Result } from "./result";
import { failInvalidInput, succeed } from "./result";
import type { AppState, DictionaryName, Entry, Score, Term, TestCount, TestMode } from "./types";
import { decrementScore, incrementScore, scoreToNumber } from "./score";
import { findEntry, overwriteScore, replaceEntry } from "./entry";

const testModeSchema = v.picklist(["meanings", "examples"] as const);
const testCountSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export interface TestSelection {
  entry: Entry;
  example?: string;
}

/**
 * Parses a raw test mode string into a TestMode.
 */
export const parseTestMode = (value: string): Result<TestMode> => {
  const parsed = v.safeParse(testModeSchema, value);
  if (!parsed.success) {
    return failInvalidInput("Invalid test mode");
  }
  return succeed(parsed.output);
};

/**
 * Parses an unknown value into a TestCount.
 */
export const parseTestCount = (value: unknown): Result<TestCount> => {
  const numeric = typeof value === "string" ? Number(value) : value;
  const parsed = v.safeParse(testCountSchema, numeric);
  if (!parsed.success) {
    return failInvalidInput("Invalid test count");
  }
  return succeed(parsed.output as TestCount);
};

/**
 * Returns the default test count.
 */
export const defaultTestCount = (): TestCount => 10 as TestCount;

/**
 * Selects the next meaning test entry based on score weighting.
 */
export const selectMeaningTestEntry = (
  state: AppState,
  usedTerms: Set<Term>,
  rng: () => number = Math.random,
): Result<TestSelection | null> => {
  return selectTestEntry(state, meaningsStrategy(usedTerms), rng);
};

/**
 * Selects the next example test entry based on score weighting.
 */
export const selectExampleTestEntry = (
  state: AppState,
  usedExamples: Set<string>,
  rng: () => number = Math.random,
): Result<TestSelection | null> => {
  return selectTestEntry(state, examplesStrategy(usedExamples, rng), rng);
};

const selectTestEntry = (
  state: AppState,
  strategy: TestSelectionStrategy,
  rng: () => number,
): Result<TestSelection | null> => {
  const eligible = state.entries.filter((entry) => strategy.isEligible(entry));
  const chosen = chooseWeightedEntry(eligible, rng);
  if (!chosen) {
    return succeed(null);
  }
  return succeed(strategy.createSelection(chosen));
};

const updateTestScore = (
  state: AppState,
  term: Term,
  nextScore: (score: Score) => Score,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = findEntry(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }

  const updatedEntry = overwriteScore(currentEntry.value, nextScore(currentEntry.value.score));
  const replaced = replaceEntry(state.entries, updatedEntry);
  if (replaced.type === "Failure") {
    return replaced;
  }
  return succeed({
    state: { ...state, entries: replaced.value.entries },
    entry: replaced.value.entry,
    dictionaryName: state.dictionary.name,
  });
};

/**
 * Increments the score for a term when remembered.
 */
export const rememberEntry = (
  state: AppState,
  term: Term,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return updateTestScore(state, term, incrementScore);
};

/**
 * Decrements the score for a term when not remembered.
 */
export const forgetEntry = (
  state: AppState,
  term: Term,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return updateTestScore(state, term, decrementScore);
};

interface TestSelectionStrategy {
  isEligible: (entry: Entry) => boolean;
  createSelection: (entry: Entry) => TestSelection | null;
}

const meaningsStrategy = (usedTerms: Set<Term>): TestSelectionStrategy => ({
  isEligible: (entry) => !usedTerms.has(entry.term),
  createSelection: (entry) => ({ entry }),
});

const examplesStrategy = (usedExamples: Set<string>, rng: () => number): TestSelectionStrategy => ({
  isEligible: (entry) => (entry.examples ?? []).some((example) => !usedExamples.has(example)),
  createSelection: (entry) => {
    const examples = (entry.examples ?? []).filter((example) => !usedExamples.has(example));
    if (examples.length === 0) {
      return null;
    }
    const example = examples[Math.floor(rng() * examples.length)];
    if (!example) {
      return null;
    }
    return { entry, example };
  },
});

const chooseWeightedEntry = (entries: Entry[], rng: () => number): Entry | null => {
  if (entries.length === 0) {
    return null;
  }
  const totalWeight = entries.reduce((sum, entry) => sum + 1 / (scoreToNumber(entry.score) + 1), 0);
  const pick = rng() * totalWeight;
  let cursor = 0;
  let chosen = entries[0];
  for (const entry of entries) {
    cursor += 1 / (scoreToNumber(entry.score) + 1);
    if (pick <= cursor) {
      chosen = entry;
      break;
    }
  }
  return chosen ?? null;
};
