import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ArrowDownToLine, Copy, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Field, Screen, Section, Segmented, T, impact } from '@/components/ui';
import { brl } from '@/lib/date';
import { parseMoney } from '@/lib/finance';
import { space, useColors } from '@/theme';

type Mode = 'hora' | 'projeto';

export default function Simulador() {
  const c = useColors();
  const [mode, setMode] = useState<Mode>('hora');
  const [title, setTitle] = useState('');
  const [rate, setRate] = useState('');
  const [hoursDay, setHoursDay] = useState('');
  const [days, setDays] = useState('');
  const [project, setProject] = useState('');
  const [fee, setFee] = useState('');
  const [tax, setTax] = useState('');
  const [costs, setCosts] = useState('');

  const hours = (Number(hoursDay.replace(',', '.')) || 0) * (Number(days) || 0);
  const gross = mode === 'hora' ? parseMoney(rate) * hours : parseMoney(project);
  const feeV = (gross * (Number(fee.replace(',', '.')) || 0)) / 100;
  const taxV = (gross * (Number(tax.replace(',', '.')) || 0)) / 100;
  const costV = parseMoney(costs);
  const net = gross - feeV - taxV - costV;
  const effective = hours > 0 ? net / hours : 0;
  const name = title.trim() || 'Projeto';

  const copy = async (text: string, label: string) => {
    impact();
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} pronto para colar no WhatsApp.`);
  };

  // WhatsApp: *negrito*, _itálico_
  const clientMsg = [
    `*Orçamento · ${name}*`,
    '',
    mode === 'hora' ? `• Valor da hora: ${brl(parseMoney(rate))}` : null,
    mode === 'hora' ? `• Carga: ${hours.toLocaleString('pt-BR')}h (${hoursDay || 0}h/dia × ${days || 0} dias)` : null,
    '',
    `*Total: ${brl(gross)}*`,
    '',
    '_Valores válidos por 7 dias._',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const personalMsg = [
    `*Simulação · ${name}*`,
    `Bruto: ${brl(gross)}`,
    feeV ? `Taxa (${fee}%): −${brl(feeV)}` : null,
    taxV ? `Imposto (${tax}%): −${brl(taxV)}` : null,
    costV ? `Custos: −${brl(costV)}` : null,
    `*Líquido: ${brl(net)}*`,
    hours ? `_Hora efetiva: ${brl(effective)}_` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const line = (label: string, value: number, tone?: 'danger' | 'success') => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T v="callout" tone="dim">
        {label}
      </T>
      <T v="callout" tabular tone={tone ?? 'default'}>
        {tone === 'danger' ? '− ' : ''}
        {brl(value)}
      </T>
    </View>
  );

  return (
    <Screen back title="Simulador freela" subtitle="Quanto cobrar e quanto sobra">
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'hora', label: 'Por hora' },
          { value: 'projeto', label: 'Por projeto' },
        ]}
      />
      <Field label="Projeto / cliente" value={title} onChangeText={setTitle} placeholder="Ex.: Bot de Discord · Loja X" />
      {mode === 'hora' ? (
        <>
          <Field label="Valor da hora (R$)" value={rate} onChangeText={setRate} placeholder="80,00" keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Field label="Horas por dia" value={hoursDay} onChangeText={setHoursDay} placeholder="4" keyboardType="decimal-pad" style={{ flex: 1 }} />
            <Field label="Dias" value={days} onChangeText={setDays} placeholder="10" keyboardType="number-pad" style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <Field label="Valor do projeto (R$)" value={project} onChangeText={setProject} placeholder="2.500,00" keyboardType="decimal-pad" />
      )}

      <Section title="Descontos">
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field label="Taxa plataforma %" value={fee} onChangeText={setFee} placeholder="0" keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field label="Imposto %" value={tax} onChangeText={setTax} placeholder="6" keyboardType="decimal-pad" style={{ flex: 1 }} />
        </View>
        <Field label="Custos (R$)" value={costs} onChangeText={setCosts} placeholder="Ferramentas, hospedagem…" keyboardType="decimal-pad" />
      </Section>

      <Card style={{ padding: space.xl, gap: space.md }}>
        <T v="caption" tone="dim">
          Você recebe
        </T>
        <T v="largeTitle" tabular color={net < 0 ? c.danger : c.success}>
          {brl(net)}
        </T>
        <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.xs }} />
        {line('Valor bruto', gross)}
        {feeV > 0 && line('Taxa da plataforma', feeV, 'danger')}
        {taxV > 0 && line('Imposto', taxV, 'danger')}
        {costV > 0 && line('Custos', costV, 'danger')}
        {hours > 0 && line('Hora efetiva (líquida)', effective)}
      </Card>

      <View style={{ gap: space.sm }}>
        <Button label="Copiar orçamento para o cliente" icon={MessageCircle} onPress={() => copy(clientMsg, 'Orçamento')} disabled={!gross} />
        <Button label="Copiar resumo pessoal" icon={Copy} variant="secondary" onPress={() => copy(personalMsg, 'Resumo')} disabled={!gross} />
        <Button
          label="Lançar como entrada"
          icon={ArrowDownToLine}
          variant="secondary"
          disabled={net <= 0}
          onPress={() =>
            router.push({
              pathname: '/financas/novo',
              params: { type: 'in', amount: net.toFixed(2), category: 'Freela', description: name },
            })
          }
        />
      </View>
    </Screen>
  );
}
