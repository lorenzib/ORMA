# Piemonte protected areas + ZSC/ZPS (CSI WFS, lon/lat) against each drawn line, every vertex
import json,sys,subprocess,time
S=sys.argv[1]; ids=open(sys.argv[2]).read().split(); UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)'
B='https://geomap.reteunitaria.piemonte.it/ws/gsareprot/rp-01/areeprotwfs/wfs_gsareprot_1?service=WFS&version=1.1.0&request=GetFeature&srsName=EPSG:4326&outputFormat=geojson'
def pip(x,y,ring):
  c=False
  for i in range(len(ring)):
    x1,y1=ring[i][:2];x2,y2=ring[i-1][:2]
    if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
  return c
def inside(x,y,g):
  polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
  for p in polys:
    if pip(x,y,p[0]) and not any(pip(x,y,h) for h in p[1:]): return True
  return False
out={}
for id in ids:
  c=json.load(open(f'{S}/builds/{id}.feature.json'))['geometry']['coordinates']
  lo=[p[0] for p in c];la=[p[1] for p in c]
  res={}
  for t in ('AreeProtette','ZSC_SIC','ZPS'):
    url=f'{B}&typename={t}&bbox={min(la)},{min(lo)},{max(la)},{max(lo)},EPSG:4326'
    r=subprocess.run(['curl','-s','-A',UA,'-m','60',url],capture_output=True,text=True).stdout; time.sleep(1.2)
    try: fc=json.loads(r)
    except Exception: res[t]='ERR '+r[:80]; continue
    for f in fc.get('features',[]):
      n=sum(1 for x,y in c if inside(x,y,f['geometry']))
      if n:
        p=f['properties']; nm=p.get('nome_area_protetta') or p.get('denominazione') or p.get('nome') or json.dumps(p)[:120]
        code=p.get('codice') or p.get('codice_sito') or p.get('codice_euap') or ''
        res[f'{t}: {code} {nm}']=f'{n}/{len(c)} vertices'
  out[id]=res; print(id,res)
json.dump(out,open(S+'/analysis/parks.json','w'),indent=1,ensure_ascii=False)
