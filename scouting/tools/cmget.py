import json,sys,subprocess,time,os,urllib.parse,shutil
S=sys.argv[1]; c=json.load(open(S+'/photos/candidates.json'))
for sp in sys.argv[2:]:
  w,frag=sp.split('=',1)
  for x in c[w]:
    if frag in x['page']:
      d=f'{S}/img/{w}'; os.makedirs(d,exist_ok=True)
      f=f"{d}/cm_{frag[:40].replace('%','')}.jpg"
      if not os.path.exists(f):
        subprocess.run(['curl','-sL','-A','ORMA/1.0 (github lorenzib/ORMA; board-line builder)','-o',f,x['thumb']]); time.sleep(5)
        if shutil.which('sips'): subprocess.run(['sips','-Z','640',f],capture_output=True)
      print(w,x['dist'],x['lic'],x['date'][:25],'|',x['artist'][:80].replace('\n',' '),'|',f.split('/img/')[1]); break
