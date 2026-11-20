import * as AppIntents from 'expo-app-intents';
import type { AppIntentInvocation } from 'expo-app-intents';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useFinance } from '@/store/finance';
import { toast } from '@/store/toast';
import { brl , toKey } from './date';
import { forwardPurchase } from './financy';
import { categoryOptions, parseAmount } from './finance';

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
  const catName = str(p.categoria);
  const st0 = useFinance.getState();
  const category = categoryOptions('out', st0.base === 'financy' ? st0.fyCategories : []).some((c) => c.name === catName) ? catName : 'Outros';

  const ok = amount > 0;
  state.logIntent({ at: Date.now(), valor: str(p.valor), estabelecimento: merchant, cartao: str(p.cartao), categoria: catName, ok });
  // o Órbita não grava lançamentos: a compra vai para o Financy, que casa com a do banco
  // (mesmo valor, até 2 dias) e aplica a categoria escolhida aqui
  state.markIntentProcessed(inv.id);
  const at = new Date(inv.createdAt || Date.now());
  forwardPurchase({
    id: inv.id,
    valor: amount,
    data: toKey(at),
    hora: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    estabelecimento: merchant || undefined,
    cartao: str(p.cartao) || undefined,
    categoria: category,
  });
  return ok ? `${brl(amount)}${merchant ? ` · ${merchant}` : ''}` : `${merchant || 'Compra'} (confira o valor no Financy)`;
}

let busy: Promise<number> = Promise.resolve(0);

function process(pending: AppIntentInvocation[]) {
  busy = busy.then(async () => {
    await waitHydration();
    const added: string[] = [];
    for (const inv of pending) {
      try {
        if (inv.name === 'registrarCompra') {
          const label = handleCompra(inv);
          if (label) added.push(label);
        }
        await AppIntents.removePendingInvocationAsync(inv.id);
      } catch (e) {
        console.warn('Falha ao processar lançamento automático', e);
      }
    }
    if (added.length === 1) toast({ message: `Compra enviada ao Financy: ${added[0]}` });
    else if (added.length > 1) toast({ message: `${added.length} compras do Apple Pay enviadas ao Financy` });
    return added.length;
  });
  return busy;
}

/** Lê a fila nativa agora (também usado pelo botão "Verificar agora"). */
export async function checkPendingPurchases() {
  if (!autoCaptureAvailable) return { pending: 0, added: 0 };
  const pending = await AppIntents.getPendingInvocationsAsync();
  const added = pending.length ? await process(pending) : 0;
  return { pending: pending.length, added };
}

function useAutoCaptureNative() {
  AppIntents.useAppIntents(async (pending) => {
    await process(pending);
  });
  // O iOS roda a ação com o app fechado ou suspenso; ao voltar para o app, relê a fila.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkPendingPurchases().catch(() => {});
    });
    return () => sub.remove();
  }, []);
}
function useAutoCaptureNoop() {}

/** Chame uma vez na raiz do app. Em Expo Go/web (sem o módulo nativo) não faz nada. */
export const useAutoCapture = autoCaptureAvailable ? useAutoCaptureNative : useAutoCaptureNoop;
