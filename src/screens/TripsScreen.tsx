import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, ListRow, Metric, Pill, palette, SectionLabel } from '../components/ui';
import { money, rideStatusLabel } from '../lib/format';
import type { Me, Ride } from '../lib/types';

export function TripsScreen({ me, currentRide, summary }: { me: Me; currentRide: Ride | null; summary: any }) {
  const history = useMemo(() => {
    const items: Array<{ id: string; title: string; subtitle: string; right: string; status: string }> = [];
    if (currentRide) {
      items.push({
        id: currentRide.id,
        title: currentRide.dropoff_address || 'Active trip',
        subtitle: `${rideStatusLabel(currentRide.status)} · ${currentRide.pickup_address}`,
        right: money(currentRide.estimated_fare_minor, currentRide.currency || 'ETB'),
        status: currentRide.status
      });
    }
    return items;
  }, [currentRide]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trips</Text>
      <Card>
        <SectionLabel text="Performance" />
        <View style={styles.metrics}>
          <Metric label="Rating" value={Number(me.driver.average_rating || 5).toFixed(2)} />
          <Metric label="Completed" value={String(me.driver.completed_rides || summary?.completed_rides || 0)} />
          <Metric label="Cancel rate" value="—%" />
        </View>
        <Text style={styles.note}>Acceptance and cancellation rates will fill from matching analytics.</Text>
      </Card>

      <Card>
        <SectionLabel text="Activity" />
        {history.length ? (
          history.map((t) => (
            <View key={t.id} style={{ gap: 6 }}>
              <ListRow title={t.title} subtitle={t.subtitle} right={t.right} />
              <Pill text={rideStatusLabel(t.status)} tone={t.status === 'CANCELLED' ? 'bad' : 'good'} />
            </View>
          ))
        ) : (
          <EmptyState title="No trips yet" body="When you accept and complete rides, they appear here with fare, distance, and status." />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: palette.ink },
  metrics: { flexDirection: 'row', gap: 10 },
  note: { fontSize: 12, color: palette.muted, lineHeight: 17 }
});
