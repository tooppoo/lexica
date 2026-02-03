# 用語

- 語彙データ: 単語・意味・例文・辞書を含むJSONデータである。
- 辞書: 辞書名で識別される語彙のまとまりである。
- 生成物: AIによって作成される例文である。
- テスト: 登録済みの単語・意味・例文を使って記憶状況を記録する操作である。
- スコア: テスト結果に基づく数値であり、出題の選択に用いる。

# 機能要件（FR）

- FR-001: 単語とその意味を登録できること。  
  Trace: request.md の「ゴール」「利用シナリオ」
- FR-002: 語彙データをJSONとして保存できること。  
  Trace: request.md の「制約」
- FR-003: AI連携により例文を作成できること。  
  Trace: request.md の「ゴール」「利用シナリオ」
- FR-004: 単語および例文のチェックができること。  
  Trace: request.md の「ゴール」
- FR-005: 任意パスを指定して語彙データを操作できること。  
  Trace: request.md の「制約」
- FR-006: 生成物を再生成し、既存データを上書きできること。  
  Trace: request.md の「制約」
- FR-007: 語彙データの削除および上書きを行えること。  
  Trace: request.md の「制約」
- FR-008: 辞書を指定して単語帳・例文を作成および管理できること。  
  Trace: request.md の「ゴール」「利用シナリオ」
- FR-009: 任意の辞書名で語彙データを作成できること。  
  Trace: request.md の「ゴール」
- FR-010: 同一綴りでも辞書が異なる場合は別の単語として管理できること。  
  Trace: request.md の「ゴール」
- FR-011: 既存単語に対して意味を追記できること。  
  Trace: request.md の「制約」
- FR-012: 現在選択中の辞書を常に表示できること。  
  Trace: request.md の「制約」
- FR-013: 破壊的操作では辞書指定を必須とすること。  
  Trace: request.md の「制約」
- FR-014: 意味テストと例文テストを実行できること。  
  Trace: request.md の「ゴール」「利用シナリオ」
- FR-015: テストはインタラクティブに実行できること。  
  Trace: request.md の「制約」
- FR-016: テストは出題回数を指定して実行でき、未指定時のデフォルトは10回であること。  
  Trace: request.md の「制約」
- FR-017: テスト結果によりスコアを更新できること（覚えていた場合は加算、覚えていなかった場合は減算、最小値は0）。  
  Trace: request.md の「制約」
- FR-018: 出題はスコアに反比例した重み付きランダムで選択できること。  
  Trace: request.md の「制約」
- FR-019: 例文テストで例文がない単語が選ばれた場合はスキップして再抽選できること。  
  Trace: request.md の「制約」
- FR-020: 例文テストでは同じ単語が複数回選択されてもよいこと。  
  Trace: request.md の「制約」
- FR-021: 例文テストでは同じ例文が選択された場合はスキップできること。  
  Trace: request.md の「制約」
- FR-022: 指定回数未満の出題でテストを終了してもよいこと（単語数/例文数が不足する場合を含む）。  
  Trace: request.md の「制約」
- FR-023: 意味テストでは同じ単語が複数回選択されてはならないこと。  
  Trace: request.md の「制約」
- FR-024: 意味テストでは同じ意味が選択された場合はスキップできること。  
  Trace: request.md の「制約」
- FR-025: 手動で例文を追加できること。  
  Trace: request.md の「ゴール」「利用シナリオ」

# 非機能要件（NFR）

- NFR-001: 単語・例文のチェックはオフラインで完結できること。  
  Trace: request.md の「ゴール」「制約」
- NFR-002: 単一バイナリとして配布できること。  
  Trace: request.md の「ゴール」「制約」
- NFR-003: Windows、macOS、Linuxで動作すること。  
  Trace: request.md の「制約」

# データ要件（DR）

- DR-001: 語彙データはJSON形式で管理されること。  
  Trace: request.md の「制約」
- DR-002: 語彙データは辞書情報を含むこと。  
  Trace: request.md の「ゴール」「制約」
- DR-003: 辞書は辞書名を持つオブジェクトで表現されること。  
  Trace: request.md の「制約」
- DR-004: 生成物はJSONに保存され、再生成時に上書きされること。  
  Trace: request.md の「制約」
- DR-005: 語彙データが正であり、履歴管理はユーザーのGit操作に委ねること。  
  Trace: request.md の「制約」
- DR-006: 単語のスコアは語彙データに保存されること。  
  Trace: request.md の「制約」
- DR-007: スコアは0以上の整数であること。  
  Trace: request.md の「制約」

# 運用要件（OR）

- OR-001: ユーザーが指定した任意パスで運用できること。  
  Trace: request.md の「制約」
- OR-002: Gitリポジトリであることを前提とせずに動作できること。  
  Trace: request.md の「制約」
- OR-003: エラー分類は入力不正、参照不能、競合、ファイルI/O、AI連携失敗とすること。  
  Trace: request.md の「制約」
- OR-004: 単語登録の競合はエラーとしないこと。  
  Trace: request.md の「制約」

# 制約（C）

- C-001: AI連携はcodex, claude-codeなどCLI形式で行う。  
  Trace: request.md の「制約」
- C-003: SRS/復習アルゴリズムは対象外である。  
  Trace: request.md の「非ゴール」
- C-004: GUI/モバイル対応は対象外である。  
  Trace: request.md の「非ゴール」
- C-005: クラウド同期・アカウント機能は対象外である。  
  Trace: request.md の「非ゴール」
- C-007: 用語は「辞書」で統一する。  
  Trace: request.md の「制約」
- C-008: 出題アルゴリズムは将来的に交換可能であること。  
  Trace: request.md の「制約」

# トレーサビリティ（Request -> Requirement）

- request.md「ゴール」 -> FR-001, FR-003, FR-004, FR-008, FR-009, FR-010, FR-014, NFR-002
- request.md「ゴール」 -> FR-001, FR-003, FR-004, FR-008, FR-009, FR-010, FR-014, FR-025, NFR-002
- request.md「制約」 -> FR-002, FR-005, FR-006, FR-007, FR-011, FR-012, FR-013, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, NFR-001, NFR-003, DR-001, DR-002, DR-003, DR-004, DR-005, DR-006, DR-007, OR-001, OR-002, OR-003, OR-004, C-001, C-007, C-008
- request.md「非ゴール」 -> C-003, C-004, C-005
- request.md「利用シナリオ」 -> FR-001, FR-003, FR-008, FR-014, FR-025
