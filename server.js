import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

const app = express();
const PORT = 8080;

/* -------------------------
   Middleware
------------------------- */
app.use(express.json());
app.use(express.static("public"));

/* -------------------------
   In-memory data stores
------------------------- */
const SAFMR_BY_ZIP = {};
const ZIP_TO_CBSA = {};
const FMR_BY_CBSA = {};

/* -------------------------
   Utility: Load CSV
------------------------- */
function loadCSV(filePath, onRow) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", onRow)
      .on("end", resolve)
      .on("error", reject);
  });
}

/* -------------------------
   Load HUD Data at Startup
------------------------- */
async function loadData() {
  console.log("🔄 Loading HUD data...");

  // SAFMR (ZIP → Rent)
  await loadCSV("fy2024_safmrs.clean.csv", (row) => {
    const zip = row["ZIP Code"] || row["ZIP"];
    if (!zip) return;

    SAFMR_BY_ZIP[zip] = {
      0: Number(row["SAFMR 0BR"]),
      1: Number(row["SAFMR 1BR"]),
      2: Number(row["SAFMR 2BR"]),
      3: Number(row["SAFMR 3BR"]),
      4: Number(row["SAFMR 4BR"]),
    };
  });

  // ZIP → CBSA Crosswalk
  await loadCSV("hud_zip_metro_crosswalk.csv", (row) => {
    const zip = row["ZIP"];
    const cbsa = row["CBSA"];
    if (!zip || !cbsa) return;

    // Prefer residential ratio if duplicates exist
    if (!ZIP_TO_CBSA[zip]) {
      ZIP_TO_CBSA[zip] = cbsa;
    }
  });

  // Metro FMR (CBSA → Rent)
  await loadCSV("fy2024_fmr_metro.csv", (row) => {
    const cbsa = row["CBSASub23"];
    if (!cbsa) return;

    FMR_BY_CBSA[cbsa] = {
      0: Number(row["erap_fmr_br0"]),
      1: Number(row["erap_fmr_br1"]),
      2: Number(row["erap_fmr_br2"]),
      3: Number(row["erap_fmr_br3"]),
      4: Number(row["erap_fmr_br4"]),
      name: row["HUD Metro Fair Market Rent Area Name"],
    };
  });

  console.log("✅ HUD data loaded");
}

/* -------------------------
   Routes
------------------------- */
app.get("/", (_, res) => res.sendFile(path.resolve("public/index.html")));
app.get("/system", (_, res) => res.sendFile(path.resolve("public/system.html")));
app.get("/pricing", (_, res) => res.sendFile(path.resolve("public/pricing.html")));
app.get("/contact", (_, res) => res.sendFile(path.resolve("public/contact.html")));

/* -------------------------
   Core API: Analyze
------------------------- */
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "ZIP and bedrooms are required",
    });
  }

  // 1️⃣ SAFMR first
  if (SAFMR_BY_ZIP[zip]?.[bedrooms]) {
    return res.json({
      source: "SAFMR",
      zip,
      bedrooms,
      rent: SAFMR_BY_ZIP[zip][bedrooms],
    });
  }

  // 2️⃣ Fallback: ZIP → CBSA → FMR
  const cbsa = ZIP_TO_CBSA[zip];
  if (cbsa && FMR_BY_CBSA[cbsa]?.[bedrooms]) {
    return res.json({
      source: "FMR",
      zip,
      bedrooms,
      cbsa,
      metro: FMR_BY_CBSA[cbsa].name,
      rent: FMR_BY_CBSA[cbsa][bedrooms],
    });
  }

  // 3️⃣ No data
  return res.status(404).json({
    error: "No HUD rent data found for this ZIP",
  });
});

/* -------------------------
   Start Server
------------------------- */
loadData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
});