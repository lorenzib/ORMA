import json,subprocess,sys,time
from urllib.parse import quote
UA='ORMA/1.0 (github lorenzib/ORMA; board-line builder)';out={}
def get(url):
  for k in range(5):
    r=subprocess.run(['curl','-s','-A',UA,'-m','40',url],capture_output=True,text=True);time.sleep(6)
    try: return json.loads(r.stdout)
    except Exception: time.sleep(60)
  return {}
for q in sys.argv[2:]:
  j=get('https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srlimit=50&format=json&srsearch='+quote(q))
  out[q]=[x['title'] for x in j.get('query',{}).get('search',[])]
  print('##',q,len(out[q]));[print('  ',t) for t in out[q]]
json.dump(out,open(sys.argv[1],'w'),indent=1,ensure_ascii=False)
