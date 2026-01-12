// service.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Port setup (uses environment variable or defaults to 4000)
const PORT = process.env.PORT || 4000;

// Root route — quick check
app.get("/", (req, res) => {
  res.json({ message: "✅ SLC-ALEX backend is running!" });
  });

  // ---------------------------
  // STRESS TEST ENDPOINT
  // ---------------------------
  app.post("/api/stress", async (req, res) => {
    try {
        const { address, price, rent, interestRate } = req.body;

            if (!address || !price || !rent || !interestRate) {
                  return res.status(400).json({ error: "Missing required fields." });
                      }

                          // Simple calculations (replace with your real formulas later)
                              const appreciationRate = 0.05; // 5% appreciation assumption
                                  const estimatedValue = price * (1 + appreciationRate);
                                      const cashFlow = rent * 12 - price * (interestRate / 100);
                                          const roi = ((cashFlow / price) * 100).toFixed(2);
                                              const mao = (price * 0.7).toFixed(0);
                                                  const riskIndex = interestRate > 7 ? "High" : "Moderate";

                                                      // Return result
                                                          res.json({
                                                                address,
                                                                      estimatedValue: estimatedValue.toFixed(2),
                                                                            annualCashFlow: cashFlow.toFixed(2),
                                                                                  roi: `${roi}%`,
                                                                                        mao,
                                                                                              riskIndex,
                                                                                                    message: "🏡 Stress test complete!",
                                                                                                        });
                                                                                                          } catch (error) {
                                                                                                              console.error("Error in /api/stress:", error);
                                                                                                                  res.status(500).json({ error: "Internal Server Error" });
                                                                                                                    }
                                                                                                                    });

                                                                                                                    // ---------------------------
                                                                                                                    // START SERVER
                                                                                                                    // ---------------------------
                                                                                                                    app.listen(PORT, () => {
                                                                                                                      console.log(`🚀 Backend running on http://localhost:${PORT}`);
                                                                                                                      });