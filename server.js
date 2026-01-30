/**
 * ALEX™ Server | Silver Lining Consulting LLC
 * -------------------------------------------------------
 * Handles property stress test submissions
 * and connects securely to your Supabase database.
 */

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// ----- Setup -----
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // serve your HTML/CSS/JS directly

// ----- Paths -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Supabase Connection -----
const SUPABASE_URL = process.env.SUPABASE_URL || "https://doernvgjlswszteywylb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- Routes -----

// Serve system page (so direct /system.html works cleanly)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/system", (req, res) => {
  res.sendFile(path.join(__dirname, "system.html"));
});

// Core stress test API
app.post("/api/stress-test", async (req, res) => {
  try {
    const { address, rate } = req.body;

    if (!address || !rate) {
      return res.status(400).json({ error: "Missing required fields: address, rate" });
    }

    console.log(`➡️ Running stress test for: ${address} @ ${rate}%`);

    // --- Example: Estimate property value (replace with real API later)
    const estimatedValue = (Math.random() * 500000 + 150000).toFixed(2);

    // Insert or update Supabase record
    const { data, error } = await supabase
      .from("stress_tests")
      .insert([{ address, rate, estimatedValue, source: "system-page" }])
      .select();

    if (error) {
      console.error("❌ Supabase insert error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log("✅ Stress test recorded:", data);
    res.json({
      message: "Stress test completed successfully",
      result: data[0],
    });
  } catch (err) {
    console.error("💥 Server error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint to retrieve past stress tests
app.get("/api/stress-tests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("stress_tests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ records: data });
  } catch (err) {
    console.error("💥 Fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// ----- Start Server -----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 ALEX Server running at http://127.0.0.1:${PORT}`);
});