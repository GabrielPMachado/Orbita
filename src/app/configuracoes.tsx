import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BadgeCheck, Camera, Check, Wallet } from 'lucide-react-native';
import { Alert, Pressable, Switch, View } from 'react-native';
import { Appearance } from '@/components/Appearance';
import { Glass, hasLiquidGlass } from '@/components/Glass';
import { Badge, Field, IconTile, List, Row, Screen, Section, T, tap } from '@/components/ui';
import { MODULES, SECTIONS } from '@/modules';
import { choosePhotos, deleteMedia, mediaUri } from '@/lib/media';
import { useFinance } from '@/store/finance';
import { usePluggy } from '@/store/pluggy';
import { useFinancyLink } from '@/store/financyLink';
import { useCheckin } from '@/store/checkin';
import { openCheckin } from '@/store/ui';
import { useSettings } from '@/store/settings';
import { brl } from '@/lib/date';
import { currentBalance } from '@/lib/finance';
import { space, useColors } from '@/theme';

export default function Configuracoes() {
  const c = useColors();
  const { name, avatar, accent, disabled, widgetHidden, setName, setAvatar, setAccent, toggleModule, setWidgetHidden } = useSettings();
  const balance = useFinance((s) => currentBalance(s.accounts, s.txs));
  const pluggyOn = usePluggy((s) => s.configured);
  const financyOn = useFinancyLink((s) => s.connected);
  const checkinOn = useCheckin((s) => s.enabled);
  const setCheckin = useCheckin((s) => s.setEnabled);

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
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
              <Camera size={13} color={c.onAccent} strokeWidth={2.4} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Field value={name} onChangeText={setName} placeholder="Como quer ser chamado?" autoCapitalize="words" />
          </View>
        </View>
      </Section>

      <Appearance />

      <Section title="Check-in diário">
        <List>
          <Row
            title="Perguntar ao abrir o app"
            subtitle="Humor, sono, energia e o que ficou de ontem, uma vez por dia"
            trailing={<Switch value={checkinOn} onValueChange={setCheckin} trackColor={{ true: c.accent, false: c.surface3 }} />}
          />
          <Row title="Fazer agora" onPress={() => openCheckin()} chevron />
        </List>
      </Section>

      <Section title="Widget de saldo">
        {/* prévia de como fica na tela de bloqueio */}
        <View style={{ alignItems: 'center', paddingVertical: space.md }}>
          <View style={{ width: 172, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', gap: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Wallet size={11} color="#fff" />
              <T v="caption" color="rgba(255,255,255,0.7)" style={{ fontSize: 12 }}>
                Saldo
              </T>
            </View>
            <T v="headline" tabular color="#fff" numberOfLines={1} style={{ fontSize: 19 }}>
              {widgetHidden ? 'R$ •••••' : brl(balance)}
            </T>
          </View>
        </View>
        <List>
          <Row
            title="Esconder valores"
            subtitle="Mostra R$ ••••• na tela de bloqueio"
            trailing={<Switch value={widgetHidden} onValueChange={setWidgetHidden} trackColor={{ true: c.accent, false: c.surface3 }} />}
          />
        </List>
        <T v="caption" tone="faint">
          Para adicionar: na tela de bloqueio, toque e segure → Personalizar → Tela Bloqueada → toque na área de widgets → Órbita. Também existe a
          versão para a tela inicial.
        </T>
      </Section>

      <Section title="Integrações">
        <List>
          <Row
            leading={<IconTile icon={BadgeCheck} color={c.success} />}
            title="Meu Pluggy"
            subtitle={pluggyOn ? 'Conferência com o banco ativa' : 'Conferir lançamentos com o extrato'}
            onPress={() => router.push('/financas/pluggy')}
            chevron
          />
          <Row
            leading={<IconTile icon={Wallet} color="#10B981" />}
            title="Financy"
            subtitle={financyOn ? 'Conectado · saldo e categorias do Apple Pay' : 'Abrir e conectar o seu app de finanças'}
            onPress={() => router.push('/financas/financy')}
            chevron
          />
        </List>
      </Section>

      {SECTIONS.map((section) => (
        <Section key={section} title={`Módulos · ${section}`}>
          <List>
            {MODULES.filter((m) => m.section === section).map((m) => (
              <Row
                key={m.id}
                leading={<IconTile icon={m.icon} color={disabled.includes(m.id) ? c.textFaint : c.accent} />}
                title={m.name}
                subtitle={m.description}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {!m.ready && <Badge label="Em breve" />}
                    <Switch value={!disabled.includes(m.id)} onValueChange={() => toggleModule(m.id)} trackColor={{ true: c.accent, false: c.surface3 }} thumbColor="#FFFFFF" ios_backgroundColor={c.surface3} />
                  </View>
                }
              />
            ))}
          </List>
        </Section>
      ))}

      <View style={{ alignItems: 'center', gap: 4 }}>
        <T v="headline" tone="dim">
          Órbita
        </T>
        <T v="caption" tone="faint">
          Versão 0.6 · dados salvos neste aparelho
        </T>
        <T v="caption" tone="faint">
          {hasLiquidGlass ? 'Liquid Glass ativo' : 'Vidro em modo compatível (iOS anterior ao 26)'}
        </T>
      </View>
    </Screen>
  );
}
