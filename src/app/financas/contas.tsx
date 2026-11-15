import { Wallet } from 'lucide-react-native';
import { openFinancy } from '@/lib/financy';
import { Landmark, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, Chip, Empty, Field, GlassButton, IconTile, List, Row, Screen, Sheet, T, tap } from '@/components/ui';
import { brl } from '@/lib/date';
import { ACCOUNT_COLORS, ACCOUNT_KINDS, accountBalance, parseMoney } from '@/lib/finance';
import { useFinance, type Account, type AccountKind } from '@/store/finance';
import { space, useColors } from '@/theme';

export default function Contas() {
  const fyBase = useFinance((st) => st.base === 'financy');
  const c = useColors();
  const { accounts, txs, addAccount, updateAccount, removeAccount } = useFinance();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('corrente');
  const [initial, setInitial] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);

  const open = (a: Account | 'new') => {
    setEditing(a);
    if (a === 'new') {
      setName('');
      setKind('corrente');
      setInitial('');
      setColor(ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length]);
    } else {
      setName(a.name);
      setKind(a.kind);
      setInitial(String(a.initial).replace('.', ','));
      setColor(a.color);
    }
  };

  const save = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), kind, initial: parseMoney(initial), color };
    if (editing === 'new') addAccount(data);
    else if (editing) updateAccount(editing.id, data);
    setEditing(null);
  };

  const total = accounts.reduce((a, acc) => a + accountBalance(acc, txs), 0);

  return (
    <>
      <Screen back title="Contas" subtitle="Onde seu dinheiro está" actions={fyBase ? undefined : <GlassButton icon={Plus} label="Nova" onPress={() => open('new')} />}>
      {fyBase ? (
        <Card onPress={() => openFinancy()} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={Wallet} color="#10B981" />
          <T v="callout" tone="dim" style={{ flex: 1 }}>
            As contas e o saldo vêm do Financy. Para mexer nelas, abra o Financy.
          </T>
        </Card>
      ) : null}
        {accounts.length === 0 ? (
          <Empty
            icon={Landmark}
            title="Nenhuma conta"
            hint="Cadastre banco, carteira e investimentos com o saldo de hoje. A partir daí o Órbita calcula tudo sozinho."
            action="Adicionar conta"
            onAction={() => open('new')}
          />
        ) : (
          <>
            <Card style={{ padding: space.xl, gap: 2 }}>
              <T v="caption" tone="dim">
                Total em contas
              </T>
              <T v="largeTitle" tabular color={total < 0 ? c.danger : c.text}>
                {brl(total)}
              </T>
            </Card>
            <List>
              {accounts.map((a) => {
                const bal = accountBalance(a, txs);
                return (
                  <Row
                    key={a.id}
                    leading={<IconTile icon={Landmark} color={a.color} />}
                    title={a.name}
                    subtitle={ACCOUNT_KINDS[a.kind]}
                    onPress={() => open(a)}
                    trailing={
                      <T v="headline" tabular color={bal < 0 ? c.danger : c.text}>
                        {brl(bal)}
                      </T>
                    }
                  />
                );
              })}
            </List>
            <T v="caption" tone="faint" align="center">
              O saldo considera só lançamentos marcados como pagos/recebidos.
            </T>
          </>
        )}
      </Screen>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nova conta' : 'Editar conta'}>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Nubank, Carteira" autoFocus={editing === 'new'} />
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Tipo
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((k) => (
              <Chip key={k} label={ACCOUNT_KINDS[k]} active={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
        </View>
        <Field label="Saldo atual (R$)" value={initial} onChangeText={setInitial} placeholder="0,00" keyboardType="numbers-and-punctuation" />
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Cor
          </T>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {ACCOUNT_COLORS.map((col) => (
              <Pressable
                key={col}
                accessibilityLabel={col}
                onPress={() => {
                  tap();
                  setColor(col);
                }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: 3, borderColor: color === col ? c.text : 'transparent' }}
              />
            ))}
          </View>
        </View>
        <Button label="Salvar" onPress={save} disabled={!name.trim()} />
        {editing && editing !== 'new' && (
          <Button
            label="Excluir conta"
            icon={Trash}
            variant="danger"
            onPress={() =>
              Alert.alert('Excluir conta?', 'Os lançamentos continuam salvos, só ficam sem conta.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: () => {
                    removeAccount(editing.id);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        )}
      </Sheet>
    </>
  );
}
