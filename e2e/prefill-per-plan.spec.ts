import { expect, Page, test } from '@playwright/test';

/**
 * Prefill per plan and the exercise history (decision 0028): the same exercise in two plans keeps
 * its own values in each, and its history shows both plans or one.
 * A plan that never did the exercise starts with the values from the other plan.
 */
test('each plan prefills from its own last workout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Noch keine Pläne')).toBeVisible({ timeout: 30_000 });

  await createPlan(page, 'E2E Oben');
  await train(page, 80);

  // A new plan with the same exercise starts with last time's 80 kg; this time only 60 kg
  await page.goto('/plans');
  await createPlan(page, 'E2E Ganz');
  await expect(firstWeight(page)).toHaveAttribute('aria-valuenow', '80');
  await train(page, 60);

  // The exercise history from the workout detail: this plan first, then all plans
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/\/history\/.+/);
  await page.getByRole('button', { name: 'Verlauf von Bankdrücken (mittlerer Griff)' }).click();
  await expect(page).toHaveURL(/\/history\/exercises\/.+\?plan=/);
  const plans = page.locator('[data-filter="plans"]');
  await expect(plans.getByRole('radio', { name: 'E2E Ganz' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const workouts = page.locator('app-history-row');
  await expect(workouts).toHaveCount(1);
  await expect(workouts.first()).toContainText('60 kg × 8');
  await plans.getByRole('radio', { name: 'Alle Pläne' }).click();
  await expect(workouts).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Nach Plan' })).toBeVisible();

  // The first plan still remembers its own 80 kg
  await page.goto('/plans');
  await page
    .getByRole('button', { name: /E2E Oben/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(firstWeight(page)).toHaveAttribute('aria-valuenow', '80');

  // The exercise menu opens the history mid-workout; «Zurück» returns to the workout
  await page.getByRole('button', { name: 'Übungsmenü' }).click();
  await page.getByRole('menuitem', { name: 'Verlauf ansehen' }).click();
  await expect(page).toHaveURL(/\/history\/exercises\/.+\?plan=/);
  await expect(plans.getByRole('radio', { name: 'E2E Oben' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(firstWeight(page)).toHaveAttribute('aria-valuenow', '80');
});

/** Creates a plan with bench press and starts its workout. */
async function createPlan(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByPlaceholder('z.B. Oberkörper').fill(name);
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  await page.getByRole('searchbox', { name: 'Übungen durchsuchen' }).fill('Bankdrücken mittlerer');
  await page.getByText('Bankdrücken (mittlerer Griff)').first().click();
  await page.getByRole('button', { name: '1 Übung hinzufügen' }).click();
  await page.getByRole('button', { name: 'Plan speichern' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page).toHaveURL(/\/workout$/);
}

/** Logs the first set with `kg` and finishes the workout. */
async function train(page: Page, kg: number): Promise<void> {
  const set = page.locator('app-set-row').first();
  await set.getByRole('spinbutton', { name: 'KG' }).click();
  await set.getByRole('textbox', { name: 'KG' }).fill(String(kg));
  await set.getByRole('textbox', { name: 'KG' }).press('Enter');
  await set.getByRole('button', { name: 'Satz abhaken' }).click();
  await expect(set.getByRole('button', { name: 'Satz abhaken' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Training abschliessen' }).click();
  await expect(page).toHaveURL(/\/workout\/done\/.+/);
}

function firstWeight(page: Page) {
  return page.locator('app-set-row').first().getByRole('spinbutton', { name: 'KG' });
}
