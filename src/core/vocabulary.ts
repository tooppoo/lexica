import type { Entry, Meaning, Term } from "./types";
import { createEntry } from "./entry";
import { failNotFound, succeed, type Result } from "./result";

const cloneEntries = (entries: Entry[]): Entry[] => entries.map((entry) => ({ ...entry }));

const findEntryIndex = (entries: Entry[], term: Term): number =>
  entries.findIndex((entry) => entry.term === term);

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
