"use client";

// 終局結果（docs/14 §3.9 / docs/19）。和了（役名/翻符/点/増減）または流局（聴牌者/増減）。
// #19: 「大表示」化・「もう一局」「部屋を解散」ボタン・aria-live。拍手SE は #17 で自動再生。

import { useState } from "react";
import { type GameResult, type Seat } from "@/lib/mahjong/state";
import { Button, ConfirmDialog, Heading, Modal } from "@/components/ui";

export interface ResultModalProps {
  result: GameResult | null;
  nameOf: (seat: Seat) => string;
  /** ホスト（=seat0）かどうか。true のときだけ「もう一局」「部屋を解散」を表示。 */
  isHost: boolean;
  onBackToTitle: () => void;
  onRematch?: () => void;
  onDissolve?: () => void;
}

const fmtDelta = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export function ResultModal({
  result,
  nameOf,
  isHost,
  onBackToTitle,
  onRematch,
  onDissolve,
}: ResultModalProps) {
  const [dissolveOpen, setDissolveOpen] = useState(false);
  if (!result) return null;

  const title = result.kind === "win" ? "アガリ！" : "流局";

  return (
    <Modal open onClose={onBackToTitle} title={title}>
      {/* 結果カード：読み上げ補助のため aria-live で読み取らせる */}
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        {/* 大表示タイトル（Modal の title とは別に強調表示） */}
        <Heading level={1} className="text-center text-2xl">
          {title}
        </Heading>

        {result.kind === "win" ? (
          <div className="flex flex-col gap-4">
            {result.winners.map((w, i) => (
              <div
                key={i}
                className="rounded-xl border-2 border-gray-300 p-4 dark:border-gray-600"
              >
                <Heading level={2}>
                  {nameOf(w.seat)}（{w.isTsumo ? "ツモ" : "ロン"}）
                  {result.loserSeat !== null && !w.isTsumo && (
                    <span className="text-base font-normal">
                      　放銃 {nameOf(result.loserSeat)}
                    </span>
                  )}
                </Heading>

                {/* 役名は大きめ・1行ずつ読みやすく */}
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-lg">
                  {w.yaku.map((y, yi) => (
                    <li key={yi} className="font-bold">
                      {y.name}
                      <span className="ml-1 text-base font-normal text-foreground/70">
                        {y.han}翻
                      </span>
                    </li>
                  ))}
                </ul>

                {/* 翻符＋点数を一段大きく */}
                <p className="mt-3 text-2xl font-bold">
                  {w.han}翻 {w.fu}符
                  {w.limitName ? `（${w.limitName}）` : ""}
                  <span className="ml-2">＝ {w.score.total.toLocaleString()}点</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-gray-300 p-4 dark:border-gray-600">
            <Heading level={2}>流局</Heading>
            <p className="mt-2 text-lg">
              聴牌：
              {result.tenpaiSeats.length > 0
                ? result.tenpaiSeats.map(nameOf).join("・")
                : "なし"}
            </p>
          </div>
        )}

        {/* 点数の増減 */}
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-lg sm:grid-cols-4">
          {result.pointDeltas.map((d, s) => (
            <div key={s} className="flex justify-between gap-2">
              <span>{nameOf(s as Seat)}</span>
              <span
                className={`tabular-nums font-bold ${d > 0 ? "text-primary" : d < 0 ? "text-danger" : ""}`}
              >
                {fmtDelta(d)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 次の操作 */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" onClick={onBackToTitle}>
          タイトルへ戻る
        </Button>
        {isHost ? (
          <>
            <Button variant="secondary" size="lg" onClick={() => setDissolveOpen(true)}>
              部屋を解散
            </Button>
            {onRematch && (
              <Button variant="primary" size="lg" onClick={onRematch}>
                もう一局
              </Button>
            )}
          </>
        ) : (
          <span className="self-center text-sm text-foreground/70">
            ホストが次の操作を選んでいます…
          </span>
        )}
      </div>

      {/* 解散の確認（誤タップ防止） */}
      <ConfirmDialog
        open={dissolveOpen}
        title="部屋を解散しますか？"
        message="参加者全員がタイトル画面に戻ります。"
        tone="danger"
        confirmLabel="解散する"
        cancelLabel="やめる"
        onConfirm={() => {
          setDissolveOpen(false);
          onDissolve?.();
        }}
        onCancel={() => setDissolveOpen(false)}
      />
    </Modal>
  );
}
