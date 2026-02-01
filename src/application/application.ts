import { Result as Byethrow } from "@praha/byethrow";
import {
  createEntry,
  overwriteExamples,
  parseMeaning,
  parseMeanings,
  parseTerm,
} from "../core/entry";
import { parseDictionary, parseDictionaryKey, toDictionaryKey } from "../core/dictionary";
import type { DictionaryKey, Entry, Meaning, Term, VocabularyData } from "../core/types";
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
  dictionaryKey: DictionaryKey;
  vocabulary: VocabularyData;
}

export interface ExampleGenerator {
  (input: {
    dictionaryKey: DictionaryKey;
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
 * Creates an application state from a dictionary key and vocabulary data.
 */
export const createState = (
  dictionaryKey: DictionaryKey,
  vocabulary: VocabularyData,
): AppState => ({
  dictionaryKey,
  vocabulary,
});

/**
 * Switches the current dictionary using source/target input.
 */
export const switchDictionary = (
  state: AppState,
  source: string,
  target: string,
): Result<{ state: AppState; dictionaryKey: DictionaryKey }> => {
  const parsed = fromCore(parseDictionary(source, target));
  if (Byethrow.isFailure(parsed)) {
    return parsed;
  }
  const dictionaryKey = toDictionaryKey(parsed.value);
  return succeed({
    state: { ...state, dictionaryKey },
    dictionaryKey,
  });
};

/**
 * Clears entries for the specified dictionary key.
 */
export const clearDictionary = (
  state: AppState,
  dictionaryKeyInput: string,
): Result<{ state: AppState; dictionaryKey: DictionaryKey }> => {
  const dictionaryKey = fromCore(parseDictionaryKey(dictionaryKeyInput));
  if (Byethrow.isFailure(dictionaryKey)) {
    return dictionaryKey;
  }
  const vocabulary = { ...state.vocabulary, [dictionaryKey.value]: [] };
  return succeed({
    state: { ...state, vocabulary },
    dictionaryKey: dictionaryKey.value,
  });
};

/**
 * Adds a term with a meaning to the current dictionary.
 */
export const addEntry = (
  state: AppState,
  termInput: string,
  meaningInput: string,
): Result<{ state: AppState; entry: Entry; dictionaryKey: DictionaryKey }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }
  const updated = fromCore(
    upsertEntry(state.vocabulary, state.dictionaryKey, term.value, meaning.value),
  );
  if (Byethrow.isFailure(updated)) {
    return updated;
  }
  return succeed({
    state: { ...state, vocabulary: updated.value.vocabulary },
    entry: updated.value.entry,
    dictionaryKey: state.dictionaryKey,
  });
};

/**
 * Lists entries in the current dictionary, optionally for a single term.
 */
export const listEntries = (
  state: AppState,
  termInput?: string,
): Result<{ dictionaryKey: DictionaryKey; entries: Entry[] | Entry }> => {
  if (termInput === undefined) {
    const entries = fromCore(listCoreEntries(state.vocabulary, state.dictionaryKey));
    if (Byethrow.isFailure(entries)) {
      return entries;
    }
    return succeed({ dictionaryKey: state.dictionaryKey, entries: entries.value });
  }

  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const entries = fromCore(listCoreEntries(state.vocabulary, state.dictionaryKey, term.value));
  if (Byethrow.isFailure(entries)) {
    return entries;
  }
  return succeed({ dictionaryKey: state.dictionaryKey, entries: entries.value });
};

/**
 * Removes a term or a specific meaning from the current dictionary.
 */
export const removeEntry = (
  state: AppState,
  termInput: string,
  meaningInput?: string,
): Result<{ state: AppState; dictionaryKey: DictionaryKey }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }

  if (meaningInput === undefined) {
    const deleted = fromCore(deleteEntry(state.vocabulary, state.dictionaryKey, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, vocabulary: deleted.value.vocabulary },
      dictionaryKey: state.dictionaryKey,
    });
  }

  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(listCoreEntries(state.vocabulary, state.dictionaryKey, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const filtered = currentEntry.value.meanings.filter((item) => item !== meaning.value);
  if (filtered.length === currentEntry.value.meanings.length) {
    return failNotFound("Meaning not found");
  }

  if (filtered.length === 0) {
    const deleted = fromCore(deleteEntry(state.vocabulary, state.dictionaryKey, term.value));
    if (Byethrow.isFailure(deleted)) {
      return deleted;
    }
    return succeed({
      state: { ...state, vocabulary: deleted.value.vocabulary },
      dictionaryKey: state.dictionaryKey,
    });
  }

  const replaced = fromCore(
    replaceCoreEntry(state.vocabulary, state.dictionaryKey, {
      ...currentEntry.value,
      meanings: filtered,
    }),
  );
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    dictionaryKey: state.dictionaryKey,
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
): Result<{ state: AppState; entry: Entry; dictionaryKey: DictionaryKey }> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meanings = fromCore(parseMeanings(meaningsInput));
  if (Byethrow.isFailure(meanings)) {
    return meanings;
  }
  const entry = createEntry(term.value, meanings.value, examples);
  const replaced = fromCore(replaceCoreEntry(state.vocabulary, state.dictionaryKey, entry));
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    entry: replaced.value.entry,
    dictionaryKey: state.dictionaryKey,
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
): Promise<Result<{ state: AppState; entry: Entry; dictionaryKey: DictionaryKey }>> => {
  const term = fromCore(parseTerm(termInput));
  if (Byethrow.isFailure(term)) {
    return term;
  }
  const meaning = fromCore(parseMeaning(meaningInput));
  if (Byethrow.isFailure(meaning)) {
    return meaning;
  }

  const currentEntry = fromCore(listCoreEntries(state.vocabulary, state.dictionaryKey, term.value));
  if (Byethrow.isFailure(currentEntry)) {
    return currentEntry;
  }

  const generated = await generator({
    dictionaryKey: state.dictionaryKey,
    term: term.value,
    meaning: meaning.value,
  });
  if (Byethrow.isFailure(generated)) {
    return generated;
  }

  const updatedEntry = overwriteExamples(currentEntry.value, generated.value);
  const replaced = fromCore(replaceCoreEntry(state.vocabulary, state.dictionaryKey, updatedEntry));
  if (Byethrow.isFailure(replaced)) {
    return replaced;
  }
  return succeed({
    state: { ...state, vocabulary: replaced.value.vocabulary },
    entry: replaced.value.entry,
    dictionaryKey: state.dictionaryKey,
  });
};
