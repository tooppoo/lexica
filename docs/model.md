# ドメインモデル

## エンティティ

- 語彙データ
  - 辞書キーごとに Entry の配列を持つJSONデータ。
  - 正データ。
- Entry
  - term / meanings / examples を持つ（examples は任意）。
  - (dictionaryName, term) の組で一意。
- Dictionary
  - 辞書名で表現される。
- DictionaryName
  - 辞書名。

## 値オブジェクト

- 単語（term）
- 意味（meaning / meanings）
- 例文（examples）
- 辞書名
- 現在選択中の辞書
- 辞書名（dictionaryName）

## 関係

- 語彙データ 1 --- \* Entry（辞書名単位）
- Dictionary 1 --- \* Entry（辞書名から導出）
- Entry 0 --- \* 例文
- 例文はAIによって作成される

## 正データと派生データ

- 正データ: 語彙データ（JSON）
- 派生データ: 単語帳 / 例文集 / Entry の集合 / Success / Error（表示用）

## ドメイン境界

- Core: 語彙データ / Entry / Dictionary / DictionaryName / 制約（入力不正、参照不能など）
- 外部: CLI/コマンド、ファイルI/O、AI連携（OpenAI/ローカルLLM）
