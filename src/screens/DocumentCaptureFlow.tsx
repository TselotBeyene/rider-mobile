import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, InteractionManager, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, palette } from '../components/ui';

export function DocumentCaptureFlow({
  visible,
  title,
  instruction,
  facing = 'back',
  onCancel,
  onCaptured
}: {
  visible: boolean;
  title: string;
  instruction: string;
  facing?: 'front' | 'back';
  onCancel: () => void;
  onCaptured: (uri: string) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mountCamera, setMountCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setError('');
      setBusy(false);
      setMountCamera(false);
      setCameraReady(false);
      return;
    }

    // Open the modal immediately; mount the camera after interactions so the UI doesn't hitch.
    const task = InteractionManager.runAfterInteractions(() => {
      setMountCamera(true);
    });
    return () => task.cancel();
  }, [visible]);

  async function shoot() {
    if (!cameraReady || busy) return;
    setBusy(true);
    setError('');
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.45,
        skipProcessing: true,
        shutterSound: false
      });
      if (!photo?.uri) throw new Error('Could not capture the document. Try again.');
      setPreview(photo.uri);
    } catch (e: any) {
      setError(e.message || 'Capture failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={styles.root}>
        {!permission?.granted ? (
          <View style={styles.pad}>
            <Text style={styles.title}>Camera permission</Text>
            <Text style={styles.body}>Document capture requires camera access.</Text>
            <Button title="Allow camera" onPress={() => void requestPermission()} />
            <Button title="Cancel" kind="ghost" onPress={onCancel} />
          </View>
        ) : preview ? (
          <View style={styles.pad}>
            <Text style={styles.title}>Review capture</Text>
            <Text style={styles.body}>{title}</Text>
            <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
            <Button title="Use this photo" onPress={() => onCaptured(preview)} />
            <Button
              title="Retake"
              kind="secondary"
              onPress={() => {
                setPreview(null);
                setCameraReady(false);
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {mountCamera ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                mode="picture"
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
            <View style={styles.frame} pointerEvents="none" />
            <View style={styles.top}>
              <Text style={styles.topTitle}>{title}</Text>
              <Pressable hitSlop={12} onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable>
            </View>
            <View style={styles.bottom}>
              <Text style={styles.hint}>{instruction}</Text>
              <Button
                title={busy ? 'Capturing…' : cameraReady ? 'Capture document' : 'Getting camera ready…'}
                onPress={() => void shoot()}
                loading={busy}
                disabled={!cameraReady || busy}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  pad: { flex: 1, backgroundColor: palette.bg, padding: 22, justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: palette.ink },
  body: { fontSize: 15, lineHeight: 21, color: palette.muted },
  preview: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#111' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B0F',
    gap: 12
  },
  loadingText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  frame: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '22%',
    bottom: '28%',
    borderWidth: 2,
    borderColor: 'rgba(240,217,160,0.9)',
    borderRadius: 18
  },
  top: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  topTitle: { color: '#fff', fontWeight: '800', fontSize: 16, flex: 1, paddingRight: 12 },
  cancel: { color: '#F0D9A0', fontWeight: '700' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 34,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)'
  },
  hint: { color: 'rgba(255,255,255,0.86)', textAlign: 'center', lineHeight: 20 },
  error: { color: '#FFB4A8', fontWeight: '700', textAlign: 'center' }
});
