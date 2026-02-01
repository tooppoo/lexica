import { describe, expect, test } from "bun:test";
import { Result as Byethrow } from "@praha/byethrow";
import type { Result as CoreResult } from "./result";
import type { Dictionary, DictionaryKey, Meaning, Term, VocabularyData } from "./types";
import { parseDictionary, parseDictionaryKey, toDictionaryKey } from "./dictionary";
import { createEntry, parseMeaning, parseMeanings, parseTerm, overwriteExamples } from "./entry";
import { deleteEntry, listEntries, replaceEntry, upsertEntry } from "./vocabulary";

const unwrap = <T>(result: CoreResult<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected ok but got error: ${result.error.kind}`);
  }
  return result.value;
};

const expectErrorKind = <T>(result: CoreResult<T>, kind: "invalid-input" | "not-found") => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};

describe("dictionary parsing", () => {
  test("parses supported dictionary", () => {
    const result = parseDictionary("en", "ja");
    const dictionary = unwrap(result);
    expect(dictionary).toEqual({ source: "en", target: "ja" });
  });

  test("rejects unsupported dictionary", () => {
    const result = parseDictionary("fr", "ja");
    expectErrorKind(result, "invalid-input");
  });

  test("parses dictionary key", () => {
    const result = parseDictionaryKey("en:ja");
    expect(unwrap(result)).toBe("en:ja");
  });

  test("rejects unsupported dictionary key", () => {
    const result = parseDictionaryKey("ja:en");
    expectErrorKind(result, "invalid-input");
  });

  test("derives dictionary key from dictionary", () => {
    const dictionary = unwrap(parseDictionary("en", "ja"));
    expect(toDictionaryKey(dictionary)).toBe("en:ja");
  });
});

describe("entry parsing", () => {
  test("parses valid term and meaning", () => {
    const term = unwrap(parseTerm("object"));
    const meaning = unwrap(parseMeaning("物"));
    expect(term).toBe(unwrap(parseTerm("object")));
    expect(meaning).toBe(unwrap(parseMeaning("物")));
  });

  test("rejects empty term", () => {
    const result = parseTerm("");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty meaning", () => {
    const result = parseMeaning("  ");
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
});

describe("vocabulary operations", () => {
  const makeDictionary = (): Dictionary => unwrap(parseDictionary("en", "ja"));
  const makeDictionaryKey = (): DictionaryKey => toDictionaryKey(makeDictionary());
  const makeTerm = (value: string): Term => unwrap(parseTerm(value));
  const makeMeaning = (value: string): Meaning => unwrap(parseMeaning(value));

  test("upserts new entry", () => {
    const dictionaryKey = makeDictionaryKey();
    const result = upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物"));
    const { vocabulary, entry } = unwrap(result);
    expect(entry.term).toBe(makeTerm("object"));
    expect(entry.meanings).toEqual([makeMeaning("物")]);
    expect(vocabulary[dictionaryKey]?.length).toBe(1);
  });

  test("appends meaning for existing term", () => {
    const dictionaryKey = makeDictionaryKey();
    const first = unwrap(upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物")));
    const second = unwrap(
      upsertEntry(first.vocabulary, dictionaryKey, makeTerm("object"), makeMeaning("対象")),
    );
    expect(second.entry.meanings).toEqual([makeMeaning("物"), makeMeaning("対象")]);
  });

  test("separates same term across dictionaries", () => {
    const enJa = unwrap(parseDictionary("en", "ja"));
    const enJaKey = toDictionaryKey(enJa);
    const vocabulary = unwrap(
      upsertEntry({}, enJaKey, makeTerm("object"), makeMeaning("物")),
    ).vocabulary;

    const enJaAgainKey = toDictionaryKey(enJa);
    const result = upsertEntry(vocabulary, enJaAgainKey, makeTerm("object"), makeMeaning("対象"));
    const { entry } = unwrap(result);
    expect(entry.meanings).toEqual([makeMeaning("物"), makeMeaning("対象")]);
  });

  test("lists all entries by dictionary", () => {
    const dictionaryKey = makeDictionaryKey();
    const first = unwrap(upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物")));
    const second = unwrap(
      upsertEntry(first.vocabulary, dictionaryKey, makeTerm("value"), makeMeaning("値")),
    );
    const listResult = listEntries(second.vocabulary, dictionaryKey);
    expect(unwrap(listResult)).toHaveLength(2);
  });

  test("lists single entry by term", () => {
    const dictionaryKey = makeDictionaryKey();
    const vocabulary = unwrap(
      upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物")),
    ).vocabulary;
    const result = listEntries(vocabulary, dictionaryKey, makeTerm("object"));
    expect(unwrap(result)).toEqual(createEntry(makeTerm("object"), unwrap(parseMeanings(["物"]))));
  });

  test("returns not-found when listing missing term", () => {
    const dictionaryKey = makeDictionaryKey();
    const vocabulary: VocabularyData = {};
    const result = listEntries(vocabulary, dictionaryKey, makeTerm("missing"));
    expectErrorKind(result, "not-found");
  });

  test("replaces existing entry", () => {
    const dictionaryKey = makeDictionaryKey();
    const vocabulary = unwrap(
      upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物")),
    ).vocabulary;
    const replacement = createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"])));
    const result = replaceEntry(vocabulary, dictionaryKey, replacement);
    const updated = unwrap(result).vocabulary;
    const list = unwrap(listEntries(updated, dictionaryKey, makeTerm("object")));
    expect(list).toEqual(createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"]))));
  });

  test("returns not-found when replacing missing entry", () => {
    const dictionaryKey = makeDictionaryKey();
    const replacement = createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"])));
    const result = replaceEntry({}, dictionaryKey, replacement);
    expectErrorKind(result, "not-found");
  });

  test("deletes entry", () => {
    const dictionaryKey = makeDictionaryKey();
    const vocabulary = unwrap(
      upsertEntry({}, dictionaryKey, makeTerm("object"), makeMeaning("物")),
    ).vocabulary;
    const result = deleteEntry(vocabulary, dictionaryKey, makeTerm("object"));
    const updated = unwrap(result).vocabulary;
    const list = listEntries(updated, dictionaryKey, makeTerm("object"));
    expectErrorKind(list, "not-found");
  });

  test("returns not-found when deleting missing entry", () => {
    const dictionaryKey = makeDictionaryKey();
    const result = deleteEntry({}, dictionaryKey, makeTerm("object"));
    expectErrorKind(result, "not-found");
  });
});
