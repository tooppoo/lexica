import { describe, expect, test } from "bun:test";
import { Result as Byethrow } from "@praha/byethrow";
import type { Result as CoreResult } from "./result";
import type { Meaning, Term } from "./types";
import {
  parseDictionary,
  parseDictionaryName,
  parseSourceLanguage,
  parseTargetLanguage,
  toDictionaryName,
} from "./dictionary";
import {
  appendExample,
  createEntry,
  overwriteExamples,
  parseExample,
  parseMeaning,
  parseMeanings,
  parseTerm,
} from "./entry";
import { deleteEntry, listEntries, replaceEntry, upsertEntry } from "./vocabulary";

const unwrap = <T>(result: CoreResult<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected ok but got error: ${result.error.kind}`);
  }
  return result.value;
};

const expectErrorKind = <T>(
  result: CoreResult<T>,
  kind: "invalid-input" | "not-found" | "conflict",
) => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};

describe("dictionary parsing", () => {
  test("parses supported dictionary", () => {
    const result = parseDictionary("tech", { source: "english", target: "japanese" });
    const dictionary = unwrap(result);
    expect(dictionary).toEqual({
      name: unwrap(parseDictionaryName("tech")),
      language: {
        source: unwrap(parseSourceLanguage("english")),
        target: unwrap(parseTargetLanguage("japanese")),
      },
    });
  });

  test("rejects empty dictionary name", () => {
    const result = parseDictionary("  ", { source: "english", target: "japanese" });
    expectErrorKind(result, "invalid-input");
  });

  test("parses dictionary name", () => {
    const result = parseDictionaryName("tech");
    expect(unwrap(result)).toBe(unwrap(parseDictionaryName("tech")));
  });

  test("rejects unsupported dictionary name", () => {
    const result = parseDictionaryName("");
    expectErrorKind(result, "invalid-input");
  });

  test("derives dictionary name from dictionary", () => {
    const dictionary = unwrap(parseDictionary("tech", { source: "english", target: "japanese" }));
    expect(toDictionaryName(dictionary)).toBe(unwrap(parseDictionaryName("tech")));
  });

  test("rejects empty source language", () => {
    const result = parseDictionary("tech", { source: " ", target: "japanese" });
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty target language", () => {
    const result = parseDictionary("tech", { source: "english", target: "  " });
    expectErrorKind(result, "invalid-input");
  });
});

describe("entry parsing", () => {
  test("parses valid term and meaning", () => {
    const term = unwrap(parseTerm("object"));
    const meaning = unwrap(parseMeaning("物"));
    expect(term).toBe(unwrap(parseTerm("object")));
    expect(meaning).toBe(unwrap(parseMeaning("物")));
  });

  test("parses valid example", () => {
    const example = unwrap(parseExample("An example sentence."));
    expect(example).toBe(unwrap(parseExample("An example sentence.")));
  });

  test("rejects empty term", () => {
    const result = parseTerm("");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty meaning", () => {
    const result = parseMeaning("  ");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty example", () => {
    const result = parseExample(" ");
    expectErrorKind(result, "invalid-input");
  });

  test("parses meanings array", () => {
    const result = parseMeanings(["物", "対象"]);
    expect(unwrap(result)).toEqual([unwrap(parseMeaning("物")), unwrap(parseMeaning("対象"))]);
  });

  test("rejects empty meanings array", () => {
    const result = parseMeanings([]);
    expectErrorKind(result, "invalid-input");
  });

  test("rejects meanings containing empty string", () => {
    const result = parseMeanings(["物", ""]);
    expectErrorKind(result, "invalid-input");
  });
});

describe("entry creation and example overwrite", () => {
  test("creates entry with required fields", () => {
    const term = unwrap(parseTerm("object"));
    const meanings = unwrap(parseMeanings(["物"]));
    const entry = createEntry(term, meanings);
    expect(entry).toEqual(createEntry(term, meanings));
  });

  test("overwrites examples", () => {
    const term = unwrap(parseTerm("object"));
    const meanings = unwrap(parseMeanings(["物"]));
    const entry = createEntry(term, meanings, ["old example"]);
    const updated = overwriteExamples(entry, ["new example"]);
    expect(updated.examples).toEqual(["new example"]);
  });

  test("appends example", () => {
    const term = unwrap(parseTerm("object"));
    const meanings = unwrap(parseMeanings(["物"]));
    const entry = createEntry(term, meanings, ["old example"]);
    const updated = appendExample(entry, "new example");
    expect(updated.examples).toEqual(["old example", "new example"]);
  });
});

describe("vocabulary operations", () => {
  const makeTerm = (value: string): Term => unwrap(parseTerm(value));
  const makeMeaning = (value: string): Meaning => unwrap(parseMeaning(value));

  test("upserts new entry", () => {
    const result = upsertEntry([], makeTerm("object"), makeMeaning("物"));
    const { entries, entry } = unwrap(result);
    expect(entry.term).toBe(makeTerm("object"));
    expect(entry.meanings).toEqual([makeMeaning("物")]);
    expect(entries).toHaveLength(1);
  });

  test("appends meaning for existing term", () => {
    const first = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物")));
    const second = unwrap(upsertEntry(first.entries, makeTerm("object"), makeMeaning("対象")));
    expect(second.entry.meanings).toEqual([makeMeaning("物"), makeMeaning("対象")]);
  });

  test("lists all entries", () => {
    const first = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物")));
    const second = unwrap(upsertEntry(first.entries, makeTerm("value"), makeMeaning("値")));
    const listResult = listEntries(second.entries);
    expect(unwrap(listResult)).toHaveLength(2);
  });

  test("lists single entry by term", () => {
    const entries = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物"))).entries;
    const result = listEntries(entries, makeTerm("object"));
    expect(unwrap(result)).toEqual(createEntry(makeTerm("object"), unwrap(parseMeanings(["物"]))));
  });

  test("returns not-found when listing missing term", () => {
    const result = listEntries([], makeTerm("missing"));
    expectErrorKind(result, "not-found");
  });

  test("replaces existing entry", () => {
    const entries = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物"))).entries;
    const replacement = createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"])));
    const result = replaceEntry(entries, replacement);
    const updated = unwrap(result).entries;
    const list = unwrap(listEntries(updated, makeTerm("object")));
    expect(list).toEqual(createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"]))));
  });

  test("returns not-found when replacing missing entry", () => {
    const replacement = createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"])));
    const result = replaceEntry([], replacement);
    expectErrorKind(result, "not-found");
  });

  test("deletes entry", () => {
    const entries = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物"))).entries;
    const result = deleteEntry(entries, makeTerm("object"));
    const updated = unwrap(result).entries;
    const list = listEntries(updated, makeTerm("object"));
    expectErrorKind(list, "not-found");
  });

  test("returns not-found when deleting missing entry", () => {
    const result = deleteEntry([], makeTerm("object"));
    expectErrorKind(result, "not-found");
  });
});
