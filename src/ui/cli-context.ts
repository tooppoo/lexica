import type { ExampleGenerator } from "../application/application";
import { FileVocabularyStorage, type VocabularyStorage } from "../application/storage";
import type { Result } from "../core/result";
import { readCliConfig, type CliConfig } from "./cli-config";
import { createCliExampleGenerator } from "./ai-cli";
import { printError, printHelp, printJson } from "./print";
import { createReadlineTestSession, type TestSession } from "./cli-test-session";

export interface CliPaths {
  dictionaryPath: string;
  statePath: string;
  configPath: string;
}

export interface CliIO {
  exists: (path: string) => Promise<boolean>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, content: string) => Promise<void>;
  mkdirp: (path: string) => Promise<void>;
  glob: (pattern: string, cwd: string) => AsyncIterable<string>;
  sleep: (ms: number) => Promise<void>;
}

export interface CliOutput {
  printJson: (payload: unknown) => void;
  printError: (error: { kind: string; reason: string }) => void;
  printHelp: () => void;
  log: (message: string) => void;
}

export interface CliServices {
  storage: VocabularyStorage;
  readConfig: (path: string) => Promise<Result<CliConfig>>;
  createExampleGenerator: (config: CliConfig) => ExampleGenerator;
}

export interface CliContext {
  paths: CliPaths;
  io: CliIO;
  output: CliOutput;
  services: CliServices;
  createTestSession: () => TestSession;
}

/**
 * Creates the default CLI context backed by Bun and console output.
 */
export const createCliContext = (paths: CliPaths): CliContext => {
  return {
    paths,
    io: {
      exists: async (path) => Bun.file(path).exists(),
      readText: async (path) => Bun.file(path).text(),
      writeText: async (path, content) => {
        await Bun.write(path, content);
      },
      mkdirp: async (path) => {
        await Bun.$`mkdir -p ${path}`;
      },
      glob: async function* (pattern: string, cwd: string) {
        const glob = new Bun.Glob(pattern);
        for await (const filePath of glob.scan({ cwd })) {
          yield filePath;
        }
      },
      sleep: async (ms) => {
        await Bun.sleep(ms);
      },
    },
    output: {
      printJson,
      printError,
      printHelp,
      log: (message) => {
        console.log(message);
      },
    },
    services: {
      storage: new FileVocabularyStorage(),
      readConfig: (path) => readCliConfig(path),
      createExampleGenerator: (config) => createCliExampleGenerator(config),
    },
    createTestSession: () => createReadlineTestSession(),
  };
};
