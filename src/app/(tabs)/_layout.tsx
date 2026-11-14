import { Tabs } from 'expo-router/js-tabs';
import { QuickCapture } from '@/components/QuickCapture';
import { TabBar } from '@/components/TabBar';
import { useUI } from '@/store/ui';
import { useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  const capture = useUI((s) => s.capture);
  const setCapture = useUI((s) => s.setCapture);
  return (
    <>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: 'fade' }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="tarefas" />
        <Tabs.Screen name="habitos" />
        <Tabs.Screen name="modulos" />
      </Tabs>
      <QuickCapture visible={capture} onClose={() => setCapture(false)} />
    </>
  );
}
