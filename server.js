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
      "0": Number(row["SAFMR 0BR"]) || null,
      "1": Number(row["SAFMR 1BR"]) || null,
      "2": Number(row["SAFMR 2BR"]) || null,
      "3": Number(row["SAFMR 3BR"]) || null,
      "4": Number(row["SAFMR 4BR"]) || null
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
  if (!data || data[String(bedrooms)] == null) {
    return res.status(404).json({
      error: "No HUD data for that ZIP / bedroom count"
    });
  }

  const baseRent = data[String(bedrooms)];

  res.json({
    zip,
    bedrooms,
    rent: baseRent,
    paymentStandards: {
      "90%": Math.round(baseRent * 0.9),
      "100%": baseRent,
      "110%": Math.round(baseRent * 1.1)
    }
  });
});

// ============================
// Start server
// ============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});