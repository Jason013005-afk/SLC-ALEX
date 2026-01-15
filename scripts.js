// ✅ scripts.js — connects automatically to backend
const backendURL = "https://obscure-lamp-97gr4gw497j5fj6x-4000.app.github.dev";

async function checkBackendStatus() {
  const statusEl = document.getElementById("backend-status");

    try {
        const res = await fetch(`${backendURL}/`);
            const data = await res.json();

                if (data.status === "ok") {
                      statusEl.innerHTML = "🟢 Backend Connected";
                            statusEl.style.color = "limegreen";
                                  console.log("✅ Backend OK");
                                      } else {
                                            throw new Error("Invalid backend response");
                                                }
                                                  } catch (err) {
                                                      console.error("Backend connection failed:", err);
                                                          statusEl.innerHTML = "🔴 Backend Connection Failed";
                                                              statusEl.style.color = "red";
                                                                }
                                                                }

                                                                async function analyzeProperty() {
                                                                  const address = document.getElementById("address").value.trim();
                                                                    const rate = parseFloat(document.getElementById("interestRate").value);
                                                                      const resultBox = document.getElementById("results");

                                                                        if (!address || isNaN(rate)) {
                                                                            resultBox.innerHTML = `<p style="color: gold;">⚠️ Enter valid address and interest rate.</p>`;
                                                                                return;
                                                                                  }

                                                                                    resultBox.innerHTML = `<p style="color: gold;">⏳ Analyzing property...</p>`;

                                                                                      try {
                                                                                          const res = await fetch(`${backendURL}/api/stress`, {
                                                                                                method: "POST",
                                                                                                      headers: { "Content-Type": "application/json" },
                                                                                                            body: JSON.stringify({ address, interestRate: rate }),
                                                                                                                });

                                                                                                                    if (!res.ok) throw new Error("Server error");

                                                                                                                        const data = await res.json();

                                                                                                                            resultBox.innerHTML = `
                                                                                                                                  <div style="color: gold; text-shadow: 0 0 10px #ffbf00;">
                                                                                                                                          <h3>📊 Analysis Results</h3>
                                                                                                                                                  <p><b>Address:</b> ${data.address}</p>
                                                                                                                                                          <p><b>Estimated Value:</b> $${data.estimatedValue}</p>
                                                                                                                                                                  <p><b>Rent:</b> $${data.rent}</p>
                                                                                                                                                                          <p><b>Section 8:</b> $${data.section8}</p>
                                                                                                                                                                                  <p><b>ROI:</b> ${data.roi}</p>
                                                                                                                                                                                          <p><b>Loan Amount:</b> $${data.lma}</p>
                                                                                                                                                                                                  <p><b>Market Appreciation:</b> $${data.appreciation}</p>
                                                                                                                                                                                                        </div>
                                                                                                                                                                                                            `;
                                                                                                                                                                                                              } catch (err) {
                                                                                                                                                                                                                  console.error(err);
                                                                                                                                                                                                                      resultBox.innerHTML = `<p style="color: red;">⚠️ Could not fetch analysis.</p>`;
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                        }

                                                                                                                                                                                                                        document.addEventListener("DOMContentLoaded", checkBackendStatus);