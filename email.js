'use strict';

async function sendGames({to,mode,quantity,games,orderId}){
  if(process.env.EMAIL_PROVIDER!=='resend' || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM){
    return {sent:false,mode:'disabled'};
  }
  const lines=games.map(g=>`${String(g.index).padStart(2,'0')} — ${g.game.map(n=>String(n).padStart(2,'0')).join(' ')}`).join('\n');
  const subject=`LOTO15 — seus jogos ${mode}`;
  const text=`Seu pedido ${orderId} foi confirmado.\n\nModalidade: ${mode}\nQuantidade: ${quantity}\n\n${lines}\n\nOs jogos são combinações geradas pelo sistema. A aposta é realizada separadamente pelo cliente no canal oficial da loteria.`;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text})});
  const body=await r.text();
  if(!r.ok){const e=new Error(`Falha no envio de e-mail (${r.status}).`);e.data=body;throw e;}
  return {sent:true,mode:'resend'};
}
module.exports={sendGames};
