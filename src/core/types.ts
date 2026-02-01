/** サポートされている辞書 */
export const SUPPORTED_DICTIONARIES = [
  { source: "en", target: "ja" },
  { source: "ja", target: "en" },
] as const;

export const SUPPORTED_DICTIONARY_KEYS = ["en:ja", "ja:en"] as const;

export type SupportedDictionary = (typeof SUPPORTED_DICTIONARIES)[number];
export type SupportedSource = SupportedDictionary["source"];
export type SupportedTarget = SupportedDictionary["target"];

export type DictionaryKey = (typeof SUPPORTED_DICTIONARY_KEYS)[number];

export type Dictionary = SupportedDictionary;

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
