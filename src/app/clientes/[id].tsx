import { router, useLocalSearchParams } from 'expo-router';
import { Briefcase, Mail, MessageCircle, Pencil, Phone, ReceiptText } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ClientSheet } from '@/components/ClientSheet';
import { Stat } from '@/components/extra';
import { Glass } from '@/components/Glass';
import { Card, GlassButton, IconTile, List, Row, Screen, Section, T, tap } from '@/components/ui';
import { brl, friendlyDate } from '@/lib/date';
import { invoiceTotal, useClients, useInvoices, useProjects } from '@/store/modules';
import { space, useColors } from '@/theme';
import { Avatar, statusOf, STATUS_LABEL, whatsappNumber } from '@/components/work';

export default function Cliente() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useClients((s) => s.items.find((x) => x.id === id));
  const projects = useProjects((s) => s.items);
  const invoices = useInvoices((s) => s.items);
  const [editing, setEditing] = useState(false);
  if (!client) return null;

  const mine = invoices.filter((i) => i.clientId === id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const paid = mine.filter((i) => i.status === 'paga').reduce((a, i) => a + invoiceTotal(i), 0);
  const open = mine.filter((i) => i.status !== 'paga').reduce((a, i) => a + invoiceTotal(i), 0);
  const projs = projects.filter((p) => p.clientId === id && !p.archived);

  const actions = [
    client.phone && { icon: MessageCircle, label: 'WhatsApp', url: `https://wa.me/${whatsappNumber(client.phone)}` },
    client.phone && { icon: Phone, label: 'Ligar', url: `tel:${client.phone.replace(/[^\d+]/g, '')}` },
    client.email && { icon: Mail, label: 'E-mail', url: `mailto:${client.email}` },
  ].filter(Boolean) as { icon: typeof Phone; label: string; url: string }[];

  return (
    <>
      <Screen back actions={<GlassButton icon={Pencil} accessibilityLabel="Editar cliente" onPress={() => setEditing(true)} />}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Avatar name={client.name} color={client.color} size={84} />
          <T v="title">{client.name}</T>
          {client.company ? (
            <T v="callout" tone="dim">
              {client.company}
            </T>
          ) : null}
        </View>

        {actions.length > 0 && (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="link"
                onPress={() => {
                  tap();
                  Linking.openURL(a.url).catch(() => {});
                }}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
                <Glass interactive style={{ height: 68, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <View>
                    <a.icon size={20} color={c.accent} />
                  </View>
                  <T v="caption">{a.label}</T>
                </Glass>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Recebido" value={brl(paid)} color={c.success} />
          <Stat label="A receber" value={brl(open)} color={open ? c.warning : undefined} />
        </View>

        <Section title="Projetos">
          {projs.length ? (
            <List>
              {projs.map((p) => (
                <Row
                  key={p.id}
                  leading={<IconTile icon={Briefcase} color={p.color} />}
                  title={p.name}
                  onPress={() => router.push(`/trabalho/${p.id}`)}
                  chevron
                />
              ))}
            </List>
          ) : (
            <T v="callout" tone="faint">
              Nenhum projeto ligado a este cliente.
            </T>
          )}
        </Section>

        <Section title="Cobranças" action="Nova" onAction={() => router.push({ pathname: '/invoices', params: { novo: id } })}>
          {mine.length ? (
            <List>
              {mine.map((i) => {
                const st = statusOf(i);
                return (
                  <Row
                    key={i.id}
                    leading={<IconTile icon={ReceiptText} color={STATUS_LABEL[st].color} />}
                    title={`#${i.number} · ${i.title}`}
                    subtitle={`${STATUS_LABEL[st].label} · vence ${friendlyDate(i.dueDate).toLowerCase()}`}
                    onPress={() => router.push({ pathname: '/invoices', params: { abrir: i.id } })}
                    trailing={
                      <T v="headline" tabular>
                        {brl(invoiceTotal(i))}
                      </T>
                    }
                  />
                );
              })}
            </List>
          ) : (
            <T v="callout" tone="faint">
              Nenhuma cobrança ainda.
            </T>
          )}
        </Section>

        {client.notes ? (
          <Section title="Observações">
            <Card>
              <T v="callout" tone="dim">
                {client.notes}
              </T>
            </Card>
          </Section>
        ) : null}
      </Screen>
      <ClientSheet editing={editing ? client : null} onClose={() => setEditing(false)} onDeleted={() => router.back()} />
    </>
  );
}
