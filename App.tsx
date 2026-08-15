import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { BottomNav, palette } from './src/components/ui';
import { api, apiWithSession, clearSession, loadSession, refreshSession, WS_URL, type Session } from './src/lib/api';
import { setBackgroundRideId, stopDriverBackgroundLocation } from './src/lib/backgroundLocation';
import { pushNotification } from './src/lib/localStore';
import type { Coordinate, Me, Offer, Ride, TabId } from './src/lib/types';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingWizard } from './src/screens/OnboardingWizard';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { TripsScreen } from './src/screens/TripsScreen';
import { EarningsScreen } from './src/screens/EarningsScreen';
import { InboxScreen } from './src/screens/InboxScreen';
import { AccountScreen } from './src/screens/AccountScreen';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [ride, setRide] = useState<Ride | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [position, setPosition] = useState<Coordinate | null>(null);
  const [online, setOnline] = useState(false);
  const [shiftEligibility, setShiftEligibility] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [tab, setTab] = useState<TabId>('home');
  const [connectivityOk, setConnectivityOk] = useState(true);
  const [liveOffersOk, setLiveOffersOk] = useState(true);

  const authedApi = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!session) throw new Error('No active session');
      return apiWithSession(path, options, (next) => setSession(next));
    },
    [session]
  );

  const loadMe = useCallback(async (s: Session) => {
    try {
      let active = s;
      let result: Me;
      try {
        result = await api('/auth/me', {}, active.accessToken);
      } catch (e: any) {
        if (e.status !== 401) throw e;
        active = await refreshSession(active);
        setSession(active);
        result = await api('/auth/me', {}, active.accessToken);
      }
      setMe(result);
      if (result.driver?.profile_complete) {
        const [current, state, eligibility, week] = await Promise.all([
          api('/rides/current', {}, active.accessToken).catch(() => ({ ride: null })),
          api('/location/driver/state', {}, active.accessToken).catch(() => ({ driver_status: 'OFFLINE' })),
          api('/verification/driver/shift-eligibility', {}, active.accessToken).catch(() => null),
          api('/rides/driver/summary', {}, active.accessToken).catch(() => null)
        ]);
        setRide(current.ride);
        if (current.ride) await setBackgroundRideId(current.ride.id);
        setOnline(['ONLINE_AVAILABLE', 'OFFERED', 'EN_ROUTE_PICKUP', 'ARRIVED', 'ON_TRIP'].includes(state.driver_status));
        setShiftEligibility(eligibility);
        setSummary(week);
      }
    } catch {
      await clearSession();
      setSession(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await loadSession();
      if (s) {
        setSession(s);
        await loadMe(s);
      } else setLoading(false);
    })();
  }, [loadMe]);

  const refreshAll = useCallback(async () => {
    if (!session) return;
    let active = session;
    try {
      active = await refreshSession();
      setSession(active);
    } catch {
      active = (await loadSession()) ?? session;
    }
    const result = await api('/auth/me', {}, active.accessToken);
    setMe(result);
    if (result.driver?.profile_complete) {
      const [current, state, eligibility, week] = await Promise.all([
        api('/rides/current', {}, active.accessToken).catch(() => ({ ride: null })),
        api('/location/driver/state', {}, active.accessToken).catch(() => ({ driver_status: 'OFFLINE' })),
        api('/verification/driver/shift-eligibility', {}, active.accessToken).catch(() => null),
        api('/rides/driver/summary', {}, active.accessToken).catch(() => null)
      ]);
      setRide(current.ride);
      setOnline(['ONLINE_AVAILABLE', 'OFFERED', 'EN_ROUTE_PICKUP', 'ARRIVED', 'ON_TRIP'].includes(state.driver_status));
      setShiftEligibility(eligibility);
      setSummary(week);
    }
  }, [session]);

  useEffect(() => {
    if (!session || !me?.user.identity_verified || !me.user.eligibility_verified || !me.driver?.profile_complete) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        attempt = 0;
        setLiveOffersOk(true);
        setConnectivityOk(true);
        ws?.send(JSON.stringify({ type: 'AUTHENTICATE', payload: { access_token: session.accessToken } }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'RIDE_OFFER') {
            setOffer(msg.payload);
            setTab('home');
            Alert.alert('New ride request', 'A verified rider is waiting. You have 15 seconds to respond.');
            void pushNotification({ title: 'New ride request', body: msg.payload?.pickup_address || 'Open home to accept.', kind: 'ride' });
          }
          if (msg.type === 'RIDE_STATUS_CHANGED') void refreshAll();
          if (msg.type === 'SAFETY_CHECK_IN') {
            Alert.alert('Safety check', msg.payload.reason === 'SOS' ? 'An SOS has been raised for this ride.' : 'Please confirm that the trip is safe.');
          }
        } catch {}
      };
      ws.onerror = () => setLiveOffersOk(false);
      ws.onclose = () => {
        setLiveOffersOk(false);
        if (closed) return;
        const delay = Math.min(15_000, 1000 * 2 ** attempt);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    // HTTP reachability for go-online — independent of WebSocket.
    const pingHttp = async () => {
      try {
        await api('/location/driver/state', {}, session.accessToken);
        setConnectivityOk(true);
      } catch (e: any) {
        // Auth/network hard failures only; 4xx from business rules still means the API is reachable.
        if (!e?.status || e.status >= 500 || e.status === 0) setConnectivityOk(false);
        else setConnectivityOk(true);
      }
    };
    void pingHttp();
    const httpTimer = setInterval(() => void pingHttp(), 12_000);

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(httpTimer);
      ws?.close();
    };
  }, [session, me?.user.identity_verified, me?.user.eligibility_verified, me?.driver?.profile_complete, refreshAll]);

  useEffect(() => {
    if (!session || !me?.driver?.profile_complete) return;
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    void (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted' || cancelled) return;
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      } catch {}
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 5000 },
        (loc) => setPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [session, me?.driver?.profile_complete]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setConnectivityOk(true);
        setLiveOffersOk(true);
      }
    });
    return () => sub.remove();
  }, []);

  async function signOut() {
    await stopDriverBackgroundLocation().catch(() => {});
    await clearSession();
    setSession(null);
    setMe(null);
    setRide(null);
    setOffer(null);
    setOnline(false);
    setTab('home');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="dark" />
        <Text style={styles.loading}>Loading driver workspace…</Text>
      </SafeAreaView>
    );
  }

  if (!session || !me) {
    return (
      <AuthScreen
        onSignedIn={async (s) => {
          setSession(s);
          setLoading(true);
          await loadMe(s);
        }}
      />
    );
  }

  // Stay on verification until the account is fully activated (all 4 checks).
  if (me.user.account_status !== 'ACTIVE' || !me.user.identity_verified || !me.user.eligibility_verified) {
    return <VerificationScreen apiCall={authedApi} onVerified={refreshAll} onSignOut={signOut} />;
  }

  if (!me.driver?.profile_complete) {
    return <OnboardingWizard apiCall={authedApi} onSaved={refreshAll} onSignOut={signOut} />;
  }

  const tripMode = Boolean(ride);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {tab === 'home' || tripMode ? (
          <HomeScreen
            me={me}
            apiCall={authedApi}
            ride={ride}
            setRide={setRide}
            offer={offer}
            setOffer={setOffer}
            online={online}
            setOnline={setOnline}
            position={position}
            setPosition={setPosition}
            shiftEligibility={shiftEligibility}
            refreshAll={refreshAll}
            summary={summary}
            connectivityOk={connectivityOk}
            liveOffersOk={liveOffersOk}
          />
        ) : null}
        {!tripMode && tab === 'trips' ? <TripsScreen me={me} currentRide={ride} summary={summary} /> : null}
        {!tripMode && tab === 'earnings' ? <EarningsScreen summary={summary} /> : null}
        {!tripMode && tab === 'inbox' ? <InboxScreen /> : null}
        {!tripMode && tab === 'account' ? <AccountScreen me={me} onSignOut={signOut} shiftEligibility={shiftEligibility} /> : null}
      </View>
      <BottomNav tab={tripMode ? 'home' : tab} onChange={setTab} hidden={tripMode} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg },
  loading: { fontWeight: '800', color: palette.muted }
});
