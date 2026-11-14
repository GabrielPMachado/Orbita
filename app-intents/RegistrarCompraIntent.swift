import AppIntents
internal import ExpoAppIntents

/// Categorias de saída do Órbita (espelham CATEGORIES.out em src/lib/finance.ts).
/// Quando a automação não informa a categoria, o iOS pergunta ao usuário com esta lista.
enum CategoriaCompra: String, AppEnum {
  case alimentacao, mercado, transporte, moradia, contas, lazer, saude, educacao
  case assinaturas, compras, pets, viagem, presentes, impostos, outros

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Categoria"

  static let caseDisplayRepresentations: [CategoriaCompra: DisplayRepresentation] = [
    .alimentacao: DisplayRepresentation(title: "Alimentação", image: .init(systemName: "fork.knife")),
    .mercado: DisplayRepresentation(title: "Mercado", image: .init(systemName: "cart")),
    .transporte: DisplayRepresentation(title: "Transporte", image: .init(systemName: "bus")),
    .moradia: DisplayRepresentation(title: "Moradia", image: .init(systemName: "house")),
    .contas: DisplayRepresentation(title: "Contas", image: .init(systemName: "bolt")),
    .lazer: DisplayRepresentation(title: "Lazer", image: .init(systemName: "popcorn")),
    .saude: DisplayRepresentation(title: "Saúde", image: .init(systemName: "heart.text.square")),
    .educacao: DisplayRepresentation(title: "Educação", image: .init(systemName: "book")),
    .assinaturas: DisplayRepresentation(title: "Assinaturas", image: .init(systemName: "repeat")),
    .compras: DisplayRepresentation(title: "Compras", image: .init(systemName: "bag")),
    .pets: DisplayRepresentation(title: "Pets", image: .init(systemName: "pawprint")),
    .viagem: DisplayRepresentation(title: "Viagem", image: .init(systemName: "airplane")),
    .presentes: DisplayRepresentation(title: "Presentes", image: .init(systemName: "gift")),
    .impostos: DisplayRepresentation(title: "Impostos", image: .init(systemName: "doc.text")),
    .outros: DisplayRepresentation(title: "Outros", image: .init(systemName: "ellipsis.circle")),
  ]

  /// Nome igual ao usado no JavaScript.
  var nome: String {
    switch self {
    case .alimentacao: return "Alimentação"
    case .mercado: return "Mercado"
    case .transporte: return "Transporte"
    case .moradia: return "Moradia"
    case .contas: return "Contas"
    case .lazer: return "Lazer"
    case .saude: return "Saúde"
    case .educacao: return "Educação"
    case .assinaturas: return "Assinaturas"
    case .compras: return "Compras"
    case .pets: return "Pets"
    case .viagem: return "Viagem"
    case .presentes: return "Presentes"
    case .impostos: return "Impostos"
    case .outros: return "Outros"
    }
  }
}

/// Registra uma compra SEM abrir o app.
/// Feito para a automação "Transação" (Carteira/Apple Pay) do app Atalhos:
/// Valor, Estabelecimento e Cartão vêm da transação; a Categoria fica em "Perguntar Sempre",
/// então o iOS mostra a lista de categorias e o resto acontece escondido.
/// A compra fica numa fila nativa e entra no Órbita assim que o app for aberto.
struct RegistrarCompraIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar compra"
  static let description = IntentDescription(
    "Registra uma compra no Órbita sem abrir o app. Use com a automação Transação da Carteira.",
    categoryName: "Finanças"
  )
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Valor", description: "Use o Valor da transação da Carteira.")
  var valor: String

  @Parameter(title: "Estabelecimento", description: "Use o Comerciante da transação.")
  var estabelecimento: String?

  @Parameter(title: "Cartão", description: "Use o Cartão ou Passe da transação.")
  var cartao: String?

  @Parameter(title: "Categoria", requestValueDialog: IntentDialog("Qual a categoria desta compra?"))
  var categoria: CategoriaCompra

  static var parameterSummary: some ParameterSummary {
    Summary("Registrar compra de \(\.$valor) em \(\.$categoria)") {
      \.$estabelecimento
      \.$cartao
    }
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    await AppIntentDispatcher.shared.dispatch(
      name: "registrarCompra",
      params: [
        "valor": .string(valor),
        "estabelecimento": .string(estabelecimento ?? ""),
        "cartao": .string(cartao ?? ""),
        "categoria": .string(categoria.nome),
        "origem": .string("applepay"),
      ]
    )
    return .result()
  }
}
