import ExpoModulesCore
import MapKit

public class PlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlaceSearch")

    // Places Apple Maps finds for what the Adventurer typed, nearest the given point first.
    AsyncFunction("search") { (query: String, near: [String: Double]?) async -> [[String: Any]] in
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.resultTypes = [.pointOfInterest, .address]
      if let latitude = near?["latitude"], let longitude = near?["longitude"] {
        request.region = MKCoordinateRegion(
          center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
          latitudinalMeters: 200_000,
          longitudinalMeters: 200_000
        )
      }
      // MapKit answers a query it finds nothing for with an error, which is no place here.
      guard let response = try? await MKLocalSearch(request: request).start() else { return [] }
      return response.mapItems.prefix(5).map { item in
        let place = item.placemark
        var subtitle: [String] = []
        for part in [place.locality, place.administrativeArea, place.country].compactMap({ $0 })
        where part != item.name && !subtitle.contains(part) {
          subtitle.append(part)
        }
        return [
          "name": item.name ?? query,
          "subtitle": subtitle.joined(separator: ", "),
          "latitude": place.coordinate.latitude,
          "longitude": place.coordinate.longitude,
        ]
      }
    }
  }
}
