// Prints the live-demo narration as JSON for scripts/keynote-voice.py.
import { DEMO_SCRIPT, demoLine } from '../src/app/demo/script';
const out: Record<string, { text: string; say: string; lang: string }[]> = {};
for (const [id, lines] of Object.entries(DEMO_SCRIPT)) out[id] = lines.map((_, b) => demoLine(id, b));
process.stdout.write(JSON.stringify(out, null, 1));
