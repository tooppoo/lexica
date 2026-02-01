import type { DictionaryName, Entry, Meaning, Term, VocabularyData } from "./types";
import { createEntry } from "./entry";
import { failNotFound, succeed, type Result } from "./result";

const cloneEntries = (entries: Entry[]): Entry[] => entries.map((entry) => ({ ...entry }));

const findEntryIndex = (entries: Entry[], term: Term): number =>
  entries.findIndex((entry) => entry.term === term);

/**
 * Inserts or updates an entry by appending a meaning for the given term.
 */
export const upsertEntry = (
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
  term: Term,
  meaning: Meaning,
): Result<{ vocabulary: VocabularyData; entry: Entry }> => {
  const currentEntries = vocabulary[dictionaryName] ?? [];
  const entries = cloneEntries(currentEntries);
  const index = findEntryIndex(entries, term);

  if (index === -1) {
    const entry = createEntry(term, [meaning]);
    const nextEntries = [...entries, entry];
    return succeed({
      vocabulary: { ...vocabulary, [dictionaryName]: nextEntries },
      entry,
    });
  }

  const existing = entries[index];
  if (!existing) {
    return failNotFound("Entry not found");
  }
  const updated: Entry = {
    ...existing,
    meanings: [...existing.meanings, meaning],
  };
  entries[index] = updated;

  return succeed({
    vocabulary: { ...vocabulary, [dictionaryName]: entries },
    entry: updated,
  });
};

/**
 * Lists all entries for a dictionary, or returns a single entry by term.
 */
export function listEntries(
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
): Result<Entry[]>;
export function listEntries(
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
  term: Term,
): Result<Entry>;
export function listEntries(
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
  term?: Term,
): Result<Entry[] | Entry> {
  const entries = vocabulary[dictionaryName] ?? [];
  if (term === undefined) {
    return succeed(entries);
  }

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
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
  entry: Entry,
): Result<{ vocabulary: VocabularyData; entry: Entry }> => {
  const entries = vocabulary[dictionaryName] ?? [];
  const nextEntries = cloneEntries(entries);
  const index = findEntryIndex(nextEntries, entry.term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  nextEntries[index] = entry;
  return succeed({
    vocabulary: { ...vocabulary, [dictionaryName]: nextEntries },
    entry,
  });
};

/**
 * Deletes an entry by term.
 */
export const deleteEntry = (
  vocabulary: VocabularyData,
  dictionaryName: DictionaryName,
  term: Term,
): Result<{ vocabulary: VocabularyData }> => {
  const entries = vocabulary[dictionaryName] ?? [];
  const index = findEntryIndex(entries, term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  const nextEntries = entries.filter((entry) => entry.term !== term);
  const nextVocabulary = { ...vocabulary, [dictionaryName]: nextEntries };
  return succeed({ vocabulary: nextVocabulary });
};
