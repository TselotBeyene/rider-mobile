import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function WelcomeLanding({
  onGetStarted,
  onSignIn
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Text style={styles.brand}>WOMENRIDE</Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.headline}>Drive with{'\n'}care.</Text>
          <View style={styles.rule} />
          <Text style={styles.support}>Your safety is our priority,{'\n'}every ride, every time.</Text>
        </View>

        <View style={styles.bottom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={onGetStarted}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryText}>Get started</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={onSignIn}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const serif = 'Georgia';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  safe: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  top: { paddingTop: 18, alignItems: 'center' },
  brand: {
    color: '#C6A75E',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4
  },
  center: { alignItems: 'center', gap: 16, marginBottom: 24 },
  headline: {
    fontFamily: serif,
    fontSize: 44,
    lineHeight: 50,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '400'
  },
  rule: {
    width: 48,
    height: 1.5,
    backgroundColor: '#C6A75E',
    marginTop: 2
  },
  support: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    fontWeight: '400'
  },
  bottom: { paddingBottom: 22, gap: 14, alignItems: 'center' },
  primary: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: '#C6A75E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: {
    color: '#121212',
    fontSize: 17,
    fontWeight: '600'
  },
  secondary: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500'
  }
});
