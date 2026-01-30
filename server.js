import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json());

// =====================
// DATA STORE
// =====================
const DATA = {};

// =====================
// LOAD HUD CSV
// =====================
const CSV_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

if (!fs.existsSync(CSV_PATH)) {
  console.error("❌ CSV FILE NOT FOUND:", CSV_PATH);
  process.exit(1);
}

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"];
    if (!zip) return;

    DATA[zip] = {
      0: Number(row["SAFMR 0BR"]),
      1: Number(row["SAFMR 1BR"]),
      2: Number(row["SAFMR 2BR"]),
      3: Number(row["SAFMR 3BR"]),
      4: Number(row["SAFMR 4BR"]),
    };
  })
  .on("end", () => {
    console.log(`🔥 HUD CSV loaded: ${Object.keys(DATA).length} ZIPs`);
  });

// =====================
// HEALTH CHECK
// =====================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    zipCount: Object.keys(DATA).length,
  });
});

// =====================
// RENT ENDPOINT
// =====================
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms required",
    });
  }

  const zipData = DATA[zip];
  if (!zipData) {
    return res.status(404).json({
      error: "ZIP not found",
    });
  }

  const rent = zipData[bedrooms];
  if (!rent || isNaN(rent)) {
    return res.status(404).json({
      error: "Bedroom count not found",
    });
  }

  res.json({
    zip,
    bedrooms,
    rent,
  });
});

// =====================
// START SERVER
// =====================
app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});