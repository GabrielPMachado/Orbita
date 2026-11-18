import ExpoModulesCore
import PDFKit
import UIKit
import Vision

/// Lê documentos no próprio iPhone (nada sai do aparelho):
/// - PDF: texto (PDFKit) + códigos de barras/QR das primeiras páginas (Vision);
/// - foto/print: códigos de barras/QR + texto reconhecido (OCR em português).
public class OrbitaDocsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OrbitaDocs")

    AsyncFunction("readPdf") { (uri: String, password: String?) -> [String: Any] in
      guard let url = Self.fileURL(uri), let doc = PDFDocument(url: url) else {
        throw Exception(name: "PdfError", description: "Não consegui abrir o PDF.")
      }
      if doc.isLocked {
        let ok = password.map { doc.unlock(withPassword: $0) } ?? false
        if !ok { return ["locked": true, "text": "", "codes": [String]()] }
      }
      var codes: [String] = []
      var ocr = ""
      for i in 0..<min(doc.pageCount, 3) {
        guard let page = doc.page(at: i) else { continue }
        let box = page.bounds(for: .mediaBox)
        let scale: CGFloat = 3
        let img = page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
        guard let cg = img.cgImage else { continue }
        codes += Self.barcodes(cg)
        // PDF escaneado (sem texto): reconhece o texto da página
        if (doc.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines).count < 40 {
          ocr += Self.recognizeText(cg) + "\n"
        }
      }
      return ["locked": false, "text": (doc.string ?? "") + "\n" + ocr, "codes": codes, "pages": doc.pageCount]
    }

    AsyncFunction("readImage") { (uri: String) -> [String: Any] in
      guard let url = Self.fileURL(uri),
            let data = try? Data(contentsOf: url),
            let ui = UIImage(data: data),
            let cg = Self.upright(ui) else {
        throw Exception(name: "ImageError", description: "Não consegui abrir a imagem.")
      }
      return ["text": Self.recognizeText(cg), "codes": Self.barcodes(cg)]
    }
  }

  static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") { return URL(string: uri) }
    if uri.hasPrefix("/") { return URL(fileURLWithPath: uri) }
    return URL(string: uri)
  }

  /// Foto da câmera vem com orientação EXIF; o Vision precisa dela em pé.
  static func upright(_ img: UIImage) -> CGImage? {
    if img.imageOrientation == .up { return img.cgImage }
    let r = UIGraphicsImageRenderer(size: img.size)
    return r.image { _ in img.draw(in: CGRect(origin: .zero, size: img.size)) }.cgImage
  }

  static func barcodes(_ cg: CGImage) -> [String] {
    let req = VNDetectBarcodesRequest()
    req.symbologies = [.i2of5, .itf14, .qr, .code128]
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    return (req.results ?? []).compactMap { $0.payloadStringValue }
  }

  static func recognizeText(_ cg: CGImage) -> String {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["pt-BR", "en-US"]
    req.usesLanguageCorrection = false // linha digitável não é palavra
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    return (req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }
}
