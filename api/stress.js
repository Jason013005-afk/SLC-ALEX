// api/stress.js
export default async function handler(req, res) {
  if (req.method === "GET") {
      return res.status(200).json({ message: "SLC-ALEX Stress API is live!" });
        }

          if (req.method === "POST") {
              try {
                    const { address, price, rent, interestRate } = req.body;

                          // Example basic math — you can replace with real analysis later
                                const mortgage = (price * (interestRate / 100)) / 12;
                                      const cashflow = rent - mortgage;

                                            return res.status(200).json({
                                                    address,
                                                            price,
                                                                    rent,
                                                                            interestRate,
                                                                                    cashflow,
                                                                                            recommendation:
                                                                                                      cashflow > 0
                                                                                                                  ? "Positive cashflow — potential good deal"
                                                                                                                              : "Negative cashflow — risky deal",
                                                                                                                                    });
                                                                                                                                        } catch (error) {
                                                                                                                                              return res.status(500).json({ error: "Internal Server Error", details: error.message });
                                                                                                                                                  }
                                                                                                                                                    } else {
                                                                                                                                                        res.setHeader("Allow", ["GET", "POST"]);
                                                                                                                                                            return res.status(405).json({ error: "Method not allowed" });
                                                                                                                                                              }
                                                                                                                                                              }