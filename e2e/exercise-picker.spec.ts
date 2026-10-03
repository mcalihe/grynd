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

  // Filter via the chip sheet, then reset from the result line
  await page.getByRole('button', { name: 'Muskelgruppe' }).click();
  await page.getByRole('button', { name: 'Brust' }).click();
  await page.keyboard.press('Escape');
  const muscleChip = page.locator('app-filter-chip').first();
  await expect(muscleChip).toHaveText('Brust');
  await expect(page.getByText(/\d+ Übungen/)).toBeVisible();
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(muscleChip).toHaveText('Muskelgruppe');
});
