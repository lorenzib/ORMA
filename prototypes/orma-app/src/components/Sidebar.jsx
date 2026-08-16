import { Columns2 } from 'lucide-react';
import { DOG, TRAILS } from '../data/trails.js';
import TrailCard from './TrailCard.jsx';

const SORTS = ['Match %', 'Shortest', 'Shade'];

export default function Sidebar({ mapCollapsed, onToggleMap, sort, onSort }) {
  return (
    <aside
      className={
        'flex shrink-0 flex-col overflow-y-auto bg-paper ' +
        (mapCollapsed ? 'flex-1' : 'w-full max-w-[420px] border-l border-gray-200')
      }
      aria-label={`Trails ranked for ${DOG.name}`}
    >
      <div className="sticky top-0 z-[5] border-b border-gray-200/80 bg-paper/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold text-alpine">Ranked for {DOG.name}</h2>
          <button
            type="button"
            onClick={onToggleMap}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-alpine/70 transition hover:bg-alpine/5 hover:text-alpine"
          >
            <Columns2 className="size-4" aria-hidden="true" />
            {mapCollapsed ? 'Show Map' : 'Collapse Map'}
          </button>
        </div>

        <div className="mt-2.5 flex gap-1.5" role="group" aria-label="Sort trails">
          {SORTS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onSort(label)}
              aria-pressed={sort === label}
              className={
                'rounded-full px-3 py-1 text-[12px] font-semibold transition ' +
                (sort === label
                  ? 'bg-alpine text-white'
                  : 'bg-white text-alpine/70 ring-1 ring-gray-200 hover:ring-alpine/30')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={
          'grid gap-3 p-4 ' + (mapCollapsed ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1')
        }
      >
        {TRAILS.map((trail) => (
          <TrailCard key={trail.id} trail={trail} />
        ))}
      </div>
    </aside>
  );
}
