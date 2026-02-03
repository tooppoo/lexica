import { Result as Byethrow } from "@praha/byethrow";
import * as v from "valibot";
import type { DictionaryName, Entry, Language, VocabularyData } from "../core/types";
import { parseDictionaryName, parseSourceLanguage, parseTargetLanguage } from "../core/dictionary";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { defaultScore, parseScore } from "../core/score";

export type StorageError = { kind: "file-io"; reason: string };

export type Result<T> = Byethrow.Result<T, StorageError>;
export type ResultAsync<T> = Promise<Result<T>>;

export interface VocabularyStorage {
  /** Loads vocabulary data from the given path. */
  load(path: string): ResultAsync<VocabularyStore>;
  /** Saves vocabulary data to the given path. */
  save(path: string, data: VocabularyStore): ResultAsync<void>;
}

const succeed = <T>(value: T): Result<T> => ({ type: "Success", value });
const fail = (reason: string): Result<never> => ({
  type: "Failure",
  error: { kind: "file-io", reason },
});

const entrySchema = v.object({
  term: v.pipe(v.string(), v.trim(), v.minLength(1)),
  meanings: v.pipe(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), v.minLength(1)),
  examples: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1)))),
  score: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

const languageSchema = v.object({
  source: v.pipe(v.string(), v.trim(), v.minLength(1)),
  target: v.pipe(v.string(), v.trim(), v.minLength(1)),
});
const dictionarySchema = v.object({
  language: languageSchema,
  entries: v.array(entrySchema),
});
const dictionaryCatalogSchema = v.record(v.string(), dictionarySchema);
const storeSchema = v.object({
  dictionaries: dictionaryCatalogSchema,
});

export interface VocabularyStore {
  dictionaries: Partial<Record<DictionaryName, StoredDictionary>>;
}

export interface StoredDictionary {
  language: Language;
  entries: Entry[];
}

type RawEntry = {
  term: string;
  meanings: string[];
  examples?: string[];
  score?: number;
};

const parseVocabularyEntries = (input: Record<string, RawEntry[]>): Result<VocabularyData> => {
  const normalized: VocabularyData = {};
  for (const [dictionaryName, entries] of Object.entries(input)) {
    const nextEntries: Entry[] = [];
    for (const entry of entries) {
      const term = parseTerm(entry.term);
      if (Byethrow.isFailure(term)) {
        return fail("Invalid vocabulary term format");
      }
      const meanings = parseMeanings(entry.meanings);
      if (Byethrow.isFailure(meanings)) {
        return fail("Invalid vocabulary meanings format");
      }
      const score = parseScore(entry.score ?? defaultScore());
      if (Byethrow.isFailure(score)) {
        return fail("Invalid vocabulary score format");
      }
      nextEntries.push(createEntry(term.value, meanings.value, entry.examples, score.value));
    }
    normalized[dictionaryName as keyof VocabularyData] = nextEntries;
  }
  return succeed(normalized);
};

const parseDictionaryCatalog = (
  input: Record<string, { language: { source: string; target: string }; entries: RawEntry[] }>,
): Result<VocabularyStore> => {
  const dictionaries: Partial<Record<DictionaryName, StoredDictionary>> = {};
  for (const [dictionaryName, dictionary] of Object.entries(input)) {
    const name = parseDictionaryName(dictionaryName);
    if (Byethrow.isFailure(name)) {
      return fail("Invalid dictionary name");
    }
    const source = parseSourceLanguage(dictionary.language.source);
    if (Byethrow.isFailure(source)) {
      return fail("Invalid source language");
    }
    const target = parseTargetLanguage(dictionary.language.target);
    if (Byethrow.isFailure(target)) {
      return fail("Invalid target language");
    }
    const entries = parseVocabularyEntries({ [dictionaryName]: dictionary.entries });
    if (Byethrow.isFailure(entries)) {
      return entries;
    }
    dictionaries[name.value] = {
      language: { source: source.value, target: target.value },
      entries: entries.value[name.value] ?? [],
    };
  }
  return succeed({ dictionaries });
};

const parseVocabularyStore = (input: unknown): Result<VocabularyStore> => {
  const parsedStore = v.safeParse(storeSchema, input);
  if (parsedStore.success) {
    const dictionaries = parseDictionaryCatalog(parsedStore.output.dictionaries);
    if (Byethrow.isFailure(dictionaries)) {
      return dictionaries;
    }
    return succeed(dictionaries.value);
  }

  return fail("Invalid vocabulary data format");
};

/**
 * File-backed storage implementation using Bun.file and JSON.
 */
export class FileVocabularyStorage implements VocabularyStorage {
  /** Loads vocabulary data from the given JSON file path. */
  async load(path: string): Promise<Result<VocabularyStore>> {
    try {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        return succeed({ dictionaries: {} });
      }
      const content = JSON.parse(await file.text());
      return parseVocabularyStore(content);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to read file");
    }
  }

  /** Saves vocabulary data to the given JSON file path. */
  async save(path: string, data: VocabularyStore): Promise<Result<void>> {
    try {
      const dictionariesWithEntries = Object.fromEntries(
        Object.entries(data.dictionaries).map(([name, dictionary]) => [
          name,
          dictionary
            ? {
                language: dictionary.language,
                entries: dictionary.entries ?? [],
              }
            : dictionary,
        ]),
      );
      const json = JSON.stringify({ dictionaries: dictionariesWithEntries }, null, 2);
      await Bun.write(path, json);
      return succeed(undefined);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to write file");
    }
  }
}

/**
 * In-memory storage implementation for tests.
 */
export class MemoryVocabularyStorage implements VocabularyStorage {
  #store = new Map<string, VocabularyStore>();

  /** Loads vocabulary data for the given key. */
  async load(path: string): Promise<Result<VocabularyStore>> {
    return succeed(this.#store.get(path) ?? { dictionaries: {} });
  }

  /** Saves vocabulary data for the given key. */
  async save(path: string, data: VocabularyStore): Promise<Result<void>> {
    this.#store.set(path, data);
    return succeed(undefined);
  }
}
