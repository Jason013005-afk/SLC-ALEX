/**
 * ALEX – Single Source of Truth Server
 * HUD SAFMR 2024 ONLY
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const cors = require("cors");

const PORT = 8080;
const app = express();

/* -------------------- Middleware -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- HUD DATA -------------------- */
const SAFMR_FILE = path.join(__dirname, "fy2024_safmrs.clean.csv");
const safmrByZip = new Map();

/* -------------------- Load SAFMR CSV -------------------- */
function loadSAFMR() {
  return new Promise((resolve, reject) => {
    let count = 0;

    fs.createReadStream(SAFMR_FILE)
      .pipe(csv())
      .on("data", row => {
        const zip = String(row["ZIP Code"]).trim();
        if (!zip) return;

        safmrByZip.set(zip, row);
        count++;
      })
      .on("end", () => {
        console.log(`🏠 SAFMR loaded: ${count}`);
        resolve();
      })
      .on("error", reject);
  });
}

/* -------------------- API -------------------- */
app.post("/api/analyze", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const row = safmrByZip.get(String(zip));
  if (!row) {
    return res.status(404).json({
      error: "No HUD SAFMR data found",
      zip,
      bedrooms
    });
  }

  const col = `SAFMR ${bedrooms}BR`;
  const raw = row[col];

  if (!raw) {
    return res.status(404).json({
      error: `No SAFMR for ${bedrooms}BR`,
      zip
    });
  }

  const rent = Number(raw.replace(/[$,]/g, ""));

  res.json({
    zip: String(zip),
    bedrooms: Number(bedrooms),
    rent,
    source: "HUD SAFMR 2024",
    metro: row["HUD Metro Fair Market Rent Area Name"]
  });
});

/* -------------------- Frontend Routes -------------------- */
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/system.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "system.html"))
);

app.get("/contact.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "contact.html"))
);

/* -------------------- Boot -------------------- */
(async () => {
  console.log("🔄 Loading HUD data...");
  await loadSAFMR();
  console.log("✅ HUD data loaded");

  app.listen(PORT, () => {
    console.log(`🚀 ALEX running at http://localhost:${PORT}`);
  });
})();