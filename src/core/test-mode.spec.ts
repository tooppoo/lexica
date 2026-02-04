import { describe, expect, test } from "bun:test";
import { Result as Byethrow } from "@praha/byethrow";
import { defaultTestCount, parseTestCount, parseTestMode } from "./test-mode";
import { unwrap } from "./result";

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
