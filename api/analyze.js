import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    export default async function handler(req, res) {
      if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' })
            }

              try {
                  const { address, interestRate } = req.body

                      // Simple AI-style estimation logic
                          const baseValue = 200000 + Math.random() * 250000
                              const rateFactor = 1 - (interestRate / 100) * 0.05
                                  const estimatedValue = baseValue * rateFactor
                                      const taxAssessment = estimatedValue * 0.012
                                          const estRent = estimatedValue * 0.006

                                              // Save to Supabase table
                                                  const { data, error } = await supabase
                                                        .from('properties_extended')
                                                              .insert([
                                                                      {
                                                                                address,
                                                                                          est_value: estimatedValue,
                                                                                                    tax_assessment: taxAssessment,
                                                                                                              est_rent: estRent
                                                                                                                      }
                                                                                                                            ])

                                                                                                                                if (error) throw error

                                                                                                                                    return res.status(200).json({
                                                                                                                                          success: true,
                                                                                                                                                address,
                                                                                                                                                      estimatedValue: Math.round(estimatedValue),
                                                                                                                                                            taxAssessment: Math.round(taxAssessment),
                                                                                                                                                                  estRent: Math.round(estRent)
                                                                                                                                                                      })
                                                                                                                                                                        } catch (err) {
                                                                                                                                                                            console.error(err)
                                                                                                                                                                                return res.status(500).json({ error: 'Server error', details: err.message })
                                                                                                                                                                                  }
                                                                                                                                                                                  }