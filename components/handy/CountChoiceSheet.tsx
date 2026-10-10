"use client";

import { useState } from "react";
import type { CountSteps } from "@/lib/options";
import Sheet from "@/components/handy/Sheet";
import CountStepper from "@/components/handy/CountStepper";
import { primaryButton } from "@/components/handy/ui";

/** 品目を押したときに、数を＋−で合わせてから入れるシート（瓶に付けるグラスの数）。最初は1個 */
export default function CountChoiceSheet({
  itemName,
  title,
  count,
  onAdd,
  onClose,
}: {
  itemName: string;
  /** 何の数か（例: 「グラスの数」） */
  title: string;
  count: CountSteps;
  onAdd: (optionId: string) => void;
  onClose: () => void;
}) {
  const initial = count.steps.find((s) => s.value === 1) ?? count.steps[0];
  const [selectedId, setSelectedId] = useState(initial.option.id);

  return (
    <Sheet
      title={itemName}
      subtitle={`${title}を合わせてから追加してください`}
      onClose={onClose}
      footer={
        <button onClick={() => onAdd(selectedId)} style={primaryButton}>
          追加する
        </button>
      }
    >
      <CountStepper title={title} count={count} selectedId={selectedId} onChange={(o) => setSelectedId(o.id)} large />
    </Sheet>
  );
}
