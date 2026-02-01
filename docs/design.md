# モジュール設計（UI / Application / Core）

## UI

- CLI
  - コマンド: `lexica dictionary switch`, `lexica dictionary clear`, `lexica add`, `lexica remove`, `lexica ls`
  - 入力: term / meaning / dictionary（name）
  - 出力: Success / Error + 現在選択中の辞書
- 破壊的操作は辞書指定必須（入力不正）

## Application

- Operation
  - UpsertEntry / ListEntries / GenerateExamples / ReplaceEntry / DeleteEntry
- 辞書切り替え / 辞書全削除
- Response
  - Success / Error と現在選択中の辞書
- Storage
  - 語彙データのJSONとファイルI/O
- AI連携
  - 例文生成（初期: OpenAI のみ）

## Core

- 語彙データ
- Entry
- Dictionary
- DictionaryName
- 制約
  - Entry の一意性
  - 空文字不可 / meanings 要素数1以上
  - 競合はエラーとしない

## 依存方向

- UI -> Application -> Core のみ許可
- UI から Core への直接依存は禁止
