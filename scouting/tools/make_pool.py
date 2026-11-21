# Writes <workDir>/pool-all.tsv: one publisher's rows from a candidates TSV (header dropped).
# usage: python3 make_pool.py <candidates.tsv> "<publisher>" <workDir> [minLat,minLon,maxLat,maxLon]
# The optional box keeps only walks whose start lies inside it (for big pools such as VISITPIEMONTE).
import csv,sys,os
src,pub,S=sys.argv[1:4]; os.makedirs(S+'/work',exist_ok=True)
box=[float(x) for x in sys.argv[4].split(',')] if len(sys.argv)>4 else None
inbox=lambda r: box is None or (box[0]<=float(r[5])<=box[2] and box[1]<=float(r[6])<=box[3])
rows=[r for r in csv.reader(open(src),delimiter='\t') if r and r[0]==pub and inbox(r)]
csv.writer(open(S+'/pool-all.tsv','w'),delimiter='\t',lineterminator='\n').writerows(rows)
print(len(rows),'rows for',pub)
