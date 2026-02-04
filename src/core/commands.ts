import type {
  AppState,
  Dictionary,
  DictionaryName,
  Entry,
  ExampleCount,
  Language,
  Meaning,
  Score,
  Term,
} from "./types";
import { appendExample, createEntry, overwriteExamples, overwriteScore } from "./entry";
import { decrementScore, incrementScore, scoreToNumber } from "./score";
import {
  deleteEntry,
  listEntries as listCoreEntries,
  replaceEntry as replaceCoreEntry,
  upsertEntry,
} from "./vocabulary";
import { failNotFound, succeed, type Result } from "./result";

export interface ExampleGenerator {
  (input: {
    dictionaryName: DictionaryName;
    language: Language;
    term: Term;
    meaning: Meaning;
    count: ExampleCount;
  }): Promise<Result<string[]>>;
}

export interface TestSelection {
  entry: Entry;
  example?: string;
}

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

/**
 * Creates an application state from a dictionary and entries.
 */
export const createState = (dictionary: Dictionary, entries: Entry[]): AppState => ({
  dictionary,
  entries,
});

/**
 * Registers a new dictionary with a language (source/target).
 */
export const createDictionary = (
  name: DictionaryName,
  language: Language,
): Result<{ dictionary: Dictionary }> => {
  return succeed({ dictionary: { name, language } });
};

/**
 * Clears entries for the specified dictionary name.
 */
export const clearDictionary = (
  state: AppState,
  dictionaryName: DictionaryName,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  if (state.dictionary.name !== dictionaryName) {
    return failNotFound("Dictionary not found");
  }
  return succeed({
    state: { ...state, entries: [] },
    dictionaryName: state.dictionary.name,
  });
};

/**
 * Adds a term with a meaning to the current dictionary.
 */
export const addEntry = (
  state: AppState,
  term: Term,
  meaning: Meaning,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return addEntryMeanings(state, term, [meaning]);
};

/**
 * Adds a term with multiple meanings to the current dictionary.
 */
export const addEntryMeanings = (
  state: AppState,
  term: Term,
  meanings: Meaning[],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  let entries = state.entries;
  let entry: Entry | undefined;
  for (const meaning of meanings) {
    const updated = upsertEntry(entries, term, meaning);
    if (updated.type === "Failure") {
      return updated;
    }
    entries = updated.value.entries;
    entry = updated.value.entry;
  }

  return succeed({
    state: { ...state, entries },
    entry: entry ?? createEntry(term, meanings),
    dictionaryName: state.dictionary.name,
  });
};

/**
 * Adds a manual example to the entry in the current dictionary.
 */
export const addEntryExample = (
  state: AppState,
  term: Term,
  example: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = listCoreEntries(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }
  const updatedEntry = appendExample(currentEntry.value, example);
  const replaced = replaceCoreEntry(state.entries, updatedEntry);
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
 * Lists entries in the current dictionary, optionally for a single term.
 */
export const listEntries = (
  state: AppState,
  term?: Term,
): Result<{ dictionaryName: DictionaryName; entries: Entry[] | Entry }> => {
  if (term === undefined) {
    const entries = listCoreEntries(state.entries);
    if (entries.type === "Failure") {
      return entries;
    }
    return succeed({ dictionaryName: state.dictionary.name, entries: entries.value });
  }

  const entries = listCoreEntries(state.entries, term);
  if (entries.type === "Failure") {
    return entries;
  }
  return succeed({ dictionaryName: state.dictionary.name, entries: entries.value });
};

/**
 * Removes a term or a specific meaning from the current dictionary.
 */
export const removeEntry = (
  state: AppState,
  term: Term,
  meaning?: Meaning,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  if (meaning === undefined) {
    const deleted = deleteEntry(state.entries, term);
    if (deleted.type === "Failure") {
      return deleted;
    }
    return succeed({
      state: { ...state, entries: deleted.value.entries },
      dictionaryName: state.dictionary.name,
    });
  }

  const currentEntry = listCoreEntries(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }

  const filtered = currentEntry.value.meanings.filter((item) => item !== meaning);
  if (filtered.length === currentEntry.value.meanings.length) {
    return failNotFound("Meaning not found");
  }

  if (filtered.length === 0) {
    const deleted = deleteEntry(state.entries, term);
    if (deleted.type === "Failure") {
      return deleted;
    }
    return succeed({
      state: { ...state, entries: deleted.value.entries },
      dictionaryName: state.dictionary.name,
    });
  }

  const replaced = replaceCoreEntry(state.entries, {
    ...currentEntry.value,
    meanings: filtered,
  });
  if (replaced.type === "Failure") {
    return replaced;
  }
  return succeed({
    state: { ...state, entries: replaced.value.entries },
    dictionaryName: state.dictionary.name,
  });
};

/**
 * Replaces an entry in the current dictionary with new meanings.
 */
export const replaceEntry = (
  state: AppState,
  term: Term,
  meanings: Meaning[],
  examples?: string[],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = listCoreEntries(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }
  const entry = createEntry(term, meanings, examples, currentEntry.value.score);
  const replaced = replaceCoreEntry(state.entries, entry);
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
 * Generates examples using a provided generator and overwrites the entry examples.
 */
export const generateExamples = async (
  state: AppState,
  term: Term,
  meaning: Meaning,
  generator: ExampleGenerator,
  count: ExampleCount,
): Promise<Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }>> => {
  const currentEntry = listCoreEntries(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }

  const generated = await generator({
    dictionaryName: state.dictionary.name,
    language: state.dictionary.language,
    term,
    meaning,
    count,
  });
  if (generated.type === "Failure") {
    return generated;
  }

  const updatedEntry = overwriteExamples(currentEntry.value, generated.value);
  const replaced = replaceCoreEntry(state.entries, updatedEntry);
  if (replaced.type === "Failure") {
    return replaced;
  }
  return succeed({
    state: { ...state, entries: replaced.value.entries },
    entry: replaced.value.entry,
    dictionaryName: state.dictionary.name,
  });
};

const selectTestEntry = (
  state: AppState,
  strategy: TestSelectionStrategy,
  rng: () => number,
): Result<TestSelection | null> => {
  const entries = listCoreEntries(state.entries);
  if (entries.type === "Failure") {
    return entries;
  }

  const eligible = entries.value.filter((entry) => strategy.isEligible(entry));
  const chosen = chooseWeightedEntry(eligible, rng);
  if (!chosen) {
    return succeed(null);
  }
  return succeed(strategy.createSelection(chosen));
};

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

const updateTestScore = (
  state: AppState,
  term: Term,
  nextScore: (score: Score) => Score,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = listCoreEntries(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }

  const updatedEntry = overwriteScore(currentEntry.value, nextScore(currentEntry.value.score));
  const replaced = replaceCoreEntry(state.entries, updatedEntry);
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
