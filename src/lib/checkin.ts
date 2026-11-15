import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { today } from './date';
import { useCheckin } from '@/store/checkin';

function hydrated() {
  return useCheckin.persist.hasHydrated();
}

/** Abre o check-in na primeira abertura de cada dia. Montado no layout das abas. */
export function useDailyCheckin() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const maybeOpen = () => {
      const s = useCheckin.getState();
      const day = today();
      if (!s.enabled || s.lastPrompt === day) return;
      s.markPrompted(day); // pulou ou fez: só pergunta uma vez por dia
      clearTimeout(timer);
      timer = setTimeout(() => router.push('/checkin'), 700);
    };
    const start = () => maybeOpen();
    const unsub = hydrated() ? (start(), undefined) : useCheckin.persist.onFinishHydration(start);
    const sub = AppState.addEventListener('change', (a) => a === 'active' && hydrated() && maybeOpen());
    return () => {
      clearTimeout(timer);
      unsub?.();
      sub.remove();
    };
  }, []);
}
