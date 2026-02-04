import { parseGlobalOptions } from "./option";
import { printError } from "./print";
import { parseCliCommand } from "./cli-command";
import { createCliContext } from "./cli-context";
import { handleCommand } from "./cli-handlers";

const run = async (): Promise<void> => {
  const parsed = parseGlobalOptions(process.argv.slice(2));
  if ("error" in parsed) {
    printError({ kind: "invalid-input", reason: parsed.error });
    process.exitCode = 1;
    return;
  }

  const context = createCliContext({
    dictionaryPath: parsed.dictionaryPath,
    statePath: parsed.statePath,
    configPath: parsed.configPath,
  });

  if (parsed.args.length === 0 || parsed.args.includes("-h") || parsed.args.includes("--help")) {
    context.output.printHelp();
    return;
  }

  const command = parseCliCommand(parsed.args);
  if (command.type === "Failure") {
    context.output.printError(command.error);
    process.exitCode = 1;
    return;
  }

  const result = await handleCommand(command.value, context);
  if (result.type === "Failure") {
    context.output.printError(result.error);
    process.exitCode = 1;
    return;
  }

  switch (result.value.kind) {
    case "help":
      context.output.printHelp();
      return;
    case "json":
      context.output.printJson(result.value.payload);
      return;
    case "none":
      return;
  }
};

run().catch((error) => {
  if (error instanceof Error && error.message === "exit") {
    return;
  }
  printError({ kind: "file-io", reason: "Unexpected error" });
  process.exitCode = 1;
});
