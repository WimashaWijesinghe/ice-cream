import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import pool from "./config/db";
import { dashboardRouter } from "./routes/dashboard";
import { legacyPosRouter } from "./routes/legacyPos";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import {
  requireWebAuth,
  requirePermission
} from "./middleware/auth";
import { invoiceRouter } from "./routes/invoices";
import { webSalesRouter } from "./routes/webSales";

const app = express();

app.use(helmet());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name"
    );

    res.json({
      success: true,
      message: "Distribution API connected",
      database: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = Number(process.env.PORT || 5000);
app.use(cookieParser());

app.use("/api/auth", authRouter(pool));

app.use(
  "/api/dashboard",
  requireWebAuth(pool),
  dashboardRouter(pool)
);

app.use(
  "/api/legacy-pos",
  requireWebAuth(pool),
  requirePermission("FRM_POS"),
  legacyPosRouter(pool)
);
app.use(
  "/api/invoices",
  requireWebAuth(pool),
  invoiceRouter(pool)
);
app.use(
  "/api/web-sales",
  requireWebAuth(pool),
  requirePermission("FRM_POS"),
  webSalesRouter(pool)
);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});