import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Bell, Clapperboard, CloudMoon, GraduationCap, Landmark, LayoutGrid, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import { ensurePermission } from '@/lib/notifications';
import { widgetsShareData } from '@/lib/nativeWidgets';
import { loadTmdbKey, removeTmdbKey, useTmdbKey } from '@/lib/tmdb';
import { useEstacio } from '@/store/estacio';
import { useFinancyLink } from '@/store/financyLink';
import { usePluggy } from '@/store/pluggy';
import { toast } from '@/store/toast';
import { useColors } from '@/theme';
import { Badge } from './ui';

export type ConnStatus = 'ok' | 'warn' | 'off';
export type Conn = {
  id: string;
  group: string;
  name: string;
  icon: LucideIcon;
  color: string;
  status: ConnStatus;
  detail: string;
  onPress?: () => void;
};

const REPO = 'https://github.com/GabrielPMachado/Orbita';
const dias = (t: number) => Math.floor((Date.now() - t) / 864e5);
const quando = (t: number) => {
  const d = dias(t);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
};

/** Permissão de notificações, relida quando o app volta (o usuário pode ter mudado nos Ajustes). */
function useNotifPermission() {
  const [st, setSt] = useState<'granted' | 'denied' | 'undetermined' | undefined>();
  useEffect(() => {
    const read = () =>
      Notifications.getPermissionsAsync()
        .then((p) => setSt(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'))
        .catch(() => setSt(undefined));
    read();
    const sub = AppState.addEventListener('change', (a) => a === 'active' && read());
    return () => sub.remove();
  }, []);
  return [st, setSt] as const;
}

function cloudHelp(erro?: string) {
  Alert.alert(
    'Leitura na nuvem às 04h',
    (erro ? `Última tentativa: ${erro}\n\n` : '') +
      'Um job no GitHub lê o portal da Estácio todo dia às 04:00, mesmo com o celular desligado.\n\nPara ligar, crie em Settings › Secrets › Actions do repositório: ESTACIO_LOGIN, ESTACIO_SENHA e FINANCY_KEY (Financy › Ajustes › Órbita).',
    [
      { text: 'Abrir segredos', onPress: () => WebBrowser.openBrowserAsync(`${REPO}/settings/secrets/actions`) },
      { text: 'Rodar agora', onPress: () => WebBrowser.openBrowserAsync(`${REPO}/actions/workflows/estacio-cloud.yml`) },
      { text: 'Fechar', style: 'cancel' },
    ],
  );
}

/** Todas as contas, logins e conexões do app, com o estado de cada uma. */
export function useConnections(): Conn[] {
  const est = useEstacio();
  const financyOn = useFinancyLink((s) => s.connected);
  const pluggyOn = usePluggy((s) => s.configured);
  const tmdb = useTmdbKey((s) => s.has);
  const [notif, setNotif] = useNotifPermission();
  const widget = useMemo(() => widgetsShareData(), []);
  useEffect(() => loadTmdbKey(), []);

  const cloudFalhou = !!est.cloudErro && est.cloudAt > 0;
  const cloudParada = est.cloudAt > 0 && dias(est.cloudAt) >= 2;

  const list: (Conn | null)[] = [
    {
      id: 'estacio',
      group: 'Faculdade',
      name: 'Estácio',
      icon: GraduationCap,
      color: '#2563EB',
      status: !est.connected ? 'off' : est.needsLogin ? 'warn' : 'ok',
      detail: !est.connected
        ? 'Entrar para puxar matérias, provas, notas e boletos'
        : est.needsLogin
          ? 'A sessão expirou · toque para entrar de novo'
          : `Conectado · atualizado ${est.lastSweep ? quando(est.lastSweep) : 'ainda não'}`,
      onPress: () => router.push('/estacio'),
    },
    {
      id: 'estacio-nuvem',
      group: 'Faculdade',
      name: 'Leitura na nuvem (04h)',
      icon: CloudMoon,
      color: '#7C3AED',
      status: !est.cloudAt ? 'off' : cloudFalhou || cloudParada ? 'warn' : 'ok',
      detail: !est.cloudAt
        ? 'Não configurada · toque para ver como ligar'
        : cloudFalhou
          ? (est.cloudErro ?? 'Falhou')
          : cloudParada
            ? `Não roda desde ${quando(est.cloudAt)}`
            : `Funcionando · última leitura ${quando(est.cloudAt)}`,
      onPress: () => cloudHelp(cloudFalhou ? est.cloudErro : undefined),
    },
    {
      id: 'financy',
      group: 'Finanças',
      name: 'Financy',
      icon: Wallet,
      color: '#10B981',
      status: financyOn ? 'ok' : 'off',
      detail: financyOn ? 'Conectado · saldo, categorias e backup na nuvem' : 'Conectar o seu app de finanças',
      onPress: () => router.push('/financas/financy'),
    },
    {
      id: 'pluggy',
      group: 'Finanças',
      name: 'Meu Pluggy (Open Finance)',
      icon: Landmark,
      color: '#F59E0B',
      status: pluggyOn ? 'ok' : 'off',
      detail: pluggyOn ? 'Configurado · conferência com o banco' : 'Conferir lançamentos com o banco, sem senha do banco',
      onPress: () => router.push('/financas/pluggy'),
    },
    {
      id: 'tmdb',
      group: 'Filmes e séries',
      name: 'TMDB',
      icon: Clapperboard,
      color: '#06B6D4',
      status: tmdb ? 'ok' : 'off',
      detail: tmdb ? 'Chave salva · capa, sinopse e onde assistir' : 'Toque para colar a chave da API',
      onPress: tmdb
        ? () =>
            Alert.alert('TMDB', 'A chave fica no Keychain do iPhone.', [
              {
                text: 'Remover chave',
                style: 'destructive',
                onPress: () => removeTmdbKey().then(() => toast({ message: 'Chave do TMDB removida' })),
              },
              { text: 'Fechar', style: 'cancel' },
            ])
        : undefined,
    },
    notif
      ? {
          id: 'notificacoes',
          group: 'iPhone',
          name: 'Notificações',
          icon: Bell,
          color: '#EF4444',
          status: notif === 'granted' ? 'ok' : notif === 'denied' ? 'warn' : 'off',
          detail:
            notif === 'granted'
              ? 'Permitidas · lembretes, prazos e boletos'
              : notif === 'denied'
                ? 'Bloqueadas · toque para abrir os Ajustes'
                : 'Toque para permitir',
          onPress:
            notif === 'granted' || notif === 'denied'
              ? () => Linking.openSettings()
              : () => ensurePermission().then((ok) => setNotif(ok ? 'granted' : 'denied')),
        }
      : null,
    widget !== null
      ? {
          id: 'widgets',
          group: 'iPhone',
          name: 'Widgets',
          icon: LayoutGrid,
          color: '#64748B',
          status: widget ? 'ok' : 'warn',
          detail: widget ? 'Com acesso aos dados do app' : 'Sem App Group: ligue no Sideloadly e instale de novo',
          onPress: () => router.push('/configuracoes/widgets'),
        }
      : null,
  ];
  return list.filter((x): x is Conn => !!x);
}

export function StatusBadge({ status }: { status: ConnStatus }) {
  const c = useColors();
  if (status === 'ok') return <Badge label="Conectado" color={c.success} />;
  if (status === 'warn') return <Badge label="Atenção" color={c.warning} />;
  return <Badge label="Desligado" />;
}
