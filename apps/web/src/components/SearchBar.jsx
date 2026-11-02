import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPoiIcon } from '../map/poiIcon.jsx';

/* Sin tildes ni mayúsculas, para que «playa» encuentre «Playa». */
const ACCENTS = new RegExp('[\u0300-\u036f]', 'g');
const plain = (text) => text.normalize('NFD').replace(ACCENTS, '').toLowerCase();

/**
 * Nombre del proyecto y buscador de lugares: al elegir uno, la mascota camina
 * hasta él. En el kiosco el teclado es el de pantalla del sistema.
 *
 * @param {{ points: Array<object>, onPick: (id: number) => void }} props
 */
export default function SearchBar({ points, onPick }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const results = useMemo(() => {
    const q = plain(query.trim());
    return points.filter((feature) => !q || plain(feature.properties.name).includes(q)).slice(0, 6);
  }, [points, query]);

  const pick = (id) => {
    setOpen(false);
    setQuery('');
    onPick(id);
  };

  return (
    <div className="relative w-[500px]" data-obstacle>
      <div className="panel flex h-[60px] items-center gap-3 rounded-[30px] px-6">
        <span className="font-display font-extrabold text-xl tracking-wide">BioMap</span>
        <span className="h-7 w-px bg-forest/20" aria-hidden="true" />
        <Search size={24} aria-hidden="true" className="flex-none" />
        <input
          type="text"
          className="min-w-0 flex-1 border-0 bg-transparent text-[length:var(--fs-button)] text-forest outline-none placeholder:text-muted"
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          aria-controls={listId}
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open && (
        <ul
          id={listId}
          className="panel absolute left-0 top-[68px] z-30 m-0 w-full list-none rounded-3xl p-2"
        >
          {results.length === 0 ? (
            <li className="p-4 text-lg text-muted">{t('search.none')}</li>
          ) : (
            results.map((feature) => (
              <li key={feature.properties.id}>
                <button
                  type="button"
                  className="flex h-[60px] w-full items-center gap-3.5 rounded-2xl border-0 bg-transparent px-4 text-left text-[length:var(--fs-button)] font-bold text-forest hover:bg-forest-light/10"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(feature.properties.id)}
                >
                  {getPoiIcon(null, feature.properties.name, 24)}
                  {feature.properties.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
