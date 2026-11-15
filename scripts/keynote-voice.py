#!/usr/bin/env python3
"""
Record the keynote narration with Kokoro-82M (Apache-2.0), a neural text-to-speech model.

  1. npx tsx scripts/keynote-script.ts > /tmp/script.json   (dumps src/app/keynote/script.ts)
  2. python3 scripts/keynote-voice.py /tmp/script.json <kokoro.onnx> <voices.bin> public/keynote/voice

Each build's line becomes <out>/<voice>/<scene>-<build>.mp3. An ellipsis (…) in a line becomes a
real held pause; every clip is trimmed, faded and loudness-normalised (−16 LUFS) so lines match.
Needs: pip install kokoro-onnx soundfile numpy, and ffmpeg.
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

VOICES = {  # id → (kokoro voice, speed, language)
    'heart': ('af_heart', 0.97, 'en-us'),
    'michael': ('am_michael', 0.94, 'en-us'),
}
HELD = 0.62      # pause for an ellipsis, seconds
LEAD = 0.06

def trim(a, sr, thr=0.008):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a[:0]
    s, e = max(0, idx[0] - int(0.02 * sr)), min(len(a), idx[-1] + int(0.12 * sr))
    return a[s:e]

def fade(a, sr, ms=12):
    n = min(len(a) // 2, int(sr * ms / 1000))
    if n > 0:
        a[:n] *= np.linspace(0, 1, n); a[-n:] *= np.linspace(1, 0, n)
    return a

def main(script_json, model, voices, out):
    script = json.load(open(script_json))
    k = Kokoro(model, voices)
    manifest = {}
    for vid, (kv, speed, lang) in VOICES.items():
        os.makedirs(os.path.join(out, vid), exist_ok=True)
        manifest[vid] = {}
        for scene, lines in script.items():
            for b, line in enumerate(lines):
                say = line['say'].strip()
                if not say: continue
                segs = [x.strip() for x in re.split(r'…', say) if x.strip()]
                parts, sr = [], 24000
                for i, seg in enumerate(segs):
                    seg_lang = 'es' if (line.get('lang') == 'es' and i == len(segs) - 1) else lang
                    a, sr = k.create(seg, voice=kv, speed=speed, lang=seg_lang)
                    a = fade(trim(np.asarray(a, dtype=np.float32), sr), sr)
                    parts.append(a)
                    if i < len(segs) - 1: parts.append(np.zeros(int(HELD * sr), dtype=np.float32))
                audio = np.concatenate([np.zeros(int(LEAD * sr), dtype=np.float32), *parts, np.zeros(int(0.1 * sr), dtype=np.float32)])
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
                    sf.write(t.name, audio, sr)
                dst = os.path.join(out, vid, f'{scene}-{b}.mp3')
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', t.name,
                                '-af', 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '24000', '-ac', '1',
                                '-c:a', 'libmp3lame', '-b:a', '96k', dst], check=True)
                os.unlink(t.name)
                manifest[vid][f'{scene}-{b}'] = round(len(audio) / sr, 2)
                print(vid, f'{scene}-{b}', manifest[vid][f'{scene}-{b}'], 's', flush=True)
    json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=0)

if __name__ == '__main__':
    main(*sys.argv[1:5])
