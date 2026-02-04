import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_DICTIONARY_PATH,
  DEFAULT_STATE_PATH,
} from "./cli-config";
import { extractOption, parseGlobalOptions } from "./option";

describe("parseGlobalOptions", () => {
  test("returns defaults when no args", () => {
    const parsed = parseGlobalOptions([]);
    expect(parsed).toEqual({
      dictionaryPath: DEFAULT_DICTIONARY_PATH,
      statePath: DEFAULT_STATE_PATH,
      configPath: DEFAULT_CONFIG_PATH,
      args: [],
    });
  });

  test("uses provided paths", () => {
    const parsed = parseGlobalOptions([
      "--dictionary",
      "custom/dict",
      "--state",
      "custom/state.json",
      "--config",
      "custom/config.json",
    ]);
    expect(parsed).toEqual({
      dictionaryPath: "custom/dict",
      statePath: "custom/state.json",
      configPath: "custom/config.json",
      args: [],
    });
  });

  test("uses --path as dictionary path", () => {
    const parsed = parseGlobalOptions(["--path", "custom/path"]);
    expect(parsed).toEqual({
      dictionaryPath: "custom/path",
      statePath: DEFAULT_STATE_PATH,
      configPath: DEFAULT_CONFIG_PATH,
      args: [],
    });
  });

  test("forwards count to args", () => {
    const parsed = parseGlobalOptions(["test", "meanings", "--count", "2"]);
    expect(parsed).toEqual({
      dictionaryPath: DEFAULT_DICTIONARY_PATH,
      statePath: DEFAULT_STATE_PATH,
      configPath: DEFAULT_CONFIG_PATH,
      args: ["test", "meanings", "--count", "2"],
    });
  });

  test("returns help args when -h flag is set", () => {
    const parsed = parseGlobalOptions(["-h"]);
    expect(parsed).toEqual({
      dictionaryPath: DEFAULT_DICTIONARY_PATH,
      statePath: DEFAULT_STATE_PATH,
      configPath: DEFAULT_CONFIG_PATH,
      args: ["--help"],
    });
  });

  test("returns error for unknown option", () => {
    const parsed = parseGlobalOptions(["--unknown"]);
    expect("error" in parsed).toBe(true);
  });
});

describe("extractOption", () => {
  test("extracts named option and keeps remaining args", () => {
    const extracted = extractOption(["--dictionary", "default", "term"], ["--dictionary"]);
    expect(extracted).toEqual({ value: "default", args: ["term"] });
  });

  test("extracts inline option value", () => {
    const extracted = extractOption(["--dictionary=default", "term"], ["--dictionary"]);
    expect(extracted).toEqual({ value: "default", args: ["term"] });
  });

  test("returns undefined when option missing", () => {
    const extracted = extractOption(["term"], ["--dictionary"]);
    expect(extracted).toEqual({ value: undefined, args: ["term"] });
  });
});
