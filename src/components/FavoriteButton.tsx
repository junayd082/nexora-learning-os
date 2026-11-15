'use client';

import { useOptimistic, useTransition } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toggleFavorite } from '@/lib/actions';

export function FavoriteButton({ id, initial, labels }: { id: string; initial: boolean; labels: { on: string; off: string } }) {
  const [, start] = useTransition();
  const [on, setOn] = useOptimistic(initial);
  return (
    <button type="button" className="btn" aria-pressed={on}
      onClick={() => start(async () => { setOn(!on); await toggleFavorite(id, !on); })}>
      {on ? <BookmarkCheck size={15} className="text-accent" aria-hidden /> : <Bookmark size={15} aria-hidden />}
      {on ? labels.on : labels.off}
    </button>
  );
}
