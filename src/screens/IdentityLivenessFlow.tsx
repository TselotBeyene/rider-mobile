import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, InteractionManager, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, palette } from '../components/ui';

type Phase =
  | 'permission'
  | 'center'
  | 'still'
  | 'turn_left'
  | 'look_forward'
  | 'capture'
  | 'review'
  | 'submitting';

const PHASE_COPY: Record<Exclude<Phase, 'permission' | 'review' | 'submitting'>, { title: string; hint: string }> = {
  center: { title: 'Center your face', hint: 'Fit your face inside the oval. Good lighting helps.' },
  still: { title: 'Hold still', hint: 'Keep your head steady while we check liveness.' },
  turn_left: { title: 'Slowly turn left', hint: 'Turn your head slightly left, then hold.' },
  look_forward: { title: 'Look straight ahead', hint: 'Return to center and keep eyes open.' },
  capture: { title: 'Capture selfie', hint: 'We will take one selfie to enroll your identity.' }
};

export function IdentityLivenessFlow({
  visible,
  onCancel,
  onCompleted
}: {
  visible: boolean;
  onCancel: () => void;
  onCompleted: (selfieUri: string) => Promise<void>;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('permission');
  const [countdown, setCountdown] = useState(3);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mountCamera, setMountCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPhase('permission');
      setSelfieUri(null);
      setError('');
      setCountdown(3);
      setBusy(false);
      setMountCamera(false);
      setCameraReady(false);
      return;
    }
    if (permission?.granted) setPhase('center');
    else setPhase('permission');

    const task = InteractionManager.runAfterInteractions(() => {
      if (permission?.granted) setMountCamera(true);
    });
    return () => task.cancel();
  }, [visible, permission?.granted]);

  useEffect(() => {
    if (!visible) return;
    if (phase !== 'still' && phase !== 'turn_left' && phase !== 'look_forward') return;
    setCountdown(3);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setPhase((p) => {
            if (p === 'still') return 'turn_left';
            if (p === 'turn_left') return 'look_forward';
            if (p === 'look_forward') return 'capture';
            return p;
          });
          return 3;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, visible]);

  async function takeSelfie() {
    if (!cameraReady || busy) return;
    setError('');
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.45,
        skipProcessing: true,
        shutterSound: false
      });
      if (!photo?.uri) throw new Error('Could not capture selfie. Try again.');
      setSelfieUri(photo.uri);
      setPhase('review');
    } catch (e: any) {
      setError(e.message || 'Camera capture failed.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!selfieUri) return;
    setBusy(true);
    setError('');
    setPhase('submitting');
    try {
      await onCompleted(selfieUri);
    } catch (e: any) {
      setError(e.message || 'Could not submit identity verification.');
      setPhase('review');
    } finally {
      setBusy(false);
    }
  }

  const guide = phase in PHASE_COPY ? PHASE_COPY[phase as keyof typeof PHASE_COPY] : null;
  const showCamera = phase !== 'permission' && phase !== 'review' && phase !== 'submitting';

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={styles.root}>
        {phase === 'permission' ? (
          <View style={styles.centerPad}>
            <Text style={styles.title}>Camera access required</Text>
            <Text style={styles.body}>Identity verification needs your front camera for a short selfie and liveness check.</Text>
            <Button
              title="Allow camera"
              onPress={() => {
                void (async () => {
                  const res = await requestPermission();
                  if (!res.granted) setError('Camera permission was denied. Enable it in Settings to continue.');
                  else setMountCamera(true);
                })();
              }}
            />
            <Button title="Cancel" kind="ghost" onPress={onCancel} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}

        {showCamera ? (
          <View style={styles.cameraWrap}>
            {mountCamera ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="front"
                mode="picture"
                mirror
                animateShutter={false}
                onCameraReady={() => setCameraReady(true)}
              />
            ) : null}
            {!cameraReady ? (
              <View style={styles.loading} pointerEvents="none">
                <ActivityIndicator size="large" color="#F0D9A0" />
                <Text style={styles.loadingText}>Opening camera…</Text>
              </View>
            ) : null}
            <View style={styles.ovalMask} pointerEvents="none">
              <View style={styles.oval} />
            </View>
            <View style={styles.topBar}>
              <Text style={styles.stepLabel}>Identity verification</Text>
              <Pressable hitSlop={12} onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable>
            </View>
            <View style={styles.bottomBar}>
              {guide ? (
                <>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideHint}>{guide.hint}</Text>
                </>
              ) : null}
              {(phase === 'still' || phase === 'turn_left' || phase === 'look_forward') ? (
                <Text style={styles.countdown}>{countdown}</Text>
              ) : null}
              {phase === 'center' ? (
                <Button
                  title={cameraReady ? "I'm ready — start liveness" : 'Getting camera ready…'}
                  onPress={() => setPhase('still')}
                  disabled={!cameraReady}
                />
              ) : null}
              {phase === 'capture' ? (
                <Button title={busy ? 'Capturing…' : 'Take selfie'} onPress={() => void takeSelfie()} loading={busy} disabled={!cameraReady} />
              ) : null}
              {error ? <Text style={styles.errorLight}>{error}</Text> : null}
            </View>
          </View>
        ) : null}

        {phase === 'review' && selfieUri ? (
          <View style={styles.centerPad}>
            <Text style={styles.title}>Confirm your selfie</Text>
            <Text style={styles.body}>Make sure your face is clear and fully visible. This enrolls your identity for future reauth checks.</Text>
            <Image source={{ uri: selfieUri }} style={styles.preview} resizeMode="cover" />
            <Button title="Use this selfie" onPress={() => void confirm()} loading={busy} />
            <Button
              title="Retake"
              kind="secondary"
              onPress={() => {
                setSelfieUri(null);
                setPhase('center');
                setCameraReady(false);
              }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}

        {phase === 'submitting' ? (
          <View style={styles.centerPad}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.title}>Submitting identity check…</Text>
            <Text style={styles.body}>Encrypting selfie evidence and updating your verification session.</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  centerPad: { flex: 1, padding: 24, justifyContent: 'center', gap: 14, backgroundColor: palette.bg },
  title: { fontSize: 24, fontWeight: '900', color: palette.ink },
  body: { fontSize: 15, lineHeight: 22, color: palette.muted },
  error: { color: palette.danger, fontWeight: '700' },
  errorLight: { color: '#FFB4A8', fontWeight: '700', textAlign: 'center' },
  cameraWrap: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0F',
    gap: 12
  },
  loadingText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  ovalMask: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  oval: {
    width: 260,
    height: 340,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: 'rgba(240,217,160,0.95)',
    backgroundColor: 'transparent'
  },
  topBar: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  stepLabel: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancel: { color: '#F0D9A0', fontWeight: '700', fontSize: 15 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 22,
    paddingBottom: 36,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  guideTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  guideHint: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  countdown: { color: '#F0D9A0', fontSize: 48, fontWeight: '900', textAlign: 'center' },
  preview: { width: '100%', height: 280, borderRadius: 20, backgroundColor: '#111' }
});
