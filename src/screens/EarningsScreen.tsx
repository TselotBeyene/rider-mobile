import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Field, ListRow, Metric, palette, SectionLabel } from '../components/ui';
import { money } from '../lib/format';
import { loadOnboardingDraft, loadWallet, saveWallet, type WalletState } from '../lib/localStore';

export function EarningsScreen({ summary }: { summary: any }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [amount, setAmount] = useState('200');
  const [method, setMethod] = useState('Telebirr');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const w = await loadWallet();
      const draft = await loadOnboardingDraft();
      if (draft.bank_provider) setMethod(draft.bank_provider);
      // Seed available balance from weekly summary for local demo wallet.
      if (summary?.estimated_driver_payout_minor && w.available_minor === 0 && w.payouts.length === 0) {
        w.available_minor = summary.estimated_driver_payout_minor;
        await saveWallet(w);
      }
      setWallet(w);
    })();
  }, [summary]);

  async function withdraw() {
    if (!wallet) return;
    setBusy(true);
    try {
      const minor = Math.round(Number(amount) * 100);
      if (!Number.isFinite(minor) || minor <= 0) throw new Error('Enter a valid amount.');
      if (minor > wallet.available_minor) throw new Error('Amount exceeds available balance.');
      const next: WalletState = {
        ...wallet,
        available_minor: wallet.available_minor - minor,
        pending_minor: wallet.pending_minor + minor,
        payouts: [
          {
            id: `p_${Date.now()}`,
            amount_minor: minor,
            method,
            status: 'PROCESSING',
            created_at: new Date().toISOString()
          },
          ...wallet.payouts
        ]
      };
      await saveWallet(next);
      setWallet(next);
      Alert.alert('Payout requested', 'Local demo wallet updated. Connect the payments service for real withdrawals.');
    } catch (e: any) {
      Alert.alert('Payout failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  const currency = summary?.currency || wallet?.currency || 'ETB';
  const bars = [40, 70, 35, 85, 95, 60, 50];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Earnings</Text>
      <Card>
        <SectionLabel text="This week" />
        <View style={styles.metrics}>
          <Metric label="Net estimate" value={money(summary?.estimated_driver_payout_minor ?? 0, currency)} />
          <Metric label="Trips" value={String(summary?.completed_rides ?? 0)} />
        </View>
        <View style={styles.chart}>
          {bars.map((h, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: h }]} />
              <Text style={styles.barLabel}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Chart is illustrative until daily earnings endpoints ship.</Text>
      </Card>

      <Card>
        <SectionLabel text="Wallet" />
        <View style={styles.metrics}>
          <Metric label="Available" value={money(wallet?.available_minor ?? 0, currency)} />
          <Metric label="Pending" value={money(wallet?.pending_minor ?? 0, currency)} />
        </View>
        <Field label="Withdraw amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Destination" value={method} onChangeText={setMethod} />
        <Button title="Request payout" onPress={() => void withdraw()} loading={busy} />
      </Card>

      <Card>
        <SectionLabel text="Payout history" />
        {wallet?.payouts?.length ? (
          wallet.payouts.map((p) => (
            <ListRow
              key={p.id}
              title={money(p.amount_minor, currency)}
              subtitle={`${p.method} · ${new Date(p.created_at).toLocaleString()}`}
              right={p.status}
            />
          ))
        ) : (
          <EmptyState title="No payouts yet" body="Completed trip earnings can be withdrawn to mobile money or bank once available." />
        )}
      </Card>

      <Card>
        <SectionLabel text="Incentives" />
        <Text style={styles.body}>Complete 10 rides — earn an extra 500 ETB</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, ((summary?.completed_rides ?? 0) / 10) * 100)}%` }]} /></View>
        <Text style={styles.note}>{summary?.completed_rides ?? 0}/10 rides</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: palette.ink },
  metrics: { flexDirection: 'row', gap: 10 },
  note: { fontSize: 12, color: palette.muted, lineHeight: 17 },
  body: { fontSize: 15, fontWeight: '700', color: palette.ink },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 110, paddingTop: 8 },
  barCol: { alignItems: 'center', gap: 6, flex: 1 },
  bar: { width: 14, borderRadius: 8, backgroundColor: palette.primary },
  barLabel: { fontSize: 10, color: palette.muted, fontWeight: '700' },
  progressTrack: { height: 10, borderRadius: 8, backgroundColor: palette.border, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: palette.accent }
});
