package support.barry.placesearch

import android.location.Geocoder
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.cos

class PlaceSearchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PlaceSearch")

    // Places the Android geocoder finds for what the Adventurer typed, within about 100 km of the given point.
    AsyncFunction("search") { query: String, near: Map<String, Double>? ->
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      if (!Geocoder.isPresent()) return@AsyncFunction emptyList<Map<String, Any>>()
      val geocoder = Geocoder(context)
      val latitude = near?.get("latitude")
      val longitude = near?.get("longitude")
      // The geocoder throws on a network failure, which is no place here, as on iOS.
      val found = try {
        @Suppress("DEPRECATION")
        if (latitude != null && longitude != null) {
          val dLat = 0.9
          val dLon = 0.9 / cos(Math.toRadians(latitude)).coerceAtLeast(0.1)
          geocoder.getFromLocationName(query, 5, latitude - dLat, longitude - dLon, latitude + dLat, longitude + dLon)
            ?.takeIf { it.isNotEmpty() }
            ?: geocoder.getFromLocationName(query, 5)
        } else {
          geocoder.getFromLocationName(query, 5)
        }
      } catch (e: Exception) {
        null
      } ?: emptyList()
      found.map { address ->
        val name = address.featureName ?: address.getAddressLine(0) ?: query
        val subtitle = listOfNotNull(address.locality, address.adminArea, address.countryName)
          .filter { it != name }
          .distinct()
        mapOf(
          "name" to name,
          "subtitle" to subtitle.joinToString(", "),
          "latitude" to address.latitude,
          "longitude" to address.longitude,
        )
      }
    }
  }
}
