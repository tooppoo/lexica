import { parseArgs } from "util";
import { DEFAULT_CONFIG_PATH, DEFAULT_DICTIONARY_PATH, DEFAULT_STATE_PATH } from "./cli-config";

type GlobalParseResult =
  | { error: string }
  | { dictionaryPath: string; statePath: string; configPath: string; args: string[] };

export const parseGlobalOptions = (args: string[]): GlobalParseResult => {
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

export const extractOption = (args: string[], names: string[]) => {
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
