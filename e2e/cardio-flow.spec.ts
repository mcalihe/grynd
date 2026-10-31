import { expect, test } from '@playwright/test';

/**
 * Cardio and calories (decision 0025): a run without a plan, timed by the clock, and a treadmill
 * entry in a plan. Each test gets a fresh browser context, so the database starts empty.
 */
test('cardio without a plan: clock, distance, device calories → history', async ({ page }) => {
  await page.clock.install();
  await page.goto('/settings');

  // Body weight for the estimate (not needed here: the device calories count)
  const bodyWeight = page.locator('[data-setting=body-weight]');
  await expect(bodyWeight).toBeVisible({ timeout: 30_000 });
  await bodyWeight.getByRole('spinbutton').click();
  await bodyWeight.getByRole('textbox').fill('75');
  await bodyWeight.getByRole('textbox').press('Enter');
  await expect(bodyWeight.getByRole('spinbutton')).toHaveAttribute('aria-valuenow', '75');

  // «Ausdauer starten» → Laufen
  await page.goto('/plans');
  await expect(page.getByText('Noch keine Pläne')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ausdauer starten' }).click();
  await page.getByRole('button', { name: 'Laufen', exact: true }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('heading', { name: 'Laufen' })).toBeVisible();

  // 25 minutes later: distance and the calories from the watch
  await page.clock.fastForward('25:00');
  const session = page.locator('app-cardio-session');
  await session.getByRole('spinbutton', { name: 'KM' }).click();
  await session.getByRole('textbox', { name: 'KM' }).fill('5');
  await session.getByRole('textbox', { name: 'KM' }).press('Enter');
  await session.getByRole('spinbutton', { name: 'KCAL' }).click();
  await session.getByRole('textbox', { name: 'KCAL' }).fill('310');
  await session.getByRole('textbox', { name: 'KCAL' }).press('Enter');
  await expect(session.locator('[data-clock]')).toHaveText(/^25:0\d$/);
  await expect(session.locator('[data-tempo]')).toHaveText(/^5:0\d \/km$/);

  // Finish → celebration with calories, distance and pace → history detail
  await page.getByRole('button', { name: 'Training abschliessen' }).click();
  await expect(page).toHaveURL(/\/workout\/done\/.+/);
  await expect(page.getByText('Laufen', { exact: true })).toBeVisible();
  await expect(page.locator('[data-stat="kcal"] dd')).toHaveText('310 kcal');
  await expect(page.locator('[data-stat="distance"] dd')).toHaveText('5 km');
  await expect(page.locator('[data-stat="tempo"] dd')).toHaveText(/^5:0\d \/km$/);
  await expect(page.locator('[data-stat="sets"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await expect(page.getByRole('heading', { name: 'Laufen', level: 1 })).toBeVisible();
  await expect(page.getByText(/^25:0\d · 5 km · 5:0\d \/km · 310 kcal$/)).toBeVisible();

  // The list names the workout after the activity and shows its distance
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page.getByRole('button', { name: /Laufen.*5 km/ })).toBeVisible();

  // Statistics: calories and distance tiles
  await page.getByRole('radio', { name: 'Statistik' }).click();
  const tiles = page.locator('app-history-stats-view app-key-figures button');
  await expect(tiles.filter({ hasText: 'Kalorien' })).toContainText('310 kcal');
  await expect(tiles.filter({ hasText: 'Distanz' })).toContainText('5 km');
});

test('cardio in a plan: target duration, entry, no body weight → hint', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Noch keine Pläne')).toBeVisible({ timeout: 30_000 });

  // Plan with a treadmill run, found through the «Ausdauer» filter
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByPlaceholder('z.B. Oberkörper').fill('E2E Cardio');
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  await page.getByRole('button', { name: 'Ausdauer', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Übungen durchsuchen' }).fill('Laufen auf dem');
  await page.getByText('Laufen auf dem Laufband').first().click();
  await page.getByRole('button', { name: '1 Übung hinzufügen' }).click();
  await expect(page.getByText('10 Min.')).toBeVisible();
  await page.getByRole('button', { name: 'Plan speichern' }).click();

  await expect(page.getByRole('heading', { name: 'E2E Cardio' })).toBeVisible();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByText('1 Eintrag · Ziel 10 Min.')).toBeVisible();

  // The entry starts with the target duration and fits a 280 px phone
  const entry = page.locator('app-cardio-row').first();
  await expect(entry.getByRole('spinbutton', { name: 'DAUER' })).toHaveAttribute(
    'aria-valuetext',
    '10:00',
  );
  await page.setViewportSize({ width: 280, height: 653 });
  for (const box of [entry.locator(':scope > div'), page.locator('section[data-index="0"]')]) {
    expect(await box.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  }
  await page.setViewportSize({ width: 393, height: 852 });

  await entry.getByRole('spinbutton', { name: 'KM' }).click();
  await entry.getByRole('textbox', { name: 'KM' }).fill('2');
  await entry.getByRole('textbox', { name: 'KM' }).press('Enter');
  await entry.getByRole('button', { name: 'Eintrag abhaken' }).click();
  await expect(entry.getByRole('button', { name: 'Eintrag abhaken' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // No body weight: no calories, but a hint; distance and pace instead of sets
  await page.getByRole('button', { name: 'Training abschliessen' }).click();
  await expect(page).toHaveURL(/\/workout\/done\/.+/);
  await expect(page.locator('[data-stat="distance"] dd')).toHaveText('2 km');
  await expect(page.locator('[data-stat="kcal"]')).toHaveCount(0);
  await expect(page.getByText('Für die Kalorien fehlt dein Körpergewicht.')).toBeVisible();

  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await expect(page.getByText('10:00 · 2 km · 5:00 /km')).toBeVisible();
  await page.getByRole('link', { name: 'Körpergewicht eintragen' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
