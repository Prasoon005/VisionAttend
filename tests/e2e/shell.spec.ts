import { expect, test, type Page } from '@playwright/test';
import en from '../../messages/en.json';
import hi from '../../messages/hi.json';

/** The navigation that is visible at this viewport (sidebar or bottom bar). */
const visibleNav = (page: Page, isMobile: boolean) =>
  page.getByTestId(isMobile ? 'bottom-nav' : 'sidebar-nav');

test.describe('app shell', () => {
  test('redirects / to the default locale and renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.Home.title);
  });

  test('shows the sidebar on desktop and the bottom bar on phones', async ({ page, isMobile }) => {
    await page.goto('/en');
    await expect(page.getByTestId('bottom-nav')).toBeVisible({ visible: isMobile });
    await expect(page.getByTestId('sidebar-nav')).toBeVisible({ visible: !isMobile });
  });

  test('has no horizontal scrolling', async ({ page }) => {
    await page.goto('/en');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('navigates between pages and marks the current one', async ({ page, isMobile }) => {
    await page.goto('/en');
    const nav = visibleNav(page, isMobile);
    await nav.getByRole('link', { name: en.Nav.designSystem }).click();
    await expect(page).toHaveURL(/\/en\/design-system$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.DesignSystem.title);
    await expect(nav.getByRole('link', { name: en.Nav.designSystem })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('switches to Hindi on the same page', async ({ page }) => {
    await page.goto('/en/design-system');
    await page.getByRole('button', { name: en.TopBar.language }).click();
    await page.getByRole('menuitem', { name: 'हिन्दी' }).click();

    await expect(page).toHaveURL(/\/hi\/design-system$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hi.DesignSystem.title);
  });

  test('switches to dark theme and remembers it after a reload', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: en.TopBar.theme }).click();
    await page.getByRole('menuitemradio', { name: en.TopBar.themeDark }).click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });

  test('opens the notifications panel with its empty state', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: en.TopBar.notifications }).click();
    await expect(page.getByText(en.TopBar.notificationsEmptyTitle)).toBeVisible();
  });

  test('logs no browser console errors (incl. hydration) on any page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of ['/en', '/hi', '/en/design-system', '/hi/design-system']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
  });

  test('shows a localized not-found page for unknown paths', async ({ page }) => {
    const response = await page.goto('/hi/does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByText(hi.NotFound.title)).toBeVisible();
  });
});

test.describe('design system components', () => {
  test('dialog opens and closes with Escape', async ({ page }) => {
    await page.goto('/en/design-system');
    await page.getByRole('button', { name: en.DesignSystem.openDialog }).click();
    const dialog = page.getByRole('dialog', { name: en.DesignSystem.dialogTitle });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('toast appears', async ({ page }) => {
    await page.goto('/en/design-system');
    await page.getByRole('button', { name: en.DesignSystem.showToast }).click();
    await expect(page.getByText(en.DesignSystem.toastMessage)).toBeVisible();
  });

  test('data table lists the supported languages', async ({ page }) => {
    await page.goto('/en/design-system');
    const table = page.getByRole('table', { name: en.DesignSystem.languagesCaption });
    await expect(table.getByRole('row')).toHaveCount(3); // header + en + hi
  });
});
