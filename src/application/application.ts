import { Result as Byethrow } from "@praha/byethrow";
import {
  createEntry,
  overwriteExamples,
  parseMeaning,
  parseMeanings,
  parseTerm,
} from "../core/entry";
import { parseDictionary, parseDictionaryName, toDictionaryName } from "../core/dictionary";
import type { DictionaryName, Entry, Meaning, Term, VocabularyData } from "../core/types";
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
  dictionaryName: DictionaryName;
  vocabulary: VocabularyData;
}

export interface ExampleGenerator {
  (input: {
    dictionaryName: DictionaryName;
    term: Term;
    meaning: Meaning;
  }): Promise<Result<string[]>>;
}

const fromCore = <T>(result: CoreResult<T>): Result<T> => {
  if (Byethrow.isSuccess(result)) {
    return result;
  }
  return Byethrow.fail(result.error);
};

const succeed = <T>(value: T): Result<T> => ({ type: "Success", value });
const failNotFound = (reason: string): Result<never> => ({
  type: "Failure",
  error: { kind: "not-found", reason },
});

/**
 * Creates an application state from a dictionary name and vocabulary data.
 */
export const createState = (
  dictionaryName: DictionaryName,
  vocabulary: VocabularyData,
): AppState => ({
  dictionaryName,
  vocabulary,
});

/**
 * Switches the current dictionary using a dictionary name.
 */
export const switchDictionary = (
  state: AppState,
  name: string,
): Result<{ state: AppState; dictionaryName: DictionaryName }> => {
  const parsed = fromCore(parseDictionary(name));
  if (Byethrow.isFailure(parsed)) {
    return parsed;
  }
  const dictionaryName = toDictionaryName(parsed.value);
  return succeed({
    state: { ...state, dictionaryName },
    dictionaryName,
  });
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
  const vocabulary = { ...state.vocabulary, [dictionaryName.value]: [] };
  return succeed({
    state: { ...state, vocabulary },
    dictionaryName: dictionaryName.value,
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
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }
  const updated = fromCore(
    upsertEntry(state.vocabulary, state.dictionaryName, term.value, meaning.value),
  );
  if (Byethrow.isFailure(updated)) {
    return updated;
  }
  return succeed({
    state: { ...state, vocabulary: updated.value.vocabulary },
    entry: updated.value.entry,
    dictionaryName: state.dictionaryName,
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
    const entries = fromCore(listCoreEntries(state.vocabulary, state.dictionaryName));
    if (Byethrow.isFailure(entries)) {
      return entries;
    }
    return succeed({ dictionaryName: state.dictionaryName, entries: entries.value });
  }

  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const entries = fromCore(listCoreEntries(state.vocabulary, state.dictionaryName, term.value));
  if (Byethrow.isFailure(entries)) {
    return entries;
  }
  return succeed({ dictionaryName: state.dictionaryName, entries: entries.value });
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
    const deleted = fromCore(deleteEntry(state.vocabulary, state.dictionaryName, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, vocabulary: deleted.value.vocabulary },
      dictionaryName: state.dictionaryName,
    });
  }

  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(
    listCoreEntries(state.vocabulary, state.dictionaryName, term.value),
  );
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const filtered = currentEntry.value.meanings.filter((item) => item !== meaning.value);
  if (filtered.length === currentEntry.value.meanings.length) {
    return failNotFound("Meaning not found");
  }

  if (filtered.length === 0) {
    const deleted = fromCore(deleteEntry(state.vocabulary, state.dictionaryName, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, vocabulary: deleted.value.vocabulary },
      dictionaryName: state.dictionaryName,
    });
  }

  const replaced = fromCore(
    replaceCoreEntry(state.vocabulary, state.dictionaryName, {
      ...currentEntry.value,
      meanings: filtered,
    }),
  );
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    dictionaryName: state.dictionaryName,
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
  const meanings = fromCore(parseMeanings(meaningsInput));
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }
  const entry = createEntry(term.value, meanings.value, examples);
  const replaced = fromCore(replaceCoreEntry(state.vocabulary, state.dictionaryName, entry));
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    entry: replaced.value.entry,
    dictionaryName: state.dictionaryName,
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
): Promise<Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }>> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(
    listCoreEntries(state.vocabulary, state.dictionaryName, term.value),
  );
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const generated = await generator({
    dictionaryName: state.dictionaryName,
    term: term.value,
    meaning: meaning.value,
  });
  if (Byethrow.isFailure(generated)) {
    return generated;
  }

  const updatedEntry = overwriteExamples(currentEntry.value, generated.value);
  const replaced = fromCore(
    replaceCoreEntry(state.vocabulary, state.dictionaryName, updatedEntry),
  );
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    entry: replaced.value.entry,
    dictionaryName: state.dictionaryName,
  });
};
