import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Field, ListRow, Pill, StatusCheck, palette, SectionLabel } from '../components/ui';
import { loadOnboardingDraft } from '../lib/localStore';
import type { AccountPanel, Me, OnboardingDraft } from '../lib/types';

export function AccountScreen({
  me,
  onSignOut,
  shiftEligibility
}: {
  me: Me;
  onSignOut: () => Promise<void>;
  shiftEligibility: any;
}) {
  const [panel, setPanel] = useState<AccountPanel>('menu');
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [language, setLanguage] = useState('English');
  const [supportNote, setSupportNote] = useState('');
  const [disputeTrip, setDisputeTrip] = useState('');
  const [disputeNote, setDisputeNote] = useState('');

  useEffect(() => {
    void (async () => setDraft(await loadOnboardingDraft()))();
  }, []);

  if (panel !== 'menu') {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Button title="← Back" kind="ghost" onPress={() => setPanel('menu')} />
        {panel === 'profile' ? (
          <Card>
            <SectionLabel text="Profile" />
            <Avatar name={`${me.user.first_name} ${me.user.last_name}`} size={72} />
            <Text style={styles.name}>{me.user.first_name} {me.user.last_name}</Text>
            <Text style={styles.meta}>Driver ID · {me.user.id.slice(0, 8)}</Text>
            <Text style={styles.meta}>Status · {me.user.account_status}</Text>
            <Text style={styles.meta}>Address · {draft?.address || '—'}</Text>
            <Text style={styles.meta}>Emergency · {draft?.emergency_name || '—'} {draft?.emergency_phone || ''}</Text>
          </Card>
        ) : null}

        {panel === 'vehicle' ? (
          <Card>
            <SectionLabel text="Vehicle" />
            <Text style={styles.body}>{draft?.vehicle_make} {draft?.vehicle_model} · {draft?.vehicle_year}</Text>
            <Text style={styles.meta}>{draft?.vehicle_color} · {draft?.plate_number} · {draft?.vehicle_type}</Text>
            <Pill text="Active vehicle" tone="good" />
            <Text style={styles.note}>Multi-vehicle switch lands with the vehicle service.</Text>
          </Card>
        ) : null}

        {panel === 'documents' ? (
          <Card>
            <SectionLabel text="Document center" />
            <StatusCheck label="Driver license" state={draft?.license_front_note ? 'done' : 'pending'} />
            <StatusCheck label="ID / passport" state={draft?.id_document_note ? 'done' : 'pending'} />
            <StatusCheck label="Vehicle registration" state={draft?.vehicle_reg_note ? 'done' : 'pending'} />
            <StatusCheck label="Insurance" state={draft?.insurance_note ? 'done' : 'expired'} />
            <StatusCheck label="Inspection" state={draft?.inspection_note ? 'done' : 'missing'} />
            <Text style={styles.note}>Expiry: license {draft?.license_expiry || '—'}. Upload/replace APIs will attach files here.</Text>
          </Card>
        ) : null}

        {panel === 'safety' ? (
          <Card>
            <SectionLabel text="Safety center" />
            <Text style={styles.body}>SOS is available on every active trip. Share trip and emergency-contact escalation use the emergency service.</Text>
            <Button title="Open safety guidelines" kind="secondary" onPress={() => Alert.alert('Safety', 'Keep doors locked at pickup, confirm passenger PIN, and use SOS if you feel unsafe.')} />
            <Button title="Call emergency services" kind="danger" onPress={() => void Linking.openURL('tel:911')} />
            <Text style={styles.meta}>Shift verification until {shiftEligibility?.verification_valid_until ? new Date(shiftEligibility.verification_valid_until).toLocaleString() : 'n/a'}</Text>
          </Card>
        ) : null}

        {panel === 'support' ? (
          <Card>
            <SectionLabel text="Support" />
            <ListRow title="Trip issue" subtitle="Wrong route, no-show, cancellation" onPress={() => Alert.alert('Ticket drafted', 'Support ticketing connects next.')} />
            <ListRow title="Payment issue" subtitle="Missing payout, fare dispute" onPress={() => Alert.alert('Ticket drafted', 'Support ticketing connects next.')} />
            <ListRow title="Document issue" subtitle="Rejection or expiry" onPress={() => Alert.alert('Ticket drafted', 'Support ticketing connects next.')} />
            <ListRow title="Safety issue" subtitle="Report passenger / incident" onPress={() => setPanel('safety')} />
            <Field label="Describe a problem" value={supportNote} onChangeText={setSupportNote} placeholder="Details for support" />
            <Button title="Submit ticket" onPress={() => { Alert.alert('Submitted', 'Local ticket recorded for this demo build.'); setSupportNote(''); }} />
          </Card>
        ) : null}

        {panel === 'settings' ? (
          <Card>
            <SectionLabel text="Settings" />
            <ListRow title="Language" right={language} onPress={() => setLanguage(language === 'English' ? 'Amharic' : 'English')} />
            <ListRow title="Navigation preference" right="Apple Maps" onPress={() => Alert.alert('Navigation', 'Apple Maps is default on iOS. Google Maps / Waze can be selected later.')} />
            <ListRow title="Notifications" subtitle="Ride, payout, document alerts" onPress={() => Alert.alert('Notifications', 'Push permission is managed by iOS Settings.')} />
            <ListRow title="Location permissions" onPress={() => void Linking.openSettings()} />
            <ListRow title="Terms & driver agreement" onPress={() => Alert.alert('Legal', 'Driver agreement accepted during onboarding.')} />
            <ListRow title="Privacy policy" onPress={() => Alert.alert('Privacy', 'Location is shared while online or on trip.')} />
          </Card>
        ) : null}

        {panel === 'performance' ? (
          <Card>
            <SectionLabel text="Performance" />
            <Text style={styles.body}>Rating {Number(me.driver.average_rating || 5).toFixed(2)} ★</Text>
            <Text style={styles.meta}>Completed rides {me.driver.completed_rides}</Text>
            <Text style={styles.meta}>Driver level · Bronze</Text>
            <Text style={styles.note}>Levels and acceptance analytics expand with ops data.</Text>
          </Card>
        ) : null}

        {panel === 'incentives' ? (
          <Card>
            <SectionLabel text="Incentives" />
            <Text style={styles.body}>Peak-hour bonus zones and ride challenges appear when incentive campaigns are published.</Text>
            <Text style={styles.meta}>Current: Complete 10 rides for +500 ETB</Text>
          </Card>
        ) : null}

        {panel === 'disputes' ? (
          <Card>
            <SectionLabel text="Fare / dispute" />
            <Field label="Trip ID" value={disputeTrip} onChangeText={setDisputeTrip} placeholder="Paste trip id" />
            <Field label="What happened?" value={disputeNote} onChangeText={setDisputeNote} placeholder="Incorrect fare, toll, damage…" />
            <Button title="Submit dispute" onPress={() => { Alert.alert('Dispute received', 'Operations can review once the disputes API is live.'); setDisputeTrip(''); setDisputeNote(''); }} />
          </Card>
        ) : null}

        {panel === 'status' ? (
          <Card>
            <SectionLabel text="Account status" />
            <Pill text={me.user.account_status} tone={me.user.account_status === 'ACTIVE' ? 'good' : 'warn'} />
            <StatusCheck label="Identity" state={me.user.identity_verified ? 'done' : 'pending'} />
            <StatusCheck label="Eligibility" state={me.user.eligibility_verified ? 'done' : 'pending'} />
            <StatusCheck label="Profile complete" state={me.driver.profile_complete ? 'done' : 'missing'} />
            {!me.user.identity_verified ? <Text style={styles.warning}>Account pending verification.</Text> : null}
          </Card>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={`${me.user.first_name} ${me.user.last_name}`} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{me.user.first_name} {me.user.last_name}</Text>
          <Text style={styles.meta}>★ {Number(me.driver.average_rating || 5).toFixed(2)} · {me.user.account_status}</Text>
        </View>
      </View>
      <Card>
        <ListRow title="Profile" subtitle="Photo, phone, emergency contact" onPress={() => setPanel('profile')} />
        <ListRow title="Vehicle management" subtitle="Active vehicle and details" onPress={() => setPanel('vehicle')} />
        <ListRow title="Document center" subtitle="License, insurance, inspection" onPress={() => setPanel('documents')} />
        <ListRow title="Account status" subtitle="Active / suspended / documents" onPress={() => setPanel('status')} />
        <ListRow title="Performance" subtitle="Rating, levels, rates" onPress={() => setPanel('performance')} />
        <ListRow title="Incentives" subtitle="Bonuses and challenges" onPress={() => setPanel('incentives')} />
        <ListRow title="Safety center" subtitle="SOS, guidelines, emergency" onPress={() => setPanel('safety')} />
        <ListRow title="Support" subtitle="Help, tickets, categories" onPress={() => setPanel('support')} />
        <ListRow title="Disputes" subtitle="Fare and trip issues" onPress={() => setPanel('disputes')} />
        <ListRow title="Settings" subtitle="Language, privacy, legal" onPress={() => setPanel('settings')} />
      </Card>
      <Button title="Sign out" kind="danger" onPress={() => void onSignOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontSize: 22, fontWeight: '900', color: palette.ink },
  meta: { fontSize: 13, color: palette.muted, lineHeight: 18 },
  body: { fontSize: 15, color: palette.ink, lineHeight: 21, fontWeight: '600' },
  note: { fontSize: 12, color: palette.muted, lineHeight: 17 },
  warning: { color: palette.warn, fontWeight: '700' }
});
