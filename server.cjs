// ==============================
// ALEX — SINGLE SOURCE OF TRUTH
// Backend: Express + HUD SAFMR + HUD FMR (ZIP → CBSA fallback)
// Runtime: Node 18+
// Module system: CommonJS (.cjs)
// ==============================

require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public"));

// ==============================
// IN-MEMORY STORES
// ==============================
const SAFMR = new Map();        // key: zip-bedrooms
const FMR = new Map();          // key: cbsa-bedrooms
const ZIP_TO_CBSA = new Map();  // key: zip → cbsa

// ==============================
// HELPERS
// ==============================
const normZip = z => z?.toString().trim().padStart(5, "0");
const money = v =>
  Number(String(v || "").replace(/[^0-9.]/g, "")) || 0;

// ==============================
// LOAD ZIP → CBSA
// ==============================
function loadZipToCbsa() {
  return new Promise(resolve => {
    fs.createReadStream("hud_zip_metro_crosswalk.csv")
      .pipe(csv())
      .on("data", r => {
        const zip = normZip(r.ZIP);
        const cbsa = r.CBSA;
        if (zip && cbsa && !ZIP_TO_CBSA.has(zip)) {
          ZIP_TO_CBSA.set(zip, cbsa);
        }
      })
      .on("end", () => {
        console.log(`🔗 ZIP→CBSA loaded: ${ZIP_TO_CBSA.size}`);
        resolve();
      });
  });
}

// ==============================
// LOAD SAFMR (ZIP-LEVEL)
// ==============================
function loadSafmr() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", r => {
        const zip = normZip(r["ZIP Code"]);
        if (!zip) return;

        for (let b = 0; b <= 4; b++) {
          const rent = money(r[`SAFMR ${b}BR`]);
          if (!rent) continue;

          SAFMR.set(`${zip}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "SAFMR"
          });
        }
      })
      .on("end", () => {
        console.log(`🏠 SAFMR loaded: ${SAFMR.size}`);
        resolve();
      });
  });
}

// ==============================
// LOAD FMR (CBSA-LEVEL)
// ==============================
function loadFmr() {
  return new Promise(resolve => {
    fs.createReadStream("fy2024_fmr_metro.csv")
      .pipe(csv())
      .on("data", r => {
        const cbsa = r.CBSASub23 || r.CBSA;
        if (!cbsa) return;

        for (let b = 0; b <= 4; b++) {
          const rent = money(r[`erap_fmr_br${b}`]);
          if (!rent) continue;

          FMR.set(`${cbsa}-${b}`, {
            rent,
            p90: Math.round(rent * 0.9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "FMR"
          });
        }
      })
      .on("end", () => {
        console.log(`🌆 FMR loaded: ${FMR.size}`);
        resolve();
      });
  });
}

// ==============================
// API — ANALYZE
// ==============================
app.post("/api/analyze", (req, res) => {
  const zip = normZip(req.body.zip);
  const beds = Number(req.body.bedrooms ?? 0);

  if (!zip) {
    return res.status(400).json({ error: "Invalid ZIP" });
  }

  // 1️⃣ SAFMR FIRST
  const safmr = SAFMR.get(`${zip}-${beds}`);
  if (safmr) {
    return res.json({ zip, bedrooms: beds, ...safmr });
  }

  // 2️⃣ FALLBACK → FMR
  const cbsa = ZIP_TO_CBSA.get(zip);
  if (cbsa) {
    const fmr = FMR.get(`${cbsa}-${beds}`);
    if (fmr) {
      return res.json({
        zip,
        bedrooms: beds,
        cbsa,
        ...fmr
      });
    }
  }

  // 3️⃣ NOTHING FOUND
  return res.json({
    error: "No rent data found",
    zip,
    bedrooms: beds
  });
});

// ==============================
// BOOT
// ==============================
(async () => {
  console.log("🔄 Loading HUD data...");
  await loadZipToCbsa();
  await loadSafmr();
  await loadFmr();

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
})();