import express from "express";
import fs from "fs";
import csv from "csv-parser";

const app = express();
app.use(express.json());

const PORT = 8080;
const CSV_PATH = "./fy2024_safmrs.clean.csv";

const hudData = [];

/* ---------------- CSV LOAD ---------------- */

function clean(v) {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function loadCSV() {
  fs.createReadStream(CSV_PATH)
    .pipe(csv({ headers: false }))
    .on("data", (row) => {
      // Skip header row
      if (!row[0] || row[0].toLowerCase().includes("zip")) return;

      const zip = String(row[0]).padStart(5, "0");

      hudData.push({
        zip,
        rents: {
          0: clean(row[3]),   // OBR
          1: clean(row[6]),   // 1BR
          2: clean(row[9]),   // 2BR
          3: clean(row[12]),  // 3BR
          4: clean(row[15])   // 4BR
        }
      });
    })
    .on("end", () => {
      console.log(`🔥 HUD CSV loaded: ${hudData.length} rows`);
    });
}

loadCSV();

/* ---------------- ROUTES ---------------- */

app.get("/health", (req, res) => {
  res.json({ status: "ok", rows: hudData.length });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (zip === undefined || bedrooms === undefined) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const z = String(zip).padStart(5, "0");
  const record = hudData.find(r => r.zip === z);

  if (!record) {
    return res.status(404).json({ error: "ZIP not found", zip: z });
  }

  const rent = record.rents[bedrooms];

  // ✅ THIS IS THE CRITICAL FIX
  if (rent === null || Number.isNaN(rent)) {
    return res.status(404).json({
      error: "No rent for bedroom count",
      zip: z,
      bedrooms
    });
  }

  res.json({
    zip: z,
    bedrooms,
    rent
  });
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`✅ ALEX backend running on http://127.0.0.1:${PORT}`);
});
