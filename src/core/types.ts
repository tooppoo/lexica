type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type DictionaryName = Brand<string, "DictionaryName">;

export type SourceLanguage = Brand<string, "SourceLanguage">;

export type TargetLanguage = Brand<string, "TargetLanguage">;

export type ExampleCount = Brand<number, "ExampleCount">;

export type TestMode = "meanings" | "examples";

export type TestCount = Brand<number, "TestCount">;

export interface Language {
  source: SourceLanguage;
  target: TargetLanguage;
}

export interface Dictionary {
  name: DictionaryName;
  language: Language;
}

export interface AppState {
  dictionary: Dictionary;
  entries: Entry[];
}

export type Term = Brand<string, "Term">;

export type Meaning = Brand<string, "Meaning">;

export type Score = Brand<number, "Score">;

export interface Entry {
  /** 単語のテキスト */
  term: Term;
  /** 単語の意味 */
  meanings: Meaning[];
  /** 例文 */
  examples?: string[];
  /** テストスコア */
  score: Score;
}
