'use strict';
const crypto=require('node:crypto');
function configured(){return process.env.PAYMENT_PROVIDER==='mercadopago'&&!!process.env.MP_ACCESS_TOKEN&&!!process.env.PUBLIC_BASE_URL;}
function webhookConfigured(){return configured()&&!!process.env.MP_WEBHOOK_SECRET;}
async function mp(path,opts={}){const r=await fetch('https://api.mercadopago.com'+path,{...opts,headers:{Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}`,'Content-Type':'application/json',...(opts.headers||{})}});const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{}if(!r.ok){const e=new Error(d.message||`Mercado Pago HTTP ${r.status}`);e.status=r.status;e.data=d;throw e;}return d;}
function sigParts(h){const o={};for(const p of String(h||'').split(',')){const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=p.slice(i+1).trim();}return o;}
function verifyWebhookSignature({xSignature,xRequestId,dataId}){if(!webhookConfigured())return false;const p=sigParts(xSignature);if(!p.ts||!p.v1||!xRequestId||!dataId)return false;const age=Math.abs(Date.now()-Number(p.ts));if(!Number.isFinite(age)||age>Number(process.env.MP_WEBHOOK_MAX_AGE_MS||300000))return false;const manifest=`id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${p.ts};`;const expected=crypto.createHmac('sha256',process.env.MP_WEBHOOK_SECRET).update(manifest).digest('hex');const a=Buffer.from(expected,'hex'),b=Buffer.from(p.v1,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}
async function createPixOrder(order){
 if(!configured()) return {mode:'sandbox',externalId:null,qrCode:`PIX-DEMO-${order.id}`,qrCodeBase64:null,checkoutUrl:null,rawStatus:'pending'};
 const idem=crypto.randomUUID();
 const payload={type:'online',external_reference:order.id,total_amount:order.price.toFixed(2),processing_mode:'automatic',expiration_time:'PT30M',payer:{email:order.email||('pedido-'+order.id.toLowerCase()+'@loto15.com.br')},transactions:{payments:[{amount:order.price.toFixed(2),payment_method:{id:'pix',type:'bank_transfer'}}]}};
 const data=await mp('/v1/orders',{method:'POST',headers:{'X-Idempotency-Key':idem},body:JSON.stringify(payload)});
 const p=data?.transactions?.payments?.[0]||{};const pm=p.payment_method||{};
 return {mode:'mercadopago',externalId:p.id||data.id||null,orderId:data.id||null,qrCode:pm.qr_code||p.qr_code||null,qrCodeBase64:pm.qr_code_base64||p.qr_code_base64||null,checkoutUrl:data.checkout_url||null,rawStatus:p.status||data.status||'pending'};
}
async function getPayment(id){return mp('/v1/payments/'+encodeURIComponent(id),{method:'GET'});}
async function getOrder(id){return mp('/v1/orders/'+encodeURIComponent(id),{method:'GET'});}
module.exports={configured,webhookConfigured,verifyWebhookSignature,createPixOrder,getPayment,getOrder};
