importScripts('tuning.js?v=stake-10000-v1');
let data=null;
self.onmessage=async({data:msg})=>{
try{
 if(msg.type==='load'){
  const [r,m]=await Promise.all([fetch('data/tuning.json.gz',{cache:'no-cache'}),fetch('data/model.json',{cache:'no-cache'})]);
  if(!r.ok||!m.ok)throw Error('시뮬레이션 자료를 불러오지 못했습니다.');
  const modelBytes=await m.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',modelBytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(typeof DecompressionStream==='undefined')throw Error('이 브라우저에서는 압축 자료를 열 수 없습니다. 최신 Chrome 또는 삼성 인터넷을 사용해 주세요.');
  data=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  if(data.schema!==1||data.model_sha256!==digest||JSON.stringify(data.factors)!==JSON.stringify(Tuning.factors.map(f=>f[0])))throw Error('모델과 시뮬레이션 자료 버전이 다릅니다. 새로고침해 주세요.');
  self.postMessage({type:'ready',races:data.races.length,candidates:data.races.reduce((s,r)=>s+r.rows.length,0)});
 }else if(msg.type==='calculate'){
  if(!data)throw Error('자료를 먼저 불러와 주세요.');
  const result=Tuning.backtest(data,msg.settings),base=Tuning.backtest(data,{...Tuning.defaults(),period:msg.settings.period,venue:msg.settings.venue});
  self.postMessage({type:'result',id:msg.id,settings:msg.settings,result,baseline:base.profit_krw});
 }
}catch(e){self.postMessage({type:'error',id:msg.id,message:e.message});}
};
