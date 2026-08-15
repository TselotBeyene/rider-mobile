import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { RideMap } from '../components/RideMap';
import { Avatar, Button, Card, Field, Metric, Pill, palette, ScreenTitle } from '../components/ui';
import { km, minutes, money, rideStatusLabel } from '../lib/format';
import { setBackgroundRideId, startDriverBackgroundLocation, stopDriverBackgroundLocation } from '../lib/backgroundLocation';
import { pushNotification } from '../lib/localStore';
import type { Coordinate, Me, Offer, Ride } from '../lib/types';
import { IdentityLivenessFlow } from './IdentityLivenessFlow';

export function HomeScreen({
  me,
  apiCall,
  ride,
  setRide,
  offer,
  setOffer,
  online,
  setOnline,
  position,
  setPosition,
  shiftEligibility,
  refreshAll,
  summary,
  connectivityOk,
  liveOffersOk
}: {
  me: Me;
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  ride: Ride | null;
  setRide: (r: Ride | null) => void;
  offer: Offer | null;
  setOffer: (o: Offer | null) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  position: Coordinate | null;
  setPosition: (c: Coordinate | null) => void;
  shiftEligibility: any;
  refreshAll: () => Promise<void>;
  summary: any;
  connectivityOk: boolean;
  liveOffersOk: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [randomRequired, setRandomRequired] = useState(false);
  const [arrivedAt, setArrivedAt] = useState<number | null>(null);
  const [waitTick, setWaitTick] = useState(0);
  const [rateOpen, setRateOpen] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<Ride | null>(null);
  const [reauthSession, setReauthSession] = useState<any>(null);
  const [livenessOpen, setLivenessOpen] = useState(false);

  async function getPosition() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') throw new Error('Location permission is required.');
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setPosition(c);
    return { ...c, accuracy_m: loc.coords.accuracy ?? 20 };
  }

  useEffect(() => {
    if (!online) return;
    let live = true;
    const poll = async () => {
      try {
        const r = await apiCall('/verification/driver/reauth-poll');
        if (live && r.required) {
          setRandomRequired(true);
          setOnline(false);
          Alert.alert('Identity check required', 'Complete a randomized selfie check before accepting another ride.');
        }
      } catch {}
    };
    void poll();
    const t = setInterval(() => void poll(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [online, apiCall, setOnline]);

  useEffect(() => {
    if (ride?.status !== 'DRIVER_ARRIVED' || !arrivedAt) return;
    const t = setInterval(() => setWaitTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [ride?.status, arrivedAt]);

  async function startReauth(type: 'DRIVER_PRE_SHIFT_REAUTH' | 'DRIVER_RANDOM_REAUTH' = 'DRIVER_PRE_SHIFT_REAUTH') {
    setBusy(true);
    setError('');
    try {
      const r = await apiCall('/verification/sessions', { method: 'POST', body: JSON.stringify({ verification_type: type }) });
      if (!r.submission_route) throw new Error('Verification session did not return a submission route.');
      setReauthSession(r);
      setLivenessOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReauthSelfie(selfieUri: string) {
    if (!reauthSession?.submission_route) throw new Error('Start the identity check before submitting.');
    setBusy(true);
    setError('');
    try {
      await apiCall(reauthSession.submission_route, {
        method: 'POST',
        body: JSON.stringify({ evidence: { selfie_uri: selfieUri, liveness_passed: true } })
      });
      setReauthSession(null);
      setLivenessOpen(false);
      setRandomRequired(false);
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function toggleOnline() {
    setBusy(true);
    setError('');
    try {
      if (online) {
        if (ride) throw new Error('Complete the active ride before going offline.');
        await apiCall('/location/driver/state', { method: 'POST', body: JSON.stringify({ state: 'OFFLINE' }) });
        await stopDriverBackgroundLocation();
        setOnline(false);
        await pushNotification({ title: 'You are offline', body: 'Trip requests are paused.', kind: 'system' });
      } else {
        if (!shiftEligibility?.eligible) throw new Error('Complete the pre-shift identity check before going online.');
        // Prefer last known position for speed; refresh GPS only if missing.
        let loc = position
          ? { ...position, accuracy_m: 25 }
          : null;
        if (!loc) {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status !== 'granted') throw new Error('Location permission is required.');
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          loc = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            accuracy_m: current.coords.accuracy ?? 25
          };
          setPosition({ latitude: loc.latitude, longitude: loc.longitude });
        }
        await apiCall('/location/driver/state', { method: 'POST', body: JSON.stringify({ state: 'ONLINE', location: loc }) });
        setOnline(true);
        try {
          await startDriverBackgroundLocation();
        } catch (bgErr: any) {
          // Already online for dispatch; surface location sharing issue without rolling back.
          setError(bgErr.message || 'Online, but background location is limited.');
        }
        await pushNotification({ title: 'You are online', body: 'Waiting for verified rider requests nearby.', kind: 'ride' });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (ride) {
    return (
      <ActiveTrip
        ride={ride}
        position={position}
        apiCall={apiCall}
        setRide={setRide}
        refreshAll={refreshAll}
        arrivedAt={arrivedAt}
        setArrivedAt={setArrivedAt}
        waitTick={waitTick}
        onCompleted={(completed) => {
          setLastCompleted(completed);
          setRateOpen(true);
        }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={`${me.user.first_name} ${me.user.last_name}`} />
          <View>
            <Text style={styles.eyebrow}>Driver home</Text>
            <Text style={styles.name}>{me.user.first_name} {me.user.last_name}</Text>
            <Text style={styles.rating}>★ {Number(me.driver.average_rating || 5).toFixed(2)} · {me.driver.completed_rides} trips</Text>
          </View>
        </View>
        <Pill text={online ? 'ONLINE' : 'OFFLINE'} tone={online ? 'good' : 'neutral'} />
      </View>

      {!connectivityOk ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>API connection is weak — retrying. You can still try going online.</Text>
        </View>
      ) : !liveOffersOk ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Live ride offers are reconnecting. Going online still works.</Text>
        </View>
      ) : null}

      <View style={styles.mapPanel}>
        <RideMap pickup={position} showUser />
        <View style={styles.demandChip} pointerEvents="none">
          <Text style={styles.demandText}>{online ? 'Medium demand nearby' : 'Demand appears when online'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheet}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <Card>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.section}>Shift status</Text>
              <Text style={styles.muted}>{online ? 'You are available for verified rider requests.' : 'You are not receiving ride requests.'}</Text>
            </View>
          </View>
          {shiftEligibility?.pre_shift_reauth_required ? (
            <>
              <Text style={styles.warning}>Pre-shift selfie verification is required before dispatch.</Text>
              <Button title="Complete pre-shift selfie check" onPress={() => void startReauth('DRIVER_PRE_SHIFT_REAUTH')} loading={busy} />
            </>
          ) : (
            <Button
              title={online ? 'GO OFFLINE' : 'GO ONLINE'}
              size="lg"
              kind={online ? 'offline' : 'online'}
              onPress={() => void toggleOnline()}
              loading={busy}
            />
          )}
        </Card>

        <Card>
          <Text style={styles.section}>Today snapshot</Text>
          <View style={styles.metrics}>
            <Metric label="Est. payout" value={money(summary?.estimated_driver_payout_minor ?? 0, summary?.currency ?? 'ETB')} />
            <Metric label="Trips" value={String(summary?.completed_rides ?? 0)} />
            <Metric label="Acceptance" value="—%" />
          </View>
          <Text style={styles.small}>Live acceptance/cancellation rates unlock once trip history APIs report them.</Text>
        </Card>

        <Card>
          <Text style={styles.section}>Safety & verification</Text>
          <Text style={styles.body}>
            Pre-shift check valid until {shiftEligibility?.verification_valid_until ? new Date(shiftEligibility.verification_valid_until).toLocaleString() : 'not verified'}.
          </Text>
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {offer && !randomRequired ? (
        <OfferModal offer={offer} apiCall={apiCall} setOffer={setOffer} setRide={setRide} refreshAll={refreshAll} />
      ) : null}

      {randomRequired ? (
        <View style={styles.overlay}>
          <View style={styles.offerCard}>
            <ScreenTitle title="Random identity check" subtitle="Dispatch is paused until this short liveness check confirms you are still driving." />
            <Button title="Complete identity check" onPress={() => void startReauth('DRIVER_RANDOM_REAUTH')} loading={busy} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      ) : null}

      <IdentityLivenessFlow
        visible={livenessOpen}
        onCancel={() => {
          setLivenessOpen(false);
        }}
        onCompleted={async (selfieUri) => {
          await submitReauthSelfie(selfieUri);
        }}
      />

      {rateOpen && lastCompleted ? (
        <RatePassenger
          ride={lastCompleted}
          apiCall={apiCall}
          onDone={() => {
            setRateOpen(false);
            setLastCompleted(null);
          }}
        />
      ) : null}
    </View>
  );
}

function OfferModal({
  offer,
  apiCall,
  setOffer,
  setRide,
  refreshAll
}: {
  offer: Offer;
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  setOffer: (o: Offer | null) => void;
  setRide: (r: Ride | null) => void;
  refreshAll: () => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((Date.parse(offer.expires_at) - Date.now()) / 1000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, Math.ceil((Date.parse(offer.expires_at) - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(t);
        setOffer(null);
      }
    }, 200);
    return () => clearInterval(t);
  }, [offer.expires_at, setOffer]);

  async function accept() {
    setBusy(true);
    try {
      await apiCall(`/matching/offers/${offer.ride_id}/accept`, { method: 'POST', body: '{}' });
      const current = await apiCall(`/rides/${offer.ride_id}`);
      setRide(current.ride);
      await setBackgroundRideId(offer.ride_id);
      setOffer(null);
      await refreshAll();
      await pushNotification({ title: 'Trip accepted', body: `Navigate to ${offer.pickup_address}`, kind: 'ride' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await apiCall(`/matching/offers/${offer.ride_id}/decline`, { method: 'POST', body: '{}' });
      setOffer(null);
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const pickupEta = Math.max(2, Math.round(offer.pickup_distance_m / 350));
  const tripMins = Math.max(8, Math.round((offer.pickup_distance_m + 4000) / 450));

  return (
    <View style={styles.overlay}>
      <View style={styles.offerCard}>
        <View style={styles.countdown}>
          <Text style={styles.countdownNum}>{remaining}</Text>
          <Text style={styles.countdownLabel}>seconds</Text>
        </View>
        <ScreenTitle title="New ride request" subtitle={`${offer.destination_neighborhood || 'Destination set'}`} />
        <Text style={styles.offerLine}>📍 Pickup: {offer.pickup_address}</Text>
        <Text style={styles.offerLine}>📍 Destination: {offer.destination_neighborhood || 'Pinned dropoff'}</Text>
        <Text style={styles.offerLine}>⏱ Pickup: ~{pickupEta} min · 🚗 Trip: ~{tripMins} min</Text>
        <Text style={styles.offerLine}>💰 Estimated earnings: {money(offer.estimated_earnings_minor, offer.currency || 'ETB')}</Text>
        <Text style={styles.offerLine}>📏 To pickup: {km(offer.pickup_distance_m)}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={`Accept — ${remaining}s`} size="lg" onPress={() => void accept()} loading={busy} disabled={remaining <= 0} />
        <Button title="Decline" kind="secondary" onPress={() => void decline()} disabled={busy} />
      </View>
    </View>
  );
}

function ActiveTrip({
  ride,
  position,
  apiCall,
  setRide,
  refreshAll,
  arrivedAt,
  setArrivedAt,
  waitTick,
  onCompleted
}: {
  ride: Ride;
  position: Coordinate | null;
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  setRide: (r: Ride | null) => void;
  refreshAll: () => Promise<void>;
  arrivedAt: number | null;
  setArrivedAt: (n: number | null) => void;
  waitTick: number;
  onCompleted: (ride: Ride) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState('');

  async function transition(status: 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED') {
    setBusy(true);
    setError('');
    try {
      if (status === 'IN_PROGRESS') {
        if (!/^\d{4}$/.test(pin.trim())) throw new Error('Enter the passenger’s 4-digit trip PIN to start the ride.');
      }
      await apiCall(`/rides/${ride.id}/status`, { method: 'POST', body: JSON.stringify({ status, ...(status === 'IN_PROGRESS' ? { trip_pin: pin.trim() } : {}) }) });
      if (status === 'ARRIVED') setArrivedAt(Date.now());
      if (status === 'COMPLETED') {
        await setBackgroundRideId(null);
        onCompleted(ride);
        setRide(null);
        setArrivedAt(null);
      }
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sos() {
    setBusy(true);
    try {
      const loc =
        position ??
        (await (async () => {
          const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          return { latitude: l.coords.latitude, longitude: l.coords.longitude };
        })());
      const r = await apiCall('/emergency/sos', {
        method: 'POST',
        body: JSON.stringify({ ride_id: ride.id, location: loc, reason: 'Driver initiated SOS' })
      });
      Alert.alert('SOS escalated', `Incident ${r.incident_id} created.`);
      await pushNotification({ title: 'SOS sent', body: 'Emergency support has been notified.', kind: 'safety' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openNav() {
    const target = ride.status === 'IN_PROGRESS' ? ride.dropoff : ride.pickup;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${target.latitude},${target.longitude}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`;
    void Linking.openURL(url);
  }

  const waitDisplay = arrivedAt ? Math.max(0, Math.floor((Date.now() - arrivedAt) / 1000)) : 0;
  void waitTick;
  const mm = String(Math.floor(waitDisplay / 60)).padStart(2, '0');
  const ss = String(waitDisplay % 60).padStart(2, '0');

  const next =
    ride.status === 'DRIVER_ASSIGNED'
      ? { label: "I've arrived", status: 'ARRIVED' as const }
      : ride.status === 'DRIVER_ARRIVED'
        ? { label: 'Start trip', status: 'IN_PROGRESS' as const }
        : ride.status === 'IN_PROGRESS'
          ? { label: 'End trip', status: 'COMPLETED' as const }
          : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.mapActive}>
        <RideMap pickup={ride.pickup} dropoff={ride.dropoff} driver={position} route={ride.route_coordinates ?? null} showUser />
      </View>
      <View style={styles.tripSheet}>
        <Card>
          <View style={styles.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.section}>{rideStatusLabel(ride.status)}</Text>
              <Text style={styles.muted}>{ride.status === 'IN_PROGRESS' ? ride.dropoff_address : ride.pickup_address}</Text>
            </View>
            <Pill text={ride.status} tone="good" />
          </View>
          <Text style={styles.small}>{km(ride.estimated_distance_m)} · {minutes(ride.estimated_duration_s)} · {money(ride.estimated_fare_minor, ride.currency || 'ETB')}</Text>
          {ride.status === 'DRIVER_ARRIVED' ? (
            <View style={styles.waitBox}>
              <Text style={styles.waitTitle}>You've arrived</Text>
              <Text style={styles.waitTimer}>Waiting: {mm}:{ss}</Text>
              <Text style={styles.small}>Passenger has been notified. Free waiting applies first; paid waiting can be configured by ops later.</Text>
            </View>
          ) : null}
          {ride.status === 'DRIVER_ARRIVED' ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.muted}>Ask the passenger for their 4-digit trip PIN, then enter it to start the trip.</Text>
              <Field label="Passenger trip PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} placeholder="••••" />
            </View>
          ) : null}
        </Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button title="Navigate" kind="secondary" onPress={openNav} />
          <Button title="Call" kind="secondary" onPress={() => Alert.alert('Masked calling', 'Telephony masking connects in the communications service.')} />
          <Button title="Message" kind="secondary" onPress={() => Alert.alert('In-app chat', 'Chat templates will appear here once messaging is online.')} />
        </View>
        {next ? <Button title={next.label} size="lg" onPress={() => void transition(next.status)} loading={busy} /> : null}
        <Button title="Emergency SOS" kind="danger" onPress={() => void sos()} disabled={busy} />
      </View>
    </View>
  );
}

function RatePassenger({
  ride,
  apiCall,
  onDone
}: {
  ride: Ride;
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.overlay}>
      <View style={styles.offerCard}>
        <ScreenTitle title="Trip complete" subtitle={`Rate your passenger · ${money(ride.estimated_fare_minor, ride.currency || 'ETB')} estimated fare`} />
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Text style={{ fontSize: 34 }}>{n <= rating ? '★' : '☆'}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          title="Submit rating"
          loading={busy}
          onPress={() => {
            void (async () => {
              setBusy(true);
              try {
                await apiCall(`/rides/${ride.id}/rating`, { method: 'POST', body: JSON.stringify({ rating }) });
              } catch {}
              setBusy(false);
              onDone();
            })();
          }}
        />
        <Button title="Skip for now" kind="ghost" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '800', color: palette.primary },
  name: { fontSize: 20, fontWeight: '900', color: palette.ink },
  rating: { fontSize: 12, color: palette.muted, fontWeight: '600' },
  banner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFF4E5', borderRadius: 12, padding: 10 },
  bannerText: { color: palette.warn, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  mapPanel: { height: 220, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, overflow: 'hidden' },
  demandChip: { position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  demandText: { fontWeight: '700', color: palette.ink, fontSize: 12 },
  sheetScroll: { flex: 1 },
  sheet: { paddingHorizontal: 16, gap: 10, paddingBottom: 28 },
  section: { fontSize: 16, fontWeight: '900', color: palette.ink },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 19 },
  body: { fontSize: 14, lineHeight: 20, color: palette.ink },
  small: { fontSize: 12, lineHeight: 17, color: palette.muted },
  warning: { color: '#8A4B08', fontWeight: '700', lineHeight: 20 },
  error: { color: palette.danger, fontWeight: '700' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  metrics: { flexDirection: 'row', gap: 10 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24,18,32,.58)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  offerCard: { width: '100%', maxWidth: 440, backgroundColor: palette.bg, borderRadius: 28, padding: 20, gap: 12 },
  countdown: { alignSelf: 'center', width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 7, borderColor: palette.primary },
  countdownNum: { fontSize: 30, fontWeight: '900', color: palette.ink },
  countdownLabel: { fontSize: 11, color: palette.muted, fontWeight: '700' },
  offerLine: { fontSize: 15, lineHeight: 22, color: palette.ink, fontWeight: '600' },
  mapActive: { flex: 1, minHeight: 280, marginHorizontal: 12 },
  tripSheet: { maxHeight: '48%', paddingHorizontal: 14, paddingTop: 8, gap: 10, paddingBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  waitBox: { backgroundColor: palette.soft, borderRadius: 14, padding: 12, gap: 4 },
  waitTitle: { fontWeight: '900', color: palette.ink },
  waitTimer: { fontSize: 28, fontWeight: '900', color: palette.primary },
  pinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: palette.primary, fontWeight: '800' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8 }
});
