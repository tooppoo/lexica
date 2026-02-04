import { describe, expect, test } from "bun:test";
import { expectErrorKind } from "../utils/test-helper";
import { readCliConfig } from "./cli-config";
import { unwrap } from "../core/result";

let counter = 0;
const createTempPath = (suffix: string) => {
  counter += 1;
  return `/tmp/lexica-cli-config-${Date.now()}-${counter}-${suffix}.json`;
};

describe("cli config", () => {
  test("fails when config file is missing", async () => {
    const result = await readCliConfig(createTempPath("missing"));
    expectErrorKind(result, "file-io");
  });

  test("fails when config json is invalid", async () => {
    const path = createTempPath("invalid-json");
    await Bun.write(path, "{ invalid");
    const result = await readCliConfig(path);
    expectErrorKind(result, "file-io");
  });

  test("fails when config schema is invalid", async () => {
    const path = createTempPath("invalid-schema");
    await Bun.write(path, JSON.stringify({ ai: { provider: "unknown" } }, null, 2));
    const result = await readCliConfig(path);
    expectErrorKind(result, "invalid-input");
  });

  test("reads config without args", async () => {
    const path = createTempPath("no-args");
    await Bun.write(path, JSON.stringify({ ai: { provider: "codex" } }, null, 2));
    const result = unwrap(await readCliConfig(path));
    expect(result).toEqual({ ai: { provider: "codex", args: [] } });
  });

  test("reads config with args", async () => {
    const path = createTempPath("with-args");
    await Bun.write(
      path,
      JSON.stringify({ ai: { provider: "codex", args: ["--flag", "value"] } }, null, 2),
    );
    const result = unwrap(await readCliConfig(path));
    expect(result).toEqual({ ai: { provider: "codex", args: ["--flag", "value"] } });
  });
});
