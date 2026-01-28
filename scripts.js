// ===================================
// SLC-ALEX Frontend Script (CLEAN)
// ===================================

// 🔗 BACKEND BASE URL (PORT 4000)
const BASE_URL = "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

// ===================================
// DOM ELEMENTS
// ===================================
const statusEl = document.getElementById("backend-status");
const formEl = document.getElementById("property-form");
const resultEl = document.getElementById("analysis-result");

// ===================================
// BACKEND STATUS CHECK
// ===================================
async function checkBackendStatus() {
  try {
      const res = await fetch(`${BASE_URL}/health`);
          if (!res.ok) throw new Error("Backend not reachable");

              const data = await res.json();
                  statusEl.textContent = "🟢 Backend Connected";
                      statusEl.style.color = "#00ff99";
                          console.log("Backend OK:", data);
                            } catch (err) {
                                console.error("Backend check failed:", err);
                                    statusEl.textContent = "🔴 Backend Connection Failed";
                                        statusEl.style.color = "#ff4444";
                                          }
                                          }

                                          // ===================================
                                          // PROPERTY ANALYSIS SUBMIT
                                          // ===================================
                                          async function analyzeProperty(address, interest) {
                                            resultEl.innerHTML = "⏳ Analyzing property...";

                                              try {
                                                  const res = await fetch(`${BASE_URL}/analyze`, {
                                                        method: "POST",
                                                              headers: {
                                                                      "Content-Type": "application/json"
                                                                            },
                                                                                  body: JSON.stringify({
                                                                                          address: address,
                                                                                                  interestRate: interest
                                                                                                        })
                                                                                                            });

                                                                                                                if (!res.ok) {
                                                                                                                      throw new Error(`Server error ${res.status}`);
                                                                                                                          }

                                                                                                                              const data = await res.json();

                                                                                                                                  resultEl.innerHTML = `
                                                                                                                                        <h3>📊 Analysis Result</h3>
                                                                                                                                              <pre>${JSON.stringify(data, null, 2)}</pre>
                                                                                                                                                  `;
                                                                                                                                                    } catch (err) {
                                                                                                                                                        console.error("Analysis failed:", err);
                                                                                                                                                            resultEl.innerHTML = "❌ Failed to analyze property.";
                                                                                                                                                              }
                                                                                                                                                              }

                                                                                                                                                              // ===================================
                                                                                                                                                              // FORM HANDLER
                                                                                                                                                              // ===================================
                                                                                                                                                              if (formEl) {
                                                                                                                                                                formEl.addEventListener("submit", (e) => {
                                                                                                                                                                    e.preventDefault();

                                                                                                                                                                        const address = document.getElementById("address").value.trim();
                                                                                                                                                                            const interest = parseFloat(
                                                                                                                                                                                  document.getElementById("interest").value
                                                                                                                                                                                      );

                                                                                                                                                                                          if (!address || isNaN(interest)) {
                                                                                                                                                                                                alert("Please enter a valid address and interest rate.");
                                                                                                                                                                                                      return;
                                                                                                                                                                                                          }

                                                                                                                                                                                                              analyzeProperty(address, interest);
                                                                                                                                                                                                                });
                                                                                                                                                                                                                }

                                                                                                                                                                                                                // ===================================
                                                                                                                                                                                                                // INIT
                                                                                                                                                                                                                // ===================================
                                                                                                                                                                                                                document.addEventListener("DOMContentLoaded", () => {
                                                                                                                                                                                                                  checkBackendStatus();
                                                                                                                                                                                                                  });