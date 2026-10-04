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

  // A tab per group, one tap per chip, reset in the count line
  const chest = page.getByRole('button', { name: 'Brust', exact: true });
  await chest.click();
  await expect(chest).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('radio', { name: 'Muskeln · 1' })).toBeChecked();
  await page.getByRole('radio', { name: 'Equipment' }).click();
  await page.getByRole('button', { name: 'Kurzhantel', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Equipment · 1' })).toBeChecked();
  await page.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(page.getByRole('radio', { name: 'Equipment', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Kurzhantel', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
