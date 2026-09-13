const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),R=require('../robust.js'),T=require('../tuning.js');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync('data/tuning.json.gz')));
assert.equal(R.candidates().length,108);
assert.equal(R.week('20260101'),'20251229');
assert.equal(R.monthAdd('202601',-3),'202510');
assert.deepEqual(R.settings({maxDrawdown:0,maxCvar:0}),{maxDrawdown:0,maxCvar:0});
// Fractional CVaR tail: 6 weeks -> worst 1.2 weeks; includes no-bet weeks.
const dates=['20260105','20260112','20260119','20260126','20260202','20260209'];
const bs=[{date:dates[0],profit_krw:-10000,gross:0},{date:dates[1],profit_krw:20000,gross:3},{date:dates[2],profit_krw:-30000,gross:0}];
const m=R.metrics(bs,dates);assert.equal(m.weeks,6);assert.equal(m.profit_krw,-20000);assert.equal(m.drawdown_krw,30000);assert.equal(m.weekly_cvar_krw,26667);
const report=R.run(data);assert.equal(report.folds.length,9);assert.equal(report.result.bets,28);assert.equal(report.result.profit_krw,-27000);assert.equal(report.result.drawdown_krw,104000);
const base=T.backtest(data,T.defaults());assert.equal(report.baseline.profit_krw,base.profit_krw);assert.equal(report.baseline.bets,base.bets);
for(const f of report.folds){assert.ok(f.calibration.through<f.selection_from);assert.ok(f.selection_from<f.selection_before);assert.equal(f.selection_before,f.month+'01');if(f.policy){assert.ok(f.selection.profit_krw>0);assert.ok(f.selection.bets>=20);assert.ok(f.selection.drawdown_krw<=report.limits.maxDrawdown);assert.ok(f.selection.weekly_cvar_krw<=report.limits.maxCvar);}else assert.equal(f.result.bets,0);}
// No test-month outcomes can affect that month's policy or error calibration.
const changed=structuredClone(data);for(const r of changed.races)if(r.date>='20260501')for(const row of r.rows)row[3]=50;
const altered=R.run(changed);
for(let i=0;i<5;i++){assert.deepEqual(altered.folds[i].policy,report.folds[i].policy);assert.deepEqual(altered.folds[i].calibration,report.folds[i].calibration);}
const picks=r=>r.ledger.filter(b=>b.date.startsWith('202605')).map(b=>[b.date,b.venue,b.race_no,b.numbers]);assert.deepEqual(picks(altered),picks(report));
assert.equal(report.result.profit_krw,report.ledger.reduce((s,b)=>s+b.profit_krw,0));assert.equal(report.result.curve.at(-1).profit_units*10000,report.result.profit_krw);
for(const b of report.ledger){assert.equal(b.profit_krw,Math.round((b.gross-1)*10000));assert.ok(b.robust_edge>=R.foldFor(report,b.date).policy.minEdge);assert.ok(b.robust_edge<=b.edge+1e-12);}
const byRace=new Set(report.ledger.map(b=>`${b.date}/${b.venue}/${b.race_no}`));assert.equal(byRace.size,report.ledger.length);
assert.equal(R.foldFor(report,'20251231'),null);assert.equal(R.foldFor(report,'20261001'),null);
assert.deepEqual(R.choose([{robustEdge:1,factors:Array(9).fill(1),numbers:[1,2]}],null),[]);
const training=data.races.filter(r=>r.date>='20260201'&&r.date<'20260501'),cal=R.calibrate(data.races,'202602');assert.equal(R.optimize(R.prepare(training,cal),{maxDrawdown:0,maxCvar:0}).policy,null);
console.log('PASS robust: fractional weekly CVaR, exact 10,000 KRW settlement, abstention, constraints, chronological calibration and future-outcome invariance');
console.log(JSON.stringify({robust:{bets:report.result.bets,profit:report.result.profit_krw,drawdown:report.result.drawdown_krw,cvar:report.result.weekly_cvar_krw},baseline:{bets:report.baseline.bets,profit:report.baseline.profit_krw,drawdown:report.baseline.drawdown_krw,cvar:report.baseline.weekly_cvar_krw}}));
