// ✅ service.cjs — Complete backend server

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 Root check
app.get("/", (req, res) => {
  res.json({ message: "✅ ALEX Backend Active", status: "ok" });
  });

  // 🟢 Simple property stress test
  app.post("/api/stress", (req, res) => {
    const { address, interestRate } = req.body;

      if (!address || !interestRate) {
          return res.status(400).json({ error: "Missing address or interestRate" });
            }

              const result = {
                  address,
                      estimatedValue: 330000,
                          rent: 2200,
                              section8: 2400,
                                  roi: "10.2%",
                                      loanAmount: 250000,
                                          appreciation: "4.5%",
                                            };

                                              res.json({ success: true, data: result });
                                              });

                                              // 🟢 Services route
                                              app.get("/api/services", (req, res) => {
                                                const services = [
                                                    {
                                                          title: "Market Stress Test",
                                                                description: "Simulate value and rent shifts under different market pressures.",
                                                                    },
                                                                        {
                                                                              title: "ROI Analyzer",
                                                                                    description: "Instantly project ROI, cash flow, and long-term equity growth.",
                                                                                        },
                                                                                            {
                                                                                                  title: "Portfolio Optimizer",
                                                                                                        description: "Rebalance investments using live data and strategy rules.",
                                                                                                            },
                                                                                                              ];

                                                                                                                res.json({ services });
                                                                                                                });

                                                                                                                // 🟢 Contact form handler
                                                                                                                app.post("/api/contact", (req, res) => {
                                                                                                                  const { name, email, message } = req.body;

                                                                                                                    if (!name || !email || !message) {
                                                                                                                        return res.status(400).json({ error: "All fields are required." });
                                                                                                                          }

                                                                                                                            console.log("📩 Contact submission received:", { name, email, message });

                                                                                                                              res.json({
                                                                                                                                  success: true,
                                                                                                                                      message: `Thanks ${name}, we’ll reach out soon.`,
                                                                                                                                        });
                                                                                                                                        });

                                                                                                                                        // 🟢 Start server
                                                                                                                                        const PORT = 4000;
                                                                                                                                        app.listen(PORT, () => {
                                                                                                                                          console.log(`🚀 SLC-ALEX backend running on port ${PORT}`);
                                                                                                                                          });