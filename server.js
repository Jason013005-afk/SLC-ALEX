import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// DATA STORES
// ===============================
const SAFMR = new Map(); // key: ZIP-BEDS
const FMR = new Map();   // key: ZIP-BEDS

const normalizeZip = z =>
  z?.toString().replace(/\D/g, "").padStart(5, "0");

// ===============================
// LOAD SAFMR (ZIP-BASED)
// ===============================
async function loadSAFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row["ZIP CODE"]);
        if (!zip) return;

        const beds = [
          ["0", "SAFMR 0BR"],
          ["1", "SAFMR 1BR"],
          ["2", "SAFMR 2BR"],
          ["3", "SAFMR 3BR"],
          ["4", "SAFMR 4BR"]
        ];

        beds.forEach(([b, col]) => {
          const rent = Number(row[col]);
          if (!rent) return;

          SAFMR.set(`${zip}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "SAFMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🔥 SAFMR loaded: ${SAFMR.size} records`);
        resolve();
      });
  });
}

// ===============================
// LOAD FMR (ZIP FALLBACK)
// ===============================
async function loadFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("data", row => {
        // HUD ships this column literally as "ZIP\nCode"
        const zip = normalizeZip(row["ZIP\nCode"]);
        if (!zip) return;

        const beds = [
          ["0", "erap_fmr_br0"],
          ["1", "erap_fmr_br1"],
          ["2", "erap_fmr_br2"],
          ["3", "erap_fmr_br3"],
          ["4", "erap_fmr_br4"]
        ];

        beds.forEach(([b, col]) => {
          const rent = Number(row[col]);
          if (!rent) return;

          FMR.set(`${zip}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "FMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🔥 FMR loaded: ${FMR.size} records`);
        resolve();
      });
  });
}

// ===============================
// API: ANALYZE (SAFMR → FMR FALLBACK)
// ===============================
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  const z = normalizeZip(zip);
  const b = String(bedrooms ?? 0);
  const key = `${z}-${b}`;

  const safmr = SAFMR.get(key);
  const fmr = FMR.get(key);

  if (safmr) {
    return res.json({
      zip: z,
      bedrooms: Number(b),
      ...safmr
    });
  }

  if (fmr) {
    return res.json({
      zip: z,
      bedrooms: Number(b),
      ...fmr
    });
  }

  return res.json({
    error: "No HUD rent data found",
    zip: z,
    bedrooms: Number(b)
  });
});

// ===============================
// PAGE ROUTES (EXPRESS 5 SAFE)
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
await loadFMR();

app.listen(8080, () => {
  console.log("🚀 ALEX running at http://127.0.0.1:8080");
});