// Prints the keynote narration as JSON for scripts/keynote-voice.py.
import { SCRIPT, lineOf } from '../src/app/keynote/script';
const out: Record<string, { text: string; say: string; lang: string }[]> = {};
for (const [id, lines] of Object.entries(SCRIPT)) out[id] = lines.map((_, b) => lineOf(id, b));
process.stdout.write(JSON.stringify(out, null, 1));
