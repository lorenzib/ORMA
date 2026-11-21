# sac_scale metres (one way = half the drawn out-and-back) plus tags of interest on every used way
import json,glob,math,sys
L=sys.argv[1];nodes={};ways={}
for f in glob.glob(L+'/tiles/*.json'):
  for e in json.load(open(f))['elements']:
    if e['type']=='node': nodes[e['id']]=(e['lat'],e['lon'])
    elif e['type']=='way': ways[e['id']]=e
def xy(p,lat0): return (p[1]*111320*math.cos(math.radians(lat0)),p[0]*110540)
def sd(p,a,b):
  dx,dy=b[0]-a[0],b[1]-a[1];l=dx*dx+dy*dy;t=0 if l==0 else max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l))
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
out={}
for f in sorted(glob.glob(L+'/builds/*.feature.json')):
  ft=json.load(open(f));tid=ft['properties']['trail_id'];line=[(c[1],c[0]) for c in ft['geometry']['coordinates']];lat0=line[0][0]
  P=[xy(p,lat0) for p in line];pts=[P[0]];acc=0
  for a,b in zip(P,P[1:]):
    l=math.dist(a,b);s=10-acc
    while s<=l: pts.append((a[0]+(b[0]-a[0])*s/l,a[1]+(b[1]-a[1])*s/l));s+=10
    acc=(acc+l)%10
  segs=[]
  for w in set(ft['properties']['osm_ways']):
    q=[xy(nodes[n],lat0) for n in ways[w]['nodes'] if n in nodes]
    for i in range(1,len(q)): segs.append((q[i-1],q[i],w))
  tally={}
  for p in pts:
    w=min(segs,key=lambda s:sd(p,s[0],s[1]))[2];k=ways[w].get('tags',{}).get('sac_scale','(none)')
    tally[k]=tally.get(k,0)+10
  out[tid]=dict(tally)
  print(tid,'metres by sac_scale (whole drawn line):',out[tid])
  for w in dict.fromkeys(ft['properties']['osm_ways']):
    t=ways[w].get('tags',{})
    print('   ',w,{k:v for k,v in t.items() if k in ('highway','name','sac_scale','trail_visibility','surface','smoothness','width','incline','foot','access','dog','tracktype','mtb:scale','ladder','exposure','hazard','bridge','informal')})
json.dump(out,open(L+'/analysis/sac.json','w'),indent=1)
