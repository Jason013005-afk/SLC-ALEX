// service.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Port setup (uses .env or defaults to 4000)
const PORT = process.env.PORT || 4000;

// Root route — quick backend check
app.get("/", (req, res) => {
  res.json({ message: "✅ SLC-ALEX backend is running smoothly!" });
  });

  // --------------------------------------------------
  // 📊 STRESS TEST ENDPOINT
  // --------------------------------------------------
  app.post("/api/stress", async (req, res) => {
    try {
        const { address, price, rent, interestRate } = req.body;

            if (!address || !price || !rent || !interestRate) {
                  return res.status(400).json({ error: "Missing required fields." });
                      }

                          // --- Basic Assumptions ---
                              const appreciationRate = 0.04; // 4% annual appreciation
                                  const expenseRatio = 0.35; // 35% of rent goes to expenses
                                      const annualRent = rent * 12;
                                          const annualExpenses = annualRent * expenseRatio;
                                              const loanPayment = price * (interestRate / 100) * 0.8; // assuming 80% loan-to-value

                                                  // --- Calculations ---
                                                      const estimatedValue = price * (1 + appreciationRate);
                                                          const annualCashFlow = annualRent - annualExpenses - loanPayment;
                                                              const roi = ((annualCashFlow / price) * 100).toFixed(2);
                                                                  const mao = (price * 0.7 - 15000).toFixed(0); // Max Allowable Offer
                                                                      const riskIndex =
                                                                            roi > 12 ? "Low"
                                                                                  : roi > 8 ? "Moderate"
                                                                                        : roi > 5 ? "Elevated"
                                                                                              : "High";

                                                                                                  // --- Results ---
                                                                                                      res.json({
                                                                                                            address,
                                                                                                                  estimatedValue: estimatedValue.toFixed(2),
                                                                                                                        annualCashFlow: annualCashFlow.toFixed(2),
                                                                                                                              roi: `${roi}%`,
                                                                                                                                    mao,
                                                                                                                                          riskIndex,
                                                                                                                                                recommendation:
                                                                                                                                                        roi > 10
                                                                                                                                                                  ? "🔥 Strong investment opportunity!"
                                                                                                                                                                            : roi > 7
                                                                                                                                                                                      ? "💰 Profitable with mild risk."
                                                                                                                                                                                                : "⚠️ Review financing and rent assumptions.",
                                                                                                                                                                                                      message: "🏡 Stress test complete!"
                                                                                                                                                                                                          });
                                                                                                                                                                                                            } catch (error) {
                                                                                                                                                                                                                console.error("Error in /api/stress:", error);
                                                                                                                                                                                                                    res.status(500).json({ error: "Internal server error" });
                                                                                                                                                                                                                      }
                                                                                                                                                                                                                      });

                                                                                                                                                                                                                      // --------------------------------------------------
                                                                                                                                                                                                                      // 🧠 AI ESTIMATION ENDPOINT (for future expansion)
                                                                                                                                                                                                                      // --------------------------------------------------
                                                                                                                                                                                                                      app.post("/api/estimate", async (req, res) => {
                                                                                                                                                                                                                        const { address, price } = req.body;
                                                                                                                                                                                                                          if (!address || !price) {
                                                                                                                                                                                                                              return res.status(400).json({ error: "Address and price required." });
                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                  // Simulated market data (later you can connect to Zillow, ATTOM, or APIs)
                                                                                                                                                                                                                                    const appreciation = price * 0.05;
                                                                                                                                                                                                                                      const marketValue = price + appreciation;

                                                                                                                                                                                                                                        res.json({
                                                                                                                                                                                                                                            address,
                                                                                                                                                                                                                                                estimatedValue: marketValue.toFixed(2),
                                                                                                                                                                                                                                                    appreciation: appreciation.toFixed(2),
                                                                                                                                                                                                                                                        comment: "📈 Estimated based on current regional appreciation rate."
                                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                                          });

                                                                                                                                                                                                                                                          // --------------------------------------------------
                                                                                                                                                                                                                                                          // START SERVER
                                                                                                                                                                                                                                                          // --------------------------------------------------
                                                                                                                                                                                                                                                          app.listen(PORT, () => {
                                                                                                                                                                                                                                                            console.log(`🚀 Backend running on http://localhost:${PORT}`);
                                                                                                                                                                                                                                                            });