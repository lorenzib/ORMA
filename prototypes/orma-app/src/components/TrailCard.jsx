import { AlertTriangle, Clock, Droplets, Globe, Mountain, PawPrint, Ruler, ShieldCheck, Star, Trees } from 'lucide-react';

function matchTone(match) {
  if (match > 80) return 'bg-green-100 text-green-800';
  if (match >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function Stat({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-alpine/70">
      <Icon className="size-3.5 shrink-0 text-alpine/50" aria-hidden="true" />
      {children}
    </span>
  );
}

export default function TrailCard({ trail }) {
  const { name, match, distanceKm, climbM, time, shadePct, waterPoints, surface, source } = trail;

  return (
    <article className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
      {/* Name + match */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15.5px] font-bold leading-snug text-alpine">{name}</h3>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${matchTone(match)}`}
        >
          <Star className="size-3 fill-current" aria-hidden="true" />
          {match}% MATCH
        </span>
      </div>

      {/* Core numbers */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Stat icon={Ruler}>{distanceKm} km</Stat>
        <Stat icon={Mountain}>{climbM} m climb</Stat>
        <Stat icon={Clock}>{time}</Stat>
      </div>

      {/* K9 conditions */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Stat icon={Trees}>{shadePct}% shade</Stat>
        <Stat icon={Droplets}>{waterPoints} water point{waterPoints === 1 ? '' : 's'}</Stat>
      </div>

      {/* Surface verdict */}
      <p
        className={
          'mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold ' +
          (surface.risky ? 'text-trail' : 'text-alpine/80')
        }
      >
        {surface.risky ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <PawPrint className="size-4 shrink-0 text-alpine/50" aria-hidden="true" />
        )}
        Surface: {surface.label}
      </p>

      {/* Data provenance */}
      <div className="mt-3">
        {source === 'verified' ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-alpine px-2.5 py-1 text-[10.5px] font-bold tracking-wider text-white">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            VERIFIED BY ORMA
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-alpine/30 px-2.5 py-1 text-[10.5px] font-bold tracking-wider text-alpine/70">
            <Globe className="size-3.5" aria-hidden="true" />
            IMPORTED DATA
          </span>
        )}
      </div>
    </article>
  );
}
