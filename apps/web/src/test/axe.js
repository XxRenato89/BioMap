import axe from 'axe-core';

/**
 * Revisa la accesibilidad (WCAG 2.1 A y AA) de un elemento renderizado y
 * devuelve las reglas que fallan. El contraste de color no se puede medir en
 * jsdom (no calcula estilos reales), así que se revisa a mano en el navegador.
 *
 * @param {Element} container
 * @returns {Promise<string[]>}
 */
export async function axeViolations(container) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
