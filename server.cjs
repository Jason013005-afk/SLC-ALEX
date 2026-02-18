const express = require('express');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname, 'public')));

let safmrData = {};

console.log("🔄 Loading SAFMR data...");

fs.createReadStream(path.join(__dirname, 'fy2024_safmrs_clean.csv'))
  .pipe(csv())
  .on('data', (row) => {

    let zip = row["ZIP Code"];

    if (!zip) return;

    // 🔥 FORCE CLEAN ZIP FORMAT
    zip = String(zip).replace(".0", "").trim();

    // Ensure 5 digits (pads leading zeros if needed)
    zip = zip.padStart(5, "0");

    safmrData[zip] = {
      area: row["HUD Metro Fair Market Rent Area Name"],
      studio: row["SAFMR 0BR"],
      one: row["SAFMR 1BR"],
      two: row["SAFMR 2BR"],
      three: row["SAFMR 3BR"],
      four: row["SAFMR 4BR"]
    };
  })
  .on('end', () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(safmrData).length} ZIPs`);
  })
  .on('error', (err) => {
    console.error("CSV Load Error:", err);
  });

app.get('/api/analyze', (req, res) => {

  let zip = req.query.zip;

  if (!zip) {
    return res.status(400).json({ error: "ZIP required" });
  }

  zip = String(zip).replace(".0", "").trim().padStart(5, "0");

  const data = safmrData[zip];

  if (!data) {
    return res.status(404).json({ error: "ZIP not found" });
  }

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});