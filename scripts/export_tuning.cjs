const fs=require('node:fs'),zlib=require('node:zlib'),crypto=require('node:crypto'),QPL=require('../model.js'),T=require('../tuning.js');
const bytes=fs.readFileSync('data/model.json'),model=JSON.parse(bytes),cards=JSON.parse(fs.readFileSync('data/tuning-input.tmp.json'));
const races=cards.map(r=>{const hs=r.horses,X=hs.map(h=>h.features_v7),cs=[];
for(let i=0;i<hs.length;i++)for(let j=i+1;j<hs.length;j++){
const f=Array.from(Float32Array.from(QPL.features(X,i,j))),raw=Math.max(1e-6,Math.min(1-1e-6,QPL.estimate(model.classifier,f))),p=1/(1+Math.exp(-(model.calibrator.a*Math.log(raw/(1-raw))+model.calibrator.b))),d=Math.max(1,QPL.estimate(model.dividend,f)*model.dividend_scale);
cs.push({numbers:[hs[i].number,hs[j].number].sort((a,b)=>a-b),prob:p,dividend:d,edge:p*d-1});}
return {date:r.date,venue:r.venue,race_no:r.race_no,rows:T.decorate(cs,hs).map(c=>[...c.numbers,c.edge,r.payouts[c.numbers.join('-')]||0,...c.factors])};});
const out={schema:1,model_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),from:'20250401',through:'20260910',factors:T.factors.map(f=>f[0]),races};
const report=JSON.parse(fs.readFileSync('data/backtest.json')),s={...T.defaults(),minEdge:model.policy.min_edge,maxPerRace:model.policy.max_per_race},b=T.backtest(out,s),e=report.evaluation;
if(b.bets!==e.bets||b.profit_krw!==e.profit_krw)throw Error(`Baseline mismatch: ${b.bets}/${b.profit_krw} vs ${e.bets}/${e.profit_krw}`);
const selected=JSON.parse(fs.readFileSync('data/backtest-bets.json')).map(b=>`${b.date}/${b.venue}/${b.race_no}/${b.numbers.join('-')}`).sort();
const actual=b.ledger.map(b=>`${b.date}/${b.venue}/${b.race_no}/${b.numbers.join('-')}`).sort();if(JSON.stringify(selected)!==JSON.stringify(actual))throw Error('Baseline pair mismatch');
fs.writeFileSync('data/tuning.json.gz',zlib.gzipSync(JSON.stringify(out),{level:9}));fs.writeFileSync('data/tuning-manifest.json',JSON.stringify({...out,races:undefined,race_count:races.length,candidate_count:races.reduce((s,r)=>s+r.rows.length,0),baseline:{bets:b.bets,profit_krw:b.profit_krw},generator_sha256:crypto.createHash('sha256').update(['model.js','tuning.js','scripts/export_tuning.py','scripts/export_tuning.cjs'].map(p=>fs.readFileSync(p,'utf8')).join('\n')).digest('hex'),file_sha256:crypto.createHash('sha256').update(fs.readFileSync('data/tuning.json.gz')).digest('hex')}));
console.log('TUNING',races.length,'races',races.reduce((s,r)=>s+r.rows.length,0),'pairs; baseline',b.bets,b.profit_krw);
