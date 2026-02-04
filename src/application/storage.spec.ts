import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { defaultScore } from "../core/score";
import type { Result as CoreResult, Result } from "../core/result";
import { parseDictionary } from "../core/dictionary";
import { FileVocabularyStorage, MemoryVocabularyStorage } from "./storage";

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
    const dictionary = unwrapCore(
      parseDictionary("default", { source: "english", target: "japanese" }),
    );
    const data = {
      dictionary,
      entries: [createEntry(term, meanings, ["example"])],
    };
    unwrap(await storage.save("memory", data));
    const loaded = unwrap(await storage.load("memory", dictionary.name));
    expect(loaded).toEqual(data);
  });

  test("returns empty data for missing key", async () => {
    const storage = new MemoryVocabularyStorage();
    const dictionary = unwrapCore(
      parseDictionary("default", { source: "english", target: "japanese" }),
    );
    const result = await storage.load("missing", dictionary.name);
    expect(Byethrow.isFailure(result)).toBe(true);
  });

  test("defaults missing score when loading from file", async () => {
    const storage = new FileVocabularyStorage();
    const dictionary = unwrapCore(
      parseDictionary("default", { source: "english", target: "japanese" }),
    );
    const directory = `/tmp/lexica.storage.${Date.now()}`;
    await Bun.$`mkdir -p ${directory}`;
    await Bun.write(
      `${directory}/default.json`,
      JSON.stringify({
        language: { source: "english", target: "japanese" },
        entries: [
          {
            term: "object",
            meanings: ["物"],
          },
        ],
      }),
    );
    const loaded = unwrap(await storage.load(directory, dictionary.name));
    const entry = loaded.entries[0];
    expect(entry?.score).toBe(defaultScore());
  });
});
