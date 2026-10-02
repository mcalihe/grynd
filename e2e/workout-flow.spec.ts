import { expect, test } from '@playwright/test';

/**
 * Main flow (roadmap 8.4): create a plan → start a workout → log a set → finish → the history
 * shows it. Each test gets a fresh browser context, so the database starts empty.
 */
test('plan → workout → history', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByText('Noch keine Pläne')).toBeVisible({ timeout: 30_000 });

  // New plan with one exercise
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByPlaceholder('z.B. Oberkörper').fill('E2E Brust');
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  await page.getByRole('searchbox', { name: 'Übungen durchsuchen' }).fill('Bankdrücken mittlerer');
  await page.getByText('Bankdrücken (mittlerer Griff)').first().click();
  await page.getByRole('button', { name: '1 Übung hinzufügen' }).click();
  await page.getByRole('button', { name: 'Plan speichern' }).click();

  // Plan detail → workout
  await expect(page.getByRole('heading', { name: 'E2E Brust' })).toBeVisible();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('heading', { name: 'Bankdrücken (mittlerer Griff)' })).toBeVisible();

  // First set: 60 kg × 8 (reps are prefilled with the plan minimum)
  const firstSet = page.locator('app-set-row').first();
  await firstSet.locator('app-number-stepper').first().getByRole('button', { name: '–' }).click();
  await firstSet.getByRole('textbox', { name: 'KG' }).fill('60');
  await firstSet.getByRole('textbox', { name: 'KG' }).press('Enter');
  await firstSet.getByRole('button', { name: 'Satz abhaken' }).click();
  await expect(firstSet.getByRole('button', { name: 'Satz abhaken' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Finish → celebration (figures count up to their final values) → history detail
  await page.getByRole('button', { name: 'Training abschliessen' }).click();
  await expect(page).toHaveURL(/\/workout\/done\/.+/);
  await expect(page.getByRole('heading', { name: 'Training geschafft!' })).toBeVisible();
  await expect(page.locator('[data-stat="volume"] dd')).toHaveText('480 kg');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await expect(page.getByRole('heading', { name: 'E2E Brust' })).toBeVisible();
  await expect(page.getByText('60 kg × 8')).toBeVisible();
  await expect(page.getByText('480 kg')).toBeVisible();

  // Back to the list: the workout is listed under this week
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText('1 Training', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Brust/ })).toBeVisible();
});
