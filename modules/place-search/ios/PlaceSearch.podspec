Pod::Spec.new do |s|
  s.name           = 'PlaceSearch'
  s.version        = '1.0.0'
  s.summary        = 'Apple Maps place search for the Plan sheet'
  s.description    = 'Finds named places, such as summits and huts, with MKLocalSearch.'
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
