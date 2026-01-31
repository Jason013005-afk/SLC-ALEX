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
    String(value).replace(/[$,]/g, "").trim()
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

  const data = HUD_DATA[zip];

  if (!data) {
    return res.status(404).json({
      error: "ZIP not found in HUD dataset"
    });
  }

  const rent = data[String(bedrooms)];

  if (rent == null) {
    return res.status(200).json({
      zip,
      bedrooms,
      hudStatus: "SAFMR unavailable",
      message: "HUD does not publish SAFMR for this ZIP",
      nextStep: "Use county/metro FMR fallback or market rent estimate"
    });
  }

  res.json({
    zip,
    bedrooms,
    hudStatus: "SAFMR available",
    rent,
    paymentStandards: {
      "90%": Math.round(rent * 0.9),
      "100%": rent,
      "110%": Math.round(rent * 1.1)
    }
  });
});

// ============================
// Start server
// ============================

app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});