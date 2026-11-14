/**
 * Ponte entre o app e os widgets nativos (expo-widgets).
 *
 * Os módulos de widget só existem no build nativo (IPA). No Expo Go e na prévia web o require
 * falha ou cai num stub — por isso tudo aqui é carregado de forma preguiçosa e silenciosa.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { brl } from './date';
import { currentBalance, monthTotals, thisMonth } from './finance';
import { useFinance } from '@/store/finance';
import { useSettings } from '@/store/settings';
import { ACCENTS } from '@/theme';
import type { SaldoProps } from '@/widgets/SaldoWidget';
import type { FocoProps } from '@/widgets/FocoActivity';

type WidgetLike = { updateSnapshot: (p: SaldoProps) => void };
type ActivityLike = { update: (p: FocoProps) => Promise<void>; end: (policy?: 'default' | 'immediate') => Promise<void> };
type ActivityFactoryLike = { start: (p: FocoProps, url?: string) => ActivityLike; getInstances: () => ActivityLike[] };

let saldo: WidgetLike | null | undefined;
let foco: ActivityFactoryLike | null | undefined;

function load<T>(get: () => T): T | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return get();
  } catch {
    return null; // Expo Go ou build sem a extensão
  }
}
const saldoWidget = () => (saldo === undefined ? (saldo = load(() => require('@/widgets/SaldoWidget').default as WidgetLike)) : saldo);
const focoActivity = () => (foco === undefined ? (foco = load(() => require('@/widgets/FocoActivity').default as ActivityFactoryLike)) : foco);

/* ---------- Widget de saldo ---------- */

/** "R$ 4,2 mil" / "R$ 980" — cabe no widget circular */
export function brlShort(v: number) {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (a >= 10_000) return `${sign}${Math.round(a / 1000)} mil`;
  if (a >= 1000) return `${sign}${(a / 1000).toFixed(1).replace('.', ',')} mil`;
  return `${sign}${Math.round(a)}`;
}

export function saldoProps(): SaldoProps {
  const { accounts, txs } = useFinance.getState();
  const { widgetHidden, accent } = useSettings.getState();
  const bal = currentBalance(accounts, txs);
  const m = monthTotals(txs, thisMonth());
  const now = new Date();
  return {
    saldo: brl(bal),
    saldoCurto: brlShort(bal),
    mes: `${m.net >= 0 ? '+' : '−'} ${brl(Math.abs(m.net))}`,
    mesPositivo: m.net >= 0,
    detalhe: `Entradas ${brl(m.income)} · Saídas ${brl(m.expense)}`,
    atualizado: `Atualizado ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    oculto: widgetHidden,
    cor: ACCENTS[accent].color,
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function refreshBalanceWidget() {
  const w = saldoWidget();
  if (!w) return;
  clearTimeout(timer);
  // agrupa várias mudanças seguidas numa atualização só (o iOS limita as recargas)
  timer = setTimeout(() => {
    try {
      w.updateSnapshot(saldoProps());
    } catch {}
  }, 800);
}

/** Mantém o widget de saldo em dia: atualiza ao abrir o app e a cada mudança nas finanças. */
export function useBalanceWidgetSync() {
  useEffect(() => {
    if (!saldoWidget()) return;
    refreshBalanceWidget();
    const a = useFinance.subscribe((s, prev) => {
      if (s.txs !== prev.txs || s.accounts !== prev.accounts) refreshBalanceWidget();
    });
    const b = useSettings.subscribe((s, prev) => {
      if (s.widgetHidden !== prev.widgetHidden || s.accent !== prev.accent) refreshBalanceWidget();
    });
    return () => {
      a();
      b();
    };
  }, []);
}

/* ---------- Live Activity do foco ---------- */

let current: ActivityLike | null = null;

export const liveActivitiesAvailable = () => !!focoActivity();

/** Mostra/atualiza/encerra a Live Activity. `null` encerra. */
export async function syncFocusActivity(p: FocoProps | null) {
  const f = focoActivity();
  if (!f) return;
  try {
    if (!current) current = f.getInstances()[0] ?? null;
    if (!p) {
      if (current) await current.end('immediate');
      current = null;
      return;
    }
    if (current) await current.update(p);
    else current = f.start(p, 'orbita://foco');
  } catch {
    current = null;
  }
}
