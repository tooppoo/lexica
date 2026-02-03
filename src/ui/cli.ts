import { Result as Byethrow } from "@praha/byethrow";
import { createInterface } from "node:readline";
import { parseArgs } from "util";
import { parseDictionaryName } from "../core/dictionary";
import type { DictionaryCatalog, DictionaryName, Term, VocabularyData } from "../core/types";
import { defaultTestCount, parseTestCount, parseTestMode } from "../core/test-mode";
import { defaultExampleCount, parseExampleCount } from "../core/example-count";
import {
  FileVocabularyStorage,
  type StoredDictionary,
  type VocabularyStore,
} from "../application/storage";
import {
  addEntryMeanings,
  addEntryExample,
  clearDictionary,
  createDictionary,
  createState,
  generateExamples,
  listEntries,
  removeEntry,
  replaceEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
  switchDictionary,
  forgetEntry,
  rememberEntry,
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
      "  dictionary new <name> --source=<source> --target=<target>",
      "  dictionary switch <name>",
      "  dictionary clear -d <name>",
      "  add <term> <meaning[,meaning]>",
      "  remove <term> [meaning] -d <name>",
      "  examples <term> generate [--count <count>] (default: 3)",
      "  examples <term> add <example>",
      "  test meanings [count]",
      "  test examples [count]",
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

const splitMeanings = (input: string): string[] => input.split(",");

type CliError = AppError | { kind: "file-io"; reason: string };
type CliResult<T> = Byethrow.Result<T, CliError>;

const fail = (kind: "file-io" | "invalid-input", reason: string): CliResult<never> =>
  Byethrow.fail({ kind, reason });

type GlobalParseResult =
  | { error: string }
  | { dictionaryPath: string; statePath: string; configPath: string; args: string[] };

const parseGlobalOptions = (args: string[]): GlobalParseResult => {
  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        path: { type: "string", short: "p" },
        dictionary: { type: "string" },
        state: { type: "string" },
        config: { type: "string" },
        count: { type: "string", short: "c" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: true,
    });
    if (values.help) {
      return {
        dictionaryPath: DEFAULT_DICTIONARY_PATH,
        statePath: DEFAULT_STATE_PATH,
        configPath: DEFAULT_CONFIG_PATH,
        args: ["--help"],
      };
    }
    const dictionaryPath = values.dictionary ?? values.path ?? DEFAULT_DICTIONARY_PATH;
    const statePath = values.state ?? DEFAULT_STATE_PATH;
    const configPath = values.config ?? DEFAULT_CONFIG_PATH;
    const passthrough = values.count ? ["--count", values.count] : [];
    return {
      dictionaryPath,
      statePath,
      configPath,
      args: [...positionals, ...passthrough],
    } as const;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid arguments",
    } as const;
  }
};

const extractOption = (args: string[], names: string[]) => {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    const match = names.find((name) => arg === name || arg.startsWith(`${name}=`));
    if (match) {
      const inlineValue = arg.includes("=") ? arg.slice(match.length + 1) : undefined;
      if (inlineValue !== undefined) {
        value = inlineValue;
        continue;
      }
      value = args[i + 1];
      i += 1;
      continue;
    }
    rest.push(arg);
  }
  return { value, args: rest } as const;
};

const loadCurrentDictionary = async (
  path: string,
  dictionaries: DictionaryCatalog,
): Promise<CliResult<DictionaryName>> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    const available = Object.keys(dictionaries);
    if (available.length === 0) {
      return Byethrow.fail({ kind: "not-found", reason: "No dictionaries registered" });
    }
    return parseDictionaryName(available[0] ?? "");
  }
  try {
    const content = JSON.parse(await file.text());
    const name = content?.dictionaryName ?? content?.dictionaryKey;
    if (typeof name !== "string") {
      return fail("invalid-input", "Invalid state format");
    }
    const dictionaryName = parseDictionaryName(name);
    if (Byethrow.isFailure(dictionaryName)) {
      return dictionaryName;
    }
    if (!dictionaries[dictionaryName.value]) {
      return Byethrow.fail({ kind: "not-found", reason: "Dictionary not found" });
    }
    return dictionaryName;
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

const toDictionaryCatalog = (store: VocabularyStore): DictionaryCatalog =>
  Object.fromEntries(
    Object.entries(store.dictionaries).map(([name, dictionary]) => {
      if (!dictionary) {
        return [name, dictionary];
      }
      const dictionaryName = ensureSuccess(parseDictionaryName(name));
      return [dictionaryName, { name: dictionaryName, language: dictionary.language }];
    }),
  );

const toVocabularyData = (store: VocabularyStore): VocabularyData =>
  Object.fromEntries(
    Object.entries(store.dictionaries).map(([name, dictionary]) => [
      name,
      dictionary?.entries ?? [],
    ]),
  );

const toVocabularyStore = (
  dictionaries: DictionaryCatalog,
  vocabulary: VocabularyData,
): VocabularyStore => ({
  dictionaries: Object.fromEntries(
    Object.entries(dictionaries).map(([name, dictionary]) => [
      name,
      dictionary
        ? {
            language: dictionary.language,
            entries: vocabulary[name as DictionaryName] ?? [],
          }
        : dictionary,
    ]),
  ) as Record<string, StoredDictionary | undefined>,
});

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

  const store = ensureSuccess(await storage.load(dictionaryPath));
  const dictionaries = toDictionaryCatalog(store);
  const vocabulary = toVocabularyData(store);

  const [command, subcommand, ...rest] = args;

  if (command === "dictionary" && subcommand === "new") {
    const [name, ...optionArgs] = rest;
    if (!name) {
      printError({ kind: "invalid-input", reason: "Missing dictionary name" });
      process.exitCode = 1;
      return;
    }
    const source = extractOption(optionArgs, ["--source"]).value;
    const target = extractOption(optionArgs, ["--target"]).value;
    if (!source || !target) {
      printError({ kind: "invalid-input", reason: "Missing source/target" });
      process.exitCode = 1;
      return;
    }
    const fallbackName = Object.keys(dictionaries)[0] ?? name;
    const baseDictionary = ensureSuccess(parseDictionaryName(fallbackName));
    const state = createState(baseDictionary, dictionaries, vocabulary);
    const result = createDictionary(state, name, { source, target });
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({
      dictionary: result.value.dictionary.name,
      source: result.value.dictionary.language.source,
      target: result.value.dictionary.language.target,
      status: "created",
    });
    return;
  }

  const currentDictionary = ensureSuccess(await loadCurrentDictionary(statePath, dictionaries));
  const state = createState(currentDictionary, dictionaries, vocabulary);

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
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
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
    const meanings = splitMeanings(meaning);
    const result = addEntryMeanings(state, term, meanings);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
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
    const targetState = createState(target, state.dictionaries, state.vocabulary);
    const result = removeEntry(targetState, term, meaning);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
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
    const targetState = createState(target, state.dictionaries, state.vocabulary);
    const result = replaceEntry(targetState, term, meaningsInput);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
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
    if (!term || (action !== "generate" && action !== "add")) {
      printError({
        kind: "invalid-input",
        reason: "Usage: examples <term> generate [--count <count>] | examples <term> add <example>",
      });
      process.exitCode = 1;
      return;
    }
    if (action === "add") {
      const exampleInput = rest.slice(1).join(" ").trim();
      if (!exampleInput) {
        printError({ kind: "invalid-input", reason: "Missing example" });
        process.exitCode = 1;
        return;
      }
      const result = addEntryExample(state, term, exampleInput);
      if (Byethrow.isFailure(result)) {
        printError(result.error);
        process.exitCode = 1;
        return;
      }
      const saved = await storage.save(
        dictionaryPath,
        toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
      );
      if (Byethrow.isFailure(saved)) {
        printError(saved.error);
        process.exitCode = 1;
        return;
      }
      printJson({ dictionary: currentDictionary, entry: result.value.entry });
      return;
    }

    const countArgs = rest.slice(1);
    const countFlag = countArgs.some((arg) => arg === "-c" || arg === "--count");
    const extracted = extractOption(countArgs, ["-c", "--count"]);
    if (countFlag && !extracted.value) {
      printError({ kind: "invalid-input", reason: "Missing example count" });
      process.exitCode = 1;
      return;
    }
    const count = extracted.value
      ? ensureSuccess(parseExampleCount(extracted.value))
      : defaultExampleCount();
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
    const result = await generateExamples(state, term, meaning, generator, count);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(result.value.state.dictionaries, result.value.state.vocabulary),
    );
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: currentDictionary, entry: result.value.entry });
    return;
  }

  if (command === "test") {
    const [modeInput, countInput] = [subcommand, ...rest];
    if (!modeInput) {
      printError({ kind: "invalid-input", reason: "Missing test mode" });
      process.exitCode = 1;
      return;
    }
    const mode = ensureSuccess(parseTestMode(modeInput));
    const count = countInput ? ensureSuccess(parseTestCount(countInput)) : defaultTestCount();
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const question = (message: string): Promise<string> =>
      new Promise((resolve) => {
        rl.question(message, (answer) => resolve(answer));
      });

    const usedTerms = new Set<Term>();
    const usedExamples = new Set<string>();
    let asked = 0;
    let testState = state;
    const strategyByMode = {
      meanings: {
        select: () => selectMeaningTestEntry(testState, usedTerms),
        revealPrompt: "enter to show meanings",
        reveal: (selection: { entry: { meanings: string[] } }) => {
          console.log(`${selection.entry.meanings.join(", ")}`);
        },
        rememberPrompt: "Do you remember?(y/n) ",
        track: (selection: { entry: { term: Term } }) => usedTerms.add(selection.entry.term),
      },
      examples: {
        select: () => selectExampleTestEntry(testState, usedExamples),
        revealPrompt: "",
        reveal: (selection: { example?: string }) => {
          if (!selection.example) {
            return false;
          }
          console.log(`${selection.example}\n`);
          return true;
        },
        rememberPrompt: "Could you read it?(y/n) ",
        track: (selection: { example?: string }) => {
          if (selection.example) {
            usedExamples.add(selection.example);
          }
        },
      },
    } as const;
    const modeStrategy = strategyByMode[mode];

    while (asked < count) {
      const selection = modeStrategy.select();
      if (Byethrow.isFailure(selection)) {
        printError(selection.error);
        process.exitCode = 1;
        rl.close();
        return;
      }
      if (!selection.value) {
        break;
      }

      const { entry } = selection.value;
      console.log(`----------\n${entry.term}\n----------\n`);
      if (modeStrategy.revealPrompt.length > 0) {
        await question(modeStrategy.revealPrompt);
      }
      const revealed = modeStrategy.reveal(selection.value);
      if (revealed === false) {
        break;
      }
      await Bun.sleep(1000);

      const rememberPrompt = modeStrategy.rememberPrompt;
      let answer = await question(rememberPrompt);
      while (answer !== "y" && answer !== "n") {
        answer = await question(rememberPrompt);
      }
      console.log("\n");
      const updated =
        answer === "y" ? rememberEntry(testState, entry.term) : forgetEntry(testState, entry.term);
      if (Byethrow.isFailure(updated)) {
        printError(updated.error);
        process.exitCode = 1;
        rl.close();
        return;
      }
      testState = updated.value.state;
      asked += 1;
      modeStrategy.track(selection.value);
    }

    rl.close();
    const saved = await storage.save(
      dictionaryPath,
      toVocabularyStore(testState.dictionaries, testState.vocabulary),
    );
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: testState.dictionaryName, mode, asked, status: "tested" });
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
