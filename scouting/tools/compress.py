import re,sys,glob
S=sys.argv[1]
for id in open(S+'/work/pass.txt').read().split():
  L=open(f'{S}/directions/{id}.ways.txt').read().splitlines()
  print(L[0]); segs=[];lm=[]
  for l in L[1:]:
    m=re.match(r'km ([\d.]+)-([\d.]+)\s+way \d+\s+(\S+)\s+(.*?)\s+ref=(\S*)\s+surface=(\S*)\s+sac=(\S*) routes=(.*)',l)
    if m:
      a,b,hw,nm,ref,sf,sac,rt=m.groups(); key=(hw,nm.strip(),rt)
      if segs and segs[-1][2]==key: segs[-1][1]=float(b)
      else: segs.append([float(a),float(b),key,sf,sac])
    elif l.startswith('  km'): lm.append(l.strip())
  out=[]
  for a,b,(hw,nm,rt),sf,sac in segs:
    if b-a<0.06: continue
    out.append(f"{a:.1f}-{b:.1f} {hw}{' '+nm if nm else ''}{' '+rt if rt!='[]' else ''}{' '+sac if sac else ''}")
  print('  '+' | '.join(out))
  seen=set();ll=[]
  for x in lm:
    n=x.split(' ',2)[2]
    if n not in seen: seen.add(n); ll.append(x[3:])
  print('  LM: '+'; '.join(ll)[:700])
