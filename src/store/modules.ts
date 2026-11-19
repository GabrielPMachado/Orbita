/**
 * Dados dos módulos: Trabalho, Clientes, Invoices, Saúde, Academia, Estudos,
 * Filmes e Séries, Notícias, Revisão e Produtividade.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateKey } from '@/lib/date';
import { storage, uid } from '@/lib/storage';
import { createCollection, type Item } from './collection';

/* ---------- Trabalho ---------- */
export interface Project extends Item {
  name: string;
  color: string;
  clientId?: string;
  parentId?: string; // subprojeto
  description?: string;
  archived?: boolean;
}
export const useProjects = createCollection<Project>('projects');

/* ---------- Clientes ---------- */
export interface Client extends Item {
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  notes?: string;
  color: string;
  archived?: boolean;
}
export const useClients = createCollection<Client>('clients');

/* ---------- Invoices (cobranças) ---------- */
export type InvoiceStatus = 'rascunho' | 'enviada' | 'paga';
export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  price: number;
}
export interface Invoice extends Item {
  number: number;
  clientId?: string;
  title: string;
  items: InvoiceItem[];
  issueDate: DateKey;
  dueDate: DateKey;
  status: InvoiceStatus;
  paidAt?: DateKey;
  /** lançamento criado em Finanças quando foi paga */
  txId?: string;
  notes?: string;
}
export const useInvoices = createCollection<Invoice>('invoices');
export const invoiceTotal = (i: Pick<Invoice, 'items'>) => i.items.reduce((a, it) => a + it.qty * it.price, 0);

/* ---------- Saúde ---------- */
export interface Med {
  id: string;
  name: string;
  dose: string;
  time: string; // HH:MM
  log: Record<DateKey, true>;
  stock?: number;
  notificationId?: string;
  paused?: boolean;
}
interface HealthState {
  water: Record<DateKey, number>; // ml
  waterGoal: number;
  sleep: Record<DateKey, number>; // horas
  weights: { date: DateKey; kg: number }[];
  meds: Med[];
  addWater: (day: DateKey, ml: number) => void;
  setWaterGoal: (ml: number) => void;
  setSleep: (day: DateKey, h: number) => void;
  addWeight: (day: DateKey, kg: number) => void;
  removeWeight: (day: DateKey) => void;
  addMed: (m: Omit<Med, 'id' | 'log'>) => string;
  updateMed: (id: string, patch: Partial<Med>) => void;
  toggleMed: (id: string, day: DateKey) => void;
  removeMed: (id: string) => void;
}
export const useHealth = create<HealthState>()(
  persist(
    (set) => ({
      water: {},
      waterGoal: 2000,
      sleep: {},
      weights: [],
      meds: [],
      addWater: (day, ml) => set((s) => ({ water: { ...s.water, [day]: Math.max(0, (s.water[day] ?? 0) + ml) } })),
      setWaterGoal: (waterGoal) => set({ waterGoal }),
      setSleep: (day, h) => set((s) => ({ sleep: { ...s.sleep, [day]: h } })),
      addWeight: (date, kg) =>
        set((s) => ({ weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)) })),
      removeWeight: (date) => set((s) => ({ weights: s.weights.filter((w) => w.date !== date) })),
      addMed: (m) => {
        const id = uid();
        set((s) => ({ meds: [...s.meds, { ...m, id, log: {} }] }));
        return id;
      },
      updateMed: (id, patch) => set((s) => ({ meds: s.meds.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      toggleMed: (id, day) =>
        set((s) => ({
          meds: s.meds.map((m) => {
            if (m.id !== id) return m;
            const log = { ...m.log };
            const taking = !log[day];
            if (taking) log[day] = true;
            else delete log[day];
            const stock = m.stock !== undefined ? Math.max(0, m.stock + (taking ? -1 : 1)) : undefined;
            return { ...m, log, stock };
          }),
        })),
      removeMed: (id) => set((s) => ({ meds: s.meds.filter((m) => m.id !== id) })),
    }),
    { name: 'health', storage },
  ),
);

/* ---------- Academia ---------- */
export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // "10-12"
  weight: number; // kg
}
export interface Plan extends Item {
  name: string;
  focus?: string; // "Peito e tríceps"
  exercises: Exercise[];
  archived?: boolean;
}
export interface Session extends Item {
  planId: string;
  date: DateKey;
  minutes: number;
  done: string[]; // ids dos exercícios feitos
  volume: number; // kg × reps × séries (aprox.)
}
export const usePlans = createCollection<Plan>('gym-plans');
export const useSessions = createCollection<Session>('gym-sessions');

/* ---------- Estudos ---------- */
export interface Subject extends Item {
  name: string;
  color: string;
  professor?: string;
  archived?: boolean;
  /* vindos da Estácio */
  code?: string;
  grades?: Record<string, number>;
  absences?: number;
  schedule?: string;
  source?: 'estacio';
  syncedAt?: number;
}
export interface Exam extends Item {
  subjectId: string;
  title: string;
  kind: 'prova' | 'trabalho' | 'entrega';
  date: DateKey;
  grade?: number;
  weight?: number;
  notes?: string;
  /** você mexeu: a leitura da Estácio não sobrescreve título, data, nota nem anotações */
  editedAt?: number;
  /** como está no portal da Estácio */
  estacio?: EstacioExam;
}
export interface EstacioExam {
  /** AV, AVS, SM1, SM2 */
  code: string;
  /** feita · agendada · pendente (dá para agendar/fazer) · fechada (perdeu o prazo) */
  status: 'feita' | 'agendada' | 'pendente' | 'fechada';
  modo?: 'polo' | 'online';
  local?: string;
  hora?: string;
  /** janela para agendar / fazer */
  de?: DateKey;
  ate?: DateKey;
  max?: number;
  syncedAt: number;
}
export interface StudySession extends Item {
  subjectId?: string;
  date: DateKey;
  minutes: number;
  label?: string;
}
export const useSubjects = createCollection<Subject>('subjects');
export const useExams = createCollection<Exam>('exams');
/** sessões de foco (Produtividade) — também contam como estudo quando têm matéria */
export const useFocusSessions = createCollection<StudySession>('focus-sessions');

/* ---------- Filmes e Séries ---------- */
export type WatchStatus = 'quero' | 'vendo' | 'visto';
export interface Title extends Item {
  name: string;
  kind: 'filme' | 'serie';
  status: WatchStatus;
  rating?: number; // 1–5
  season?: number;
  episode?: number;
  platform?: string;
  poster?: string; // foto (lib/media)
  watchedAt?: DateKey;
  notes?: string;
  /* dados do TMDB (preenchidos ao escolher o título na busca) */
  tmdbId?: number;
  posterPath?: string;
  overview?: string;
  year?: string;
  genres?: string[];
  vote?: number;
  runtime?: number;
  seasons?: number;
  providers?: import('@/lib/tmdb').Providers;
  providersAt?: number;
}
export const useTitles = createCollection<Title>('titles');

/* ---------- Notícias ---------- */
export interface Feed {
  id: string;
  name: string;
  url: string;
  topic: string;
  enabled: boolean;
}
export const DEFAULT_FEEDS: Feed[] = [
  { id: 'g1', name: 'g1', url: 'https://g1.globo.com/rss/g1/', topic: 'Geral', enabled: true },
  { id: 'folha', name: 'Folha', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', topic: 'Geral', enabled: true },
  { id: 'tecnoblog', name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/', topic: 'Tecnologia', enabled: true },
  { id: 'canaltech', name: 'Canaltech', url: 'https://canaltech.com.br/rss/', topic: 'Tecnologia', enabled: true },
  { id: 'olhar', name: 'Olhar Digital', url: 'https://olhardigital.com.br/feed/', topic: 'Tecnologia', enabled: false },
  { id: 'infomoney', name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/', topic: 'Investimentos', enabled: true },
];
interface NewsState {
  feeds: Feed[];
  saved: { id: string; title: string; link: string; source: string; date?: string }[];
  toggleFeed: (id: string) => void;
  addFeed: (f: Omit<Feed, 'id' | 'enabled'>) => void;
  removeFeed: (id: string) => void;
  toggleSaved: (a: { title: string; link: string; source: string; date?: string }) => void;
}
export const useNews = create<NewsState>()(
  persist(
    (set) => ({
      feeds: DEFAULT_FEEDS,
      saved: [],
      toggleFeed: (id) => set((s) => ({ feeds: s.feeds.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)) })),
      addFeed: (f) => set((s) => ({ feeds: [...s.feeds, { ...f, id: uid(), enabled: true }] })),
      removeFeed: (id) => set((s) => ({ feeds: s.feeds.filter((f) => f.id !== id) })),
      toggleSaved: (a) =>
        set((s) =>
          s.saved.some((x) => x.link === a.link)
            ? { saved: s.saved.filter((x) => x.link !== a.link) }
            : { saved: [{ ...a, id: uid() }, ...s.saved].slice(0, 200) },
        ),
    }),
    { name: 'news', storage },
  ),
);

/* ---------- Revisão semanal ---------- */
export interface Review {
  good: string;
  improve: string;
  focus: string;
  rating?: number;
}
interface ReviewState {
  entries: Record<string, Review>; // chave: segunda-feira da semana (AAAA-MM-DD)
  save: (week: string, r: Partial<Review>) => void;
}
export const useReviews = create<ReviewState>()(
  persist(
    (set) => ({
      entries: {},
      save: (week, r) =>
        set((s) => {
          const base: Review = s.entries[week] ?? { good: '', improve: '', focus: '' };
          return { entries: { ...s.entries, [week]: { ...base, ...r } } };
        }),
    }),
    { name: 'reviews', storage },
  ),
);

/* ---------- Produtividade (timer de foco) ---------- */
export type FocusMode = 'foco' | 'pausa' | 'longa';
interface FocusState {
  durations: Record<FocusMode, number>; // minutos
  dailyGoal: number; // minutos
  /** timer em andamento (sobrevive ao app ir para o fundo) */
  running?: { mode: FocusMode; endsAt: number; startedAt: number; label?: string; subjectId?: string; notificationId?: string };
  paused?: { mode: FocusMode; remaining: number; label?: string; subjectId?: string };
  cycles: number; // focos completos desde a última pausa longa
  /** fase escolhida quando parado */
  mode: FocusMode;
  /** rascunho do próximo foco */
  label: string;
  subjectId?: string;
  /** emenda foco → pausa → foco sem precisar tocar */
  autoNext: boolean;
  /** conta focos concluídos (dispara o confete nas telas abertas) */
  bursts: number;
  setMode: (m: FocusMode) => void;
  setDraft: (d: { label?: string; subjectId?: string | null }) => void;
  setAutoNext: (v: boolean) => void;
  bump: () => void;
  setDuration: (m: FocusMode, min: number) => void;
  setDailyGoal: (min: number) => void;
  setRunning: (r: FocusState['running']) => void;
  setPaused: (p: FocusState['paused']) => void;
  setCycles: (n: number) => void;
}
export const useFocus = create<FocusState>()(
  persist(
    (set) => ({
      durations: { foco: 25, pausa: 5, longa: 15 },
      dailyGoal: 120,
      cycles: 0,
      mode: 'foco',
      label: '',
      autoNext: false,
      bursts: 0,
      setMode: (mode) => set({ mode }),
      setDraft: (d) => set((s) => ({ label: d.label ?? s.label, subjectId: d.subjectId === null ? undefined : (d.subjectId ?? s.subjectId) })),
      setAutoNext: (autoNext) => set({ autoNext }),
      bump: () => set((s) => ({ bursts: s.bursts + 1 })),
      setDuration: (m, min) => set((s) => ({ durations: { ...s.durations, [m]: min } })),
      setDailyGoal: (dailyGoal) => set({ dailyGoal }),
      setRunning: (running) => set({ running, paused: undefined }),
      setPaused: (paused) => set({ paused, running: undefined }),
      setCycles: (cycles) => set({ cycles }),
    }),
    { name: 'focus', storage },
  ),
);
