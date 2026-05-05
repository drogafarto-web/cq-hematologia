/**
 * Detox E2E configuration — HC Quality Mobile
 *
 * Targets:
 * - iOS: iPhone 15 Pro simulator (iOS 17+)
 * - Android: Pixel 7 API 34 emulator
 *
 * Security note (STRIDE T-03.3-03):
 * E2E tests MUST use the DETOX_TEST_LAB_ID env var pointing to an isolated
 * test lab with no real patient data. Never use a production labId in tests.
 *
 * Run:
 *   npx detox test -c ios.debug
 *   npx detox test -c android.debug
 *   npx detox test -c ios.debug --testNamePattern="Flow 1"
 */

module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
    retries: 2,
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/HCQuality.app',
      build: [
        'xcodebuild',
        '-workspace ios/HCQuality.xcworkspace',
        '-scheme HCQuality',
        '-configuration Debug',
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        'COMPILER_INDEX_STORE_ENABLE=NO',
      ].join(' '),
    },

    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro',
      },
    },

    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_API_34',
      },
    },
  },

  configurations: {
    'ios.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },

    'android.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
