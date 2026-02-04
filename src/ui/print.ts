import { DEFAULT_CONFIG_PATH, DEFAULT_DICTIONARY_PATH, DEFAULT_STATE_PATH } from "./cli-config";

export const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

export const printError = (error: { kind: string; reason: string }): void => {
  printJson({ error });
};

export const printHelp = (): void => {
  console.log(
    [
      "lexica - CLI reference",
      "",
      "Usage:",
      "  lexica [options] <command>",
      "",
      "Options:",
      "  -p, --path <path>          Dictionary data directory (alias of --dictionary)",
      "  --dictionary <path>        Dictionary data directory",
      "  --state <path>             State file path",
      "  --config <path>            Config file path",
      "  -h, --help                 Show this help",
      "",
      "Commands:",
      "  init",
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
