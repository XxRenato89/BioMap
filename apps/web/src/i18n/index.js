import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

/**
 * Textos de la interfaz en español e inglés. El contenido de los puntos viene
 * de la API y está solo en español. La carga es síncrona: los textos van
 * dentro del bundle, sin pedir nada a la red.
 */
i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'es',
  fallbackLng: 'es',
  initAsync: false,
  interpolation: { escapeValue: false },
});

/**
 * Nombre de una capa en el idioma activo. En español se usa el nombre de la
 * base de datos; en inglés, la traducción conocida de su slug, si existe.
 *
 * @param {(key: string, options?: object) => string} t
 * @param {{ slug: string, name: string }} layer
 */
export function layerName(t, layer) {
  return t(`layerNames.${layer.slug}`, { defaultValue: layer.name });
}

export default i18n;
