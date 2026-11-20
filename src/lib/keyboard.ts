/**
 * Altura do teclado para folhas e modais.
 *
 * O KeyboardAvoidingView não funciona direito dentro de <Modal> no iOS (e não mexe em
 * filhos com posição absoluta), então as folhas ouvem o teclado aqui e sobem sozinhas.
 */
import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, TextInput, type ScrollView } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

export type ScrollRef = ComponentRef<typeof ScrollView>;

export function useKeyboardInset() {
  const inset = useSharedValue(0);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidShow', (e) => {
      // teclado flutuante/desencaixado no iPad: screenY acima do fim da tela
      const h = Math.max(0, e.endCoordinates.height);
      inset.value = withTiming(h, { duration: e.duration || 250, easing: Easing.bezier(0.17, 0.59, 0.4, 0.77) });
      setHeight(h);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      inset.value = withTiming(0, { duration: e?.duration || 250, easing: Easing.bezier(0.17, 0.59, 0.4, 0.77) });
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { inset, height };
}

/** Rola a folha até o campo em foco quando o teclado abre. */
export function useScrollToFocused(scroll: RefObject<ScrollRef | null>, keyboardHeight: number) {
  const last = useRef(0);
  useEffect(() => {
    if (!keyboardHeight || keyboardHeight === last.current) {
      last.current = keyboardHeight;
      return;
    }
    last.current = keyboardHeight;
    // espera a folha terminar de subir/encolher
    const t = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.() as unknown as { measureLayout?: Function } | null;
      const inner = (scroll.current as unknown as { getInnerViewRef?: () => unknown })?.getInnerViewRef?.();
      if (!input?.measureLayout || !inner) return;
      try {
        input.measureLayout(
          inner,
          (_x: number, y: number) => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }),
          () => {},
        );
      } catch {
        /* campo fora desta folha */
      }
    }, 280);
    return () => clearTimeout(t);
  }, [keyboardHeight, scroll]);
}
