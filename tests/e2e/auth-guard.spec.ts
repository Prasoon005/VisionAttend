import { expect, test } from '@playwright/test';

/**
 * proxy.ts sends signed-out visitors from protected areas to the right
 * sign-in page, remembering where they were going.
 */
test.describe('protected areas when signed out', () => {
  for (const [path, login] of [
    ['/en/dashboard', '/en/login'],
    ['/hi/dashboard', '/hi/login'],
    ['/en/admin', '/en/admin/login'],
    ['/en/platform', '/en/admin/login'],
  ] as const) {
    test(`${path} redirects to ${login}`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe(login);
      expect(url.searchParams.get('next')).toBe(path.replace(/^\/(en|hi)/, ''));
    });
  }

  test('public pages stay reachable', async ({ page }) => {
    for (const path of ['/en', '/en/design-system']) {
      await page.goto(path);
      expect(new URL(page.url()).pathname).toBe(path);
    }
  });
});
