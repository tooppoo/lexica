# 概要
本仕様は、プログラマー向け言語学習ツールの機能・データ・抽象I/Oを定義する。対象は単語と意味の登録、辞書単位の管理、例文生成、登録内容のチェックである。SRS/復習アルゴリズム、GUI/モバイル対応、クラウド同期・アカウント機能は非スコープである。

# 用語
- 語彙データ: 辞書キーごとに Entry の配列を持つJSONデータである。
- 辞書: 学習対象の言語の組み合わせである（例: 英→日）。表現はオブジェクトである。
- 辞書キー: 辞書の source/target を `source:target` で結合した文字列である。
- 生成物: AIによって作成される例文である。

# データモデル（抽象）
## エンティティ
- 語彙データ
  - dictionaryKey: Entry[] のマップ（トップレベル）
- Entry
  - term: string（必須、空文字不可）
  - meanings: string[]（必須、要素数は1以上）
  - examples: string[]（任意）
- Dictionary
  - source: string（必須）
  - target: string（必須）
- DictionaryKey
  - source/target を `source:target` で結合した文字列

## 制約
- Entry は (dictionaryKey, term) の組で一意である。
- 同一綴りでも辞書が異なる場合は別の Entry として扱う。
- 生成物は語彙データ内に保存され、再生成時は上書きされる。
- 語彙データはJSONで永続化される。
- Entry は Dictionary を保持せず、dictionaryKey から導出される。

# 機能仕様
## 1) 単語登録・追記
- 目的: 単語と意味を登録し、既存単語に意味を追記する。
- 入力: dictionary, term, meaning
- 出力: Entry（登録後の状態）
- 副作用: 語彙データの更新（新規作成または意味の追記）
- エラー: 入力不正、ファイルI/O
- 例: dictionary=英→日, term="object", meaning="物"
- Covers: FR-001, FR-002, FR-005, FR-011, DR-001, DR-002, DR-003

## 2) 辞書単位の管理
- 目的: 辞書を指定して単語帳・例文を管理する。
- 入力: dictionary（必須）
- 出力: 指定辞書に属する Entry の集合または指定 Entry
- 副作用: なし（参照のみ）
- エラー: 入力不正、参照不能、ファイルI/O
- 例: dictionary=英→日 の一覧取得
- Covers: FR-008, FR-009, FR-010, NFR-001, DR-002, DR-003

## 3) 例文生成
- 目的: AI連携により例文を作成し保存する。
- 入力: dictionary, term, meaning（既存 Entry 参照）
- 出力: Entry（例文が更新された状態）
- 副作用: 生成物の保存（既存例文は上書き）
- エラー: 入力不正、参照不能、ファイルI/O、AI連携失敗
- 例: term="object", meaning="対象" に対する例文生成
- Covers: FR-003, FR-006, DR-004, C-001, C-002

## 4) 登録内容のチェック
- 目的: 登録済みの単語・例文を参照し確認できる。
- 入力: dictionary, term（任意）
- 出力: Entry または Entry の集合
- 副作用: なし
- エラー: 入力不正、参照不能、ファイルI/O
- 例: dictionary=英→日 の全件確認
- Covers: FR-004, NFR-001

## 5) 削除・上書き
- 目的: 既存 Entry の削除または上書きを行う。
- 入力: dictionary, term, （上書き時は Entry 全体）
- 出力: 成功結果
- 副作用: 語彙データの更新
- エラー: 入力不正、参照不能、ファイルI/O
- 例: term="object" の削除
- Covers: FR-007

# 共通仕様
- すべての応答に現在選択中の辞書を含めること。  
  Covers: FR-012
- 破壊的操作（削除・上書き）は辞書指定を必須とすること。未指定の場合は入力不正とする。  
  Covers: FR-013

# インタフェース（抽象I/O）
## Operation
- UpsertEntry: (dictionary, term, meaning) を受け取り、Entry を返す。
- ListEntries: (dictionary, term?) を受け取り、Entry または Entry[] を返す。
- GenerateExamples: (dictionary, term, meaning) を受け取り、Entry を返す。
- ReplaceEntry: (dictionary, term, entry) を受け取り、成功結果を返す。
- DeleteEntry: (dictionary, term) を受け取り、成功結果を返す。

## Response
- Success: 要求に対応するデータと現在選択中の辞書を含む。
- Error: エラー分類（入力不正/参照不能/ファイルI/O/AI連携失敗）と簡潔な理由を含む。

## Storage
- 語彙データはユーザーが指定した任意パスにJSONとして保存される。
- JSONのトップレベルは dictionaryKey をキーとする Entry[] のマップである。
- Gitリポジトリであることを前提としない。

# コマンドライン仕様
## グローバル
- コマンド名は `lexica` である。
- すべての応答に現在選択中の辞書を含める。
- 破壊的操作（削除・全削除）は `-d` / `--dictionary` 指定が必須である。

## コマンド一覧
### 辞書操作
- `lexica dictionary switch <source> <target>`
  - 現在の辞書を切り替える。未登録の辞書は新規作成する。
  - 入力: source, target
  - 出力: 現在選択中の辞書と切替結果
- `lexica dictionary clear -d <source>:<target>`
  - 指定辞書の単語を全削除する。
  - 入力: dictionary（必須）
  - 出力: 成功結果

### 単語操作
- `lexica add <term> <meaning>`
  - 現在の辞書に単語を登録する。
  - 既存単語の場合は meaning を追記する。
  - 入力: term, meaning
  - 出力: Entry（登録後の状態）
- `lexica remove <term> [meaning] -d <source>:<target>`
  - meaning 指定時は指定の意味のみ削除する。
  - meaning 省略時は単語エントリ全体を削除する。
  - 破壊的操作のため辞書指定は必須である。
  - 入力: term, meaning（任意）, dictionary（必須）
  - 出力: 成功結果
- `lexica ls [term]`
  - 現在の辞書の単語一覧、または指定単語の意味一覧を表示する。
  - 入力: term（任意）
  - 出力: Entry または Entry[]（表示対象）

# エラー仕様
- 入力不正: 必須項目欠落、空文字、辞書不整合など。
- 参照不能: 指定 Entry が存在しない。
- ファイルI/O: 読み書き失敗、権限不足、パス不正。
- AI連携失敗: AIサービス呼び出し失敗、応答不正。
- 競合はエラーとしない。既存単語が指定された場合は意味を追記する。

# 制約
- 初期サポート辞書は英→日のみである。
- 初期のAI連携はOpenAIのみでよい（将来的にローカルLLM連携を許容する）。
- 配布形態は単一バイナリである。
- GUI/モバイル対応、クラウド同期・アカウント機能、SRS/復習アルゴリズムは対象外である。
- 用語は「辞書」で統一する。

# トレーサビリティ（Requirement -> Specs）
- FR-001 -> 機能仕様 1)
- FR-002 -> 機能仕様 1), データモデル
- FR-003 -> 機能仕様 3)
- FR-004 -> 機能仕様 4)
- FR-005 -> 機能仕様 1), インタフェース/Storage
- FR-006 -> 機能仕様 3)
- FR-007 -> 機能仕様 5)
- FR-008 -> 機能仕様 2)
- FR-009 -> 機能仕様 2)
- FR-010 -> データモデル/制約
- FR-011 -> 機能仕様 1)
- FR-012 -> 共通仕様
- FR-013 -> 共通仕様
- NFR-001 -> 機能仕様 2)/4)
- NFR-002 -> 制約
- NFR-003 -> 制約
- DR-001 -> データモデル/制約
- DR-002 -> データモデル
- DR-003 -> データモデル
- DR-004 -> 機能仕様 3)
- DR-005 -> データモデル/制約
- OR-001 -> インタフェース/Storage
- OR-002 -> インタフェース/Storage
- OR-003 -> エラー仕様/インタフェース
- OR-004 -> エラー仕様
- C-001 -> 制約/機能仕様 3)
- C-002 -> 制約/機能仕様 3)
- C-003 -> 制約
- C-004 -> 制約
- C-005 -> 制約
- C-006 -> 制約
- C-007 -> 制約
