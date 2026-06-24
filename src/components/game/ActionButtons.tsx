"use client";

// 操作ボタン（docs/14 §3.6）。myLegalActions 駆動で合法手のみ表示。
// 自手番=ツモ/リーチ/カン(暗・加)、鳴き応答=ロン/ポン/チー/カン(大明)/パス。
// リーチは送信せず GameBoard の riichi-select を ON にする（牌 tap 待ち）。

import { useState } from "react";
import { type LegalActions, type Seat } from "@/lib/mahjong/state";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { type PlayerAction } from "@/lib/adapter/types";
import { Button, ConfirmDialog } from "@/components/ui";
import { ChiOptionPicker } from "@/components/game/ChiOptionPicker";
import { KanTilePicker, type KanCandidate } from "@/components/game/KanTilePicker";

export interface ActionButtonsProps {
  legal: LegalActions;
  seat: Seat;
  lastDiscardTile: TileType | null;
  helpMode: boolean;
  onAction: (action: PlayerAction) => void;
  onRiichiStart: () => void;
}

export function ActionButtons({
  legal,
  seat,
  lastDiscardTile,
  helpMode,
  onAction,
  onRiichiStart,
}: ActionButtonsProps) {
  const [chiOpen, setChiOpen] = useState(false);
  const [kanOpen, setKanOpen] = useState(false);
  const [ronOpen, setRonOpen] = useState(false);
  const [tsumoOpen, setTsumoOpen] = useState(false);

  // 自手番のカン候補（暗・加をまとめて扱う）。
  const kanCandidates: KanCandidate[] = [
    ...legal.ankanTiles.map((t) => ({ type: "ankan" as const, tile: t })),
    ...legal.kakanTiles.map((t) => ({ type: "kakan" as const, tile: t })),
  ];

  const pulse = helpMode ? "animate-pulse" : "";

  const onChi = () => {
    if (legal.chiOptions.length === 1) {
      onAction({ type: "chi", seat, tiles: legal.chiOptions[0] });
    } else {
      setChiOpen(true);
    }
  };

  const onSelfKan = () => {
    if (kanCandidates.length === 1) {
      onAction({ ...kanCandidates[0], seat });
    } else {
      setKanOpen(true);
    }
  };

  return (
    // 手牌の右側に縦並びで配置（GameBoard 行4 に統合）。
    // 横並び wrap だと自手牌の下に行が増え、シニアのノートPCで下端が画面外スクロール送りになる。
    <div className="flex flex-col items-stretch gap-2">
      {/* popup 内はコンパクトに語のみ表示（カッコ補足は通常 UI でのみ）。 */}
      {/* --- 自手番 --- */}
      {legal.canTsumo && (
        <Button variant="primary" size="lg" className={pulse} onClick={() => setTsumoOpen(true)}>
          ツモ
        </Button>
      )}
      {legal.riichiDiscards.length > 0 && (
        <Button variant="primary" size="lg" className={pulse} onClick={onRiichiStart}>
          リーチ
        </Button>
      )}
      {kanCandidates.length > 0 && (
        <Button variant="secondary" size="lg" onClick={onSelfKan}>
          カン
        </Button>
      )}

      {/* --- 鳴き応答 --- */}
      {legal.canRon && (
        <Button variant="primary" size="lg" className={pulse} onClick={() => setRonOpen(true)}>
          ロン
        </Button>
      )}
      {legal.canPon && (
        <Button variant="secondary" size="lg" className={pulse} onClick={() => onAction({ type: "pon", seat })}>
          ポン
        </Button>
      )}
      {legal.chiOptions.length > 0 && (
        <Button variant="secondary" size="lg" className={pulse} onClick={onChi}>
          チー
        </Button>
      )}
      {legal.canMinkan && (
        <Button variant="secondary" size="lg" className={pulse} onClick={() => onAction({ type: "minkan", seat })}>
          カン
        </Button>
      )}
      {legal.canPass && (
        <Button variant="secondary" size="lg" onClick={() => onAction({ type: "pass", seat })}>
          パス
        </Button>
      )}

      {/* ツモ確認（誤タップ防止・#19） */}
      <ConfirmDialog
        open={tsumoOpen}
        title="ツモしますか？"
        confirmLabel="ツモ"
        cancelLabel="やめる"
        onConfirm={() => {
          onAction({ type: "tsumo", seat });
          setTsumoOpen(false);
        }}
        onCancel={() => setTsumoOpen(false)}
      />

      {/* ロン確認（取り消し不可なので danger） */}
      <ConfirmDialog
        open={ronOpen}
        title="ロンしますか？"
        tone="danger"
        confirmLabel="ロン"
        cancelLabel="やめる"
        onConfirm={() => {
          onAction({ type: "ron", seat });
          setRonOpen(false);
        }}
        onCancel={() => setRonOpen(false)}
      />

      {/* チー組合せ選択 */}
      <ChiOptionPicker
        open={chiOpen}
        options={legal.chiOptions}
        calledTile={lastDiscardTile}
        onSelect={(opt) => {
          onAction({ type: "chi", seat, tiles: opt });
          setChiOpen(false);
        }}
        onCancel={() => setChiOpen(false)}
      />

      {/* カン牌選択（暗・加） */}
      <KanTilePicker
        open={kanOpen}
        candidates={kanCandidates}
        onSelect={(c) => {
          onAction({ ...c, seat });
          setKanOpen(false);
        }}
        onCancel={() => setKanOpen(false)}
      />
    </div>
  );
}
