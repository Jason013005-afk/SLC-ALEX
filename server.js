require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static('public'));

/* =========================
   LOAD HUD DATA (ONCE)
========================= */

console.log('🔄 Loading HUD data...');

// ---- ZIP → CBSA CROSSWALK ----
const zipCbsaCsv = fs.readFileSync(
  path.join(__dirname, 'hud_zip_metro_crosswalk.csv'),
  'utf8'
);

const zipCbsaRows = parse(zipCbsaCsv, {
  columns: true,
  skip_empty_lines: true,
});

const zipToCbsa = {};
zipCbsaRows.forEach(row => {
  if (row.ZIP && row.CBSA && row.TOT_RATIO && Number(row.TOT_RATIO) > 0.5) {
    zipToCbsa[row.ZIP] = row.CBSA;
  }
});

console.log(`🔗 ZIP→CBSA loaded: ${Object.keys(zipToCbsa).length}`);

// ---- SAFMR (ZIP-LEVEL) ----
const safmrCsv = fs.readFileSync(
  path.join(__dirname, 'fy2024_safmrs.clean.csv'),
  'utf8'
);

const safmrRows = parse(safmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

const safmrByZip = {};
safmrRows.forEach(row => {
  safmrByZip[row['ZIP CODE']] = row;
});

console.log(`🏠 SAFMR loaded: ${Object.keys(safmrByZip).length}`);

// ---- FMR (CBSA-LEVEL) ----
const fmrCsv = fs.readFileSync(
  path.join(__dirname, 'fy2024_fmr_metro.csv'),
  'utf8'
);

const fmrRows = parse(fmrCsv, {
  columns: true,
  skip_empty_lines: true,
});

const fmrByCbsa = {};
fmrRows.forEach(row => {
  if (row['HUD Metro FMR Area']) {
    fmrByCbsa[row['HUD Metro FMR Area']] = row;
  }
});

console.log(`🌆 FMR loaded: ${Object.keys(fmrByCbsa).length}`);
console.log('✅ HUD data loaded');

/* =========================
   API: ANALYZE
========================= */

app.post('/api/analyze', (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: 'ZIP and bedrooms required' });
  }

  console.log(`📍 Analyze request: ZIP=${zip}, BR=${bedrooms}`);

  // 1️⃣ TRY SAFMR FIRST
  const safmr = safmrByZip[zip];
  if (safmr) {
    const key = `SAFMR ${bedrooms}BR`;
    const rent = safmr[key];

    if (rent) {
      console.log('✅ SAFMR used');
      return res.json({
        source: 'SAFMR',
        zip,
        bedrooms,
        rent: Number(rent),
      });
    }
  }

  // 2️⃣ FALLBACK TO FMR
  const cbsa = zipToCbsa[zip];
  if (!cbsa) {
    console.log('❌ No CBSA mapping');
    return res.json({
      error: 'No SAFMR and no CBSA mapping for ZIP',
      zip,
    });
  }

  const fmr = fmrByCbsa[cbsa];
  if (!fmr) {
    console.log('❌ CBSA found but no FMR row');
    return res.json({
      error: 'CBSA found but no FMR data',
      zip,
      cbsa,
    });
  }

  const fmrKey = `FMR ${bedrooms}BR`;
  const rent = fmr[fmrKey];

  if (!rent) {
    console.log('❌ FMR bedroom column missing');
    return res.json({
      error: 'FMR bedroom column missing',
      zip,
      cbsa,
    });
  }

  console.log('✅ FMR used');
  res.json({
    source: 'FMR',
    zip,
    cbsa,
    bedrooms,
    rent: Number(rent),
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});