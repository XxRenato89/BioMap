import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Galería deslizable de las fotos de un punto. Sin fotos muestra un fondo
 * neutro. Informa qué foto está a la vista para mostrar su crédito.
 *
 * @param {{ images: Array<{ url: string, altText: string, credit: string }>,
 *   onSelect?: (index: number) => void, children?: import('react').ReactNode }} props
 */
export default function ImageGallery({ images, onSelect, children }) {
  const { t } = useTranslation();
  const [viewportRef, embla] = useEmblaCarousel({ loop: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!embla) return undefined;
    const update = () => {
      setIndex(embla.selectedScrollSnap());
      onSelect?.(embla.selectedScrollSnap());
    };
    embla.on('select', update);
    return () => {
      embla.off('select', update);
    };
  }, [embla, onSelect]);

  const previous = useCallback(() => embla?.scrollPrev(), [embla]);
  const next = useCallback(() => embla?.scrollNext(), [embla]);

  if (images.length === 0) {
    return (
      <div className="gallery gallery--empty">
        <span className="gallery__placeholder">{t('card.noPhoto')}</span>
        {children}
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery__viewport" ref={viewportRef}>
        <div className="gallery__track">
          {images.map((image) => (
            <img key={image.url} className="gallery__slide" src={image.url} alt={image.altText} />
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="gallery__nav gallery__nav--prev"
            aria-label={t('card.prevPhoto')}
            disabled={index === 0}
            onClick={previous}
          >
            <ChevronLeft size={28} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="gallery__nav gallery__nav--next"
            aria-label={t('card.nextPhoto')}
            disabled={index === images.length - 1}
            onClick={next}
          >
            <ChevronRight size={28} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <span className="gallery__counter">
            {t('card.photoOf', { n: index + 1, total: images.length })}
          </span>
        </>
      )}
      {children}
    </div>
  );
}
