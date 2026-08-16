import { useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import FilterBar from './components/FilterBar.jsx';
import MapArea from './components/MapArea.jsx';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [sort, setSort] = useState('Match %');

  const handleToggleMap = useMemo(() => () => setMapCollapsed((v) => !v), []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper font-sans text-alpine antialiased">
      <Header />
      <FilterBar />

      {/* Main workspace: 100vh − 60px header − 50px filter bar */}
      <main className="flex min-h-0 flex-1">
        {!mapCollapsed && <MapArea />}
        <Sidebar
          mapCollapsed={mapCollapsed}
          onToggleMap={handleToggleMap}
          sort={sort}
          onSort={setSort}
        />
      </main>
    </div>
  );
}
