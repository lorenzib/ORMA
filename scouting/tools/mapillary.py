# Mapillary images within 100 m of a drawn line. Token from $MAPILLARY_TOKEN or ~/.config/orma/mapillary-token; never print it.
import json,sys,math,subprocess,time,os,datetime
N=sys.argv[1];ids=sys.argv[2:]
tf=os.path.expanduser('~/.config/orma/mapillary-token')
tok=os.environ.get('MAPILLARY_TOKEN') or (open(tf).read().strip() if os.path.exists(tf) else '')
if not tok: sys.exit('no Mapillary token: skipped (Commons only)')
UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)'
out={}
for id in ids:
  c=json.load(open(f'{N}/builds/{id}.feature.json'))['geometry']['coordinates']
  lo=[p[0] for p in c];la=[p[1] for p in c]
  bb=f'{min(lo)-0.0015},{min(la)-0.0015},{max(lo)+0.0015},{max(la)+0.0015}'
  url=f'https://graph.mapillary.com/images?access_token={tok}&bbox={bb}&limit=2000&fields=id,captured_at,computed_geometry,geometry,creator,is_pano,thumb_1024_url,camera_type,make,model,sequence'
  r=json.loads(subprocess.run(['curl','-s','-A',UA,'-m','60',url],capture_output=True,text=True).stdout or '{}');time.sleep(1.2)
  res=[]
  for im in r.get('data',[]):
    g=(im.get('computed_geometry') or im.get('geometry'))['coordinates']
    dm=min(math.hypot((g[0]-p[0])*76500,(g[1]-p[1])*111000) for p in c)
    # position along line
    k=min(range(len(c)),key=lambda i:math.hypot((g[0]-c[i][0])*76500,(g[1]-c[i][1])*111000))
    if dm<=100: res.append(dict(id=im['id'],d=round(dm),idx=k,date=datetime.datetime.utcfromtimestamp(im['captured_at']/1000).strftime('%Y-%m-%d'),creator=(im.get('creator') or {}).get('username'),pano=im.get('is_pano'),thumb=im.get('thumb_1024_url')))
  out[id]=res
  months={}
  for x in res: months[x['date'][:7]]=months.get(x['date'][:7],0)+1
  print(id,len(r.get('data',[])),'within100',len(res),sorted(months.items()))
json.dump(out,open(N+'/photos/mapillary.json','w'),indent=1)
