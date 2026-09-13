(function(root){'use strict';
const T=typeof module!=='undefined'?require('./tuning.js'):root.Tuning;
function prepare(data,settings){const s=T.settings(settings);return {settings:s,races:data.races.filter(r=>(s.period==='all'||r.date.startsWith(s.period))&&(s.venue==='all'||r.venue===s.venue)).map(r=>r.rows.map(row=>({numbers:row.slice(0,2),edge:row[2],gross:row[3],factors:row.slice(4,13)})))};}
function compare(a,b){return b.tuningScore-a.tuningScore||b.edge-a.edge||a.numbers[0]-b.numbers[0]||a.numbers[1]-b.numbers[1];}
function curve(context,field){
 const s=context.settings,w=[...s.weights],edge=field==='edge';
 if(!edge&&(!Number.isInteger(field)||field<0||field>8))throw Error('Unknown sensitivity field');
 const races=context.races.map(cs=>edge?T.rank(cs.filter(c=>c.edge>=0),s):cs.filter(c=>c.edge>=s.minEdge)),points=[];
 for(let value=0;value<=100;value++){
  if(!edge)w[field]=value;let net=0,bets=0;
  if(w.some(v=>v>0))for(const cs of races){
   let selected;
   if(edge)selected=cs.filter(c=>c.edge>=value/100).slice(0,s.maxPerRace);
   else {selected=[];for(const c of cs){const item={...c,tuningScore:T.score(c.factors,w)};let i=0;while(i<selected.length&&compare(item,selected[i])>=0)i++;if(i<s.maxPerRace){selected.splice(i,0,item);if(selected.length>s.maxPerRace)selected.pop();}}}
   for(const c of selected){net+=c.gross-1;bets++;}
  }
  points.push({value,profit_krw:Math.round(net*T.STAKE),bets});
 }
 return {field,points};
}
const api={prepare,curve};if(typeof module!=='undefined')module.exports=api;else root.Sensitivity=api;
})(globalThis);
