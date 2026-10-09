import { Hand } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

/**
 * Pantalla del modo atracción: el mapa recorre el territorio solo y una
 * invitación grande llama a tocar. Toda la pantalla es un botón: el primer
 * toque detiene el recorrido y deja el visor listo para explorar.
 *
 * @param {{ stopName: string | null, onExplore: () => void }} props
 */
export default function AttractOverlay({ stopName, onExplore }) {
  const { t } = useTranslation();
  return (
    <motion.button
      type="button"
      className="attract"
      onClick={onExplore}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <span className="attract__brand">BioMap</span>
      {stopName && (
        <motion.span
          key={stopName}
          className="attract__stop glass-dark"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {stopName}
        </motion.span>
      )}
      <span className="attract__cta">
        <span className="attract__hand" aria-hidden="true">
          <Hand size={56} strokeWidth={2} />
        </span>
        <span className="attract__title">{t('attract.cta')}</span>
        <span className="attract__sub">{t('attract.sub')}</span>
      </span>
    </motion.button>
  );
}
