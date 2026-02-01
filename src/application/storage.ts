import { Result as Byethrow } from "@praha/byethrow";
import * as v from "valibot";
import type { Entry, VocabularyData } from "../core/types";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { defaultScore, parseScore } from "../core/score";

export type StorageError = { kind: "file-io"; reason: string };

export type Result<T> = Byethrow.Result<T, StorageError>;
export type ResultAsync<T> = Promise<Result<T>>;

export interface VocabularyStorage {
  /** Loads vocabulary data from the given path. */
  load(path: string): ResultAsync<VocabularyData>;
  /** Saves vocabulary data to the given path. */
  save(path: string, data: VocabularyData): ResultAsync<void>;
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

const vocabularySchema = v.record(v.string(), v.array(entrySchema));

const parseVocabularyData = (input: unknown): Result<VocabularyData> => {
  const parsed = v.safeParse(vocabularySchema, input);
  if (!parsed.success) {
    return fail("Invalid vocabulary data format");
  }
  const normalized: VocabularyData = {};
  for (const [dictionaryName, entries] of Object.entries(parsed.output)) {
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

/**
 * File-backed storage implementation using Bun.file and JSON.
 */
export class FileVocabularyStorage implements VocabularyStorage {
  /** Loads vocabulary data from the given JSON file path. */
  async load(path: string): Promise<Result<VocabularyData>> {
    try {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        return succeed({});
      }
      const content = JSON.parse(await file.text());
      return parseVocabularyData(content);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to read file");
    }
  }

  /** Saves vocabulary data to the given JSON file path. */
  async save(path: string, data: VocabularyData): Promise<Result<void>> {
    try {
      const json = JSON.stringify(data, null, 2);
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
  #store = new Map<string, VocabularyData>();

  /** Loads vocabulary data for the given key. */
  async load(path: string): Promise<Result<VocabularyData>> {
    return succeed(this.#store.get(path) ?? {});
  }

  /** Saves vocabulary data for the given key. */
  async save(path: string, data: VocabularyData): Promise<Result<void>> {
    this.#store.set(path, data);
    return succeed(undefined);
  }
}
