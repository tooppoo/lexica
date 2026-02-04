import { describe, expect, test } from "bun:test";
import {
  clearDictionary,
  createDictionary,
  parseDictionaryName,
  parseSourceLanguage,
  parseTargetLanguage,
} from "./dictionary";
import { unwrap } from "./result";
import { createDefaultState } from "../utils/test-helper";
import { addEntry, parseMeaning, parseTerm } from "./entry";

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
