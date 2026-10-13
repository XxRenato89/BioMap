import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Galería fotográfica deslizable con soporte para:
 * - Botón flotante de cierre (X) en esquina superior derecha
 * - Badge/botón flotante 360° en esquina inferior izquierda
 * - Indicadores de puntos (● ○ ○) en centro inferior
 * - Contador numérico (1/3) en esquina inferior derecha
 * - Navegación externa mediante índice seleccionado (desde miniaturas)
 *
 * @param {{
 *   images: Array<{ url: string, altText: string, credit: string }>,
 *   selectedIndex?: number,
 *   onSelect?: (index: number) => void,
 *   has360?: boolean,
 *   onToggle360?: () => void,
 *   onClose?: () => void,
 *   children?: import('react').ReactNode
 * }} props
 */
export default function ImageGallery({
  images,
  selectedIndex = 0,
  onSelect,
  has360 = false,
  onToggle360,
  onClose,
  onImageError,
  children,
}) {
  const { t } = useTranslation();
  const [viewportRef, embla] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!embla) return undefined;
    const update = () => {
      const current = embla.selectedScrollSnap();
      setIndex(current);
      onSelect?.(current);
    };
    embla.on('select', update);
    return () => {
      embla.off('select', update);
    };
  }, [embla, onSelect]);

  // Si el padre cambia la foto activa (ej: al hacer clic en una miniatura)
  useEffect(() => {
    if (embla && typeof selectedIndex === 'number' && selectedIndex !== index) {
      embla.scrollTo(selectedIndex);
      setIndex(selectedIndex);
    }
  }, [selectedIndex, embla]);

  const previous = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  if (images.length === 0) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-[#1c2a22] text-[#8ea597] text-sm select-none">
        {onClose && (
          <button
            type="button"
            className="absolute top-3 right-3 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 hover:bg-black/70 transition cursor-pointer"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        )}
        <span className="font-medium">{t('card.noPhoto')}</span>
        {children}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none group">
      {/* Botón flotante de cerrar en la esquina superior derecha del hero */}
      {onClose && (
        <button
          type="button"
          className="absolute top-3 right-3 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/20 hover:bg-black/75 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
          onClick={onClose}
          aria-label="Cerrar ficha"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
      )}

      {/* Contenedor carrusel Embla */}
      <div className="overflow-hidden w-full h-full" ref={viewportRef}>
        <div className="flex h-full touch-pan-y">
          {images.map((image, idx) => (
            <img
              key={image.url || idx}
              className="flex-[0_0_100%] min-w-0 h-full object-cover"
              src={image.url}
              alt={image.altText || `Fotografía ${idx + 1}`}
              onError={() => onImageError?.(image.url)}
            />
          ))}
        </div>
      </div>

      {/* Crédito de la foto (las de licencia abierta lo exigen). */}
      {images[index]?.credit && (
        <span className="absolute top-3 left-3 z-10 max-w-[70%] truncate px-2.5 py-1 rounded-md bg-black/55 text-white text-xs pointer-events-none">
          {t('card.credit', { credit: images[index].credit })}
        </span>
      )}

      {/* Flechas de navegación para desktop/touch */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-black/60 transition disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
            aria-label={t('card.prevPhoto')}
            disabled={index === 0}
            onClick={previous}
          >
            <ChevronLeft size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/20 hover:bg-black/60 transition disabled:opacity-0 disabled:pointer-events-none cursor-pointer"
            aria-label={t('card.nextPhoto')}
            disabled={index === images.length - 1}
            onClick={next}
          >
            <ChevronRight size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
        </>
      )}

      {/* Barra inferior flotante sobre la imagen: 360° | Dots ● ○ ○ | Contador 1/3 */}
      <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Esquina inferior izquierda: Botón 360° */}
        <div className="pointer-events-auto">
          {has360 ? (
            <button
              type="button"
              onClick={onToggle360}
              className="px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/25 text-white text-xs font-black tracking-wider transition-all cursor-pointer shadow-md"
              title="Ver en 360°"
            >
              360°
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Centro inferior: Dots indicadores ● ○ ○ */}
        {images.length > 1 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/15 pointer-events-auto">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => embla?.scrollTo(i)}
                className={`transition-all rounded-full cursor-pointer border-0 p-0 ${
                  i === index
                    ? 'w-2 h-2 bg-white scale-110 shadow-sm'
                    : 'w-1.5 h-1.5 bg-white/45 hover:bg-white/70'
                }`}
                aria-label={`Ir a foto ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Esquina inferior derecha: Contador 1/3 */}
        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-extrabold tracking-wide border border-white/20 shadow-md pointer-events-auto">
          {index + 1}/{images.length}
        </span>
      </div>

      {children}
    </div>
  );
}
