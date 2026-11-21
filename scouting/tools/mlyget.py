# download up to K thumbs for (walk, creator, month, class) groups; images in their own dir
import json,sys,subprocess,time,os
S=sys.argv[1]; K=int(sys.argv[2]); specs=sys.argv[3:]   # walk:creator:yyyy-mm:class
M=json.load(open(S+'/photos/mapillary.json')); G=json.load(open(S+'/photos/mly_groups.json'))
byid={im['id']:im for v in M.values() for im in v}
for sp in specs:
  w,cr,mo,cl=sp.split(':')
  for k,ids in G.get(w,{}).items():
    c,m,p,h=k.split('|')
    if c==cr and m==mo and h==cl:
      pick=[ids[int(i*(len(ids)-1)/max(1,K-1))] for i in range(K)] if len(ids)>=K else ids
      for i in dict.fromkeys(pick):
        im=byid[i]; d=f'{S}/img/{w}'; os.makedirs(d,exist_ok=True)
        f=f'{d}/mly_{i}.jpg'
        if not os.path.exists(f):
          subprocess.run(['curl','-s','-A','ORMA/1.0 (github lorenzib/ORMA; board-line builder)','-o',f,im['thumb']]); time.sleep(1.1)
        print(f, im['d'],'m', im['date'], im['creator'], 'idx',im['idx'])
