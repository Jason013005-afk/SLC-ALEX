import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post("/api/stress-test", async (req, res) => {
  const { address, rate } = req.body;

  if (!address || !rate) {
    return res.status(400).json({ error: "Missing input" });
  }

  // Placeholder model (replace later)
  const estimatedValue = Math.round(300000 + Math.random() * 100000);
  const cashFlow = Math.round(1500 + Math.random() * 1000);
  const dscr = Number((cashFlow / 1000).toFixed(2));
  const risk = dscr >= 1.5 ? "LOW" : dscr >= 1.2 ? "MEDIUM" : "HIGH";

  await supabase.from("stress_tests").insert({
    address,
    rate,
    estimated_value: estimatedValue
  });

  res.json({
    address,
    rate,
    estimatedValue,
    cashFlow,
    dscr,
    risk
  });
});

app.listen(8080, () =>
  console.log("Server running at http://127.0.0.1:8080")
);
