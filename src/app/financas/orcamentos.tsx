import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, IconTile, List, Progress, Row, Screen, Sheet, T } from '@/components/ui';
import { brl } from '@/lib/date';
import { byCategory, CATEGORIES, monthName, parseMoney, thisMonth } from '@/lib/finance';
import { useFinance } from '@/store/finance';
import { space, useColors } from '@/theme';

export default function Orcamentos() {
  const c = useColors();
  const { txs, budgets, setBudget } = useFinance();
  const month = thisMonth();
  const spent = Object.fromEntries(byCategory(txs, month));
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');

  const totalBudget = Object.values(budgets).reduce((a, v) => a + v, 0);
  const totalSpent = Object.keys(budgets).reduce((a, k) => a + (spent[k] ?? 0), 0);

  const open = (cat: string) => {
    setEditing(cat);
    setValue(budgets[cat] ? String(budgets[cat]).replace('.', ',') : '');
  };

  const withBudget = CATEGORIES.out.filter((k) => budgets[k.name]);
  const without = CATEGORIES.out.filter((k) => !budgets[k.name]);

  return (
    <>
      <Screen back title="Orçamentos" subtitle={`Limites de gasto em ${monthName(month).toLowerCase()}`}>
        {totalBudget > 0 && (
          <Card style={{ padding: space.xl, gap: space.md }}>
            <View style={{ gap: 2 }}>
              <T v="caption" tone="dim">
                Gasto nas categorias com limite
              </T>
              <T v="largeTitle" tabular>
                {brl(totalSpent)}
                <T v="callout" tone="dim">
                  {' '}
                  de {brl(totalBudget)}
                </T>
              </T>
            </View>
            <Progress value={totalSpent / totalBudget} color={totalSpent > totalBudget ? c.danger : undefined} />
            <T v="caption" tone={totalSpent > totalBudget ? 'danger' : 'dim'}>
              {totalSpent > totalBudget ? `Passou ${brl(totalSpent - totalBudget)} do planejado` : `Restam ${brl(totalBudget - totalSpent)}`}
            </T>
          </Card>
        )}

        {withBudget.length > 0 && (
          <List>
            {withBudget.map((k) => {
              const s = spent[k.name] ?? 0;
              const b = budgets[k.name];
              const over = s > b;
              return (
                <Row
                  key={k.name}
                  leading={<IconTile icon={k.icon} color={k.color} />}
                  title={k.name}
                  subtitle={over ? `Estourou ${brl(s - b)}` : `Restam ${brl(b - s)}`}
                  subtitleTone={over ? 'danger' : 'dim'}
                  onPress={() => open(k.name)}
                  trailing={
                    <View style={{ width: 96, gap: 6, alignItems: 'flex-end' }}>
                      <T v="caption" tabular>
                        {Math.round((s / b) * 100)}%
                      </T>
                      <View style={{ width: '100%' }}>
                        <Progress value={s / b} color={over ? c.danger : k.color} height={4} />
                      </View>
                    </View>
                  }
                />
              );
            })}
          </List>
        )}

        <T v="overline" tone="dim">
          {withBudget.length ? 'Sem limite definido' : 'Toque numa categoria para definir um limite'}
        </T>
        <List>
          {without.map((k) => (
            <Row
              key={k.name}
              leading={<IconTile icon={k.icon} color={k.color} />}
              title={k.name}
              subtitle={spent[k.name] ? `${brl(spent[k.name])} gastos este mês` : 'Nada gasto este mês'}
              onPress={() => open(k.name)}
              chevron
            />
          ))}
        </List>
      </Screen>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? `Limite · ${editing}` : ''}>
        <Field label="Limite mensal (R$)" value={value} onChangeText={setValue} placeholder="0,00" keyboardType="decimal-pad" />
        <Button
          label="Salvar limite"
          onPress={() => {
            if (editing) setBudget(editing, parseMoney(value));
            setEditing(null);
          }}
          disabled={!parseMoney(value)}
        />
        {editing && budgets[editing] ? (
          <Button
            label="Remover limite"
            variant="secondary"
            onPress={() => {
              setBudget(editing);
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}
