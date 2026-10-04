import { expect, test } from '@playwright/test';

/** Exercise picker (decision 0016): search and filters stay pinned while the list scrolls. */
test('search and filters stay visible while scrolling', async ({ page }) => {
  await page.goto('/plans/new');
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  const search = page.getByRole('searchbox', { name: 'Übungen durchsuchen' });
  await expect(page.getByText('Abduktorenmaschine')).toBeVisible({ timeout: 30_000 });

  await page.getByText('Abduktorenmaschine').hover();
  await page.mouse.wheel(0, 3000);
  await expect(page.getByText('Abduktorenmaschine')).not.toBeInViewport();
  await expect(search).toBeInViewport();

  // One tap filters, ✕ at the start of the row clears the chips
  const chest = page.getByRole('button', { name: 'Brust', exact: true });
  await chest.click();
  await expect(chest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/\d+ Übungen/)).toBeVisible();
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(chest).toHaveAttribute('aria-pressed', 'false');
});
