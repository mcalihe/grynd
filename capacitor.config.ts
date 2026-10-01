import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.michaelisler.grynd',
  appName: 'Grynd',
  webDir: 'dist/grynd/browser',
  plugins: {
    // Hidden by the app once startup (database, catalog, settings) is done – see App.
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#f4f4f5',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_grynd',
    },
  },
};

export default config;
