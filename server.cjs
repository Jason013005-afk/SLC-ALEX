const express = require("express");
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 8080;

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/* =========================
   SAFMR ZIP LOOKUP (STREAM)
========================= */

app.get("/api/safmr/:zip", (req, res) => {
  const zip = req.params.zip.trim();

  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "Invalid ZIP format" });
  }

  const filePath = path.join(__dirname, "fy2024_safmrs_clean.csv");

  if (!fs.existsSync(filePath)) {
    return res.status(500).json({ error: "SAFMR file missing" });
  }

  let found = false;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      if (row.zip === zip) {
        found = true;
        res.json(row);
      }
    })
    .on("end", () => {
      if (!found) {
        res.status(404).json({ error: "ZIP not found" });
      }
    })
    .on("error", (err) => {
      console.error("CSV ERROR:", err.message);
      res.status(500).json({ error: "Server error" });
    });
});

/* =========================
   SERVER START
========================= */

const server = app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});

/* =========================
   CLEAN SHUTDOWN
========================= */

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});