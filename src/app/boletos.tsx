import * as Clipboard from 'expo-clipboard';
import { Camera, ClipboardPaste, FileText, ImageIcon, Keyboard, Plus, QrCode, Receipt, Share2, Trash, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import { confirmDelete } from '@/components/extra';
import { Button, Card, Empty, Field, GlassButton, IconTile, List, Row, Screen, Segmented, Sheet, T, tap } from '@/components/ui';
import { lerCodigo, type BoletoInfo } from '@/lib/boleto';
import { agendarAvisos, cancelarAvisos, deFoto, dePdf, doClipboard, type Lido } from '@/lib/boletoImport';
import { brl, friendlyDate, toKey } from '@/lib/date';
import { parseMoney } from '@/lib/finance';
import { mediaUri } from '@/lib/media';
import { useBoletos, type Boleto } from '@/store/boletos';
import { useFinance } from '@/store/finance';
import { toast } from '@/store/toast';
import { radius, space, useColors } from '@/theme';

const hoje = () => toKey();
const dias = (k: string) => Math.round((new Date(`${k}T12:00:00`).getTime() - new Date(`${hoje()}T12:00:00`).getTime()) / 864e5);
const dataBR = (k?: string) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : '');
function lerData(s: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s.trim());
  if (!m) return undefined;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function quando(b: Boleto) {
  if (b.pago) return b.pagoEm ? `Pago ${friendlyDate(b.pagoEm).toLowerCase()}` : 'Pago';
  if (!b.vencimento) return 'Sem vencimento';
  const d = dias(b.vencimento);
  if (d < 0) return `Venceu há ${-d} dia${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d <= 7) return `Vence em ${d} dias`;
  return `Vence ${dataBR(b.vencimento)}`;
}

export default function Boletos() {
  const c = useColors();
  const items = useBoletos((s) => s.items);
  const [tab, setTab] = useState<'aberto' | 'pago'>('aberto');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<Boleto> | null>(null);
  const [open, setOpen] = useState<Boleto | null>(null);

  const abertos = useMemo(
    () => items.filter((b) => !b.pago).sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999')),
    [items],
  );
  const pagos = useMemo(() => items.filter((b) => b.pago).sort((a, b) => (b.pagoEm ?? '').localeCompare(a.pagoEm ?? '')), [items]);
  const totalAberto = abertos.reduce((a, b) => a + (b.valor ?? 0), 0);
  const vencidos = abertos.filter((b) => b.vencimento && dias(b.vencimento) < 0);
  const list = tab === 'aberto' ? abertos : pagos;

  const receber = (l: Lido | null) => {
    if (!l) return;
    if (!l.infos.length) {
      Alert.alert('Nenhum boleto encontrado', l.origem === 'colar' ? 'Copie a linha digitável, o código de barras ou o Pix copia e cola.' : 'Não achei código de boleto aqui. Tente outra foto ou digite.');
      return;
    }
    const usar = (i: BoletoInfo) => {
      setAdding(false);
      setForm({
        descricao: i.beneficiario ?? i.banco ?? '',
        valor: i.valor,
        vencimento: i.vencimento,
        linha: i.linha,
        barras: i.barras,
        pix: i.pix,
        banco: i.banco,
        beneficiario: i.beneficiario,
        origem: l.origem,
        arquivo: l.arquivo,
      });
      if (!i.valido) toast({ message: 'Os dígitos do código não batem: confira antes de pagar' });
    };
    if (l.infos.length === 1 || Platform.OS !== 'ios') return usar(l.infos[0]);
    // mais de um código no documento (ex.: boleto + Pix): escolhe
    const opts = l.infos.map((i) => `${i.tipo === 'pix' ? 'Pix' : 'Boleto'}${i.valor ? ` · ${brl(i.valor)}` : ''}${i.vencimento ? ` · ${dataBR(i.vencimento)}` : ''}`);
    ActionSheetIOS.showActionSheetWithOptions({ title: 'Qual usar?', options: [...opts, 'Cancelar'], cancelButtonIndex: opts.length }, (k) => {
      if (k < opts.length) usar(l.infos[k]);
    });
  };
  const guard = (fn: () => Promise<Lido | null>) => () =>
    fn()
      .then(receber)
      .catch((e) => Alert.alert('Não deu para ler', e instanceof Error ? e.message : 'Tente de novo.'));

  return (
    <>
      <Screen
        back
        title="Boletos"
        subtitle={abertos.length ? `${abertos.length} em aberto · ${brl(totalAberto)}` : 'Nada para pagar'}
        actions={<GlassButton icon={Plus} label="Adicionar" onPress={() => setAdding(true)} />}>
        {vencidos.length ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={TriangleAlert} color={c.danger} />
            <T v="callout" style={{ flex: 1 }}>
              {vencidos.length === 1 ? '1 boleto vencido' : `${vencidos.length} boletos vencidos`} · {brl(vencidos.reduce((a, b) => a + (b.valor ?? 0), 0))}
            </T>
          </Card>
        ) : null}
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'aberto', label: 'Em aberto', count: abertos.length },
            { value: 'pago', label: 'Pagos', count: pagos.length },
          ]}
        />
        {list.length === 0 ? (
          <Empty
            icon={Receipt}
            title={tab === 'aberto' ? 'Nenhum boleto em aberto' : 'Nenhum boleto pago ainda'}
            hint="Cole o código, fotografe o boleto ou abra o PDF: valor e vencimento entram sozinhos, com aviso na véspera."
            action="Adicionar boleto"
            onAction={() => setAdding(true)}
          />
        ) : (
          <List>
            {list.map((b) => {
              const venc = !b.pago && b.vencimento ? dias(b.vencimento) : 99;
              const cor = b.pago ? c.success : venc < 0 ? c.danger : venc <= 2 ? c.warning : c.accent;
              return (
                <Row
                  key={b.id}
                  leading={<IconTile icon={b.pix && !b.linha ? QrCode : Receipt} color={cor} />}
                  title={b.descricao || b.banco || 'Boleto'}
                  subtitle={[quando(b), b.banco && b.banco !== b.descricao ? b.banco : null].filter(Boolean).join(' · ')}
                  subtitleTone={!b.pago && venc < 0 ? 'danger' : 'dim'}
                  trailing={
                    <T v="headline" tabular>
                      {b.valor ? brl(b.valor) : '—'}
                    </T>
                  }
                  onPress={() => setOpen(b)}
                />
              );
            })}
          </List>
        )}
      </Screen>

      {/* de onde vem o boleto */}
      <Sheet visible={adding} onClose={() => setAdding(false)} title="Adicionar boleto">
        <List>
          <Row leading={<IconTile icon={ClipboardPaste} color={c.accent} />} title="Colar código" subtitle="Linha digitável, código de barras ou Pix" onPress={guard(async () => (await doClipboard()) ?? { infos: [], origem: 'colar' })} chevron />
          <Row leading={<IconTile icon={Camera} color={c.accent} />} title="Fotografar o boleto" subtitle="Lê o código de barras ou o QR do Pix" onPress={guard(() => deFoto('camera'))} chevron />
          <Row leading={<IconTile icon={ImageIcon} color={c.accent} />} title="Foto ou print" subtitle="Da galeria" onPress={guard(() => deFoto('library'))} chevron />
          <Row leading={<IconTile icon={FileText} color={c.accent} />} title="Abrir PDF" subtitle="Do Arquivos, do Mail ou de um download" onPress={guard(dePdf)} chevron />
          <Row
            leading={<IconTile icon={Keyboard} color={c.accent} />}
            title="Digitar"
            subtitle="Só descrição, valor e vencimento"
            onPress={() => {
              setAdding(false);
              setForm({ origem: 'manual', descricao: '' });
            }}
            chevron
          />
        </List>
        <T v="caption" tone="faint">
          Tudo é lido aqui no iPhone. No PDF do Mail: toque no anexo › Compartilhar › Salvar em Arquivos, e abra por aqui.
        </T>
      </Sheet>

      <BoletoForm draft={form} onClose={() => setForm(null)} />
      <BoletoDetail b={open ? (items.find((x) => x.id === open.id) ?? null) : null} onClose={() => setOpen(null)} onEdit={(b) => { setOpen(null); setForm(b); }} />
    </>
  );
}

/* ---------- criar / editar ---------- */

function BoletoForm({ draft, onClose }: { draft: Partial<Boleto> | null; onClose: () => void }) {
  const c = useColors();
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [venc, setVenc] = useState('');
  const [codigo, setCodigo] = useState('');
  const [key, setKey] = useState<Partial<Boleto> | null>(null);
  if (draft !== key) {
    setKey(draft);
    setDesc(draft?.descricao ?? '');
    setValor(draft?.valor ? draft.valor.toFixed(2).replace('.', ',') : '');
    setVenc(draft?.vencimento ? dataBR(draft.vencimento) : '');
    setCodigo(draft?.linha ?? draft?.pix ?? '');
  }
  const info = useMemo(() => (codigo.trim() ? lerCodigo(codigo) : null), [codigo]);
  const vencKey = lerData(venc);

  const save = async () => {
    if (!draft) return;
    const data: Omit<Boleto, 'id' | 'createdAt'> = {
      ...(draft as Boleto),
      descricao: desc.trim() || info?.banco || 'Boleto',
      valor: parseMoney(valor) || info?.valor,
      vencimento: vencKey ?? info?.vencimento,
      linha: info?.linha ?? draft.linha,
      barras: info?.barras ?? draft.barras,
      pix: info?.tipo === 'pix' ? info.pix : draft.pix,
      banco: info?.banco ?? draft.banco,
      origem: draft.origem ?? 'manual',
    };
    const avisos = data.pago ? [] : await agendarAvisos(data);
    const st = useBoletos.getState();
    if (draft.id) st.update(draft.id, { ...data, avisos });
    else st.add({ ...data, avisos });
    toast({ message: avisos.length ? 'Boleto salvo, com aviso na véspera' : 'Boleto salvo' });
    onClose();
  };

  return (
    <Sheet visible={!!draft} onClose={onClose} title={draft?.id ? 'Editar boleto' : 'Novo boleto'}>
      <Field label="Descrição" value={desc} onChangeText={setDesc} placeholder="Ex.: Mensalidade Estácio" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Field label="Valor" value={valor} onChangeText={setValor} placeholder="0,00" keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Vencimento" value={venc} onChangeText={setVenc} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
      </View>
      <Field
        label="Código (opcional)"
        value={codigo}
        onChangeText={setCodigo}
        placeholder="Linha digitável ou Pix copia e cola"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: 56, textAlignVertical: 'top' }}
      />
      {codigo.trim() ? (
        <T v="caption" color={info?.valido ? c.success : c.warning}>
          {info
            ? `${info.valido ? '✓ Código conferido' : '⚠ Dígitos não batem'}${info.banco ? ` · ${info.banco}` : ''}${info.valor ? ` · ${brl(info.valor)}` : ''}${info.vencimento ? ` · vence ${dataBR(info.vencimento)}` : ''}`
            : '⚠ Não reconheci esse código'}
        </T>
      ) : null}
      <Button label="Salvar" onPress={save} disabled={!desc.trim() && !info} />
    </Sheet>
  );
}

/* ---------- detalhes ---------- */

function BoletoDetail({ b, onClose, onEdit }: { b: Boleto | null; onClose: () => void; onEdit: (b: Boleto) => void }) {
  const c = useColors();
  if (!b) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;
  const copiar = async (v: string, o: string) => {
    tap();
    await Clipboard.setStringAsync(v);
    toast({ message: `${o} copiado` });
  };
  const pagar = () => {
    const marcar = (lancar: boolean) => {
      if (lancar && b.valor) {
        useFinance.getState().addTx({ type: 'out', amount: b.valor, category: /est[aá]cio|faculdade|mensalidade/i.test(b.descricao) ? 'Educação' : 'Contas', description: b.descricao, date: hoje() });
      }
      cancelarAvisos(b.avisos);
      useBoletos.getState().update(b.id, { pago: true, pagoEm: hoje(), avisos: [] });
      toast({ message: lancar ? 'Pago e lançado nas Finanças' : 'Marcado como pago' });
      onClose();
    };
    if (!b.valor) return marcar(false);
    Alert.alert('Marcar como pago', `Lançar ${brl(b.valor)} nas Finanças também?`, [
      { text: 'Só marcar', onPress: () => marcar(false) },
      { text: 'Lançar', style: 'default', onPress: () => marcar(true) },
    ]);
  };
  return (
    <Sheet visible onClose={onClose} title={b.descricao || 'Boleto'}>
      <View style={{ gap: 4 }}>
        <T v="largeTitle" tabular>
          {b.valor ? brl(b.valor) : 'Sem valor'}
        </T>
        <T v="callout" tone="dim">
          {[quando(b), b.vencimento && !b.pago ? dataBR(b.vencimento) : null, b.beneficiario && b.beneficiario !== b.descricao ? b.beneficiario : b.banco].filter(Boolean).join(' · ')}
        </T>
      </View>
      {b.linha ? (
        <Pressable onPress={() => copiar((b.linha ?? '').replace(/\D/g, ''), 'Código')} style={[styles.code, { backgroundColor: c.surface2 }]}>
          <T v="caption" tone="dim">
            Linha digitável · toque para copiar
          </T>
          <T v="callout" tabular>
            {b.linha}
          </T>
        </Pressable>
      ) : null}
      {b.pix ? <Button label="Copiar Pix copia e cola" icon={QrCode} variant="secondary" onPress={() => copiar(b.pix!, 'Pix')} /> : null}
      {b.arquivo ? (
        <Button label="Abrir PDF" icon={Share2} variant="secondary" onPress={() => Share.share({ url: mediaUri(b.arquivo!) }).catch(() => {})} />
      ) : null}
      {!b.pago ? <Button label="Marcar como pago" onPress={pagar} /> : (
        <Button
          label="Voltar para em aberto"
          variant="secondary"
          onPress={async () => {
            const avisos = await agendarAvisos(b);
            useBoletos.getState().update(b.id, { pago: false, pagoEm: undefined, avisos });
            onClose();
          }}
        />
      )}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button label="Editar" variant="secondary" onPress={() => onEdit(b)} style={{ flex: 1 }} />
        <Button
          label="Excluir"
          icon={Trash}
          variant="danger"
          style={{ flex: 1 }}
          onPress={() =>
            confirmDelete('Excluir boleto?', b.descricao, () => {
              cancelarAvisos(b.avisos);
              useBoletos.getState().remove(b.id);
              onClose();
            })
          }
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  code: { gap: 4, padding: space.md, borderRadius: radius.sm },
});

