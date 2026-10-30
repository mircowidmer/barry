// Crash reports start first, so an error while the other modules load is reported instead of hanging on the splash.
import '@/lib/start-crash-reports';
// The background tasks must be defined before iOS delivers a location or a geofence event to a relaunched Barry.
import '@/lib/barry/trail-task';
import 'expo-router/entry';
