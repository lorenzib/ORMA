# ordered way sequence along a drawn line, with hiking-route refs and named landmarks within 40 m
import json,glob,math,sys
N=sys.argv[1];ids=sys.argv[2:]
nodes={};ways={};rels=[];named=[]
for f in glob.glob(N+'/tiles/*.json'):
  for e in json.load(open(f))['elements']:
    if e['type']=='node':
      nodes[e['id']]=(e['lat'],e['lon'])
      t=e.get('tags',{})
      if t.get('name') and any(k in t for k in ('amenity','tourism','historic','natural','man_made','leisure','building','place')): named.append((e['lat'],e['lon'],t['name'],[k+'='+t[k] for k in ('amenity','tourism','historic','natural','man_made','place') if k in t]))
    elif e['type']=='way':
      ways[e['id']]=e
      t=e.get('tags',{})
      if t.get('name') and any(k in t for k in ('amenity','tourism','historic','natural','leisure')) and 'highway' not in t: named.append((None,e['id'],t['name'],[k+'='+t[k] for k in ('amenity','tourism','historic','natural','leisure') if k in t]))
    elif e['type']=='relation': rels.append(e)
wrefs={}
for r in rels:
  t=r.get('tags',{})
  if t.get('route') in ('hiking','foot'):
    lab=t.get('ref') or t.get('name') or str(r['id'])
    for m in r['members']:
      if m['type']=='way': wrefs.setdefault(m['ref'],set()).add(lab)
def xy(p,lat0): return (p[1]*111320*math.cos(math.radians(lat0)),p[0]*110540)
def sd(p,a,b):
  dx,dy=b[0]-a[0],b[1]-a[1];L=dx*dx+dy*dy;t=0 if L==0 else max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L))
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
for id in ids:
  ft=json.load(open(f'{N}/builds/{id}.feature.json'));line=[(c[1],c[0]) for c in ft['geometry']['coordinates']];lat0=line[0][0]
  P=[xy(p,lat0) for p in line];pts=[P[0]];acc=0;dist=[0]
  for a,b in zip(P,P[1:]):
    L=math.dist(a,b);s=20-acc
    while s<=L: pts.append((a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L));s+=20
    acc=(acc+L)%20
  segs=[]
  for w in set(ft['properties']['osm_ways']):
    if w not in ways: continue
    q=[xy(nodes[n],lat0) for n in ways[w]['nodes'] if n in nodes]
    for i in range(1,len(q)): segs.append((q[i-1],q[i],w))
  seq=[]
  for i,p in enumerate(pts):
    w=min(segs,key=lambda s:sd(p,s[0],s[1]))[2]
    if seq and seq[-1][0]==w: seq[-1][2]=i*20
    else: seq.append([w,i*20,i*20])
  lines=[f'# {id} {ft["properties"]["distance_km"]} km; start {line[0]}']
  for w,a,b in seq:
    t=ways[w].get('tags',{})
    lines.append(f"km {a/1000:.2f}-{b/1000:.2f}  way {w}  {t.get('highway')}  {t.get('name','')}  ref={t.get('ref','')}  surface={t.get('surface','')}  sac={t.get('sac_scale','')} routes={sorted(wrefs.get(w,[]))}")
  lm=[]
  for la,lo,nm,k in named:
    if la is None:
      w=ways[lo];c=[nodes[n] for n in w['nodes'] if n in nodes]
      if not c: continue
      la,lo=sum(x[0] for x in c)/len(c),sum(x[1] for x in c)/len(c)
    q=xy((la,lo),lat0);best=min(range(len(pts)),key=lambda i:math.dist(q,pts[i]))
    if math.dist(q,pts[best])<=40: lm.append((best*20,nm,k))
  lines.append('landmarks within 40 m:')
  for a,nm,k in sorted(lm): lines.append(f'  km {a/1000:.2f} {nm} {k}')
  open(f'{N}/directions/{id}.ways.txt','w').write('\n'.join(lines)+'\n');print('\n'.join(lines))
