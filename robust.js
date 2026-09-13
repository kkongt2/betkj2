(function(root){'use strict';
// Decision code is shared by Node, Web Worker and the race cards.
const T=typeof module!=='undefined'?require('./tuning.js'):root.Tuning;
const VERSION='robust-v1',STAKE=T.STAKE;
const defaults=()=>({maxDrawdown:300000,maxCvar:100000});
function settings(x={}){const d=defaults();return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,Number.isFinite(+x[k])?Math.round(Math.max(0,Math.min(10000000,+x[k]))):v]));}
function monthAdd(m,n){const d=new Date(Date.UTC(+m.slice(0,4),+m.slice(4,6)-1+n,1));return d.toISOString().slice(0,7).replace('-','');}
function week(date){const d=new Date(Date.UTC(+date.slice(0,4),+date.slice(4,6)-1,+date.slice(6,8)));d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10).replace(/-/g,'');}
function quantile(a,q){if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*q,k=Math.floor(i);return x[k]+(x[Math.ceil(i)]-x[k])*(i-k);}
function bin(edge){const g=edge+1;return g<.75?0:g<1?1:g<1.25?2:g<1.5?3:4;}
function calibrate(races,before){
 const selected=races.filter(r=>r.date<before+'01'),months=[...new Set(selected.map(r=>r.date.slice(0,6)))].sort(),groups=new Map();
 for(const r of selected){const m=r.date.slice(0,6),seen=new Set();for(const row of r.rows){for(const k of [m+'|all',m+'|'+r.venue+'|'+bin(row[2])]){let g=groups.get(k);if(!g){g={actual:0,expected:0,races:0};groups.set(k,g);}g.actual+=row[3];g.expected+=row[2]+1;if(!seen.has(k)){g.races++;seen.add(k);}}}}
 const factors={};for(const venue of ['seoul','busan','jeju'])for(let b=0;b<5;b++){
  const scenarios=months.map(m=>{const g=groups.get(m+'|all'),s=groups.get(m+'|'+venue+'|'+b);if(!g||g.expected<=0)return null;const global=g.actual/g.expected;if(!s||s.expected<=0)return global;const a=s.races/(s.races+50);return a*s.actual/s.expected+(1-a)*global;}).filter(Number.isFinite);
  factors[venue+'|'+b]=scenarios.length>=6?Math.max(0,Math.min(1,quantile(scenarios,.2))):null;
 }
 return {before:before+'01',through:selected.at(-1)?.date??null,months:months.length,factors,quantile:.2,shrink_races:50};
}
function conservative(edge,venue,cal){const f=cal?.factors?.[venue+'|'+bin(edge)];return Number.isFinite(f)?(edge+1)*f-1:null;}
function decorate(cs,venue,cal){const edges=cs.map(c=>conservative(c.edge,venue,cal)),valid=edges.filter(Number.isFinite),lo=Math.min(...valid),hi=Math.max(...valid);return cs.map((c,i)=>({...c,robustEdge:edges[i],factors:[Number.isFinite(edges[i])?(hi>lo?Math.round((edges[i]-lo)/(hi-lo)*10000)/10000:.5):0,...c.factors.slice(1)]}));}
function rank(cs,policy){const w=policy?.weights||T.defaults().weights;return cs.map(c=>({...c,tuningScore:T.score(c.factors,w)})).sort((a,b)=>b.tuningScore-a.tuningScore||(b.robustEdge??-Infinity)-(a.robustEdge??-Infinity)||a.numbers[0]-b.numbers[0]||a.numbers[1]-b.numbers[1]);}
function choose(cs,policy){if(!policy)return [];return rank(cs,policy).filter(c=>Number.isFinite(c.robustEdge)&&c.robustEdge>=policy.minEdge).slice(0,1);}
function candidates(){const weights=[[100,0,0,0,0,0,0,0,0],[50,10,10,5,5,5,5,5,5],[20,10,10,10,10,10,10,10,10]];let seed=20260913;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<24;i++)weights.push(Array.from({length:9},(_,j)=>Math.round((j===0?20+80*rand():100*rand()))));return weights.flatMap((w,i)=>[0,.05,.1,.2].map(e=>({id:`w${i}-e${Math.round(e*100)}`,weights:w,minEdge:e,maxPerRace:1})));}
function prepare(races,cal){return races.map(r=>({...r,candidates:decorate(r.rows.map(row=>({numbers:row.slice(0,2),edge:row[2],gross:row[3],factors:row.slice(4,13)})),r.venue,cal)}));}
function ledger(races,policy){const out=[];if(!policy)return out;for(const r of races){const c=choose(r.candidates,policy)[0];if(c)out.push({date:r.date,venue:r.venue,race_no:r.race_no,numbers:c.numbers,edge:c.edge,robust_edge:c.robustEdge,gross:c.gross,profit_krw:Math.round((c.gross-1)*STAKE),policy_id:policy.id});}return out;}
function metrics(bets,dates){const days=new Map([...new Set(dates)].sort().map(d=>[d,0]));for(const b of bets)days.set(b.date,(days.get(b.date)||0)+b.profit_krw);const weeks=new Map(),months=new Map();let net=0,peak=0,dd=0;const curve=[];for(const [d,p] of [...days].sort(([a],[b])=>a.localeCompare(b))){net+=p;peak=Math.max(peak,net);dd=Math.max(dd,peak-net);curve.push({date:d,profit_units:net/STAKE});weeks.set(week(d),(weeks.get(week(d))||0)+p);months.set(d.slice(0,6),(months.get(d.slice(0,6))||0)+p);}
 // Exact fractional tail mean, including zero-bet race weeks; alpha=80%.
 const losses=[...weeks.values()].map(v=>-v).sort((a,b)=>b-a),tail=losses.length*.2;let remaining=tail,tailSum=0;for(const x of losses){const take=Math.min(1,remaining);if(take<=0)break;tailSum+=x*take;remaining-=take;}
 return {unit_stake_krw:STAKE,bets:bets.length,hits:bets.filter(b=>b.gross>0).length,profit_krw:net,stake_krw:bets.length*STAKE,roi:bets.length?net/(bets.length*STAKE):null,drawdown_krw:dd,weekly_cvar_krw:tail?Math.round(Math.max(0,tailSum/tail)):null,weeks:weeks.size,tail_weeks:tail,cvar_alpha:.8,curve,months:[...months].map(([month,profit_krw])=>({month,profit_krw,bets:bets.filter(b=>b.date.startsWith(month)).length}))};
}
function optimize(races,limits){let best=null,feasible=0;const dates=races.map(r=>r.date);for(const policy of candidates()){const result=metrics(ledger(races,policy),dates);if(result.bets<20||result.weeks<10||result.profit_krw<=0||result.drawdown_krw>limits.maxDrawdown||result.weekly_cvar_krw>limits.maxCvar)continue;feasible++;if(!best||result.profit_krw>best.metrics.profit_krw||(result.profit_krw===best.metrics.profit_krw&&(result.drawdown_krw<best.metrics.drawdown_krw||(result.drawdown_krw===best.metrics.drawdown_krw&&policy.id<best.policy.id))))best={policy,metrics:result};}return {policy:best?.policy??null,selection:best?.metrics??null,feasible,searched:candidates().length};}
function run(data,options={},progress=()=>{}){
 const limits=settings(options),races=[...data.races].sort((a,b)=>a.date.localeCompare(b.date)||a.venue.localeCompare(b.venue)||a.race_no-b.race_no);if(!races.length)throw Error('강건 검증 자료가 없습니다.');const first=races[0].date.slice(0,6),through=races.at(-1).date,last=through.slice(0,6),folds=[],allBets=[],allDates=[],baseBets=[];
 for(let test=monthAdd(first,9);test<=last;test=monthAdd(test,1)){
  const selectionFrom=monthAdd(test,-3),cal=calibrate(races,selectionFrom),train=races.filter(r=>r.date>=selectionFrom+'01'&&r.date<test+'01'),selection=optimize(prepare(train,cal),limits),testRaces=races.filter(r=>r.date.startsWith(test)),prepared=prepare(testRaces,cal),bets=ledger(prepared,selection.policy),dates=testRaces.map(r=>r.date),result=metrics(bets,dates);
  const baseline=T.backtest({races:testRaces},{...T.defaults(),period:'all'});baseBets.push(...baseline.ledger);allBets.push(...bets);allDates.push(...dates);
  folds.push({month:test,selection_from:selectionFrom+'01',selection_before:test+'01',calibration:cal,...selection,result,baseline:metrics(baseline.ledger,dates),evaluation_limit_exceeded:result.drawdown_krw>limits.maxDrawdown||result.weekly_cvar_krw>limits.maxCvar,partial:test===last});progress({month:test,done:folds.length});
 }
 return {version:VERSION,model_sha256:data.model_sha256,from:folds[0]?.month+'01',through,limits,folds,latest:folds.at(-1)??null,result:metrics(allBets,allDates),baseline:metrics(baseBets,allDates),ledger:allBets,search_count:candidates().length,method:{calibration_min_months:6,selection_months:3,test_months:1,min_selection_bets:20,min_selection_weeks:10,stake:STAKE,cvar_alpha:.8},note:'고정 예측모델 위의 월별 정책 워크포워드 재계산입니다. 기존 연구에서 사용한 데이터로, 새로운 독립 검증이나 미래 수익 보장이 아닙니다.'};
}
function foldFor(report,date){if(!report)return null;return report.folds.find(f=>f.month===date.slice(0,6))??null;}
const api={VERSION,STAKE,defaults,settings,monthAdd,week,quantile,bin,calibrate,conservative,decorate,rank,choose,candidates,prepare,ledger,metrics,optimize,run,foldFor};if(typeof module!=='undefined')module.exports=api;else root.Robust=api;
})(globalThis);
