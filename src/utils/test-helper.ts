import { Result as Byethrow } from "@praha/byethrow";
import { expect } from "bun:test";

import { unwrap, type LexicaError, type Result } from "../core/result";
import { parseDictionary } from "../core/dictionary";
import { createState } from "../core/state";

export const expectErrorKind = <T>(result: Result<T>, kind: LexicaError["kind"]): void => {
  expect(Byethrow.isFailure(result)).toBe(true);
  if (Byethrow.isFailure(result)) {
    expect(result.error.kind).toBe(kind);
  }
};

export const createDefaultState = () => {
  const dictionary = unwrap(parseDictionary("default", { source: "english", target: "japanese" }));
  return createState(dictionary, []);
};
