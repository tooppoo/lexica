import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { parseDictionaryName, parseSourceLanguage, parseTargetLanguage } from "./dictionary";
import { addEntry, parseMeaning, parseTerm } from "./entry";
import { defaultExampleCount } from "./example-count";
import { unwrap } from "./result";
import { clearDictionary, createDictionary, generateExamples } from "./commands";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";

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

describe("core vocabulary operations", () => {});

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
