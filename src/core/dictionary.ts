import * as v from "valibot";
import type { Dictionary, DictionaryKey } from "./types";
import { SUPPORTED_SOURCES, SUPPORTED_TARGETS } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";

const sourceSchema = v.picklist(SUPPORTED_SOURCES);
const targetSchema = v.picklist(SUPPORTED_TARGETS);
const dictionaryKeySchema = v.pipe(v.string(), v.regex(/^[^:]+:[^:]+$/));

/**
 * Parses source/target strings into a Dictionary when supported.
 */
export const parseDictionary = (source: string, target: string): Result<Dictionary> => {
  const parsedSource = v.safeParse(sourceSchema, source);
  const parsedTarget = v.safeParse(targetSchema, target);
  if (!parsedSource.success || !parsedTarget.success) {
    return failInvalidInput("Unsupported dictionary");
  }
  return succeed({ source: parsedSource.output, target: parsedTarget.output });
};

/**
 * Parses a dictionary key string into a supported DictionaryKey.
 */
export const parseDictionaryKey = (key: string): Result<DictionaryKey> => {
  const parsedKey = v.safeParse(dictionaryKeySchema, key);
  if (!parsedKey.success) {
    return failInvalidInput("Invalid dictionary key format");
  }
  const parts = parsedKey.output.split(":");
  if (parts.length !== 2) {
    return failInvalidInput("Invalid dictionary key format");
  }
  const [source, target] = parts;
  if (!source || !target) {
    return failInvalidInput("Invalid dictionary key format");
  }
  const dictionary = parseDictionary(source, target);
  if (dictionary.type === "Failure") {
    return dictionary;
  }
  return succeed(toDictionaryKey(dictionary.value));
};

/**
 * Derives a DictionaryKey from a Dictionary.
 */
export const toDictionaryKey = (dictionary: Dictionary): DictionaryKey => {
  return `${dictionary.source}:${dictionary.target}`;
};
