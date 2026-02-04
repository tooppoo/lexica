import { Result as Byethrow } from "@praha/byethrow";
import {
  appendExample,
  createEntry,
  overwriteExamples,
  overwriteScore,
  parseExample,
  parseMeaning,
  parseMeanings,
  parseTerm,
} from "../core/entry";
import { decrementScore, incrementScore, scoreToNumber } from "../core/score";
import { parseDictionary, parseDictionaryName } from "../core/dictionary";
import type { Dictionary, DictionaryName, Entry, Language, Meaning, Term } from "../core/types";
import type { ExampleCount } from "../core/example-count";
import {
  deleteEntry,
  listEntries as listCoreEntries,
  replaceEntry as replaceCoreEntry,
  upsertEntry,
} from "../core/vocabulary";
import type { CoreError, Result as CoreResult } from "../core/result";

export type AppError = CoreError | { kind: "ai-failed"; reason: string };

export type Result<T> = Byethrow.Result<T, AppError>;

export interface AppState {
  dictionary: Dictionary;
  entries: Entry[];
}

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

const fromCore = <T>(result: CoreResult<T>): Result<T> => {
  if (Byethrow.isSuccess(result)) {
    return result;
  }
  return Byethrow.fail(result.error);
};

const succeed = <T>(value: T): Result<T> => ({ type: "Success", value });
const failNotFoundApp = (reason: string): Result<never> => ({
  type: "Failure",
  error: { kind: "not-found", reason },
});

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
  nameInput: string,
  languageInput: { source: string; target: string },
): Result<{ dictionary: Dictionary }> => {
  const parsed = fromCore(parseDictionary(nameInput, languageInput));
  if (Byethrow.isFailure(parsed)) {
    return parsed;
  }
  return succeed({ dictionary: parsed.value });
};

/**
 * Clears entries for the specified dictionary name.
 */
export const clearDictionary = (
  state: AppState,
  dictionaryNameInput: string,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  const dictionaryName = fromCore(parseDictionaryName(dictionaryNameInput));
  if (Byethrow.isFailure(dictionaryName)) {
    return dictionaryName;
  }
  if (state.dictionary.name !== dictionaryName.value) {
    return failNotFoundApp("Dictionary not found");
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
  termInput: string,
  meaningInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return addEntryMeanings(state, termInput, [meaningInput]);
};

/**
 * Adds a term with multiple meanings to the current dictionary.
 */
export const addEntryMeanings = (
  state: AppState,
  termInput: string,
  meaningsInput: string[],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meanings = fromCore(parseMeanings(meaningsInput));
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }

  let entries = state.entries;
  let entry: Entry | undefined;
  for (const meaning of meanings.value) {
    const updated = fromCore(upsertEntry(entries, term.value, meaning));
    if (Byethrow.isFailure(updated)) {
      return updated;
    }
    entries = updated.value.entries;
    entry = updated.value.entry;
  }

  return succeed({
    state: { ...state, entries },
    entry: entry ?? createEntry(term.value, meanings.value),
    dictionaryName: state.dictionary.name,
  });
};

/**
 * Adds a manual example to the entry in the current dictionary.
 */
export const addEntryExample = (
  state: AppState,
  termInput: string,
  exampleInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const example = fromCore(parseExample(exampleInput));
  if (Byethrow.isFailure(example)) {
    return example;
  }
  const currentEntry = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }
  const updatedEntry = appendExample(currentEntry.value, example.value);
  const replaced = fromCore(replaceCoreEntry(state.entries, updatedEntry));
  if (Byethrow.isFailure(replaced)) {
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
  termInput?: string,
): Result<{ dictionaryName: DictionaryName; entries: Entry[] | Entry }> => {
  if (termInput === undefined) {
    const entries = fromCore(listCoreEntries(state.entries));
    if (Byethrow.isFailure(entries)) {
      return entries;
    }
    return succeed({ dictionaryName: state.dictionary.name, entries: entries.value });
  }

  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const entries = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(entries)) {
    return entries;
  }
  return succeed({ dictionaryName: state.dictionary.name, entries: entries.value });
};

/**
 * Removes a term or a specific meaning from the current dictionary.
 */
export const removeEntry = (
  state: AppState,
  termInput: string,
  meaningInput?: string,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }

  if (meaningInput === undefined) {
    const deleted = fromCore(deleteEntry(state.entries, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, entries: deleted.value.entries },
      dictionaryName: state.dictionary.name,
    });
  }

  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const filtered = currentEntry.value.meanings.filter((item) => item !== meaning.value);
  if (filtered.length === currentEntry.value.meanings.length) {
    return failNotFoundApp("Meaning not found");
  }

  if (filtered.length === 0) {
    const deleted = fromCore(deleteEntry(state.entries, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, entries: deleted.value.entries },
      dictionaryName: state.dictionary.name,
    });
  }

  const replaced = fromCore(
    replaceCoreEntry(state.entries, {
      ...currentEntry.value,
      meanings: filtered,
    }),
  );
  if (Byethrow.isFailure(replaced)) {
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
  termInput: string,
  meaningsInput: string[],
  examples?: string[],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const currentEntry = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }
  const meanings = fromCore(parseMeanings(meaningsInput));
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }
  const entry = createEntry(term.value, meanings.value, examples, currentEntry.value.score);
  const replaced = fromCore(replaceCoreEntry(state.entries, entry));
  if (Byethrow.isFailure(replaced)) {
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
  termInput: string,
  meaningInput: string,
  generator: ExampleGenerator,
  count: ExampleCount,
): Promise<Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }>> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const generated = await generator({
    dictionaryName: state.dictionary.name,
    language: state.dictionary.language,
    term: term.value,
    meaning: meaning.value,
    count,
  });
  if (Byethrow.isFailure(generated)) {
    return generated;
  }

  const updatedEntry = overwriteExamples(currentEntry.value, generated.value);
  const replaced = fromCore(replaceCoreEntry(state.entries, updatedEntry));
  if (Byethrow.isFailure(replaced)) {
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
  const entries = fromCore(listCoreEntries(state.entries));
  if (Byethrow.isFailure(entries)) {
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
  termInput: string,
  nextScore: (score: Entry["score"]) => Entry["score"],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }

  const currentEntry = fromCore(listCoreEntries(state.entries, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const updatedEntry = overwriteScore(currentEntry.value, nextScore(currentEntry.value.score));
  const replaced = fromCore(replaceCoreEntry(state.entries, updatedEntry));
  if (Byethrow.isFailure(replaced)) {
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
  termInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return updateTestScore(state, termInput, incrementScore);
};

/**
 * Decrements the score for a term when not remembered.
 */
export const forgetEntry = (
  state: AppState,
  termInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return updateTestScore(state, termInput, decrementScore);
};
