import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { loadSession } from './api';

export const DRIVER_LOCATION_TASK = 'womenride-driver-location';
const RIDE_KEY = 'womenride.driver.active_ride_id';

let foregroundWatch: Location.LocationSubscription | null = null;

async function pingLocation(loc: Location.LocationObject) {
  const session = await loadSession();
  if (!session) return;
  const rideId = await SecureStore.getItemAsync(RIDE_KEY);
  try {
    await fetch('http://127.0.0.1:4004/v1/location/driver/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy_m: loc.coords.accuracy ?? 20,
        speed_mps: loc.coords.speed ?? undefined,
        heading_degrees: loc.coords.heading ?? undefined,
        altitude_m: loc.coords.altitude ?? undefined,
        sequence_number: Math.floor(loc.timestamp),
        device_timestamp: new Date(loc.timestamp).toISOString(),
        ride_id: rideId || undefined
      })
    });
  } catch {}
}

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations: Location.LocationObject[] }).locations ?? [];
  for (const loc of locations) await pingLocation(loc);
});

export async function setBackgroundRideId(rideId: string | null) {
  if (rideId) await SecureStore.setItemAsync(RIDE_KEY, rideId);
  else await SecureStore.deleteItemAsync(RIDE_KEY);
}

async function startForegroundFallback() {
  if (foregroundWatch) return;
  foregroundWatch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 4000 },
    (loc) => { void pingLocation(loc); }
  );
}

async function stopForegroundFallback() {
  foregroundWatch?.remove();
  foregroundWatch = null;
}

/**
 * Prefer Always/background location. On simulator / when the user only granted
 * "While Using", fall back to foreground pings so going online still works in local/dev.
 */
export async function startDriverBackgroundLocation() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Location permission is required. Enable it in Settings → WomenRide Driver → Location.');
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    background = await Location.requestBackgroundPermissionsAsync();
  }

  if (background.status === 'granted') {
    await stopForegroundFallback();
    const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    if (!started) {
      await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 15,
        timeInterval: 5000,
        deferredUpdatesDistance: 20,
        deferredUpdatesInterval: 5000,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'WomenRide Driver is online',
          notificationBody: 'Location sharing is active while you receive or complete rides.'
        },
        showsBackgroundLocationIndicator: true
      });
    }
    return;
  }

  // "While Using" is enough for local simulator / foreground-only shifts.
  await startForegroundFallback();
  if (!__DEV__ && Platform.OS === 'ios') {
    throw new Error(
      'Choose “Always” for Location in Settings → WomenRide Driver so you can stay online in the background.'
    );
  }
}

export async function stopDriverBackgroundLocation() {
  await stopForegroundFallback();
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
  await setBackgroundRideId(null);
}
