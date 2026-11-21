# EU-DEM 25 m via opentopodata: sample every 100 m, 10 m hysteresis climb, DIN 33466 time
import json,sys,math,subprocess,time
N=sys.argv[1];ids=sys.argv[2:];UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)'
def d(a,b): return math.hypot((a[0]-b[0])*111320*math.cos(math.radians(a[1])),(a[1]-b[1])*110540)
out={}
for id in ids:
  c=json.load(open(f'{N}/builds/{id}.feature.json'))['geometry']['coordinates']
  pts=[c[0]];acc=0;tot=0
  for a,b in zip(c,c[1:]):
    L=d(a,b);s=100-acc
    while s<=L: pts.append([a[0]+(b[0]-a[0])*s/L,a[1]+(b[1]-a[1])*s/L]);s+=100
    acc=(acc+L)%100;tot+=L
  pts.append(c[-1]);el=[]
  for i in range(0,len(pts),100):
    loc='|'.join(f'{p[1]:.6f},{p[0]:.6f}' for p in pts[i:i+100])
    r=subprocess.run(['curl','-s','-A',UA,'-m','60','https://api.opentopodata.org/v1/eudem25m?locations='+loc],capture_output=True,text=True).stdout
    el+=[x['elevation'] for x in json.loads(r)['results']];time.sleep(1.2)
  up=dn=0;ref=el[0]
  for e in el[1:]:
    if e-ref>=10: up+=e-ref;ref=e
    elif ref-e>=10: dn+=ref-e;ref=e
  km=tot/1000;h=km/4;v=up/300+dn/500;t=max(h,v)+min(h,v)/2
  out[id]=dict(km=round(km,2),up=round(up),down=round(dn),min=round(min(el)),max=round(max(el)),din_h=round(t,2),din=f'{int(t)}:{round((t-int(t))*60):02d}',n=len(el))
  print(id,out[id])
json.dump(out,open(N+'/analysis/elev.json','w'),indent=1)
