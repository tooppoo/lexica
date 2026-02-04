import { describe, expect, test } from "bun:test";
import { runTestSession } from "./cli-test-session";
import { createDefaultState } from "../utils/test-helper";
import { addEntryMeanings, createState } from "../application/application";
import { unwrap } from "../core/result";
import { parseMeanings, parseTerm } from "../core/entry";
import { parseTestCount } from "../core/test-mode";

const createSession = (answers: string[]) => {
  let index = 0;
  return {
    ask: async (_message: string) => {
      const answer = answers[index] ?? "";
      index += 1;
      return answer;
    },
    close: () => {
      // no-op
    },
  } as const;
};

describe("runTestSession", () => {
  test("runs a meanings test session and records answers", async () => {
    const baseState = createDefaultState();
    const added = unwrap(
      addEntryMeanings(baseState, unwrap(parseTerm("object")), unwrap(parseMeanings(["物"]))),
    );
    const session = createSession(["", "y"]);
    const outputMessages: string[] = [];
    const output = { log: (message: string) => outputMessages.push(message) };
    const count = unwrap(parseTestCount(1));

    const result = await runTestSession(
      createState(added.state.dictionary, added.state.entries),
      "meanings",
      count,
      output,
      session,
      async () => {},
    );

    expect(result.type).toBe("Success");
    if (result.type === "Success") {
      expect(result.value.asked).toBe(1);
      expect(result.value.state.entries).toHaveLength(1);
    }
    expect(outputMessages.length).toBeGreaterThan(0);
  });
});
