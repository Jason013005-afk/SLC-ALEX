import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = 4000;

// Public property lookup (demo endpoint)
app.get("/api/property", async (req, res) => {
  const address = req.query.address;
  if (!address) return res.status(400).json({ error: "Address required" });

  const url = `https://realtor.p.rapidapi.com/properties/v2/list-for-sale?city=Fall%20River&limit=1&offset=0&state_code=MA&sort=relevance`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": "demo-key",
        "X-RapidAPI-Host": "realtor.p.rapidapi.com",
      },
    });

    const data = await response.json();

    res.json({
      address: address,
      estimatedValue: data?.properties?.[0]?.price ?? 350000,
      taxes: 4800,
      beds: data?.properties?.[0]?.beds ?? 3,
      baths: data?.properties?.[0]?.baths_full ?? 2,
      recommendation:
        (data?.properties?.[0]?.price ?? 350000) > 500000
          ? "High-end — proceed with due diligence"
          : "Moderate investment — review terms carefully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Proxy running at http://localhost:${PORT}`)
);
