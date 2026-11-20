/**
 * Para os `catch` de "melhor esforço" (widget, notificação, arquivo de cache…): a falha não
 * deve interromper o app, mas não pode sumir sem rastro. Em desenvolvimento aparece no console.
 */
export function avisar(onde: string, erro: unknown) {
  if (__DEV__) console.warn(`[Órbita] ${onde}:`, erro);
}
