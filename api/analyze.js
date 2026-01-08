import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default async function handler(req, res) {
  try {
      const { address, interestRate } = req.query
          if (!address) return res.status(400).json({ error: 'Address required' })

              // --- Mock data until APIs are wired ---
                  const mockValue = 250000 + Math.floor(Math.random() * 50000)
                      const mockRent  = 1800 + Math.floor(Math.random() * 400)
                          const mockTaxes = mockValue * 0.021
                              const capRate   = (mockRent * 12) / mockValue
                                  const dscr      = (mockRent * 12) / ((mockValue * interestRate) / 100)
                                      const verdict   = dscr >= 1.25 ? 'GREEN' : dscr >= 1.0 ? 'AMBER' : 'RED'

                                          const { data, error } = await supabase
                                                .from('properties_extended')
                                                      .insert([
                                                              {
                                                                        address,
                                                                                  est_value: mockValue,
                                                                                            est_rent: mockRent,
                                                                                                      tax_assessed: mockTaxes,
                                                                                                                cap_rate: capRate,
                                                                                                                          dscr,
                                                                                                                                    risk_band: verdict,
                                                                                                                                              summary: `Est. Value $${mockValue}, Rent $${mockRent}, DSCR ${dscr.toFixed(2)}, Verdict ${verdict}`,
                                                                                                                                                        api_source: 'ALEX Mock Engine'
                                                                                                                                                                }
                                                                                                                                                                      ])
                                                                                                                                                                            .select()

                                                                                                                                                                                if (error) throw error
                                                                                                                                                                                    return res.status(200).json({ success: true, result: data[0] })
                                                                                                                                                                                      } catch (err) {
                                                                                                                                                                                          console.error(err)
                                                                                                                                                                                              res.status(500).json({ error: err.message })
                                                                                                                                                                                                }
                                                                                                                                                                                                }