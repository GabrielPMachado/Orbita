import { BedDouble, Droplet, GlassWater, Pill, Scale, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LineChart, Stepper, confirmDelete } from '@/components/extra';
import { Glass } from '@/components/Glass';
import { Button, Card, Checkbox, Field, IconTile, List, ProgressRing, Row, Screen, Section, Sheet, T, impact } from '@/components/ui';
import { addDays, fromKey, lastNDays, today, toKey, WEEKDAYS_SHORT } from '@/lib/date';
import { cancel, schedule } from '@/lib/notifications';
import { parseMoney } from '@/lib/finance';
import { useHealth, type Med } from '@/store/modules';
import { radius, space, useColors } from '@/theme';

const fmtL = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 ? 2 : 1).replace('.', ',')} L` : `${ml} ml`);

export default function Saude() {
  const c = useColors();
  const h = useHealth();
  const day = today();
  const water = h.water[day] ?? 0;
  const week = lastNDays(7);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [medOpen, setMedOpen] = useState<Med | 'new' | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);

  const yesterday = toKey(addDays(new Date(), -1));
  const sleepLast = h.sleep[day] ?? h.sleep[yesterday];
  const sleepAvg = (() => {
    const v = week.map((k) => h.sleep[k]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
  })();
  const weights = h.weights.slice(-12);
  const lastW = h.weights[h.weights.length - 1];
  const firstW = h.weights[0];
  const activeMeds = h.meds.filter((m) => !m.paused);

  return (
    <>
      <Screen back title="Saúde" subtitle="Água, sono, peso e remédios">
        {/* Água */}
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.xl }}>
          <ProgressRing value={water / h.waterGoal} size={104} stroke={10} color="#3B9DFF">
            <Droplet size={18} color="#3B9DFF" />
            <T v="headline" tabular>
              {Math.round((water / h.waterGoal) * 100)}%
            </T>
          </ProgressRing>
          <View style={{ flex: 1, gap: space.sm }}>
            <View>
              <T v="title" tabular>
                {fmtL(water)}
              </T>
              <T v="caption" tone="dim">
                de {fmtL(h.waterGoal)} hoje
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {[250, 500].map((ml) => (
                <Pressable
                  key={ml}
                  accessibilityLabel={`Adicionar ${ml} ml`}
                  onPress={() => {
                    impact();
                    h.addWater(day, ml);
                  }}
                  onLongPress={() => h.addWater(day, -ml)}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
                  <Glass interactive tint="#3B9DFF33" style={styles.waterBtn}>
                    <View>
                      <GlassWater size={16} color="#3B9DFF" />
                    </View>
                    <T v="caption">+{ml}</T>
                  </Glass>
                </Pressable>
              ))}
            </View>
            <T v="caption" tone="faint">
              Segure para desfazer
            </T>
          </View>
        </Card>

        {/* Sono e peso */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSleepOpen(true)}>
            <Glass interactive style={styles.tile}>
              <IconTile icon={BedDouble} color="#8B5CF6" />
              <T v="caption" tone="dim">
                Sono
              </T>
              <T v="title" tabular>
                {sleepLast != null ? `${String(sleepLast).replace('.', ',')} h` : '—'}
              </T>
              <T v="caption" tone="faint">
                {sleepAvg != null ? `média ${sleepAvg.toFixed(1).replace('.', ',')} h` : 'toque para registrar'}
              </T>
            </Glass>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setWeightOpen(true)}>
            <Glass interactive style={styles.tile}>
              <IconTile icon={Scale} color="#2DD4BF" />
              <T v="caption" tone="dim">
                Peso
              </T>
              <T v="title" tabular>
                {lastW ? `${String(lastW.kg).replace('.', ',')} kg` : '—'}
              </T>
              <T v="caption" tone={lastW && firstW && lastW.kg < firstW.kg ? 'success' : 'faint'}>
                {lastW && firstW && lastW !== firstW
                  ? `${lastW.kg - firstW.kg > 0 ? '+' : ''}${(lastW.kg - firstW.kg).toFixed(1).replace('.', ',')} kg no total`
                  : 'toque para registrar'}
              </T>
            </Glass>
          </Pressable>
        </View>

        {weights.length > 1 && (
          <Section title="Evolução do peso">
            <Card>
              <LineChart
                values={weights.map((w) => w.kg)}
                labels={[
                  fromKey(weights[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                  fromKey(weights[weights.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
                ]}
                color="#2DD4BF"
              />
            </Card>
          </Section>
        )}

        <Section title="Sono da semana">
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 96 }}>
              {week.map((k) => {
                const v = h.sleep[k];
                const hgt = v ? Math.max(6, (Math.min(v, 10) / 10) * 72) : 4;
                return (
                  <View key={k} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                    <T v="caption" tone="faint" style={{ fontSize: 10 }}>
                      {v ? String(v).replace('.', ',') : ''}
                    </T>
                    <View style={{ width: 16, height: hgt, borderRadius: 8, backgroundColor: v ? (v >= 7 ? '#8B5CF6' : '#8B5CF699') : c.surface3 }} />
                    <T v="caption" tone={k === day ? 'default' : 'faint'} style={{ fontSize: 11 }}>
                      {WEEKDAYS_SHORT[fromKey(k).getDay()]}
                    </T>
                  </View>
                );
              })}
            </View>
          </Card>
        </Section>

        <Section title="Remédios de hoje" action="Adicionar" onAction={() => setMedOpen('new')}>
          {h.meds.length === 0 ? (
            <Card onPress={() => setMedOpen('new')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile icon={Pill} color={c.danger} />
              <T v="callout" tone="dim" style={{ flex: 1 }}>
                Cadastre remédios e vitaminas com horário: o app avisa e controla o estoque.
              </T>
            </Card>
          ) : (
            <List>
              {activeMeds
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((m) => (
                  <Row
                    key={m.id}
                    leading={<Checkbox checked={!!m.log[day]} onPress={() => h.toggleMed(m.id, day)} color={c.danger} />}
                    title={m.name}
                    subtitle={[m.time, m.dose, m.stock !== undefined ? `${m.stock} restantes` : null].filter(Boolean).join('  ·  ')}
                    subtitleTone={m.stock !== undefined && m.stock <= 5 ? 'warning' : 'dim'}
                    onPress={() => setMedOpen(m)}
                    strike={!!m.log[day]}
                  />
                ))}
            </List>
          )}
        </Section>

        <Section title="Meta de água">
          <Card>
            <Stepper label="Meta diária" value={h.waterGoal} min={500} max={6000} step={250} onChange={h.setWaterGoal} format={fmtL} />
          </Card>
        </Section>
      </Screen>

      <Sheet visible={weightOpen} onClose={() => setWeightOpen(false)} title="Registrar peso">
        <Field
          label="Peso de hoje (kg)"
          value={weightText}
          onChangeText={setWeightText}
          placeholder={lastW ? String(lastW.kg).replace('.', ',') : '72,5'}
          keyboardType="decimal-pad"
        />
        <Button
          label="Salvar"
          disabled={!parseMoney(weightText)}
          onPress={() => {
            h.addWeight(day, parseMoney(weightText));
            setWeightText('');
            setWeightOpen(false);
          }}
        />
        {h.weights.length > 0 && (
          <List>
            {h.weights
              .slice(-6)
              .reverse()
              .map((w) => (
                <Row
                  key={w.date}
                  title={`${String(w.kg).replace('.', ',')} kg`}
                  subtitle={fromKey(w.date).toLocaleDateString('pt-BR')}
                  trailing={
                    <Pressable accessibilityLabel="Excluir" hitSlop={10} onPress={() => h.removeWeight(w.date)}>
                      <Trash size={16} color={c.textFaint} />
                    </Pressable>
                  }
                />
              ))}
          </List>
        )}
      </Sheet>

      <Sheet visible={sleepOpen} onClose={() => setSleepOpen(false)} title="Quanto você dormiu?">
        <Stepper
          label="Esta noite"
          value={h.sleep[day] ?? 7}
          min={0}
          max={14}
          step={0.5}
          onChange={(v) => h.setSleep(day, v)}
          format={(v) => `${String(v).replace('.', ',')} h`}
        />
        <T v="caption" tone="dim">
          Adultos costumam precisar de 7 a 9 horas.
        </T>
        <Button label="Pronto" onPress={() => setSleepOpen(false)} />
      </Sheet>

      <MedSheet editing={medOpen} onClose={() => setMedOpen(null)} />
    </>
  );
}

function MedSheet({ editing, onClose }: { editing: Med | 'new' | null; onClose: () => void }) {
  const { addMed, updateMed, removeMed } = useHealth.getState();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState('08:00');
  const [stock, setStock] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);

  const key = editing === 'new' ? 'new' : (editing?.id ?? null);
  if (key !== lastKey) {
    setLastKey(key);
    if (editing && editing !== 'new') {
      setName(editing.name);
      setDose(editing.dose);
      setTime(editing.time);
      setStock(editing.stock !== undefined ? String(editing.stock) : '');
    } else if (editing === 'new') {
      setName('');
      setDose('');
      setTime('08:00');
      setStock('');
    }
  }

  const validTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time);
  const save = async () => {
    if (!name.trim() || !validTime) return;
    const [hh, mm] = time.split(':').map(Number);
    const at = new Date();
    at.setHours(hh, mm, 0, 0);
    if (editing && editing !== 'new') await cancel(editing.notificationId);
    const notificationId = await schedule(`${name.trim()}${dose.trim() ? ` · ${dose.trim()}` : ''}`, at, 'daily').catch(() => undefined);
    const data = { name: name.trim(), dose: dose.trim(), time: time.padStart(5, '0'), stock: stock ? Number(stock) : undefined, notificationId };
    if (editing === 'new') addMed(data);
    else if (editing) updateMed(editing.id, data);
    onClose();
  };

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Novo remédio' : 'Editar remédio'}>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Vitamina D" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field label="Dose" value={dose} onChangeText={setDose} placeholder="1 cápsula" style={{ flex: 1 }} />
        <Field label="Horário" value={time} onChangeText={setTime} placeholder="08:00" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
      </View>
      <Field label="Estoque (opcional)" value={stock} onChangeText={setStock} placeholder="30" keyboardType="number-pad" />
      <T v="caption" tone="dim">
        Você recebe um lembrete todo dia nesse horário. Marcar como tomado desconta do estoque.
      </T>
      <Button label="Salvar" onPress={save} disabled={!name.trim() || !validTime} />
      {editing && editing !== 'new' && (
        <>
          <Button
            label={editing.paused ? 'Retomar' : 'Pausar'}
            variant="secondary"
            onPress={async () => {
              if (!editing.paused) {
                await cancel(editing.notificationId);
                updateMed(editing.id, { paused: true, notificationId: undefined });
              } else {
                const [hh, mm] = editing.time.split(':').map(Number);
                const at = new Date();
                at.setHours(hh, mm, 0, 0);
                const notificationId = await schedule(editing.name, at, 'daily').catch(() => undefined);
                updateMed(editing.id, { paused: false, notificationId });
              }
              onClose();
            }}
          />
          <Button
            label="Excluir"
            icon={Trash}
            variant="danger"
            onPress={() =>
              confirmDelete('Excluir remédio?', editing.name, async () => {
                await cancel(editing.notificationId);
                removeMed(editing.id);
                onClose();
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  waterBtn: { height: 40, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tile: { padding: space.lg, borderRadius: radius.lg, gap: 4, minHeight: 148 },
});
