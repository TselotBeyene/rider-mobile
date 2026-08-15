import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

export const palette = {
  bg: '#F4F1F8',
  surface: '#FFFFFF',
  ink: '#1C1526',
  muted: '#6B6475',
  primary: '#6E3CBC',
  primaryDark: '#4D258B',
  accent: '#0B8075',
  danger: '#B42318',
  warn: '#B54708',
  border: '#E5DFEC',
  success: '#177447',
  soft: '#EEE8F6',
  online: '#0F7A45',
  offline: '#6B6475'
};

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  kind = 'primary',
  size = 'md'
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'online' | 'offline';
  size?: 'md' | 'lg';
}) {
  const bg =
    kind === 'primary' || kind === 'online' ? palette.primary
      : kind === 'danger' || kind === 'offline' ? (kind === 'offline' ? '#3A3344' : palette.danger)
        : kind === 'secondary' ? palette.surface
          : 'transparent';
  const color = kind === 'secondary' || kind === 'ghost' ? palette.primary : '#fff';
  const minH = size === 'lg' ? 60 : 52;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === 'secondary' ? palette.primary : bg, minHeight: minH, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color, fontSize: size === 'lg' ? 18 : 16 }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9B94A6" {...props} style={[styles.input, props.style]} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? palette.success : tone === 'warn' ? palette.warn : tone === 'bad' ? palette.danger : palette.muted;
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: `${color}14` }]}>
      <Text style={{ color, fontWeight: '800', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function StatusCheck({ label, state }: { label: string; state: 'done' | 'pending' | 'missing' | 'expired' }) {
  const mark = state === 'done' ? '✅' : state === 'pending' ? '⏳' : state === 'expired' ? '⚠️' : '❌';
  const tone = state === 'done' ? palette.success : state === 'pending' ? palette.warn : palette.danger;
  return (
    <View style={styles.statusCheck}>
      <Text style={{ fontSize: 16 }}>{mark}</Text>
      <Text style={[styles.statusCheckText, { color: tone }]}>{label}</Text>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.listRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSub}>{subtitle}</Text> : null}
      </View>
      {right ? <Text style={styles.listRight}>{right}</Text> : <Text style={styles.chevron}>›</Text>}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'D';
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

export function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function BottomNav({
  tab,
  onChange,
  hidden
}: {
  tab: 'home' | 'trips' | 'earnings' | 'inbox' | 'account';
  onChange: (t: 'home' | 'trips' | 'earnings' | 'inbox' | 'account') => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const items: Array<{ id: typeof tab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'trips', label: 'Trips' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'account', label: 'Account' }
  ];
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = item.id === tab;
        return (
          <Pressable key={item.id} onPress={() => onChange(item.id)} style={styles.navItem} accessibilityRole="button" accessibilityLabel={item.label}>
            <View style={[styles.navDot, { backgroundColor: active ? palette.primary : 'transparent' }]} />
            <Text style={[styles.navLabel, { color: active ? palette.primary : palette.muted, fontWeight: active ? '800' : '600' }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontWeight: '800' },
  fieldWrap: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700', color: palette.ink },
  hint: { fontSize: 12, color: palette.muted, lineHeight: 16 },
  input: { minHeight: 50, borderWidth: 1, borderColor: palette.border, borderRadius: 14, paddingHorizontal: 14, backgroundColor: palette.surface, color: palette.ink, fontSize: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 12 },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  title: { fontSize: 28, fontWeight: '900', color: palette.ink },
  subtitle: { fontSize: 15, lineHeight: 21, color: palette.muted },
  statusCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  statusCheckText: { fontSize: 15, fontWeight: '700', flex: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  listTitle: { fontSize: 15, fontWeight: '700', color: palette.ink },
  listSub: { fontSize: 13, color: palette.muted, lineHeight: 18 },
  listRight: { fontSize: 13, fontWeight: '700', color: palette.ink },
  chevron: { fontSize: 22, color: palette.muted, fontWeight: '300' },
  metricValue: { fontSize: 22, fontWeight: '900', color: palette.ink },
  metricLabel: { fontSize: 12, color: palette.muted },
  avatar: { backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { padding: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: palette.ink },
  emptyBody: { fontSize: 14, lineHeight: 20, color: palette.muted, textAlign: 'center' },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingBottom: 10, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navDot: { width: 18, height: 3, borderRadius: 2 },
  navLabel: { fontSize: 11 }
});
