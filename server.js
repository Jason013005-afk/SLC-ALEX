import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

/* -------------------- BASIC SETUP -------------------- */
dotenv.config();

const app = express();
const PORT = 8080;

/* Needed because you're using ES modules */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- SUPABASE -------------------- */
/* IMPORTANT:
   - Use SERVICE ROLE KEY on backend ONLY
   - NEVER expose this to frontend
*/
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json());
app.use(express.static(__dirname)); // serves html/css/js/images

/* -------------------- ROUTES -------------------- */

/* Home */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* Pages */
app.get("/system.html", (req, res) => {
  res.sendFile(path.join(__dirname, "system.html"));
});

app.get("/price.html", (req, res) => {
  res.sendFile(path.join(__dirname, "price.html"));
});

app.get("/contact.html", (req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

/* -------------------- API: STRESS TEST -------------------- */
app.post("/api/stress-test", async (req, res) => {
  try {
    const { address, rate } = req.body;

    if (!address || !rate) {
      return res.status(400).json({ error: "Missing address or rate" });
    }

    /* ---- SIMPLE VALUE ESTIMATION (placeholder logic) ---- */
    const estimatedValue = Math.round(
      250000 + Math.random() * 200000
    );

    /* ---- INSERT INTO SUPABASE ---- */
    const { error } = await supabase
      .from("stress_tests")
      .insert([
        {
          address,
          rate,
          estimated_value: estimatedValue
        }
      ]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "Database insert failed" });
    }

    /* ---- RESPONSE ---- */
    res.json({
      address,
      rate,
      estimated_value: estimatedValue,
      status: "Test complete"
    });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://127.0.0.1:${PORT}`);
});
