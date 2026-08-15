import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { palette } from './ui';

type C = { latitude: number; longitude: number };

const FALLBACK: C = { latitude: 9.03, longitude: 38.74 }; // Addis Ababa — only used until GPS arrives

export function RideMap({
  pickup,
  dropoff,
  driver,
  route,
  onMapPress,
  showUser = true
}: {
  pickup?: C | null;
  dropoff?: C | null;
  driver?: C | null;
  route?: C[] | null;
  onMapPress?: (c: C) => void;
  showUser?: boolean;
}) {
  const mapRef = useRef<MapView>(null);
  const center = driver ?? pickup ?? dropoff ?? FALLBACK;
  const hasLiveFix = Boolean(driver ?? pickup ?? dropoff);
  const line = useMemo(() => {
    if (route && route.length > 1) return route;
    const ends = [pickup, dropoff].filter(Boolean) as C[];
    return ends.length > 1 ? ends : [];
  }, [route, pickup, dropoff]);

  useEffect(() => {
    if (!hasLiveFix) return;
    const region: Region = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02
    };
    // Avoid animating on every tiny GPS tick — jump once when a real fix appears.
    mapRef.current?.animateToRegion(region, 250);
  }, [hasLiveFix]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      showsUserLocation={showUser}
      showsMyLocationButton={false}
      followsUserLocation={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045
      }}
      onPress={(e) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onMapPress?.({ latitude, longitude });
      }}
    >
      {pickup ? (
        <Marker coordinate={pickup} title="Pickup" pinColor={palette.accent} />
      ) : null}
      {dropoff ? (
        <Marker coordinate={dropoff} title="Dropoff" pinColor={palette.primary} />
      ) : null}
      {driver ? (
        <Marker coordinate={driver} title="Driver" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.driverMarker}><Text style={{ fontSize: 16 }}>🚗</Text></View>
        </Marker>
      ) : null}
      {line.length > 1 ? (
        <Polyline coordinates={line} strokeColor={palette.primary} strokeWidth={5} />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 260, borderRadius: 22, overflow: 'hidden' },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.primary
  }
});
