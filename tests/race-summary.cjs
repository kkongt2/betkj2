const assert=require('node:assert/strict'),R=require('../race-summary');
const picks=[{numbers:[1,2],prob:.2},{numbers:[3,4],prob:.15}],confirmed={status:'confirmed',payouts:[{numbers:[2,1],odds:7.3},{numbers:[1,5],odds:2.1},{numbers:[2,5],odds:1.5}]};
let r=R.settle(picks,confirmed);assert.equal(r.bets,2);assert.equal(r.hits,1);assert.equal(r.profit_krw,53000);assert.equal(r.selections[0].profit_krw,63000);assert.equal(r.selections[1].profit_krw,-10000);
for(const result of [null,{status:'pending'},{status:'confirmed',payouts:[]},{status:'confirmed',payouts:[{numbers:[1,2],odds:'bad'}]},{status:'confirmed',payouts:[{numbers:[1,2],odds:2},{numbers:[2,1],odds:3}]}]){r=R.settle(picks,result);assert.equal(r.status,'pending');assert.equal(r.profit_krw,null);assert.equal(r.hits,0);assert.ok(r.selections.every(s=>s.hit===null));}
r=R.settle(picks,{status:'refund'});assert.equal(r.profit_krw,0);assert.equal(r.hits,0);assert.ok(r.selections.every(s=>s.odds===1&&s.hit===null));
r=R.settle([],confirmed);assert.equal(r.bets,0);assert.equal(r.profit_krw,0);assert.equal(r.hits,0);assert.equal(r.payouts.length,3);
console.log('PASS daily summary: confirmed hits/misses, reverse pair keys, 10,000 KRW settlement, abstention, refunds and unsettled results');
