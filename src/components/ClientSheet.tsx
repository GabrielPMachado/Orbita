import { Trash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useClients, type Client } from '@/store/modules';
import { space } from '@/theme';
import { ColorPicker, PALETTE, confirmDelete } from './extra';
import { Button, Field, Sheet, T } from './ui';

export function ClientSheet({ editing, onClose, onDeleted }: { editing: Client | 'new' | null; onClose: () => void; onDeleted?: () => void }) {
  const { items, add, update, remove } = useClients();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState(PALETTE[6]);

  useEffect(() => {
    if (!editing) return;
    const e = editing === 'new' ? undefined : editing;
    setName(e?.name ?? '');
    setCompany(e?.company ?? '');
    setPhone(e?.phone ?? '');
    setEmail(e?.email ?? '');
    setNotes(e?.notes ?? '');
    setColor(e?.color ?? PALETTE[(items.length + 6) % PALETTE.length]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      company: company.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
    };
    if (editing === 'new') add(data);
    else if (editing) update(editing.id, data);
    onClose();
  };

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Novo cliente' : 'Editar cliente'}>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Dindo" autoCapitalize="words" />
      <Field label="Empresa" value={company} onChangeText={setCompany} placeholder="Opcional" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field label="WhatsApp / telefone" value={phone} onChangeText={setPhone} placeholder="(51) 99999-0000" keyboardType="phone-pad" style={{ flex: 1 }} />
      </View>
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="Opcional" keyboardType="email-address" autoCapitalize="none" />
      <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Como prefere ser cobrado, combinados…" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Cor
        </T>
        <ColorPicker value={color} onChange={setColor} />
      </View>
      <Button label="Salvar" onPress={save} disabled={!name.trim()} />
      {editing && editing !== 'new' && (
        <Button
          label="Excluir cliente"
          icon={Trash}
          variant="danger"
          onPress={() =>
            confirmDelete('Excluir cliente?', 'Projetos e cobranças continuam salvos, só ficam sem cliente.', () => {
              remove(editing.id);
              onClose();
              onDeleted?.();
            })
          }
        />
      )}
    </Sheet>
  );
}
