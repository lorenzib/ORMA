import json,glob,math,sys
S=sys.argv[1]; M=json.load(open(S+'/photos/mapillary.json'))
nodes={};ways={}
for f in glob.glob(S+'/tiles/*.json'):
  for e in json.load(open(f))['elements']:
    if e['type']=='node': nodes[e['id']]=(e['lat'],e['lon'])
    elif e['type']=='way': ways[e['id']]=e
out={}
for id,ims in M.items():
  if not ims: continue
  ft=json.load(open(f'{S}/builds/{id}.feature.json')); c=ft['geometry']['coordinates']
  wl=[w for w in set(ft['properties']['osm_ways']) if w in ways]
  segs=[]
  for w in wl:
    q=[nodes[n] for n in ways[w]['nodes'] if n in nodes]
    for a,b in zip(q,q[1:]): segs.append((a,b,ways[w]['tags'].get('highway')))
  def sd(p,a,b):
    k=math.cos(math.radians(p[0]));P=(p[1]*k*111320,p[0]*110540);A=(a[1]*k*111320,a[0]*110540);B=(b[1]*k*111320,b[0]*110540)
    dx,dy=B[0]-A[0],B[1]-A[1];L=dx*dx+dy*dy;t=0 if L==0 else max(0,min(1,((P[0]-A[0])*dx+(P[1]-A[1])*dy)/L))
    return math.hypot(P[0]-A[0]-t*dx,P[1]-A[1]-t*dy)
  grp={}
  for im in ims:
    if im['d']>30: continue
    # need image coords: approximate via idx point on line
    p=(c[im['idx']][1],c[im['idx']][0])
    hw=min(segs,key=lambda s:sd(p,s[0],s[1]))[2]
    key=(im['creator'],im['date'][:7],'pano' if im['pano'] else 'flat',hw if hw in('path','footway','track','steps','bridleway','pedestrian') else 'road')
    grp.setdefault(key,[]).append(im['id'])
  out[id]={'|'.join(k):v for k,v in grp.items()}
  print(id); 
  for k,v in sorted(grp.items(),key=lambda kv:-len(kv[1])): print('   ',k,len(v),v[:3])
json.dump(out,open(S+'/photos/mly_groups.json','w'),indent=0)
