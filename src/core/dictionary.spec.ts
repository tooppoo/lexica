import { describe, expect, test } from "bun:test";
import {
  clearDictionary,
  createDictionary,
  parseDictionary,
  parseDictionaryName,
  parseSourceLanguage,
  parseTargetLanguage,
} from "./dictionary";
import { unwrap } from "./result";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";
import { addEntry, parseMeaning, parseTerm } from "./entry";

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
    expect(dictionary.name).toBe(unwrap(parseDictionaryName("tech")));
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
