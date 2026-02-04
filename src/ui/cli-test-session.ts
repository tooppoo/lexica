import { createInterface } from "node:readline";
import type { AppState, Term, TestCount, TestMode } from "../core/types";
import { failInvalidInput, succeed, type Result } from "../core/result";
import {
  forgetEntry,
  rememberEntry,
  selectExampleTestEntry,
  selectMeaningTestEntry,
} from "../application/application";

export interface TestSession {
  ask: (message: string) => Promise<string>;
  close: () => void;
}

export interface TestSessionOutput {
  log: (message: string) => void;
}

/**
 * Creates a readline-backed test session for interactive CLI testing.
 */
export const createReadlineTestSession = (): TestSession => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (message: string) =>
      new Promise((resolve) => {
        rl.question(message, (answer) => resolve(answer));
      }),
    close: () => {
      rl.close();
    },
  };
};

/**
 * Runs a test session loop for the given mode and count, returning the updated state.
 */
export const runTestSession = async (
  state: AppState,
  mode: TestMode,
  count: TestCount,
  output: TestSessionOutput,
  session: TestSession,
  sleep: (ms: number) => Promise<void>,
): Promise<Result<{ state: AppState; asked: number }>> => {
  const usedTerms = new Set<Term>();
  const usedExamples = new Set<string>();
  let asked = 0;
  let testState = state;
  const strategyByMode = {
    meanings: {
      select: () => selectMeaningTestEntry(testState, usedTerms),
      revealPrompt: "enter to show meanings",
      reveal: (selection: { entry: { meanings: string[] } }) => {
        output.log(`${selection.entry.meanings.join(", ")}`);
        return true;
      },
      rememberPrompt: "Do you remember?(y/n) ",
      track: (selection: { entry: { term: Term } }) => usedTerms.add(selection.entry.term),
    },
    examples: {
      select: () => selectExampleTestEntry(testState, usedExamples),
      revealPrompt: "",
      reveal: (selection: { example?: string }) => {
        if (!selection.example) {
          return false;
        }
        output.log(`${selection.example}\n`);
        return true;
      },
      rememberPrompt: "Could you read it?(y/n) ",
      track: (selection: { example?: string }) => {
        if (selection.example) {
          usedExamples.add(selection.example);
        }
      },
    },
  } as const;

  const modeStrategy = strategyByMode[mode];
  if (!modeStrategy) {
    return failInvalidInput("Invalid test mode");
  }

  while (asked < count) {
    const selection = modeStrategy.select();
    if (selection.type === "Failure") {
      session.close();
      return selection;
    }
    if (!selection.value) {
      break;
    }

    const { entry } = selection.value;
    output.log(`----------\n${entry.term}\n----------\n`);
    if (modeStrategy.revealPrompt.length > 0) {
      await session.ask(modeStrategy.revealPrompt);
    }
    const revealed = modeStrategy.reveal(selection.value);
    if (!revealed) {
      break;
    }
    await sleep(1000);

    const rememberPrompt = modeStrategy.rememberPrompt;
    let answer = await session.ask(rememberPrompt);
    while (answer !== "y" && answer !== "n") {
      answer = await session.ask(rememberPrompt);
    }
    output.log("");
    const updated =
      answer === "y" ? rememberEntry(testState, entry.term) : forgetEntry(testState, entry.term);
    if (updated.type === "Failure") {
      session.close();
      return updated;
    }
    testState = updated.value.state;
    asked += 1;
    modeStrategy.track(selection.value);
  }

  session.close();
  return succeed({ state: testState, asked });
};
