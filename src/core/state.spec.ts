import { describe, expect, test } from "bun:test";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";
import { createEntry, parseMeaning, parseMeanings, parseTerm } from "./entry";
import { unwrap } from "./result";
import {
  addEntryExampleToState,
  addEntryMeaningsToState,
  addEntryToState,
  createState,
  removeEntryFromState,
  replaceEntryInState,
} from "./state";
import type { Meaning, Term } from "./types";

describe("state creation", () => {
  test("creates state with dictionary and entries", () => {
    const dictionary = createDefaultState().dictionary;
    const entries = [createEntry(unwrap(parseTerm("object")), unwrap(parseMeanings(["物"])))];
    const state = createState(dictionary, entries);
    expect(state).toEqual({ dictionary, entries });
  });
});

describe("state entry operations", () => {
  const makeTerm = (value: string): Term => unwrap(parseTerm(value));
  const makeMeaning = (value: string): Meaning => unwrap(parseMeaning(value));

  test("adds entry to state", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    expect(added.entry).toEqual(createEntry(makeTerm("object"), [makeMeaning("物")], undefined));
    expect(added.state.entries).toHaveLength(1);
    expect(added.dictionaryName).toBe(state.dictionary.name);
  });

  test("adds multiple meanings to state", () => {
    const state = createDefaultState();
    const added = unwrap(
      addEntryMeaningsToState(state, makeTerm("object"), unwrap(parseMeanings(["物", "対象"]))),
    );
    expect(added.entry.meanings).toEqual([makeMeaning("物"), makeMeaning("対象")]);
    expect(added.dictionaryName).toBe(state.dictionary.name);
  });

  test("appends meanings to existing term", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const updated = unwrap(
      addEntryMeaningsToState(added.state, makeTerm("object"), [makeMeaning("対象")]),
    );
    expect(updated.entry.meanings).toEqual([makeMeaning("物"), makeMeaning("対象")]);
  });

  test("adds manual example", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const updated = unwrap(addEntryExampleToState(added.state, makeTerm("object"), "Example"));
    expect(updated.entry.examples).toEqual(["Example"]);
    expect(updated.dictionaryName).toBe(state.dictionary.name);
  });

  test("rejects example for missing entry", () => {
    const state = createDefaultState();
    const result = addEntryExampleToState(state, makeTerm("missing"), "Example");
    expectErrorKind(result, "not-found");
  });

  test("removes entry from state", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const removed = unwrap(removeEntryFromState(added.state, makeTerm("object")));
    expect(removed.state.entries).toHaveLength(0);
    expect(removed.dictionaryName).toBe(state.dictionary.name);
  });

  test("returns not-found when removing missing entry", () => {
    const state = createDefaultState();
    const result = removeEntryFromState(state, makeTerm("missing"));
    expectErrorKind(result, "not-found");
  });

  test("rejects removing missing meaning", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const result = removeEntryFromState(added.state, makeTerm("object"), makeMeaning("対象"));
    expectErrorKind(result, "not-found");
  });

  test("removes meaning and keeps entry", () => {
    const state = createDefaultState();
    const added = unwrap(
      addEntryMeaningsToState(state, makeTerm("object"), [makeMeaning("物"), makeMeaning("対象")]),
    );
    const removed = unwrap(
      removeEntryFromState(added.state, makeTerm("object"), makeMeaning("物")),
    );
    expect(removed.state.entries).toHaveLength(1);
    expect(removed.state.entries[0]?.meanings).toEqual([makeMeaning("対象")]);
  });

  test("removing last meaning deletes entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const removed = unwrap(
      removeEntryFromState(added.state, makeTerm("object"), makeMeaning("物")),
    );
    expect(removed.state.entries).toHaveLength(0);
  });

  test("replaces entry meanings", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryToState(state, makeTerm("object"), makeMeaning("物")));
    const replaced = unwrap(
      replaceEntryInState(added.state, makeTerm("object"), unwrap(parseMeanings(["対象"])), [
        "Example",
      ]),
    );
    expect(replaced.entry).toEqual(
      createEntry(makeTerm("object"), [makeMeaning("対象")], ["Example"], added.entry.score),
    );
    expect(replaced.dictionaryName).toBe(state.dictionary.name);
  });

  test("returns not-found when replacing missing entry", () => {
    const state = createDefaultState();
    const result = replaceEntryInState(state, makeTerm("missing"), [makeMeaning("物")]);
    expectErrorKind(result, "not-found");
  });
});
