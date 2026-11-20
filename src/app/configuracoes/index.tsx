import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Blocks, Camera, DatabaseBackup, KeyRound, LayoutGrid, Palette } from 'lucide-react-native';
import { Alert, Pressable, Switch, View } from 'react-native';
import { useConnections } from '@/components/connections';
import { Glass, hasLiquidGlass } from '@/components/Glass';
import { Badge, Field, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { choosePhotos, deleteMedia, mediaUri } from '@/lib/media';
import { MODULES } from '@/modules';
import { useCheckin } from '@/store/checkin';
import { useFinancyLink } from '@/store/financyLink';
import { useSettings } from '@/store/settings';
import { openCheckin } from '@/store/ui';
import { space, useColors } from '@/theme';

export default function Configuracoes() {
  const c = useColors();
  const { name, avatar, disabled, setName, setAvatar } = useSettings();
  const checkinOn = useCheckin((s) => s.enabled);
  const setCheckin = useCheckin((s) => s.setEnabled);
  const financyOn = useFinancyLink((s) => s.connected);
  const conns = useConnections();
  const ok = conns.filter((x) => x.status === 'ok').length;
  const warn = conns.filter((x) => x.status === 'warn');
  const ativos = MODULES.filter((m) => !disabled.includes(m.id)).length;

  const changeAvatar = async () => {
    const run = async () => {
      const [photo] = await choosePhotos({ multiple: false, title: 'Foto de perfil' });
      if (photo) {
        if (avatar) deleteMedia(avatar);
        setAvatar(photo);
      }
    };
    if (!avatar) return run();
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Trocar foto', onPress: run },
      {
        text: 'Remover foto',
        style: 'destructive',
        onPress: () => {
          deleteMedia(avatar);
          setAvatar(undefined);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <Screen back title="Configurações">
      <Section title="Perfil">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Pressable accessibilityLabel="Alterar foto de perfil" onPress={changeAvatar} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            {avatar ? (
              <Image source={{ uri: mediaUri(avatar) }} style={{ width: 72, height: 72, borderRadius: 36 }} contentFit="cover" />
            ) : (
              <Glass interactive style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
                <T v="title">{(name.trim()[0] ?? 'O').toUpperCase()}</T>
              </Glass>
            )}
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: c.bg,
              }}>
              <Camera size={13} color={c.onAccent} strokeWidth={2.4} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field value={name} onChangeText={setName} placeholder="Como quer ser chamado?" autoCapitalize="words" />
          </View>
        </View>
      </Section>

      <Section title="Contas e conexões">
        <List>
          <Row
            leading={<IconTile icon={KeyRound} color={warn.length ? c.warning : c.accent} />}
            title="Logins e conexões"
            subtitle={
              warn.length
                ? `${warn.map((x) => x.name).join(', ')} precisa${warn.length > 1 ? 'm' : ''} de atenção`
                : `${ok} de ${conns.length} conectados · Estácio, Financy, TMDB…`
            }
            subtitleTone={warn.length ? 'warning' : 'dim'}
            trailing={warn.length ? <Badge label={String(warn.length)} color={c.warning} /> : undefined}
            onPress={() => router.push('/configuracoes/conexoes')}
            chevron
          />
        </List>
      </Section>

      <Section title="Personalização">
        <List>
          <Row
            leading={<IconTile icon={Palette} color={c.accent} />}
            title="Aparência"
            subtitle="Cor, tema, ícones e ícone do app"
            onPress={() => router.push('/configuracoes/aparencia')}
            chevron
          />
          <Row
            leading={<IconTile icon={LayoutGrid} color={c.accent} />}
            title="Widgets"
            subtitle="Saldo na tela de bloqueio e na inicial"
            onPress={() => router.push('/configuracoes/widgets')}
            chevron
          />
          <Row
            leading={<IconTile icon={Blocks} color={c.accent} />}
            title="Módulos"
            subtitle={`${ativos} de ${MODULES.length} ativos`}
            onPress={() => router.push('/configuracoes/modulos')}
            chevron
          />
        </List>
      </Section>

      <Section title="Rotina">
        <List>
          <Row
            title="Check-in diário ao abrir o app"
            subtitle="Humor, sono, energia e o que ficou de ontem, uma vez por dia"
            trailing={<Switch value={checkinOn} onValueChange={setCheckin} trackColor={{ true: c.accent, false: c.surface3 }} />}
          />
          <Row title="Fazer check-in agora" onPress={() => openCheckin()} chevron />
        </List>
      </Section>

      <Section title="Dados">
        <List>
          <Row
            leading={<IconTile icon={DatabaseBackup} color={c.accent} />}
            title="Backup e dados"
            subtitle={financyOn ? 'Cópia na nuvem do Financy e arquivo .json' : 'Exportar e importar um arquivo .json'}
            onPress={() => router.push('/configuracoes/dados')}
            chevron
          />
        </List>
      </Section>

      <View style={{ alignItems: 'center', gap: 4 }}>
        <T v="headline" tone="dim">
          Órbita
        </T>
        <T v="caption" tone="faint">
          Versão {Constants.expoConfig?.version ?? '—'} · dados salvos neste aparelho
        </T>
        <T v="caption" tone="faint">
          {hasLiquidGlass ? 'Liquid Glass ativo' : 'Vidro em modo compatível (iOS anterior ao 26)'}
        </T>
      </View>
    </Screen>
  );
}
