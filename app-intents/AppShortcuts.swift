import AppIntents

/// Atalhos do app. Toda frase precisa conter \(.applicationName).
/// Parâmetros obrigatórios fora da frase (valor, categoria) são perguntados pela Siri.
struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: RegistrarCompraIntent(),
      phrases: [
        "Registrar compra no \(.applicationName)",
        "Anotar gasto no \(.applicationName)",
      ],
      shortTitle: "Registrar compra",
      systemImageName: "creditcard"
    )
  }
}
