# @philomagi/lexica

## セットアップ

依存関係のインストール:

```bash
npm i -g @philomagi/lexica
```

## コマンド一覧

サポート辞書は英→日/日→英。

### 辞書操作

- `lexica dictionary switch <source> <target>`
  - 現在の辞書を切り替える（未登録の場合は作成）
- `lexica dictionary clear -d <source>:<target>`
  - 指定辞書の全削除

### 単語操作

- `lexica add <term> <meaning>`
  - 現在の辞書に単語を登録
  - 既存単語の場合は meaning を追記
- `lexica remove <term> [meaning] -d <source>:<target>`
  - meaning 指定時: 指定の意味のみ削除
  - meaning 省略時: 単語エントリを削除
  - 破壊的操作のため辞書指定必須
- `lexica ls [term]`
  - 現在の辞書の単語一覧、または指定単語の意味一覧

### 例

```bash
lexica dictionary switch en ja
lexica add dog 犬
lexica add dog いぬ
lexica ls dog
lexica remove dog いぬ -d en:ja
lexica dictionary clear -d en:ja
```

補足:

- すべての応答に現在選択中の辞書が表示される。
- 破壊的操作（削除・全削除）は `-d` / `--dictionary` 指定が必須。
