// ========================
// SLC-ALEX FRONTEND SCRIPT
// ========================

// ✅ Backend base URL (use the one from your screenshot)
const BASE_URL = "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

// ========================
// Backend Connection Check
// ========================
async function BackendStatus() {
  const statusEl = document.getElementById("backend-status");

    try {
        const res = await fetch(`${BASE_URL}/api/status`);
            const data = await res.json();

                statusEl.innerHTML = `🟢 ${data.message}`;
                    statusEl.style.color = "lime";
                        console.log("✅ Backend Connected");
                          } catch (err) {
                              statusEl.innerHTML = "🔴 Backend Connection Failed";
                                  statusEl.style.color = "red";
                                      console.error("❌ Backend Connection Error:", err);
                                        }
                                        }

                                        // ========================
                                        // Property Analyzer Function
                                        // ========================
                                        async function analyzeProperty() {
                                          const address = document.getElementById("address").value;
                                            const interest = document.getElementById("interest").value;
                                              const resultEl = document.getElementById("result");

                                                if (!address) {
                                                    resultEl.innerHTML = "⚠️ Please enter a property address.";
                                                        return;
                                                          }

                                                            try {
                                                                const res = await fetch(`${BASE_URL}/api/analyze`, {
                                                                      method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                                  body: JSON.stringify({ address, interest }),
                                                                                      });

                                                                                          const data = await res.json();
                                                                                              resultEl.innerHTML = `💰 Estimated ROI: ${data.roi}%`;
                                                                                                } catch (err) {
                                                                                                    console.error("❌ Property analysis error:", err);
                                                                                                        resultEl.innerHTML = "❌ Failed to analyze property.";
                                                                                                          }
                                                                                                          }

                                                                                                          // ========================
                                                                                                          // Auto-run on page load
                                                                                                          // ========================
                                                                                                          document.addEventListener("DOMContentLoaded", () => {
                                                                                                            BackendStatus();
                                                                                                              document.getElementById("analyze-btn").addEventListener("click", analyzeProperty);
                                                                                                              });