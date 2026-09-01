const fs = require('fs');
const path = require('path');
const vm = require('vm');
const icons = require('./icon-system.js');

function loadBrowserScript(filename, overrides = {}){
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Promise,
    module: {},
    exports: {},
    maplibregl: {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: {
      body: { classList: { toggle: jest.fn(), contains: jest.fn(() => false) } },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({
        style: {},
        className: '',
        textContent: '',
        innerHTML: '',
        hidden: false,
        appendChild: () => {},
        addEventListener: () => {},
        setAttribute: () => {},
      }),
      addEventListener: () => {},
    },
    fetch: jest.fn(),
    registerPoiFeatures: jest.fn(),
    t: (key) => key,
    location: { search: '' },
    matchMedia: jest.fn(() => ({ matches: false })),
    window: null,
    globalThis: null,
    ...overrides,
  };
  context.window = context;
  context.globalThis = context;
  context.window.addEventListener = jest.fn();
  context.window.DoloPawsIcons = overrides.DoloPawsIcons;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, filename), 'utf8'), context);
  return context;
}

function createMapMock(){
  const layers = [];
  const sources = {};
  return {
    layers,
    sources,
    addLayer: jest.fn((layer) => {
      layers.push(layer);
    }),
    addSource: jest.fn((id, source) => { sources[id] = source; }),
    getLayer: jest.fn((id) => layers.find((layer) => layer.id === id) || null),
    getSource: jest.fn(() => ({
      getClusterExpansionZoom: jest.fn(() => Promise.resolve(13)),
    })),
    getCanvas: jest.fn(() => ({ style: {} })),
    on: jest.fn(),
    off: jest.fn(),
    easeTo: jest.fn(),
    querySourceFeatures: jest.fn(() => []),
  };
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('shared map icon layers', () => {
  test('homepage water source layers switch to symbol icons at high zoom', () => {
    const context = loadBrowserScript('script.js', { DoloPawsIcons: icons });
    const map = createMapMock();

    context.addWaterSourcesLayers(map);

    expect(map.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'water-sources-layer-lowzoom',
        type: 'circle',
        maxzoom: icons.ICON_MIN_ZOOM,
      }),
      expect.objectContaining({
        id: 'water-sources-layer',
        type: 'symbol',
        minzoom: icons.ICON_MIN_ZOOM,
        layout: expect.objectContaining({
          'icon-image': icons.getPoiMapIconExpression('water'),
        }),
      }),
    ]));
  });

  test('detail POIs reuse shared icon expressions for high-zoom symbol layers', async () => {
    const context = loadBrowserScript('detail-pois.js', {
      DoloPawsIcons: icons,
      fetch: jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            features: [
              { geometry: { type: 'Point', coordinates: [12.01, 46.01] }, properties: { tourism: 'alpine_hut' } },
              { geometry: { type: 'Point', coordinates: [12.02, 46.02] }, properties: { amenity: 'bar' } },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            features: [
              { geometry: { type: 'Point', coordinates: [12.015, 46.015] }, properties: { amenity: 'drinking_water' } },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            features: [
              { geometry: { type: 'Point', coordinates: [12.012, 46.012] }, properties: { '@id': 'node/1', kind: 'viewpoint', tourism: 'viewpoint' } },
              { geometry: { type: 'Point', coordinates: [12.013, 46.013] }, properties: { '@id': 'node/2', kind: 'sight', historic: 'memorial' } },
            ],
          }),
        }),
      maplibregl: {
        Popup: function Popup(){
          return {
            setLngLat(){ return this; },
            setHTML(){ return this; },
            addTo(){ return this; },
          };
        },
      },
    });
    const map = createMapMock();
    map.getSource = jest.fn(() => null);

    context.initDetailPois(map, { lat: 46.01, lng: 12.01, path: [[46.01, 12.01], [46.02, 12.02]] });
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(map.layers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'detail-huts-layer',
        type: 'symbol',
        minzoom: icons.ICON_MIN_ZOOM,
        layout: expect.objectContaining({
          visibility: 'visible',
          'icon-image': icons.getPoiMapIconExpression('huts'),
        }),
      }),
      expect.objectContaining({
        id: 'detail-bars-layer',
        type: 'symbol',
        minzoom: icons.ICON_MIN_ZOOM,
        layout: expect.objectContaining({
          visibility: 'visible',
          'icon-image': icons.getPoiMapIconExpression('food'),
        }),
      }),
      expect.objectContaining({
        id: 'detail-water-layer',
        type: 'symbol',
        minzoom: icons.ICON_MIN_ZOOM,
        layout: expect.objectContaining({
          visibility: 'visible',
          'icon-image': icons.getPoiMapIconExpression('water'),
        }),
      }),
      expect.objectContaining({
        id: 'detail-places-layer',
        type: 'symbol',
        minzoom: icons.ICON_MIN_ZOOM,
        layout: expect.objectContaining({
          visibility: 'visible',
          'icon-image': icons.getPoiMapIconExpression('places'),
        }),
      }),
    ]));
    expect(Object.values(map.sources)).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ cluster: true }),
    ]));
    expect(map.layers.some(layer => layer.id.endsWith('-cluster'))).toBe(false);
    expect(map.layers.some(layer => layer.id.endsWith('-cluster-count'))).toBe(false);
    expect(map.sources['detail-places'].data.features).toHaveLength(1);
    expect(map.sources['detail-places'].data.features[0].properties.kind).toBe('viewpoint');
    expect(fs.readFileSync(path.join(__dirname, 'basemap-poi-click.js'), 'utf8'))
      .toContain('!isHistoricPoi(f.properties)');
  });
});
