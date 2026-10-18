import { expect, Page, test } from '@playwright/test';

/**
 * Export and import (decision 0024): a code is copied to the clipboard, a file is downloaded.
 */
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function createPlan(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Noch keine Pläne')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByPlaceholder('z.B. Oberkörper').fill(name);
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  await page.getByRole('searchbox', { name: 'Übungen durchsuchen' }).fill('Bankdrücken mittlerer');
  await page.getByText('Bankdrücken (mittlerer Griff)').first().click();
  await page.getByRole('button', { name: '1 Übung hinzufügen' }).click();
  await page.getByRole('button', { name: 'Plan speichern' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('share a plan as code and import it', async ({ page }) => {
  await createPlan(page, 'E2E Teilen');

  // From the plan: that plan alone, without history, so the code is ready right away.
  await page.getByRole('button', { name: 'Plan teilen' }).click();
  await expect(page.getByRole('checkbox', { name: 'E2E Teilen' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Trainings (Verlauf)' })).not.toBeChecked();
  const code = page.getByRole('textbox', { name: 'Code', exact: true });
  await expect(code).toHaveValue(/^GRYND1:[A-Za-z0-9_-]+$/);
  await page.getByRole('button', { name: 'Code kopieren' }).click();
  await expect(page.getByText('Code kopiert')).toBeVisible();
  const message = await page.evaluate(() => navigator.clipboard.readText());
  expect(message).toBe(await code.inputValue());
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Plan importieren' }).click();
  const field = page.getByRole('textbox', { name: 'Code oder Text einfügen' });

  // A damaged code is explained right under the field.
  await field.fill(message.slice(0, -12));
  await page.getByRole('button', { name: 'Importieren', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unvollständig oder beschädigt');

  await field.fill(message);
  await page.getByRole('button', { name: 'Importieren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plan «E2E Teilen» hinzufügen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Hinzufügen' }).click();

  await expect(page.getByText('«E2E Teilen (2)» hinzugefügt')).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Teilen \(2\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^E2E Teilen\b(?! \()/ })).toBeVisible();
});

test('export a backup, merge it back and undo a replace', async ({ page }) => {
  await createPlan(page, 'E2E Sicherung');
  await page.getByRole('button', { name: 'Zurück' }).click();

  // From the settings: everything, photos included, so only as a file.
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  await expect(page.getByRole('button', { name: 'Code kopieren' })).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Datei speichern' }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();
  await page.keyboard.press('Escape');

  // A second plan after the backup.
  await page.getByRole('link', { name: 'Pläne' }).click();
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByPlaceholder('z.B. Oberkörper').fill('E2E Später');
  await page.getByRole('button', { name: 'Übung hinzufügen' }).first().click();
  await page.getByRole('searchbox', { name: 'Übungen durchsuchen' }).fill('Bankdrücken mittlerer');
  await page.getByText('Bankdrücken (mittlerer Griff)').first().click();
  await page.getByRole('button', { name: '1 Übung hinzufügen' }).click();
  await page.getByRole('button', { name: 'Plan speichern' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Später' })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();

  // Merge: the backup's plan is already here, the later one stays.
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Importieren' }).click();
  await page.locator('input[type=file][accept*=json]').setInputFiles(file);
  await expect(page.getByRole('heading', { name: /^Sicherung vom / })).toBeVisible();
  await expect(page.getByText(/Pläne: 1 · Trainings: 0/)).toBeVisible();
  await page.getByRole('button', { name: 'Zusammenführen' }).click();
  await expect(page.getByText('Sicherung zusammengeführt')).toBeVisible();
  await page.getByRole('link', { name: 'Pläne' }).click();
  await expect(page.getByRole('button', { name: /E2E Später/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Sicherung/ })).toBeVisible();

  // Replace drops the later plan; «Undo» brings it back.
  await page.getByRole('button', { name: 'Plan importieren' }).click();
  await page.locator('input[type=file][accept*=json]').setInputFiles(file);
  await page.getByRole('button', { name: 'Alles ersetzen' }).click();
  await expect(page.getByText('Sicherung wiederhergestellt')).toBeVisible();
  await expect(page.getByRole('button', { name: /E2E Später/ })).toBeHidden();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Import rückgängig gemacht')).toBeVisible();
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await page.getByRole('link', { name: 'Pläne' }).click();
  await expect(page.getByRole('button', { name: /E2E Später/ })).toBeVisible();
});

test('export one plan with its workouts as a code and merge it', async ({ page }) => {
  // With the history switch on, the export is a backup of the chosen plans.
  await createPlan(page, 'E2E Verlauf');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('link', { name: 'Einstellungen' }).click();

  await page.getByRole('button', { name: 'Exportieren' }).click();
  await page.getByRole('radio', { name: 'Auswählen' }).click();
  await page.getByRole('checkbox', { name: 'E2E Verlauf' }).click();
  await page.getByRole('switch', { name: 'Notizen' }).click();
  const code = page.getByRole('textbox', { name: 'Code', exact: true });
  await expect(code).toHaveValue(/^GRYND1:/);
  const text = await code.inputValue();
  await page.keyboard.press('Escape');

  // A partial export with history can only be merged.
  await page.getByRole('button', { name: 'Importieren' }).click();
  await page.getByRole('textbox', { name: 'Code oder Text einfügen' }).fill(text);
  await page.getByRole('button', { name: 'Importieren', exact: true }).click();
  await expect(
    page.getByText(/Ein Teil-Export wird mit deinen Daten zusammengeführt/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alles ersetzen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zusammenführen' }).click();
  await expect(page.getByText('Sicherung zusammengeführt')).toBeVisible();
});
