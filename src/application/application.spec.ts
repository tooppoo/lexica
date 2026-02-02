import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { parseDictionary, parseDictionaryName, toDictionaryName } from "../core/dictionary";
import { createEntry, parseMeaning, parseTerm } from "../core/entry";
import { scoreToNumber } from "../core/score";
import type { Result as CoreResult } from "../core/result";
import {
  addEntry,
  addEntryMeanings,
  clearDictionary,
  createState,
  generateExamples,
  listEntries,
  removeEntry,
  replaceEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
  switchDictionary,
  forgetEntry,
  rememberEntry,
} from "./application";
import type { AppError, Result } from "./application";

const unwrap = <T>(result: Result<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.kind}`);
  }
  return result.value;
};

const unwrapCore = <T>(result: CoreResult<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.kind}`);
  }
  return result.value;
};

const expectErrorKind = <T>(result: Result<T>, kind: AppError["kind"]): void => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};

const createDefaultState = () => {
  const dictionary = unwrapCore(parseDictionary("default"));
  return createState(toDictionaryName(dictionary), {});
};

describe("application dictionary operations", () => {
  test("switches dictionary", () => {
    const state = createDefaultState();
    const switched = unwrap(switchDictionary(state, "tech"));
    expect(switched.dictionaryName).toBe(unwrapCore(parseDictionaryName("tech")));
  });

  test("rejects unsupported dictionary", () => {
    const state = createDefaultState();
    const result = switchDictionary(state, " ");
    expectErrorKind(result, "invalid-input");
  });

  test("clears dictionary", () => {
    const state = createDefaultState();
    const updated = unwrap(addEntry(state, "object", "物")).state;
    const cleared = unwrap(clearDictionary(updated, "default"));
    const list = unwrap(listEntries(cleared.state));
    expect(Array.isArray(list.entries)).toBe(true);
    if (Array.isArray(list.entries)) {
      expect(list.entries).toHaveLength(0);
    }
  });
});

describe("application vocabulary operations", () => {
  test("adds and lists entries", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    expect(added.entry.term).toBe(unwrapCore(parseTerm("object")));
    const listed = unwrap(listEntries(added.state));
    expect(Array.isArray(listed.entries)).toBe(true);
  });

  test("adds multiple meanings at once", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物", "対象"]));
    expect(added.entry.meanings).toEqual([
      unwrapCore(parseMeaning("物")),
      unwrapCore(parseMeaning("対象")),
    ]);
  });

  test("lists single entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const listed = unwrap(listEntries(added.state, "object"));
    expect(listed.entries).toEqual(
      createEntry(unwrapCore(parseTerm("object")), [unwrapCore(parseMeaning("物"))]),
    );
  });

  test("removes entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const removed = unwrap(removeEntry(added.state, "object"));
    const result = listEntries(removed.state, "object");
    expectErrorKind(result, "not-found");
  });

  test("removes meaning from entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const appended = unwrap(addEntry(added.state, "object", "対象"));
    const removed = unwrap(removeEntry(appended.state, "object", "物"));
    const listed = unwrap(listEntries(removed.state, "object"));
    expect(listed.entries).toEqual(
      createEntry(unwrapCore(parseTerm("object")), [unwrapCore(parseMeaning("対象"))]),
    );
  });

  test("removing last meaning deletes entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const removed = unwrap(removeEntry(added.state, "object", "物"));
    const listed = listEntries(removed.state, "object");
    expectErrorKind(listed, "not-found");
  });

  test("replace entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const replaced = unwrap(replaceEntry(added.state, "object", ["対象"]));
    expect(replaced.entry.meanings).toEqual([unwrapCore(parseMeaning("対象"))]);
  });
});

describe("application example generation", () => {
  test("generates examples", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const generated = unwrap(
      await generateExamples(added.state, "object", "物", async () =>
        Byethrow.succeed(["example sentence"]),
      ),
    );
    expect(generated.entry.examples).toEqual(["example sentence"]);
  });

  test("returns ai-failed when generator fails", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const result = await generateExamples(added.state, "object", "物", async () =>
      Byethrow.fail({ kind: "ai-failed", reason: "failure" }),
    );
    expectErrorKind(result, "ai-failed");
  });
});

describe("application test operations", () => {
  test("updates score when remembered", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const updated = unwrap(rememberEntry(added.state, "object"));
    expect(scoreToNumber(updated.entry.score)).toBe(1);
  });

  test("does not decrement score below zero", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物"));
    const updated = unwrap(forgetEntry(added.state, "object"));
    expect(scoreToNumber(updated.entry.score)).toBe(0);
  });

  test("selects meanings entry without repeating terms", () => {
    const state = createDefaultState();
    const first = unwrap(addEntry(state, "object", "物")).state;
    const second = unwrap(addEntry(first, "value", "値")).state;
    const usedTerms = new Set([unwrapCore(parseTerm("object"))]);
    const selection = unwrap(selectMeaningTestEntry(second, usedTerms, () => 0));
    expect(selection?.entry.term).toBe(unwrapCore(parseTerm("value")));
  });

  test("selects examples without repeating examples", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, "object", "物")).state;
    const updated = unwrap(replaceEntry(added, "object", ["物"], ["ex1", "ex2"])).state;
    const usedExamples = new Set(["ex1"]);
    const selection = unwrap(selectExampleTestEntry(updated, usedExamples, () => 0));
    expect(selection?.example).toBe("ex2");
  });
});
