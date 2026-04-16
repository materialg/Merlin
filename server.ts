import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini Proxy Routes
  app.post("/api/gemini/:action", async (req, res) => {
    const { action } = req.params;
    const { args } = req.body;

    try {
      const gemini = await import("./src/services/gemini.ts");
      const fn = (gemini as any)[action];
      
      if (typeof fn !== "function") {
        return res.status(400).json({ error: `Invalid action: ${action}` });
      }

      const result = await fn(...args);
      res.json(result);
    } catch (error: any) {
      console.error(`Gemini Proxy Error (${action}):`, error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
