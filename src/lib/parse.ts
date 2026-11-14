import { addDays, toKey, type DateKey } from './date';

export type Priority = 'alta' | 'media' | 'baixa';

export interface ParsedInput {
  title: string;
  due?: DateKey;
  time?: string; // "HH:MM"
  tags: string[];
  priority?: Priority;
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const WD: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sab: 6,
};

/**
 * Entende frases como:
 *  "pagar boleto amanhã 15h #casa !alta"
 *  "reunião sexta às 10:30 #trabalho"
 *  "dentista dia 20 14h", "prova 05/12", "estudar em 3 dias"
 */
export function parseInput(raw: string, now = new Date()): ParsedInput {
  let text = ` ${raw.trim()} `;
  const tags: string[] = [];
  let priority: Priority | undefined;
  let due: DateKey | undefined;
  let time: string | undefined;

  const cut = (re: RegExp) => {
    text = text.replace(re, ' ');
  };

  // #tags
  text = text.replace(/\s#([\p{L}\p{N}_-]+)/gu, (_, t: string) => {
    tags.push(t.toLowerCase());
    return ' ';
  });

  // !prioridade
  const pr = text.match(/\s!(alta|a|1|media|média|m|2|baixa|b|3)(?=\s)/i);
  if (pr) {
    const v = strip(pr[1]);
    priority = v.startsWith('a') || v === '1' ? 'alta' : v.startsWith('m') || v === '2' ? 'media' : 'baixa';
    cut(new RegExp(pr[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } else if (/\surgente\s/i.test(text)) {
    priority = 'alta';
  }

  const s = () => strip(text);

  // horário: "às 15h30", "15h", "15:30", "as 9"
  const tm = s().match(/\s(?:as\s+|a\s+)?(\d{1,2})(?:(?:h|:)(\d{2})?|h)(?=\s)/) ?? s().match(/\sas\s+(\d{1,2})(?=\s)/);
  if (tm) {
    const h = Number(tm[1]);
    const m = Number(tm[2] ?? 0);
    if (h < 24 && m < 60) {
      time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      text = text.slice(0, tm.index!) + ' ' + text.slice(tm.index! + tm[0].length);
    }
  }

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => Date | undefined) => {
    if (due) return;
    const m = s().match(re);
    if (!m) return;
    const d = fn(m);
    if (!d) return;
    due = toKey(d);
    text = text.slice(0, m.index!) + ' ' + text.slice(m.index! + m[0].length);
  };

  take(/\sdepois de amanha(?=\s)/, () => addDays(now, 2));
  take(/\samanha(?=\s)/, () => addDays(now, 1));
  take(/\shoje(?=\s)/, () => now);
  take(/\s(?:em|daqui(?: a)?)\s+(\d+)\s+(dias?|semanas?)(?=\s)/, (m) =>
    addDays(now, Number(m[1]) * (m[2].startsWith('semana') ? 7 : 1)),
  );
  take(/\s(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    let y = m[3] ? Number(m[3]) : now.getFullYear();
    if (y < 100) y += 2000;
    let r = new Date(y, mo, d);
    if (!m[3] && r < new Date(now.getFullYear(), now.getMonth(), now.getDate())) r = new Date(y + 1, mo, d);
    return r.getMonth() === mo ? r : undefined;
  });
  take(/\sdia\s+(\d{1,2})(?=\s)/, (m) => {
    const d = Number(m[1]);
    if (d < 1 || d > 31) return undefined;
    let r = new Date(now.getFullYear(), now.getMonth(), d);
    if (d < now.getDate()) r = new Date(now.getFullYear(), now.getMonth() + 1, d);
    return r;
  });
  take(/\s(?:na |no |nesta |neste |proxima |proximo )?(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)(?:-feira)?(?=\s)/, (m) => {
    const target = WD[m[1]];
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(now, diff);
  });

  // horário sem data → hoje (ou amanhã se já passou)
  if (time && !due) {
    const [h, m] = time.split(':').map(Number);
    const passed = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
    due = toKey(passed ? addDays(now, 1) : now);
  }

  const title = text.replace(/\s+/g, ' ').trim().replace(/\s(e|as|às|na|no|de|para|pra)$/i, '');
  return { title: title.charAt(0).toUpperCase() + title.slice(1), due, time, tags, priority };
}
