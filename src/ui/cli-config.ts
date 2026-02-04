import * as v from "valibot";
import { failFileIO, failInvalidInput, succeed, type Result } from "../core/result";

export const DEFAULT_DICTIONARY_PATH = ".lexica/dictionaries";
export const DEFAULT_STATE_PATH = ".lexica/state.json";
export const DEFAULT_CONFIG_PATH = ".lexica/config.json";

const providerSchema = v.picklist(["codex", "claude-code"] as const);
const aiSchema = v.object({
  provider: providerSchema,
  args: v.optional(v.array(v.string())),
});
const configSchema = v.object({
  ai: aiSchema,
});

export type CliConfig = v.InferOutput<typeof configSchema>;

/**
 * Reads CLI configuration from a JSON file.
 */
export const readCliConfig = async (path: string): Promise<Result<CliConfig>> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return failFileIO("Config file not found");
  }
  try {
    const content = JSON.parse(await file.text());
    const parsed = v.safeParse(configSchema, content);
    if (!parsed.success) {
      return failInvalidInput("Invalid config format");
    }
    const args = parsed.output.ai.args ?? [];
    return succeed({
      ai: {
        provider: parsed.output.ai.provider,
        args,
      },
    });
  } catch (error) {
    return failFileIO(error instanceof Error ? error.message : "Failed to read config");
  }
};
