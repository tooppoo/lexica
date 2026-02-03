import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import {
  failConflict,
  failInvalidInput,
  failNotFound,
  isFailure,
  isSuccess,
  succeed,
} from "./result";

describe("core result helpers", () => {
  test("succeed wraps value", () => {
    const result = succeed(42);
    expect(Byethrow.isSuccess(result)).toBe(true);
    if (Byethrow.isSuccess(result)) {
      expect(result.value).toBe(42);
    }
    expect(isSuccess(result)).toBe(true);
    expect(isFailure(result)).toBe(false);
  });

  test("failInvalidInput creates failure", () => {
    const result = failInvalidInput("bad input");
    expect(Byethrow.isFailure(result)).toBe(true);
    if (Byethrow.isFailure(result)) {
      expect(result.error).toEqual({ kind: "invalid-input", reason: "bad input" });
    }
    expect(isSuccess(result)).toBe(false);
    expect(isFailure(result)).toBe(true);
  });

  test("failNotFound creates failure", () => {
    const result = failNotFound("missing");
    expect(Byethrow.isFailure(result)).toBe(true);
    if (Byethrow.isFailure(result)) {
      expect(result.error).toEqual({ kind: "not-found", reason: "missing" });
    }
    expect(isSuccess(result)).toBe(false);
    expect(isFailure(result)).toBe(true);
  });

  test("failConflict creates failure", () => {
    const result = failConflict("duplicate");
    expect(Byethrow.isFailure(result)).toBe(true);
    if (Byethrow.isFailure(result)) {
      expect(result.error).toEqual({ kind: "conflict", reason: "duplicate" });
    }
    expect(isSuccess(result)).toBe(false);
    expect(isFailure(result)).toBe(true);
  });
});
