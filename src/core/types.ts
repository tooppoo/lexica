/** サポートされている翻訳元言語 */
export const SUPPORTED_SOURCES = ["en"] as const;
/** サポートされている翻訳先言語 */
export const SUPPORTED_TARGETS = ["ja"] as const;

export type SupportedSource = (typeof SUPPORTED_SOURCES)[number];
export type SupportedTarget = (typeof SUPPORTED_TARGETS)[number];

export type DictionaryKey = `${SupportedSource}:${SupportedTarget}`;

export interface Dictionary {
  source: SupportedSource;
  target: SupportedTarget;
}

type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type Term = Brand<string, "Term">;

export type Meaning = Brand<string, "Meaning">;

export interface Entry {
  /** 単語のテキスト */
  term: Term;
  /** 単語の意味 */
  meanings: Meaning[];
  /** 例文 */
  examples?: string[];
}

export type VocabularyData = Partial<Record<DictionaryKey, Entry[]>>;
