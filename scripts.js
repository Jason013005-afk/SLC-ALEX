// 🔗 Backend URL
const backendURL = "https://obscure-lamp-97gr4gw497j5fj6x-4000.app.github.dev";

// 🔍 Check backend connection
async function checkBackendStatus() {
  const statusEl = document.getElementById("backend-status");
    try {
        const res = await fetch(`${backendURL}/`);
            if (!res.ok) throw new Error("Backend not reachable");

                const data = await res.json();
                    statusEl.innerHTML = "🟢 Backend Connected";
                        statusEl.style.color = "limegreen";
                          } catch (err) {
                              statusEl.innerHTML = "🔴 Backend Connection Failed";
                                  statusEl.style.color = "red";
                                    }
                                    }

                                    // 🧮 Analyze Property
                                    async function analyzeProperty() {
                                      const address = document.getElementById("address").value.trim();
                                        const rate = parseFloat(document.getElementById("interestRate").value);
                                          const resultBox = document.getElementById("results");

                                            if (!address || isNaN(rate)) {
                                                resultBox.innerHTML = `<p style="color: gold;">⚠️ Please enter a valid address and interest rate.</p>`;
                                                    return;
                                                      }

                                                        resultBox.innerHTML = `<p style="color: gold;">⏳ Analyzing property...</p>`;

                                                          try {
                                                              const res = await fetch(`${backendURL}/api/stress`, {
                                                                    method: "POST",
                                                                          headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                        address,
                                                                                                interestRate: rate,
                                                                                                        // Optional placeholder data — backend ignores if not needed
                                                                                                                price: 300000,
                                                                                                                        rent: 2500,
                                                                                                                              }),
                                                                                                                                  });

                                                                                                                                      if (!res.ok) throw new Error("Failed to fetch analysis");

                                                                                                                                          const data = await res.json();

                                                                                                                                              resultBox.innerHTML = `
                                                                                                                                                    <div style="color: gold; text-shadow: 0 0 10px #ffbf00;">
                                                                                                                                                            <h3>📊 Analysis Results</h3>
                                                                                                                                                                    <p><b>Address:</b> ${data.address || address}</p>
                                                                                                                                                                            <p><b>Estimated Value:</b> $${data.estimatedValue?.toLocaleString() || "N/A"}</p>
                                                                                                                                                                                    <p><b>Rent:</b> $${data.rent?.toLocaleString() || "N/A"}</p>
                                                                                                                                                                                            <p><b>Section 8:</b> $${data.section8?.toLocaleString() || "N/A"}</p>
                                                                                                                                                                                                    <p><b>ROI:</b> ${data.roi || "N/A"}</p>
                                                                                                                                                                                                            <p><b>Market Appreciation:</b> $${data.appreciation?.toLocaleString() || "N/A"}</p>
                                                                                                                                                                                                                    <p><b>Loan Amount:</b> $${data.lma || "N/A"}</p>
                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                              `;
                                                                                                                                                                                                                                } catch (err) {
                                                                                                                                                                                                                                    console.error("Error:", err);
                                                                                                                                                                                                                                        resultBox.innerHTML = `<p style="color: red;">⚠️ Could not fetch analysis. Check backend or input.</p>`;
                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                          }

                                                                                                                                                                                                                                          // ⚙️ Auto-run backend check when page loads
                                                                                                                                                                                                                                          document.addEventListener("DOMContentLoaded", checkBackendStatus);