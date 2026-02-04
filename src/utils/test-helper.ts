import { Result as Byethrow } from "@praha/byethrow";
import { expect } from "bun:test";

import type { LexicaError, Result } from "../core/result";

export const expectErrorKind = <T>(result: Result<T>, kind: LexicaError["kind"]): void => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};
