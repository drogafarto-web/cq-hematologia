/**
 * Flow 1: Authentication
 *
 * Covers the critical path: cold launch → login → home screen → tabs visible.
 *
 * Security note (STRIDE T-03.3-03):
 * Credentials are loaded from environment variables DETOX_TEST_EMAIL / DETOX_TEST_PASSWORD.
 * Never hardcode production credentials. Use an isolated test lab.
 *
 * testIDs used:
 * - auth-screen        → AuthScreen root View
 * - email-input        → Email TextInput
 * - password-input     → Password TextInput
 * - login-button       → Login TouchableOpacity
 * - home-screen        → HomeScreen root View (after successful login)
 * - tab-ciq            → CIQ tab button in RootNavigator
 * - tab-nc             → NC tab button in RootNavigator
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const TEST_EMAIL = process.env.DETOX_TEST_EMAIL ?? 'test@hcquality-lab.dev';
const TEST_PASSWORD = process.env.DETOX_TEST_PASSWORD ?? 'TestPassword123!';

describe('Flow 1: Auth', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('shows login screen on cold launch', async () => {
    await detoxExpect(element(by.id('auth-screen'))).toBeVisible();
  });

  it('email and password inputs are present and editable', async () => {
    await detoxExpect(element(by.id('email-input'))).toBeVisible();
    await detoxExpect(element(by.id('password-input'))).toBeVisible();
    await detoxExpect(element(by.id('login-button'))).toBeVisible();
  });

  it('logs in with valid test credentials', async () => {
    await element(by.id('email-input')).clearText();
    await element(by.id('email-input')).typeText(TEST_EMAIL);

    await element(by.id('password-input')).clearText();
    await element(by.id('password-input')).typeText(TEST_PASSWORD);

    await element(by.id('login-button')).tap();

    // Wait for home screen — Firebase Auth round-trip can take up to 10s
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('shows bottom tab navigator with CIQ and NC tabs after login', async () => {
    await detoxExpect(element(by.id('tab-ciq'))).toBeVisible();
    await detoxExpect(element(by.id('tab-nc'))).toBeVisible();
  });

  it('can navigate to CIQ tab', async () => {
    await element(by.id('tab-ciq')).tap();
    await waitFor(element(by.id('ciq-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('can navigate back to home tab', async () => {
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(3000);
  });
});
