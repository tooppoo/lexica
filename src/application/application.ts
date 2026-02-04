import { Result as Byethrow } from "@praha/byethrow";
import {
  addEntryExample as addCoreEntryExample,
  addEntryMeanings as addCoreEntryMeanings,
  clearDictionary as clearCoreDictionary,
  createDictionary as createCoreDictionary,
  createState as createCoreState,
  forgetEntry as forgetCoreEntry,
  generateExamples as generateCoreExamples,
  rememberEntry as rememberCoreEntry,
  removeEntry as removeCoreEntry,
  replaceEntry as replaceCoreEntry,
  selectExampleTestEntry as selectCoreExampleTestEntry,
  selectMeaningTestEntry as selectCoreMeaningTestEntry,
  type ExampleGenerator,
  type TestSelection,
} from "../core/commands";
import { parseDictionary, parseDictionaryName } from "../core/dictionary";
import { parseExample, parseMeaning, parseMeanings, parseTerm } from "../core/entry";
import type {
  AppState,
  Dictionary,
  DictionaryName,
  Entry,
  ExampleCount,
  Term,
} from "../core/types";
import { succeed, type Result } from "../core/result";
import { findEntry } from "../core/vocabulary";

export type { ExampleGenerator, TestSelection, AppState };

/**
 * Creates an application state from a dictionary and entries.
 */
export const createState = createCoreState;

/**
 * Registers a new dictionary with a language (source/target).
 */
export const createDictionary = (
  nameInput: string,
  languageInput: { source: string; target: string },
): Result<{ dictionary: Dictionary }> => {
  const parsed = parseDictionary(nameInput, languageInput);
  if (Byethrow.isFailure(parsed)) {
    return parsed;
  }
  return createCoreDictionary(parsed.value.name, parsed.value.language);
};

/**
 * Clears entries for the specified dictionary name.
 */
export const clearDictionary = (
  state: AppState,
  dictionaryNameInput: string,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  const dictionaryName = parseDictionaryName(dictionaryNameInput);
  if (Byethrow.isFailure(dictionaryName)) {
    return dictionaryName;
  }
  return clearCoreDictionary(state, dictionaryName.value);
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
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meanings = parseMeanings(meaningsInput);
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }

  return addCoreEntryMeanings(state, term.value, meanings.value);
};

/**
 * Adds a manual example to the entry in the current dictionary.
 */
export const addEntryExample = (
  state: AppState,
  termInput: string,
  exampleInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const example = parseExample(exampleInput);
  if (Byethrow.isFailure(example)) {
    return example;
  }
  return addCoreEntryExample(state, term.value, example.value);
};

/**
 * Lists entries in the current dictionary.
 */
export const listEntries = (
  state: AppState,
): Result<{ dictionaryName: DictionaryName; entries: Entry[] }> => {
  return succeed({
    dictionaryName: state.dictionary.name,
    entries: state.entries,
  });
};

/**
 * Lists a single entry in the current dictionary by term.
 */
export const listEntry = (
  state: AppState,
  termInput: string,
): Result<{ dictionaryName: DictionaryName; entry: Entry }> => {
  return Byethrow.pipe(
    parseTerm(termInput),
    Byethrow.andThen((term) => findEntry(state.entries, term)),
    Byethrow.map((entry) => ({
      dictionaryName: state.dictionary.name,
      entry,
    })),
  );
};

/**
 * Removes a term or a specific meaning from the current dictionary.
 */
export const removeEntry = (
  state: AppState,
  termInput: string,
  meaningInput?: string,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }

  if (meaningInput === undefined) {
    return removeCoreEntry(state, term.value);
  }

  const meaning = parseMeaning(meaningInput);
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  return removeCoreEntry(state, term.value, meaning.value);
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
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meanings = parseMeanings(meaningsInput);
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }
  return replaceCoreEntry(state, term.value, meanings.value, examples);
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
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = parseMeaning(meaningInput);
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }
  return generateCoreExamples(state, term.value, meaning.value, generator, count);
};

/**
 * Selects the next meaning test entry based on score weighting.
 */
export const selectMeaningTestEntry = (
  state: AppState,
  usedTerms: Set<Term>,
  rng?: () => number,
): Result<TestSelection | null> => {
  return selectCoreMeaningTestEntry(state, usedTerms, rng);
};

/**
 * Selects the next example test entry based on score weighting.
 */
export const selectExampleTestEntry = (
  state: AppState,
  usedExamples: Set<string>,
  rng?: () => number,
): Result<TestSelection | null> => {
  return selectCoreExampleTestEntry(state, usedExamples, rng);
};

/**
 * Increments the score for a term when remembered.
 */
export const rememberEntry = (
  state: AppState,
  termInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  return rememberCoreEntry(state, term.value);
};

/**
 * Decrements the score for a term when not remembered.
 */
export const forgetEntry = (
  state: AppState,
  termInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const term = parseTerm(termInput);
  if (Byethrow.isFailure(term)) {
    return term;
  }
  return forgetCoreEntry(state, term.value);
};
