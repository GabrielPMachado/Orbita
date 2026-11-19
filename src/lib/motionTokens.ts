import { Easing } from 'react-native-reanimated';

/**
 * Movimento do Órbita: deslizar suave, sem quicar. As molas são criticamente amortecidas
 * (não passam do ponto) e as entradas usam ease-out curto.
 * Fica fora de components/ para não criar ciclo de import (ui ⇄ motion).
 */
export const SPRING = { damping: 30, stiffness: 320, mass: 0.9, overshootClamping: true };
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const SMOOTH = { duration: 240, easing: EASE_OUT };
