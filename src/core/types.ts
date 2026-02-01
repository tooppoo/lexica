type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type DictionaryName = Brand<string, "DictionaryName">;

export interface Dictionary {
  name: DictionaryName;
}

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

export type VocabularyData = Partial<Record<DictionaryName, Entry[]>>;
