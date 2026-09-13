(function(root){'use strict';
const key='qpl-weight-presets-v1',lockKey='qpl-weights-locked-v1';
function validSettings(s){return s&&Array.isArray(s.weights)&&s.weights.length===9&&s.weights.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100)&&typeof s.minEdge==='number'&&s.minEdge>=-.5&&s.minEdge<=1&&[1,2,3].includes(s.maxPerRace)&&['2025','2026','all'].includes(s.period)&&['all','seoul','busan','jeju'].includes(s.venue);}
function validate(doc){if(doc?.version!==1||!Array.isArray(doc.presets)||doc.presets.length>30)throw Error('지원하지 않는 저장 파일입니다.');const used=new Set();return doc.presets.map(p=>{if(typeof p.id!=='string'||!/^p[a-zA-Z0-9_-]{1,79}$/.test(p.id)||used.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!validSettings(p.settings))throw Error('저장 조합의 이름 또는 값이 올바르지 않습니다.');used.add(p.id);return {id:p.id,name:p.name.trim(),settings:JSON.parse(JSON.stringify(p.settings))};});}
function read(storage){const raw=storage.getItem(key);return raw?validate(JSON.parse(raw)):[];}
function write(storage,presets){const doc={version:1,presets};validate(doc);storage.setItem(key,JSON.stringify(doc));}
function encode(presets){return JSON.stringify({version:1,presets},null,2);}
const api={key,lockKey,validSettings,validate,read,write,encode};if(typeof module!=='undefined')module.exports=api;else root.PresetStore=api;
})(globalThis);
