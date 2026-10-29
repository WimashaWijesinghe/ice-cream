import { Router, Request, Response } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';

// Mount behind requireWebAuth and your invoice-view permission middleware.
export function invoiceRouter(pool: Pool) {
  const router = Router();
  router.get('/recent', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT TraNo, BillNo, TraDat, cussup_RegId AS customerId,
               MAX(tim) AS lastSavedAt, COUNT(*) AS lineCount,
               MAX(cashPay) AS cashPay, MAX(chqPay) AS chequePay,
               MAX(credit) AS creditPay
        FROM stksale
        WHERE TraNo IS NOT NULL AND TraNo <> '-'
        GROUP BY TraNo, BillNo, TraDat, cussup_RegId
        ORDER BY TraDat DESC, lastSavedAt DESC
        LIMIT ?`, [limit]);
      res.json({ items: rows, note: 'Payment columns may repeat per item; totals require legacy-rule verification.' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Could not load invoices' }); }
  });

  router.get('/detail', async (req: Request, res: Response) => {
    const traNo = String(req.query.traNo ?? '');
    const billNo = String(req.query.billNo ?? '');
    const customerId = String(req.query.customerId ?? '');
    const date = String(req.query.date ?? '');
    if (!traNo || !billNo || !customerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'traNo, billNo, customerId and date (YYYY-MM-DD) required' });
    }
    try {
      const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT s.SaleId, s.TraNo, s.BillNo, s.TraDat, s.cussup_RegId,
               c.Name AS customerName, s.stkitem_ItemId AS itemId,
               i.ItemName AS itemName, s.SaleQty, s.SalePrc, s.TotBal,
               s.DiscAmount, s.RtnDeduct, s.cashPay, s.chqPay, s.credit,
               s.totAmount, s.SpecialDiscount, s.ExpDate, s.SaleType
        FROM stksale s
        JOIN cussup c ON c.RegId=s.cussup_RegId
        JOIN stkitem i ON i.ItemId=s.stkitem_ItemId
        WHERE s.TraNo=? AND s.BillNo=? AND s.cussup_RegId=? AND s.TraDat=?
        ORDER BY s.SaleId`, [traNo, billNo, customerId, date]);
      if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
      res.json({ items: rows, verifiedTotals: false,
        warning: 'Legacy TotBal/totAmount/payment fields must not be blindly summed. Read-only print preview.' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Could not load invoice' }); }
  });

  router.post('/post', (_req: Request, res: Response) => {
    res.status(423).json({ error: 'Posting locked until legacy invoice numbering, stock batches, returns, payment ledger and credit accounting are reconciled on a test database.' });
  });
  return router;
}
