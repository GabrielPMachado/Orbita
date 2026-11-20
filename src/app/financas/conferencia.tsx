import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  CircleHelp,
  Download,
  EyeOff,
  Landmark,
  Settings2,
  ThumbsUp,
  Undo2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AnimatedNumber, SwipeRow } from '@/components/motion';
import { Button, Card, Chip, Empty, Field, GlassButton, IconTile, List, Progress, Row, Screen, Segmented, Sheet, T, impact } from '@/components/ui';
import { brl, friendlyDate } from '@/lib/date';
import { CATEGORIES, category, txLabel } from '@/lib/finance';
import { guessCategory, importBankTx, prettyDesc, review, syncPluggy, unverify } from '@/lib/pluggySync';
import type { BankTx } from '@/lib/reconcile';
import { useFinance } from '@/store/finance';
import { usePluggy } from '@/store/pluggy';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

type Tab = 'banco' | 'app' | 'ok';

function ago(ms?: number) {
  if (!ms) return 'nunca';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export default function Conferencia() {
  const c = useColors();
  const txs = useFinance((s) => s.txs);
  const p = usePluggy();
  const [tab, setTab] = useState<Tab>('banco');
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState<BankTx | null>(null);
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('Outros');

  const r = useMemo(() => review(txs, p), [txs, p]);
  const accountName = (b: BankTx) => {
    const a = p.accounts.find(
      (x) => (b.localCardId && x.localCardId === b.localCardId) || (b.localAccountId && x.localAccountId === b.localAccountId),
    );
    return a ? `${a.bank} · ${a.name}` : 'Banco';
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await syncPluggy();
      toast({
        message: res.verified
          ? `${res.verified} novo${res.verified > 1 ? 's' : ''} conferido${res.verified > 1 ? 's' : ''}`
          : 'Tudo em dia com o banco',
      });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Falha ao sincronizar', kind: 'danger' });
    } finally {
      setSyncing(false);
    }
  };

  const openImport = (b: BankTx) => {
    setImporting(b);
    setDesc(prettyDesc(b.description));
    setCat(guessCategory(b, txs));
  };
  const doImport = () => {
    if (!importing) return;
    importBankTx(importing, cat, desc);
    impact();
    toast({ message: `${desc || prettyDesc(importing.description)} importado` });
    setImporting(null);
  };
  const ignore = (b: BankTx) => {
    p.ignore(b.id);
    toast({ message: 'Ignorado', action: { label: 'Desfazer', onPress: () => usePluggy.getState().unignore(b.id) } });
  };

  if (!p.configured) {
    return (
      <Screen back title="Conferência" subtitle="Seus lançamentos × extrato do banco">
        <Empty
          icon={Landmark}
          title="Conecte o Meu Pluggy"
          hint="O extrato oficial confere cada compra do Apple Pay e mostra o que ficou de fora (cartão físico, Pix, débito automático)."
          action="Configurar"
          onAction={() => router.push('/financas/pluggy')}
        />
      </Screen>
    );
  }

  const checked = r.verified.length;
  const total = checked + r.localOnly.length;

  return (
    <Screen
      back
      title="Conferência"
      subtitle={`Últimos 45 dias · atualizado ${ago(p.lastSync)}`}
      onRefresh={sync}
      actions={<GlassButton icon={Settings2} accessibilityLabel="Configurar Meu Pluggy" onPress={() => router.push('/financas/pluggy')} />}>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row' }}>
          {[
            { label: 'Conferidos', value: checked, color: c.success },
            { label: 'Só no banco', value: r.bankOnly.length, color: c.warning },
            { label: 'Só no app', value: r.localOnly.length, color: c.danger },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, gap: 2 }}>
              <AnimatedNumber
                value={s.value}
                render={(t) => (
                  <T v="title" tabular color={s.value ? s.color : c.textFaint}>
                    {t}
                  </T>
                )}
              />
              <T v="caption" tone="dim">
                {s.label}
              </T>
            </View>
          ))}
        </View>
        <Progress value={total ? checked / total : 0} color={c.success} />
        {p.lastError ? (
          <T v="caption" color={c.danger}>
            {p.lastError}
          </T>
        ) : null}
        {syncing ? (
          <T v="caption" tone="faint">
            Atualizando com o banco…
          </T>
        ) : null}
      </Card>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'banco', label: 'No banco', count: r.bankOnly.length },
          { value: 'app', label: 'No app', count: r.localOnly.length },
          { value: 'ok', label: 'Conferidos' },
        ]}
      />

      {tab === 'banco' &&
        (r.bankOnly.length ? (
          <View style={{ gap: space.sm }}>
            <List>
              {r.bankOnly.map((b) => (
                <SwipeRow
                  key={b.id}
                  left={{ icon: Download, label: 'Importar', color: c.success, onAction: () => openImport(b) }}
                  right={{ icon: EyeOff, label: 'Ignorar', color: '#5B616B', onAction: () => ignore(b) }}>
                  <View>
                    <Row
                      leading={<IconTile icon={b.type === 'in' ? ArrowDownLeft : ArrowUpRight} color={b.type === 'in' ? c.success : c.warning} />}
                      title={prettyDesc(b.description)}
                      subtitle={`${friendlyDate(b.date)}  ·  ${accountName(b)}`}
                      onPress={() => openImport(b)}
                      trailing={
                        <T v="headline" tabular color={b.type === 'in' ? c.success : c.text}>
                          {b.type === 'in' ? '+ ' : '− '}
                          {brl(b.amount)}
                        </T>
                      }
                    />
                  </View>
                </SwipeRow>
              ))}
            </List>
            <T v="caption" tone="faint">
              Estão no extrato mas não no Órbita. Toque para importar com a categoria; deslize para a esquerda para ignorar.
            </T>
          </View>
        ) : (
          <Empty icon={BadgeCheck} title="Nada faltando" hint="Tudo que saiu do banco já está registrado no Órbita." />
        ))}

      {tab === 'app' &&
        (r.localOnly.length ? (
          <View style={{ gap: space.sm }}>
            <List>
              {r.localOnly.map((t) => {
                const cg = category(t.category, t.type);
                return (
                  <SwipeRow
                    key={t.id}
                    left={{
                      icon: ThumbsUp,
                      label: 'Está certo',
                      color: c.success,
                      onAction: () => {
                        p.markLocalOk(t.id);
                        toast({ message: 'Marcado como certo' });
                      },
                    }}>
                    <View>
                      <Row
                        leading={<IconTile icon={cg.icon} color={cg.color} />}
                        title={txLabel(t)}
                        subtitle={`${friendlyDate(t.date)}  ·  não apareceu no extrato`}
                        subtitleTone="warning"
                        onPress={() => router.push(`/financas/${t.id}`)}
                        trailing={
                          <T v="headline" tabular>
                            {t.type === 'in' ? '+ ' : '− '}
                            {brl(t.amount)}
                          </T>
                        }
                      />
                    </View>
                  </SwipeRow>
                );
              })}
            </List>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <CircleHelp size={14} color={c.textFaint} style={{ marginTop: 2 }} />
              <T v="caption" tone="faint" style={{ flex: 1 }}>
                Pode ser valor digitado diferente, compra cancelada ou algo que ainda não compensou. Toque para corrigir ou deslize para a direita se
                estiver certo.
              </T>
            </View>
          </View>
        ) : (
          <Empty icon={ThumbsUp} title="Sem pendências" hint="Todos os lançamentos das contas vinculadas bateram com o banco." />
        ))}

      {tab === 'ok' &&
        (r.verified.length ? (
          <List>
            {r.verified.slice(0, 80).map((t) => {
              const cg = category(t.category, t.type);
              return (
                <SwipeRow
                  key={t.id}
                  right={{
                    icon: Undo2,
                    label: 'Desfazer',
                    color: '#5B9DFF',
                    onAction: () => {
                      unverify(t.id);
                      toast({ message: 'Selo removido' });
                    },
                  }}>
                  <View>
                    <Row
                      leading={<IconTile icon={cg.icon} color={cg.color} />}
                      title={txLabel(t)}
                      subtitle={`${friendlyDate(t.date)}  ·  ${t.source === 'pluggy' ? 'importado do banco' : t.source === 'applepay' ? 'Apple Pay' : 'manual'}`}
                      onPress={() => router.push(`/financas/${t.id}`)}
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <T v="callout" tabular>
                            {brl(t.amount)}
                          </T>
                          <BadgeCheck size={16} color={c.success} />
                        </View>
                      }
                    />
                  </View>
                </SwipeRow>
              );
            })}
          </List>
        ) : (
          <Empty icon={BadgeCheck} title="Nada conferido ainda" hint="Sincronize para o banco confirmar seus lançamentos." />
        ))}

      <Sheet visible={!!importing} onClose={() => setImporting(null)} title="Importar do banco">
        {importing ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T v="callout" tone="dim">
                {friendlyDate(importing.date)} · {accountName(importing)}
              </T>
              <T v="title" tabular color={importing.type === 'in' ? c.success : c.text}>
                {brl(importing.amount)}
              </T>
            </View>
            <Field label="Descrição" value={desc} onChangeText={setDesc} />
            <T v="overline" tone="dim">
              Categoria
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {CATEGORIES[importing.type].map((k) => (
                <Chip key={k.name} label={k.name} icon={k.icon} color={k.color} active={cat === k.name} onPress={() => setCat(k.name)} />
              ))}
            </View>
            <Button label="Importar" icon={Download} onPress={doImport} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
