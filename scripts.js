// scripts.js – front-end for ALEX™ system
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
    parallaxBackground();
    });

    function parallaxBackground() {
      const bg = document.body;
        window.addEventListener("scroll", () => {
            const y = window.scrollY * 0.4;
                bg.style.backgroundPosition = `center calc(50% + ${y}px)`;
                  });
                  }

                  // Loader and stress test simulation
                  document.addEventListener("DOMContentLoaded", () => {
                    const runTestBtn = document.getElementById("runTest");
                      if (!runTestBtn) return;

                        runTestBtn.addEventListener("click", async () => {
                            const address = document.getElementById("address")?.value || "Unknown Property";
                                const rate = document.getElementById("rate")?.value || "N/A";

                                    const loader = document.getElementById("loader");
                                        loader.classList.add("show");

                                            // Call API
                                                try {
                                                      const res = await fetch(`/api/analyze?address=${encodeURIComponent(address)}&rate=${encodeURIComponent(rate)}`);
                                                            const data = await res.json();

                                                                  setTimeout(() => {
                                                                          loader.classList.remove("show");
                                                                                  alert(
                                                                                            `🏠 ${data.address}\n💰 Estimated Price: ${data.priceEstimate}\n📊 Tax History: ${data.taxHistory}\n🧠 Risk: ${data.riskScore}\n✅ Verdict: ${data.verdict}`
                                                                                                    );
                                                                                                          }, 2200);
                                                                                                              } catch (e) {
                                                                                                                    loader.classList.remove("show");
                                                                                                                          alert("⚠️ ALEX™ failed to process the request. Try again.");
                                                                                                                              }
                                                                                                                                });
                                                                                                                                });