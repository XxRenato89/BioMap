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
  await expect(page.getByRole('textbox', { name: 'Buscar un lugar' })).toBeVisible();
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

test('opens BioMap Mobile with a QR code and closes it', async ({ page }) => {
  await page.getByRole('button', { name: /BioMap Mobile/ }).click();
  const panel = page.getByRole('dialog', { name: 'Llévate el mapa en tu celular' });
  await expect(panel.getByRole('img', { name: /Código QR/ }).locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(panel).toBeHidden();
});

test('finds a place with the search box and walks to it', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Buscar un lugar' }).fill('central');
  await page
    .getByRole('button', { name: /Central Hidroeléctrica Angostura/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Saltar caminata' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Central Hidroeléctrica Angostura' }),
  ).toBeVisible();
});

test('switches to English and to high contrast from the settings', async ({ page }) => {
  await page.getByRole('button', { name: /Ajustes/ }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-contrast', 'high');
});

test('shows the valley before 2014 with the epoch selector, and goes back to today', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Época/ }).click();
  await page.getByRole('button', { name: /2000/ }).click();
  await expect(page.getByText(/Reconstrucción ilustrativa/)).toBeVisible();
  await page.getByRole('button', { name: /Hoy/ }).click();
  await expect(page.getByText(/Reconstrucción ilustrativa/)).toBeHidden();
});
