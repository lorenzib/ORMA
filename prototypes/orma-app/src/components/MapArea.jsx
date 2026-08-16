import { PawPrint, Satellite } from 'lucide-react';

// Mock cluster positions, % of the map canvas.
const CLUSTERS = [
  { id: 1, count: 12, top: '26%', left: '32%' },
  { id: 2, count: 7, top: '48%', left: '58%' },
  { id: 3, count: 23, top: '64%', left: '24%' },
  { id: 4, count: 4, top: '30%', left: '74%' },
];

function ClusterMarker({ count, top, left }) {
  return (
    <button
      type="button"
      aria-label={`${count} trails in this area`}
      className="absolute z-[5] flex size-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-alpine text-white shadow-lg ring-4 ring-alpine/20 transition hover:scale-105"
      style={{ top, left }}
    >
      <PawPrint className="size-3.5" aria-hidden="true" />
      <span className="text-[11px] font-bold leading-none">{count}</span>
    </button>
  );
}

export default function MapArea() {
  return (
    <section aria-label="Trail map" className="relative min-w-0 flex-1 overflow-hidden">
      {/* Map canvas placeholder: parchment with a subtle survey grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#EDEAE3',
          backgroundImage:
            'linear-gradient(rgba(44,58,53,0.06) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(44,58,53,0.06) 1px, transparent 1px), ' +
            'linear-gradient(rgba(44,58,53,0.03) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(44,58,53,0.03) 1px, transparent 1px)',
          backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px',
        }}
      />

      {CLUSTERS.map((c) => (
        <ClusterMarker key={c.id} {...c} />
      ))}

      {/* Record FAB — the one orange element on the canvas */}
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
        <button
          type="button"
          className="flex items-center gap-3 rounded-full bg-trail px-6 py-3.5 text-white shadow-xl shadow-trail/30 transition hover:brightness-105 active:scale-[.98]"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          <span className="text-[14px] font-extrabold tracking-wide">RECORD WALK</span>
          <span className="h-4 w-px bg-white/40" aria-hidden="true" />
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-white/90">
            <Satellite className="size-4" aria-hidden="true" />
            Live GPS &amp; Safety
          </span>
        </button>
      </div>
    </section>
  );
}
