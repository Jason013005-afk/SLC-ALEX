import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    export default async function handler(req, res) {
      if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
            }

              const { address, rate } = req.body;

                if (!address || !rate) {
                    return res.status(400).json({ error: "Missing address or rate" });
                      }

                        try {
                            const { data, error } = await supabase
                                  .from("properties")
                                        .select("*")
                                              .ilike("address", `%${address}%`);

                                                  if (error) throw error;

                                                      return res.status(200).json({
                                                            success: true,
                                                                  address,
                                                                        rate,
                                                                              count: data?.length || 0,
                                                                                    results: data
                                                                                        });
                                                                                          } catch (err) {
                                                                                              console.error(err);
                                                                                                  return res.status(500).json({ error: err.message });
                                                                                                    }
                                                                                                    }