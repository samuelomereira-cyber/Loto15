'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, 'data.json');
let mode = 'json';
let pg = null;
let pool = null;
let jsonDb = { orders: {}, events: [], idempotency: {} };

function loadJson(){
  try { if (fs.existsSync(DATA)) jsonDb = JSON.parse(fs.readFileSync(DATA,'utf8')); }
  catch { jsonDb = { orders:{}, events:[], idempotency:{} }; }
  jsonDb.orders ||= {}; jsonDb.events ||= []; jsonDb.idempotency ||= {};
}
function saveJson(){ const t=DATA+'.tmp'; fs.writeFileSync(t, JSON.stringify(jsonDb,null,2)); fs.renameSync(t,DATA); }

async function init(){
  if(process.env.DATABASE_URL){
    try {
      pg = require('pg');
      pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX||10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
      });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          access_hash TEXT NOT NULL,
          mode TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price NUMERIC(10,2) NOT NULL,
          email TEXT,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          paid_at TIMESTAMPTZ,
          expired_at TIMESTAMPTZ,
          generated_at TIMESTAMPTZ,
          payment JSONB,
          games JSONB,
          email_result JSONB
        );
        CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
        CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
        CREATE TABLE IF NOT EXISTS events (
          id BIGSERIAL PRIMARY KEY,
          at TIMESTAMPTZ NOT NULL,
          type TEXT NOT NULL,
          order_id TEXT,
          extra JSONB
        );
        CREATE INDEX IF NOT EXISTS events_at_idx ON events(at DESC);
        CREATE TABLE IF NOT EXISTS idempotency (
          key TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query('ALTER TABLE orders ALTER COLUMN email DROP NOT NULL');
      mode='postgres';
      return;
    } catch(e){
      if(process.env.REQUIRE_POSTGRES==='true') throw e;
      console.warn('PostgreSQL indisponível; usando data.json:', e.message);
    }
  }
  loadJson();
}
function dbMode(){ return mode; }

function rowToOrder(r){
  if(!r) return null;
  return { id:r.id, accessHash:r.access_hash, mode:r.mode, quantity:r.quantity, price:Number(r.price), email:r.email, status:r.status,
    createdAt:new Date(r.created_at).toISOString(), paidAt:r.paid_at?new Date(r.paid_at).toISOString():undefined,
    expiredAt:r.expired_at?new Date(r.expired_at).toISOString():undefined, generatedAt:r.generated_at?new Date(r.generated_at).toISOString():undefined,
    payment:r.payment||null, games:r.games||null, emailResult:r.email_result||null };
}
async function getOrder(id){
  if(mode==='postgres') return rowToOrder((await pool.query('SELECT * FROM orders WHERE id=$1',[id])).rows[0]);
  return jsonDb.orders[id]||null;
}
async function findOrderByPaymentId(paymentId){
  if(!paymentId) return null;
  if(mode==='postgres') return rowToOrder((await pool.query(
    `SELECT * FROM orders WHERE payment->>'orderId'=$1 OR payment->>'externalId'=$1 ORDER BY created_at DESC LIMIT 1`,[String(paymentId)]
  )).rows[0]);
  return Object.values(jsonDb.orders).find(o=>String(o.payment?.orderId||'')===String(paymentId)||String(o.payment?.externalId||'')===String(paymentId))||null;
}
async function getOrderByIdempotency(key){
  if(!key) return null;
  if(mode==='postgres') return (await pool.query('SELECT order_id FROM idempotency WHERE key=$1',[key])).rows[0]?.order_id||null;
  return jsonDb.idempotency[key]||null;
}
async function saveOrder(o){
  if(mode==='postgres'){
    await pool.query(`INSERT INTO orders(id,access_hash,mode,quantity,price,email,status,created_at,paid_at,expired_at,generated_at,payment,games,email_result)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb)
      ON CONFLICT(id) DO UPDATE SET access_hash=EXCLUDED.access_hash,mode=EXCLUDED.mode,quantity=EXCLUDED.quantity,price=EXCLUDED.price,email=EXCLUDED.email,status=EXCLUDED.status,
      created_at=EXCLUDED.created_at,paid_at=EXCLUDED.paid_at,expired_at=EXCLUDED.expired_at,generated_at=EXCLUDED.generated_at,payment=EXCLUDED.payment,games=EXCLUDED.games,email_result=EXCLUDED.email_result`,
      [o.id,o.accessHash,o.mode,o.quantity,o.price,o.email,o.status,o.createdAt,o.paidAt||null,o.expiredAt||null,o.generatedAt||null,JSON.stringify(o.payment||null),JSON.stringify(o.games||null),JSON.stringify(o.emailResult||null)]);
    return;
  }
  jsonDb.orders[o.id]=o; saveJson();
}
async function saveIdempotency(key,id){
  if(!key) return;
  if(mode==='postgres') { await pool.query('INSERT INTO idempotency(key,order_id) VALUES($1,$2) ON CONFLICT(key) DO NOTHING',[key,id]); return; }
  jsonDb.idempotency[key]=id; saveJson();
}
async function addEvent(type,o,extra={}){
  if(mode==='postgres') { await pool.query('INSERT INTO events(at,type,order_id,extra) VALUES(NOW(),$1,$2,$3::jsonb)',[type,o?.id||null,JSON.stringify(extra)]); return; }
  jsonDb.events.push({at:new Date().toISOString(),type,orderId:o?.id||null,...extra}); jsonDb.events=jsonDb.events.slice(-5000); saveJson();
}
async function listOrders(){
  if(mode==='postgres') return (await pool.query('SELECT * FROM orders ORDER BY created_at DESC')).rows.map(rowToOrder);
  return Object.values(jsonDb.orders);
}
async function listEvents(limit=200){
  if(mode==='postgres') return (await pool.query('SELECT at,type,order_id,extra FROM events ORDER BY at DESC LIMIT $1',[limit])).rows.map(r=>({at:new Date(r.at).toISOString(),type:r.type,orderId:r.order_id,...(r.extra||{})}));
  return jsonDb.events.slice(-limit).reverse();
}
async function expirePending(ttlMs){
  const cutoff = new Date(Date.now()-ttlMs).toISOString();
  if(mode==='postgres') { await pool.query("UPDATE orders SET status='EXPIRED',expired_at=NOW() WHERE status='PENDING' AND created_at < $1",[cutoff]); return; }
  let changed=false; for(const o of Object.values(jsonDb.orders)){if(o.status==='PENDING'&&Date.now()-Date.parse(o.createdAt)>ttlMs){o.status='EXPIRED';o.expiredAt=new Date().toISOString();changed=true;}} if(changed)saveJson();
}
async function summary(){
  if(mode==='postgres'){
    const r=await pool.query(`SELECT COUNT(*)::int total,
      COUNT(*) FILTER(WHERE status='PENDING')::int pending,
      COUNT(*) FILTER(WHERE status='PAID')::int paid,
      COUNT(*) FILTER(WHERE games IS NOT NULL)::int released,
      COALESCE(SUM(price) FILTER(WHERE status='PAID'),0)::numeric revenue FROM orders`);
    const orders=(await pool.query('SELECT id,mode,quantity,price,status,created_at,paid_at,generated_at FROM orders ORDER BY created_at DESC LIMIT 500')).rows.map(x=>({id:x.id,mode:x.mode,quantity:x.quantity,price:Number(x.price),status:x.status,createdAt:new Date(x.created_at).toISOString(),paidAt:x.paid_at?new Date(x.paid_at).toISOString():undefined,generatedAt:x.generated_at?new Date(x.generated_at).toISOString():undefined}));
    return {...r.rows[0],revenue:Number(r.rows[0].revenue),orders};
  }
  const os=Object.values(jsonDb.orders); return {total:os.length,pending:os.filter(x=>x.status==='PENDING').length,paid:os.filter(x=>x.status==='PAID').length,released:os.filter(x=>x.games).length,revenue:os.filter(x=>x.status==='PAID').reduce((s,x)=>s+x.price,0),orders:os.map(x=>({id:x.id,mode:x.mode,quantity:x.quantity,price:x.price,status:x.status,createdAt:x.createdAt,paidAt:x.paidAt,generatedAt:x.generatedAt}))};
}
async function close(){ if(pool) await pool.end(); }
module.exports={init,dbMode,getOrder,findOrderByPaymentId,getOrderByIdempotency,saveOrder,saveIdempotency,addEvent,listOrders,listEvents,expirePending,summary,close};
