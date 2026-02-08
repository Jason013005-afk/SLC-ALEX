/**
 * ALEX – Core Server
 * HUD SAFMR + FMR with ZIP → CBSA fallback
 * Node 20 / Express 4
 */

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
const PORT = process.env.PORT || 8080;

/* -------------------- Middleware -------------------- */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- In-Memory Stores -------------------- */

const SAFMR = new Map();          // key: ZIP-BR
const FMR = new Map();            // key: CBSA-BR
const ZIP_TO_CBSA = new Map();    // key: ZIP → best CBSA

/* -------------------- Utilities -------------------- */

const normalizeZip = z =>
  z ? z.toString().trim().padStart(5, "0") : "";

const cleanMoney = v =>
  Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

/* -------------------- Load ZIP → CBSA -------------------- */

function loadZipToCBSA() {
  return new Promise(resolve => {
    fs.createReadStream("hud_zip_metro_crosswalk.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row.ZIP);
        const cbsa = row.CBSA;
        const ratio = Number(row.TOT_RATIO || 0);

        if (!zip || !cbsa) return;

        // Keep the CBSA with the strongest residential ratio
        const existing = ZIP_TO_CBSA.get(zip);
        if (!existing || ratio > existing.ratio) {
          ZIP_TO_CBSA.set(zip, { cbsa, ratio });
        }
      })
      .on("end", () => {
        console.log(`🔗 ZIP→CBSA loaded: ${ZIP_TO_CBSA.size}`);
        resolve();
      });
  });
}

/* -------------------- Load SAFMR -------------------- */

function loadSAFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {
        const zip = normalizeZip(row["ZIP Code"]);
        if (!zip) return;

        const beds = [
          ["0", "SAFMR 0BR"],
          ["1", "SAFMR 1BR"],
          ["2", "SAFMR 2BR"],
          ["3", "SAFMR 3BR"],
          ["4", "SAFMR 4BR"]
        ];

        beds.forEach(([br, col]) => {
          const rent = cleanMoney(row[col]);
          if (!rent) return;

          SAFMR.set(`${zip}-${br}`, {
            rent,
            source: "SAFMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);
        resolve();
      });
  });
}

/* -------------------- Load FMR -------------------- */

function loadFMR() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("data", row => {
        const cbsa = row["CBSA"];
        if (!cbsa) return;

        const beds = [
          ["0", "erap_fmr_br0"],
          ["1", "erap_fmr_br1"],
          ["2", "erap_fmr_br2"],
          ["3", "erap_fmr_br3"],
          ["4", "erap_fmr_br4"]
        ];

        beds.forEach(([br, col]) => {
          const rent = cleanMoney(row[col]);
          if (!rent) return;

          FMR.set(`${cbsa}-${br}`, {
            rent,
            source: "FMR"
          });
        });
      })
      .on("end", () => {
        console.log(`🌆 FMR loaded: ${FMR.size}`);
        resolve();
      });
  });
}

/* -------------------- API -------------------- */

app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms = 0 } = req.body;

  const z = normalizeZip(zip);
  const b = String(bedrooms);

  if (!z) {
    return res.status(400).json({ error: "ZIP required" });
  }

  /* 1️⃣ Try SAFMR */
  const safmr = SAFMR.get(`${z}-${b}`);
  if (safmr) {
    return res.json({
      zip: z,
      bedrooms: Number(b),
      ...safmr
    });
  }

  /* 2️⃣ Fallback → ZIP → CBSA → FMR */
  const cbsaEntry = ZIP_TO_CBSA.get(z);
  if (!cbsaEntry) {
    return res.json({
      error: "No HUD data found",
      zip: z,
      bedrooms: Number(b)
    });
  }

  const fmr = FMR.get(`${cbsaEntry.cbsa}-${b}`);
  if (!fmr) {
    return res.json({
      error: "No HUD data found",
      zip: z,
      bedrooms: Number(b)
    });
  }

  return res.json({
    zip: z,
    bedrooms: Number(b),
    cbsa: cbsaEntry.cbsa,
    ...fmr
  });
});

/* -------------------- Pages -------------------- */

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

/* -------------------- Boot -------------------- */

(async () => {
  console.log("🔄 Loading HUD data...");
  await loadZipToCBSA();
  await loadSAFMR();
  await loadFMR();
  console.log("✅ HUD data loaded");

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
})();