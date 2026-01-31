import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

// ============================
// Helpers
// ============================

function toNumber(value) {
  if (!value) return null;
  return Number(
    String(value)
      .replace(/[$,]/g, "")
      .trim()
  ) || null;
}

// ============================
// Load HUD SAFMR CSV
// ============================

const HUD_DATA = {};
const CSV_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

if (!fs.existsSync(CSV_PATH)) {
  console.error("❌ CSV file not found:", CSV_PATH);
  process.exit(1);
}

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row["ZIP CODE"]?.trim();
    if (!zip) return;

    HUD_DATA[zip] = {
      "0": toNumber(row["SAFMR 0BR"]),
      "1": toNumber(row["SAFMR 1BR"]),
      "2": toNumber(row["SAFMR 2BR"]),
      "3": toNumber(row["SAFMR 3BR"]),
      "4": toNumber(row["SAFMR 4BR"])
    };
  })
  .on("end", () => {
    console.log(`🔥 HUD CSV loaded: ${Object.keys(HUD_DATA).length} ZIPs`);
  });

// ============================
// Routes
// ============================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    zipCount: Object.keys(HUD_DATA).length
  });
});

// Rent lookup
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms are required"
    });
  }

  const data = HUD_DATA[zip];

  // ZIP not in dataset at all
  if (!data) {
    return res.status(404).json({
      error: "ZIP not found in HUD