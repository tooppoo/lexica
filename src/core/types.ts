
/** サポートされている翻訳元言語 */
export type SupportedSource =
    | "en"
/** サポートされている翻訳先言語 */
export type SupportedTarget =
    | "ja"

export type DictionaryKey = `${SupportedSource}:${SupportedTarget}`

export interface Dictionary {
    source: SupportedSource
    target: SupportedTarget
}

export interface Entry {
    /** 単語のテキスト */
    term: string
    /** 単語の意味 */
    meanings: string[]
    /** 例文 */
    examples?: string[]
}

export type VocabularyData = Partial<Record<DictionaryKey, Entry[]>>
