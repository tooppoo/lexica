# 用語

## Entities

| 語彙       | 出典                                                | 確定していること / 不明点                                                    |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| 語彙データ | docs/request.md, docs/requirement.md, docs/specs.md | 辞書名ごとに Entry の配列を持つJSONデータ。                                  |
| Entry      | docs/specs.md                                       | term/meanings/examples を持つ。dictionary は保持せず辞書名から導出される。   |
| Dictionary | docs/specs.md                                       | 辞書名で表現される。不明: 辞書切り替え時の永続化方法。                       |

## Values

| 語彙                                           | 出典                                                | 確定していること / 不明点                        |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| 単語                                           | docs/request.md, docs/specs.md                      | Entry の term に対応。                           |
| 意味                                           | docs/request.md, docs/specs.md                      | Entry の meanings に対応。                       |
| 例文                                           | docs/request.md, docs/specs.md                      | Entry の examples に対応。                       |
| 生成物                                         | docs/request.md, docs/requirement.md, docs/specs.md | AIによって作成される例文。                       |
| term / meaning / meanings / examples           | docs/specs.md                                       | Entry の属性名。                                 |
| dictionaryName                                 | docs/specs.md                                       | Dictionary の属性名。                            |
| 現在選択中の辞書                               | docs/request.md, docs/requirement.md, docs/specs.md | すべての応答に含める必要がある。不明: 保存場所。 |
| Entry の集合                                   | docs/specs.md                                       | 辞書単位の管理/チェックで返る集合。              |
| Success / Error                                | docs/specs.md                                       | Response の種別。                                |
| 入力不正 / 参照不能 / ファイルI/O / AI連携失敗 | docs/request.md, docs/requirement.md, docs/specs.md | Error の分類。                                   |
| Storage                                        | docs/specs.md                                       | 語彙データの保存先と読み書きの抽象。             |
| Operation                                      | docs/specs.md                                       | 抽象I/Oの操作群。                                |
| Response                                       | docs/specs.md                                       | Success / Error を含む応答。                     |

## Actions

| 語彙                                                                      | 出典                           | 確定していること / 不明点          |
| ------------------------------------------------------------------------- | ------------------------------ | ---------------------------------- |
| 単語登録                                                                  | docs/request.md, docs/specs.md | 単語と意味の登録。                 |
| 意味追記                                                                  | docs/request.md, docs/specs.md | 既存単語への意味追加。             |
| 例文生成                                                                  | docs/request.md, docs/specs.md | AI連携で例文を作成し保存。         |
| 登録内容のチェック                                                        | docs/request.md, docs/specs.md | 単語・例文を参照し確認。           |
| 削除 / 上書き                                                             | docs/request.md, docs/specs.md | Entry の削除・上書き。             |
| 辞書切り替え                                                              | docs/specs.md                  | dictionary switch コマンドで実施。 |
| 辞書全削除                                                                | docs/specs.md                  | dictionary clear コマンドで実施。  |
| UpsertEntry / ListEntries / GenerateExamples / ReplaceEntry / DeleteEntry | docs/specs.md                  | Operation の抽象I/O。              |

## Constraints

| 語彙                                         | 出典                                                | 確定していること / 不明点                          |
| -------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Entry の一意性                               | docs/specs.md                                       | dictionaryName + term で一意。                     |
| 空文字不可 / meanings 要素数1以上            | docs/specs.md                                       | 入力不正。                                         |
| 同一綴りでも辞書が異なる場合は別管理         | docs/request.md, docs/requirement.md, docs/specs.md | 辞書単位で Entry を区別。                          |
| 生成物は語彙データ内に保存し再生成時に上書き | docs/specs.md                                       | 例文の更新規則。                                   |
| 破壊的操作は辞書指定必須                     | docs/request.md, docs/requirement.md, docs/specs.md | 辞書指定が省略された場合、危険操作としてブロック。 |
| 競合はエラーとしない                         | docs/request.md, docs/requirement.md, docs/specs.md | 既存単語は意味追記。                               |

## Aliases

| 語彙            | 出典                               | 対応                       |
| --------------- | ---------------------------------- | -------------------------- |
| 単語帳 / 例文集 | docs/request.md                    | Entry の集合（表示単位）。 |
| dictionary      | docs/specs.md                      | 辞書（Dictionary）。       |
| 生成物          | docs/requirement.md, docs/specs.md | 例文（AIによって作成）。   |

## Ambiguous

| 語彙             | 出典                                                | 不明点                          |
| ---------------- | --------------------------------------------------- | ------------------------------- |
| 現在選択中の辞書 | docs/request.md, docs/requirement.md, docs/specs.md | 永続化の有無/保存場所。         |
| 例文生成         | docs/specs.md                                       | meanings が複数ある場合の扱い。 |
| 任意パス         | docs/requirement.md, docs/specs.md                  | 同時に複数パスを扱うか。        |
