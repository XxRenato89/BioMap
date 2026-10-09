import { useTranslation } from 'react-i18next';

/**
 * Título del visor e instrucción breve para el visitante.
 */
export default function HeaderCard() {
  const { t } = useTranslation();
  return (
    <header className="panel glass-dark header-card">
      <h1>BioMap</h1>
      <p className="header-card__subtitle">{t('header.subtitle')}</p>
      <hr />
      <p className="header-card__hint">{t('header.hint')}</p>
    </header>
  );
}
