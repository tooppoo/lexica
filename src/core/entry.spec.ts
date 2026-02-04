import { describe, test, expect } from "bun:test";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";
import { unwrap } from "./result";
import {
  addEntry,
  addEntryExample,
  addEntryMeanings,
  appendExample,
  createEntry,
  deleteEntry,
  findEntry,
  overwriteExamples,
  parseExample,
  parseMeaning,
  parseMeanings,
  parseTerm,
  removeEntry,
  replaceEntry,
  replaceEntryInAppState,
  upsertEntry,
} from "./entry";
import type { Meaning, Term } from "./types";

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

  test("lists single entry by term", () => {
    const entries = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物"))).entries;
    const result = findEntry(entries, makeTerm("object"));
    expect(unwrap(result)).toEqual(createEntry(makeTerm("object"), unwrap(parseMeanings(["物"]))));
  });

  test("returns not-found when listing missing term", () => {
    const result = findEntry([], makeTerm("missing"));
    expectErrorKind(result, "not-found");
  });

  test("replaces existing entry", () => {
    const entries = unwrap(upsertEntry([], makeTerm("object"), makeMeaning("物"))).entries;
    const replacement = createEntry(makeTerm("object"), unwrap(parseMeanings(["対象"])));
    const result = replaceEntry(entries, replacement);
    const updated = unwrap(result).entries;
    const list = unwrap(findEntry(updated, makeTerm("object")));
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
    const list = findEntry(updated, makeTerm("object"));
    expectErrorKind(list, "not-found");
  });

  test("returns not-found when deleting missing entry", () => {
    const result = deleteEntry([], makeTerm("object"));
    expectErrorKind(result, "not-found");
  });
});

describe("Entry", () => {
  test("lists single entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const entry = unwrap(findEntry(added.state.entries, unwrap(parseTerm("object"))));
    expect(entry).toEqual(createEntry(unwrap(parseTerm("object")), [unwrap(parseMeaning("物"))]));
  });

  test("removes entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const removed = unwrap(removeEntry(added.state, unwrap(parseTerm("object"))));
    const result = findEntry(removed.state.entries, unwrap(parseTerm("object")));
    expectErrorKind(result, "not-found");
  });

  test("removes meaning from entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const appended = unwrap(
      addEntry(added.state, unwrap(parseTerm("object")), unwrap(parseMeaning("対象"))),
    );
    const removed = unwrap(
      removeEntry(appended.state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))),
    );
    const entry = unwrap(findEntry(removed.state.entries, unwrap(parseTerm("object"))));
    expect(entry).toEqual(createEntry(unwrap(parseTerm("object")), [unwrap(parseMeaning("対象"))]));
  });

  test("removing last meaning deletes entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const removed = unwrap(
      removeEntry(added.state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))),
    );
    const entry = findEntry(removed.state.entries, unwrap(parseTerm("object")));
    expectErrorKind(entry, "not-found");
  });

  test("adds and lists entries", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    expect(added.entry.term).toBe(unwrap(parseTerm("object")));
    const listed = added.state.entries;
    expect(listed).toHaveLength(1);
  });

  test("adds multiple meanings at once", () => {
    const state = createDefaultState();
    const added = unwrap(
      addEntryMeanings(state, unwrap(parseTerm("object")), unwrap(parseMeanings(["物", "対象"]))),
    );
    expect(added.entry.meanings).toEqual([
      unwrap(parseMeaning("物")),
      unwrap(parseMeaning("対象")),
    ]);
  });

  test("replace entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const replaced = unwrap(
      replaceEntryInAppState(
        added.state,
        unwrap(parseTerm("object")),
        unwrap(parseMeanings(["対象"])),
      ),
    );
    expect(replaced.entry.meanings).toEqual([unwrap(parseMeaning("対象"))]);
  });

  test("adds manual example", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const updated = unwrap(
      addEntryExample(added.state, unwrap(parseTerm("object")), "Example sentence."),
    );
    expect(updated.entry.examples).toEqual(["Example sentence."]);
  });
});
