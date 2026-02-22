import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS so your frontend can call the API
app.use(cors());
app.use(express.json());

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, "public")));

// Your API routes
// Example analyze endpoint (adjust if different)
app.get("/api/analyze", async (req, res) => {
  try {
    const zip = req.query.zip;
    if (!zip) {
      return res.status(400).json({ error: "ZIP is required" });
    }
    // Simulated backend logic (return your real data here)
    const sampleData = {
      area: "Providence-Fall River, RI-MA HUD Metro FMR Area",
      studio: "$1,100",
      one: "$1,200",
      two: "$1,450",
      three: "$1,750",
      four: "$2,170"
    };
    return res.json(sampleData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// All other non-API requests will get your index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});