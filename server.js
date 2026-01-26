import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 8080;
const CSV_PATH = path.join(process.cwd(), "fy2024_safmrs.csv");

let hudData = [];

/* -------------------- HELPERS -------------------- */

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[\s$_,-]/g, "");
}

function normalizeZip(zip) {
  return String(zip).trim().padStart(5, "0");
}

function parseMoney(val) {
  if (!val) return null;
  return Number(String(val).replace(/[^0-9.]/g, ""));
}

/* -------------------- LOAD CSV -------------------- */

function loadCSV() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(CSV_PATH)) {
      return reject(new Error("CSV file not found"));
    }

    const rows = [];

    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", () => {
        if (rows.length === 0) {
          return reject(new Error("CSV loaded but has 0 rows"));
        }
        resolve(rows);
      })
      .on("error", reject);
  });
}

(async () => {
  try {
    hudData = await loadCSV();
    console.log(`🔥 HUD CSV loaded: ${hudData.length} rows`);
  } catch (err) {
    console.error("❌ CSV LOAD FAILED:", err.message);
    process.exit(1);
  }
})();

/* -------------------- ROUTES -------------------- */

app.get("/health", (req, res) => {
  res.json({ status: "ok", rows: hudData.length });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || !bedrooms) {
    return res.status(400).json({
      error: "zip and bedrooms required",
    });
  }

  const targetZip = normalizeZip(zip);

  // Find ZIP column dynamically
  const zipKey = Object.keys(hudData[0]).find(
    (k) => normalize(k) === "zipcode"
  );

  if (!zipKey) {
    return res.status(500).json({ error: "ZIP column not found in CSV" });
  }

  const row = hudData.find(
    (r) => normalizeZip(r[zipKey]) === targetZip
  );

  if (!row) {
    return res.status(404).json({
      error: "ZIP not found in HUD data",
      zip: targetZip,
    });
  }

  // Find correct SAFMR bedroom column
  const rentKey = Object.keys(row).find((k) =>
    normalize(k).includes(`safmr${bedrooms}br`)
  );

  if (!rentKey) {
    return res.status(404).json({
      error: "Bedroom rent column not found",
      bedrooms,
    });
  }

  const rent = parseMoney(row[rentKey]);

  if (!rent) {
    return res.status(404).json({
      error: "Rent value missing",
      zip: targetZip,
      bedrooms,
    });
  }

  res.json({
    zip: targetZip,
    bedrooms,
    rent,
  });
});

/* -------------------- START -------------------- */

app.listen(PORT, () => {
  console.log(`✅ ALEX backend running on http://127.0.0.1:${PORT}`);
});
