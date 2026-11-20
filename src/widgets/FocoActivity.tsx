/**
 * Live Activity do modo foco: contagem regressiva na tela de bloqueio e na Dynamic Island.
 * O próprio iOS anima o relógio (Text com timerInterval), então ele continua certo mesmo com o
 * app fechado. Mesmas regras do 'widget': só @expo/ui, nada de fora da função.
 */
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment, type LiveActivityLayout } from 'expo-widgets';

export interface FocoProps {
  /** "Foco", "Pausa", "Pausa longa" */
  fase: string;
  /** SF Symbol da fase */
  icone: string;
  cor: string;
  /** no que está focando (ou o nome da fase) */
  titulo: string;
  /** "Ciclo 2 de 4" */
  ciclo: string;
  /** epoch ms */
  inicio: number;
  fim: number;
  pausado: boolean;
  /** "12:30" — usado quando pausado */
  restante: string;
  /** 0–1, usado quando pausado */
  progresso: number;
}

function FocoActivity(p: FocoProps, env: LiveActivityEnvironment): LiveActivityLayout {
  'widget';
  const intervalo = { lower: new Date(p.inicio), upper: new Date(p.fim) };
  const relogio = (size: number) =>
    p.pausado ? (
      <Text modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), foregroundStyle(p.cor)]}>{p.restante}</Text>
    ) : (
      <Text
        timerInterval={intervalo}
        countsDown
        modifiers={[
          font({ size, weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          foregroundStyle(p.cor),
          frame({ maxWidth: size * 3.2 }),
        ]}
      />
    );
  const barra = p.pausado ? (
    <ProgressView value={p.progresso} modifiers={[tint(p.cor)]} />
  ) : (
    <ProgressView timerInterval={intervalo} countsDown={false} modifiers={[tint(p.cor)]} />
  );

  return {
    banner: (
      <VStack spacing={10} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0B0C0F')]}>
        <HStack spacing={10}>
          <Image systemName={p.icone as never} size={20} color={p.cor} />
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#F4F5F7'), lineLimit(1)]}>{p.titulo}</Text>
            <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#9AA0AA')]}>
              {p.pausado ? `${p.fase} · pausado` : `${p.fase} · ${p.ciclo}`}
            </Text>
          </VStack>
          <Spacer />
          {relogio(30)}
        </HStack>
        {barra}
      </VStack>
    ),
    compactLeading: <Image systemName={p.icone as never} color={p.cor} />,
    compactTrailing: relogio(14),
    minimal: <Image systemName={p.pausado ? 'pause.fill' : (p.icone as never)} color={p.cor} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={p.icone as never} size={18} color={p.cor} />
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#F4F5F7')]}>{p.fase}</Text>
      </HStack>
    ),
    expandedTrailing: relogio(22),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 4 })]}>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle('#9AA0AA'), lineLimit(1)]}>{`${p.titulo} · ${p.ciclo}`}</Text>
        {barra}
      </VStack>
    ),
  };
}

const Foco = createLiveActivity<FocoProps>('FocoActivity', FocoActivity);
export default Foco;
