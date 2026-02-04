import { describe, expect, test } from "bun:test";
import { Result as Byethrow } from "@praha/byethrow";
import {
  defaultTestCount,
  forgetEntry,
  parseTestCount,
  parseTestMode,
  rememberEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
} from "./test-mode";
import { unwrap } from "./result";
import { createDefaultState } from "../utils/test-helper";
import { addEntry, parseMeaning, parseMeanings, parseTerm, replaceEntryInAppState } from "./entry";
import { scoreToNumber } from "./score";

describe("test mode parsing", () => {
  test("parses valid test mode", () => {
    const mode = unwrap(parseTestMode("meanings"));
    expect(mode).toBe("meanings");
  });

  test("rejects invalid test mode", () => {
    const result = parseTestMode("invalid");
    expect(Byethrow.isFailure(result)).toBe(true);
  });
});

describe("test count parsing", () => {
  test("parses valid test count", () => {
    const count = unwrap(parseTestCount("5"));
    expect(Number(count)).toBe(5);
  });

  test("rejects non-positive count", () => {
    const result = parseTestCount(0);
    expect(Byethrow.isFailure(result)).toBe(true);
  });

  test("provides default test count", () => {
    expect(Number(defaultTestCount())).toBe(10);
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
      replaceEntryInAppState(added, unwrap(parseTerm("object")), unwrap(parseMeanings(["物"])), [
        "ex1",
        "ex2",
      ]),
    ).state;
    const usedExamples = new Set(["ex1"]);
    const selection = unwrap(selectExampleTestEntry(updated, usedExamples, () => 0));
    expect(selection?.example).toBe("ex2");
  });
});
