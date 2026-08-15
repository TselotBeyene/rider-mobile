export default {
  expo: {
    name: 'WomenRide Driver',
    slug: 'womenride-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'womenride-driver',
    newArchEnabled: true,
    ios: { bundleIdentifier: 'com.womenride.womenridedriver', supportsTablet: false },
    android: { package: 'com.womenride.womenridedriver' },
    plugins: [
      'expo-font',
      [
        'expo-camera',
        {
          cameraPermission: 'WomenRide Driver needs the camera for identity selfie and liveness verification.',
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      ['expo-location', {
          locationWhenInUsePermission: 'WomenRide Driver uses your location to receive ride offers and navigate active trips.',
          locationAlwaysAndWhenInUsePermission: 'WomenRide Driver uses background location while you are online so riders can be matched and track active trips.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }]
    ]
  }
};
