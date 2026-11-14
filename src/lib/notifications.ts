import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export type Repeat = 'none' | 'daily' | 'weekly';

/** Agenda uma notificação local. Retorna o id (ou undefined se sem permissão / data no passado). */
export async function schedule(title: string, at: Date, repeat: Repeat): Promise<string | undefined> {
  if (!(await ensurePermission())) return undefined;
  const content = { title, body: 'Lembrete do Órbita', sound: true };
  const T = Notifications.SchedulableTriggerInputTypes;
  if (repeat === 'daily') {
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: T.DAILY, hour: at.getHours(), minute: at.getMinutes() },
    });
  }
  if (repeat === 'weekly') {
    return Notifications.scheduleNotificationAsync({
      content,
      // no iOS o weekday vai de 1 (domingo) a 7 (sábado)
      trigger: { type: T.WEEKLY, weekday: at.getDay() + 1, hour: at.getHours(), minute: at.getMinutes() },
    });
  }
  if (at.getTime() <= Date.now()) return undefined;
  return Notifications.scheduleNotificationAsync({ content, trigger: { type: T.DATE, date: at } });
}

export async function cancel(id?: string) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
