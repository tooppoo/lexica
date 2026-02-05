import type { AppState, DictionaryName } from "../core/types";
import { parseDictionaryName } from "../core/dictionary";
import { defaultExampleCount, parseExampleCount } from "../core/example";
import { defaultTestCount, parseTestCount, parseTestMode } from "../core/test-mode";
import {
  addEntryExample,
  addEntryMeanings,
  clearDictionary,
  createDictionary,
  createState,
  generateExamples,
  listEntry,
  listEntryExamples,
  listEntryMeanings,
  listEntries,
  removeEntry,
  replaceEntry,
} from "../application/application";
import {
  failConflict,
  failFileIO,
  failInvalidInput,
  failNotFound,
  succeed,
  type Result,
} from "../core/result";
import type { Command } from "./cli-command";
import type { CliContext } from "./cli-context";
import { runTestSession } from "./cli-test-session";

const DEFAULT_CONFIG = {
  ai: {
    provider: "codex",
  },
} as const;

export type HandlerOutput =
  | { kind: "json"; payload: unknown }
  | { kind: "help" }
  | { kind: "none" };

/**
 * Dispatches a parsed command to the appropriate handler.
 */
export const handleCommand = async (
  command: Command,
  context: CliContext,
): Promise<Result<HandlerOutput>> => {
  switch (command.kind) {
    case "help":
      return succeed({ kind: "help" });
    case "init":
      return handleInit(context);
    case "dictionary.new":
      return handleDictionaryNew(context, command);
    case "dictionary.switch":
      return handleDictionarySwitch(context, command);
    case "dictionary.clear":
      return handleDictionaryClear(context, command);
    case "add":
      return handleAdd(context, command);
    case "remove":
      return handleRemove(context, command);
    case "list":
      return handleList(context, command);
    case "list.meanings":
      return handleListMeanings(context, command);
    case "list.examples":
      return handleListExamples(context, command);
    case "replace":
      return handleReplace(context, command);
    case "examples.add":
      return handleExamplesAdd(context, command);
    case "examples.generate":
      return handleExamplesGenerate(context, command);
    case "test":
      return handleTest(context, command);
    default:
      return failInvalidInput("Unknown command");
  }
};

/**
 * Initializes the workspace directories and default config/state files.
 */
export const handleInit = async (context: CliContext): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath, statePath, configPath } = context.paths;
  const initialized = await initWorkspace(context, dictionaryPath, configPath, statePath);
  if (initialized.type === "Failure") {
    return initialized;
  }
  return succeed({
    kind: "json",
    payload: {
      directory: dictionaryPath,
      config: configPath,
      state: statePath,
      status: "initialized",
    },
  });
};

/**
 * Handles the dictionary creation command.
 */
export const handleDictionaryNew = async (
  context: CliContext,
  command: { kind: "dictionary.new"; name: string; source: string; target: string },
): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath } = context.paths;
  const parsedName = parseDictionaryName(command.name);
  if (parsedName.type === "Failure") {
    return parsedName;
  }
  if (await dictionaryExists(context, dictionaryPath, parsedName.value)) {
    return failConflict("Dictionary already exists");
  }
  const result = createDictionary(command.name, {
    source: command.source,
    target: command.target,
  });
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(dictionaryPath, {
    dictionary: result.value.dictionary,
    entries: [],
  });
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: result.value.dictionary.name,
      source: result.value.dictionary.language.source,
      target: result.value.dictionary.language.target,
      status: "created",
    },
  });
};

/**
 * Switches the current dictionary in the state file.
 */
export const handleDictionarySwitch = async (
  context: CliContext,
  command: { kind: "dictionary.switch"; name: string },
): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath, statePath } = context.paths;
  const parsedName = parseDictionaryName(command.name);
  if (parsedName.type === "Failure") {
    return parsedName;
  }
  if (!(await dictionaryExists(context, dictionaryPath, parsedName.value))) {
    return failNotFound("Dictionary not found");
  }
  const saved = await saveCurrentDictionary(context, statePath, parsedName.value);
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({ kind: "json", payload: { dictionary: parsedName.value, status: "switched" } });
};

/**
 * Clears entries for a specified dictionary.
 */
export const handleDictionaryClear = async (
  context: CliContext,
  command: { kind: "dictionary.clear"; dictionary: string },
): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath } = context.paths;
  const currentDictionary = await loadCurrentDictionary(
    context,
    context.paths.statePath,
    dictionaryPath,
  );
  if (currentDictionary.type === "Failure") {
    return currentDictionary;
  }
  const target = parseDictionaryName(command.dictionary);
  if (target.type === "Failure") {
    return target;
  }
  if (!(await dictionaryExists(context, dictionaryPath, target.value))) {
    return failNotFound("Dictionary not found");
  }
  const targetStore = await context.services.storage.load(dictionaryPath, target.value);
  if (targetStore.type === "Failure") {
    return targetStore;
  }
  const targetState = createState(targetStore.value.dictionary, targetStore.value.entries);
  const result = clearDictionary(targetState, command.dictionary);
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(dictionaryPath, result.value.state);
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: currentDictionary.value,
      targetDictionary: target.value,
      status: "cleared",
    },
  });
};

/**
 * Adds an entry to the current dictionary.
 */
export const handleAdd = async (
  context: CliContext,
  command: { kind: "add"; term: string; meanings: string[] },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const result = addEntryMeanings(loaded.value.state, command.term, command.meanings);
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(
    context.paths.dictionaryPath,
    result.value.state,
  );
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: { dictionary: loaded.value.currentDictionary, entry: result.value.entry },
  });
};

/**
 * Removes an entry or meaning from a dictionary.
 */
export const handleRemove = async (
  context: CliContext,
  command: { kind: "remove"; dictionary: string; term: string; meaning?: string },
): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath } = context.paths;
  const currentDictionary = await loadCurrentDictionary(
    context,
    context.paths.statePath,
    dictionaryPath,
  );
  if (currentDictionary.type === "Failure") {
    return currentDictionary;
  }
  const target = parseDictionaryName(command.dictionary);
  if (target.type === "Failure") {
    return target;
  }
  if (!(await dictionaryExists(context, dictionaryPath, target.value))) {
    return failNotFound("Dictionary not found");
  }
  const targetStore = await context.services.storage.load(dictionaryPath, target.value);
  if (targetStore.type === "Failure") {
    return targetStore;
  }
  const targetState = createState(targetStore.value.dictionary, targetStore.value.entries);
  const result = removeEntry(targetState, command.term, command.meaning);
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(dictionaryPath, result.value.state);
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: currentDictionary.value,
      targetDictionary: target.value,
      status: "removed",
    },
  });
};

/**
 * Lists entries for the current dictionary.
 */
export const handleList = async (
  context: CliContext,
  command: { kind: "list"; term?: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const result = command.term
    ? listEntry(loaded.value.state, command.term)
    : listEntries(loaded.value.state);
  if (result.type === "Failure") {
    return result;
  }
  return succeed({
    kind: "json",
    payload: { dictionary: loaded.value.currentDictionary, entries: result.value },
  });
};

/**
 * Lists meanings for a specific entry in the current dictionary.
 */
export const handleListMeanings = async (
  context: CliContext,
  command: { kind: "list.meanings"; term: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const result = listEntryMeanings(loaded.value.state, command.term);
  if (result.type === "Failure") {
    return result;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: loaded.value.currentDictionary,
      term: command.term,
      meanings: result.value.meanings,
    },
  });
};

/**
 * Lists examples for a specific entry in the current dictionary.
 */
export const handleListExamples = async (
  context: CliContext,
  command: { kind: "list.examples"; term: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const result = listEntryExamples(loaded.value.state, command.term);
  if (result.type === "Failure") {
    return result;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: loaded.value.currentDictionary,
      term: command.term,
      examples: result.value.examples,
    },
  });
};

/**
 * Replaces an entry in the given dictionary.
 */
export const handleReplace = async (
  context: CliContext,
  command: { kind: "replace"; dictionary: string; term: string; meanings: string[] },
): Promise<Result<HandlerOutput>> => {
  const { dictionaryPath } = context.paths;
  const currentDictionary = await loadCurrentDictionary(
    context,
    context.paths.statePath,
    dictionaryPath,
  );
  if (currentDictionary.type === "Failure") {
    return currentDictionary;
  }
  const target = parseDictionaryName(command.dictionary);
  if (target.type === "Failure") {
    return target;
  }
  if (!(await dictionaryExists(context, dictionaryPath, target.value))) {
    return failNotFound("Dictionary not found");
  }
  const targetStore = await context.services.storage.load(dictionaryPath, target.value);
  if (targetStore.type === "Failure") {
    return targetStore;
  }
  const targetState = createState(targetStore.value.dictionary, targetStore.value.entries);
  const result = replaceEntry(targetState, command.term, command.meanings);
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(dictionaryPath, result.value.state);
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: currentDictionary.value,
      targetDictionary: target.value,
      entry: result.value.entry,
    },
  });
};

/**
 * Adds a manual example to an entry.
 */
export const handleExamplesAdd = async (
  context: CliContext,
  command: { kind: "examples.add"; term: string; example: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const result = addEntryExample(loaded.value.state, command.term, command.example);
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(
    context.paths.dictionaryPath,
    result.value.state,
  );
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: { dictionary: loaded.value.currentDictionary, entry: result.value.entry },
  });
};

/**
 * Generates examples for an entry using the configured AI provider.
 */
export const handleExamplesGenerate = async (
  context: CliContext,
  command: { kind: "examples.generate"; term: string; countInput?: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const count = command.countInput
    ? parseExampleCount(command.countInput)
    : succeed(defaultExampleCount());
  if (count.type === "Failure") {
    return count;
  }
  const config = await context.services.readConfig(context.paths.configPath);
  if (config.type === "Failure") {
    return config;
  }
  const generator = context.services.createExampleGenerator(config.value);
  const currentEntry = listEntry(loaded.value.state, command.term);
  if (currentEntry.type === "Failure") {
    return currentEntry;
  }
  const entry = currentEntry.value.entry;
  const meaning = entry.meanings[0];
  if (!meaning) {
    return failInvalidInput("Entry has no meanings");
  }
  const result = await generateExamples(
    loaded.value.state,
    command.term,
    meaning,
    generator,
    count.value,
  );
  if (result.type === "Failure") {
    return result;
  }
  const saved = await context.services.storage.save(
    context.paths.dictionaryPath,
    result.value.state,
  );
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: { dictionary: loaded.value.currentDictionary, entry: result.value.entry },
  });
};

/**
 * Runs an interactive test session.
 */
export const handleTest = async (
  context: CliContext,
  command: { kind: "test"; modeInput: string; countInput?: string },
): Promise<Result<HandlerOutput>> => {
  const loaded = await loadCurrentState(context);
  if (loaded.type === "Failure") {
    return loaded;
  }
  const mode = parseTestMode(command.modeInput);
  if (mode.type === "Failure") {
    return mode;
  }
  const count = command.countInput
    ? parseTestCount(command.countInput)
    : succeed(defaultTestCount());
  if (count.type === "Failure") {
    return count;
  }
  const session = context.createTestSession();
  const run = await runTestSession(
    loaded.value.state,
    mode.value,
    count.value,
    { log: context.output.log },
    session,
    context.io.sleep,
  );
  if (run.type === "Failure") {
    return run;
  }
  const saved = await context.services.storage.save(context.paths.dictionaryPath, run.value.state);
  if (saved.type === "Failure") {
    return saved;
  }
  return succeed({
    kind: "json",
    payload: {
      dictionary: run.value.state.dictionary.name,
      mode: mode.value,
      asked: run.value.asked,
      status: "tested",
    },
  });
};

const listDictionaryNames = async (
  context: CliContext,
  dictionaryPath: string,
): Promise<Result<DictionaryName[]>> => {
  try {
    if (!(await context.io.exists(dictionaryPath))) {
      return succeed([] as DictionaryName[]);
    }
    const names: DictionaryName[] = [];
    for await (const filePath of context.io.glob("*.json", dictionaryPath)) {
      const fileName = filePath.split("/").pop() ?? filePath;
      const dictionaryNameInput = fileName.replace(/\.json$/, "");
      const parsed = parseDictionaryName(dictionaryNameInput);
      if (parsed.type === "Failure") {
        return failInvalidInput("Invalid dictionary name");
      }
      names.push(parsed.value);
    }
    return succeed(names);
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to read dictionaries");
  }
};

const dictionaryExists = async (
  context: CliContext,
  dictionaryPath: string,
  dictionaryName: DictionaryName,
): Promise<boolean> => {
  return context.io.exists(`${dictionaryPath}/${dictionaryName}.json`);
};

const loadCurrentDictionary = async (
  context: CliContext,
  statePath: string,
  dictionaryPath: string,
): Promise<Result<DictionaryName>> => {
  if (!(await context.io.exists(statePath))) {
    const available = await listDictionaryNames(context, dictionaryPath);
    if (available.type === "Failure") {
      return available;
    }
    if (available.value.length === 0) {
      return failNotFound("No dictionaries registered");
    }
    const first = available.value[0];
    if (!first) {
      return failNotFound("No dictionaries registered");
    }
    return succeed(first);
  }
  try {
    const content = JSON.parse(await context.io.readText(statePath));
    const name = content?.dictionaryName ?? content?.dictionaryKey;
    if (typeof name !== "string") {
      return failInvalidInput("Invalid state format");
    }
    const dictionaryName = parseDictionaryName(name);
    if (dictionaryName.type === "Failure") {
      return dictionaryName;
    }
    if (!(await dictionaryExists(context, dictionaryPath, dictionaryName.value))) {
      return failNotFound("Dictionary not found");
    }
    return dictionaryName;
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to read state");
  }
};

const saveCurrentDictionary = async (
  context: CliContext,
  path: string,
  dictionaryName: DictionaryName,
): Promise<Result<void>> => {
  try {
    await context.io.writeText(path, JSON.stringify({ dictionaryName }, null, 2));
    return succeed(undefined);
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to write state");
  }
};

const initWorkspace = async (
  context: CliContext,
  dictionaryPath: string,
  configPath: string,
  statePath: string,
): Promise<Result<void>> => {
  try {
    await context.io.mkdirp(dictionaryPath);
    const stateDir = statePath.split("/").slice(0, -1).join("/") || ".";
    await context.io.mkdirp(stateDir);
    if (!(await context.io.exists(configPath))) {
      await context.io.writeText(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
    if (!(await context.io.exists(statePath))) {
      await context.io.writeText(statePath, JSON.stringify({ dictionaryName: "" }, null, 2));
    }
    return succeed(undefined);
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to initialize workspace");
  }
};

const loadCurrentState = async (
  context: CliContext,
): Promise<Result<{ currentDictionary: DictionaryName; state: AppState }>> => {
  const currentDictionary = await loadCurrentDictionary(
    context,
    context.paths.statePath,
    context.paths.dictionaryPath,
  );
  if (currentDictionary.type === "Failure") {
    return currentDictionary;
  }
  const currentStore = await context.services.storage.load(
    context.paths.dictionaryPath,
    currentDictionary.value,
  );
  if (currentStore.type === "Failure") {
    return currentStore;
  }
  return succeed({
    currentDictionary: currentDictionary.value,
    state: createState(currentStore.value.dictionary, currentStore.value.entries),
  });
};
