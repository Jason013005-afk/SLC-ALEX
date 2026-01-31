import express from "express";
import cors from "cors";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { fileURLToPath } from "url";

/* =========================
   PATH SETUP (ES MODULE)
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   APP INIT
========================= */
const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

/* =========================
   SERVE FRONTEND
========================= */
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   DATA STORES
========================= */
const SAFMR_BY_ZIP = new Map();   // zip -> { hudArea, rents[] }
const FMR_BY_METRO = new Map();   // metro -> { rents[] }

/* =========================
   LOAD SAFMR (ZIP LEVEL)
========================= */
function loadSAFMR() {
  return new Promise((resolve, reject) => {
    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", (row) => {
        const zip = row["ZIP CODE"];
        const hudArea = row["HUD Area Code"];

        if (!zip || !hudArea) return;

        const rents = [
          row["SAFMR 0BR"],
          row["SAFMR 1BR"],
          row["SAFMR 2BR"],
          row["SAFMR 3BR"],
          row["SAFMR 4BR"],
        ].map(v => Number(String(v || "").replace(/[^0-9]/g, "")) || null);

        SAFMR_BY_ZIP.set(zip, { hudArea, rents });
      })
      .on("end", () => {
        console.log(`🔥 SAFMR loaded: ${SAFMR_BY_ZIP.size} ZIPs`);
        resolve();
      })
      .on("error", reject);
  });
}

/* =========================
   LOAD FMR (METRO / COUNTY)
========================= */
function loadFMR() {
  return new Promise((resolve, reject) => {
    fs.createReadStream("fy2024_fmr_county.csv")
      .pipe(csv())
      .on("data", (row) => {
        const metro = row["hud_area_code"];
        if (!metro) return;

        const rents = [
          row["fmr_0"],
          row["fmr_1"],
          row["fmr_2"],
          row["fmr_3"],
          row["fmr_4"],
        ].map(v => Number(v) || null);

        FMR_BY_METRO.set(metro, rents);
      })
      .on("end", () => {
        console.log(`🔥 FMR loaded: ${FMR_BY_METRO.size} areas`);
        resolve();
      })
      .on("error", reject);
  });
}

/* =========================
   API: HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    safmrZips: SAFMR_BY_ZIP.size,
    fmrAreas: FMR_BY_METRO.size
  });
});

/* =========================
   API: RENT LOOKUP
========================= */
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const br = Number(bedrooms);
  if (br < 0 || br > 4) {
    return res.status(400).json({ error: "bedrooms must be 0–4" });
  }

  const safmr = SAFMR_BY_ZIP.get(String(zip));

  // 1️⃣ TRY SAFMR
  if (safmr && safmr.rents[br]) {
    const rent = safmr.rents[br];
    return res.json({
      zip,
      bedrooms: br,
      source: "SAFMR",
      hudArea: safmr.hudArea,
      rent,
      paymentStandards: {
        "90%": Math.round(rent * 0.9),
        "100%": rent,
        "110%": Math.round(rent * 1.1)
      }
    });
  }

  // 2️⃣ FALL BACK TO FMR
  if (safmr && FMR_BY_METRO.has(safmr.hudArea)) {
    const rents = FMR_BY_METRO.get(safmr.hudArea);
    const rent = rents[br];

    if (rent) {
      return res.json({
        zip,
        bedrooms: br,
        source: "FMR",
        hudArea: safmr.hudArea,
        rent,
        paymentStandards: {
          "90%": Math.round(rent * 0.9),
          "100%": rent,
          "110%": Math.round(rent * 1.1)
        }
      });
    }
  }

  return res.status(404).json({
    zip,
    bedrooms: br,
    error: "No SAFMR or FMR available"
  });
});

/* =========================
   START SERVER (FAIL-LOUD)
========================= */
(async () => {
  try {
    await loadSAFMR();
    await loadFMR();

    app.listen(PORT, () => {
      console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
    });
  } catch (err) {
    console.error("❌ FATAL STARTUP ERROR:", err);
    process.exit(1);
  }
})();