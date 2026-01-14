// scripts.js
console.log("✅ ALEX frontend scripts loaded successfully.");

// === API BASE URL ===
// (You can change this later to your permanent backend endpoint on Vercel)
const API_BASE = "https://ooo.app.github.dev";

// === FORM HANDLER ===
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#stressTestForm");
    const resultBox = document.querySelector("#results");
      const button = document.querySelector("#runTestButton");

        if (!form) {
            console.warn("⚠️ stressTestForm not found on this page.");
                return;
                  }

                    form.addEventListener("submit", async (e) => {
                        e.preventDefault();

                            resultBox.innerHTML = "⏳ Running ALEX Stress Test...";
                                button.disabled = true;

                                    const formData = {
                                          propertyType: form.propertyType?.value,
                                                purchasePrice: parseFloat(form.purchasePrice?.value || 0),
                                                      downPayment: parseFloat(form.downPayment?.value || 0),
                                                            interestRate: parseFloat(form.interestRate?.value || 0),
                                                                  rentalIncome: parseFloat(form.rentalIncome?.value || 0),
                                                                        operatingExpenses: parseFloat(form.operatingExpenses?.value || 0)
                                                                            };

                                                                                try {
                                                                                      const response = await fetch(`${API_BASE}/api/stress`, {
                                                                                              method: "POST",
                                                                                                      headers: { "Content-Type": "application/json" },
                                                                                                              body: JSON.stringify(formData)
                                                                                                                    });

                                                                                                                          if (!response.ok) {
                                                                                                                                  throw new Error(`Server returned ${response.status}`);
                                                                                                                                        }

                                                                                                                                              const data = await response.json();

                                                                                                                                                    resultBox.innerHTML = `
                                                                                                                                                            <div class="results-box">
                                                                                                                                                                      <h3>📊 ALEX Stress Test Results</h3>
                                                                                                                                                                                <p><strong>Risk Rating:</strong> ${data.risk || "N/A"}</p>
                                                                                                                                                                                          <p><strong>Capital Safety Index:</strong> ${data.capitalIndex || "N/A"}</p>
                                                                                                                                                                                                    <p><strong>Liquidity Stress:</strong> ${data.liquidity || "N/A"}</p>
                                                                                                                                                                                                              <p><strong>Summary:</strong> ${data.summary || "No summary provided"}</p>
                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                            `;
                                                                                                                                                                                                                                } catch (err) {
                                                                                                                                                                                                                                      console.error("❌ Backend connection failed:", err);
                                                                                                                                                                                                                                            resultBox.innerHTML = `
                                                                                                                                                                                                                                                    <p style="color: red;">
                                                                                                                                                                                                                                                              ⚠️ Unable to connect to ALEX backend. Please try again later.
                                                                                                                                                                                                                                                                      </p>
                                                                                                                                                                                                                                                                            `;
                                                                                                                                                                                                                                                                                } finally {
                                                                                                                                                                                                                                                                                      button.disabled = false;
                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                            });
                                                                                                                                                                                                                                                                                            });