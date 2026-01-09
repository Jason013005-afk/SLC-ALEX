// scripts.js — ALEX™ Decision Engine Frontend Controller
console.log("✅ ALEX Frontend Loaded");

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runTest");
    const addressInput = document.getElementById("addressInput");
      const rateInput = document.getElementById("rateInput");
        const summary = document.getElementById("summaryText");
          const progress = document.getElementById("progressBar");
            const roi = document.getElementById("roi");
              const risk = document.getElementById("risk");
                const equity = document.getElementById("equity");

                  if (!runBtn) {
                      console.warn("Run button not found on this page");
                          return;
                            }

                              runBtn.addEventListener("click", async () => {
                                  const address = addressInput?.value.trim() || "Unknown Address";
                                      const rate = rateInput?.value.trim() || "N/A";

                                          summary.textContent = "Analyzing Deal...";
                                              progress.style.width = "0%";

                                                  // Smooth progress animation
                                                      for (let i = 0; i <= 100; i += 5) {
                                                            await new Promise((r) => setTimeout(r, 40));
                                                                  progress.style.width = `${i}%`;
                                                                      }

                                                                          try {
                                                                                // Call backend API (auto-resolves on Vercel)
                                                                                      const response = await fetch(`/api/analyze?address=${encodeURIComponent(address)}&rate=${encodeURIComponent(rate)}`);

                                                                                            if (!response.ok) {
                                                                                                    throw new Error(`HTTP error ${response.status}`);
                                                                                                          }

                                                                                                                const data = await response.json();
                                                                                                                      console.log("✅ ALEX Data:", data);

                                                                                                                            // Update metrics on screen
                                                                                                                                  roi.textContent = Math.floor(Math.random() * 20 + 5) + "%";
                                                                                                                                        risk.textContent = data.risk || "UNKNOWN";
                                                                                                                                              equity.textContent = Math.floor(Math.random() * 30 + 10) + "%";
                                                                                                                                                    summary.innerHTML = `
                                                                                                                                                            <strong>Address:</strong> ${data.address}<br>
                                                                                                                                                                    <strong>Est. Value:</strong> ${data.estimate}<br>
                                                                                                                                                                            <strong>Risk Level:</strong> ${data.risk}<br>
                                                                                                                                                                                    <strong>Verdict:</strong> ${data.verdict}<br>
                                                                                                                                                                                            <strong>Analysis Time:</strong> ${data.time}
                                                                                                                                                                                                  `;
                                                                                                                                                                                                      } catch (err) {
                                                                                                                                                                                                            console.error("❌ ALEX Error:", err);
                                                                                                                                                                                                                  summary.textContent = "Error running stress test. Please try again.";
                                                                                                                                                                                                                      }
                                                                                                                                                                                                                        });
                                                                                                                                                                                                                        });