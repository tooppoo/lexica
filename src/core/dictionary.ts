import * as v from "valibot";
import type { Dictionary, DictionaryName, Language, SourceLanguage, TargetLanguage } from "./types";
import { failInvalidInput, succeed, type Result } from "./result";

const dictionaryNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const languageLabelSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

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
 * Parses a source language label.
 */
export const parseSourceLanguage = (input: string): Result<SourceLanguage> => {
  const parsed = v.safeParse(languageLabelSchema, input);
  if (!parsed.success) {
    return failInvalidInput("Invalid source language");
  }
  return succeed(parsed.output as SourceLanguage);
};

/**
 * Parses a target language label.
 */
export const parseTargetLanguage = (input: string): Result<TargetLanguage> => {
  const parsed = v.safeParse(languageLabelSchema, input);
  if (!parsed.success) {
    return failInvalidInput("Invalid target language");
  }
  return succeed(parsed.output as TargetLanguage);
};

/**
 * Parses dictionary metadata from name/source/target inputs.
 */
export const parseDictionary = (
  name: string,
  languageInput: { source: string; target: string },
): Result<Dictionary> => {
  const parsedName = parseDictionaryName(name);
  if (parsedName.type === "Failure") {
    return parsedName;
  }
  const parsedSource = parseSourceLanguage(languageInput.source);
  if (parsedSource.type === "Failure") {
    return parsedSource;
  }
  const parsedTarget = parseTargetLanguage(languageInput.target);
  if (parsedTarget.type === "Failure") {
    return parsedTarget;
  }
  const language: Language = {
    source: parsedSource.value,
    target: parsedTarget.value,
  };
  return succeed({
    name: parsedName.value,
    language,
  });
};
