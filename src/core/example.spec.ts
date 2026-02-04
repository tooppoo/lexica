import { Result as Byethrow } from "@praha/byethrow";
import { describe, expect, test } from "bun:test";
import { addEntry, parseMeaning, parseTerm } from "./entry";
import { defaultExampleCount, generateExamples } from "./example";
import { unwrap } from "./result";
import { createDefaultState, expectErrorKind } from "../utils/test-helper";

describe("core example generation", () => {
  test("generates examples", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const generated = unwrap(
      await generateExamples(
        added.state,
        unwrap(parseTerm("object")),
        unwrap(parseMeaning("物")),
        async ({ language }) =>
          Byethrow.succeed([`example sentence (${language.source} to ${language.target})`]),
        defaultExampleCount(),
      ),
    );
    expect(generated.entry.examples).toEqual(["example sentence (english to japanese)"]);
  });

  test("returns ai-failed when generator fails", async () => {
    const state = createDefaultState();
    const added = unwrap(addEntry(state, unwrap(parseTerm("object")), unwrap(parseMeaning("物"))));
    const result = await generateExamples(
      added.state,
      unwrap(parseTerm("object")),
      unwrap(parseMeaning("物")),
      async () => Byethrow.fail({ kind: "ai-failed", reason: "failure" }),
      defaultExampleCount(),
    );
    expectErrorKind(result, "ai-failed");
  });
});
