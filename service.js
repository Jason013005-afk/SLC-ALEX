import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// Mock intelligent backend endpoint
app.get("/api/property", (req, res) => {
  const { address, rate } = req.query;

  // Simple logic for risk level based on rate
  let risk = "Moderate";
  if (rate < 5) risk = "Low Risk";
  else if (rate > 8) risk = "High Risk";

  res.json({
    address: address || "Unknown",
    estimatedValue: 350000,
    taxes: 4800,
    beds: 3,
    baths: 2,
    recommendation: "Moderate investment — review terms carefully",
    risk,
  });
});

app.listen(4000, () => console.log("✅ Backend running on http://localhost:4000"));
