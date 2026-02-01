import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { defaultScore } from "../core/score";
import type { Result as CoreResult } from "../core/result";
import { parseDictionaryName } from "../core/dictionary";
import { FileVocabularyStorage, MemoryVocabularyStorage, type Result } from "./storage";

const unwrap = <T>(result: Result<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.reason}`);
  }
  return result.value;
};

const unwrapCore = <T>(result: CoreResult<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.kind}`);
  }
  return result.value;
};

describe("memory storage", () => {
  test("saves and loads vocabulary data", async () => {
    const storage = new MemoryVocabularyStorage();
    const term = unwrapCore(parseTerm("object"));
    const meanings = unwrapCore(parseMeanings(["物"]));
    const data = {
      default: [createEntry(term, meanings, ["example"])],
    };
    unwrap(await storage.save("memory", data));
    const loaded = unwrap(await storage.load("memory"));
    expect(loaded).toEqual(data);
  });

  test("returns empty data for missing key", async () => {
    const storage = new MemoryVocabularyStorage();
    expect(unwrap(await storage.load("missing"))).toEqual({});
  });

  test("defaults missing score when loading from file", async () => {
    const storage = new FileVocabularyStorage();
    const path = `/tmp/lexica.storage.${Date.now()}.json`;
    await Bun.write(
      path,
      JSON.stringify({
        default: [
          {
            term: "object",
            meanings: ["物"],
          },
        ],
      }),
    );
    const loaded = unwrap(await storage.load(path));
    const dictionaryName = unwrapCore(parseDictionaryName("default"));
    const entry = loaded[dictionaryName]?.[0];
    expect(entry?.score).toBe(defaultScore());
  });
});
