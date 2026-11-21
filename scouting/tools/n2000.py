import json,glob,math,sys,subprocess,time
T=sys.argv[1]; UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)'
ids=sys.argv[2:]; out={}
for tid in ids:
    ft=json.load(open(f'{T}/builds/{tid}.feature.json')) ; c=ft['geometry']['coordinates']
    # sample every ~500 m
    pts=[c[0]]; acc=0
    for i in range(1,len(c)):
        d=math.dist((c[i][0]*76000,c[i][1]*111000),(c[i-1][0]*76000,c[i-1][1]*111000)); acc+=d
        if acc>=500: pts.append(c[i]); acc=0
    pts.append(c[-1]); hits={}
    for lon,lat in pts:
        url=(f"https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer/identify?geometry={lon},{lat}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=0&mapExtent={lon-0.05},{lat-0.05},{lon+0.05},{lat+0.05}&imageDisplay=400,400,96&returnGeometry=false&f=json")
        time.sleep(1.1)
        r=json.loads(subprocess.run(['curl','-s','-A',UA,'-m','40',url],capture_output=True,text=True).stdout or '{}')
        for x in r.get('results',[]):
            a=x.get('attributes',{}); k=a.get('SITECODE') or a.get('SITE_CODE') or str(a)[:80]; nm=a.get('SITENAME') or a.get('SITE_NAME','')
            hits[f'{k} {nm} (layer {x.get("layerId")})']=hits.get(f'{k} {nm} (layer {x.get("layerId")})',0)+1
    out[tid]=dict(points=len(pts),hits=hits); print(tid,len(pts),hits)
json.dump(out,open(f'{T}/analysis/n2000.json','w'),indent=1,ensure_ascii=False)
