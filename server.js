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
      zip,
      hudAreaCode: row["HUD Area Code"] || null,
      metroName: row["HUD Metro Fair Market Rent Area Name"] || null,
      safmr: {
        "0": row["SAFMR 0BR"] ? Number(row["SAFMR 0BR"]) : null,
        "1": row["SAFMR 1BR"] ? Number(row["SAFMR 1BR"]) : null,
        "2": row["SAFMR 2BR"] ? Number(row["SAFMR 2BR"]) : null,
        "3": row["SAFMR 3BR"] ? Number(row["SAFMR 3BR"]) : null,
        "4": row["SAFMR 4BR"] ? Number(row["SAFMR 4BR"]) : null
      }
    };
  })
  .on("end", () => {
    console.log(`🔥 HUD CSV loaded: ${Object.keys(HUD_DATA).length} ZIPs`);
  });

// ============================
// Routes
// ============================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    zipCount: Object.keys(HUD_DATA).length
  });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({
      error: "zip and bedrooms are required"
    });
  }

  const record = HUD_DATA[zip];

  if (!record) {
    return res.status(404).json({
      error: "ZIP not found in HUD dataset"
    });
  }

  const safmrValue = record.safmr[String(bedrooms)];

  // ✅ SAFMR EXISTS
  if (safmrValue !== null) {
    return res.json({
      zip,
      bedrooms,
      hudStatus: "SAFMR",
      rent: safmrValue,
      paymentStandards: {
        "90%": Math.round(safmrValue * 0.9),
        "100%": safmrValue,
        "110%": Math.round(safmrValue * 1.1)
      }
    });
  }

  // 🔁 SAFMR FALLBACK (NO FAKE DATA)
  return res.json({
    zip,
    bedrooms,
    hudStatus: "SAFMR unavailable",
    hudAreaCode: record.hudAreaCode,
    metroName: record.metroName,
    message: "HUD does not publish SAFMR for this ZIP",
    nextStep: "Use HUD Metro/County FMR or market rent estimate"
  });
});

// ============================
// Start server
// ============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});