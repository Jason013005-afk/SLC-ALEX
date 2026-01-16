// ===============================
// SLC-ALEX Frontend Script
// ===============================

// ✅ Live backend URL
const backendUrl = "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

// Wait until DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initContactForm();
    loadServices();
    });

    // ===============================
    // CONTACT FORM HANDLER
    // ===============================
    function initContactForm() {
      const contactForm = document.querySelector("#contactForm");
        const statusBox = document.querySelector("#formStatus");

          if (!contactForm) return;

            contactForm.addEventListener("submit", async (e) => {
                e.preventDefault();

                    const formData = {
                          name: document.querySelector("#name").value.trim(),
                                email: document.querySelector("#email").value.trim(),
                                      message: document.querySelector("#message").value.trim(),
                                          };

                                              statusBox.textContent = "Sending...";
                                                  statusBox.style.color = "#c6a45a"; // Gold tone

                                                      try {
                                                            const res = await fetch(`${backendUrl}/api/contact`, {
                                                                    method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                                    body: JSON.stringify(formData),
                                                                                          });

                                                                                                const data = await res.json();

                                                                                                      if (res.ok) {
                                                                                                              statusBox.textContent = "✅ Message sent successfully!";
                                                                                                                      statusBox.style.color = "#00c851";
                                                                                                                              contactForm.reset();
                                                                                                                                    } else {
                                                                                                                                            statusBox.textContent = `❌ Error: ${data.error || "Message failed"}`;
                                                                                                                                                    statusBox.style.color = "#ff4444";
                                                                                                                                                          }
                                                                                                                                                              } catch (err) {
                                                                                                                                                                    console.error("Error sending form:", err);
                                                                                                                                                                          statusBox.textContent = "⚠️ Unable to reach server.";
                                                                                                                                                                                statusBox.style.color = "#ffbb33";
                                                                                                                                                                                    }
                                                                                                                                                                                      });
                                                                                                                                                                                      }

                                                                                                                                                                                      // ===============================
                                                                                                                                                                                      // DYNAMIC SERVICES SECTION
                                                                                                                                                                                      // ===============================
                                                                                                                                                                                      async function loadServices() {
                                                                                                                                                                                        const serviceSection = document.querySelector("#servicesList");
                                                                                                                                                                                          if (!serviceSection) return;

                                                                                                                                                                                            serviceSection.innerHTML = "<p>Loading services...</p>";

                                                                                                                                                                                              try {
                                                                                                                                                                                                  const res = await fetch(`${backendUrl}/api/services`);
                                                                                                                                                                                                      const data = await res.json();

                                                                                                                                                                                                          if (Array.isArray(data.services)) {
                                                                                                                                                                                                                serviceSection.innerHTML = data.services
                                                                                                                                                                                                                        .map(
                                                                                                                                                                                                                                  (s) => `
                                                                                                                                                                                                                                            <div class="service-item fade-in">
                                                                                                                                                                                                                                                        <h3>${s.title}</h3>
                                                                                                                                                                                                                                                                    <p>${s.description}</p>
                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                      `
                                                                                                                                                                                                                                                                                              )
                                                                                                                                                                                                                                                                                                      .join("");
                                                                                                                                                                                                                                                                                                          } else {
                                                                                                                                                                                                                                                                                                                serviceSection.innerHTML = "<p>No services found.</p>";
                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                      } catch (err) {
                                                                                                                                                                                                                                                                                                                          console.error("Service load error:", err);
                                                                                                                                                                                                                                                                                                                              serviceSection.innerHTML = "<p>⚠️ Unable to load services.</p>";
                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                                                                                // ===============================
                                                                                                                                                                                                                                                                                                                                // SIMPLE SCROLL FADE-IN EFFECT
                                                                                                                                                                                                                                                                                                                                // ===============================
                                                                                                                                                                                                                                                                                                                                window.addEventListener("scroll", () => {
                                                                                                                                                                                                                                                                                                                                  document.querySelectorAll(".fade-in").forEach((el) => {
                                                                                                                                                                                                                                                                                                                                      const rect = el.getBoundingClientRect();
                                                                                                                                                                                                                                                                                                                                          if (rect.top < window.innerHeight - 100) {
                                                                                                                                                                                                                                                                                                                                                el.classList.add("visible");
                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                      });
                                                                                                                                                                                                                                                                                                                                                      });