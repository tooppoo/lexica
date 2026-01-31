import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { MemoryVocabularyStorage, type Result } from "./storage";

const unwrap = <T>(result: Result<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.reason}`);
  }
  return result.value;
};

describe("memory storage", () => {
  test("saves and loads vocabulary data", () => {
    const storage = new MemoryVocabularyStorage();
    const data = {
      "en:ja": [
        {
          term: "object",
          meanings: ["物"],
          examples: ["example"],
        },
      ],
    };
    unwrap(storage.save("memory", data));
    const loaded = unwrap(storage.load("memory"));
    expect(loaded).toEqual(data);
  });

  test("returns empty data for missing key", () => {
    const storage = new MemoryVocabularyStorage();
    expect(unwrap(storage.load("missing"))).toEqual({});
  });
});
