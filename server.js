import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

// ===============================
// PATH SETUP
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// APP SETUP
// ===============================
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DATA STORES
// ===============================
const SAFMR = new Map();

const normalizeZip = z =>
  z ? z.toString().trim().padStart(5, "0") : null;

const parseMoney = v =>
  Number(String(v ?? "").replace(/,/g, ""));

// ===============================
// LOAD SAFMR (ZIP-BASED)
// ===============================
function loadSAFMR() {
  return new Promise(resolve => {
    let count = 0;

    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row["ZIP CODE"]);
        if (!zip) return;

        const beds = [
          ["0", "SAFMR 0BR", "SAFMR 0BR - 90% Payment Standard", "SAFMR 0BR - 110% Payment Standard"],
          ["1", "SAFMR 1BR", "SAFMR 1BR - 90% Payment Standard", "SAFMR 1BR - 110% Payment Standard"],
          ["2", "SAFMR 2BR", "SAFMR 2BR - 90% Payment Standard", "SAFMR 2BR - 110% Payment Standard"],
          ["3", "SAFMR 3BR", "SAFMR 3BR - 90% Payment Standard", "SAFMR 3BR - 110% Payment Standard"],
          ["4", "SAFMR 4BR", "SAFMR 4BR - 90% Payment Standard", "SAFMR 4BR - 110% Payment Standard"]
        ];

        for (const [b, base, p90c, p110c] of beds) {
          const rent = parseMoney(row[base]);
          if (!Number.isFinite(rent) || rent <= 0) continue;

          SAFMR.set(`${zip}-${b}`, {
            rent,
            p90: parseMoney(row[p90c]) || Math.round(rent * 0.9),
            p100: rent,
            p110: parseMoney(row[p110c]) || Math.round(rent * 1.1),
            source: "SAFMR"
          });

          count++;
        }
      })
      .on("end", () => {
        console.log(`🔥 SAFMR loaded: ${count} records`);
        resolve();
      });
  });
}

// ===============================
// API: ANALYZE
// ===============================
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  const z = normalizeZip(zip);
  const b = String(bedrooms ?? 0);
  const key = `${z}-${b}`;

  const result = SAFMR.get(key);

  if (!result) {
    return res.json({
      error: "No SAFMR data found",
      zip: z,
      bedrooms: Number(b)
    });
  }

  res.json({
    zip: z,
    bedrooms: Number(b),
    ...result
  });
});

// ===============================
// PAGE ROUTES (NO WILDCARDS)
// ===============================
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/system", (_, res) =>
  res.sendFile(path.join(__dirname, "public/system.html"))
);

app.get("/pricing", (_, res) =>
  res.sendFile(path.join(__dirname, "public/pricing.html"))
);

app.get("/contact", (_, res) =>
  res.sendFile(path.join(__dirname, "public/contact.html"))
);

// ===============================
// START SERVER
// ===============================
await loadSAFMR();

app.listen(8080, () => {
  console.log("🚀 ALEX running at http://127.0.0.1:8080");
});