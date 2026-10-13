import { useTranslation } from 'react-i18next';
import TourProgress from './TourProgress.jsx';

/**
 * Título del visor, instrucción breve y progreso de la ruta turística.
 */
export default function HeaderCard() {
  const { t } = useTranslation();
  return (
    <header className="glass-dark rounded-3xl p-6 shadow-panel">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-white leading-none">
        BioMap
      </h1>
      <p className="mt-1.5 text-lg font-medium text-mint">{t('header.subtitle')}</p>
      <hr className="my-3.5 h-px border-0 bg-white/15" />
      <p className="text-base leading-relaxed text-[#e8f1eb]">{t('header.hint')}</p>
      <TourProgress />
    </header>
  );
}
