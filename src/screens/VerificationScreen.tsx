import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, Pill, palette, ScreenTitle, StatusCheck } from '../components/ui';
import type { DocStatus } from '../lib/types';
import { DocumentCaptureFlow } from './DocumentCaptureFlow';
import { IdentityLivenessFlow } from './IdentityLivenessFlow';

type Checklist = {
  identity: DocStatus;
  eligibility: DocStatus;
  background_check: DocStatus;
  license: DocStatus;
};

type VerificationStatus = {
  account_status: string;
  identity_verified: boolean;
  eligibility_verified: boolean;
  ready_for_onboarding?: boolean;
  next_step: null | 'INITIAL_IDENTITY' | 'ELIGIBILITY_DECLARATION' | 'BACKGROUND_CHECK' | 'LICENSE_DOCUMENT';
  checklist: Checklist;
};

type Declarations = {
  eligible_driver: boolean;
  accurate_identity: boolean;
  women_only_policy: boolean;
  consent_data_processing: boolean;
};

const STEP_COPY: Record<
  NonNullable<VerificationStatus['next_step']>,
  { title: string; body: string; start: string; submit: string }
> = {
  INITIAL_IDENTITY: {
    title: 'Step 1 · Identity / liveness',
    body: 'Complete a guided camera liveness check. Your selfie is submitted as evidence — there is no skip or demo approve.',
    start: 'Start camera verification',
    submit: 'Submit identity evidence'
  },
  ELIGIBILITY_DECLARATION: {
    title: 'Step 2 · Eligibility declaration',
    body: 'Accept every declaration and capture a government ID photo. Eligibility is not inferred from your face or voice.',
    start: 'Start eligibility review',
    submit: 'Submit eligibility package'
  },
  BACKGROUND_CHECK: {
    title: 'Step 3 · Background check',
    body: 'Provide legal identity details, consent to screening, and capture your government ID for the background check package.',
    start: 'Start background check',
    submit: 'Submit background package'
  },
  LICENSE_DOCUMENT: {
    title: 'Step 4 · Driver license',
    body: 'Enter license details and capture clear front and back photos of your driver licence.',
    start: 'Start license verification',
    submit: 'Submit license package'
  }
};

function CheckRow({
  label,
  checked,
  onToggle
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.boxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function VerificationScreen({
  apiCall,
  onVerified,
  onSignOut
}: {
  apiCall: (p: string, o?: RequestInit) => Promise<any>;
  onVerified: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [session, setSession] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [livenessOpen, setLivenessOpen] = useState(false);
  const [docCapture, setDocCapture] = useState<null | 'id' | 'license_front' | 'license_back'>(null);

  const [declarations, setDeclarations] = useState<Declarations>({
    eligible_driver: false,
    accurate_identity: false,
    women_only_policy: false,
    consent_data_processing: false
  });
  const [idDocumentUri, setIdDocumentUri] = useState<string | null>(null);

  const [backgroundConsent, setBackgroundConsent] = useState(false);
  const [legalFullName, setLegalFullName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bgcIdUri, setBgcIdUri] = useState<string | null>(null);

  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseCountry, setLicenseCountry] = useState('ET');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseFrontUri, setLicenseFrontUri] = useState<string | null>(null);
  const [licenseBackUri, setLicenseBackUri] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const s = (await apiCall('/verification/status')) as VerificationStatus;
    setStatus(s);
    return s;
  }, [apiCall]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const s = await refreshStatus();
        if (!live) return;
        if (s.ready_for_onboarding) await onVerified();
      } catch (e: any) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoadingStatus(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [refreshStatus, onVerified]);

  const nextStep = status?.next_step ?? null;
  const copy = nextStep ? STEP_COPY[nextStep] : null;
  const checklist = status?.checklist;

  const progressLabel = useMemo(() => {
    if (!checklist) return 'Loading…';
    const done = [checklist.identity, checklist.eligibility, checklist.background_check, checklist.license].filter((s) => s === 'done').length;
    return `${done} of 4 steps complete`;
  }, [checklist]);

  function resetStepEvidence() {
    setDeclarations({
      eligible_driver: false,
      accurate_identity: false,
      women_only_policy: false,
      consent_data_processing: false
    });
    setIdDocumentUri(null);
    setBackgroundConsent(false);
    setLegalFullName('');
    setNationalId('');
    setDateOfBirth('');
    setBgcIdUri(null);
    setLicenseNumber('');
    setLicenseCountry('ET');
    setLicenseExpiry('');
    setLicenseFrontUri(null);
    setLicenseBackUri(null);
  }

  async function startCurrentStep() {
    if (!nextStep) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiCall('/verification/sessions', {
        method: 'POST',
        body: JSON.stringify({ verification_type: nextStep })
      });
      setSession(r);
      await refreshStatus();
      if (nextStep === 'INITIAL_IDENTITY') setLivenessOpen(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEvidence(evidence: Record<string, unknown>) {
    const route = session?.submission_route;
    if (!route) throw new Error('Start the verification session before submitting evidence.');
    setBusy(true);
    setError('');
    try {
      const result = await apiCall(route, {
        method: 'POST',
        body: JSON.stringify({ evidence })
      });
      setSession(null);
      setLivenessOpen(false);
      resetStepEvidence();
      const s = await refreshStatus();
      if (result.ready_for_onboarding || s.ready_for_onboarding) {
        setTimeout(() => {
          void onVerified();
        }, 700);
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function submitCurrentStep() {
    if (!nextStep) return;
    try {
      if (nextStep === 'ELIGIBILITY_DECLARATION') {
        const d = declarations;
        if (!d.eligible_driver || !d.accurate_identity || !d.women_only_policy || !d.consent_data_processing) {
          throw new Error('Accept all four eligibility declarations.');
        }
        if (!idDocumentUri) throw new Error('Capture a government ID photo before submitting.');
        await submitEvidence({
          declarations: d,
          id_document_uri: idDocumentUri
        });
        return;
      }
      if (nextStep === 'BACKGROUND_CHECK') {
        if (!backgroundConsent) throw new Error('Consent to the background check is required.');
        if (legalFullName.trim().length < 3) throw new Error('Enter your legal full name.');
        if (nationalId.trim().length < 4) throw new Error('Enter your national ID number.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) throw new Error('Date of birth must be YYYY-MM-DD.');
        if (!bgcIdUri) throw new Error('Capture a government ID photo for background screening.');
        await submitEvidence({
          background_consent: true,
          legal_full_name: legalFullName.trim(),
          national_id_number: nationalId.trim(),
          date_of_birth: dateOfBirth.trim(),
          id_document_uri: bgcIdUri
        });
        return;
      }
      if (nextStep === 'LICENSE_DOCUMENT') {
        if (!licenseFrontUri || !licenseBackUri) throw new Error('Capture both front and back of your driver licence.');
        if (!licenseNumber.trim() || licenseCountry.trim().length !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(licenseExpiry.trim())) {
          throw new Error('Enter license number, 2-letter country, and expiry (YYYY-MM-DD).');
        }
        await submitEvidence({
          license_front_uri: licenseFrontUri,
          license_back_uri: licenseBackUri,
          license_number: licenseNumber.trim(),
          license_country: licenseCountry.trim().toUpperCase(),
          license_expiry: licenseExpiry.trim()
        });
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function continueOnboarding() {
    setBusy(true);
    try {
      const s = await refreshStatus();
      if (!s.ready_for_onboarding) throw new Error('Finish all four verification steps first.');
      await onVerified();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle
          title="Verify your identity"
          subtitle="Each step requires real camera capture or signed declarations. Nothing is auto-approved without evidence."
        />

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>Approval checklist</Text>
            <Pill text={progressLabel} tone={status?.ready_for_onboarding ? 'good' : 'warn'} />
          </View>
          {loadingStatus ? <Text style={styles.meta}>Loading live verification status…</Text> : null}
          <StatusCheck label="1. Identity verified" state={checklist?.identity ?? 'missing'} />
          <StatusCheck label="2. Eligibility verified" state={checklist?.eligibility ?? 'missing'} />
          <StatusCheck label="3. Background check" state={checklist?.background_check ?? 'missing'} />
          <StatusCheck label="4. License verification" state={checklist?.license ?? 'missing'} />
          {status?.account_status ? <Text style={styles.meta}>Account status: {status.account_status}</Text> : null}
        </Card>

        {status?.ready_for_onboarding ? (
          <Card>
            <Text style={styles.section}>All checks complete</Text>
            <Text style={styles.body}>Identity, eligibility, background, and license evidence are on file. Continue to vehicle onboarding.</Text>
            <Button title="Continue to driver onboarding" onPress={() => void continueOnboarding()} loading={busy} />
          </Card>
        ) : copy && nextStep ? (
          <Card>
            <Text style={styles.section}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>

            {!session ? (
              <Button title={copy.start} onPress={() => void startCurrentStep()} loading={busy} />
            ) : (
              <>
                {nextStep === 'INITIAL_IDENTITY' ? (
                  <Button
                    title="Open camera verification"
                    onPress={() => setLivenessOpen(true)}
                    loading={busy}
                  />
                ) : null}

                {nextStep === 'ELIGIBILITY_DECLARATION' ? (
                  <>
                    <CheckRow
                      label="I confirm I am eligible to drive on this women-only network."
                      checked={declarations.eligible_driver}
                      onToggle={() => setDeclarations((d) => ({ ...d, eligible_driver: !d.eligible_driver }))}
                    />
                    <CheckRow
                      label="The identity and documents I submit are accurate and mine."
                      checked={declarations.accurate_identity}
                      onToggle={() => setDeclarations((d) => ({ ...d, accurate_identity: !d.accurate_identity }))}
                    />
                    <CheckRow
                      label="I will follow the women-only rider and driver policy."
                      checked={declarations.women_only_policy}
                      onToggle={() => setDeclarations((d) => ({ ...d, women_only_policy: !d.women_only_policy }))}
                    />
                    <CheckRow
                      label="I consent to processing my ID for eligibility review."
                      checked={declarations.consent_data_processing}
                      onToggle={() => setDeclarations((d) => ({ ...d, consent_data_processing: !d.consent_data_processing }))}
                    />
                    {idDocumentUri ? (
                      <Image source={{ uri: idDocumentUri }} style={styles.thumb} resizeMode="cover" />
                    ) : null}
                    <Button
                      title={idDocumentUri ? 'Retake government ID photo' : 'Capture government ID'}
                      kind="secondary"
                      onPress={() => setDocCapture('id')}
                    />
                    <Button title={copy.submit} onPress={() => void submitCurrentStep()} loading={busy} />
                  </>
                ) : null}

                {nextStep === 'BACKGROUND_CHECK' ? (
                  <>
                    <Field label="Legal full name" value={legalFullName} onChangeText={setLegalFullName} autoCapitalize="words" />
                    <Field label="National ID number" value={nationalId} onChangeText={setNationalId} autoCapitalize="characters" />
                    <Field label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="1995-04-12" />
                    <CheckRow
                      label="I authorize WomenRide to run a background screening using this identity."
                      checked={backgroundConsent}
                      onToggle={() => setBackgroundConsent((v) => !v)}
                    />
                    {bgcIdUri ? <Image source={{ uri: bgcIdUri }} style={styles.thumb} resizeMode="cover" /> : null}
                    <Button
                      title={bgcIdUri ? 'Retake ID for screening' : 'Capture ID for screening'}
                      kind="secondary"
                      onPress={() => setDocCapture('id')}
                    />
                    <Button title={copy.submit} onPress={() => void submitCurrentStep()} loading={busy} />
                  </>
                ) : null}

                {nextStep === 'LICENSE_DOCUMENT' ? (
                  <>
                    <Field label="License number" value={licenseNumber} onChangeText={setLicenseNumber} autoCapitalize="characters" />
                    <Field label="License country" value={licenseCountry} onChangeText={(v) => setLicenseCountry(v.toUpperCase())} maxLength={2} />
                    <Field label="License expiry (YYYY-MM-DD)" value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="2028-12-31" />
                    <View style={styles.row}>
                      {licenseFrontUri ? <Image source={{ uri: licenseFrontUri }} style={styles.halfThumb} resizeMode="cover" /> : <View style={styles.halfPlaceholder}><Text style={styles.meta}>Front</Text></View>}
                      {licenseBackUri ? <Image source={{ uri: licenseBackUri }} style={styles.halfThumb} resizeMode="cover" /> : <View style={styles.halfPlaceholder}><Text style={styles.meta}>Back</Text></View>}
                    </View>
                    <Button title={licenseFrontUri ? 'Retake license front' : 'Capture license front'} kind="secondary" onPress={() => setDocCapture('license_front')} />
                    <Button title={licenseBackUri ? 'Retake license back' : 'Capture license back'} kind="secondary" onPress={() => setDocCapture('license_back')} />
                    <Button title={copy.submit} onPress={() => void submitCurrentStep()} loading={busy} />
                  </>
                ) : null}

                <Text style={styles.meta}>
                  Session {session.verification_session_id?.slice(0, 8)}… — submit with required evidence to advance.
                </Text>
              </>
            )}
          </Card>
        ) : null}

        <Card>
          <Text style={styles.section}>Privacy boundary</Text>
          <Text style={styles.body}>
            Liveness confirms the person using the account matches the enrolled identity. The platform does not classify gender from a face or voice.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Sign out" kind="ghost" onPress={() => void onSignOut()} />
      </ScrollView>

      <IdentityLivenessFlow
        visible={livenessOpen}
        onCancel={() => setLivenessOpen(false)}
        onCompleted={async (selfieUri) => {
          await submitEvidence({
            selfie_uri: selfieUri,
            liveness_passed: true
          });
        }}
      />

      <DocumentCaptureFlow
        visible={docCapture !== null}
        title={
          docCapture === 'license_front'
            ? 'Driver licence · front'
            : docCapture === 'license_back'
              ? 'Driver licence · back'
              : 'Government ID'
        }
        instruction={
          docCapture === 'license_front' || docCapture === 'license_back'
            ? 'Align the licence inside the frame. Avoid glare and cut-off edges.'
            : 'Align your government ID inside the frame. All corners should be visible.'
        }
        facing="back"
        onCancel={() => setDocCapture(null)}
        onCaptured={(uri) => {
          if (docCapture === 'license_front') setLicenseFrontUri(uri);
          else if (docCapture === 'license_back') setLicenseBackUri(uri);
          else if (nextStep === 'BACKGROUND_CHECK') setBgcIdUri(uri);
          else setIdDocumentUri(uri);
          setDocCapture(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  section: { fontSize: 16, fontWeight: '900', color: palette.ink },
  body: { fontSize: 15, lineHeight: 22, color: palette.ink },
  meta: { fontSize: 12, lineHeight: 17, color: palette.muted },
  error: { color: palette.danger, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  boxOn: { backgroundColor: palette.primary },
  boxMark: { color: '#fff', fontWeight: '900', fontSize: 14, lineHeight: 16 },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: palette.ink, fontWeight: '600' },
  thumb: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#111' },
  halfThumb: { flex: 1, height: 88, borderRadius: 12, backgroundColor: '#111' },
  halfPlaceholder: {
    flex: 1,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.soft
  }
});
