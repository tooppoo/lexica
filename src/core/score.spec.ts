import { describe, expect, test } from "bun:test";
import { Result as Byethrow } from "@praha/byethrow";
import { decrementScore, incrementScore, parseScore, scoreToNumber } from "./score";
import { unwrap } from "./result";

describe("score parsing and updates", () => {
  test("parses valid score", () => {
    const score = unwrap(parseScore(2));
    expect(scoreToNumber(score)).toBe(2);
  });

  test("rejects negative score", () => {
    const result = parseScore(-1);
    expect(Byethrow.isFailure(result)).toBe(true);
  });

  test("increments and decrements score", () => {
    const score = unwrap(parseScore(0));
    const incremented = incrementScore(score);
    expect(scoreToNumber(incremented)).toBe(1);
    const decremented = decrementScore(incremented);
    expect(scoreToNumber(decremented)).toBe(0);
  });
});
