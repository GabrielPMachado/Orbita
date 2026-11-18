Pod::Spec.new do |s|
  s.name           = 'OrbitaDocs'
  s.version        = '1.0.0'
  s.summary        = 'Lê texto, códigos de barras e QR de PDFs e fotos (boletos).'
  s.description    = 'PDFKit + Vision para o Órbita.'
  s.author         = ''
  s.homepage       = 'https://github.com/GabrielPMachado/Orbita'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'PDFKit', 'Vision'
  s.source_files   = '**/*.{h,m,swift}'
end
