import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { addDays, toKey } from '@/lib/date';
import { openFinancy } from '@/lib/financy';

/**
 * Lançar é no Financy: o Órbita só lê as finanças de lá. Quem chama /financas/novo (check-in,
 * simulador, boletos…) cai aqui e o Financy abre já com o que der para preencher.
 */
export default function NovoLancamento() {
  const p = useLocalSearchParams<{ type?: 'in' | 'out'; amount?: string; category?: string; description?: string; date?: string }>();
  useEffect(() => {
    const data = p.date === 'ontem' ? toKey(addDays(new Date(), -1)) : p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : undefined;
    openFinancy({
      action: 'novo',
      tipo: p.type === 'in' ? 'income' : 'expense',
      valor: p.amount ? Number(p.amount) : undefined,
      descricao: p.description,
      categoria: p.category,
      data,
    });
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/financas')), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <View />;
}
