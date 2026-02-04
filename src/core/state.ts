import {
  appendExample,
  createEntry,
  deleteEntry,
  findEntry,
  replaceEntry,
  upsertEntry,
} from "./entry";
import { failNotFound, succeed, type Result } from "./result";
import type { AppState, Dictionary, DictionaryName, Entry, Meaning, Term } from "./types";

/**
 * Creates an application state from a dictionary and entries.
 */
export const createState = (dictionary: Dictionary, entries: Entry[]): AppState => ({
  dictionary,
  entries,
});

/**
 * Adds a term with a meaning to the current dictionary.
 */
export const addEntryToState = (
  state: AppState,
  term: Term,
  meaning: Meaning,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  return addEntryMeaningsToState(state, term, [meaning]);
};

/**
 * Adds a term with multiple meanings to the current dictionary.
 */
export const addEntryMeaningsToState = (
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
export const addEntryExampleToState = (
  state: AppState,
  term: Term,
  example: string,
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = findEntry(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }
  const updatedEntry = appendExample(currentEntry.value, example);
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
 * Removes a term or a specific meaning from the current dictionary.
 */
export const removeEntryFromState = (
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

  const currentEntry = findEntry(state.entries, term);
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

  const replaced = replaceEntry(state.entries, {
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
export const replaceEntryInState = (
  state: AppState,
  term: Term,
  meanings: Meaning[],
  examples?: string[],
): Result<{ state: AppState; entry: Entry; dictionaryName: DictionaryName }> => {
  const currentEntry = findEntry(state.entries, term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }
  const entry = createEntry(term, meanings, examples, currentEntry.value.score);
  const replaced = replaceEntry(state.entries, entry);
  if (replaced.type === "Failure") {
    return replaced;
  }
  return succeed({
    state: { ...state, entries: replaced.value.entries },
    entry: replaced.value.entry,
    dictionaryName: state.dictionary.name,
  });
};
