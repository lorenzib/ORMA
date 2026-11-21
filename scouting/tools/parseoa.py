import re,sys,html,json,math
S=sys.argv[1]
import os; os.makedirs(S+'/guides',exist_ok=True)
st=json.load(open(S+'/work/stage0.json'))
def txt(t):
  tx=re.sub(r'\s+',' ',html.unescape(re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>','',t)))
  tx=re.sub('<[^>]+>',' | ',tx); return re.sub(r'(\s*\|\s*)+',' | ',tx)
def num(s): return float(s.replace('.','').replace(',','.'))
def d(a,b):
  la=math.radians((a[0]+b[0])/2);return math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*math.cos(la))
for o in st:
  if o['step']!='go': continue
  t=open(f"{S}/oa/{o['id']}.html").read()
  tx=txt(t)
  o['title_it']=re.search(r'<title>(.*?) &bull;',t).group(1) if re.search(r'<title>(.*?) &bull;',t) else None
  m=re.search(r'\| Distanza \| ([\d.,]+) km \| Durata \| (\d+:\d+) h \| Salita \| ([\d.]+) m \| Discesa \| ([\d.]+) m',tx)
  o['fig']=dict(km=num(m.group(1)),time=m.group(2),up=num(m.group(3)),down=num(m.group(4))) if m else None
  m=re.search(r'Responsabile del contenuto \| ([^|]+)\|',tx); o['resp']=m.group(1).strip() if m else None
  m=re.search(r'\| Autore \| ([^|]+)\|',tx); o['author']=m.group(1).strip() if m else None
  # main description: from figures to 'Autore'
  a=tx.find('| Punto più basso |'); b=tx.find('| Autore |')
  o['desc']=tx[a:b] if a>0 and b>a else ''
  # extra sections between Responsabile and 'Guide consigliate'
  c=tx.find('Responsabile del contenuto'); e=tx.find('Guide consigliate')
  o['more']=tx[c:e] if c>0 else ''
  m=re.search(r'Difficoltà \| (T\d|EE|E\b|Facile|Media|Difficile)',o['more']); o['diff']=m.group(1) if m else None
  o['tags']=[k for k in ['Percorso ad anello','Andata e ritorno','Percorso a tappe','Dog-friendly','Rifugio'] if k in tx[e:] or k in o['more']]
  B=S+'/../../'  # unused
  # ld+json line
  for blk in re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>',t):
    try: j=json.loads(blk)
    except: continue
    s=json.dumps(j)
    m=re.search(r'"line": "([^"]+)"',s)
    if m:
      n=list(map(float,m.group(1).split())); pts=list(zip(n[::2],n[1::2]))
      o['npts']=len(pts); o['gap']=round(d(pts[0],pts[-1])); o['glen']=round(sum(d(a,b) for a,b in zip(pts,pts[1:])))
      o['start']=pts[0]
      json.dump({'line':[list(x) for x in pts]},open(f"{S}/guides/{o['id']}.json",'w'))
  # times in text
  o['times']=re.findall(r'(\d+[.,:]?\d*\s?(?:ore|ora|h\b|minuti|min\b|h\s?\d+))',o['desc']+' '+o['more'])
json.dump(st,open(S+'/work/stage1.json','w'),indent=0)
for o in st:
  if o['step']!='go': continue
  f=o['fig'] or {}
  print(o['id'],'|',(o['title_it'] or '')[:55],'|',o.get('resp'),'|',f.get('km'),f.get('time'),f.get('up'),f.get('down'),'|',o.get('diff'),'|gap',o.get('gap'),'glen',o.get('glen'),'|',','.join(o['tags']),'|T:',';'.join(o['times'])[:80])
