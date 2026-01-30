import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import cors from "cors";

const app = express();
const PORT = 8080;

// middleware
app.use(cors());
app.use(express.json());

// --------------------
// Load CSV into memory
// --------------------
const DATA = {};
const CSV_PATH = path.join(process.cwd(), "fy2024_safmrs.clean.csv");

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = row.zip || row.ZIP || row.Zip;
    if (!zip) return;

    DATA[zip] = {
      0: Number(row["0BR"] || row["0"] || row["Studio"]),
      1: Number(row["1BR"] || row["1"]),
      2: Number(row["2BR"] || row["2"]),
      3: Number(row["3BR"] || row["3"]),
      4: Number(row["4BR"] || row["4"]),
    };
  })
  .on("end", () => {
    console.log(`🔥 HUD CSV loaded: ${Object.keys(DATA).length} ZIPs`);
  });

// --------------------
// Health check
// --------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", zips: Object.keys(DATA).length });
});

// --------------------
// RENT API (THIS WAS MISSING / BROKEN)
// --------------------
app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const zipData = DATA[zip];
  if (!zipData) {
    return res.status(404).json({ error: "ZIP not found" });
  }

  const rent = zipData[bedrooms];
  if (!rent || Number.isNaN(rent)) {
    return res.status(404).json({ error: "No rent for bedroom count" });
  }

  res.json({
    zip,
    bedrooms,
    rent,
  });
});

// --------------------
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});