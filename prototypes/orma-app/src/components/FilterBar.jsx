import { ChevronDown, Dog, Mountain, Search, SlidersHorizontal } from 'lucide-react';
import { DOG } from '../data/trails.js';

function DropdownButton({ icon: Icon, children, emphasis = false }) {
  return (
    <button
      type="button"
      className={
        'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ' +
        (emphasis
          ? 'border-alpine/20 bg-alpine/5 text-alpine hover:bg-alpine/10'
          : 'border-gray-200 bg-white text-alpine hover:border-alpine/30 hover:bg-paper')
      }
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="truncate">{children}</span>
      <ChevronDown className="size-3.5 text-alpine/50" aria-hidden="true" />
    </button>
  );
}

export default function FilterBar() {
  return (
    <div className="flex h-[50px] shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-6">
      <DropdownButton icon={Dog} emphasis>
        Adapted for: {DOG.name} <span className="hidden font-normal text-alpine/60 xl:inline">({DOG.breed})</span>
      </DropdownButton>

      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-alpine/40" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search region or route…"
          className="w-full rounded-lg border border-gray-200 bg-paper py-1.5 pl-9 pr-3 text-[13.5px] text-alpine placeholder:text-alpine/45 focus:border-alpine/40 focus:outline-none focus:ring-2 focus:ring-alpine/15"
        />
      </label>

      <div className="hidden items-center gap-2 sm:flex">
        <DropdownButton icon={Mountain}>Region: Dolomites</DropdownButton>
        <DropdownButton icon={SlidersHorizontal}>Filters</DropdownButton>
      </div>
    </div>
  );
}
