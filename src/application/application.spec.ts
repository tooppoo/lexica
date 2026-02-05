import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import {
  addEntryExample,
  addEntryMeanings,
  clearDictionary,
  createDictionary,
  createState,
  forgetEntry,
  generateExamples,
  listEntries,
  listEntry,
  listEntryExamples,
  listEntryMeanings,
  rememberEntry,
  removeEntry,
  replaceEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
} from "./application";
import { parseDictionary, parseDictionaryName } from "../core/dictionary";
import { createEntry, parseExample, parseMeanings, parseTerm } from "../core/entry";
import { defaultExampleCount } from "../core/example";
import { unwrap } from "../core/result";
import { scoreToNumber } from "../core/score";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";

describe("application dictionary operations", () => {
  test("creates dictionary with parsed language", () => {
    const created = unwrap(createDictionary("tech", { source: "english", target: "japanese" }));
    expect(created.dictionary).toEqual(
      unwrap(parseDictionary("tech", { source: "english", target: "japanese" })),
    );
  });

  test("rejects invalid dictionary inputs", () => {
    const result = createDictionary(" ", { source: "english", target: "japanese" });
    expectErrorKind(result, "invalid-input");
  });

  test("clears dictionary entries", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const cleared = unwrap(clearDictionary(added.state, "default"));
    expect(cleared.state.entries).toHaveLength(0);
  });

  test("rejects invalid dictionary name", () => {
    const result = clearDictionary(createDefaultState(), "");
    expectErrorKind(result, "invalid-input");
  });

  test("propagates dictionary not found", () => {
    const result = clearDictionary(createDefaultState(), "missing");
    expectErrorKind(result, "not-found");
  });
});

describe("application entry operations", () => {
  test("adds entry meanings", () => {
    const state = createDefaultState();
    const result = unwrap(addEntryMeanings(state, "object", ["物", "目的"]));
    expect(result.entry.meanings).toEqual(unwrap(parseMeanings(["物", "目的"])));
    expect(result.dictionaryName).toBe(unwrap(parseDictionaryName("default")));
  });

  test("rejects empty term when adding meanings", () => {
    const result = addEntryMeanings(createDefaultState(), "", ["物"]);
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty meanings when adding entry", () => {
    const result = addEntryMeanings(createDefaultState(), "object", []);
    expectErrorKind(result, "invalid-input");
  });

  test("adds entry example", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const updated = unwrap(addEntryExample(added.state, "object", "example"));
    expect(updated.entry.examples).toEqual([unwrap(parseExample("example"))]);
  });

  test("rejects empty term when adding example", () => {
    const result = addEntryExample(createDefaultState(), "", "example");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects empty example", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const result = addEntryExample(added.state, "object", "");
    expectErrorKind(result, "invalid-input");
  });

  test("lists entries", () => {
    const dictionary = unwrap(
      parseDictionary("default", { source: "english", target: "japanese" }),
    );
    const entry = createEntry(unwrap(parseTerm("object")), unwrap(parseMeanings(["物"])));
    const state = createState(dictionary, [entry]);
    const listed = unwrap(listEntries(state));
    expect(listed.dictionaryName).toBe(dictionary.name);
    expect(listed.entries).toEqual([entry]);
  });

  test("lists a single entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const listed = unwrap(listEntry(added.state, "object"));
    expect(listed.entry.term).toBe(unwrap(parseTerm("object")));
  });

  test("lists entry meanings", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物", "対象"]));
    const listed = unwrap(listEntryMeanings(added.state, "object"));
    expect(listed.meanings).toEqual(unwrap(parseMeanings(["物", "対象"])));
  });

  test("lists entry examples", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const replaced = unwrap(replaceEntry(added.state, "object", ["物"], ["ex1", "ex2"]));
    const listed = unwrap(listEntryExamples(replaced.state, "object"));
    expect(listed.examples).toEqual(["ex1", "ex2"]);
  });

  test("returns empty examples when entry has none", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const listed = unwrap(listEntryExamples(added.state, "object"));
    expect(listed.examples).toEqual([]);
  });

  test("rejects invalid term when listing entry", () => {
    const result = listEntry(createDefaultState(), "");
    expectErrorKind(result, "invalid-input");
  });

  test("returns not-found when listing missing entry", () => {
    const result = listEntry(createDefaultState(), "missing");
    expectErrorKind(result, "not-found");
  });

  test("returns not-found when listing meanings for missing entry", () => {
    const result = listEntryMeanings(createDefaultState(), "missing");
    expectErrorKind(result, "not-found");
  });

  test("removes entry by term", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const removed = unwrap(removeEntry(added.state, "object"));
    expect(removed.state.entries).toHaveLength(0);
  });

  test("removes specific meaning", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物", "目的"]));
    const removed = unwrap(removeEntry(added.state, "object", "物"));
    expect(removed.state.entries[0]?.meanings).toEqual(unwrap(parseMeanings(["目的"])));
  });

  test("rejects invalid term when removing entry", () => {
    const result = removeEntry(createDefaultState(), "");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects invalid meaning when removing entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const result = removeEntry(added.state, "object", "");
    expectErrorKind(result, "invalid-input");
  });

  test("replaces entry meanings and examples", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const replaced = unwrap(replaceEntry(added.state, "object", ["目的"], ["ex"]));
    expect(replaced.entry.meanings).toEqual(unwrap(parseMeanings(["目的"])));
    expect(replaced.entry.examples).toEqual(["ex"]);
  });

  test("rejects invalid term when replacing entry", () => {
    const result = replaceEntry(createDefaultState(), "", ["物"]);
    expectErrorKind(result, "invalid-input");
  });

  test("rejects invalid meanings when replacing entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const result = replaceEntry(added.state, "object", []);
    expectErrorKind(result, "invalid-input");
  });
});

describe("application example generation", () => {
  test("generates examples for entry", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const generated = unwrap(
      await generateExamples(
        added.state,
        "object",
        "物",
        async ({ language }) =>
          Byethrow.succeed([`example (${language.source} to ${language.target})`]),
        defaultExampleCount(),
      ),
    );
    expect(generated.entry.examples).toEqual(["example (english to japanese)"]);
  });

  test("rejects invalid term when generating examples", async () => {
    const result = await generateExamples(
      createDefaultState(),
      "",
      "物",
      async () => Byethrow.succeed([]),
      defaultExampleCount(),
    );
    expectErrorKind(result, "invalid-input");
  });

  test("rejects invalid meaning when generating examples", async () => {
    const result = await generateExamples(
      createDefaultState(),
      "object",
      "",
      async () => Byethrow.succeed([]),
      defaultExampleCount(),
    );
    expectErrorKind(result, "invalid-input");
  });

  test("propagates generator failure", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const result = await generateExamples(
      added.state,
      "object",
      "物",
      async () => Byethrow.fail({ kind: "ai-failed", reason: "failure" }),
      defaultExampleCount(),
    );
    expectErrorKind(result, "ai-failed");
  });
});

describe("application test mode selection", () => {
  test("selects meaning test entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const selection = unwrap(selectMeaningTestEntry(added.state, new Set()));
    expect(selection?.entry.term).toBe(unwrap(parseTerm("object")));
  });

  test("returns null when meanings are exhausted", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const selection = unwrap(
      selectMeaningTestEntry(added.state, new Set([unwrap(parseTerm("object"))])),
    );
    expect(selection).toBeNull();
  });

  test("selects example test entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const replaced = unwrap(replaceEntry(added.state, "object", ["物"], ["ex1", "ex2"]));
    const selection = unwrap(selectExampleTestEntry(replaced.state, new Set(["ex1"]), () => 0));
    expect(selection?.example).toBe("ex2");
  });

  test("returns null when examples are exhausted", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const replaced = unwrap(replaceEntry(added.state, "object", ["物"], ["ex1"]));
    const selection = unwrap(selectExampleTestEntry(replaced.state, new Set(["ex1"])));
    expect(selection).toBeNull();
  });
});

describe("application test score operations", () => {
  test("increments score on remember", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const updated = unwrap(rememberEntry(added.state, "object"));
    expect(scoreToNumber(updated.entry.score)).toBe(1);
  });

  test("does not decrement score below zero", () => {
    const state = createDefaultState();
    const added = unwrap(addEntryMeanings(state, "object", ["物"]));
    const updated = unwrap(forgetEntry(added.state, "object"));
    expect(scoreToNumber(updated.entry.score)).toBe(0);
  });

  test("rejects invalid term when remembering", () => {
    const result = rememberEntry(createDefaultState(), "");
    expectErrorKind(result, "invalid-input");
  });

  test("rejects invalid term when forgetting", () => {
    const result = forgetEntry(createDefaultState(), "");
    expectErrorKind(result, "invalid-input");
  });
});
