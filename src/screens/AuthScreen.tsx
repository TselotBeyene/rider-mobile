import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Button, Card, Field, palette, ScreenTitle } from '../components/ui';
import { api, deviceId, saveSession, type Session } from '../lib/api';
import { WelcomeLanding } from './WelcomeLanding';

export function AuthScreen({ onSignedIn }: { onSignedIn: (s: Session) => Promise<void> }) {
  const [step, setStep] = useState<'welcome' | 'form' | 'otp'>('welcome');
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [phone, setPhone] = useState('+251911000111');
  const [first, setFirst] = useState('Nadia');
  const [last, setLast] = useState('Okafor');
  const [email, setEmail] = useState('nadia.driver@example.com');
  const [dob, setDob] = useState('1992-05-15');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function requestOtp(create: boolean) {
    setBusy(true);
    setError('');
    try {
      let purpose: 'REGISTRATION' | 'LOGIN' = create ? 'REGISTRATION' : 'LOGIN';
      if (create) {
        try {
          await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              role: 'DRIVER',
              phone_e164: phone,
              email,
              first_name: first,
              last_name: last,
              date_of_birth: dob,
              locale: 'en-ET',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Addis_Ababa'
            })
          });
        } catch (e: any) {
          if (e.code === 'PHONE_ALREADY_REGISTERED' || e.code === 'ACCOUNT_ALREADY_REGISTERED') purpose = 'LOGIN';
          else throw e;
        }
      }
      const r = await api('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone_e164: phone, purpose }) });
      setChallenge(r.challenge_id);
      setStep('otp');
      if (r.development_otp) {
        setDevOtp(r.development_otp);
        setOtp(r.development_otp);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!challenge) return;
    setBusy(true);
    setError('');
    try {
      const id = await deviceId();
      const r = await api('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          challenge_id: challenge,
          otp,
          device: { device_id: id, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', app_version: '0.2.0' }
        })
      });
      await onSignedIn(await saveSession(r.access_token, r.refresh_token));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'welcome') {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        <WelcomeLanding
          onGetStarted={() => {
            setMode('create');
            setStep('form');
          }}
          onSignIn={() => {
            setMode('login');
            setStep('form');
          }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandMark}>W</Text>
            <View>
              <Text style={styles.brandName}>WomenRide Driver</Text>
              <Text style={styles.brandTag}>Verified drivers. Safer shifts.</Text>
            </View>
          </View>

          {step === 'form' ? (
            <>
              <ScreenTitle
                title={mode === 'create' ? 'Create driver account' : 'Sign in'}
                subtitle="We verify your phone with a one-time code. Email is collected for account recovery and receipts."
              />
              <Card>
                <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="Use E.164 format, e.g. +251911000111" />
                {mode === 'create' ? (
                  <>
                    <Field label="First name" value={first} onChangeText={setFirst} />
                    <Field label="Last name" value={last} onChangeText={setLast} />
                    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                    <Field label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} />
                  </>
                ) : null}
              </Card>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title={mode === 'create' ? 'Continue to phone verification' : 'Send sign-in code'} onPress={() => void requestOtp(mode === 'create')} loading={busy} />
              <Button title="Back" kind="ghost" onPress={() => setStep('welcome')} />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <ScreenTitle title="Verify phone" subtitle={`Enter the 6-digit code sent to ${phone}.`} />
              <Card>
                <Field label="One-time code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                {devOtp ? <Text style={styles.dev}>Local development code: {devOtp}</Text> : null}
              </Card>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Verify and continue" onPress={() => void verify()} loading={busy} disabled={otp.length !== 6} />
              <Button title="Use a different number" kind="ghost" onPress={() => { setStep('form'); setChallenge(null); }} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 22, gap: 16, paddingBottom: 50 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.primary, color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 48, overflow: 'hidden' },
  brandName: { fontSize: 22, fontWeight: '900', color: palette.ink },
  brandTag: { fontSize: 12, color: palette.muted },
  error: { color: palette.danger, fontWeight: '700', lineHeight: 20 },
  dev: { color: palette.accent, fontWeight: '800' }
});
