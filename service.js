// service.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Port setup (environment variable or default)
const PORT = process.env.PORT || 4000;

// Root route — quick check
app.get("/", (req, res) => {
  res.json({ message: "✅ SLC-ALEX backend is running!" });
  });

  // -----------------------------
  // STRESS TEST ENDPOINT
  // -----------------------------
  app.post("/api/stress", async (req, res) => {
    const { address, price, rent, interestRate } = req.body;

      if (!address || !price || !rent || !interestRate) {
          return res.status(400).json({ error: "Missing required fields." });
            }

              // Simple calculations (you can upgrade these later)
                const appreciationRate = 0.05;
                  const estimatedValue = price * (1 + appreciationRate);
                    const cashFlow = rent * 12 - (price * (interestRate / 100));
                      const roi = ((cashFlow / price) * 100).toFixed(2);
                        const mao = price * 0.7 - 10000; // sample formula
                          const riskIndex = roi > 10 ? "Low" : roi > 5 ? "Moderate" : "High";

                            res.json({
                                address,
                                    estimatedValue: estimatedValue.toFixed(2),
                                        annualCashFlow: cashFlow.toFixed(2),
                                            roi: `${roi}%`,
                                                mao: mao.toFixed(0),
                                                    riskIndex,
                                                        message: "🏡 Stress test complete!"
                                                          });
                                                          });

                                                          // -----------------------------
                                                          // START SERVER
                                                          // -----------------------------
                                                          app.listen(PORT, () => {
                                                            console.log(`🚀 Backend running on http://localhost:${PORT}`);
                                                            });