import json,glob,math,sys,os
T,W=sys.argv[1],sys.argv[2]
nodes={};ways={};rels=[]
for f in glob.glob(W+'/tiles/*.json'):
    d=json.load(open(f))
    for e in d['elements']:
        if e['type']=='node': nodes[e['id']]=(e['lat'],e['lon'])
        elif e['type']=='way': ways[e['id']]=e
        elif e['type']=='relation': rels.append(e)
def xy(lat,lon,lat0): return (lon*111320*math.cos(math.radians(lat0)),lat*110540)
def segdist(p,a,b):
    ax,ay=a;bx,by=b;px,py=p;dx,dy=bx-ax,by-ay
    L=dx*dx+dy*dy; t=0 if L==0 else max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L))
    return math.hypot(px-ax-t*dx,py-ay-t*dy)
def pip(pt,poly):
    x,y=pt;c=False
    for i in range(len(poly)):
        x1,y1=poly[i];x2,y2=poly[i-1]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
forest=[]
def isforest(t): return t.get('landuse')=='forest' or t.get('natural')=='wood'
for w in ways.values():
    t=w.get('tags',{})
    if isforest(t) and w['nodes'][0]==w['nodes'][-1]: forest.append([nodes[n] for n in w['nodes'] if n in nodes])
def rings(wl):
    segs=[list(w['nodes']) for w in wl]; out=[]
    while segs:
        r=segs.pop(0); changed=True
        while r[0]!=r[-1] and changed:
            changed=False
            for i,sg in enumerate(segs):
                if sg[0]==r[-1]: r+=sg[1:]
                elif sg[-1]==r[-1]: r+=sg[::-1][1:]
                elif sg[-1]==r[0]: r=sg+r[1:]
                elif sg[0]==r[0]: r=sg[::-1]+r[1:]
                else: continue
                segs.pop(i); changed=True; break
        out.append(r)
    return out
missing_rel=0
for r in rels:
    if isforest(r.get('tags',{})):
        wl=[ways[m['ref']] for m in r['members'] if m['type']=='way' and m.get('role') in ('outer','') and m['ref'] in ways]
        if len(wl)<sum(1 for m in r['members'] if m['type']=='way' and m.get('role') in ('outer','')): missing_rel+=1
        for rg in rings(wl): forest.append([nodes[n] for n in rg if n in nodes])
print('forest polys',len(forest),'rels with missing outer ways',missing_rel)
res={}
for f in sorted(glob.glob(T+'/builds/*.feature.json')):
    ft=json.load(open(f)); tid=ft['properties']['trail_id']
    line=[(c[1],c[0]) for c in ft['geometry']['coordinates']]; lat0=line[0][0]
    P=[xy(a,b,lat0) for a,b in line]
    # resample every 10 m
    pts=[P[0]]; acc=0
    for i in range(1,len(P)):
        a,b=P[i-1],P[i]; L=math.dist(a,b); s=10-acc
        while s<=L: pts.append((a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L)); s+=10
        acc=(acc+L)%10
    used=[ways[w] for w in set(ft['properties']['osm_ways']) if w in ways]
    segs=[]
    for w in used:
        q=[xy(*nodes[n],lat0) for n in w['nodes'] if n in nodes]
        hw=w.get('tags',{}).get('highway','?'); nm=w.get('tags',{}).get('name') or w.get('tags',{}).get('ref') or ''
        for i in range(1,len(q)): segs.append((q[i-1],q[i],hw,nm))
    tally={};names={}
    for p in pts:
        best=min(segs,key=lambda s:segdist(p,s[0],s[1]))
        k=best[2]; tally[k]=tally.get(k,0)+10
        if k in('primary','secondary','tertiary','unclassified','residential','service'): names[(k,best[3])]=names.get((k,best[3]),0)+10
    # main roads within 6 m (any way in tiles, not only used)
    main=[w for w in ways.values() if w.get('tags',{}).get('highway') in ('primary','secondary','tertiary','trunk','primary_link','secondary_link','tertiary_link')]
    msegs=[]
    for w in main:
        q=[xy(*nodes[n],lat0) for n in w['nodes'] if n in nodes]
        for i in range(1,len(q)): msegs.append((q[i-1],q[i],w['tags']['highway'],w['tags'].get('ref') or w['tags'].get('name','')))
    near6={}
    for p in pts:
        for s in msegs:
            if segdist(p,s[0],s[1])<=6: near6[(s[2],s[3])]=near6.get((s[2],s[3]),0)+10; break
    fpolys=[[xy(a,b,lat0) for a,b in poly] for poly in forest]
    inf=sum(1 for p in pts if any(pip(p,poly) for poly in fpolys))
    res[tid]=dict(km=round(len(pts)*10/1000,2),highway=tally,road_names={f'{k[0]}:{k[1]}':v for k,v in names.items()},main_within_6m={f'{k[0]}:{k[1]}':v for k,v in near6.items()},shade=round(inf/len(pts),2),start=line[0])
    print(tid,res[tid]['km'],'main6m',res[tid]['main_within_6m'],'shade',res[tid]['shade']); print('   ',tally); print('   ',res[tid]['road_names'])
json.dump(res,open(T+'/analysis/roads_shade.json','w'),indent=1,ensure_ascii=False)
