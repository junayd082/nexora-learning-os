/**
 * Nova's brain: no AI service, no data leaves NEXORA. It reads the class brief
 * (nova_brief RPC — already filtered by the student's own permissions) and answers
 * the questions students actually ask at the start of class.
 */
import type { Tag } from '@/lib/types';

export interface BriefItem {
  type: 'material' | 'assignment'; id: string; kind: string; title: string;
  tag: Tag | null; due_at: string | null; status?: 'submitted' | 'returned' | null;
  /** Optional Do Now / Exit ticket timer set by the teacher. */
  timer_minutes?: number | null; timer_mode?: 'manual' | 'bell' | null;
}
export interface BriefClass {
  id: string; name: string; section: string | null; teacher: boolean; today: string;
  items: BriefItem[]; due: BriefItem[]; prev_date: string | null; missed: BriefItem[];
  update: { body: string; created_at: string; pinned: boolean } | null; ungraded: number | null;
}
export interface Brief { classes: BriefClass[]; name: string | null; educator: boolean }

export type Intent =
  | 'tour' | 'today' | 'do_now' | 'lecture' | 'due' | 'missed' | 'submit' | 'grades' | 'where' | 'apps' | 'join' | 'update'
  | 'ungraded' | 'add_do_now' | 'raise_hand' | 'hall_pass' | 'start_timer' | 'see_hands' | 'see_passes' | 'hello' | 'thanks' | 'who' | 'joke' | 'help'
  | 'play_pet' | 'play_treat' | 'play_ball' | 'play_trick' | 'play_howl' | 'unknown';

export interface Link_ { label: string; href: string }
export interface Group { title: string; items: { item: BriefItem; classId: string; href: string }[]; empty?: string }
export interface Answer {
  text?: string; groups?: Group[]; steps?: string[]; links?: Link_[];
  search?: string; play?: 'pet' | 'treat' | 'ball' | 'trick' | 'howl';
}

type T = (key: string, values?: Record<string, string | number>) => string;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s?]/g, ' ').replace(/\s+/g, ' ').trim();

// Order matters: the first rule that matches wins.
const RULES: [Intent, RegExp][] = [
  ['tour', /\b(guide me|tour|show me around|how (do i|to) use (this|nexora|the app|the site)|where is everything|get started|guiame|recorrido|como (uso|se usa))/],
  ['play_pet', /\b(pet|pat|cuddle|hug|acaricia|abraz)/],
  ['play_treat', /\b(treat|snack|food|feed|hungry|premio|comida|hambre)/],
  ['play_ball', /\b(ball|fetch|pelota)/],
  ['play_trick', /\b(trick|flip|dance|backflip|truco|baila)/],
  ['play_howl', /\b(howl|awoo|sing|hoot|croak|ribbit|meow|beep|ping|glow|bark|snap|bubble|aull|canta|ulula|croa|miau|ladra|brilla|burbuja)/],
  ['start_timer', /\b(start|set|run|open)\b.{0,20}\b(timer|countdown|stopwatch)|^timer\b|\b(temporizador|cronometro)\b/],
  ['see_passes', /\b(who is out|whos out|who s out|pass (requests?|board)|hall passes|passes|quien (esta|salio) fuera|pases)\b/],
  ['see_hands', /\b(raised hands?|who (raised|needs help)|hands up|manos levantadas|quien necesita ayuda)\b/],
  ['hall_pass', /\b(hall ?pass|bathroom|restroom|rest room|lavatory|toilet|washroom|pee|potty|(get|need) (some )?water|water fountain|go to the (nurse|office|clinic)|nurse|(can|may) i (go|leave|step out)|pase|bano|servicio|tomar agua|ir por agua|enfermer|puedo (ir|salir))/],
  ['raise_hand', /\b(raise (my )?hand|hand up|need (some )?help|help me|i ?m stuck|im stuck|stuck|confused|dont (get|understand)|do not (get|understand)|ask (the |my )?teacher|call (the |my )?teacher|levantar (la )?mano|necesito ayuda|ayudame|no entiendo|estoy (atorad|atascad|perdid|confundid)|llamar (al|a la) (maestr|profe))/],
  ['add_do_now', /\b(add|post|create|make|set|agregar|publicar|crear)\b.*\b(do ?now|warm ?up|bell ?ringer|haz ahora)/],
  ['ungraded', /\b(ungraded|to grade|grading|need grading|sin calificar|por calificar)/],
  ['do_now', /\b(do ?now|donow|warm ?up|bell ?ringer|starter|haz ahora|calentamiento)/],
  ['lecture', /\b(lecture|lesson|slides|notes|presentation|powerpoint|teaching|leccion|clase de hoy|diapositivas|apuntes|presentacion)/],
  ['missed', /\b(miss|missed|absent|yesterday|last class|was out|falte|perdi|ayer|ausente)/],
  ['due', /\b(tengo que entregar|debo entregar|hay que entregar|whats due|what is due)/],
  ['submit', /\b(submit|turn in|turn it in|hand in|upload|attach|entregar|entrego|subir|adjuntar)/],
  ['due', /\b(due|homework|deadline|late|missing|overdue|tarea|tareas pendientes|pendiente|vence|atrasad|entrega)/],
  ['grades', /\b(grade|grades|score|points|feedback|calificacion|nota|puntos)/],
  ['apps', /\b(schoology|autocad|tinkercad|google|canva|kahoot|quizlet|app|apps|tool|tools|herramienta)/],
  ['join', /\b(join|class code|code|unir|codigo)/],
  ['update', /\b(announcement|update|news|anuncio|noticia)/],
  ['where', /\b(where|find|assignment|assignments|file|files|worksheet|donde|encuentro|asignacion|archivo|hoja)/],
  ['today', /\b(today|doing|agenda|plan|class|hoy|hacemos|clase)\b/],
  ['who', /\b(who are you|your name|what are you|quien eres|como te llamas)/],
  ['joke', /\b(joke|funny|chiste|broma)/],
  ['thanks', /\b(thanks|thank you|thx|ty|gracias)/],
  ['hello', /^(hi|hello|hey|yo|sup|hola|buenas)\b/],
  ['help', /\b(help|what can you do|ayuda|que puedes)/],
];

export function detect(text: string): Intent {
  const s = norm(text);
  if (!s) return 'help';
  for (const [intent, re] of RULES) if (re.test(s)) return intent;
  return 'unknown';
}

export function hrefFor(classId: string, i: BriefItem) {
  if (i.type === 'assignment') return `/assignments/${i.id}`;
  if (i.kind === 'folder') return `/classes/${classId}?tab=materials&folder=${i.id}`;
  return `/classes/${classId}/m/${i.id}`;
}

const ORDER: (Tag | null)[] = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource', null];
const byTag = (a: BriefItem, b: BriefItem) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag);

/** If the question names one of the classes, answer only for that class. */
function pickClasses(brief: Brief, text: string) {
  const s = norm(text);
  const hit = brief.classes.filter((c) => {
    const words = norm(`${c.name} ${c.section ?? ''}`).split(' ').filter((w) => w.length > 3);
    return words.some((w) => s.includes(w));
  });
  return hit.length ? hit : brief.classes;
}

const group = (c: BriefClass, title: string, items: BriefItem[], empty?: string): Group =>
  ({ title, empty, items: items.map((item) => ({ item, classId: c.id, href: hrefFor(c.id, item) })) });

/** With several classes, drop the "nothing here" groups when another class has an answer. */
const focus = (groups: Group[]) => (groups.some((g) => g.items.length) ? groups.filter((g) => g.items.length) : groups);

export function answer(intent: Intent, brief: Brief | null, text: string, t: T, fmtDay: (d: string) => string,
  who: { name: string; animal: string } = { name: 'Nova', animal: 'fox' }): Answer {
  const { name, animal } = who;
  switch (intent) {
    case 'play_pet': return { play: 'pet' };
    case 'play_treat': return { play: 'treat' };
    case 'play_ball': return { play: 'ball' };
    case 'play_trick': return { play: 'trick' };
    case 'play_howl': return { play: 'howl' };
    case 'who': return { text: t('a.who', { name, animal }) };
    case 'raise_hand': return { text: t('a.raiseHand') };
    case 'hall_pass': return { text: t('a.hallPass') };
    case 'start_timer': case 'see_hands': case 'see_passes': return { text: t('a.teacherTools') };
    case 'help': return { text: t('a.help') };
    case 'hello': return { text: t('a.hello') };
    case 'thanks': return { text: t(`a.thanks${1 + Math.floor(Math.random() * 3)}`) };
    case 'joke': return { text: t(`a.joke${1 + Math.floor(Math.random() * 4)}`) };
    case 'join': return { text: t('a.join'), links: [{ label: t('joinClass'), href: '/join' }] };
  }
  if (!brief) return { text: t('signedOut'), links: [{ label: t('signIn'), href: '/login' }] };
  if (!brief.classes.length) {
    return brief.educator
      ? { text: t('noClassesTeacher'), links: [{ label: t('createClass'), href: '/classes' }] }
      : { text: t('noClassesStudent'), links: [{ label: t('joinClass'), href: '/join' }] };
  }
  const cs = pickClasses(brief, text);
  const multi = cs.length > 1;
  const titleFor = (c: BriefClass, base: string) => (multi ? `${base} · ${c.name}` : base);

  switch (intent) {
    case 'do_now':
      return { groups: focus(cs.map((c) => group(c, titleFor(c, t('a.doNow')), c.items.filter((i) => i.tag === 'do_now'), t('a.noDoNow', { cls: c.name })))) };
    case 'lecture':
      return { groups: focus(cs.map((c) => {
        const lec = c.items.filter((i) => i.tag === 'lecture');
        return lec.length || !c.items.length
          ? group(c, titleFor(c, t('a.lecture')), lec, t('a.noLecture', { cls: c.name }))
          : group(c, t('a.todayIn', { cls: c.name }), [...c.items].sort(byTag), t('a.noLecture', { cls: c.name }));
      })) };
    case 'today': {
      const busy = cs.filter((c) => c.items.length);
      const show = busy.length ? busy : cs;
      return {
        groups: show.map((c) => group(c, t('a.todayIn', { cls: c.name }), [...c.items].sort(byTag), t('a.nothingToday', { cls: c.name }))),
        text: show.map((c) => c.update?.pinned ? `📌 ${c.update.body}` : '').filter(Boolean).join('\n') || undefined,
      };
    }
    case 'due': {
      const groups = cs.map((c) => group(c, titleFor(c, t('a.due')),
        c.due.filter((i) => c.teacher || i.status !== 'returned'))).filter((g) => g.items.length);
      return groups.length ? { groups } : { text: t('a.nothingDue') };
    }
    case 'missed':
      return { groups: focus(cs.map((c) => c.prev_date
        ? group(c, t('a.missed', { cls: c.name, date: fmtDay(c.prev_date) }), [...c.missed].sort(byTag))
        : group(c, c.name, [], t('a.nothingMissed', { cls: c.name })))) };
    case 'submit': {
      const next = cs.flatMap((c) => c.due.filter((i) => i.type === 'assignment' && !i.status).map((i) => ({ c, i })))
        .sort((a, b) => (a.i.due_at ?? '').localeCompare(b.i.due_at ?? ''))[0];
      return {
        text: t('a.submitIntro'), steps: [t('a.s1'), t('a.s2'), t('a.s3'), t('a.s4')],
        groups: next ? [group(next.c, t('a.submitNext'), [next.i])] : undefined,
      };
    }
    case 'grades':
      return { text: t('a.grades'), links: cs.map((c) => ({ label: t('a.openGrades', { cls: c.name }), href: `/classes/${c.id}?tab=gradebook` })) };
    case 'where':
      return { text: t('a.where'), links: [...cs.map((c) => ({ label: t('a.openMaterials', { cls: c.name }), href: `/classes/${c.id}?tab=materials` })), { label: t('a.homeDue'), href: '/home#due' }] };
    case 'apps':
      return { text: t('a.apps'), links: [...cs.map((c) => ({ label: t('a.openApps', { cls: c.name }), href: `/classes/${c.id}?tab=apps` })), { label: t('a.allApps'), href: '/apps' }] };
    case 'update':
      return { text: cs.map((c) => c.update ? `${t('a.update', { cls: c.name })}: ${c.update.body}` : t('a.noUpdate', { cls: c.name })).join('\n\n'),
        links: cs.map((c) => ({ label: c.name, href: `/classes/${c.id}?tab=updates` })) };
    case 'ungraded': {
      const mine = cs.filter((c) => c.teacher);
      if (!mine.length) return { text: t('a.grades'), links: cs.map((c) => ({ label: t('a.openGrades', { cls: c.name }), href: `/classes/${c.id}?tab=gradebook` })) };
      return { text: mine.map((c) => t('a.ungraded', { count: c.ungraded ?? 0, cls: c.name })).join('\n'),
        links: mine.map((c) => ({ label: t('a.openGradebook', { cls: c.name }), href: `/classes/${c.id}?tab=gradebook` })) };
    }
    case 'add_do_now':
      return { text: t('a.addDoNow'), links: cs.filter((c) => c.teacher).map((c) => ({ label: t('a.openClass', { cls: c.name }), href: `/classes/${c.id}?tab=materials` })) };
    default: {
      const q = text.trim().slice(0, 60);
      return { text: t('a.unknown', { q }), search: q };
    }
  }
}

/** The one-line nudge Nova says when a student arrives (null when nothing is on). */
export function nudge(brief: Brief | null, t: T): string | null {
  if (!brief) return null;
  const today = brief.classes.flatMap((c) => c.items);
  const doNow = today.find((i) => i.tag === 'do_now' && !i.status);
  if (doNow) return t('bubbleTag', { tag: t('tags.do_now'), title: doNow.title });
  const open = today.filter((i) => !i.status);
  if (open.length) return t('bubbleToday', { count: open.length });
  const soon = brief.classes.flatMap((c) => c.due.filter((i) => !c.teacher && !i.status));
  if (soon.length) return t('bubbleDue', { count: soon.length });
  return null;
}
