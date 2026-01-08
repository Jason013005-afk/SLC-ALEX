import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    export default async function handler(req, res) {
      if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
            }

              try {
                  const { address, interestRate } = req.body;

                      if (!address || !interestRate) {
                            return res.status(400).json({ error: 'Missing address or interest rate' });
                                }

                                    // Search property info from your Supabase table
                                        const { data, error } = await supabase
                                              .from('properties_extended')
                                                    .select('*')
                                                          .ilike('address', `%${address}%`)
                                                                .limit(1)
                                                                      .single();

                                                                          if (error || !data) {
                                                                                return res.status(404).json({ error: 'Property not found in database' });
                                                                                    }

                                                                                        // Example: basic stress test calculation
                                                                                            const monthlyTax = (data.tax_assessed_value || 0) / 12;
                                                                                                const monthlyInterest = (interestRate / 100) * (data.estimated_value || 0) / 12;
                                                                                                    const stressScore = (monthlyInterest + monthlyTax) / (data.estimated_rent || 1);

                                                                                                        // Simple risk color code
                                                                                                            let riskLevel = 'GREEN';
                                                                                                                if (stressScore > 0.6) riskLevel = 'YELLOW';
                                                                                                                    if (stressScore > 0.9) riskLevel = 'RED';

                                                                                                                        return res.status(200).json({
                                                                                                                              address: data.address,
                                                                                                                                    estimatedValue: data.estimated_value,
                                                                                                                                          taxAssessedValue: data.tax_assessed_value,
                                                                                                                                                interestRate,
                                                                                                                                                      monthlyTax,
                                                                                                                                                            monthlyInterest,
                                                                                                                                                                  stressScore,
                                                                                                                                                                        riskLevel
                                                                                                                                                                            });
                                                                                                                                                                              } catch (err) {
                                                                                                                                                                                  console.error('Error in analyze.js:', err);
                                                                                                                                                                                      return res.status(500).json({ error: 'Internal Server Error' });
                                                                                                                                                                                        }
                                                                                                                                                                                        }