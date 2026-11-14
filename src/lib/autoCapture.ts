import * as AppIntents from 'expo-app-intents';
import type { AppIntentInvocation } from 'expo-app-intents';
import { useFinance } from '@/store/finance';
import { toKey } from './date';
import { CATEGORIES, normalizeName, parseAmount } from './finance';

/**
 * Lançamentos automáticos (Apple Pay → app Atalhos → "Registrar compra").
 * O Swift (app-intents/RegistrarCompraIntent.swift) guarda cada compra numa fila nativa
 * sem abrir o app; aqui elas viram lançamentos assim que o JavaScript sobe.
 */
export const autoCaptureAvailable = AppIntents.isAvailable();

function waitHydration(): Promise<void> {
  if (useFinance.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useFinance.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function handleCompra(inv: AppIntentInvocation) {
  const state = useFinance.getState();
  if (state.processedIntents.includes(inv.id)) return;

  const p = (inv.params ?? {}) as Record<string, unknown>;
  const amount = parseAmount(str(p.valor));
  const merchant = str(p.estabelecimento).trim();
  const cardName = normalizeName(str(p.cartao));
  const catName = str(p.categoria);
  const category = CATEGORIES.out.some((c) => c.name === catName) ? catName : 'Outros';

  // casa o nome do cartão da Carteira com um cartão/conta cadastrado
  const matches = (name: string) => {
    const n = normalizeName(name);
    return !!cardName && !!n && (cardName.includes(n) || n.includes(cardName));
  };
  const card = state.cards.find((k) => matches(k.name));
  const account = card ? undefined : state.accounts.find((a) => matches(a.name));

  if (amount > 0) {
    state.addTx({
      type: 'out',
      amount,
      category,
      description: merchant,
      date: toKey(new Date(inv.createdAt || Date.now())),
      cardId: card?.id,
      accountId: account?.id,
      source: 'applepay',
      notes: !card && !account && p.cartao ? `Cartão na Carteira: ${str(p.cartao)}` : undefined,
    });
  }
  state.markIntentProcessed(inv.id);
}

async function process(pending: AppIntentInvocation[]) {
  await waitHydration();
  for (const inv of pending) {
    try {
      if (inv.name === 'registrarCompra') handleCompra(inv);
      await AppIntents.removePendingInvocationAsync(inv.id);
    } catch (e) {
      console.warn('Falha ao processar lançamento automático', e);
    }
  }
}

function useAutoCaptureNative() {
  AppIntents.useAppIntents(async (pending) => {
    await process(pending);
  });
}
function useAutoCaptureNoop() {}

/** Chame uma vez na raiz do app. Em Expo Go/web (sem o módulo nativo) não faz nada. */
export const useAutoCapture = autoCaptureAvailable ? useAutoCaptureNative : useAutoCaptureNoop;
