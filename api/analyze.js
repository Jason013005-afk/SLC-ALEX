export default async function handler(req, res) {
      try {
            // Always log inputs to verify on Vercel console
                const { address = "Unknown", rate = "N/A" } = req.query;
                    console.log("Analyzing:", address, rate);

                        // Fake calculation (no external API, guaranteed to work)
                            const verdicts = ["Proceed ✅", "Renegotiate ⚖️", "Kill ❌"];
                                const risks = ["LOW", "MEDIUM", "HIGH"];
                                    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

                                        const result = {
                                                  address,
                                                        rate,
                                                              estimate: `$${(Math.random() * 350000 + 150000).toFixed(0)}`,
                                                                    risk: pick(risks),
                                                                          verdict: pick(verdicts),
                                                                                time: new Date().toLocaleString(),
                                        };

                                            return res.status(200).json(result);
      } catch (err) {
            console.error("Analyze API error:", err);
                res.status(500).json({ error: "Internal Server Error", details: err.message });
      }
}
      }
                                        }
      }
}