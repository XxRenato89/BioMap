import { Images, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageGallery from '../../components/ImageGallery.jsx';
import LayerShape from '../../components/LayerShape.jsx';
import { usePointDetail } from '../../hooks/useApi.js';
import { layerName } from '../../i18n/index.js';
import PanoramaViewer from './PanoramaViewer.jsx';

const NO_IMAGES = [];

/**
 * Ficha de un punto, al lado de su pin en la maqueta: capa, nombre, fotos,
 * panorama 360° y descripción, con una cola que apunta al pin. La cámara ya
 * voló al punto; al cerrar la ficha vuelve a la vista general. En el
 * teléfono sube desde abajo, a todo el ancho.
 *
 * @param {{ feature: object, layer: { color: string, slug: string, name: string },
 *   onClose: () => void, ref?: import('react').Ref<HTMLElement>,
 *   placement?: { left: number, top: number, side: string, tail: { left: number, top: number } } | null }} props
 */
export default function PointSheet({ feature, layer, onClose, ref, placement = null }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('photos');
  const [photo, setPhoto] = useState(0);
  const detail = usePointDetail(feature.properties.id);
  const images = detail.data?.properties.images ?? NO_IMAGES;
  const photos = images.filter((image) => image.kind !== 'panorama');
  const panorama = images.find((image) => image.kind === 'panorama');
  const { name } = feature.properties;

  let description = detail.data?.properties.description;
  if (detail.isPending) description = t('card.loading');
  else if (detail.isError) description = t('card.error');
  const credit = tab === 'photos' ? photos[photo]?.credit : null;

  return (
    <motion.section
      ref={ref}
      className="point-sheet"
      role="dialog"
      aria-labelledby={`point-sheet-title-${feature.properties.id}`}
      data-side={placement?.side}
      data-placed={placement ? 'true' : undefined}
      style={{
        '--layer-color': layer.color,
        left: placement?.left,
        top: placement?.top,
      }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
    >
      {placement && (
        <span
          className="point-sheet__tail"
          style={{ left: placement.tail.left, top: placement.tail.top }}
          aria-hidden="true"
        />
      )}
      <header className="point-sheet__bar">
        <span className="layer-chip">
          <LayerShape layer={layer} size="sm" />
          {layerName(t, layer)}
        </span>
        <button
          type="button"
          className="point-sheet__close"
          aria-label={t('card.close', { name })}
          onClick={onClose}
        >
          <X size={28} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </header>

      <div className="point-sheet__stage">
        {tab === 'photos' && <ImageGallery images={photos} onSelect={setPhoto} />}
        {tab === '360' && panorama && (
          <PanoramaViewer url={panorama.url} label={t('sheet.panorama', { name })} />
        )}
      </div>

      {panorama && (
        <div className="point-sheet__tabs" role="group" aria-label={name}>
          <button type="button" aria-pressed={tab === 'photos'} onClick={() => setTab('photos')}>
            <Images size={22} strokeWidth={2.2} aria-hidden="true" />
            {t('sheet.tabPhotos')} ({photos.length})
          </button>
          <button type="button" aria-pressed={tab === '360'} onClick={() => setTab('360')}>
            {t('sheet.tab360')}
          </button>
        </div>
      )}

      <div className="point-sheet__info">
        <h2 id={`point-sheet-title-${feature.properties.id}`}>{name}</h2>
        <p className="point-sheet__description">{description}</p>
        {credit && <p className="point-sheet__credit">{t('card.credit', { credit })}</p>}
      </div>
    </motion.section>
  );
}
