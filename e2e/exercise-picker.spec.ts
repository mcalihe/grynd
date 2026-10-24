import { expect, test } from '@playwright/test';

/** Exercise picker (decision 0024): search and filters stay pinned while the list scrolls. */
test('search and filters stay visible while scrolling', async ({ page }) => {
  await page.goto('/plans/new');
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  const search = page.getByRole('searchbox', { name: 'Übungen durchsuchen' });
  await expect(page.getByText('Abduktorenmaschine')).toBeVisible({ timeout: 30_000 });

  await page.getByText('Abduktorenmaschine').hover();
  await page.mouse.wheel(0, 3000);
  await expect(page.getByText('Abduktorenmaschine')).not.toBeInViewport();
  await expect(search).toBeInViewport();

  // Muscle chips filter with one tap, equipment from a dropdown right below its button
  const legs = page.getByRole('button', { name: 'Beine', exact: true });
  await legs.click();
  await expect(legs).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Alle Geräte', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Maschine' }).click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Kabel' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Maschine', exact: true })).toBeVisible();
  await expect(page.getByText('Beinpresse').first()).toBeVisible();

  // Each filter undoes itself where it was set
  await legs.click();
  await page.getByRole('button', { name: 'Maschine', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Alle Geräte' }).click();
  await expect(page.getByRole('button', { name: 'Alle Geräte', exact: true })).toBeVisible();

  // Search understands muscle and equipment words
  await search.fill('bizeps kurzhantel');
  await expect(page.getByText(/\d+ Übung/)).toBeVisible();
  await expect(page.getByText('Keine Übung gefunden')).not.toBeVisible();
});
