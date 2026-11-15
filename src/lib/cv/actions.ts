'use server';

import Anthropic from '@anthropic-ai/sdk';
import { getViewer } from '@/lib/data';
import { aiEnabled } from '@/lib/engine/ai';
import { ACTION_VERBS, GOAL_STATEMENT, type CVGoal } from './model';

/**
 * CV writing help. With AI on, Claude rewrites what the student wrote into professional,
 * honest CV language (never adding facts they didn't give). Without AI, a clean template.
 */
export async function cvAssist(input: {
  kind: 'statement' | 'bullet'; goal: CVGoal; target?: string; text?: string; role?: string; org?: string;
  facts?: { grade?: string; program?: string; skills?: string[]; experience?: string[] }; locale?: string;
}): Promise<{ text: string; ai: boolean; error?: string }> {
  const v = await getViewer();
  if (!v) return { text: '', ai: false, error: 'signin' };
  const lang = input.locale === 'es' ? 'Spanish' : 'English';
  const text = (input.text ?? '').slice(0, 600);

  if (!aiEnabled()) return { text: fallback(input), ai: false };
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
    const rules = [
      'You help a high school student write a one-page CV for a summer job, part-time job, internship, training program or volunteering.',
      'Rules: use ONLY facts the student gave. Never invent employers, numbers, awards, certifications or dates. Keep it honest and age-appropriate.',
      'Plain, confident, professional language a hiring manager trusts. No buzzwords, no emojis, no first-person pronouns in bullets.',
      `Write in ${lang}.`,
    ].join('\n');
    const task = input.kind === 'statement'
      ? `Write a 2–3 sentence CV profile (max 55 words) for this goal: ${input.goal.replace('_', ' ')}${input.target ? ` (${input.target})` : ''}.
Facts: grade/program: ${[input.facts?.grade, input.facts?.program].filter(Boolean).join(', ') || 'high school student'}; skills: ${(input.facts?.skills ?? []).slice(0, 12).join(', ') || 'not given'}; experience: ${(input.facts?.experience ?? []).slice(0, 6).join('; ') || 'not given'}.
${text ? `The student's draft (improve it, keep their meaning): "${text}"` : ''}
Return only the profile text.`
      : `Rewrite this CV bullet for the role "${input.role ?? ''}"${input.org ? ` at ${input.org}` : ''} as ONE bullet that starts with a strong past-tense action verb, max 22 words, keeping every fact and adding none: "${text}". Return only the bullet, no leading dash.`;
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 300, system: rules,
      messages: [{ role: 'user', content: task }],
    }, { timeout: 25_000 });
    const out = res.content.find((b) => b.type === 'text');
    const clean = out && out.type === 'text' ? out.text.trim().replace(/^["“•\-–\s]+|["”\s]+$/g, '') : '';
    return clean ? { text: clean.slice(0, 600), ai: true } : { text: fallback(input), ai: false };
  } catch (e) {
    console.error('cvAssist:', (e as Error).message);
    return { text: fallback(input), ai: false };
  }
}

function fallback(input: Parameters<typeof cvAssist>[0]) {
  if (input.kind === 'statement') {
    const base = GOAL_STATEMENT[input.goal];
    const skills = (input.facts?.skills ?? []).slice(0, 3);
    return skills.length ? `${base} Skilled in ${skills.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : base;
  }
  const t = (input.text ?? '').trim().replace(/^[-•\s]+/, '').replace(/\.$/, '');
  if (!t) return '';
  const first = t.split(/\s+/)[0];
  const starts = ACTION_VERBS.some((v) => v.toLowerCase() === first.toLowerCase());
  const body = starts ? t : `Helped ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  return body.charAt(0).toUpperCase() + body.slice(1);
}
