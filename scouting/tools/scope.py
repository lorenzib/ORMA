# Stage 0: drop out-of-scope titles and walks outside the size limits (as published).
# usage: python3 scope.py <workDir>
# Optional <workDir>/scope-out.json: {"title fragment": "reason"} for plain, lowland,
# multi-day, seasonal or variant routes you spotted in the titles.
import csv,sys,json,re,os
S=sys.argv[1]
rows=list(csv.reader(open(S+'/pool-all.tsv'),delimiter='\t'))
OUT=json.load(open(S+'/scope-out.json')) if os.path.exists(S+'/scope-out.json') else {}
out=[]
for r in rows:
  pub,easy,km,asc,dur,lat,lon,title,url=r
  why=next((v for k,v in OUT.items() if k in title),None)
  k=float(km); a=float(asc.replace(',',''))
  oid=re.search(r'/(\d+)/?$',url).group(1)
  st='scope' if why else ('size' if (k>15.5 or a>810 or k<1.5) else 'go')
  out.append(dict(id=oid,pub=pub,km=k,asc=a,dur=dur,lat=float(lat),lon=float(lon),title=title,url=url,step=st,why=why or (f'{k} km / {int(a)} m published' if st=='size' else '')))
json.dump(out,open(S+'/work/stage0.json','w'),indent=0)
from collections import Counter
print(Counter(o['step'] for o in out))
