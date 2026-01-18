// service.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "✅ ALEX Backend Live", time: new Date().toISOString() });
});

// Zillow API call helper
async function fetchZillowData(address) {
  if (!process.env.ZILLOW_KEY) {
    console.log("⚠️ No Zillow API key found, skipping live lookup.");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://zillow56.p.rapidapi.com/search?location=${encodedAddress}`;

    const response = await fetch(url, {
      headers: {
        "x-rapidapi-key": process.env.ZILLOW_KEY,
        "x-rapidapi-host": "zillow56.p.rapidapi.com"
      }
    });

    if (!response.ok) throw new Error(`Zillow API error: ${response.status}`);
    const data = await response.json();

    // Pull first property’s value and rent if available
    if (data?.results?.length > 0) {
      const result = data.results[0];
      return {
        estimatedValue: result.zestimate || 0,
        rent: result.rentZestimate || 0,
        source: "zillow"
      };
    }
    return null;
  } catch (err) {
    console.error("❌ Zillow fetch failed:", err.message);
    return null;
  }
}

// Main endpoint
app.post("/api/stress", async (req, res) => {
  const { address, interestRate } = req.body;
  if (!address || !interestRate) {
    return res.status(400).json({ error: "Missing address or interest rate." });
  }

  try {
    console.log(`📡 Searching for property: ${address}`);

    // 1️⃣ Try Supabase first
    const { data: existing, error: supaErr } = await supabase
      .from("properties")
      .select("*")
      .ilike("address", `%${address}%`)
      .limit(1);

    if (supaErr) throw supaErr;

    let property = existing?.[0];

    // 2️⃣ If not found, try Zillow
    if (!property) {
      const zillowData = await fetchZillowData(address);
      if (zillowData) {
        property = { address, ...zillowData, appreciation5yr: 0.15 };
        // Save Zillow data in Supabase for caching
        await supabase.from("properties").insert([property]);
        console.log("✅ Zillow property added to Supabase cache.");
      }
    }

    // 3️⃣ Fallback data if nothing found
    if (!property) {
      property = {
        address,
        estimatedValue: 250000,
        rent: 2200,
        appreciation5yr: 0.15,
        source: "fallback"
      };
    }

    // 4️⃣ Financial calculations
    const annualRent = property.rent * 12;
    const roi = ((annualRent / property.estimatedValue) * 100).toFixed(2);
    const monthlyPayment = (
      (property.estimatedValue * (interestRate / 100)) /
      12
    ).toFixed(2);

    const result = {
      address: property.address,
      estimatedValue: property.estimatedValue,
      rent: property.rent,
      interestRate: parseFloat(interestRate),
      roi,
      monthlyPayment,
      appreciation5yr: property.appreciation5yr,
      source: property.source || "supabase",
      created_at: new Date().toISOString()
    };

    // 5️⃣ Log test results in Supabase
    const { error: insertErr } = await supabase.from("stress_tests").insert([result]);
    if (insertErr) console.warn("⚠️ Insert error:", insertErr.message);
    else console.log("✅ Stress test saved to Supabase");

    res.json(result);
  } catch (err) {
    console.error("🔥 Server error:", err.message || err);
    res.status(500).json({
      error: "Failed to process stress test",
      details: err.message || err
    });
  }
});

// Launch server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 ALEX backend running on http://localhost:${PORT}`));
