import { expect, test } from '@playwright/test';

/**
 * Main flow (roadmap 8.4): create a plan → start a workout → log a set → finish → the history
 * shows it in the list, the calendar, the statistics and the plan history. Each test gets a fresh
 * browser context, so the database starts empty.
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

  // Very small phones (280 px, e.g. Galaxy Fold): the set row stays inside its card, the stepper
  // buttons inside their steppers, and the pager page does not scroll
  const firstSet = page.locator('app-set-row').first();
  await page.setViewportSize({ width: 280, height: 653 });
  const steppers = await firstSet.locator('app-number-stepper').all();
  const boxes = [
    firstSet.locator(':scope > div'),
    ...steppers,
    page.locator('section[data-index="0"]'),
  ];
  for (const box of boxes) {
    expect(await box.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 393, height: 852 });

  // First set: 60 kg × 8 (reps are prefilled with the plan minimum)
  await firstSet.getByRole('spinbutton', { name: 'KG' }).click();
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
  await expect(page.locator('app-key-figures').getByText('480 kg', { exact: true })).toBeVisible();

  // Back to the list: the workout is listed under this week
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText('1 Training', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Brust/ })).toBeVisible();

  // Calendar: today is a training day
  await page.getByRole('radio', { name: 'Kalender' }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.locator('app-month-calendar [data-trained]')).toHaveCount(1);

  // Statistics: one workout this month, and the plan leads to its history
  await page.getByRole('radio', { name: 'Statistik' }).click();
  await expect(page).toHaveURL(/view=stats/);
  const workouts = page.locator('app-history-stats-view app-key-figures button').first();
  await expect(workouts).toContainText('1');
  await expect(workouts).toContainText('Trainings');
  await page.getByRole('button', { name: /E2E Brust/ }).click();
  await expect(page).toHaveURL(/\/history\/plans\/.+/);
  await expect(page.getByRole('heading', { name: 'E2E Brust' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alle Trainings' })).toBeVisible();
});
