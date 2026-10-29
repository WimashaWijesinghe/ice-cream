import { Router } from 'express';
import type { Pool, RowDataPacket } from 'mysql2/promise';

/** READ-ONLY starter. Mount behind existing authentication + permission middleware. */
export function legacyPosRouter(pool: Pool) {
  const router = Router();
  router.get('/sections', async (_req, res) => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT SecId AS id, SecName AS name, SecType AS type FROM section ORDER BY SecName LIMIT 500'
      );
      res.json(rows);
    } catch (err) { console.error('sections', err); res.status(500).json({ error: 'Unable to load sections' }); }
  });
  router.get('/lines', async (req, res) => {
    try {
      const section = String(req.query.section ?? '').trim();
      const [rows] = section
        ? await pool.execute<RowDataPacket[]>('SELECT LinId AS id, LineName AS name, section_SecId AS sectionId FROM `line` WHERE section_SecId = ? ORDER BY LineName LIMIT 500', [section])
        : await pool.query<RowDataPacket[]>('SELECT LinId AS id, LineName AS name, section_SecId AS sectionId FROM `line` ORDER BY LineName LIMIT 500');
      res.json(rows);
    } catch (err) { console.error('lines', err); res.status(500).json({ error: 'Unable to load lines' }); }
  });
  router.get('/customers', async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim().slice(0, 80);
      const lineId = String(req.query.lineId ?? '').trim();
      const filters = ['(RegId LIKE ? OR Name LIKE ? OR sName LIKE ?)'];
      const args: string[] = [`%${q}%`, `%${q}%`, `%${q}%`];
      if (lineId) { filters.push('LineId = ?'); args.push(lineId); }
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT RegId AS id, Name AS name, sName AS shortName, Address AS address, LineId AS lineId, CreditLimit AS creditLimit, BlkLst AS blocked FROM cussup WHERE ${filters.join(' AND ')} ORDER BY Name LIMIT 40`, args
      );
      res.json(rows);
    } catch (err) { console.error('customers', err); res.status(500).json({ error: 'Unable to load customers' }); }
  });
  router.get('/items', async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim().slice(0, 80);
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT i.ItemId AS id, i.ItemName AS name, i.barcode, i.MeasuringUnit AS unit, i.UnitPerCase AS unitsPerCase, i.MaxDiscountPerc AS maxDiscountPercent, s.ItemQty AS sectionQty FROM stkitem i LEFT JOIN stksec s ON s.stkitem_ItemId = i.ItemId AND s.section_SecId = ? WHERE (i.ItemId LIKE ? OR i.ItemName LIKE ? OR i.barcode LIKE ?) ORDER BY i.ItemName LIMIT 40`,
        [String(req.query.section ?? ''), `%${q}%`, `%${q}%`, `%${q}%`]
      );
      res.json(rows);
    } catch (err) { console.error('items', err); res.status(500).json({ error: 'Unable to load items' }); }
  });
  return router;
}
