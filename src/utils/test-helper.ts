import { Result as Byethrow } from "@praha/byethrow";
import { expect } from "bun:test";

import type { CoreError, Result } from "../core/result";

export const expectErrorKind = <T>(result: Result<T>, kind: CoreError["kind"]): void => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};
