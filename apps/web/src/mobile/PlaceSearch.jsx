import { ArrowLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPoiIcon } from '../map/poiIcon.jsx';

const ACCENTS = new RegExp('[̀-ͯ]', 'g');
/* Sin tildes ni mayúsculas, para que «playa» encuentre «Playa». */
const plain = (text) => text.normalize('NFD').replace(ACCENTS, '').toLowerCase();

/**
 * Buscador a pantalla completa: escribe y toca un lugar para verlo en el mapa.
 *
 * @param {{ features: Array<object>, layers: Map<number, object>,
 *   onPick: (id: number) => void, onClose: () => void }} props
 */
export default function PlaceSearch({ features, layers, onPick, onClose }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const q = plain(query.trim());
    return features.filter((feature) => !q || plain(feature.properties.name).includes(q));
  }, [features, query]);

  return (
    <section
      className="absolute inset-0 z-40 flex flex-col bg-cream text-forest"
      role="dialog"
      aria-label={t('search.label')}
    >
      <div className="flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl border-0 bg-transparent text-forest"
          aria-label={t('settings.close')}
          onClick={onClose}
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-forest/8 px-4">
          <Search size={20} aria-hidden="true" className="flex-none" />
          <input
            ref={input}
            type="search"
            className="min-w-0 flex-1 border-0 bg-transparent text-lg text-forest outline-none placeholder:text-muted"
            placeholder={t('search.placeholder')}
            aria-label={t('search.label')}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <ul className="m-0 flex-1 list-none overflow-y-auto p-2">
        {results.length === 0 ? (
          <li className="p-4 text-lg text-muted">{t('search.none')}</li>
        ) : (
          results.map((feature) => (
            <li key={feature.properties.id}>
              <button
                type="button"
                className="flex min-h-16 w-full items-center gap-4 rounded-2xl border-0 bg-transparent px-3 text-left text-lg font-bold text-forest"
                onClick={() => onPick(feature.properties.id)}
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-forest-light/12">
                  {getPoiIcon(layers.get(feature.properties.layerId), feature.properties.name, 22)}
                </span>
                {feature.properties.name}
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
