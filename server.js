import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

const app = express();
const PORT = 8080;

// -------------------- MIDDLEWARE --------------------
app.use(express.json());
app.use(express.static("public"));

// -------------------- LOAD CSV --------------------
const CSV_PATH = path.join(process.cwd(), "fy2024_safmrs.fixed.csv");

const rentByZip = {}; 
/*
Expected CSV headers (exact):
ZIP,SAFMR_0BR,SAFMR_1BR,SAFMR_2BR,SAFMR_3BR,SAFMR_4BR
*/

fs.createReadStream(CSV_PATH)
  .pipe(csv())
  .on("data", (row) => {
    const zip = String(row.ZIP).trim();
    rentByZip[zip] = {
      0: Number(row.SAFMR_0BR),
      1: Number(row.SAFMR_1BR),
      2: Number(row.SAFMR_2BR),
      3: Number(row.SAFMR_3BR),
      4: Number(row.SAFMR_4BR),
    };
  })
  .on("end", () => {
    console.log("🔥 HUD CSV loaded:", Object.keys(rentByZip).length, "ZIPs");
  });

// -------------------- ROUTES --------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", zips: Object.keys(rentByZip).length });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (!zip || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const zipData = rentByZip[String(zip)];
  if (!zipData) {
    return res.status(404).json({ error: "ZIP not found", zip });
  }

  const rent = zipData[Number(bedrooms)];
  if (!rent || rent <= 0) {
    return res.status(404).json({
      error: "No rent for bedroom count",
      zip,
      bedrooms,
    });
  }

  res.json({ zip, bedrooms: Number(bedrooms), rent });
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`🚀 ALEX server running at http://127.0.0.1:${PORT}`);
});
