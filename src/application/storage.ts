import { Result as Byethrow } from "@praha/byethrow";
import * as v from "valibot";
import type { Dictionary, DictionaryName, Entry } from "../core/types";
import { parseDictionary, parseDictionaryName } from "../core/dictionary";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { defaultScore, parseScore } from "../core/score";
import { failFileIO, succeed, type Result, type ResultAsync } from "../core/result";

export interface VocabularyStorage {
  /** Loads dictionary data from the given path. */
  load(path: string, dictionaryName: DictionaryName): ResultAsync<DictionaryStore>;
  /** Saves dictionary data to the given path. */
  save(path: string, data: DictionaryStore): ResultAsync<void>;
}

const entrySchema = v.object({
  term: v.pipe(v.string(), v.trim(), v.minLength(1)),
  meanings: v.pipe(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), v.minLength(1)),
  examples: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1)))),
  score: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

const dictionarySchema = v.object({
  language: v.object({
    source: v.pipe(v.string(), v.trim(), v.minLength(1)),
    target: v.pipe(v.string(), v.trim(), v.minLength(1)),
  }),
  entries: v.array(entrySchema),
});

export interface DictionaryStore {
  dictionary: Dictionary;
  entries: Entry[];
}

type RawEntry = {
  term: string;
  meanings: string[];
  examples?: string[];
  score?: number;
};

/**
 * File-backed storage implementation using Bun.file and JSON.
 */
export class FileVocabularyStorage implements VocabularyStorage {
  /** Loads vocabulary data from the given directory path. */
  async load(path: string, dictionaryName: DictionaryName): Promise<Result<DictionaryStore>> {
    try {
      const file = Bun.file(`${path}/${dictionaryName}.json`);
      if (!(await file.exists())) {
        return failFileIO("Dictionary not found");
      }
      const parsedName = parseDictionaryName(dictionaryName);
      if (Byethrow.isFailure(parsedName)) {
        return failFileIO("Invalid dictionary name");
      }
      const content = JSON.parse(await file.text());
      return this.parseDictionaryFile(parsedName.value, content);
    } catch (error) {
      return failFileIO(error instanceof Error ? error.message : "Failed to read file");
    }
  }

  /** Saves vocabulary data to the given directory path. */
  async save(path: string, data: DictionaryStore): Promise<Result<void>> {
    try {
      await Bun.$`mkdir -p ${path}`;
      const json = JSON.stringify(
        {
          language: data.dictionary.language,
          entries: data.entries ?? [],
        },
        null,
        2,
      );
      await Bun.write(`${path}/${data.dictionary.name}.json`, json);
      return succeed(undefined);
    } catch (error) {
      return failFileIO(error instanceof Error ? error.message : "Failed to write file");
    }
  }
  private parseEntries(entries: RawEntry[]): Result<Entry[]> {
    const nextEntries: Entry[] = [];
    for (const entry of entries) {
      const term = parseTerm(entry.term);
      if (Byethrow.isFailure(term)) {
        return failFileIO("Invalid vocabulary term format");
      }
      const meanings = parseMeanings(entry.meanings);
      if (Byethrow.isFailure(meanings)) {
        return failFileIO("Invalid vocabulary meanings format");
      }
      const score = parseScore(entry.score ?? defaultScore());
      if (Byethrow.isFailure(score)) {
        return failFileIO("Invalid vocabulary score format");
      }
      nextEntries.push(createEntry(term.value, meanings.value, entry.examples, score.value));
    }
    return succeed(nextEntries);
  }

  private parseDictionaryFile(
    dictionaryName: DictionaryName,
    input: unknown,
  ): Result<DictionaryStore> {
    const parsed = v.safeParse(dictionarySchema, input);
    if (!parsed.success) {
      return failFileIO("Invalid vocabulary data format");
    }
    const parsedDictionary = parseDictionary(dictionaryName, parsed.output.language);
    if (Byethrow.isFailure(parsedDictionary)) {
      return failFileIO("Invalid dictionary");
    }
    const entries = this.parseEntries(parsed.output.entries);
    if (Byethrow.isFailure(entries)) {
      return entries;
    }
    return succeed({
      dictionary: parsedDictionary.value,
      entries: entries.value,
    });
  }
}

/**
 * In-memory storage implementation for tests.
 */
export class MemoryVocabularyStorage implements VocabularyStorage {
  #store = new Map<string, DictionaryStore>();

  /** Loads vocabulary data for the given key. */
  async load(path: string, dictionaryName: DictionaryName): Promise<Result<DictionaryStore>> {
    const key = `${path}/${dictionaryName}`;
    const store = this.#store.get(key);
    if (!store) {
      return failFileIO("Dictionary not found");
    }
    return succeed(store);
  }

  /** Saves vocabulary data for the given key. */
  async save(path: string, data: DictionaryStore): Promise<Result<void>> {
    const key = `${path}/${data.dictionary.name}`;
    this.#store.set(key, data);
    return succeed(undefined);
  }
}
