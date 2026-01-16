// api/contact.js
export default async function handler(req, res) {
  if (req.method === "POST") {
      const { name, email, message } = req.body;

          console.log("📨 New Contact Message:", { name, email, message });

              if (!name || !email || !message) {
                    return res.status(400).json({ error: "All fields are required." });
                        }

                            return res.status(200).json({
                                  success: true,
                                        message: `Thanks ${name}! We'll get back to you soon.`,
                                            });
                                              } else {
                                                  res.status(405).json({ error: "Method not allowed" });
                                                    }
                                                    }