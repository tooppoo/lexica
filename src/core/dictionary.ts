import * as v from "valibot";
import type { Dictionary, DictionaryName } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";

const dictionaryNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

/**
 * Parses a dictionary name.
 */
export const parseDictionaryName = (name: string): Result<DictionaryName> => {
  const parsedName = v.safeParse(dictionaryNameSchema, name);
  if (!parsedName.success) {
    return failInvalidInput("Invalid dictionary name");
  }
  return succeed(parsedName.output as DictionaryName);
};

/**
 * Parses a dictionary name into a Dictionary.
 */
export const parseDictionary = (name: string): Result<Dictionary> => {
  const parsed = parseDictionaryName(name);
  if (parsed.type === "Failure") {
    return parsed;
  }
  return succeed({ name: parsed.value });
};

/**
 * Derives a DictionaryName from a Dictionary.
 */
export const toDictionaryName = (dictionary: Dictionary): DictionaryName => {
  return dictionary.name;
};
