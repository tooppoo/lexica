import * as v from "valibot";
import type { Result } from "./result";
import { failInvalidInput, succeed } from "./result";

type Brand<T, Name extends string> = T & { readonly __brand: Name };
export type ExampleCount = Brand<number, "ExampleCount">;

const exampleCountSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

/**
 * Parses an unknown value into an ExampleCount.
 */
export const parseExampleCount = (value: unknown): Result<ExampleCount> => {
  const numeric = typeof value === "string" ? Number(value) : value;
  const parsed = v.safeParse(exampleCountSchema, numeric);
  if (!parsed.success) {
    return failInvalidInput("Invalid example count");
  }
  return succeed(parsed.output as ExampleCount);
};

/**
 * Returns the default example count.
 */
export const defaultExampleCount = (): ExampleCount => 3 as ExampleCount;
