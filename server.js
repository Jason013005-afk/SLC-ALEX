const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = 8080;

/* ================================
   Middleware
================================ */
app.use(express.json());
app.use(express.static("public"));

/* ================================
   Load HUD Data ONCE at startup
================================ */
console.log("🔄 Loading HUD data...");

function loadCSV(filePath) {
  const raw = fs.readFileSync(filePath);
  return parse(raw, {
    columns: true,
    skip_empty_lines: true
  });
}

// SAFMR (ZIP-level, sparse)
const safmrData = loadCSV("fy2024_safmrs.clean.csv");

// FMR (Metro-level)
const fmrData = loadCSV("fy2024_fmr_metro.csv");

// ZIP → CBSA crosswalk
const zipCbsaData = loadCSV("hud_zip_metro_crosswalk.csv");

// Build fast lookup maps
const safmrByZip = {};
safmrData.forEach(r => {
  safmrByZip[r["ZIP CODE"]] = r;
});

const fmrByCbsa = {};
fmrData.forEach(r => {
  fmrByCbsa[r["CBSA"]] = r;
});

const cbsaByZip = {};
zipCbsaData.forEach(r => {
  // prefer residential-weighted rows
  if (!cbsaByZip[r.ZIP] || Number(r.RES_RATIO) > Number(cbsaByZip[r.ZIP].RES_RATIO)) {
    cbsaByZip[r.ZIP] = r;
  }
});

console.log("✅ HUD data loaded");

/* ================================
   Routes (Pages)
================================ */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/system", (req, res) => res.sendFile(path.join(__dirname, "public/system.html")));
app.get("/pricing", (req, res) => res.sendFile(path.join(__dirname, "public/pricing.html")));
app.get("/contact", (req, res) => res.sendFile(path.join(__dirname, "public/contact.html")));

/* ================================
   Core API: Rent Analysis
================================ */
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "ZIP and bedrooms required" });
  }

  const zipStr = zip.toString().padStart(5, "0");
  const bedKey = `SAFMR ${bedrooms}BR`;

  /* ---- 1️⃣ Try SAFMR ---- */
  if (safmrByZip[zipStr] && safmrByZip[zipStr][bedKey]) {
    return res.json({
      source: "SAFMR",
      zip: zipStr,
      bedrooms,
      rent: Number(safmrByZip[zipStr][bedKey])
    });
  }

  /* ---- 2️⃣ Fallback to FMR ---- */
  const crosswalk = cbsaByZip[zipStr];
  if (!crosswalk) {
    return res.status(404).json({
      error: "No HUD data for ZIP",
      zip: zipStr
    });
  }

  const cbsa = crosswalk.CBSA;
  const fmrRow = fmrByCbsa[cbsa];
  const fmrKey = `${bedrooms}BR`;

  if (!fmrRow || !fmrRow[fmrKey]) {
    return res.status(404).json({
      error: "No FMR data for CBSA",
      zip: zipStr,
      cbsa
    });
  }

  return res.json({
    source: "FMR",
    zip: zipStr,
    cbsa,
    bedrooms,
    rent: Number(fmrRow[fmrKey])
  });
});

/* ================================
   Start Server
================================ */
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});