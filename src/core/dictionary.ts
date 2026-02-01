import * as v from "valibot";
import type { Dictionary, DictionaryKey } from "./types";
import { SUPPORTED_DICTIONARIES, SUPPORTED_DICTIONARY_KEYS } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";

const dictionaryKeySchema = v.pipe(v.string(), v.regex(/^[^:]+:[^:]+$/));

const isSupportedDictionary = (source: string, target: string): Dictionary | null => {
  const match = SUPPORTED_DICTIONARIES.find(
    (dictionary) => dictionary.source === source && dictionary.target === target,
  );
  return match ?? null;
};

/**
 * Parses source/target strings into a Dictionary when supported.
 */
export const parseDictionary = (source: string, target: string): Result<Dictionary> => {
  const supported = isSupportedDictionary(source, target);
  if (!supported) {
    return failInvalidInput("Unsupported dictionary");
  }
  return succeed(supported);
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
  const index = SUPPORTED_DICTIONARIES.findIndex(
    (item) => item.source === dictionary.source && item.target === dictionary.target,
  );
  if (index < 0) {
    throw new Error("Unsupported dictionary");
  }
  const key = SUPPORTED_DICTIONARY_KEYS[index];
  if (!key) {
    throw new Error("Unsupported dictionary");
  }
  return key;
};
