import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from './useFocusEffect';
import { Card, EmptyState, Pill, palette, SectionLabel } from '../components/ui';
import { loadNotifications, saveNotifications, type LocalNotification } from '../lib/localStore';

export function InboxScreen() {
  const [items, setItems] = useState<LocalNotification[]>([]);

  const refresh = useCallback(() => {
    void (async () => setItems(await loadNotifications()))();
  }, []);

  useFocusEffect(refresh);

  async function markRead(id: string) {
    const next = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    setItems(next);
    await saveNotifications(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inbox</Text>
      <Card>
        <SectionLabel text="Notifications" />
        {items.length ? (
          items.map((n) => (
            <Pressable key={n.id} onPress={() => void markRead(n.id)} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.itemTitle, !n.read && styles.unread]}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.meta}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
              <Pill text={n.kind} tone={n.kind === 'safety' ? 'bad' : n.read ? 'neutral' : 'good'} />
            </Pressable>
          ))
        ) : (
          <EmptyState title="Inbox empty" body="Ride offers, document reminders, payouts, and support replies show up here." />
        )}
      </Card>
      <Card>
        <SectionLabel text="Messages" />
        <EmptyState title="No chats yet" body="In-app passenger messages and templates (I've arrived, I'm outside) will appear during active trips." />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 30 },
  title: { fontSize: 28, fontWeight: '900', color: palette.ink },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  itemTitle: { fontSize: 15, fontWeight: '700', color: palette.ink },
  unread: { color: palette.primary },
  body: { fontSize: 13, lineHeight: 18, color: palette.muted },
  meta: { fontSize: 11, color: palette.muted }
});
