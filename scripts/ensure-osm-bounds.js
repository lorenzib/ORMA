'use strict';

/**
 * Give an OSM extract the <bounds> element the footpath builder needs.
 *
 * The OSM API's /map call returns <bounds> itself, but it refuses a request
 * over 50,000 nodes, and the areas these trails need are close to that. An
 * Overpass query filtered to walkable ways is far smaller and has no such cap
 * -- but Overpass XML carries no <bounds>, and build-offline-footpath-network
 * both requires one and clips its edges to it. So the box that was asked for
 * is written back into the file it produced.
 *
 * Usage: node scripts/ensure-osm-bounds.js <file> <south> <west> <north> <east>
 */
const fs=require('fs');
const [file,south,west,north,east]=process.argv.slice(2);
let xml=fs.readFileSync(file,'utf8');
if(/<bounds\b/.test(xml)){ console.log('bounds already present'); process.exit(0); }
const bounds=` <bounds minlat="${south}" minlon="${west}" maxlat="${north}" maxlon="${east}"/>\n`;
const at=xml.indexOf('>', xml.indexOf('<osm'))+1;
if(at<1) throw new Error('no <osm> element');
fs.writeFileSync(file, xml.slice(0,at)+'\n'+bounds+xml.slice(at));
console.log('inserted bounds', south, west, north, east);
