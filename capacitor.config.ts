import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.vibedo.app',
  appName: 'VibeDo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#fbfbfa',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#fbfbfa',
      overlaysWebView: false,
    },
  },
}

export default config
