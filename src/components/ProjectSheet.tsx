import { Archive } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useClients, useProjects, type Project } from '@/store/modules';
import { space } from '@/theme';
import { ColorPicker, PALETTE } from './extra';
import { Button, Chip, Field, Sheet, T } from './ui';

/** Criar ou editar projeto. `editing` = 'new' | projeto | null (fechado). */
export function ProjectSheet({ editing, onClose, defaultParent }: { editing: Project | 'new' | null; onClose: () => void; defaultParent?: string }) {
  const { items: projects, add, update } = useProjects();
  const clients = useClients((s) => s.items);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PALETTE[5]);
  const [clientId, setClientId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | undefined>();

  useEffect(() => {
    if (!editing) return;
    if (editing === 'new') {
      setName('');
      setDescription('');
      setColor(PALETTE[(projects.length + 5) % PALETTE.length]);
      setClientId(undefined);
      setParentId(defaultParent);
    } else {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setColor(editing.color);
      setClientId(editing.clientId);
      setParentId(editing.parentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), description: description.trim() || undefined, color, clientId, parentId };
    if (editing === 'new') add(data);
    else if (editing) update(editing.id, data);
    onClose();
  };

  const parents = projects.filter((p) => !p.parentId && !p.archived && (editing === 'new' || p.id !== editing?.id));

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Novo projeto' : 'Editar projeto'}>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: App do Bar do Dindo" />
      <Field
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        placeholder="Opcional"
        multiline
        style={{ minHeight: 64, textAlignVertical: 'top' }}
      />
      {clients.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Cliente
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="Nenhum" active={!clientId} onPress={() => setClientId(undefined)} />
            {clients.map((c) => (
              <Chip key={c.id} label={c.name} active={clientId === c.id} onPress={() => setClientId(c.id)} color={c.color} />
            ))}
          </View>
        </View>
      )}
      {parents.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Subprojeto de
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="Nenhum" active={!parentId} onPress={() => setParentId(undefined)} />
            {parents.map((p) => (
              <Chip key={p.id} label={p.name} active={parentId === p.id} onPress={() => setParentId(p.id)} color={p.color} />
            ))}
          </View>
        </View>
      )}
      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Cor
        </T>
        <ColorPicker value={color} onChange={setColor} />
      </View>
      <Button label="Salvar" onPress={save} disabled={!name.trim()} />
      {editing && editing !== 'new' && (
        <Button
          label={editing.archived ? 'Desarquivar' : 'Arquivar projeto'}
          icon={Archive}
          variant="secondary"
          onPress={() => {
            update(editing.id, { archived: !editing.archived });
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
