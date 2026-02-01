import { Result as Byethrow } from "@praha/byethrow";
import { parseDictionary, parseDictionaryName, toDictionaryName } from "../core/dictionary";
import type { DictionaryName } from "../core/types";
import { FileVocabularyStorage } from "../application/storage";
import {
  addEntry,
  clearDictionary,
  createState,
  generateExamples,
  listEntries,
  removeEntry,
  replaceEntry,
  switchDictionary,
} from "../application/application";
import type { AppError } from "../application/application";
import { createCliExampleGenerator } from "./ai-cli";
import { readCliConfig } from "./cli-config";

const DEFAULT_DICTIONARY_PATH = "lexica.dictionary.json";
const DEFAULT_STATE_PATH = "lexica.state.json";
const DEFAULT_CONFIG_PATH = "lexica.config.json";

const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

const printError = (error: { kind: string; reason: string }): void => {
  printJson({ error });
};

const printHelp = (): void => {
  console.log(
    [
      "lexica - CLI reference",
      "",
      "Usage:",
      "  lexica [options] <command>",
      "",
      "Options:",
      "  -p, --path <path>          Dictionary data path (alias of --dictionary)",
      "  --dictionary <path>        Dictionary data path",
      "  --state <path>             State file path",
      "  --config <path>            Config file path",
      "  -h, --help                 Show this help",
      "",
      "Commands:",
      "  dictionary switch <name>",
      "  dictionary clear -d <name>",
      "  add <term> <meaning>",
      "  remove <term> [meaning] -d <name>",
      "  examples <term> generate",
      "  ls [term]",
      "  replace <term> <meaning...> -d <name>",
      "",
      "Defaults:",
      `  Dictionary: ${DEFAULT_DICTIONARY_PATH}`,
      `  State: ${DEFAULT_STATE_PATH}`,
      `  Config: ${DEFAULT_CONFIG_PATH}`,
    ].join("\n"),
  );
};

type CliError = AppError | { kind: "file-io"; reason: string };
type CliResult<T> = Byethrow.Result<T, CliError>;

const fail = (kind: "file-io" | "invalid-input", reason: string): CliResult<never> =>
  Byethrow.fail({ kind, reason });

type GlobalParseResult =
  | { error: string }
  | { dictionaryPath: string; statePath: string; configPath: string; args: string[] };

const parseGlobalOptions = (args: string[]): GlobalParseResult => {
  let dictionaryPath = DEFAULT_DICTIONARY_PATH;
  let statePath = DEFAULT_STATE_PATH;
  let configPath = DEFAULT_CONFIG_PATH;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === "-p" || arg === "--path" || arg === "--dictionary") {
      const next = args[i + 1];
      if (!next) {
        return { error: "Missing dictionary path" } as const;
      }
      dictionaryPath = next;
      i += 1;
      continue;
    }
    if (arg === "--state") {
      const next = args[i + 1];
      if (!next) {
        return { error: "Missing state path" } as const;
      }
      statePath = next;
      i += 1;
      continue;
    }
    if (arg === "--config") {
      const next = args[i + 1];
      if (!next) {
        return { error: "Missing config path" } as const;
      }
      configPath = next;
      i += 1;
      continue;
    }
    rest.push(arg);
  }
  return { dictionaryPath, statePath, configPath, args: rest } as const;
};

const extractOption = (args: string[], names: string[]) => {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (names.includes(arg)) {
      value = args[i + 1];
      i += 1;
      continue;
    }
    rest.push(arg);
  }
  return { value, args: rest } as const;
};

const loadCurrentDictionary = async (path: string): Promise<CliResult<DictionaryName>> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    const dictionary = parseDictionary("default");
    if (Byethrow.isFailure(dictionary)) {
      return dictionary;
    }
    return Byethrow.succeed(toDictionaryName(dictionary.value));
  }
  try {
    const content = JSON.parse(await file.text());
    const name = content?.dictionaryName ?? content?.dictionaryKey;
    if (typeof name !== "string") {
      return fail("invalid-input", "Invalid state format");
    }
    return parseDictionaryName(name);
  } catch (error) {
    return fail("file-io", error instanceof Error ? error.message : "Failed to read state");
  }
};

const saveCurrentDictionary = async (
  path: string,
  dictionaryName: DictionaryName,
): Promise<CliResult<void>> => {
  try {
    await Bun.write(path, JSON.stringify({ dictionaryName }, null, 2));
    return Byethrow.succeed(undefined);
  } catch (error) {
    return fail("file-io", error instanceof Error ? error.message : "Failed to write state");
  }
};

const ensureSuccess = <T>(result: Byethrow.Result<T, { kind: string; reason: string }>): T => {
  if (Byethrow.isFailure(result)) {
    printError(result.error);
    process.exitCode = 1;
    throw new Error("exit");
  }
  return result.value;
};

const run = async (): Promise<void> => {
  const parsed = parseGlobalOptions(process.argv.slice(2));
  if ("error" in parsed) {
    printError({ kind: "invalid-input", reason: parsed.error });
    process.exitCode = 1;
    return;
  }

  const { dictionaryPath, statePath, configPath, args } = parsed;
  void configPath;
  const storage = new FileVocabularyStorage();

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return;
  }

  const vocabulary = ensureSuccess(await storage.load(dictionaryPath));
  const currentDictionary = ensureSuccess(await loadCurrentDictionary(statePath));
  const state = createState(currentDictionary, vocabulary);

  const [command, subcommand, ...rest] = args;

  if (command === "dictionary" && subcommand === "switch") {
    const [name] = rest;
    if (!name) {
      printError({ kind: "invalid-input", reason: "Missing dictionary name" });
      process.exitCode = 1;
      return;
    }
    const result = switchDictionary(state, name);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await saveCurrentDictionary(statePath, result.value.dictionaryName);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: result.value.dictionaryName, status: "switched" });
    return;
  }

  if (command === "dictionary" && subcommand === "clear") {
    const extracted = extractOption(rest, ["-d", "--dictionary"]);
    if (!extracted.value) {
      printError({ kind: "invalid-input", reason: "Missing dictionary" });
      process.exitCode = 1;
      return;
    }
    const target = ensureSuccess(parseDictionaryName(extracted.value));
    const result = clearDictionary(state, extracted.value);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, targetDictionary: target, status: "cleared" });
    return;
  }

  if (command === "add") {
    const [term, meaning] = [subcommand, rest[0]];
    if (!term || !meaning) {
      printError({ kind: "invalid-input", reason: "Missing term/meaning" });
      process.exitCode = 1;
      return;
    }
    const result = addEntry(state, term, meaning);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, entry: result.value.entry });
    return;
  }

  if (command === "remove") {
    const extracted = extractOption([subcommand ?? "", ...rest], ["-d", "--dictionary"]);
    if (!extracted.value) {
      printError({ kind: "invalid-input", reason: "Missing dictionary" });
      process.exitCode = 1;
      return;
    }
    const target = ensureSuccess(parseDictionaryName(extracted.value));
    const [term, meaning] = extracted.args;
    if (!term) {
      printError({ kind: "invalid-input", reason: "Missing term" });
      process.exitCode = 1;
      return;
    }
    const targetState = createState(target, state.vocabulary);
    const result = removeEntry(targetState, term, meaning);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, targetDictionary: target, status: "removed" });
    return;
  }

  if (command === "ls") {
    const term = subcommand;
    const result = listEntries(state, term);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, entries: result.value.entries });
    return;
  }

  if (command === "replace") {
    const extracted = extractOption([subcommand ?? "", ...rest], ["-d", "--dictionary"]);
    if (!extracted.value) {
      printError({ kind: "invalid-input", reason: "Missing dictionary" });
      process.exitCode = 1;
      return;
    }
    const target = ensureSuccess(parseDictionaryName(extracted.value));
    const [term, ...meaningsInput] = extracted.args;
    if (!term || meaningsInput.length === 0) {
      printError({ kind: "invalid-input", reason: "Missing term/meanings" });
      process.exitCode = 1;
      return;
    }
    const targetState = createState(target, state.vocabulary);
    const result = replaceEntry(targetState, term, meaningsInput);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({
      dictionary: currentDictionary,
      targetDictionary: target,
      entry: result.value.entry,
    });
    return;
  }

  if (command === "examples") {
    const term = subcommand;
    const action = rest[0];
    if (!term || action !== "generate") {
      printError({ kind: "invalid-input", reason: "Usage: examples <term> generate" });
      process.exitCode = 1;
      return;
    }
    const config = ensureSuccess(await readCliConfig(configPath));
    const generator = createCliExampleGenerator(config);
    const currentEntry = listEntries(state, term);
    if (Byethrow.isFailure(currentEntry)) {
      printError(currentEntry.error);
      process.exitCode = 1;
      return;
    }
    if (Array.isArray(currentEntry.value.entries)) {
      printError({ kind: "invalid-input", reason: "Expected a single entry" });
      process.exitCode = 1;
      return;
    }
    const entry = currentEntry.value.entries;
    const meaning = entry.meanings[0];
    if (!meaning) {
      printError({ kind: "invalid-input", reason: "Entry has no meanings" });
      process.exitCode = 1;
      return;
    }
    const result = await generateExamples(state, term, meaning, generator);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, entry: result.value.entry });
    return;
  }

  printError({ kind: "invalid-input", reason: "Unknown command" });
  process.exitCode = 1;
};

run().catch((error) => {
  if (error instanceof Error && error.message === "exit") {
    return;
  }
  printError({ kind: "file-io", reason: "Unexpected error" });
  process.exitCode = 1;
});
