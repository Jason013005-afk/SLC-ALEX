/* ================================
   SLC-ALEX Frontend Script
      ================================ */

      const API_BASE = "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

      document.addEventListener("DOMContentLoaded", () => {
        const form = document.getElementById("analysisForm");
          const resultBox = document.getElementById("result");

            if (!form || !resultBox) {
                console.error("Form or result container missing");
                    return;
                      }

                        form.addEventListener("submit", async (e) => {
                            e.preventDefault();

                                resultBox.textContent = "⏳ Analyzing property...";

                                    const address = document.getElementById("address").value;
                                        const interest = document.getElementById("interest").value;

                                            try {
                                                  const response = await fetch(`${API_BASE}/api/analyze`, {
                                                          method: "POST",
                                                                  headers: { "Content-Type": "application/json" },
                                                                          body: JSON.stringify({ address, interest })
                                                                                });

                                                                                      if (!response.ok) {
                                                                                              throw new Error(`Server error ${response.status}`);
                                                                                                    }

                                                                                                          const data = await response.json();

                                                                                                                resultBox.innerHTML = `
                                                                                                                        <h3>✅ Analysis Result</h3>
                                                                                                                                <pre>${JSON.stringify(data, null, 2)}</pre>
                                                                                                                                      `;
                                                                                                                                          } catch (err) {
                                                                                                                                                console.error(err);
                                                                                                                                                      resultBox.textContent = "❌ Backend connection failed.";
                                                                                                                                                          }
                                                                                                                                                            });
                                                                                                                                                            });