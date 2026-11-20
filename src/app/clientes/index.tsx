import { router } from 'expo-router';
import { Plus, Search, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { ClientSheet } from '@/components/ClientSheet';
import { Glass } from '@/components/Glass';
import { Empty, GlassButton, List, Row, Screen, T } from '@/components/ui';
import { brl } from '@/lib/date';
import { Avatar } from '@/components/work';
import { invoiceTotal, useClients, useInvoices } from '@/store/modules';
import { radius, space, type, useColors } from '@/theme';

export default function Clientes() {
  const c = useColors();
  const clients = useClients((s) => s.items);
  const invoices = useInvoices((s) => s.items);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<'new' | null>(null);

  const list = clients
    .filter((x) => !x.archived && (x.name + ' ' + (x.company ?? '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const open = (id: string) => invoices.filter((i) => i.clientId === id && i.status !== 'paga').reduce((a, i) => a + invoiceTotal(i), 0);

  return (
    <>
      <Screen back title="Clientes" subtitle={clients.length ? `${clients.length} contatos` : 'Contatos, projetos e cobranças'} actions={<GlassButton icon={Plus} label="Novo" onPress={() => setEditing('new')} />}>
        {clients.length > 4 && (
          <Glass style={styles.search}>
            <Search size={18} color={c.textFaint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar cliente"
              placeholderTextColor={c.textFaint}
              selectionColor={c.accent}
              keyboardAppearance="dark"
              style={[type.body, { flex: 1, color: c.text }]}
            />
          </Glass>
        )}
        {clients.length === 0 ? (
          <Empty icon={Users} title="Nenhum cliente" hint="Cadastre quem você atende para ligar projetos e cobranças a cada um." action="Adicionar cliente" onAction={() => setEditing('new')} />
        ) : (
          <List>
            {list.map((x) => {
              const due = open(x.id);
              return (
                <Row
                  key={x.id}
                  leading={<Avatar name={x.name} color={x.color} />}
                  title={x.name}
                  subtitle={x.company ?? x.phone ?? x.email}
                  onPress={() => router.push(`/clientes/${x.id}`)}
                  trailing={
                    due > 0 ? (
                      <T v="caption" tabular tone="warning">
                        {brl(due)}
                      </T>
                    ) : null
                  }
                  chevron
                />
              );
            })}
          </List>
        )}
      </Screen>
      <ClientSheet editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.lg, borderRadius: radius.sm },
});
