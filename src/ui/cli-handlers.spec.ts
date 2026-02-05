import { describe, expect, test } from "bun:test";
import { MemoryVocabularyStorage } from "../application/storage";
import { parseDictionary } from "../core/dictionary";
import { createEntry, parseMeanings, parseTerm } from "../core/entry";
import { succeed, unwrap } from "../core/result";
import {
  handleAdd,
  handleDictionaryNew,
  handleExamplesGenerate,
  handleInit,
  handleListExamples,
  handleListMeanings,
  handleReplace,
} from "./cli-handlers";
import type { CliContext, CliIO } from "./cli-context";

const dictionaryPath = ".lexica/dictionaries";
const statePath = ".lexica/state.json";
const configPath = ".lexica/config.json";

const createMemoryContext = () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const storage = new MemoryVocabularyStorage();
  const io: CliIO = {
    exists: async (path) => files.has(path) || dirs.has(path),
    readText: async (path) => {
      const value = files.get(path);
      if (value === undefined) {
        throw new Error("not found");
      }
      return value;
    },
    writeText: async (path, content) => {
      files.set(path, content);
      const dir = path.split("/").slice(0, -1).join("/") || ".";
      dirs.add(dir);
    },
    mkdirp: async (path) => {
      dirs.add(path);
    },
    glob: async function* (pattern: string, cwd: string) {
      if (pattern !== "*.json") {
        return;
      }
      for (const filePath of files.keys()) {
        if (!filePath.startsWith(`${cwd}/`)) {
          continue;
        }
        if (!filePath.endsWith(".json")) {
          continue;
        }
        yield filePath.slice(cwd.length + 1);
      }
    },
    sleep: async () => {},
  };
  const context: CliContext = {
    paths: { dictionaryPath, statePath, configPath },
    io,
    output: {
      printJson: () => {},
      printError: () => {},
      printHelp: () => {},
      log: () => {},
    },
    services: {
      storage,
      readConfig: async () => succeed({ ai: { provider: "codex", args: [] } }),
      createExampleGenerator: () => async () => succeed(["Example sentence."]),
    },
    createTestSession: () => ({
      ask: async () => "y",
      close: () => {},
    }),
  };
  return { context, files, storage, io };
};

const seedDefaultDictionary = async (context: CliContext, files: Map<string, string>) => {
  const dictionary = unwrap(parseDictionary("default", { source: "english", target: "japanese" }));
  await context.services.storage.save(dictionaryPath, { dictionary, entries: [] });
  files.set(`${dictionaryPath}/${dictionary.name}.json`, "{}");
  await context.io.writeText(statePath, JSON.stringify({ dictionaryName: "default" }, null, 2));
  return dictionary;
};

describe("cli handlers", () => {
  test("handleInit creates config and state files", async () => {
    const { context, files } = createMemoryContext();
    const result = await handleInit(context);
    expect(result.type).toBe("Success");
    expect(files.has(configPath)).toBe(true);
    expect(files.has(statePath)).toBe(true);
  });

  test("handleDictionaryNew rejects duplicates", async () => {
    const { context, files } = createMemoryContext();
    files.set(`${dictionaryPath}/default.json`, "{}");
    const result = await handleDictionaryNew(context, {
      kind: "dictionary.new",
      name: "default",
      source: "english",
      target: "japanese",
    });
    expect(result.type).toBe("Failure");
    if (result.type === "Failure") {
      expect(result.error.kind).toBe("conflict");
    }
  });

  test("handleAdd stores entry in current dictionary", async () => {
    const { context, files } = createMemoryContext();
    const dictionary = await seedDefaultDictionary(context, files);
    const result = await handleAdd(context, {
      kind: "add",
      term: "object",
      meanings: ["物"],
    });
    expect(result.type).toBe("Success");
    if (result.type === "Success") {
      const stored = await context.services.storage.load(dictionaryPath, dictionary.name);
      expect(stored.type).toBe("Success");
      if (stored.type === "Success") {
        expect(stored.value.entries).toHaveLength(1);
      }
    }
  });

  test("handleExamplesGenerate overwrites examples", async () => {
    const { context, files } = createMemoryContext();
    const dictionary = await seedDefaultDictionary(context, files);
    const entry = createEntry(
      unwrap(parseTerm("object")),
      unwrap(parseMeanings(["物"])),
      undefined,
    );
    await context.services.storage.save(dictionaryPath, { dictionary, entries: [entry] });

    const result = await handleExamplesGenerate(context, {
      kind: "examples.generate",
      term: "object",
      countInput: "1",
    });

    expect(result.type).toBe("Success");
    const stored = await context.services.storage.load(dictionaryPath, dictionary.name);
    expect(stored.type).toBe("Success");
    if (stored.type === "Success") {
      const updated = stored.value.entries[0];
      expect(updated?.examples).toEqual(["Example sentence."]);
    }
  });

  test("handleReplace updates meanings in target dictionary", async () => {
    const { context, files } = createMemoryContext();
    const dictionary = await seedDefaultDictionary(context, files);
    const entry = createEntry(
      unwrap(parseTerm("object")),
      unwrap(parseMeanings(["物"])),
      undefined,
    );
    await context.services.storage.save(dictionaryPath, { dictionary, entries: [entry] });

    const result = await handleReplace(context, {
      kind: "replace",
      dictionary: "default",
      term: "object",
      meanings: ["対象"],
    });

    expect(result.type).toBe("Success");
    const stored = await context.services.storage.load(dictionaryPath, dictionary.name);
    expect(stored.type).toBe("Success");
    if (stored.type === "Success") {
      const updated = stored.value.entries[0];
      expect(updated?.meanings).toEqual(unwrap(parseMeanings(["対象"])));
    }
  });

  test("handleListMeanings returns meanings for entry", async () => {
    const { context, files } = createMemoryContext();
    const dictionary = await seedDefaultDictionary(context, files);
    const entry = createEntry(
      unwrap(parseTerm("object")),
      unwrap(parseMeanings(["物", "対象"])),
      undefined,
    );
    await context.services.storage.save(dictionaryPath, { dictionary, entries: [entry] });

    const result = await handleListMeanings(context, { kind: "list.meanings", term: "object" });

    expect(result.type).toBe("Success");
    if (result.type === "Success" && result.value.kind === "json") {
      expect(result.value.payload).toEqual({
        dictionary: "default",
        term: "object",
        meanings: unwrap(parseMeanings(["物", "対象"])),
      });
    }
  });

  test("handleListExamples returns examples for entry", async () => {
    const { context, files } = createMemoryContext();
    const dictionary = await seedDefaultDictionary(context, files);
    const entry = createEntry(unwrap(parseTerm("object")), unwrap(parseMeanings(["物"])), [
      "ex1",
      "ex2",
    ]);
    await context.services.storage.save(dictionaryPath, { dictionary, entries: [entry] });

    const result = await handleListExamples(context, { kind: "list.examples", term: "object" });

    expect(result.type).toBe("Success");
    if (result.type === "Success" && result.value.kind === "json") {
      expect(result.value.payload).toEqual({
        dictionary: "default",
        term: "object",
        examples: ["ex1", "ex2"],
      });
    }
  });
});
