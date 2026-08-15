import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, palette, ScreenTitle, StatusCheck } from '../components/ui';
import { loadOnboardingDraft, saveOnboardingDraft } from '../lib/localStore';
import { defaultOnboarding, type OnboardingDraft } from '../lib/types';

const STEPS = [
  'PIN & personal',
  'Emergency',
  'Documents',
  'Vehicle',
  'Vehicle docs',
  'Payout',
  'Agreement',
  'Training',
  'Review'
] as const;

export function OnboardingWizard({
  apiCall,
  onSaved,
  onSignOut
}: {
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  onSaved: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(defaultOnboarding());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<any>(null);

  useEffect(() => {
    void (async () => setDraft(await loadOnboardingDraft()))();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setRemote(await apiCall('/verification/status'));
      } catch {}
    })();
  }, [apiCall, step]);

  const set = (k: keyof OnboardingDraft, v: string | boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const checklist = useMemo(() => {
    const c = remote?.checklist;
    return [
      { label: 'Identity verified', state: (c?.identity ?? 'missing') as const },
      { label: 'Eligibility verified', state: (c?.eligibility ?? 'missing') as const },
      { label: 'Background check', state: (c?.background_check ?? 'missing') as const },
      { label: 'License details on file', state: draft.license_number ? ('done' as const) : ((c?.license ?? 'missing') as const) },
      { label: 'ID / passport upload', state: draft.id_document_note ? ('done' as const) : ('missing' as const) },
      { label: 'Vehicle registration', state: draft.vehicle_reg_note ? ('done' as const) : ('missing' as const) },
      { label: 'Vehicle inspection', state: draft.inspection_note ? ('done' as const) : ('missing' as const) },
      { label: 'Insurance document', state: draft.insurance_note ? ('done' as const) : ('missing' as const) },
      { label: 'Payout method', state: draft.bank_account ? ('done' as const) : ('missing' as const) },
      { label: 'Driver agreement', state: draft.agreed_terms ? ('done' as const) : ('missing' as const) }
    ];
  }, [draft, remote]);

  async function persistLocal() {
    await saveOnboardingDraft(draft);
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      if (!draft.agreed_terms) throw new Error('Accept the driver agreement to continue.');
      if (!draft.training_done) throw new Error('Complete the short safety training to continue.');
      if (draft.pin.length < 4) throw new Error('Create a 4+ digit PIN for trip confirmation.');
      await persistLocal();
      await apiCall('/auth/driver-profile', {
        method: 'PUT',
        body: JSON.stringify({
          license_number: draft.license_number,
          license_country: draft.license_country,
          license_expiry: draft.license_expiry,
          vehicle_make: draft.vehicle_make,
          vehicle_model: draft.vehicle_model,
          vehicle_year: Number(draft.vehicle_year),
          vehicle_color: draft.vehicle_color,
          vehicle_type: draft.vehicle_type,
          plate_number: draft.plate_number,
          plate_country: draft.plate_country
        })
      });
      await onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Driver onboarding" subtitle={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        {step === 0 ? (
          <Card>
            <Field label="App PIN (4–6 digits)" value={draft.pin} onChangeText={(v) => set('pin', v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry hint="Used later for passenger pickup confirmation." />
            <Field label="Home address" value={draft.address} onChangeText={(v) => set('address', v)} />
            <Field label="Profile photo note" value={draft.profile_photo_note} onChangeText={(v) => set('profile_photo_note', v)} placeholder="e.g. selfie uploaded locally" />
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <Field label="Emergency contact name" value={draft.emergency_name} onChangeText={(v) => set('emergency_name', v)} />
            <Field label="Emergency contact phone" value={draft.emergency_phone} onChangeText={(v) => set('emergency_phone', v)} keyboardType="phone-pad" />
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <Field label="Driver licence number" value={draft.license_number} onChangeText={(v) => set('license_number', v)} />
            <Field label="Licence country" value={draft.license_country} onChangeText={(v) => set('license_country', v.toUpperCase())} maxLength={2} />
            <Field label="Licence expiry (YYYY-MM-DD)" value={draft.license_expiry} onChangeText={(v) => set('license_expiry', v)} />
            <Field label="Licence upload note" value={draft.license_front_note} onChangeText={(v) => set('license_front_note', v)} placeholder="Front/back captured" />
            <Field label="ID / passport upload note" value={draft.id_document_note} onChangeText={(v) => set('id_document_note', v)} />
            <Text style={styles.note}>Upload APIs land later; notes are stored on-device for this build and shown in Document Center.</Text>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <Field label="Make" value={draft.vehicle_make} onChangeText={(v) => set('vehicle_make', v)} />
            <Field label="Model" value={draft.vehicle_model} onChangeText={(v) => set('vehicle_model', v)} />
            <Field label="Year" value={draft.vehicle_year} onChangeText={(v) => set('vehicle_year', v)} keyboardType="number-pad" />
            <Field label="Color" value={draft.vehicle_color} onChangeText={(v) => set('vehicle_color', v)} />
            <Field label="Vehicle type" value={draft.vehicle_type} onChangeText={(v) => set('vehicle_type', v.toUpperCase())} />
            <Field label="Plate number" value={draft.plate_number} onChangeText={(v) => set('plate_number', v.toUpperCase())} />
            <Field label="Plate country" value={draft.plate_country} onChangeText={(v) => set('plate_country', v.toUpperCase())} maxLength={2} />
          </Card>
        ) : null}

        {step === 4 ? (
          <Card>
            <Field label="Vehicle registration note" value={draft.vehicle_reg_note} onChangeText={(v) => set('vehicle_reg_note', v)} />
            <Field label="Insurance note / expiry" value={draft.insurance_note} onChangeText={(v) => set('insurance_note', v)} placeholder="e.g. valid until 2027-01-01" />
            <Field label="Inspection note" value={draft.inspection_note} onChangeText={(v) => set('inspection_note', v)} />
            <Field label="Vehicle photos note" value={draft.vehicle_photos_note} onChangeText={(v) => set('vehicle_photos_note', v)} placeholder="front, rear, interior" />
          </Card>
        ) : null}

        {step === 5 ? (
          <Card>
            <Field label="Payout method" value={draft.bank_provider} onChangeText={(v) => set('bank_provider', v)} hint="Telebirr, CBE Birr, bank account…" />
            <Field label="Account / mobile-money number" value={draft.bank_account} onChangeText={(v) => set('bank_account', v)} keyboardType="phone-pad" />
            <Field label="Tax ID (optional)" value={draft.tax_id} onChangeText={(v) => set('tax_id', v)} />
          </Card>
        ) : null}

        {step === 6 ? (
          <Card>
            <Text style={styles.body}>Driver agreement covers safety standards, women-only eligibility rules, data use, and payout terms.</Text>
            <Button title={draft.agreed_terms ? 'Agreement accepted' : 'I agree to the driver terms'} kind={draft.agreed_terms ? 'secondary' : 'primary'} onPress={() => set('agreed_terms', true)} />
          </Card>
        ) : null}

        {step === 7 ? (
          <Card>
            <Text style={styles.body}>Short training: confirm pickup with PIN, keep SOS reachable, never share rider personal data, and complete random reauth when prompted.</Text>
            <Button title={draft.training_done ? 'Training completed' : 'Mark training complete'} kind={draft.training_done ? 'secondary' : 'primary'} onPress={() => set('training_done', true)} />
          </Card>
        ) : null}

        {step === 8 ? (
          <Card>
            <Text style={styles.section}>Onboarding status</Text>
            {checklist.map((item) => (
              <StatusCheck key={item.label} label={item.label} state={item.state} />
            ))}
            <Text style={styles.note}>After submit, license/vehicle details sync to the auth service. Remaining document uploads stay local until the document service is connected.</Text>
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.row}>
          {step > 0 ? <View style={{ flex: 1 }}><Button title="Back" kind="secondary" onPress={() => setStep((s) => s - 1)} /></View> : null}
          <View style={{ flex: 1 }}>
            {step < STEPS.length - 1 ? (
              <Button
                title="Next"
                onPress={() => {
                  void persistLocal();
                  setStep((s) => s + 1);
                }}
              />
            ) : (
              <Button title="Submit for approval" onPress={() => void finish()} loading={busy} />
            )}
          </View>
        </View>
        <Button title="Sign out" kind="ghost" onPress={() => void onSignOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: palette.border, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: palette.primary },
  body: { fontSize: 15, lineHeight: 22, color: palette.ink },
  note: { fontSize: 12, lineHeight: 18, color: palette.muted },
  section: { fontSize: 16, fontWeight: '900', color: palette.ink },
  error: { color: palette.danger, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 }
});
