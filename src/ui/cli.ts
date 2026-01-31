import { Result as Byethrow } from "@praha/byethrow";
import { parseDictionary, parseDictionaryKey, toDictionaryKey } from "../core/dictionary";
import type { DictionaryKey } from "../core/types";
import { FileVocabularyStorage } from "../application/storage";
import {
  addEntry,
  clearDictionary,
  createState,
  listEntries,
  removeEntry,
  replaceEntry,
  switchDictionary,
} from "../application/application";
import type { AppError } from "../application/application";

const DEFAULT_VOCAB_PATH = "lexica.json";

const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

const printError = (error: { kind: string; reason: string }): void => {
  printJson({ error });
};

type CliError = AppError | { kind: "file-io"; reason: string };
type CliResult<T> = Byethrow.Result<T, CliError>;

const fail = (kind: "file-io" | "invalid-input", reason: string): CliResult<never> =>
  Byethrow.fail({ kind, reason });

const parseGlobalOptions = (args: string[]) => {
  let path = DEFAULT_VOCAB_PATH;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-p" || arg === "--path") {
      const next = args[i + 1];
      if (!next) {
        return { error: "Missing path" } as const;
      }
      path = next;
      i += 1;
      continue;
    }
    rest.push(arg);
  }
  return { path, args: rest } as const;
};

const extractOption = (args: string[], names: string[]) => {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (names.includes(arg)) {
      value = args[i + 1];
      i += 1;
      continue;
    }
    rest.push(arg);
  }
  return { value, args: rest } as const;
};

const statePathFor = (vocabPath: string): string =>
  vocabPath.endsWith(".json") ? vocabPath.replace(/\.json$/, ".state.json") : `${vocabPath}.state.json`;

const loadCurrentDictionary = (path: string): CliResult<DictionaryKey> => {
  const file = Bun.file(path);
  if (!file.exists()) {
    const dictionary = parseDictionary("en", "ja");
    if (Byethrow.isFailure(dictionary)) {
      return dictionary;
    }
    return Byethrow.succeed(toDictionaryKey(dictionary.value));
  }
  try {
    const content = JSON.parse(file.textSync());
    const key = content?.dictionaryKey;
    if (typeof key !== "string") {
      return fail("invalid-input", "Invalid state format");
    }
    return parseDictionaryKey(key);
  } catch (error) {
    return fail("file-io", error instanceof Error ? error.message : "Failed to read state");
  }
};

const saveCurrentDictionary = (path: string, dictionaryKey: DictionaryKey): CliResult<void> => {
  try {
    Bun.write(path, JSON.stringify({ dictionaryKey }, null, 2));
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

const run = (): void => {
  const parsed = parseGlobalOptions(process.argv.slice(2));
  if ("error" in parsed) {
    printError({ kind: "invalid-input", reason: parsed.error });
    process.exitCode = 1;
    return;
  }

  const { path, args } = parsed;
  const storage = new FileVocabularyStorage();
  const statePath = statePathFor(path);

  const vocabulary = ensureSuccess(storage.load(path));
  const currentDictionary = ensureSuccess(loadCurrentDictionary(statePath));
  const state = createState(currentDictionary, vocabulary);

  if (args.length === 0) {
    printError({ kind: "invalid-input", reason: "Missing command" });
    process.exitCode = 1;
    return;
  }

  const [command, subcommand, ...rest] = args;

  if (command === "dictionary" && subcommand === "switch") {
    const [source, target] = rest;
    if (!source || !target) {
      printError({ kind: "invalid-input", reason: "Missing source/target" });
      process.exitCode = 1;
      return;
    }
    const result = switchDictionary(state, source, target);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = saveCurrentDictionary(statePath, result.value.dictionaryKey);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: result.value.dictionaryKey, status: "switched" });
    return;
  }

  if (command === "dictionary" && subcommand === "clear") {
    const extracted = extractOption(rest, ["-d", "--dictionary"]);
    if (!extracted.value) {
      printError({ kind: "invalid-input", reason: "Missing dictionary" });
      process.exitCode = 1;
      return;
    }
    const target = ensureSuccess(parseDictionaryKey(extracted.value));
    const result = clearDictionary(state, extracted.value);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = storage.save(path, result.value.state.vocabulary);
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
    const saved = storage.save(path, result.value.state.vocabulary);
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
    const target = ensureSuccess(parseDictionaryKey(extracted.value));
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
    const saved = storage.save(path, result.value.state.vocabulary);
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
    const target = ensureSuccess(parseDictionaryKey(extracted.value));
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
    const saved = storage.save(path, result.value.state.vocabulary);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, targetDictionary: target, entry: result.value.entry });
    return;
  }

  printError({ kind: "invalid-input", reason: "Unknown command" });
  process.exitCode = 1;
};

try {
  run();
} catch (error) {
  if (error instanceof Error && error.message === "exit") {
    // handled
  } else {
    printError({ kind: "file-io", reason: "Unexpected error" });
    process.exitCode = 1;
  }
}
