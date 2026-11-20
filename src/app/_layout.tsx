import { EstacioBackground } from '@/components/EstacioBackground';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import '@/lib/notifications';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/motion';
import { useAutoCapture } from '@/lib/autoCapture';
import { useFocusRunner } from '@/lib/focus';
import { useBalanceWidgetSync } from '@/lib/nativeWidgets';
import { useAutoPluggySync } from '@/lib/pluggySync';
import { useFinancySync } from '@/lib/financy';
import { useAppIconFollowsAccent } from '@/lib/appIcon';
import { useFinancyBaseSync } from '@/lib/financyData';
import { useAutoBackup } from '@/lib/backup';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Toque numa notificação com `data.url` (ex.: orbita://boletos) abre a tela certa. */
function useNotificationLinks() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const go = (url: unknown) => {
      if (typeof url !== 'string' || !url.startsWith('orbita://')) return;
      setTimeout(() => router.push(('/' + url.replace('orbita://', '')) as never), 300);
    };
    let sub: { remove: () => void } | undefined;
    try {
      Notifications.getLastNotificationResponseAsync()
        .then((r) => go(r?.notification.request.content.data?.url))
        .catch(() => {});
      sub = Notifications.addNotificationResponseReceivedListener((r) => go(r.notification.request.content.data?.url));
    } catch {}
    return () => sub?.remove();
  }, []);
}

export default function RootLayout() {
  const c = useColors();
  useAutoCapture();
  useFocusRunner();
  useBalanceWidgetSync();
  useAutoPluggySync();
  useFinancySync();
  useAppIconFollowsAccent();
  useFinancyBaseSync();
  useNotificationLinks();
  useAutoBackup();
  const [loaded, error] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Sora_600SemiBold, Sora_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="foco" options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#050506' } }} />
        </Stack>
        <EstacioBackground />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
