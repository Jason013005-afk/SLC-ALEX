/**
 * ALEX – FINAL STABLE SERVER
 * - CommonJS (.cjs)
 * - SAFMR ONLY (HUD 2024)
 * - Static frontend support
 * - No over-engineering
 */

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   LOAD SAFMR DATA (ONCE)
========================= */

console.log("🔄 Loading SAFMR data...");

const SAFMR_FILE = path.join(__dirname, "fy2024_safmrs.clean.csv");

let safmrByZip = {};

try {
  const csv = fs.readFileSync(SAFMR_FILE, "utf8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  });

  rows.forEach((row) => {
    const zip = String(row["ZIP Code"]).padStart(5, "0");

    safmrByZip[zip] = {
      metro: row["HUD Metro Fair Market Rent Area Name"],
      rents: {
        0: row["SAFMR 0BR"],
        1: row["SAFMR 1BR"],
        2: row["SAFMR 2BR"],
        3: row["SAFMR 3BR"],
        4: row["SAFMR 4BR"],
      },
    };
  });

  console.log(`🏠 SAFMR loaded: ${Object.keys(safmrByZip).length}`);
} catch (err) {
  console.error("❌ Failed to load SAFMR CSV:", err.message);
  process.exit(1);
}

/* =========================
   HELPERS
========================= */

function parseRent(value) {
  if (!value) return null;
  return Number(String(value).replace(/[^0-9]/g, ""));
}

/* =========================
   API ROUTES
========================= */

app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms are required",
    });
  }

  const z = String(zip).padStart(5, "0");
  const b = Number(bedrooms);

  const record = safmrByZip[z];
  if (!record) {
    return res.status(404).json({
      error: "No SAFMR data found",
      zip: z,
      bedrooms: b,
    });
  }

  const rentRaw = record.rents[b];
  const rent = parseRent(rentRaw);

  if (!rent) {
    return res.status(404).json({
      error: "No rent data for bedroom count",
      zip: z,
      bedrooms: b,
    });
  }

  res.json({
    zip: z,
    bedrooms: b,
    rent,
    source: "HUD SAFMR 2024",
    metro: record.metro,
  });
});

/* =========================
   FRONTEND FALLBACKS
========================= */

// Explicit routes (avoids “Cannot GET /system.html” confusion)
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/system.html", (_, res) =>
  res.sendFile(path.join(__dirname, "public/system.html"))
);

app.get("/contact.html", (_, res) =>
  res.sendFile(path.join(__dirname, "public/contact.html"))
);

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});