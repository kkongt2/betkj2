"""Reproducible exploratory weight search. These dates are already observed;
never label the search result independent validation or approved betting advice.
Only weights vary; EV >= .10, max 1/race, flat 10000 KRW remain fixed.
"""
import gzip,json,hashlib
from pathlib import Path
import numpy as np
SEED=20260913
USER=[80,35,80,0,60,5,20,30,75]

def run():
    raw=Path('data/tuning.json.gz').read_bytes();data=json.loads(gzip.decompress(raw));races=[];F=[];gross=[];edge=[];starts=[]
    for r in data['races']:
        rows=[row for row in r['rows'] if row[2]>=.1]
        if not rows:continue
        # JS tie break: score descending, base EV descending, numbers ascending.
        rows.sort(key=lambda row:(-row[2],row[0],row[1]));starts.append(len(F));races.append(r)
        for row in rows:F.append(row[4:]);gross.append(row[3]);edge.append(row[2])
    F=np.array(F);gross=np.array(gross);starts=np.array(starts);ends=np.r_[starts[1:],len(F)]
    masks=np.array([[r['date'][:4]==y for r in races] for y in ['2025','2026']]);lengths=ends-starts;maxlen=max(lengths)
    # Padded race-major candidates, exact float64 score and stable tie ordering.
    M=np.full((len(races),maxlen,9),0.);G=np.zeros((len(races),maxlen));valid=np.zeros((len(races),maxlen),bool)
    for i,(a,b) in enumerate(zip(starts,ends)):M[i,:b-a]=F[a:b];G[i,:b-a]=gross[a:b];valid[i,:b-a]=True
    flat=M.reshape(-1,9);rng=np.random.default_rng(SEED);seen={};best={};count=0
    def evaluate(weights):
        nonlocal count
        keys=[tuple(map(int,w)) for w in weights if np.any(w)]
        fresh=list(dict.fromkeys(k for k in keys if k not in seen))
        for a in range(0,len(fresh),64):
            batch=np.array(fresh[a:a+64]);scores=(flat@batch.T).reshape(len(races),maxlen,-1);scores[~valid]=-np.inf
            picks=scores.argmax(axis=1);profits=G[np.arange(len(races))[:,None],picks]-1
            nets=masks@profits
            for j,w in enumerate(batch):
                vals=nets[:,j];key=tuple(map(int,w));seen[key]=vals.tolist();count+=1
                objectives={'recent':vals[1],'total':sum(vals),'balanced':min(vals[0],vals[1]),'selection':vals[0]}
                for name,value in objectives.items():
                    score=(round(float(value),8),round(float(sum(vals)),8))
                    if name not in best or score>best[name]['score']:best[name]=dict(weights=list(key),score=score,net=vals.tolist())
    evaluate([USER,[100,0,0,0,0,0,0,0,0],*np.eye(9,dtype=int)*100])
    # Fixed bounded random sweep (uniform + sparse simplex), then coordinate
    # refinement at slider increments. All queries and original baseline saved.
    evaluate(rng.integers(0,21,size=(6000,9))*5)
    sparse=rng.dirichlet(np.full(9,.4),size=6000);evaluate(np.rint(sparse/sparse.max(axis=1)[:,None]*20)*5)
    for _ in range(5):
        neighbors=[]
        for base in [USER,*[b['weights'] for b in best.values()]]:
            for i in range(9):
                for v in range(0,101,5):w=list(base);w[i]=v;neighbors.append(w)
        evaluate(neighbors)
        print('SEARCH',count,{k:v['net'] for k,v in best.items()},flush=True)
    out=dict(schema=1,seed=SEED,source_sha256=hashlib.sha256(raw).hexdigest(),searched=count,user_weights=USER,user_net_units=seen[tuple(USER)],best=best,
        fixed_policy=dict(minEdge=.1,maxPerRace=1,stake_krw=10000),
        limits='Exploratory in-sample search over previously observed 2025/2026 dates. No independent holdout remains. Bounded search, not global optimum. Metrics do not prove future profit.',
        options=[dict(weights=list(k),net_units=v) for k,v in seen.items()])
    Path('data/weight-search.json').write_text(json.dumps(out,separators=(',',':')))
    print('DONE',json.dumps({k:v for k,v in out.items() if k!='options'}),flush=True)
if __name__=='__main__':run()
