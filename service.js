import fs from "fs";
import path from "path";
import express from "express";
import csv from "csv-parser";

const app = express();
app.use(express.json());

const PORT = 8080;
const CSV_PATH = path.resolve("./fy2024_safmrs.csv");

let hudData = [];

/* ---------------- HELPERS ---------------- */

const normalizeZip = (z) => String(z).trim().padStart(5, "0");
const cleanMoney = (v) =>
  Number(String(v).replace(/[$,]/g, "").trim());

/* ---------------- CSV LOAD ---------------- */

function loadCSV() {
  hudData = [];

  if (!fs.existsSync(CSV_PATH)) {
    console.error("❌ CSV not found:", CSV_PATH);
    return;
  }

  fs.createReadStream(CSV_PATH)
    .pipe(csv({ headers: false }))
    .on("data", (row) => {
      // Skip header garbage rows
      if (!row[0] || row[0].toLowerCase().includes("zip")) return;

      const zip = normalizeZip(row[0]);

      hudData.push({
        zip,
        safmr: {
          0: cleanMoney(row[3]),  // SAFMR OBR
          1: cleanMoney(row[6]),  // SAFMR 1BR
          2: cleanMoney(row[9]),  // SAFMR 2BR
          3: cleanMoney(row[12]), // SAFMR 3BR
          4: cleanMoney(row[15]), // SAFMR 4BR
        },
      });
    })
    .on("end", () => {
      console.log(`🔥 HUD CSV loaded: ${hudData.length} rows`);
    })
    .on("error", (err) => {
      console.error("❌ CSV error:", err);
    });
}

loadCSV();

/* ---------------- ROUTES ---------------- */

app.get("/health", (req, res) => {
  res.json({ status: "ok", rows: hudData.length });
});

app.post("/api/rent", (req, res) => {
  const { zip, bedrooms } = req.body;

  if (zip == null || bedrooms == null) {
    return res.status(400).json({ error: "zip and bedrooms required" });
  }

  const z = normalizeZip(zip);
  const record = hudData.find((r) => r.zip === z);

  if (!record) {
    return res.status(404).json({ error: "ZIP not found", zip: z });
  }

  const rent = record.safmr[bedrooms];

  if (!rent) {
    return res.status(404).json({
      error: "Bedroom data not found",
      bedrooms,
    });
  }

  res.json({
    zip: z,
    bedrooms,
    rent,
  });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(`✅ ALEX backend running on http://127.0.0.1:${PORT}`);
});
