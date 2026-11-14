/** Datas como string local "AAAA-MM-DD" para não sofrer com fuso horário. */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export const today = () => toKey();

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export { WEEKDAYS, WEEKDAYS_SHORT };

/** "Hoje", "Amanhã", "sex, 20 nov"… */
export function friendlyDate(key: DateKey): string {
  const t = today();
  if (key === t) return 'Hoje';
  if (key === toKey(addDays(new Date(), 1))) return 'Amanhã';
  if (key === toKey(addDays(new Date(), -1))) return 'Ontem';
  const d = fromKey(key);
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longToday(): string {
  const d = new Date();
  const wd = WEEKDAYS[d.getDay()];
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function lastNDays(n: number): DateKey[] {
  const out: DateKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toKey(addDays(new Date(), -i)));
  return out;
}

export const brl = (v: number) =>
  'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Segunda-feira da semana de uma data. */
export function weekStart(d = new Date()): DateKey {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return toKey(r);
}
