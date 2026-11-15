import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, CircleOff, CreditCard, Landmark, Minus, Plus, Repeat, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { centsToNumber, MoneyKeypad } from '@/components/finance';
import { Glass } from '@/components/Glass';
import { PhotoStrip } from '@/components/Photos';
import { Button, Card, Chip, Field, GlassButton, IconTile, List, Progress, Row, Screen, Segmented, T, tap } from '@/components/ui';
import { addDays, brl, friendlyDate, toKey } from '@/lib/date';
import { category, categoryOptions } from '@/lib/finance';
import { parseInput } from '@/lib/parse';
import { useFinance, type TxType } from '@/store/finance';
import { radius, space, useColors } from '@/theme';

const STEPS = ['Valor', 'Categoria', 'Pagamento', 'Detalhes'];

export default function NovoLancamento() {
  const fyCats = useFinance((st) => (st.base === 'financy' ? st.fyCategories : []));
  const c = useColors();
  const params = useLocalSearchParams<{ type?: TxType; amount?: string; category?: string; description?: string; date?: 'ontem' }>();
  const { accounts, cards, addTx } = useFinance();

  const [step, setStep] = useState(params.amount && params.category ? 2 : 0);
  const [type, setType] = useState<TxType>(params.type === 'in' ? 'in' : 'out');
  const [cents, setCents] = useState(params.amount ? String(Math.round(Number(params.amount) * 100)) : '');
  const [cat, setCat] = useState<string | null>(params.category ?? null);
  const [method, setMethod] = useState<string>(accounts[0] ? 'acc:' + accounts[0].id : 'none');
  const [installments, setInstallments] = useState(1);
  const [repeat, setRepeat] = useState(1);
  const [desc, setDesc] = useState(params.description ?? '');
  const [dateMode, setDateMode] = useState<'hoje' | 'ontem' | 'amanha' | 'outra'>(params.date === 'ontem' ? 'ontem' : 'hoje');
  const [customDate, setCustomDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const amount = centsToNumber(cents);
  const isCard = method.startsWith('card:');
  const date = useMemo(() => {
    if (dateMode === 'hoje') return toKey();
    if (dateMode === 'ontem') return toKey(addDays(new Date(), -1));
    if (dateMode === 'amanha') return toKey(addDays(new Date(), 1));
    return parseInput('x ' + customDate).due ?? toKey();
  }, [dateMode, customDate]);

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const canNext = [amount > 0, !!cat, true, true][step];

  const save = () => {
    addTx({
      type,
      amount,
      category: cat ?? 'Outros',
      description: desc.trim(),
      date,
      accountId: method.startsWith('acc:') ? method.slice(4) : undefined,
      cardId: isCard ? method.slice(5) : undefined,
      installments: isCard && type === 'out' ? installments : 1,
      repeatMonths: installments > 1 ? 1 : repeat,
      notes: notes.trim() || undefined,
      attachments: photos,
    });
    router.back();
  };

  const selectedCat = cat ? category(cat, type) : null;

  return (
    <Screen
      title={STEPS[step]}
      overline={`Passo ${step + 1} de ${STEPS.length} · ${type === 'out' ? 'Saída' : 'Entrada'}`}
      actions={
        <>
          {step > 0 && <GlassButton icon={ChevronLeft} onPress={back} accessibilityLabel="Voltar" />}
          <GlassButton icon={X} onPress={() => router.back()} accessibilityLabel="Cancelar" />
        </>
      }>
      <Progress value={(step + 1) / STEPS.length} height={4} />

      {/* ---------- 1. Valor ---------- */}
      {step === 0 && (
        <>
          <Segmented<TxType>
            value={type}
            onChange={(v) => {
              setType(v);
              setCat(null);
            }}
            options={[
              { value: 'out', label: 'Saída' },
              { value: 'in', label: 'Entrada' },
            ]}
          />
          <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.xs }}>
            <T v="caption" tone="dim">
              {type === 'out' ? 'Quanto saiu?' : 'Quanto entrou?'}
            </T>
            <T v="largeTitle" tabular color={amount ? (type === 'in' ? c.success : c.text) : c.textFaint} style={{ fontSize: 44, lineHeight: 52 }}>
              {brl(amount)}
            </T>
          </View>
          <MoneyKeypad cents={cents} onChange={setCents} />
          <Button label="Continuar" onPress={() => setStep(1)} disabled={!canNext} />
        </>
      )}

      {/* ---------- 2. Categoria ---------- */}
      {step === 1 && (
        <View style={styles.catGrid}>
          {categoryOptions(type, fyCats).map((k) => {
            const active = cat === k.name;
            return (
              <Pressable
                key={k.name}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  tap();
                  setCat(k.name);
                  setStep(2);
                }}
                style={({ pressed }) => [styles.catWrap, { opacity: pressed ? 0.75 : 1 }]}>
                <Glass interactive tint={active ? k.color + '33' : undefined} style={styles.catTile}>
                  <IconTile icon={k.icon} color={k.color} size={40} />
                  <T v="caption" align="center" numberOfLines={1} style={{ fontSize: 12 }}>
                    {k.name}
                  </T>
                </Glass>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ---------- 3. Pagamento ---------- */}
      {step === 2 && (
        <>
          <T v="overline" tone="dim">
            {type === 'out' ? 'Pago com' : 'Recebido em'}
          </T>
          <List>
            {accounts.map((a) => (
              <Row
                key={a.id}
                leading={<IconTile icon={Landmark} color={a.color} />}
                title={a.name}
                subtitle="Conta"
                onPress={() => setMethod('acc:' + a.id)}
                trailing={method === 'acc:' + a.id ? <Check size={20} color={c.accent} /> : null}
              />
            ))}
            {type === 'out' &&
              cards.map((k) => (
                <Row
                  key={k.id}
                  leading={<IconTile icon={CreditCard} color={k.color} />}
                  title={k.name}
                  subtitle={`Cartão · fecha dia ${k.closingDay}`}
                  onPress={() => setMethod('card:' + k.id)}
                  trailing={method === 'card:' + k.id ? <Check size={20} color={c.accent} /> : null}
                />
              ))}
            <Row
              leading={<IconTile icon={CircleOff} color={c.textDim} />}
              title="Não informar"
              onPress={() => setMethod('none')}
              trailing={method === 'none' ? <Check size={20} color={c.accent} /> : null}
            />
          </List>
          {accounts.length + cards.length === 0 && (
            <T v="caption" tone="dim">
              Cadastre contas e cartões em Finanças para escolher aqui.
            </T>
          )}

          {isCard && type === 'out' && (
            <Card style={{ gap: space.md }}>
              <Stepper label="Parcelas" value={installments} min={1} max={24} onChange={setInstallments} format={(n) => (n === 1 ? 'À vista' : `${n}x`)} />
              {installments > 1 && (
                <T v="callout" tone="dim" tabular>
                  {installments}x de {brl(amount / installments)}
                </T>
              )}
            </Card>
          )}

          {installments === 1 && (
            <Card style={{ gap: space.md }}>
              <Stepper
                label="Repetir todo mês"
                icon
                value={repeat}
                min={1}
                max={36}
                onChange={setRepeat}
                format={(n) => (n === 1 ? 'Não' : `${n} meses`)}
              />
              <T v="caption" tone="dim">
                Para contas fixas, assinaturas e salário. Os meses futuros entram como pendentes.
              </T>
            </Card>
          )}
          <Button label="Continuar" onPress={() => setStep(3)} />
        </>
      )}

      {/* ---------- 4. Detalhes ---------- */}
      {step === 3 && (
        <>
          <Field label="Descrição" value={desc} onChangeText={setDesc} placeholder={selectedCat?.name ?? 'Ex.: Mercado do mês'} />
          <View style={{ gap: space.sm }}>
            <T v="overline" tone="dim">
              Data
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {(
                [
                  ['ontem', 'Ontem'],
                  ['hoje', 'Hoje'],
                  ['amanha', 'Amanhã'],
                  ['outra', 'Outra data'],
                ] as const
              ).map(([k, l]) => (
                <Chip key={k} label={l} active={dateMode === k} onPress={() => setDateMode(k)} />
              ))}
            </View>
            {dateMode === 'outra' && <Field value={customDate} onChangeText={setCustomDate} placeholder="dd/mm ou dd/mm/aaaa" keyboardType="numbers-and-punctuation" autoFocus />}
          </View>
          <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional" multiline style={{ minHeight: 72, textAlignVertical: 'top' }} />
          <View style={{ gap: space.sm }}>
            <T v="overline" tone="dim">
              Comprovante
            </T>
            <PhotoStrip photos={photos} onChange={setPhotos} addLabel="Anexar" />
          </View>

          {/* Resumo */}
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              {selectedCat && <IconTile icon={selectedCat.icon} color={selectedCat.color} />}
              <View style={{ flex: 1 }}>
                <T v="headline">{desc.trim() || selectedCat?.name}</T>
                <T v="caption" tone="dim">
                  {friendlyDate(date)}
                  {installments > 1 ? ` · ${installments}x de ${brl(amount / installments)}` : ''}
                  {repeat > 1 && installments === 1 ? ` · ${repeat} meses` : ''}
                </T>
              </View>
              <T v="headline" tabular color={type === 'in' ? c.success : c.text}>
                {brl(amount)}
              </T>
            </View>
          </Card>
          <Button label={type === 'out' ? 'Salvar saída' : 'Salvar entrada'} icon={Check} onPress={save} />
        </>
      )}
    </Screen>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  format: (n: number) => string;
  icon?: boolean;
}) {
  const c = useColors();
  const btn = (d: number, Icon: typeof Plus) => (
    <Pressable
      accessibilityLabel={d > 0 ? 'Aumentar' : 'Diminuir'}
      disabled={value + d < min || value + d > max}
      onPress={() => {
        tap();
        onChange(Math.min(max, Math.max(min, value + d)));
      }}
      style={({ pressed }) => ({ opacity: value + d < min || value + d > max ? 0.35 : pressed ? 0.7 : 1 })}>
      <Glass interactive style={styles.stepBtn}>
        <View>
          <Icon size={18} color={c.text} />
        </View>
      </Glass>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {icon && <Repeat size={18} color={c.textDim} />}
      <T v="body" style={{ flex: 1 }}>
        {label}
      </T>
      {btn(-1, Minus)}
      <T v="headline" tabular align="center" style={{ minWidth: 72 }}>
        {format(value)}
      </T>
      {btn(1, Plus)}
    </View>
  );
}

const styles = StyleSheet.create({
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catWrap: { width: '31.5%' },
  catTile: { height: 104, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
