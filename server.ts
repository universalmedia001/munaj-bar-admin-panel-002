import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { handleAdminDeleteWorker } from "./server/adminDeleteWorker";
import { handleAdminDeleteShift } from "./server/adminDeleteShift";
import { handleAdminDeleteRecord } from "./server/adminDeleteRecord";
import { handleAdminEnsureProfile } from "./server/adminEnsureProfile";
import { handleQzPrintApi } from "./server/qzPrintApi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(async (req, res, next) => {
    const handled = await handleQzPrintApi(req, res);
    if (handled) return;
    next();
  });

  // 2. Admin worker deletion endpoint
  app.use(async (req, res, next) => {
    if (req.url && req.url.startsWith("/api/admin/delete-worker")) {
      const handled = await handleAdminDeleteWorker(req, res);
      if (handled) return;
    }
    next();
  });

  // 2.1 Admin shift deletion endpoint
  app.use(async (req, res, next) => {
    if (req.url && req.url.startsWith("/api/admin/delete-shift")) {
      const handled = await handleAdminDeleteShift(req, res);
      if (handled) return;
    }
    next();
  });

  // 2.2 Admin generic record deletion endpoint (products, categories, sales, prints, notifications, logs, movements)
  app.use(async (req, res, next) => {
    if (req.url && req.url.startsWith("/api/admin/delete-record")) {
      const handled = await handleAdminDeleteRecord(req, res);
      if (handled) return;
    }
    next();
  });

  // 2.3 Admin ensure profile endpoint (for verified admin profile synchronization)
  app.use(async (req, res, next) => {
    if (req.url && req.url.startsWith("/api/admin/ensure-profile")) {
      const handled = await handleAdminEnsureProfile(req, res);
      if (handled) return;
    }
    next();
  });

  // 3. Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
