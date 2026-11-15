import { AlignLeft, ArrowDownUp, CheckSquare, GitCompareArrows, ListChecks, PenLine, SeparatorHorizontal, TextCursorInput } from 'lucide-react';
import type { BlockType } from '@/lib/engine/types';

const MAP: Record<BlockType, { icon: typeof AlignLeft; color: string }> = {
  true_false: { icon: CheckSquare, color: '62 196 138' },
  multiple_choice: { icon: ListChecks, color: '255 122 48' },
  ordering: { icon: ArrowDownUp, color: '90 162 255' },
  short_answer: { icon: PenLine, color: '154 114 255' },
  fill_blank: { icon: TextCursorInput, color: '232 76 168' },
  matching: { icon: GitCompareArrows, color: '240 170 70' },
  text: { icon: AlignLeft, color: '150 150 165' },
  page_break: { icon: SeparatorHorizontal, color: '150 150 165' },
};

export function QTypeIcon({ type, size = 16 }: { type: BlockType; size?: number }) {
  const m = MAP[type] ?? MAP.text;
  const Icon = m.icon;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: `rgb(${m.color} / 0.12)`, color: `rgb(${m.color})` }} aria-hidden>
      <Icon size={size} />
    </span>
  );
}
