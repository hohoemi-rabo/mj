"use client";

// 操作ボタン（docs/14 §3.6）。myLegalActions 駆動で合法手のみ表示。
// 自手番=ツモ/リーチ/カン(暗・加)、鳴き応答=ロン/ポン/チー/カン(大明)/パス。
// リーチは送信せず GameBoard の riichi-select を ON にする（牌 tap 待ち）。

import { useState } from "react";
import { type LegalActions, type Seat } from "@/lib/mahjong/state";
import { type Tile as TileType } from "@/lib/mahjong/tiles";
import { type PlayerAction } from "@/lib/adapter/types";
import { Button, ConfirmDialog, Term } from "@/components/ui";
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
    <div className="flex flex-wrap items-center justify-center gap-3">
      {/* --- 自手番 --- */}
      {legal.canTsumo && (
        <Button variant="primary" size="lg" className={pulse} onClick={() => onAction({ type: "tsumo", seat })}>
          <Term word="ツモ" hint="自分で引いてアガリ" />
        </Button>
      )}
      {legal.riichiDiscards.length > 0 && (
        <Button variant="primary" size="lg" className={pulse} onClick={onRiichiStart}>
          <Term word="リーチ" hint="あと1枚で完成・宣言" />
        </Button>
      )}
      {kanCandidates.length > 0 && (
        <Button variant="secondary" size="lg" onClick={onSelfKan}>
          <Term word="カン" hint="同じ牌4枚" />
        </Button>
      )}

      {/* --- 鳴き応答 --- */}
      {legal.canRon && (
        <Button variant="primary" size="lg" className={pulse} onClick={() => setRonOpen(true)}>
          <Term word="ロン" hint="人の牌でアガリ" />
        </Button>
      )}
      {legal.canPon && (
        <Button variant="secondary" size="lg" className={pulse} onClick={() => onAction({ type: "pon", seat })}>
          <Term word="ポン" hint="同じ牌2枚で3枚にする" />
        </Button>
      )}
      {legal.chiOptions.length > 0 && (
        <Button variant="secondary" size="lg" className={pulse} onClick={onChi}>
          <Term word="チー" hint="数の並びを作る" />
        </Button>
      )}
      {legal.canMinkan && (
        <Button variant="secondary" size="lg" className={pulse} onClick={() => onAction({ type: "minkan", seat })}>
          <Term word="カン" hint="同じ牌4枚" />
        </Button>
      )}
      {legal.canPass && (
        <Button variant="secondary" size="lg" onClick={() => onAction({ type: "pass", seat })}>
          <Term word="パス" hint="鳴かない" />
        </Button>
      )}

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
