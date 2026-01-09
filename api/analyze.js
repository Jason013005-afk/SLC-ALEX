export default function handler(req, res) {
      try {
          res.status(200).json({
                message: "ALEX Stress Test endpoint connected successfully.",
                      hint: "In production, this will process deal data and return a stress score."
                          });
                            } catch (error) {
                                console.error("Error:", error);
                                    res.status(500).json({ error: "Internal Server Error" });
                                      }
                                      }
}