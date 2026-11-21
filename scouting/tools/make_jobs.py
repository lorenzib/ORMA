# Writes <workDir>/work/jobs.tsv from stage2 (rows at step "build"): id, km, up, time, there-and-back flag, title.
# km/up/time are the board's one-way figures; buildall.sh doubles km for there-and-back rows.
import json,sys
S=sys.argv[1]; st=json.load(open(S+'/work/stage2.json')); n=0
with open(S+'/work/jobs.tsv','w') as f:
  for o in st:
    if o['step']!='build': continue
    fg=o['fig']; f.write('\t'.join([o['id'],str(fg['km']),str(fg['up']),fg['time'],'1' if o['oneway'] else '0',o['title'][:60]])+'\n'); n+=1
print(n,'jobs')
