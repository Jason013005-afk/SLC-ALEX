// ===============================
// ALEX™ Backend Server (Stable)
// ===============================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route — base
app.get("/", (req, res) => {
  res.json({ status: "✅ ALEX backend live", time: new Date().toISOString() });
});

// Core API route for property stress test
app.post("/api/stress", (req, res) => {
  const { address, rate } = req.body;

  if (!address || !rate) {
    return res.status(400).json({
      error: "Missing address or rate in request",
    });
  }

  // Simulate basic analysis
  const estimatedValue = Math.floor(Math.random() * 300000) + 200000;
  const estimatedRent = Math.floor(estimatedValue / 250);
  const riskScore = (100 - rate * Math.random() * 2).toFixed(2);

  res.json({
    address,
    rate,
    estimatedValue,
    estimatedRent,
    riskScore,
    message: "✅ Analysis complete (sample data)",
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 ALEX backend running on http://localhost:${PORT}`);
}).on("error", (err) => {
  console.error("❌ Server failed to start:", err);
});
