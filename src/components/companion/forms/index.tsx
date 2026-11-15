'use client';

import { Fox } from '../Fox';
import type { FormProps } from './parts';
import { Quad } from './Quad';
import { Crab } from './Crab';
import { Firefly } from './Firefly';
import { Owl } from './Owl';
import { Frog } from './Frog';
import { Turtle } from './Turtle';
import { Drone } from './Drone';
import { Bot } from './Bot';
import type { FormId } from './registry';

export * from './registry';
export type { FormProps } from './parts';

/** Draw any assistant. Every form takes the same props as Nova's Fox, so the companion logic is shared. */
export function FormArt({ id, ...p }: FormProps & { id: FormId }) {
  switch (id) {
    case 'cora': return <Crab {...p} />;
    case 'lumi': return <Firefly {...p} />;
    case 'maple': return <Owl {...p} />;
    case 'yuki': return <Quad kind="husky" {...p} />;
    case 'aurora': return <Quad kind="wolf" {...p} />;
    case 'rain': return <Frog {...p} />;
    case 'nemo': return <Turtle {...p} />;
    case 'ash': return <Quad kind="cat" {...p} />;
    case 'orbit': return <Drone {...p} />;
    case 'grid': return <Bot {...p} />;
    default: return <Fox {...p} className="form-fox" />;
  }
}
