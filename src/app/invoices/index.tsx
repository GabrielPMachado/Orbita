import { openFinancy } from '@/lib/financy';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Check, Copy, MessageCircle, Plus, ReceiptText, Send, Trash, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { confirmDelete, Stat } from '@/components/extra';
import { Avatar, invoiceMessage, statusOf, STATUS_LABEL, whatsappNumber } from '@/components/work';
import { Badge, Button, Card, Chip, Empty, Field, GlassButton, IconTile, List, Row, Screen, Segmented, Sheet, T, impact } from '@/components/ui';
import { addDays, brl, friendlyDate, toKey, today } from '@/lib/date';
import { parseMoney, thisMonth } from '@/lib/finance';
import { parseInput } from '@/lib/parse';
import { uid } from '@/lib/storage';
import { invoiceTotal, useClients, useInvoices, type Invoice, type InvoiceItem } from '@/store/modules';
import { space, useColors } from '@/theme';

type Filter = 'abertas' | 'pagas' | 'todas';

export default function Invoices() {
  const c = useColors();
  const params = useLocalSearchParams<{ novo?: string; abrir?: string }>();
  const invoices = useInvoices((s) => s.items);
  const clients = useClients((s) => s.items);
  const [filter, setFilter] = useState<Filter>('abertas');
  const [editing, setEditing] = useState<Invoice | 'new' | null>(null);
  const [presetClient, setPresetClient] = useState<string | undefined>();

  useEffect(() => {
    if (params.novo) {
      setPresetClient(params.novo);
      setEditing('new');
    } else if (params.abrir) {
      const inv = useInvoices.getState().items.find((i) => i.id === params.abrir);
      if (inv) setEditing(inv);
    }
  }, [params.novo, params.abrir]);

  const month = thisMonth();
  const open = invoices.filter((i) => i.status !== 'paga');
  const late = open.filter((i) => statusOf(i) === 'atrasada');
  const paidMonth = invoices.filter((i) => i.status === 'paga' && i.paidAt?.startsWith(month));

  const list = invoices
    .filter((i) => (filter === 'todas' ? true : filter === 'pagas' ? i.status === 'paga' : i.status !== 'paga'))
    .sort((a, b) => (filter === 'pagas' ? (b.paidAt ?? '').localeCompare(a.paidAt ?? '') : a.dueDate.localeCompare(b.dueDate)));

  return (
    <>
      <Screen
        back
        title="Invoices"
        subtitle="Cobranças dos seus clientes"
        actions={
          <GlassButton
            icon={Plus}
            label="Nova"
            onPress={() => {
              setPresetClient(undefined);
              setEditing('new');
            }}
          />
        }>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="A receber" value={brl(open.reduce((a, i) => a + invoiceTotal(i), 0))} hint={`${open.length} em aberto`} />
          <Stat
            label="Recebido no mês"
            value={brl(paidMonth.reduce((a, i) => a + invoiceTotal(i), 0))}
            color={c.success}
            hint={late.length ? `${late.length} atrasada${late.length > 1 ? 's' : ''}` : 'Nada atrasado'}
          />
        </View>

        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'abertas', label: 'Abertas', count: open.length },
            { value: 'pagas', label: 'Pagas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />

        {list.length === 0 ? (
          <Empty
            icon={ReceiptText}
            title={filter === 'pagas' ? 'Nenhuma paga ainda' : 'Nenhuma cobrança'}
            hint="Monte a cobrança com itens, mande pelo WhatsApp e, quando pagar, ela entra sozinha em Finanças."
            action={filter !== 'pagas' ? 'Nova cobrança' : undefined}
            onAction={() => setEditing('new')}
          />
        ) : (
          <List>
            {list.map((i) => {
              const st = statusOf(i);
              const client = clients.find((x) => x.id === i.clientId);
              return (
                <Row
                  key={i.id}
                  leading={
                    client ? (
                      <Avatar name={client.name} color={client.color} size={36} />
                    ) : (
                      <IconTile icon={ReceiptText} color={STATUS_LABEL[st].color} />
                    )
                  }
                  title={`#${i.number} · ${i.title}`}
                  subtitle={[
                    client?.name,
                    st === 'paga' ? `paga ${friendlyDate(i.paidAt ?? i.dueDate).toLowerCase()}` : `vence ${friendlyDate(i.dueDate).toLowerCase()}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => setEditing(i)}
                  trailing={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <T v="headline" tabular>
                        {brl(invoiceTotal(i))}
                      </T>
                      <Badge label={STATUS_LABEL[st].label} color={STATUS_LABEL[st].color} />
                    </View>
                  }
                />
              );
            })}
          </List>
        )}
      </Screen>
      <InvoiceSheet editing={editing} presetClient={presetClient} onClose={() => setEditing(null)} />
    </>
  );
}

function InvoiceSheet({ editing, presetClient, onClose }: { editing: Invoice | 'new' | null; presetClient?: string; onClose: () => void }) {
  const c = useColors();
  const { items: invoices, add, update, remove } = useInvoices();
  const clients = useClients((s) => s.items);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string | undefined>();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [due, setDue] = useState(toKey(addDays(new Date(), 7)));
  const [dueText, setDueText] = useState('');
  const [notes, setNotes] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');

  const current = editing && editing !== 'new' ? invoices.find((i) => i.id === editing.id) : undefined;

  useEffect(() => {
    if (!editing) return;
    const e = editing === 'new' ? undefined : editing;
    setTitle(e?.title ?? '');
    setClientId(e?.clientId ?? presetClient);
    setItems(e?.items ?? []);
    setDue(e?.dueDate ?? toKey(addDays(new Date(), 7)));
    setDueText('');
    setNotes(e?.notes ?? '');
    setDesc('');
    setQty('1');
    setPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const total = useMemo(() => items.reduce((a, it) => a + it.qty * it.price, 0), [items]);
  const client = clients.find((x) => x.id === clientId);

  const addItem = () => {
    const p = parseMoney(price);
    if (!desc.trim() || !p) return;
    impact();
    setItems([...items, { id: uid(), description: desc.trim(), qty: Math.max(1, Number(qty.replace(',', '.')) || 1), price: p }]);
    setDesc('');
    setQty('1');
    setPrice('');
  };

  const data = () => ({ title: title.trim() || 'Serviços', clientId, items, dueDate: due, notes: notes.trim() || undefined });

  const save = (status?: Invoice['status']) => {
    if (!items.length) return;
    if (editing === 'new') {
      const number = Math.max(0, ...invoices.map((i) => i.number)) + 1;
      const id = add({ ...data(), number, issueDate: today(), status: status ?? 'rascunho' });
      return useInvoices.getState().items.find((i) => i.id === id);
    }
    if (current) update(current.id, { ...data(), ...(status ? { status } : {}) });
    return useInvoices.getState().items.find((i) => i.id === current?.id);
  };

  const markPaid = () => {
    const inv = save();
    if (!inv) return;
    const day = today();
    update(inv.id, { status: 'paga', paidAt: day });
    onClose();
    // a entrada é lançada no Financy (o Órbita só lê as finanças de lá)
    Alert.alert('Cobrança paga', `Lançar ${brl(invoiceTotal(inv))} como entrada no Financy?`, [
      { text: 'Agora não', style: 'cancel' },
      {
        text: 'Abrir no Financy',
        onPress: () =>
          openFinancy({
            action: 'novo',
            tipo: 'income',
            valor: invoiceTotal(inv),
            categoria: 'Freela',
            descricao: `#${inv.number} · ${inv.title}${client ? ` · ${client.name}` : ''}`,
            data: day,
          }),
      },
    ]);
  };

  const copy = async () => {
    const inv = save();
    if (!inv) return;
    await Clipboard.setStringAsync(invoiceMessage(inv, client));
    Alert.alert('Copiado', 'Mensagem de cobrança pronta para colar.');
  };

  const sendWhats = () => {
    const inv = save(current?.status === 'paga' ? undefined : 'enviada');
    if (!inv || !client?.phone) return;
    Linking.openURL(`https://wa.me/${whatsappNumber(client.phone)}?text=${encodeURIComponent(invoiceMessage(inv, client))}`).catch(() => {});
    onClose();
  };

  const isPaid = current?.status === 'paga';

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Nova cobrança' : `Cobrança #${current?.number ?? ''}`}>
      <Field label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: Landing page O Vértice" />
      {clients.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Cliente
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {clients.map((x) => (
              <Chip
                key={x.id}
                label={x.name}
                color={x.color}
                active={clientId === x.id}
                onPress={() => setClientId(clientId === x.id ? undefined : x.id)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Itens
        </T>
        {items.length > 0 && (
          <List>
            {items.map((it) => (
              <Row
                key={it.id}
                title={it.description}
                subtitle={it.qty !== 1 ? `${it.qty} × ${brl(it.price)}` : undefined}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <T v="headline" tabular>
                      {brl(it.qty * it.price)}
                    </T>
                    <Pressable accessibilityLabel="Remover item" hitSlop={10} onPress={() => setItems(items.filter((x) => x.id !== it.id))}>
                      <X size={16} color={c.textFaint} />
                    </Pressable>
                  </View>
                }
              />
            ))}
          </List>
        )}
        <Field value={desc} onChangeText={setDesc} placeholder="Descrição do item" />
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Field value={qty} onChangeText={setQty} placeholder="Qtd" keyboardType="decimal-pad" style={{ flex: 0.6 }} />
          <Field
            value={price}
            onChangeText={setPrice}
            placeholder="Valor (R$)"
            keyboardType="decimal-pad"
            style={{ flex: 1 }}
            onSubmitEditing={addItem}
          />
          <GlassButton
            icon={Plus}
            accessibilityLabel="Adicionar item"
            onPress={addItem}
            color={desc.trim() && parseMoney(price) ? c.accent : c.textFaint}
          />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Vencimento · {friendlyDate(due)}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[7, 15, 30].map((d) => {
            const k = toKey(addDays(new Date(), d));
            return <Chip key={d} label={`${d} dias`} active={due === k} onPress={() => setDue(k)} />;
          })}
        </View>
        <Field
          value={dueText}
          onChangeText={(t) => {
            setDueText(t);
            const p = parseInput('x ' + t).due;
            if (p) setDue(p);
          }}
          placeholder="Outra data: 20/12, sexta…"
        />
      </View>
      <Field label="Observação" value={notes} onChangeText={setNotes} placeholder="Ex.: Pix para a chave…" />

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T v="headline" style={{ flex: 1 }}>
          Total
        </T>
        <T v="title" tabular>
          {brl(total)}
        </T>
      </Card>

      {!isPaid && <Button label="Marcar como paga" icon={Check} onPress={markPaid} disabled={!items.length} />}
      {client?.phone && !isPaid ? (
        <Button label="Enviar no WhatsApp" icon={MessageCircle} variant="secondary" onPress={sendWhats} disabled={!items.length} />
      ) : null}
      <Button label="Copiar mensagem de cobrança" icon={Copy} variant="secondary" onPress={copy} disabled={!items.length} />
      {!isPaid && (
        <Button
          label={editing === 'new' ? 'Salvar rascunho' : 'Salvar'}
          icon={Send}
          variant="secondary"
          onPress={() => {
            save();
            onClose();
          }}
          disabled={!items.length}
        />
      )}
      {isPaid && current && (
        <Button
          label="Reabrir cobrança"
          variant="secondary"
          onPress={() => {
            update(current.id, { status: 'enviada', paidAt: undefined, txId: undefined });
            onClose();
          }}
        />
      )}
      {current && (
        <Button
          label="Excluir cobrança"
          icon={Trash}
          variant="danger"
          onPress={() =>
            confirmDelete('Excluir cobrança?', `#${current.number} · ${current.title}`, () => {
              remove(current.id);
              onClose();
            })
          }
        />
      )}
    </Sheet>
  );
}
