import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Root Route ---
app.get("/", (_, res) => {
  res.json({
      message: "✅ ALEX Backend Active",
          status: "ok",
            });
            });

            // --- Stress Analysis Route ---
            app.post("/api/stress", async (req, res) => {
              try {
                  const { address, interestRate } = req.body;

                      // --- Basic static analysis logic (replace later with live data) ---
                          const estimatedValue = 350000;
                              const rentValue = 2500;
                                  const section8 = 2200;
                                      const taxes = 4200;
                                          const insurance = 1200;

                                              const annualRent = rentValue * 12;
                                                  const annualSection8 = section8 * 12;
                                                      const annualExpense = taxes + insurance;
                                                          const roi = ((annualRent - annualExpense) / estimatedValue).toFixed(2);
                                                              const appreciation = Math.round(estimatedValue * 1.18);
                                                                  const netProfit = Math.round((annualRent - annualExpense) * 5);
                                                                      const totalReturn = Math.round(netProfit + appreciation);

                                                                          // --- Send response ---
                                                                              res.json({
                                                                                    address,
                                                                                          interestRate,
                                                                                                estimatedValue,
                                                                                                      rentValue,
                                                                                                            section8,
                                                                                                                  taxes,
                                                                                                                        insurance,
                                                                                                                              annualRent,
                                                                                                                                    annualSection8,
                                                                                                                                          roi,
                                                                                                                                                appreciation,
                                                                                                                                                      netProfit,
                                                                                                                                                            totalReturn,
                                                                                                                                                                });
                                                                                                                                                                  } catch (error) {
                                                                                                                                                                      console.error("❌ Error in /api/stress:", error.message);
                                                                                                                                                                          res.status(500).json({ error: "Internal Server Error" });
                                                                                                                                                                            }
                                                                                                                                                                            });

                                                                                                                                                                            // --- Start Server ---
                                                                                                                                                                            app.listen(PORT, () => {
                                                                                                                                                                              console.log(`🚀 SLC-ALEX backend running on port ${PORT}`);
                                                                                                                                                                              });