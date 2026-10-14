import { expect, test } from '@playwright/test';

/*
 * Flujos completos del visitante en el kiosco, contra la API de prueba
 * (mismos datos que las semillas: el recorrido empieza en la Central).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  /* La pantalla de carga desaparece cuando la maqueta está lista. */
  await expect(page.getByText('Preparando la maqueta del Biobío…')).toBeHidden({ timeout: 90_000 });
});

test('shows the map with its tour and the guided-tour lock', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'BioMap' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Central Hidroeléctrica Angostura' }),
  ).toBeEnabled();
  /* La segunda parada está bloqueada hasta visitar la primera. */
  await expect(page.getByRole('button', { name: 'Parque Angostura' })).toBeDisabled();
});

test('walks to a place, opens its sheet and moves on to the next stop', async ({ page }) => {
  await page.getByRole('button', { name: 'Central Hidroeléctrica Angostura' }).click();
  await page.getByRole('button', { name: 'Saltar caminata' }).click();

  const sheet = page.getByRole('dialog', { name: 'Central Hidroeléctrica Angostura' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Parada 1 de 4')).toBeVisible();
  await expect(sheet.getByText(/Fotografía: Marcelo A Contreras/)).toBeVisible();

  await sheet.getByRole('button', { name: /Seguir a Parque Angostura/ }).click();
  await page.getByRole('button', { name: 'Saltar caminata' }).click();
  await expect(page.getByRole('dialog', { name: 'Parque Angostura' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Tu recorrido' })).toHaveAttribute(
    'aria-valuenow',
    '2',
  );
});

test('opens the Bio-Book in place with a QR code and closes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir Bio-Book' }).click();
  const book = page.getByRole('dialog', { name: 'Llévate el mapa vivo' });
  await expect(book.getByRole('img', { name: /Código QR/ }).locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar libro' }).click();
  await expect(book).toBeHidden();
});

test('switches to English and to high contrast', async ({ page }) => {
  await page.getByRole('button', { name: 'Change language to English' }).click();
  await expect(page.getByText('Living Map of the Biobío')).toBeVisible();
  await page.getByRole('button', { name: /Contrast/ }).click();
  await expect(page.locator('main')).toHaveAttribute('data-contrast', 'high');
});

test('drains the reservoir to show the valley before 2014, and fills it again', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Bajo el embalse' }).click();
  await expect(page.getByRole('heading', { name: 'El valle que cubre el embalse' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a llenar' }).click();
  await expect(page.getByRole('heading', { name: 'El valle que cubre el embalse' })).toBeHidden();
});
