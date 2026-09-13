(function(root){'use strict';
const STAKE=10000,key=n=>[...n].sort((a,b)=>a-b).join('-');
function outcome(pair){
 if(pair?.status==='refund')return {status:'refund',payouts:[]};
 if(pair?.status!=='confirmed'||!Array.isArray(pair.payouts)||!pair.payouts.length)return {status:'pending',payouts:[]};
 const payouts=[],seen=new Map();
 for(const p of pair.payouts){if(!Array.isArray(p.numbers)||p.numbers.length!==2||p.numbers[0]===p.numbers[1]||!p.numbers.every(n=>Number.isInteger(n)&&n>0)||!Number.isFinite(+p.odds)||+p.odds<=0)return {status:'pending',payouts:[]};const k=key(p.numbers);if(seen.has(k)){if(seen.get(k)!==+p.odds)return {status:'pending',payouts:[]};continue;}seen.set(k,+p.odds);payouts.push({numbers:[...p.numbers].sort((a,b)=>a-b),odds:+p.odds});}
 return {status:'confirmed',payouts};
}
function settle(chosen,pair){const result=outcome(pair),payouts=new Map(result.payouts.map(p=>[key(p.numbers),p.odds]));const selections=chosen.map(c=>{const odds=result.status==='confirmed'?(payouts.get(key(c.numbers))||0):result.status==='refund'?1:null;return {numbers:c.numbers,prob:c.prob,odds,hit:result.status==='confirmed'?odds>0:null,profit_krw:odds===null?null:Math.round((odds-1)*STAKE)};});return {...result,selections,bets:chosen.length,hits:selections.filter(s=>s.hit).length,profit_krw:!chosen.length?0:result.status==='pending'?null:selections.reduce((s,c)=>s+c.profit_krw,0)};}
const api={STAKE,key,outcome,settle};if(typeof module!=='undefined')module.exports=api;else root.RaceSummary=api;
})(globalThis);
