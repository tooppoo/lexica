import { Result as Byethrow } from "@praha/byethrow";
import * as v from "valibot";

export type CliConfigError = { kind: "file-io" | "invalid-input"; reason: string };
export type CliConfigResult<T> = Byethrow.Result<T, CliConfigError>;

const providerSchema = v.picklist(["codex", "claude-code"] as const);
const aiSchema = v.object({
  provider: providerSchema,
  args: v.optional(v.array(v.string())),
});
const configSchema = v.object({
  ai: aiSchema,
});

export type CliConfig = v.InferOutput<typeof configSchema>;

const succeed = <T>(value: T): CliConfigResult<T> => ({ type: "Success", value });
const fail = (kind: CliConfigError["kind"], reason: string): CliConfigResult<never> => ({
  type: "Failure",
  error: { kind, reason },
});

/**
 * Reads CLI configuration from a JSON file.
 */
export const readCliConfig = async (path: string): Promise<CliConfigResult<CliConfig>> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return fail("file-io", "Config file not found");
  }
  try {
    const content = JSON.parse(await file.text());
    const parsed = v.safeParse(configSchema, content);
    if (!parsed.success) {
      return fail("invalid-input", "Invalid config format");
    }
    const args = parsed.output.ai.args ?? [];
    return succeed({
      ai: {
        provider: parsed.output.ai.provider,
        args,
      },
    });
  } catch (error) {
    return fail("file-io", error instanceof Error ? error.message : "Failed to read config");
  }
};
