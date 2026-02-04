import { describe, test, expect } from "bun:test";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";
import { unwrap } from "./result";
import {
  addEntry,
  addEntryExample,
  addEntryMeanings,
  createEntry,
  findEntry,
  parseMeaning,
  parseMeanings,
  parseTerm,
  removeEntry,
  replaceEntryInAppState,
} from "./entry";

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
