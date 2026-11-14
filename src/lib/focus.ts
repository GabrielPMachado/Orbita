/**
 * Motor do Pomodoro. As ações são funções soltas (usadas pela tela de Produtividade e pelo
 * Modo foco) e o `useFocusRunner` fica montado no layout raiz: ele detecta o fim do ciclo
 * mesmo que você esteja em outra tela e mantém a Live Activity sincronizada.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { today } from './date';
import { syncFocusActivity } from './nativeWidgets';
import { cancel, schedule } from './notifications';
import { useFocus, useFocusSessions, useSubjects, type FocusMode } from '@/store/modules';
import { toast } from '@/store/toast';

export const MODE_META: Record<FocusMode, { label: string; color: string; symbol: string; done: string }> = {
  foco: { label: 'Foco', color: '#F2415A', symbol: 'brain.head.profile', done: 'Foco concluído. Hora de uma pausa.' },
  pausa: { label: 'Pausa', color: '#2DD4BF', symbol: 'cup.and.saucer.fill', done: 'Pausa encerrada. Bora voltar?' },
  longa: { label: 'Pausa longa', color: '#8B5CF6', symbol: 'sofa.fill', done: 'Pausa longa encerrada.' },
};

export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const st = () => useFocus.getState();

/** fase visível agora (rodando, pausada ou a escolhida) */
export const currentMode = (f = st()): FocusMode => f.running?.mode ?? f.paused?.mode ?? f.mode;
export const totalSecs = (m: FocusMode, f = st()) => f.durations[m] * 60;
export function remainingSecs(f = st(), now = Date.now()) {
  if (f.running) return Math.max(0, (f.running.endsAt - now) / 1000);
  if (f.paused) return f.paused.remaining;
  return totalSecs(f.mode, f);
}

/** relógio que só "bate" enquanto há timer rodando */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** quantos focos terminaram desde que a tela abriu (confete só para os novos) */
export function useFreshBursts() {
  const bursts = useFocus((s) => s.bursts);
  const base = useRef(bursts);
  return bursts - base.current;
}

/* ---------- Ações ---------- */

export async function focusStart(mode: FocusMode = currentMode()) {
  const f = st();
  if (f.running) return;
  const total = totalSecs(mode, f);
  const secs = f.paused?.mode === mode ? f.paused.remaining : total;
  const label = f.paused?.label ?? (f.label.trim() || undefined);
  const subjectId = f.paused?.subjectId ?? f.subjectId;
  const endsAt = Date.now() + secs * 1000;
  const notificationId = await schedule(MODE_META[mode].done, new Date(endsAt), 'none').catch(() => undefined);
  f.setMode(mode);
  f.setRunning({ mode, endsAt, startedAt: Date.now() - (total - secs) * 1000, label, subjectId, notificationId });
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export async function focusPause() {
  const f = st();
  const r = f.running;
  if (!r) return;
  await cancel(r.notificationId);
  f.setPaused({ mode: r.mode, remaining: remainingSecs(f), label: r.label, subjectId: r.subjectId });
  Haptics.selectionAsync().catch(() => {});
}

/** Para e registra o tempo parcial de foco (se passou de 1 minuto). */
export async function focusStop() {
  const f = st();
  const mode = currentMode(f);
  const r = f.running ?? f.paused;
  if (f.running) await cancel(f.running.notificationId);
  if (mode === 'foco' && r) {
    const done = Math.floor((totalSecs(mode, f) - remainingSecs(f)) / 60);
    if (done >= 1) useFocusSessions.getState().add({ date: today(), minutes: done, label: r.label, subjectId: r.subjectId });
  }
  f.setRunning(undefined);
  f.setPaused(undefined);
}

/** Pula para a próxima fase sem registrar. */
export async function focusSkip() {
  const f = st();
  const mode = currentMode(f);
  if (f.running) await cancel(f.running.notificationId);
  f.setRunning(undefined);
  f.setPaused(undefined);
  f.setMode(mode === 'foco' ? ((f.cycles + 1) % 4 === 0 ? 'longa' : 'pausa') : 'foco');
}

/* ---------- Fim do ciclo + Live Activity ---------- */

function complete() {
  const f = st();
  const r = f.running;
  if (!r) return;
  let next: FocusMode = 'foco';
  if (r.mode === 'foco') {
    useFocusSessions.getState().add({ date: today(), minutes: Math.round((r.endsAt - r.startedAt) / 60000), label: r.label, subjectId: r.subjectId });
    const cycles = f.cycles + 1;
    f.setCycles(cycles % 4);
    next = cycles % 4 === 0 ? 'longa' : 'pausa';
    f.bump();
    toast({ message: MODE_META.foco.done });
  } else {
    toast({ message: 'Pausa encerrada. Bora?', kind: 'info' });
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  f.setRunning(undefined);
  f.setMode(next);
  if (f.autoNext && AppState.currentState === 'active') {
    // mantém o rótulo do foco para o próximo ciclo
    if (next === 'foco') f.setDraft({ label: r.label ?? '', subjectId: r.subjectId ?? null });
    focusStart(next);
  }
}

function activityProps(f = st()) {
  const r = f.running;
  const p = f.paused;
  if (!r && !p) return null;
  const mode = (r ?? p)!.mode;
  const meta = MODE_META[mode];
  const total = totalSecs(mode, f);
  const rem = remainingSecs(f);
  const subj = (r ?? p)!.subjectId ? useSubjects.getState().items.find((s) => s.id === (r ?? p)!.subjectId)?.name : undefined;
  const titulo = mode === 'foco' ? ((r ?? p)!.label ?? subj ?? 'Tempo de foco') : mode === 'longa' ? 'Respira, levanta, alonga' : 'Respira um pouco';
  return {
    fase: meta.label,
    icone: meta.symbol,
    cor: meta.color,
    titulo,
    ciclo: mode === 'foco' ? `Ciclo ${f.cycles + 1} de 4` : mode === 'longa' ? 'Ciclo 4 de 4' : `Ciclo ${Math.max(1, f.cycles)} de 4`,
    inicio: r ? r.startedAt : Date.now() - (total - rem) * 1000,
    fim: r ? r.endsAt : Date.now() + rem * 1000,
    pausado: !r,
    restante: clock(rem),
    progresso: Math.max(0, Math.min(1, 1 - rem / total)),
  };
}

/** Montado uma vez no layout raiz. */
export function useFocusRunner() {
  const running = useFocus((s) => s.running);
  const paused = useFocus((s) => s.paused);

  // fim do ciclo (também quando o app volta do fundo depois do horário)
  useEffect(() => {
    if (!running) return;
    const check = () => {
      if (st().running && Date.now() >= st().running!.endsAt) complete();
    };
    check();
    const t = setInterval(check, 1000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [running]);

  // Live Activity acompanha o estado
  useEffect(() => {
    syncFocusActivity(activityProps());
  }, [running, paused]);
}
