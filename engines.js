'use strict';
const crypto = require('node:crypto');

const MODES = {
  LOTO15: { n: 15, max: 25, targetSum: 195, sumMin: 165, sumMax: 225 },
  'MEGA-SENA': { n: 6, max: 60, targetSum: 183, sumMin: 110, sumMax: 255 },
  QUINA: { n: 5, max: 80, targetSum: 202, sumMin: 80, sumMax: 330 }
};
const PRIMES = new Set([2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79]);

function randInt(max){ return crypto.randomInt(0,max); }
function sampleUnique(max,n){
  const a=[]; const used=new Set();
  while(a.length<n){ const x=randInt(max)+1; if(!used.has(x)){used.add(x);a.push(x);} }
  return a.sort((a,b)=>a-b);
}
function overlap(a,b){const s=new Set(b);return a.filter(x=>s.has(x)).length;}
function metrics(mode,game){
  const cfg=MODES[mode]; let sum=0,odd=0,prime=0,consecutive=0;
  for(let i=0;i<game.length;i++){
    const n=game[i]; sum+=n; if(n%2)odd++; if(PRIMES.has(n))prime++; if(i&&n-game[i-1]===1)consecutive++;
  }
  let bands;
  if(mode==='LOTO15') bands=Array.from({length:5},()=>0),game.forEach(n=>bands[Math.floor((n-1)/5)]++);
  else if(mode==='MEGA-SENA') bands=Array.from({length:6},()=>0),game.forEach(n=>bands[Math.min(5,Math.floor((n-1)/10))]++);
  else bands=Array.from({length:8},()=>0),game.forEach(n=>bands[Math.min(7,Math.floor((n-1)/10))]++);
  return {sum,odd,even:game.length-odd,prime,consecutive,bands};
}
function score(mode,game,selected){
  const cfg=MODES[mode],m=metrics(mode,game);
  const sumScore=1-Math.min(Math.abs(m.sum-cfg.targetSum)/(cfg.max*cfg.n*.35),1);
  const parityTarget=Math.round(cfg.n/2);
  const parityScore=1-Math.min(Math.abs(m.odd-parityTarget)/cfg.n,1);
  const bandSpread=Math.max(...m.bands)-Math.min(...m.bands);
  const bandScore=1-Math.min(bandSpread/Math.max(2,Math.ceil(cfg.n/3)),1);
  const primeTarget=mode==='LOTO15'?5:mode==='MEGA-SENA'?2:2;
  const primeScore=1-Math.min(Math.abs(m.prime-primeTarget)/Math.max(3,primeTarget),1);
  const diversity=selected.length?Math.min(...selected.map(x=>1-overlap(game,x)/cfg.n)):1;
  return sumScore*1.25+parityScore*.9+bandScore*.8+primeScore*.45+diversity*1.1+Math.random()*.03;
}
function generate(mode,quantity){
  if(!MODES[mode]) throw new Error('Modalidade inválida.');
  if(![1,5].includes(quantity)) throw new Error('Quantidade inválida.');
  const selected=[];
  for(let k=0;k<quantity;k++){
    let best=null,bestScore=-Infinity;
    for(let i=0;i<1800;i++){
      const g=sampleUnique(MODES[mode].max,MODES[mode].n);
      if(selected.some(x=>x.join(',')===g.join(','))) continue;
      const s=score(mode,g,selected);
      if(s>bestScore){best=g;bestScore=s;}
    }
    selected.push(best || sampleUnique(MODES[mode].max,MODES[mode].n));
  }
  return selected.map((game,index)=>({index:index+1,game,metrics:metrics(mode,game)}));
}
module.exports={MODES,generate,metrics};
