import json,sys,re,math,html
S=sys.argv[1]; st=json.load(open(S+'/work/stage1.json'))
main=json.load(open(S+'/work/main_trails.json'))
def d(a,b):
  la=math.radians((a[0]+b[0])/2);return math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*math.cos(la))
def dens(p,step=10):
  out=[p[0]]
  for a,b in zip(p,p[1:]):
    n=max(1,int(d(a,b)//step))
    for k in range(1,n+1): out.append((a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n))
  return out
G={}
for t in main:
  for q in dens([tuple(x) for x in t['path']]): G.setdefault((int(q[0]*400),int(q[1]*400)),[]).append((q,t['id']))
T3={'T3','T4','T5','T6','EE'}
for o in st:
  if o['step']!='go': continue
  f=o['fig']; oneway=o['gap']>250 and 'Percorso ad anello' not in o['tags']
  o['oneway']=oneway
  km=f['km']*(2 if oneway else 1); up=f['up']+(f['down'] if oneway else 0)
  o['rt']=dict(km=round(km,1),up=up)
  if km>15.5 or up>810:
    o['step']='size'; o['why']=f"{'one way, doubled ' if oneway else ''}{km:.1f} km / {up:.0f} m"; continue
  if o.get('diff') in T3:
    o['step']='grade'; o['why']=f"published difficulty {o['diff']}"; continue
  # dedupe: guide line vs main
  g=json.load(open(f"{S}/guides/{o['id']}.json")); pts=dens([tuple(x) for x in g['line']])
  hit=0
  for p in pts:
    k=(int(p[0]*400),int(p[1]*400))
    if any(d(p,q)<=25 for i in (-1,0,1) for j in (-1,0,1) for q,_ in G.get((k[0]+i,k[1]+j),[])): hit+=1
  o['dup']=round(hit/len(pts),3)
  if o['dup']>=0.7: o['step']='dedupe'; o['why']=f"{o['dup']:.0%} on main"; continue
  o['step']='build'
json.dump(st,open(S+'/work/stage2.json','w'),indent=0)
from collections import Counter; print(Counter(o['step'] for o in st))
for o in st:
  if o['step'] in('size','grade'): print(o['step'],o['id'],o['title'][:50],o['why'])
print(max(o.get('dup',0) for o in st))
