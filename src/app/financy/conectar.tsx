/**
 * orbita://financy/conectar?chave=... — o Financy abre este link com a chave, e a conexão
 * acontece sozinha, sem você ver nem colar nada.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { T } from '@/components/ui';
import { connectFinancy } from '@/lib/financy';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

export default function ConectarFinancy() {
  const c = useColors();
  const { chave } = useLocalSearchParams<{ chave?: string }>();
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    if (!chave) {
      router.replace('/financas/financy');
      return;
    }
    connectFinancy(String(chave))
      .then(() => {
        toast({ message: 'Financy conectado' });
        router.replace('/financas/financy');
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível conectar.'));
  }, [chave]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }}>
      {erro ? (
        <>
          <T v="headline">Não deu certo</T>
          <T v="callout" tone="dim" align="center">
            {erro}
          </T>
          <T v="callout" color={c.accent} onPress={() => router.replace('/financas/financy')}>
            Voltar
          </T>
        </>
      ) : (
        <>
          <ActivityIndicator color={c.accent} />
          <T v="callout" tone="dim">
            Conectando ao Financy…
          </T>
        </>
      )}
    </View>
  );
}
