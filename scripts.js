window.addEventListener("load", () => {
      document.body.classList.add("loaded");
        setupParallax();
        });

        function setupParallax() {
          const bg = document.body;
            window.addEventListener("scroll", () => {
                const y = window.scrollY * 0.4;
                    bg.style.backgroundPosition = `center calc(50% + ${y}px)`;
                      });
                      }

                      document.addEventListener("DOMContentLoaded", () => {
                        const runTestBtn = document.getElementById("runTest");
                          const loader = document.getElementById("loader");
                            const resultCard = document.getElementById("result-card");
                              const resultBody = document.getElementById("result-body");

                                if (!runTestBtn) return;

                                  runTestBtn.addEventListener("click", async (e) => {
                                      e.preventDefault();

                                          const address = document.getElementById("address").value.trim();
                                              const rate = document.getElementById("rate").value.trim();

                                                  if (!address) {
                                                        alert("Please enter a property address.");
                                                              return;
                                                                  }

                                                                      loader.classList.add("show");
                                                                          resultCard.classList.add("hidden");

                                                                              try {
                                                                                    const res = await fetch(`/api/analyze?address=${encodeURIComponent(address)}&rate=${encodeURIComponent(rate)}`);
                                                                                          const data = await res.json();

                                                                                                setTimeout(() => {
                                                                                                        loader.classList.remove("show");

                                                                                                                resultBody.innerHTML = `
                                                                                                                          <b>🏠 Property:</b> ${data.address}<br>
                                                                                                                                    <b>💰 Est. Price:</b> ${data.priceEstimate}<br>
                                                                                                                                              <b>📊 Tax History:</b> ${data.taxHistory}<br>
                                                                                                                                                        <b>⚖️ Risk:</b> ${data.riskScore}<br>
                                                                                                                                                                  <b>🧠 Verdict:</b> ${data.verdict}
                                                                                                                                                                          `;
                                                                                                                                                                                  resultCard.classList.remove("hidden");
                                                                                                                                                                                          resultCard.scrollIntoView({ behavior: "smooth" });
                                                                                                                                                                                                }, 1800);
                                                                                                                                                                                                    } catch (error) {
                                                                                                                                                                                                          loader.classList.remove("show");
                                                                                                                                                                                                                alert("ALEX™ failed to analyze this deal. Try again.");
                                                                                                                                                                                                                    }
                                                                                                                                                                                                                      });
                                                                                                                                                                                                                      });
})