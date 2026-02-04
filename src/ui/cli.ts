import { Result as Byethrow } from "@praha/byethrow";
import { createInterface } from "node:readline";
import { parseDictionaryName } from "../core/dictionary";
import type { DictionaryName, Term } from "../core/types";
import { defaultTestCount, parseTestCount, parseTestMode } from "../core/test-mode";
import { defaultExampleCount, parseExampleCount } from "../core/example-count";
import { FileVocabularyStorage } from "../application/storage";
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
  forgetEntry,
  rememberEntry,
} from "../application/application";
import { createCliExampleGenerator } from "./ai-cli";
import { readCliConfig } from "./cli-config";
import { printError, printHelp, printJson } from "./print";
import { extractOption, parseGlobalOptions } from "./option";
import { failFileIO, failInvalidInput, type CoreError } from "../core/result";

type CliResult<T> = Byethrow.Result<T, CoreError>;

const listDictionaryNames = async (
  dictionaryPath: string,
): Promise<CliResult<DictionaryName[]>> => {
  try {
    const directory = Bun.file(dictionaryPath);
    if (!(await directory.exists())) {
      return Byethrow.succeed([]);
    }
    const names: DictionaryName[] = [];
    const glob = new Bun.Glob("*.json");
    for await (const filePath of glob.scan({ cwd: dictionaryPath })) {
      const fileName = filePath.split("/").pop() ?? filePath;
      const dictionaryNameInput = fileName.replace(/\.json$/, "");
      const parsed = parseDictionaryName(dictionaryNameInput);
      if (Byethrow.isFailure(parsed)) {
        return failInvalidInput("Invalid dictionary name");
      }
      names.push(parsed.value);
    }
    return Byethrow.succeed(names);
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to read dictionaries");
  }
};

const dictionaryExists = async (
  dictionaryPath: string,
  dictionaryName: DictionaryName,
): Promise<boolean> => {
  const file = Bun.file(`${dictionaryPath}/${dictionaryName}.json`);
  return file.exists();
};

const loadCurrentDictionary = async (
  statePath: string,
  dictionaryPath: string,
): Promise<CliResult<DictionaryName>> => {
  const file = Bun.file(statePath);
  if (!(await file.exists())) {
    const available = ensureSuccess(await listDictionaryNames(dictionaryPath));
    if (available.length === 0) {
      return Byethrow.fail({ kind: "not-found", reason: "No dictionaries registered" });
    }
    const first = available[0];
    if (!first) {
      return Byethrow.fail({ kind: "not-found", reason: "No dictionaries registered" });
    }
    return Byethrow.succeed(first);
  }
  try {
    const content = JSON.parse(await file.text());
    const name = content?.dictionaryName ?? content?.dictionaryKey;
    if (typeof name !== "string") {
      return failInvalidInput("Invalid state format");
    }
    const dictionaryName = parseDictionaryName(name);
    if (Byethrow.isFailure(dictionaryName)) {
      return dictionaryName;
    }
    if (!(await dictionaryExists(dictionaryPath, dictionaryName.value))) {
      return Byethrow.fail({ kind: "not-found", reason: "Dictionary not found" });
    }
    return dictionaryName;
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to read state");
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
    return failFileIO(error instanceof Error ? error.message : "Failed to write state");
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

const DEFAULT_CONFIG = {
  ai: {
    provider: "codex",
  },
} as const;

const initWorkspace = async (
  dictionaryPath: string,
  configPath: string,
  statePath: string,
): Promise<CliResult<void>> => {
  try {
    await Bun.$`mkdir -p ${dictionaryPath}`;
    const stateDir = statePath.split("/").slice(0, -1).join("/") || ".";
    await Bun.$`mkdir -p ${stateDir}`;
    const configFile = Bun.file(configPath);
    if (!(await configFile.exists())) {
      await Bun.write(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
    const stateFile = Bun.file(statePath);
    if (!(await stateFile.exists())) {
      await Bun.write(statePath, JSON.stringify({ dictionaryName: "" }, null, 2));
    }
    return Byethrow.succeed(undefined);
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to initialize workspace");
  }
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

  const [command, subcommand, ...rest] = args;
  if (command === "init") {
    const initialized = await initWorkspace(dictionaryPath, configPath, statePath);
    if (Byethrow.isFailure(initialized)) {
      printError(initialized.error);
      process.exitCode = 1;
      return;
    }
    printJson({
      directory: dictionaryPath,
      config: configPath,
      state: statePath,
      status: "initialized",
    });
    return;
  }

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
    const parsedName = ensureSuccess(parseDictionaryName(name));
    if (await dictionaryExists(dictionaryPath, parsedName)) {
      printError({ kind: "conflict", reason: "Dictionary already exists" });
      process.exitCode = 1;
      return;
    }
    const result = createDictionary(name, { source, target });
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, {
      dictionary: result.value.dictionary,
      entries: [],
    });
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

  const currentDictionary = ensureSuccess(await loadCurrentDictionary(statePath, dictionaryPath));
  const currentStore = ensureSuccess(await storage.load(dictionaryPath, currentDictionary));
  const state = createState(currentStore.dictionary, currentStore.entries);

  if (command === "dictionary" && subcommand === "switch") {
    const [name] = rest;
    if (!name) {
      printError({ kind: "invalid-input", reason: "Missing dictionary name" });
      process.exitCode = 1;
      return;
    }
    const parsedName = parseDictionaryName(name);
    if (Byethrow.isFailure(parsedName)) {
      printError(parsedName.error);
      process.exitCode = 1;
      return;
    }
    if (!(await dictionaryExists(dictionaryPath, parsedName.value))) {
      printError({ kind: "not-found", reason: "Dictionary not found" });
      process.exitCode = 1;
      return;
    }
    const saved = await saveCurrentDictionary(statePath, parsedName.value);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: parsedName.value, status: "switched" });
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
    if (!(await dictionaryExists(dictionaryPath, target))) {
      printError({ kind: "not-found", reason: "Dictionary not found" });
      process.exitCode = 1;
      return;
    }
    const targetStore = ensureSuccess(await storage.load(dictionaryPath, target));
    const targetState = createState(targetStore.dictionary, targetStore.entries);
    const result = clearDictionary(targetState, extracted.value);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state);
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
    const meanings = meaning.split(",");
    const result = addEntryMeanings(state, term, meanings);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state);
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
    if (!(await dictionaryExists(dictionaryPath, target))) {
      printError({ kind: "not-found", reason: "Dictionary not found" });
      process.exitCode = 1;
      return;
    }
    const [term, meaning] = extracted.args;
    if (!term) {
      printError({ kind: "invalid-input", reason: "Missing term" });
      process.exitCode = 1;
      return;
    }
    const targetStore = ensureSuccess(await storage.load(dictionaryPath, target));
    const targetState = createState(targetStore.dictionary, targetStore.entries);
    const result = removeEntry(targetState, term, meaning);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state);
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
    if (!(await dictionaryExists(dictionaryPath, target))) {
      printError({ kind: "not-found", reason: "Dictionary not found" });
      process.exitCode = 1;
      return;
    }
    const [term, ...meaningsInput] = extracted.args;
    if (!term || meaningsInput.length === 0) {
      printError({ kind: "invalid-input", reason: "Missing term/meanings" });
      process.exitCode = 1;
      return;
    }
    const targetStore = ensureSuccess(await storage.load(dictionaryPath, target));
    const targetState = createState(targetStore.dictionary, targetStore.entries);
    const result = replaceEntry(targetState, term, meaningsInput);
    if (Byethrow.isFailure(result)) {
      printError(result.error);
      process.exitCode = 1;
      return;
    }
    const saved = await storage.save(dictionaryPath, result.value.state);
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
      const saved = await storage.save(dictionaryPath, result.value.state);
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
    const saved = await storage.save(dictionaryPath, result.value.state);
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
    const saved = await storage.save(dictionaryPath, testState);
    if (Byethrow.isFailure(saved)) {
      printError(saved.error);
      process.exitCode = 1;
      return;
    }
    printJson({ dictionary: testState.dictionary.name, mode, asked, status: "tested" });
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
