import { Bell, PawPrint } from 'lucide-react';

const NAV_LINKS = ['Browse Trails', 'Collections', 'Safety Guide', 'My Journal'];

export default function Header() {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between bg-alpine px-4 text-white lg:px-6">
      <a href="#" className="flex items-center gap-3">
        {/* Logo placeholder — swap for the real ORMA tile */}
        <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
          <PawPrint className="size-5 text-paper" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-bold tracking-wide">
          ORMA
          <span className="mx-2 font-normal text-white/40">|</span>
          <span className="hidden text-[13px] font-medium text-white/80 sm:inline">
            Dog Trails &amp; Terrain Guide
          </span>
        </span>
      </a>

      <nav className="flex items-center gap-1 lg:gap-2" aria-label="Primary">
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative ml-1 rounded-full p-2 transition hover:bg-white/10"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-trail ring-2 ring-alpine" />
        </button>

        <button
          type="button"
          aria-label="Your profile"
          className="ml-1 flex size-9 items-center justify-center rounded-full bg-paper text-[13px] font-bold text-alpine ring-2 ring-white/25"
        >
          E
        </button>
      </nav>
    </header>
  );
}
