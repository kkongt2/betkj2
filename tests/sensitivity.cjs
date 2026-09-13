const assert=require('node:assert/strict'),fs=require('node:fs'),z=require('node:zlib'),T=require('../tuning'),S=require('../sensitivity');
const data=JSON.parse(z.gunzipSync(fs.readFileSync('data/tuning.json.gz')));
// Every point on small real-data slices, including no bets, negative cutoffs and 3 selections.
const fixture={races:[...data.races.slice(0,5),...data.races.filter(r=>r.date.startsWith('2026')).slice(0,5)]};
const configurations=[T.defaults(),{...T.defaults(),weights:[65,5,75,10,5,20,10,35,28],minEdge:-.5,maxPerRace:3,period:'all'}, {...T.defaults(),weights:Array(9).fill(0),period:'2025',venue:'seoul'}];
function exact(d,s,field,point){const next=structuredClone(s);if(field==='edge')next.minEdge=point.value/100;else next.weights[field]=point.value;const b=T.backtest(d,next);assert.equal(point.profit_krw,b.profit_krw,`${field}/${point.value} profit`);assert.equal(point.bets,b.bets,`${field}/${point.value} bets`);}
for(const settings of configurations){const context=S.prepare(fixture,settings);for(const field of [0,1,2,3,4,5,6,7,8,'edge']){const c=S.curve(context,field);assert.equal(c.points.length,101);for(const p of c.points)exact(fixture,settings,field,p);}}
// Full archive vs the authoritative backtest at all current values and endpoints.
const s=configurations[1],before=JSON.stringify(s),context=S.prepare(data,s);
for(const field of [0,1,2,3,4,5,6,7,8,'edge']){const c=S.curve(context,field);for(const v of new Set([0,100,field==='edge'?37:s.weights[field]]))exact(data,s,field,c.points[v]);}
assert.equal(JSON.stringify(s),before);console.log('PASS sensitivity: 101 points, exact authoritative settlement, all 10 controls, zero weights, filters and multi-pick ties');
