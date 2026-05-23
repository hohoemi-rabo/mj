"use client";

// 終局結果（docs/14 §3.9）。和了（役名/翻符/点/増減）または流局（聴牌者/増減）。
// 演出・連荘・複数局・読み上げは #17/#19。ここは静的な最小表示。

import { type GameResult, type Seat } from "@/lib/mahjong/state";
import { Button, Heading, Modal } from "@/components/ui";

export interface ResultModalProps {
  result: GameResult | null;
  nameOf: (seat: Seat) => string;
  onBackToTitle: () => void;
}

const fmtDelta = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

export function ResultModal({ result, nameOf, onBackToTitle }: ResultModalProps) {
  if (!result) return null;

  return (
    <Modal open onClose={onBackToTitle} title={result.kind === "win" ? "アガリ！" : "流局"}>
      {result.kind === "win" ? (
        <div className="flex flex-col gap-4">
          {result.winners.map((w, i) => (
            <div key={i} className="rounded-xl border-2 border-gray-300 p-3 dark:border-gray-600">
              <Heading level={3}>
                {nameOf(w.seat)}（{w.isTsumo ? "ツモ" : "ロン"}）
                {result.loserSeat !== null && !w.isTsumo && (
                  <span className="text-base font-normal">　放銃 {nameOf(result.loserSeat)}</span>
                )}
              </Heading>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base">
                {w.yaku.map((y, yi) => (
                  <li key={yi}>
                    {y.name} <span className="text-sm text-foreground/70">{y.han}翻</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-lg font-bold">
                {w.han}翻 {w.fu}符 {w.limitName ? `（${w.limitName}）` : ""} ＝ {w.score.total}点
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-base">
            聴牌：
            {result.tenpaiSeats.length > 0
              ? result.tenpaiSeats.map(nameOf).join("・")
              : "なし"}
          </p>
        </div>
      )}

      {/* 点数の増減 */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-base sm:grid-cols-4">
        {result.pointDeltas.map((d, s) => (
          <div key={s} className="flex justify-between gap-2">
            <span>{nameOf(s as Seat)}</span>
            <span className={`tabular-nums font-bold ${d > 0 ? "text-primary" : d < 0 ? "text-danger" : ""}`}>
              {fmtDelta(d)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="primary" size="lg" onClick={onBackToTitle}>
          タイトルへ戻る
        </Button>
      </div>
    </Modal>
  );
}
