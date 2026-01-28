const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

/* ✅ Root health check */
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
  });

  /* ✅ Stress test API */
  app.post("/api/stress", (req, res) => {
    const { address, interestRate } = req.body;

      if (!address || !interestRate) {
          return res.status(400).json({
                success: false,
                      error: "address and interestRate are required"
                          });
                            }

                              const result = {
                                  address,
                                      estimatedValue: 450000,
                                          rent: 2800,
                                              stressLevel:
                                                    interestRate > 7 ? "High" :
                                                          interestRate > 5 ? "Moderate" : "Low",
                                                              appreciation: "4.5%"
                                                                };

                                                                  res.json({
                                                                      success: true,
                                                                          result
                                                                            });
                                                                            });

                                                                            /* ✅ Services list */
                                                                            app.get("/api/services", (req, res) => {
                                                                              res.json({
                                                                                  services: [
                                                                                        { title: "Market Analysis", description: "Property market insights" },
                                                                                              { title: "Stress Testing", description: "Interest rate impact analysis" },
                                                                                                    { title: "Portfolio Optimizer", description: "Investment rebalancing" }
                                                                                                        ]
                                                                                                          });
                                                                                                          });

                                                                                                          /* ✅ Contact form */
                                                                                                          app.post("/api/contact", (req, res) => {
                                                                                                            const { name, email, message } = req.body;

                                                                                                              if (!name || !email || !message) {
                                                                                                                  return res.status(400).json({ success: false });
                                                                                                                    }

                                                                                                                      console.log("Contact:", name, email, message);
                                                                                                                        res.json({ success: true });
                                                                                                                        });

                                                                                                                        /* 🚀 Start server */
                                                                                                                        app.listen(PORT, () => {
                                                                                                                          console.log(`Backend running on port ${PORT}`);
                                                                                                                          });