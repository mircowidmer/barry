Pod::Spec.new do |s|
  s.name           = 'LiveActivityTaps'
  s.version        = '1.0.0'
  s.summary        = 'Keeps the taps on the Live Activity until the JavaScript takes them'
  s.description    = 'Records each button tap of the Live Activity from launch, so a tap that relaunches Barry is not lost.'
  s.license        = 'UNLICENSED'
  s.author         = 'Barry'
  s.homepage       = 'https://barry.support'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
end
