"use client";

// 共通UI部品の確認用ギャラリー（/ui）。タップ領域・コントラスト・開閉/確認/トグルを目視確認する。
// 本番画面ではない（開発・レビュー用）。

import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  Heading,
  Modal,
  ScreenContainer,
  Term,
  Toggle,
} from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-2xl border-2 border-gray-300 p-5">
      <Heading level={2} className="mb-4">
        {title}
      </Heading>
      {children}
    </section>
  );
}

export function UiShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lastAction, setLastAction] = useState("（まだ操作していません）");

  const [helpMode, setHelpMode] = useState(true);
  const [discardConfirm, setDiscardConfirm] = useState(true);
  const [muted, setMuted] = useState(false);

  return (
    <ScreenContainer>
      <Heading level={1}>共通UI部品ギャラリー</Heading>
      <p className="mt-2 text-base text-foreground/80">
        #13 で作った共通部品の確認用。実機では横画面（ランドスケープ）が基本です。
      </p>

      <Section title="ボタン（大型・60px以上）">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">主要（はい）</Button>
          <Button variant="secondary">副次（いいえ）</Button>
          <Button variant="danger">取消・警告</Button>
          <Button variant="ghost">控えめ</Button>
          <Button variant="primary" disabled>
            無効
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg">
            大サイズ
          </Button>
          <Button variant="secondary" size="lg">
            大サイズ
          </Button>
        </div>
      </Section>

      <Section title="見出し（Heading）">
        <Heading level={1}>レベル1（タイトル）</Heading>
        <Heading level={2}>レベル2（見出し）</Heading>
        <Heading level={3}>レベル3（小見出し）</Heading>
      </Section>

      <Section title="用語の補足（Term）">
        <p className="text-base">
          <Term word="リーチ" hint="あと1枚で完成" />／
          <Term word="ツモ" hint="自分で引いてアガリ" />／
          <Term word="ロン" hint="人の捨て牌でアガリ" />
        </p>
      </Section>

      <Section title="トグルスイッチ（設定）">
        <div className="max-w-md divide-y divide-gray-200">
          <Toggle
            checked={helpMode}
            onChange={setHelpMode}
            label="お助けモード"
            hint="初心者向けの案内を表示"
          />
          <Toggle
            checked={discardConfirm}
            onChange={setDiscardConfirm}
            label="打牌確認"
            hint="牌を切る前に確認する"
          />
          <Toggle checked={muted} onChange={setMuted} label="ミュート" hint="音を消す" />
        </div>
        <p className="mt-3 text-sm text-foreground/70">
          状態: お助け={String(helpMode)} / 打牌確認={String(discardConfirm)} / ミュート=
          {String(muted)}
        </p>
      </Section>

      <Section title="モーダル / 確認ダイアログ">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>モーダルを開く</Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            確認ダイアログ
          </Button>
          <Button variant="danger" onClick={() => setDiscardOpen(true)}>
            打牌確認（流用例）
          </Button>
        </div>
        <p className="mt-3 text-sm text-foreground/70">直近の操作: {lastAction}</p>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="モーダルの例">
          <p className="mb-4 text-base">
            Esc キーで閉じます。背景クリックでは閉じません（誤タップ防止）。
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setModalOpen(false)}>閉じる</Button>
          </div>
        </Modal>

        <ConfirmDialog
          open={confirmOpen}
          title="この操作を実行しますか？"
          message="確認ダイアログの基本形です。"
          onConfirm={() => {
            setLastAction("確認ダイアログ: はい");
            setConfirmOpen(false);
          }}
          onCancel={() => {
            setLastAction("確認ダイアログ: いいえ");
            setConfirmOpen(false);
          }}
        />

        <ConfirmDialog
          open={discardOpen}
          title="この牌を切りますか？"
          onConfirm={() => {
            setLastAction("打牌確認: はい（切る）");
            setDiscardOpen(false);
          }}
          onCancel={() => {
            setLastAction("打牌確認: いいえ（戻る）");
            setDiscardOpen(false);
          }}
        />
      </Section>
    </ScreenContainer>
  );
}
