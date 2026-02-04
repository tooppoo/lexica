import * as v from "valibot";
import type { AppState, DictionaryName, Entry, Meaning, Score, Term } from "./types";
import { failInvalidInput, failNotFound, succeed, type Result } from "./result";
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
 * Inserts or updates an entry by appending a meaning for the given term.
 */
export const upsertEntry = (
  entries: Entry[],
  term: Term,
  meaning: Meaning,
): Result<{ entries: Entry[]; entry: Entry }> => {
  const nextEntries = cloneEntries(entries);
  const index = findEntryIndex(nextEntries, term);

  if (index === -1) {
    const entry = createEntry(term, [meaning]);
    return succeed({
      entries: [...nextEntries, entry],
      entry,
    });
  }

  const existing = nextEntries[index];
  if (!existing) {
    return failNotFound("Entry not found");
  }
  const updated: Entry = {
    ...existing,
    meanings: [...existing.meanings, meaning],
  };
  nextEntries[index] = updated;

  return succeed({
    entries: nextEntries,
    entry: updated,
  });
};

/**
 * Lists all entries for a dictionary, or returns a single entry by term.
 */
export function findEntry(entries: Entry[], term: Term): Result<Entry> {
  const index = findEntryIndex(entries, term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }

  const entry = entries[index];
  if (!entry) {
    return failNotFound("Entry not found");
  }
  return succeed(entry);
}

/**
 * Replaces an existing entry with the provided entry.
 */
export const replaceEntry = (
  entries: Entry[],
  entry: Entry,
): Result<{ entries: Entry[]; entry: Entry }> => {
  const nextEntries = cloneEntries(entries);
  const index = findEntryIndex(nextEntries, entry.term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  nextEntries[index] = entry;
  return succeed({
    entries: nextEntries,
    entry,
  });
};

/**
 * Deletes an entry by term.
 */
export const deleteEntry = (entries: Entry[], term: Term): Result<{ entries: Entry[] }> => {
  const index = findEntryIndex(entries, term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  const nextEntries = entries.filter((entry) => entry.term !== term);
  return succeed({ entries: nextEntries });
};

/**
 * Adds a manual example to the entry in the current dictionary.
 */
export const addEntryExample = (
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
export const replaceEntryInAppState = (
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

const cloneEntries = (entries: Entry[]): Entry[] => entries.map((entry) => ({ ...entry }));

const findEntryIndex = (entries: Entry[], term: Term): number =>
  entries.findIndex((entry) => entry.term === term);
