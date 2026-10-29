import { Router } from 'express';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// Requires Step 4 requireWebAuth(pool) before mounting. No legacy writes.
const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
const validMoney = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000000;
const validQty = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000 && Math.round(v * 1000) === v * 1000;
const fail = (message: string, code = 400) => Object.assign(new Error(message), { code });
const isUUID = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);

async function readInvoice(conn: PoolConnection | Pool, id: number) {
  const [headers] = await conn.execute<RowDataPacket[]>(
    `SELECT h.*, c.Name AS customer_name, c.Address AS customer_address, s.SecName AS section_name
     FROM dist_web_invoices h JOIN cussup c ON c.RegId=h.customer_id
     JOIN section s ON s.SecId=h.section_id WHERE h.id=?`, [id]);
  if (!headers.length) return null;
  const [items] = await conn.execute<RowDataPacket[]>(
    `SELECT item_id,batch_id,item_name,qty,unit_price,discount,line_total FROM dist_web_invoice_items WHERE invoice_id=? ORDER BY id`, [id]);
  return { ...headers[0], items };
}

export function webSalesRouter(pool: Pool) {
 const router = Router();
 router.get('/batches', async (req, res) => {
  try {
   const section = String(req.query.section || ''); const q = String(req.query.q || '').slice(0,70);
   if (!section) { res.json([]); return; }
   if (req.webUser?.sections.length && !req.webUser.sections.includes(section)) { res.status(403).json({error:'Section not allowed'}); return; }
   const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT b.Id AS batchId, b.stksec_stkitem_ItemId AS itemId, i.ItemName AS itemName,
            b.SalePrice AS salePrice, b.ExpDate AS expiry, b.Qty AS legacyBatchQty,
            s.ItemQty AS legacySectionQty,
            COALESCE((SELECT SUM(w.qty) FROM dist_web_invoice_items w JOIN dist_web_invoices h ON h.id=w.invoice_id
              WHERE w.batch_id=b.Id AND h.section_id=?),0) AS webSoldQty
     FROM stksecdesc b JOIN stkitem i ON i.ItemId=b.stksec_stkitem_ItemId
     JOIN stksec s ON s.stkitem_ItemId=b.stksec_stkitem_ItemId AND s.section_SecId=b.section_SecId
     WHERE b.section_SecId=? AND (i.ItemName LIKE ? OR i.ItemId LIKE ?)
     ORDER BY i.ItemName,b.ExpDate LIMIT 60`, [section,section,`%${q}%`,`%${q}%`]);
   res.json(rows.map(x=>({...x,availableQty:Math.max(0,Number(x.legacyBatchQty)-Number(x.webSoldQty))})));
  } catch (e) { console.error(e); res.status(500).json({error:'Unable to load batches'}); }
 });
 router.get('/', async (req,res) => {
  try {
   const allowed=req.webUser?.sections||[];
   const [rows] = allowed.length ? await pool.query<RowDataPacket[]>(`SELECT id,invoice_no,created_at,customer_id,section_id,grand_total,cash_amount,cheque_amount,credit_amount FROM dist_web_invoices WHERE section_id IN (${allowed.map(()=>'?').join(',')}) ORDER BY id DESC LIMIT 100`,allowed) : await pool.query<RowDataPacket[]>(`SELECT id,invoice_no,created_at,customer_id,section_id,grand_total,cash_amount,cheque_amount,credit_amount FROM dist_web_invoices ORDER BY id DESC LIMIT 100`);
   res.json(rows);
  } catch(e) {console.error(e);res.status(500).json({error:'Unable to load invoices'});}
 });
 router.get('/:id', async (req,res) => {
  try {
   const id=Number(req.params.id); if(!Number.isSafeInteger(id)||id<1) {res.status(400).json({error:'Invalid ID'});return;}
   const invoice=await readInvoice(pool,id); if(!invoice) {res.status(404).json({error:'Not found'});return;}
   if(req.webUser?.sections.length && !req.webUser.sections.includes(invoice.section_id)) {res.status(403).json({error:'Section not allowed'});return;}
   res.json(invoice);
  } catch(e){console.error(e);res.status(500).json({error:'Unable to load invoice'});}
 });
 router.post('/', async (req,res) => {
  const conn=await pool.getConnection();
  try {
   const {requestKey,sectionId,customerId,items,cashAmount,chequeAmount,creditAmount,cashTendered,chequeNo,chequeDate}=req.body || {};
   if(!req.webUser) throw fail('Login required',401);
   if(!isUUID(requestKey)) throw fail('requestKey must be a UUID');
   if(typeof sectionId!=='string'||!sectionId||typeof customerId!=='string'||!customerId) throw fail('Section and customer required');
   if(req.webUser.sections.length && !req.webUser.sections.includes(sectionId)) throw fail('Section not allowed',403);
   if(!Array.isArray(items)||items.length<1||items.length>100) throw fail('Select 1-100 items');
   if(![cashAmount,chequeAmount,creditAmount,cashTendered].every(validMoney)) throw fail('Invalid payment amount');
   if(chequeAmount>0 && (typeof chequeNo!=='string'||!chequeNo.trim()||typeof chequeDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(chequeDate))) throw fail('Cheque number and date required');
   await conn.beginTransaction();
   const [existing] = await conn.execute<RowDataPacket[]>('SELECT id,user_id FROM dist_web_invoices WHERE request_key=? FOR UPDATE',[requestKey]);
   if(existing.length) {
    if(existing[0].user_id!==req.webUser.id) throw fail('Request key already used',409);
    const invoice=await readInvoice(conn,Number(existing[0].id)); await conn.commit(); res.json(invoice);return;
   }
   const [customer] = await conn.execute<RowDataPacket[]>('SELECT RegId,BlkLst FROM cussup WHERE RegId=? LIMIT 1',[customerId]);
   if(!customer.length) throw fail('Customer not found');
   if(String(customer[0].BlkLst||'').toUpperCase()==='Y') throw fail('Customer blocked',403);
   const [section] = await conn.execute<RowDataPacket[]>('SELECT SecId FROM section WHERE SecId=? LIMIT 1',[sectionId]);
   if(!section.length) throw fail('Section not found');
   // Lock the legacy stock rows for this section, serializing simultaneous web invoice posts.
   const ids=[...new Set(items.map((x:any)=>String(x.itemId||'')))].sort();
   const [stockRows] = await conn.query<RowDataPacket[]>(`SELECT stkitem_ItemId,ItemQty FROM stksec WHERE section_SecId=? AND stkitem_ItemId IN (${ids.map(()=>'?').join(',')}) ORDER BY stkitem_ItemId FOR UPDATE`,[sectionId,...ids]);
   const stock=new Map(stockRows.map(x=>[String(x.stkitem_ItemId),Number(x.ItemQty)]));
   if(stock.size!==ids.length) throw fail('Some items do not have section stock',409);
   const prepared:{itemId:string;batchId:number;name:string;qty:number;price:number;discount:number;total:number}[]=[];
   const requestedByItem=new Map<string,number>(); const requestedByBatch=new Map<number,number>();
   for(const raw of items) {
    const itemId=String(raw.itemId||''); const batchId=Number(raw.batchId); const qty=Number(raw.qty); const discount=Number(raw.discount??0);
    if(!ids.includes(itemId)||!Number.isSafeInteger(batchId)||batchId<1||!validQty(qty)||!validMoney(discount)) throw fail('Invalid invoice item');
    const [batches]=await conn.execute<RowDataPacket[]>(`SELECT b.Id,b.Qty,b.SalePrice,i.ItemName FROM stksecdesc b JOIN stkitem i ON i.ItemId=b.stksec_stkitem_ItemId WHERE b.Id=? AND b.section_SecId=? AND b.stksec_stkitem_ItemId=? FOR UPDATE`,[batchId,sectionId,itemId]);
    if(!batches.length) throw fail(`Batch ${batchId} not found`,409);
    const price=Number(batches[0].SalePrice);
    if(!validMoney(price)||!Number.isFinite(Number(batches[0].Qty))) throw fail('Invalid legacy batch price/quantity',409);
    const gross=round2(qty*price); if(discount>gross) throw fail('Discount exceeds line value');
    prepared.push({itemId,batchId,name:String(batches[0].ItemName),qty,price,discount,total:round2(gross-discount)});
    requestedByItem.set(itemId,(requestedByItem.get(itemId)||0)+qty);
    requestedByBatch.set(batchId,(requestedByBatch.get(batchId)||0)+qty);
   }
   for(const [itemId,qty] of requestedByItem) {
    const [sold]=await conn.execute<RowDataPacket[]>(`SELECT COALESCE(SUM(w.qty),0) AS sold FROM dist_web_invoice_items w JOIN dist_web_invoices h ON h.id=w.invoice_id WHERE w.item_id=? AND h.section_id=?`,[itemId,sectionId]);
    if(qty>Number(stock.get(itemId))-Number(sold[0].sold)+0.000001) throw fail(`Insufficient section stock for ${itemId}`,409);
   }
   for(const [batchId,qty] of requestedByBatch) {
    const [batch]=await conn.execute<RowDataPacket[]>('SELECT Qty FROM stksecdesc WHERE Id=?',[batchId]);
    const [sold]=await conn.execute<RowDataPacket[]>(`SELECT COALESCE(SUM(qty),0) AS sold FROM dist_web_invoice_items WHERE batch_id=?`,[batchId]);
    if(qty>Number(batch[0].Qty)-Number(sold[0].sold)+0.000001) throw fail(`Insufficient batch stock ${batchId}`,409);
   }
   const subtotal=round2(prepared.reduce((n,x)=>n+round2(x.qty*x.price),0));
   const discounts=round2(prepared.reduce((n,x)=>n+x.discount,0)); const grand=round2(subtotal-discounts);
   if(round2(cashAmount+chequeAmount+creditAmount)!==grand) throw fail('Cash + cheque + credit must equal invoice total');
   if(cashTendered<cashAmount) throw fail('Cash tendered is less than cash payment');
   const change=round2(cashTendered-cashAmount);
   // Placeholder invoice number is replaced using the newly allocated ID within this transaction.
   const [insert]=await conn.execute<ResultSetHeader>(`INSERT INTO dist_web_invoices
     (request_key,invoice_no,section_id,customer_id,user_id,subtotal,discount_total,grand_total,cash_amount,cheque_amount,credit_amount,cash_tendered,cash_change,cheque_no,cheque_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[requestKey,`P-${requestKey.slice(0,30)}`,sectionId,customerId,req.webUser.id,subtotal,discounts,grand,cashAmount,chequeAmount,creditAmount,cashTendered,change,chequeAmount>0?chequeNo:null,chequeAmount>0?chequeDate:null]);
   const invoiceId=insert.insertId; await conn.execute('UPDATE dist_web_invoices SET invoice_no=? WHERE id=?',[`WEB-${String(invoiceId).padStart(8,'0')}`,invoiceId]);
   for(const x of prepared) await conn.execute(`INSERT INTO dist_web_invoice_items (invoice_id,item_id,batch_id,item_name,qty,unit_price,discount,line_total) VALUES (?,?,?,?,?,?,?,?)`,[invoiceId,x.itemId,x.batchId,x.name,x.qty,x.price,x.discount,x.total]);
   const invoice=await readInvoice(conn,invoiceId); await conn.commit();res.status(201).json(invoice);
  } catch(e:any) {
   try {await conn.rollback();} catch {}
   console.error('web invoice post:',e);
   res.status(e.code && Number.isInteger(e.code)?e.code:500).json({error:e.code?e.message:'Invoice posting failed'});
  } finally {conn.release();}
 });
 return router;
}
