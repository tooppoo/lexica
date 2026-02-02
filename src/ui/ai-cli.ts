import { Result as Byethrow } from "@praha/byethrow";
import type { ExampleGenerator } from "../application/application";
import type { CliConfig } from "./cli-config";

const providerCommand = (provider: CliConfig["ai"]["provider"]): string => {
  switch (provider) {
    case "codex":
      return "codex";
    case "claude-code":
      return "claude";
  }
};

const providerBaseArgs = (provider: CliConfig["ai"]["provider"]): string[] => {
  switch (provider) {
    case "codex":
      return ["exec"];
    case "claude-code":
      return ["-p"];
  }
};

const buildPrompt = (
  term: string,
  meaning: string,
  dictionaryName: string,
  count: number,
): string => {
  const requested = `Return exactly ${count} concise example sentences.`;
  return [
    "You are generating example sentences for a language learner.",
    `Dictionary: ${dictionaryName}`,
    `Term: ${term}`,
    `Meaning: ${meaning}`,
    requested,
    "Output plain text, one sentence per line.",
  ].join("\n");
};

/**
 * Creates an example generator that calls an external CLI tool.
 */
export const createCliExampleGenerator = (config: CliConfig): ExampleGenerator => {
  return async ({ dictionaryName, term, meaning, count }) => {
    const command = providerCommand(config.ai.provider);
    const baseArgs = providerBaseArgs(config.ai.provider);
    const extraArgs = config.ai.args ?? [];
    const prompt = buildPrompt(term, meaning, dictionaryName, count);
    try {
      const process = Bun.spawn({
        cmd: [command, ...baseArgs, ...extraArgs, prompt],
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
        process.exited,
      ]);
      if (exitCode !== 0) {
        const reason = stderr.trim();
        return Byethrow.fail({
          kind: "ai-failed",
          reason: reason.length > 0 ? reason : `Failed with exit code ${exitCode}`,
        });
      }
      const output = stdout.trim();
      if (output.length === 0) {
        return Byethrow.fail({ kind: "ai-failed", reason: "Empty AI output" });
      }
      const examples = output
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (examples.length === 0) {
        return Byethrow.fail({ kind: "ai-failed", reason: "No examples generated" });
      }
      if (typeof count === "number" && examples.length < count) {
        return Byethrow.fail({
          kind: "ai-failed",
          reason: `Expected ${count} examples, got ${examples.length}`,
        });
      }
      return Byethrow.succeed(typeof count === "number" ? examples.slice(0, count) : examples);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "AI command failed";
      return Byethrow.fail({ kind: "ai-failed", reason });
    }
  };
};
