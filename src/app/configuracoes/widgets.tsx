import { useMemo } from 'react';
import { BadgeCheck, Wallet } from 'lucide-react-native';
import { Switch, View } from 'react-native';
import { IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { brl } from '@/lib/date';
import { balanceFor } from '@/lib/finance';
import { reloadWidgets, widgetsShareData } from '@/lib/nativeWidgets';
import { useFinance } from '@/store/finance';
import { useFinancyLink } from '@/store/financyLink';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

export default function Widgets() {
  const c = useColors();
  const widgetLink = useMemo(() => widgetsShareData(), []);
  const widgetHidden = useSettings((s) => s.widgetHidden);
  const setWidgetHidden = useSettings((s) => s.setWidgetHidden);
  const fySaldo = useFinancyLink((s) => s.summary?.saldo);
  const balance = useFinance((s) => balanceFor(s.base, s.accounts, s.txs, fySaldo));
  return (
    <Screen back title="Widgets" subtitle="Saldo na tela de bloqueio e na inicial">
      <Section title="Widget de saldo">
        {/* prévia de como fica na tela de bloqueio */}
        <View style={{ alignItems: 'center', paddingVertical: space.md }}>
          <View
            style={{ width: 172, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', gap: 1 }}>
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
          {widgetLink !== null ? (
            <Row
              title={widgetLink ? 'Widget conectado' : 'Widget sem acesso aos dados'}
              subtitle={
                widgetLink
                  ? 'Toque para atualizar o widget agora'
                  : 'A assinatura do app tirou o App Group. No Sideloadly, deixe o App Group ligado e instale de novo.'
              }
              leading={<IconTile icon={widgetLink ? BadgeCheck : Wallet} color={widgetLink ? c.success : c.warning} />}
              onPress={() => {
                reloadWidgets();
                toast({ message: 'Widget atualizado' });
              }}
            />
          ) : null}
        </List>
        <T v="caption" tone="faint">
          Para adicionar: na tela de bloqueio, toque e segure → Personalizar → Tela Bloqueada → toque na área de widgets → Órbita. Também existe a
          versão para a tela inicial.
        </T>
      </Section>
    </Screen>
  );
}
