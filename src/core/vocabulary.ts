import type { DictionaryKey, Entry, Meaning, Term, VocabularyData } from "./types";
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
  dictionaryKey: DictionaryKey,
  term: Term,
  meaning: Meaning
): Result<{ vocabulary: VocabularyData; entry: Entry }> => {
  const currentEntries = vocabulary[dictionaryKey] ?? [];
  const entries = cloneEntries(currentEntries);
  const index = findEntryIndex(entries, term);

  if (index === -1) {
    const entry = createEntry(term, [meaning]);
    const nextEntries = [...entries, entry];
    return succeed({
      vocabulary: { ...vocabulary, [dictionaryKey]: nextEntries },
      entry,
    });
  }

  const existing = entries[index];
  const updated: Entry = {
    ...existing,
    meanings: [...existing.meanings, meaning],
  };
  entries[index] = updated;

  return succeed({
    vocabulary: { ...vocabulary, [dictionaryKey]: entries },
    entry: updated,
  });
};

/**
 * Lists all entries for a dictionary, or returns a single entry by term.
 */
export const listEntries = (
  vocabulary: VocabularyData,
  dictionaryKey: DictionaryKey,
  term?: Term
): Result<Entry[] | Entry> => {
  const entries = vocabulary[dictionaryKey] ?? [];
  if (term === undefined) {
    return succeed(entries);
  }

  const index = findEntryIndex(entries, term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }

  return succeed(entries[index]);
};

/**
 * Replaces an existing entry with the provided entry.
 */
export const replaceEntry = (
  vocabulary: VocabularyData,
  dictionaryKey: DictionaryKey,
  entry: Entry
): Result<{ vocabulary: VocabularyData; entry: Entry }> => {
  const entries = vocabulary[dictionaryKey] ?? [];
  const nextEntries = cloneEntries(entries);
  const index = findEntryIndex(nextEntries, entry.term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  nextEntries[index] = entry;
  return succeed({
    vocabulary: { ...vocabulary, [dictionaryKey]: nextEntries },
    entry,
  });
};

/**
 * Deletes an entry by term.
 */
export const deleteEntry = (
  vocabulary: VocabularyData,
  dictionaryKey: DictionaryKey,
  term: Term
): Result<{ vocabulary: VocabularyData }> => {
  const entries = vocabulary[dictionaryKey] ?? [];
  const index = findEntryIndex(entries, term);
  if (index === -1) {
    return failNotFound("Entry not found");
  }
  const nextEntries = entries.filter((entry) => entry.term !== term);
  const nextVocabulary = { ...vocabulary, [dictionaryKey]: nextEntries };
  return succeed({ vocabulary: nextVocabulary });
};
