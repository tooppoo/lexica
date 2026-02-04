import * as v from "valibot";
import type { Result } from "./result";
import { failInvalidInput, succeed } from "./result";
import type { TestCount, TestMode } from "./types";

const testModeSchema = v.picklist(["meanings", "examples"] as const);
const testCountSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

/**
 * Parses a raw test mode string into a TestMode.
 */
export const parseTestMode = (value: string): Result<TestMode> => {
  const parsed = v.safeParse(testModeSchema, value);
  if (!parsed.success) {
    return failInvalidInput("Invalid test mode");
  }
  return succeed(parsed.output);
};

/**
 * Parses an unknown value into a TestCount.
 */
export const parseTestCount = (value: unknown): Result<TestCount> => {
  const numeric = typeof value === "string" ? Number(value) : value;
  const parsed = v.safeParse(testCountSchema, numeric);
  if (!parsed.success) {
    return failInvalidInput("Invalid test count");
  }
  return succeed(parsed.output as TestCount);
};

/**
 * Returns the default test count.
 */
export const defaultTestCount = (): TestCount => 10 as TestCount;
