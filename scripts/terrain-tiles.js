'use strict';

// Ground heights from the AWS Terrain Tiles (Terrarium PNG encoding), an open
// dataset on the Registry of Open Data on AWS. In Europe its heights come from
// EU-DEM; the attribution is in TERRAIN_SOURCE. Tiles are cached on disk
// (~/.cache/orma/terrain-tiles), so a rebuild downloads nothing it has.
//
// Zoom 11 is about 53 m a pixel at the Alps' latitude: fine enough for a
// skyline read over kilometres, and about 140 kB a tile.

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const ZOOM = 11;
const TILE_SIZE = 256;
const TILE_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const TERRAIN_SOURCE = {
  label: 'AWS Terrain Tiles (EU-DEM, produced using Copernicus data)',
  url: 'https://registry.opendata.aws/terrain-tiles/',
};
const CACHE_DIR = path.join(os.homedir(), '.cache', 'orma', 'terrain-tiles');

// An 8-bit RGB or RGBA, non-interlaced PNG to its pixel bytes and channels.
function decodePng(buffer){
  const signature = '89504e470d0a1a0a';
  if(buffer.subarray(0, 8).toString('hex') !== signature) throw new Error('Not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while(offset < buffer.length){
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if(type === 'IHDR'){
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colour = data[9];
      if(depth !== 8 || data[12] !== 0 || !(colour === 2 || colour === 6)) throw new Error('Unsupported PNG layout');
      channels = colour === 2 ? 3 : 4;
    } else if(type === 'IDAT'){
      idat.push(data);
    } else if(type === 'IEND'){
      break;
    }
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for(let row = 0; row < height; row += 1){
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const out = pixels.subarray(row * stride, (row + 1) * stride);
    const prev = row ? pixels.subarray((row - 1) * stride, row * stride) : null;
    for(let i = 0; i < stride; i += 1){
      const left = i >= channels ? out[i - channels] : 0;
      const up = prev ? prev[i] : 0;
      const upLeft = prev && i >= channels ? prev[i - channels] : 0;
      let value = line[i];
      if(filter === 1) value += left;
      else if(filter === 2) value += up;
      else if(filter === 3) value += (left + up) >> 1;
      else if(filter === 4){
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if(filter !== 0) throw new Error(`Unknown PNG filter ${filter}`);
      out[i] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

// Terrarium heights in metres, row by row.
function terrariumHeights(png){
  const heights = new Float32Array(png.width * png.height);
  for(let i = 0; i < heights.length; i += 1){
    const p = i * png.channels;
    heights[i] = png.pixels[p] * 256 + png.pixels[p + 1] + png.pixels[p + 2] / 256 - 32768;
  }
  return heights;
}

// Web Mercator: the fractional tile position of a point at a zoom.
function tileXY(lat, lng, zoom = ZOOM){
  const n = 2 ** zoom;
  const x = (lng + 180) / 360 * n;
  const rad = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  return [x, y];
}

// The tiles covering a box, by its corners in degrees.
function tilesForBox(south, west, north, east, zoom = ZOOM){
  const [x0, y0] = tileXY(north, west, zoom);
  const [x1, y1] = tileXY(south, east, zoom);
  const out = [];
  for(let x = Math.floor(x0); x <= Math.floor(x1); x += 1){
    for(let y = Math.floor(y0); y <= Math.floor(y1); y += 1) out.push(`${x}/${y}`);
  }
  return out;
}

// A ground-height reader over tiles held in memory: heightAt(lat, lng) in
// metres, bilinear between pixel centres, NaN where no tile is loaded.
function heightReader(tiles, zoom = ZOOM){
  return function heightAt(lat, lng){
    const [fx, fy] = tileXY(lat, lng, zoom);
    const px = fx * TILE_SIZE - 0.5;
    const py = fy * TILE_SIZE - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const tx = px - x0;
    const ty = py - y0;
    const at = (gx, gy) => {
      const tile = tiles.get(`${Math.floor(gx / TILE_SIZE)}/${Math.floor(gy / TILE_SIZE)}`);
      if(!tile) return NaN;
      return tile[(gy % TILE_SIZE) * TILE_SIZE + (gx % TILE_SIZE)];
    };
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

async function fetchTile(key, options = {}){
  const cacheDir = options.cacheDir || CACHE_DIR;
  const file = path.join(cacheDir, String(options.zoom || ZOOM), `${key}.png`);
  if(fs.existsSync(file)) return fs.readFileSync(file);
  if(options.offline) throw new Error(`Terrain tile ${key} is not cached and the build is offline`);
  const [x, y] = key.split('/');
  const response = await fetch(TILE_URL(options.zoom || ZOOM, x, y));
  if(!response.ok) throw new Error(`Terrain tile ${key}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return buffer;
}

// Loads every tile in `keys`, a few at a time, into a Map of height arrays.
async function loadTiles(keys, options = {}){
  const tiles = new Map();
  const queue = [...new Set(keys)];
  const workers = Array.from({ length: options.concurrency || 4 }, async () => {
    while(queue.length){
      const key = queue.shift();
      tiles.set(key, terrariumHeights(decodePng(await fetchTile(key, options))));
    }
  });
  await Promise.all(workers);
  return tiles;
}

module.exports = {
  ZOOM,
  TERRAIN_SOURCE,
  CACHE_DIR,
  decodePng,
  terrariumHeights,
  tileXY,
  tilesForBox,
  heightReader,
  loadTiles,
};
