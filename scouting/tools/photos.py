import json,math,subprocess,sys,time,os
B=sys.argv[1]; ids=sys.argv[2:]
UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)'
def get(url):
    for k in range(6):
        r=subprocess.run(['curl','-s','-A',UA,'-m','40',url],capture_output=True,text=True)
        time.sleep(5)
        try: return json.loads(r.stdout)
        except Exception: print('retry',r.stdout[:60].replace(chr(10),' '),file=sys.stderr); time.sleep(60)
    raise SystemExit('Commons API kept refusing: '+url)
def dist(a,b):
    return math.hypot((a[1]-b[1])*111320,(a[0]-b[0])*111320*math.cos(math.radians(a[1])))
from urllib.parse import quote
out={}
for id in ids:
    f=json.load(open(f'{B}/builds/{id}.feature.json'))
    c=f['geometry']['coordinates']
    if f['geometry']['type']=='MultiLineString': c=[p for l in c for p in l]
    samp=[c[0]]
    for p in c:
        if dist(p,samp[-1])>=900: samp.append(p)
    hits={}
    for p in samp:
        j=get(f'https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord={p[1]}|{p[0]}&gsradius=1000&gsnamespace=6&gslimit=500&format=json')
        for g in j.get('query',{}).get('geosearch',[]):
            q=[g['lon'],g['lat']]
            dm=min(dist(q,x) for x in c)
            if dm<=150: hits[g['title']]=round(dm)
    titles=sorted(hits,key=hits.get)
    info={}
    for i in range(0,len(titles),40):
        t='|'.join(titles[i:i+40])
        j=get('https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=800&format=json&titles='+quote(t))
        for pg in j.get('query',{}).get('pages',{}).values():
            ii=(pg.get('imageinfo') or [{}])[0]; m=ii.get('extmetadata',{})
            info[pg['title']]=dict(dist=hits.get(pg['title']),lic=m.get('LicenseShortName',{}).get('value'),date=m.get('DateTimeOriginal',{}).get('value','')[:40],artist=m.get('Artist',{}).get('value','')[:150],thumb=ii.get('thumburl'),page=ii.get('descriptionurl'))
    out[id]=sorted(info.values(),key=lambda x:x['dist'] or 999)
    for k,v in sorted(info.items(),key=lambda kv:kv[1]['dist'] or 999): print(id,v['dist'],v['lic'],v['date'][:20],k)
json.dump(out,open(f'{B}/photos/candidates.json','w'),indent=1)
