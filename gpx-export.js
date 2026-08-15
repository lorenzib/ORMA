(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsGpxExport = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const DISCLAIMER = 'Route geometry only. Check ORMA for current safety, access, water and dog-suitability context before setting out.';

  function escapeXml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function coordinate(point){
    if(!Array.isArray(point) || point.length < 2) return null;
    const lat = Number(point[0]);
    const lon = Number(point[1]);
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if(lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }

  function trailhead(trail, geometry){
    const source = trail && trail.startPoint;
    const lat = Number(source && source.lat);
    const lon = Number(source && source.lng);
    if(Number.isFinite(lat) && Number.isFinite(lon)
      && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180){
      return {
        lat,
        lon,
        label:String(source.label || `${trail.name || 'Trail'} trailhead`),
      };
    }
    return { ...geometry[0], label:`${trail && trail.name || 'Trail'} trailhead` };
  }

  function filename(name){
    const stem = String(name || 'dolopaws-trail')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || 'dolopaws-trail';
    return `${stem}.gpx`;
  }

  function serialize(trail, options){
    if(!trail || typeof trail !== 'object') throw new TypeError('A trail is required.');
    const geometry = Array.isArray(trail.path) ? trail.path.map(coordinate).filter(Boolean) : [];
    if(geometry.length < 2) throw new Error('This trail does not have enough valid route geometry to export.');
    const name = String(trail.name || 'ORMA trail');
    const start = trailhead(trail, geometry);
    const generatedAt = options && options.generatedAt
      ? new Date(options.generatedAt) : new Date();
    if(Number.isNaN(generatedAt.getTime())) throw new Error('The GPX timestamp is invalid.');
    const points = geometry.map(point =>
      `      <trkpt lat="${point.lat}" lon="${point.lon}"></trkpt>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ORMA" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(DISCLAIMER)}</desc>
    <time>${generatedAt.toISOString()}</time>
  </metadata>
  <wpt lat="${start.lat}" lon="${start.lon}">
    <name>${escapeXml(start.label)}</name>
    <type>Trailhead</type>
  </wpt>
  <trk>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(DISCLAIMER)}</desc>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
  }

  function download(trail, doc, urlApi){
    doc = doc || (typeof document !== 'undefined' ? document : null);
    urlApi = urlApi || (typeof URL !== 'undefined' ? URL : null);
    if(!doc || !urlApi || typeof urlApi.createObjectURL !== 'function'){
      throw new Error('File downloads are unavailable in this browser.');
    }
    const blob = new Blob([serialize(trail)], { type:'application/gpx+xml;charset=utf-8' });
    const objectUrl = urlApi.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = objectUrl;
    link.download = filename(trail.name);
    link.hidden = true;
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => urlApi.revokeObjectURL(objectUrl), 0);
    return { filename:link.download, bytes:blob.size };
  }

  return { DISCLAIMER, coordinate, escapeXml, filename, serialize, download };
});
