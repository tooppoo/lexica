import { failInvalidInput, succeed, type Result } from "../core/result";
import { extractOption } from "./option";

export type Command =
  | { kind: "help" }
  | { kind: "init" }
  | { kind: "dictionary.new"; name: string; source: string; target: string }
  | { kind: "dictionary.switch"; name: string }
  | { kind: "dictionary.clear"; dictionary: string }
  | { kind: "add"; term: string; meanings: string[] }
  | { kind: "remove"; dictionary: string; term: string; meaning?: string }
  | { kind: "list"; term?: string }
  | { kind: "list.meanings"; term: string }
  | { kind: "list.examples"; term: string }
  | { kind: "replace"; dictionary: string; term: string; meanings: string[] }
  | { kind: "examples.add"; term: string; example: string }
  | { kind: "examples.generate"; term: string; countInput?: string }
  | { kind: "test"; modeInput: string; countInput?: string };

/**
 * Parses CLI arguments into a typed Command.
 */
export const parseCliCommand = (args: string[]): Result<Command> => {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    return succeed({ kind: "help" });
  }

  const [command, subcommand, ...rest] = args;
  if (!command) {
    return failInvalidInput("Missing command");
  }

  if (command === "init") {
    return succeed({ kind: "init" });
  }

  if (command === "dictionary") {
    if (subcommand === "new") {
      const [name, ...optionArgs] = rest;
      if (!name) {
        return failInvalidInput("Missing dictionary name");
      }
      const source = extractOption(optionArgs, ["--source"]).value;
      const target = extractOption(optionArgs, ["--target"]).value;
      if (!source || !target) {
        return failInvalidInput("Missing source/target");
      }
      return succeed({ kind: "dictionary.new", name, source, target });
    }
    if (subcommand === "switch") {
      const [name] = rest;
      if (!name) {
        return failInvalidInput("Missing dictionary name");
      }
      return succeed({ kind: "dictionary.switch", name });
    }
    if (subcommand === "clear") {
      const extracted = extractOption(rest, ["-d", "--dictionary"]);
      if (!extracted.value) {
        return failInvalidInput("Missing dictionary");
      }
      return succeed({ kind: "dictionary.clear", dictionary: extracted.value });
    }
    return failInvalidInput("Unknown command");
  }

  if (command === "add") {
    const [term, meaning] = [subcommand, rest[0]];
    if (!term || !meaning) {
      return failInvalidInput("Missing term/meaning");
    }
    return succeed({ kind: "add", term, meanings: meaning.split(",") });
  }

  if (command === "remove") {
    const extracted = extractOption([subcommand ?? "", ...rest], ["-d", "--dictionary"]);
    if (!extracted.value) {
      return failInvalidInput("Missing dictionary");
    }
    const [term, meaning] = extracted.args;
    if (!term) {
      return failInvalidInput("Missing term");
    }
    return succeed({ kind: "remove", dictionary: extracted.value, term, meaning });
  }

  if (command === "ls") {
    const term = subcommand;
    const view = rest[0];
    if (!term) {
      return succeed({ kind: "list" });
    }
    if (!view) {
      return succeed({ kind: "list", term });
    }
    if (view === "meanings") {
      return succeed({ kind: "list.meanings", term });
    }
    if (view === "examples") {
      return succeed({ kind: "list.examples", term });
    }
    return failInvalidInput("Unknown list view");
  }

  if (command === "replace") {
    const extracted = extractOption([subcommand ?? "", ...rest], ["-d", "--dictionary"]);
    if (!extracted.value) {
      return failInvalidInput("Missing dictionary");
    }
    const [term, ...meaningsInput] = extracted.args;
    if (!term || meaningsInput.length === 0) {
      return failInvalidInput("Missing term/meanings");
    }
    return succeed({
      kind: "replace",
      dictionary: extracted.value,
      term,
      meanings: meaningsInput,
    });
  }

  if (command === "examples") {
    const term = subcommand;
    const action = rest[0];
    if (!term || (action !== "generate" && action !== "add")) {
      return failInvalidInput(
        "Usage: examples <term> generate [--count <count>] | examples <term> add <example>",
      );
    }
    if (action === "add") {
      const exampleInput = rest.slice(1).join(" ").trim();
      if (!exampleInput) {
        return failInvalidInput("Missing example");
      }
      return succeed({ kind: "examples.add", term, example: exampleInput });
    }

    const countArgs = rest.slice(1);
    const countFlag = countArgs.some((arg) => arg === "-c" || arg === "--count");
    const extracted = extractOption(countArgs, ["-c", "--count"]);
    if (countFlag && !extracted.value) {
      return failInvalidInput("Missing example count");
    }
    return succeed({ kind: "examples.generate", term, countInput: extracted.value });
  }

  if (command === "test") {
    const [modeInput, countInput] = [subcommand, ...rest];
    if (!modeInput) {
      return failInvalidInput("Missing test mode");
    }
    return succeed({ kind: "test", modeInput, countInput });
  }

  return failInvalidInput("Unknown command");
};
