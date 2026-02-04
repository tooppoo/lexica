import type {
  AppState,
  DictionaryName,
  Entry,
  ExampleCount,
  Language,
  Meaning,
  Term,
} from "./types";
import { findEntry, overwriteExamples, replaceEntry } from "./entry";
import { succeed, type Result } from "./result";

export interface ExampleGenerator {
  (input: {
    dictionaryName: DictionaryName;
    language: Language;
    term: Term;
    meaning: Meaning;
    count: ExampleCount;
  }): Promise<Result<string[]>>;
}

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
  const currentEntry = findEntry(state.entries, term);
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
