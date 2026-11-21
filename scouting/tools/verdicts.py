# Summarises every dry build: drawn clean (status ok) or why the builder refused it.
# usage: python3 verdicts.py <workDir>   -> prints one line per build, writes work/clean.txt (drawn clean; the road/T3 screen narrows it to work/alive.txt)
import glob,os,re,sys
S=sys.argv[1]; alive=[]
for f in sorted(glob.glob(S+'/builds/*.log')):
  id=os.path.basename(f)[:-4]; t=open(f).read()
  ok=os.path.exists(f'{S}/builds/{id}.feature.json') and os.path.getsize(f'{S}/builds/{id}.feature.json')>0
  st=(re.findall(r'STATUS (\S+)',t) or ['?'])[-1]
  why=' '.join(l.strip() for l in t.splitlines() if re.search(r'refused|not drawable|reads as|folds|overlaps',l))[:200]
  print(id,'CLEAN' if ok else 'REFUSED',st,why)
  if ok: alive.append(id)
open(S+'/work/clean.txt','w').write('\n'.join(alive)+'\n'); print(len(alive),'drawn clean')
