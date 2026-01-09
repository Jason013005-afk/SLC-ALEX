export default async function handler(req, res) {
      try {
          // Only allow POST
              if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                        }

                            // Extract from request body
                                const { address, rate } = req.body;

                                    // Validate
                                        if (!address || !rate) {
                                              return res.status(400).json({ error: 'Missing address or rate' });
                                                  }

                                                      // Simulate stress test logic
                                                          const stressScore = Math.random();
                                                              let verdict;

                                                                  if (stressScore > 0.75) verdict = 'Proceed ✅';
                                                                      else if (stressScore > 0.5) verdict = 'Renegotiate ⚠️';
                                                                          else verdict = 'Kill ❌';

                                                                              // Return analysis
                                                                                  return res.status(200).json({
                                                                                        address,
                                                                                              rate,
                                                                                                    stressScore: stressScore.toFixed(2),
                                                                                                          verdict,
                                                                                                                message: `Analysis complete for ${address}. Recommended action: ${verdict}`
                                                                                                                    });
                                                                                                                      } catch (err) {
                                                                                                                          console.error('Error in /api/analyze:', err);
                                                                                                                              return res.status(500).json({ error: 'Internal Server Error' });
                                                                                                                                }
                                                                                                                                }
}