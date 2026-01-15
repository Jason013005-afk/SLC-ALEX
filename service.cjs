// ✅ service.js — CommonJS version for Node 24
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Root check
app.get("/", (req, res) => {
  res.json({ message: "✅ ALEX Backend Active", status: "ok" });
  });

  // Simple property analysis route
  app.post("/api/stress", (req, res) => {
    const { address, interestRate } = req.body;

      if (!address || !interestRate) {
          return res.status(400).json({ error: "Missing address or interest rate" });
            }

              const result = {
                  address,
                      estimatedValue: 330000,
                          rent: 2200,
                              section8: 2400,
                                  roi: "10.2%",
                                      loanAmount: 270000,
                                          appreciation: 25000,
                                            };

                                              res.json(result);
                                              });

                                              const PORT = process.env.PORT || 4000;
                                              app.listen(PORT, () => console.log(`🚀 SLC-ALEX backend running on port ${PORT}`));