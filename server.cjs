const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Load your SAFMR data
const safmrData = {};
fs.readFileSync("fy2024_safmrs_clean.csv", "utf8")
  .split("\n")
  .forEach((line) => {
    const parts = line.split(",");
    const zip = parts[0]?.trim();
    if (zip) safmrData[zip] = {
      area: parts[1],
      studio: parts[2],
      one: parts[3],
      two: parts[4],
      three: parts[5],
      four: parts[6],
    };
  });

const app = express();
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "public")));

// Your analyze API (GET)
app.get("/api/analyze", (req, res) => {
  const zip = req.query.zip;
  if (!zip) {
    return res.status(400).json({ error: "ZIP required" });
  }

  const data = safmrData[zip];
  if (!data) {
    return res.status(404).json({ error: "ZIP not found" });
  }

  res.json(data);
});

// Fallback to index.html so frontend routing works
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`);
});