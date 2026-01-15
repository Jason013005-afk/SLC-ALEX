// === SLC-ALEX Property Analyzer Frontend Script ===

// ✅ Update this URL if your backend port changes
const backendURL = "https://497j5fj6x-4000.app.github.dev";

// ===== Backend Connection Check =====
async function checkBackendConnection() {
  const statusElem = document.getElementById("backend-status");
    try {
        const res = await fetch(`${backendURL}/`);
            if (res.ok) {
                  statusElem.innerHTML = "🟢 Backend Connected";
                        statusElem.style.color = "limegreen";
                            } else {
                                  throw new Error("Connection failed");
                                      }
                                        } catch (err) {
                                            statusElem.innerHTML = "🔴 Backend Connection Failed";
                                                statusElem.style.color = "red";
                                                  }
                                                  }
                                                  checkBackendConnection();

                                                  // ===== Analyze Property =====
                                                  async function analyzeProperty() {
                                                    const address = document.getElementById("address").value.trim();
                                                      const interestRate = document.getElementById("interestRate").value.trim();
                                                        const resultsBox = document.getElementById("results");
                                                          const analyzeButton = document.getElementById("analyze-btn");

                                                            if (!address || !interestRate) {
                                                                resultsBox.innerHTML = "⚠️ Please enter both Address and Interest Rate.";
                                                                    return;
                                                                      }

                                                                        // Loading animation
                                                                          analyzeButton.disabled = true;
                                                                            analyzeButton.innerHTML = "⏳ Analyzing...";

                                                                              try {
                                                                                  const response = await fetch(`${backendURL}/api/stress`, {
                                                                                        method: "POST",
                                                                                              headers: { "Content-Type": "application/json" },
                                                                                                    body: JSON.stringify({ address, interestRate }),
                                                                                                        });

                                                                                                            if (!response.ok) throw new Error("Backend error");

                                                                                                                const data = await response.json();

                                                                                                                    resultsBox.innerHTML = `
                                                                                                                          <h3>📊 Analysis Results</h3>
                                                                                                                                <p><b>Address:</b> ${data.address}</p>
                                                                                                                                      <p><b>Interest Rate:</b> ${data.interestRate}%</p>
                                                                                                                                            <p><b>Estimated Value:</b> $${data.estimatedValue.toLocaleString()}</p>
                                                                                                                                                  <p><b>Monthly Rent:</b> $${data.rentValue.toLocaleString()}</p>
                                                                                                                                                        <p><b>Section 8 Rate:</b> $${data.section8.toLocaleString()}</p>
                                                                                                                                                              <p><b>Taxes:</b> $${data.taxes.toLocaleString()}</p>
                                                                                                                                                                    <p><b>Insurance:</b> $${data.insurance.toLocaleString()}</p>
                                                                                                                                                                          <p><b>ROI:</b> ${data.roi}</p>
                                                                                                                                                                                <p><b>Appreciation:</b> $${data.appreciation.toLocaleString()}</p>
                                                                                                                                                                                      <p><b>5-Year Net Profit:</b> $${data.netProfit.toLocaleString()}</p>
                                                                                                                                                                                            <p><b>Total Return:</b> $${data.totalReturn.toLocaleString()}</p>
                                                                                                                                                                                                `;
                                                                                                                                                                                                  } catch (error) {
                                                                                                                                                                                                      console.error("❌ Analysis Error:", error);
                                                                                                                                                                                                          resultsBox.innerHTML = `
                                                                                                                                                                                                                ⚠️ Could not fetch analysis. Check backend or input.
                                                                                                                                                                                                                    `;
                                                                                                                                                                                                                      } finally {
                                                                                                                                                                                                                          analyzeButton.disabled = false;
                                                                                                                                                                                                                              analyzeButton.innerHTML = "🔍 Analyze Property";
                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                }