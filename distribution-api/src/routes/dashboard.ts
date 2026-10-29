import { Router } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";

// Read-only dashboard counts. Mount behind authentication before production.
export function dashboardRouter(pool: Pool) {
  const router = Router();
  router.get("/overview", async (_req, res) => {
    try {
      const [[sections], [lines], [customers], [items], [businesses]] = await Promise.all([
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM section"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM `line`"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM cussup"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM stkitem"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM business"),
      ]);
      res.json({ businesses: businesses[0].total, sections: sections[0].total, lines: lines[0].total, customers: customers[0].total, items: items[0].total });
    } catch (error) {
      console.error("dashboard overview", error);
      res.status(500).json({ error: "Unable to load dashboard" });
    }
  });
  return router;
}
