"use client";

// 対局画面のオーケストレータ（docs/14 §3.1）。接続を保証し、gameState を購読して盤面を描く。
// サーバー権威: UI は gameState を一切ミューテートせず、操作は store.send で送り次の game:state を待つ。
// UIローカル状態（打牌確認の対象牌・リーチselectモード・設定モーダル等）はここで集中管理する。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Tile as TileType, tileName } from "@/lib/mahjong/tiles";
import { type Seat, currentSeat } from "@/lib/mahjong/state";
import { useGameConnection } from "@/lib/store/useGameConnection";
import { useGameStore } from "@/lib/store/gameStore";
import {
  currentlyPossibleYaku,
  opponentSeats,
  selectMyHand,
  selectMyWaits,
  tenpaiKeepDiscards,
  waitsAfterDiscard,
} from "@/lib/store/selectors";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Button, ConfirmDialog, Heading, ScreenContainer } from "@/components/ui";
import { TopBar } from "@/components/game/TopBar";
import { OpponentArea } from "@/components/game/OpponentArea";
import { RiverGrid } from "@/components/game/RiverGrid";
import { HandTiles } from "@/components/game/HandTiles";
import { ActionButtons } from "@/components/game/ActionButtons";
import { SettingsModal } from "@/components/game/SettingsModal";
import { ResultModal } from "@/components/game/ResultModal";
import { ErrorToast } from "@/components/game/ErrorToast";
import { WaitButton } from "@/components/game/WaitButton";
import { TenpaiNotice } from "@/components/game/TenpaiNotice";
import { YakuBadges } from "@/components/game/YakuBadges";
import { useGameEventAudio } from "@/components/game/useGameEventAudio";
import { useGameBgm } from "@/components/game/useGameBgm";
import { windLabel } from "@/components/game/labels";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ScreenContainer className="bg-[#1f1611] text-white">
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        {children}
      </div>
    </ScreenContainer>
  );
}

export function GameBoard({ roomId }: { roomId: string }) {
  const router = useRouter();
  useGameConnection();
  useGameEventAudio(); // gameState 差分で SE/読み上げを発火（#17）
  useGameBgm(); // 対局中の BGM ループ再生（#17）
  const gameState = useGameStore((s) => s.gameState);
  const mySeat = useGameStore((s) => s.mySeat);
  const legal = useGameStore((s) => s.myLegalActions);
  const players = useGameStore((s) => s.players);
  const connection = useGameStore((s) => s.connection);
  const dissolved = useGameStore((s) => s.dissolved);

  // #19 解散通知を受けたらタイトルへ。disconnect() でストアを INITIAL に戻す。
  useEffect(() => {
    if (dissolved) {
      useGameStore.getState().disconnect();
      router.push("/");
    }
  }, [dissolved, router]);
  const send = useGameStore((s) => s.send);

  const discardConfirm = useSettingsStore((s) => s.discardConfirm);
  const helpMode = useSettingsStore((s) => s.helpMode);

  // UIローカル状態
  const [discardTarget, setDiscardTarget] = useState<TileType | null>(null);
  const [riichiSelect, setRiichiSelect] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hand = useGameStore(selectMyHand);
  // お助け: 安定参照 hand をキーに memo 化（fresh Set を毎回 store へ返さない）。
  const tenpaiKeep = useMemo(() => tenpaiKeepDiscards(hand), [hand]);
  // 当たり牌（他家河ハイライト用）。drawn===null && tenpai のときだけ非空。
  const myWaits = useMemo(() => selectMyWaits(hand), [hand]);
  // 風（gameState ない間はダミー z1。currentlyPossibleYaku は hand=null で空配列を返すので無害）。
  const seatWindOfMe = gameState && mySeat !== null ? gameState.players[mySeat].seatWind : "z1";
  const roundWindNow = gameState ? gameState.roundWind : "z1";
  const possibleYaku = useMemo(
    () => currentlyPossibleYaku(hand, seatWindOfMe, roundWindNow),
    [hand, seatWindOfMe, roundWindNow],
  );

  // 対局が無い（直接アクセス/リロード）: 完全再接続は #16。タイトルへ誘導。
  if (!gameState && mySeat === null) {
    return (
      <Centered>
        <Heading level={2} className="!text-white">対局が見つかりません</Heading>
        <p className="text-base text-white/80">タイトルからやり直してください。</p>
        <Link href="/">
          <Button variant="primary" size="lg">
            タイトルへ戻る
          </Button>
        </Link>
      </Centered>
    );
  }

  if (!gameState || mySeat === null || !hand) {
    return (
      <Centered>
        <Heading level={2} className="!text-white">準備中…</Heading>
        <p className="text-base text-white/80">配牌を待っています。</p>
      </Centered>
    );
  }

  const seat = mySeat;
  const [rightSeat, topSeat, leftSeat] = opponentSeats(seat);
  const current = currentSeat(gameState);
  const infoOf = (s: Seat) => players.find((p) => p.seat === s);
  const nameOf = (s: Seat) =>
    infoOf(s)?.name ?? `${windLabel(gameState.players[s].seatWind)}家`;

  const backToTitle = () => {
    useGameStore.getState().disconnect();
    router.push("/");
  };

  // #19 もう一局: server.rematch 経由。成功すれば game:state が再到着して result が消える＝モーダル自動クローズ。
  const handleRematch = () => {
    void useGameStore.getState().rematch({ fillWithCpu: true });
  };
  // #19 部屋を解散: server に通知。成功すれば onDissolved → dissolved=true で useEffect 経由でタイトル遷移。
  const handleDissolve = () => {
    void useGameStore.getState().dissolve();
  };

  const doDiscard = (tile: TileType) => {
    send({ type: "discard", seat, tile, riichi: riichiSelect });
    setRiichiSelect(false);
    setDiscardTarget(null);
  };

  const onTileClick = (tile: TileType) => {
    if (discardConfirm) setDiscardTarget(tile);
    else doDiscard(tile);
  };

  // 打牌確認のメッセージ（お助けONなら待ち牌も補足）。
  const confirmWaits =
    discardTarget && helpMode ? waitsAfterDiscard(hand, discardTarget) : [];

  const opponent = (s: Seat, position: "top" | "left" | "right") => (
    <OpponentArea
      player={gameState.players[s]}
      info={infoOf(s)}
      isCurrent={current === s}
      position={position}
    />
  );

  return (
    <ScreenContainer showRotateHint className="bg-[#1f1611] text-white">
      <div
        data-room-id={roomId}
        className="grid min-h-[82dvh] grid-cols-[auto_1fr_auto] grid-rows-[auto_auto_1fr_auto_auto] gap-2"
      >
        {/* 卓フェルト背景: 対面・上家/下家・河・自手牌が乗る面 (行2-4)。
            外枠=木目フチ(p-2=8px)、内側=フェルト面+inset shadow(凹み感)。
            primary 緑(#1d6f42)と干渉しないフォレストグリーン。z-0 で他要素の下へ。 */}
        <div
          aria-hidden
          className="mahjong-wood pointer-events-none col-span-3 col-start-1 row-span-3 row-start-2 z-0 rounded-3xl p-2 shadow-[0_8px_24px_rgba(0,0,0,0.55),0_2px_4px_rgba(0,0,0,0.4)]"
        >
          <div className="mahjong-felt h-full w-full rounded-2xl shadow-[inset_0_3px_6px_rgba(0,0,0,0.7),inset_0_-2px_4px_rgba(0,0,0,0.5),inset_0_0_60px_rgba(0,0,0,0.35)]" />
        </div>

        {/* 上部バー */}
        <div className="relative z-10 col-span-3 row-start-1">
          <TopBar gameState={gameState} mySeat={seat} onOpenSettings={() => setSettingsOpen(true)} />
        </div>

        {/* 対面（上）。フェルト上に乗るので白文字。mt-4 で上の木目フチから離す。 */}
        <div className="relative z-10 col-start-2 row-start-2 mt-4 justify-self-center text-white">
          {opponent(topSeat, "top")}
        </div>

        {/* 上家（左）。ml-4 で左の木目フチから離す。 */}
        <div className="relative z-10 col-start-1 row-start-3 ml-4 self-center text-white">
          {opponent(leftSeat, "left")}
        </div>

        {/* 中央の河 */}
        <div className="relative z-10 col-start-2 row-start-3">
          <RiverGrid
            gameState={gameState}
            mySeat={seat}
            helpHighlight={helpMode ? myWaits : null}
          />
        </div>

        {/* 下家（右）。mr-4 で右の木目フチから離す。 */}
        <div className="relative z-10 col-start-3 row-start-3 mr-4 self-center text-white">
          {opponent(rightSeat, "right")}
        </div>

        {/* 自手牌（お助け: 上に聴牌通知、下に成立しうる役）。
            col-start-1 を明示しないと、felt の row-span が行4を埋めてる扱いになり
            auto-placement が暗黙列を右に作って卓外にはみ出す。
            pb-5 で YakuBadges が felt の下辺の木目フチに被るのを防ぐ。 */}
        <div className="relative z-10 col-span-3 col-start-1 row-start-4 flex flex-col items-center gap-2 px-4 pb-5">
          {helpMode && (
            <div className="min-h-[1.5rem]">
              <TenpaiNotice hand={hand} />
            </div>
          )}
          <HandTiles
            hand={hand}
            mySeat={seat}
            legal={legal}
            riichiSelect={riichiSelect}
            helpMode={helpMode}
            tenpaiKeep={tenpaiKeep}
            onTileClick={onTileClick}
          />
          {helpMode && <YakuBadges names={possibleYaku} />}
        </div>

        {/* 操作ボタン */}
        <div className="relative z-10 col-span-3 row-start-5 flex min-h-tap flex-wrap items-center justify-center gap-3">
          {riichiSelect ? (
            <>
              <span className="text-base font-bold">リーチする牌を選んでください</span>
              <Button variant="secondary" size="lg" onClick={() => setRiichiSelect(false)}>
                リーチをやめる
              </Button>
            </>
          ) : (
            legal && (
              <ActionButtons
                legal={legal}
                seat={seat}
                lastDiscardTile={gameState.lastDiscard?.tile ?? null}
                helpMode={helpMode}
                onAction={send}
                onRiichiStart={() => setRiichiSelect(true)}
              />
            )
          )}
        </div>
      </div>

      {/* 打牌確認 */}
      <ConfirmDialog
        open={discardTarget !== null}
        title="この牌を切りますか？"
        message={
          discardTarget ? (
            <span>
              {tileName(discardTarget)}
              {confirmWaits.length > 0 && (
                <span className="block text-sm text-foreground/70">
                  （この牌を切ると {confirmWaits.map(tileName).join("・")} 待ち）
                </span>
              )}
            </span>
          ) : undefined
        }
        confirmLabel="切る"
        cancelLabel="やめる"
        onConfirm={() => discardTarget && doDiscard(discardTarget)}
        onCancel={() => setDiscardTarget(null)}
      />

      {/* 接続状態バナー（通信断→再接続中）。再接続で自動的に消える（#16）。 */}
      {connection !== "connected" && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-2 z-40 -translate-x-1/2 rounded-xl bg-danger px-6 py-2 text-base font-bold text-white shadow-2xl"
        >
          接続が切れました。再接続しています…
        </div>
      )}

      {/* 「待って」（自手番のみ・ローカル一時停止） */}
      <WaitButton visible={current === seat} />

      {/* エラー表示 */}
      <ErrorToast />

      {/* 設定モーダル（ホストには対局終了ボタンを出す） */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isHost={seat === 0}
        onDissolve={handleDissolve}
      />

      {/* 終局結果（result があれば表示） */}
      <ResultModal
        result={gameState.result}
        nameOf={nameOf}
        isHost={seat === 0}
        onBackToTitle={backToTitle}
        onRematch={handleRematch}
        onDissolve={handleDissolve}
      />
    </ScreenContainer>
  );
}
