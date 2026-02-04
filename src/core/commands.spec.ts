import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import {
  parseDictionary,
  parseDictionaryName,
  parseSourceLanguage,
  parseTargetLanguage,
} from "./dictionary";
import { createEntry, parseMeaning, parseMeanings, parseTerm } from "./entry";
import { defaultExampleCount } from "./example-count";
import { unwrap } from "./result";
import { scoreToNumber } from "./score";
import {
  addEntry,
  addEntryExample,
  addEntryMeanings,
  clearDictionary,
  createDictionary,
  createState,
  forgetEntry,
  generateExamples,
  rememberEntry,
  removeEntry,
  replaceEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
} from "./commands";
import { expectErrorKind } from "../utils/test-helper";
import { findEntry } from "./vocabulary";

const createDefaultState = () => {
  const dictionary = unwrap(parseDictionary("default", { source: "english", target: "japanese" }));
  return createState(dictionary, []);
};

describe("core dictionary operations", () => {
  test("creates dictionary with source and target", () => {
    const name = unwrap(parseDictionaryName("travel"));
    const language = {
      source: unwrap(parseSourceLanguage("english")),
      target: unwrap(parseTargetLanguage("japanese")),
    };
    const created = unwrap(createDictionary(name, language));
    expect(created.dictionary).toEqual({ name, language });
  });

  test("clears dictionary", () => {
    const state = createDefaultState();
    const updated = unwrap(
      addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))),
    ).state;
    const cleared = unwrap(clearDictionary(updated, unwrap(parseDictionaryName("default"))));
    const list = cleared.state.entries;
    expect(list).toHaveLength(0);
  });
});

describe("core vocabulary operations", () => {
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

  test("replace entry", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const replaced = unwrap(
      replaceEntry(added.state, unwrap(parseTerm("object")), unwrap(parseMeanings(["対象"]))),
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

describe("core example generation", () => {
  test("generates examples", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const generated = unwrap(
      await generateExamples(
        added.state,
        unwrap(parseTerm("object")),
        unwrap(parseMeaning("物")),
        async ({ language }) =>
          Byethrow.succeed([`example sentence (${language.source} to ${language.target})`]),
        defaultExampleCount(),
      ),
    );
    expect(generated.entry.examples).toEqual(["example sentence (english to japanese)"]);
  });

  test("returns ai-failed when generator fails", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const result = await generateExamples(
      added.state,
      unwrap(parseTerm("object")),
      unwrap(parseMeaning("物")),
      async () => Byethrow.fail({ kind: "ai-failed", reason: "failure" }),
      defaultExampleCount(),
    );
    expectErrorKind(result, "ai-failed");
  });
});

describe("core test operations", () => {
  test("updates score when remembered", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const updated = unwrap(rememberEntry(added.state, unwrap(parseTerm("object"))));
    expect(scoreToNumber(updated.entry.score)).toBe(1);
  });

  test("does not decrement score below zero", () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const updated = unwrap(forgetEntry(added.state, unwrap(parseTerm("object"))));
    expect(scoreToNumber(updated.entry.score)).toBe(0);
  });

  test("selects meanings entry without repeating terms", () => {
    const state = createDefaultState();
    const first = unwrap(
      addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))),
    ).state;
    const second = unwrap(
      addEntry(first, unwrap(parseTerm("value")), unwrap(parseMeaning("値"))),
    ).state;
    const usedTerms = new Set([unwrap(parseTerm("object"))]);
    const selection = unwrap(selectMeaningTestEntry(second, usedTerms, () => 0));
    expect(selection?.entry.term).toBe(unwrap(parseTerm("value")));
  });

  test("selects examples without repeating examples", () => {
    const state = createDefaultState();
    const added = unwrap(
      addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))),
    ).state;
    const updated = unwrap(
      replaceEntry(added, unwrap(parseTerm("object")), unwrap(parseMeanings(["物"])), [
        "ex1",
        "ex2",
      ]),
    ).state;
    const usedExamples = new Set(["ex1"]);
    const selection = unwrap(selectExampleTestEntry(updated, usedExamples, () => 0));
    expect(selection?.example).toBe("ex2");
  });
});
