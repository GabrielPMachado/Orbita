/**
 * Widget de saldo (tela de bloqueio + tela inicial).
 *
 * Regras do 'widget' (expo-widgets): a função roda num runtime isolado dentro da extensão do iOS.
 * Só componentes do @expo/ui, sem hooks, sem imports dentro dela e sem usar constantes de fora —
 * tudo que ela precisa chega pelas props (calculadas no app em lib/widgetSync.ts).
 */
import { AccessoryWidgetBackground, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  widgetAccentedRenderingMode,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface SaldoProps {
  /** "R$ 4.218,90" */
  saldo: string;
  /** "R$ 4,2 mil" — cabe no círculo */
  saldoCurto: string;
  /** resultado do mês: "+ R$ 1.204,00" */
  mes: string;
  mesPositivo: boolean;
  /** "Saídas R$ 2.310 · Entradas R$ 3.514" */
  detalhe: string;
  /** "Atualizado 14:32" */
  atualizado: string;
  /** esconde os valores (modo discreto) */
  oculto: boolean;
  cor: string;
}

function SaldoWidget(p: SaldoProps, env: WidgetEnvironment) {
  'widget';
  const fam = env.widgetFamily;
  const saldo = p.oculto ? 'R$ •••••' : p.saldo;
  const curto = p.oculto ? '•••' : p.saldoCurto;
  const mes = p.oculto ? '•••' : p.mes;
  const corMes = p.mesPositivo ? '#34D399' : '#F87171';

  if (fam === 'accessoryInline') {
    return (
      <HStack modifiers={[widgetURL('orbita://financas')]}>
        <Image systemName="wallet.bifold" />
        <Text>{` ${saldo}`}</Text>
      </HStack>
    );
  }

  if (fam === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL('orbita://financas'), containerBackground('clear', 'widget')]}>
        <AccessoryWidgetBackground />
        <VStack spacing={1}>
          <Image systemName="brazilianrealsign" size={13} modifiers={[widgetAccentedRenderingMode('accented')]} />
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'rounded' }),
              monospacedDigit(),
              lineLimit(1),
              minimumScaleFactor(0.5),
              padding({ horizontal: 4 }),
            ]}>
            {curto}
          </Text>
        </VStack>
      </ZStack>
    );
  }

  if (fam === 'accessoryRectangular') {
    return (
      <VStack
        alignment="leading"
        spacing={1}
        modifiers={[widgetURL('orbita://financas'), containerBackground('clear', 'widget'), frame({ maxWidth: 9999, alignment: 'leading' })]}>
        <HStack spacing={4}>
          <Image systemName="wallet.bifold.fill" size={11} modifiers={[widgetAccentedRenderingMode('accented')]} />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>Saldo</Text>
        </HStack>
        <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.6)]}>
          {saldo}
        </Text>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), monospacedDigit(), lineLimit(1), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          {`Mês ${mes}`}
        </Text>
      </VStack>
    );
  }

  // systemSmall / systemMedium (tela inicial)
  const largo = fam === 'systemMedium';
  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        widgetURL('orbita://financas'),
        containerBackground(
          { type: 'linearGradient', colors: ['#16181D', '#0B0C0F'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
          'widget',
        ),
      ]}>
      <HStack spacing={6}>
        <Image systemName="wallet.bifold.fill" size={13} color={p.cor} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#9AA0AA')]}>Saldo atual</Text>
        <Spacer />
      </HStack>
      <Text
        modifiers={[
          font({ size: largo ? 30 : 24, weight: 'bold', design: 'rounded' }),
          monospacedDigit(),
          lineLimit(1),
          minimumScaleFactor(0.5),
          foregroundStyle('#F4F5F7'),
        ]}>
        {saldo}
      </Text>
      <Spacer />
      <HStack spacing={4}>
        <Image systemName={p.mesPositivo ? 'arrow.up.right' : 'arrow.down.right'} size={11} color={corMes} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.7), foregroundStyle(corMes)]}>
          {`${mes} no mês`}
        </Text>
      </HStack>
      {largo && !p.oculto ? (
        <Text modifiers={[font({ size: 12, weight: 'medium' }), monospacedDigit(), lineLimit(1), foregroundStyle('#9AA0AA')]}>{p.detalhe}</Text>
      ) : null}
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#5F6570')]}>{p.atualizado}</Text>
    </VStack>
  );
}

const Saldo = createWidget<SaldoProps>('SaldoWidget', SaldoWidget);
export default Saldo;
