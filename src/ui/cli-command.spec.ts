import { describe, expect, test } from "bun:test";
import { expectErrorKind } from "../utils/test-helper";
import { parseCliCommand } from "./cli-command";
import { unwrap } from "../core/result";

describe("cli command parser", () => {
  test("parses init command", () => {
    const command = unwrap(parseCliCommand(["init"]));
    expect(command).toEqual({ kind: "init" });
  });

  test("parses dictionary new command", () => {
    const command = unwrap(
      parseCliCommand(["dictionary", "new", "tech", "--source", "english", "--target", "ja"]),
    );
    expect(command).toEqual({
      kind: "dictionary.new",
      name: "tech",
      source: "english",
      target: "ja",
    });
  });

  test("rejects dictionary new without name", () => {
    const result = parseCliCommand(["dictionary", "new", "--source", "en", "--target", "ja"]);
    expectErrorKind(result, "invalid-input");
  });

  test("rejects dictionary new without source/target", () => {
    const result = parseCliCommand(["dictionary", "new", "tech", "--source", "en"]);
    expectErrorKind(result, "invalid-input");
  });

  test("parses add command", () => {
    const command = unwrap(parseCliCommand(["add", "object", "物,対象"]));
    expect(command).toEqual({
      kind: "add",
      term: "object",
      meanings: ["物", "対象"],
    });
  });

  test("rejects add without term or meaning", () => {
    const result = parseCliCommand(["add", "object"]);
    expectErrorKind(result, "invalid-input");
  });

  test("parses remove command", () => {
    const command = unwrap(parseCliCommand(["remove", "term", "-d", "default"]));
    expect(command).toEqual({ kind: "remove", dictionary: "default", term: "term" });
  });

  test("rejects remove without dictionary", () => {
    const result = parseCliCommand(["remove", "term"]);
    expectErrorKind(result, "invalid-input");
  });

  test("parses list command", () => {
    const command = unwrap(parseCliCommand(["ls", "term"]));
    expect(command).toEqual({ kind: "list", term: "term" });
  });

  test("parses replace command", () => {
    const command = unwrap(parseCliCommand(["replace", "term", "meaning", "-d", "default"]));
    expect(command).toEqual({
      kind: "replace",
      dictionary: "default",
      term: "term",
      meanings: ["meaning"],
    });
  });

  test("rejects replace without meanings", () => {
    const result = parseCliCommand(["replace", "term", "-d", "default"]);
    expectErrorKind(result, "invalid-input");
  });

  test("parses examples add command", () => {
    const command = unwrap(parseCliCommand(["examples", "term", "add", "Some example"]));
    expect(command).toEqual({ kind: "examples.add", term: "term", example: "Some example" });
  });

  test("rejects examples generate without count value", () => {
    const result = parseCliCommand(["examples", "term", "generate", "--count"]);
    expectErrorKind(result, "invalid-input");
  });

  test("parses examples generate with count", () => {
    const command = unwrap(parseCliCommand(["examples", "term", "generate", "--count", "3"]));
    expect(command).toEqual({ kind: "examples.generate", term: "term", countInput: "3" });
  });

  test("parses test command", () => {
    const command = unwrap(parseCliCommand(["test", "meanings", "5"]));
    expect(command).toEqual({ kind: "test", modeInput: "meanings", countInput: "5" });
  });

  test("rejects unknown command", () => {
    const result = parseCliCommand(["unknown"]);
    expectErrorKind(result, "invalid-input");
  });
});
