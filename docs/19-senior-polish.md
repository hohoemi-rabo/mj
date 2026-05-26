# 19. シニア向け仕上げ・結果画面

> 対応フェーズ: フェーズ4 ｜ 関連要件: REQUIREMENTS.md §3.6, §3.7, §7.1, §10
> 依存: #07, #13, #14, #17

## 目的
誤操作リカバリ・結果画面など、シニア向けの最終的な使い勝手を仕上げる。

## 対象ファイル
- `src/app/room/[id]/`（結果画面）・`src/components/game/` ・ `src/components/ui/`

## スコープ / 仕様（§3.7, §3.6）
- **「待って」ボタン**: 自ターンを一時停止（CPUの思考も停止 #08 の一時停止状態）。
- **「もう一度」ボタン**: 直前アクションの確認・取り消し（誤タップ対策）。
- **打牌確認ダイアログ**「この牌を切りますか？」（オンオフ可・デフォルトオン #13）。
- **結果画面**（§3.6, §7.1）: 点数・役名を**大きく表示**、拍手演出（#17）、「もう一局」「解散」。
- 全体の文言を読みやすい日本語に統一（用語カッコ補足 §3.7）。
- 教室での実機テストを通じて調整（§8 フェーズ4・§10 成功指標）。

## Todo
- [ ] 「待って」ボタン（CPU思考も止まる）※ サーバー連動pause は本チケットでは見送り（#14 のローカル一時停止オーバーレイのまま。自手番中CPUは元々止まるので実害限定）
- [x] 「もう一度」ボタン（直前アクション取消）= 既存の確認パターン群（打牌確認 #14 / ロン確認 #14 / チー・カンピッカー #14）＋**新規ツモ確認**で「直前アクションの確認・取り消し」を網羅
- [x] 打牌確認ダイアログの組み込み（デフォルトON）※ #13/#14 で実装済
- [x] 結果画面（点数・役名 大表示＋拍手演出）※ 大表示化＋aria-live。拍手SEは #17 で配線済（mp3投入で鳴る）
- [x] 「もう一局」「解散」導線（サーバー rematch/dissolve＋アダプタ＋ストア＋ResultModal 3ボタン化）
- [x] 文言の最終調整（読みやすい日本語）※ ResultModal の大表示・「もう一局」「部屋を解散」「タイトルへ戻る」等を整理
- [ ] 教室想定の実機テストとフィードバック反映 ※ 運用作業（コード作業外）

## 完了条件
- 誤操作のリカバリができ、結果画面で点数・役名が大きく表示され拍手が鳴る。「もう一局」「解散」で次に進める。§10 の成功指標（ルールを知らなくても1局打ち切れる）を満たす。

## 実装メモ
- `RoomStore.rematch(roomId, opts?)`: 終局後のみ許可（未開始/進行中は ILLEGAL_ACTION）。`started`/`state`/`seed` をリセット → `startGame` 再呼出。**席・名前・パスコードは維持**。
- `server.ts` 新ハンドラ: `game:rematch`（host=seat0 のみ・既存 driveTimers を clear してから rematch）／`room:dissolve`（host のみ・timer clear → `io.to(roomId).emit("room:dissolved")` → `removeRoom`）。
- `MahjongAdapter` 拡張: `rematch()` / `dissolve()` / `onDissolved(cb)`。LocalAdapter で emit+ack/on を実装、RemoteAdapter はスタブ、FakeAdapter（test）にもスタブ追加で interface 整合。
- `gameStore`: `rematch`/`dissolve` メソッド＋`dissolved: boolean` フラグ（INITIAL=false → onDissolved で true）。`GameBoard` は `useEffect([dissolved])` で `disconnect()`＋タイトルへ遷移。
- `ResultModal`: `role="status" aria-live="polite"` の結果カード。`Heading level={1}` で大表示＋役名 text-lg＋翻符・合計点 text-2xl。ホストには「もう一局」(primary)・「部屋を解散」(secondary→ danger ConfirmDialog 確認)・「タイトルへ戻る」(ghost)。非ホストは「タイトルへ戻る」のみ＋ホスト操作待ち表示。
- `ActionButtons`: ツモにも ConfirmDialog（tone=default。ロンの danger とは差別化）。
- テスト: `session.test.ts` に rematch の正常系/異常系 +3 件。`gameStore.test.ts` の FakeAdapter に rematch/dissolve/onDissolved スタブ。`npm run test` で 273 件パス。
- 2クライアント結合テスト（CPU_DELAY_MS=0）: 完走→非ホスト rematch=NOT_HOST→ホスト rematch=2局目完走→ホスト dissolve→双方 `room:dissolved`→ 解散後 rematch=ROOM_NOT_FOUND を確認。
