/* ================================
   SLC-ALEX Frontend Script
      CLEAN + WORKING
         ================================ */

         /* BACKEND BASE URL (PORT 4000) */
         const API_BASE = "https://orange-succotash-4jp59p697gqqh5559-4000.app.github.dev";

         /* DOM ELEMENTS */
         const form = document.getElementById("analysisForm");
         const resultBox = document.getElementById("result");

         /* SAFETY CHECK */
         if (!form || !resultBox) {
           console.error("Required DOM elements not found");
           }

           /* FORM SUBMIT */
           form?.addEventListener("submit", async (e) => {
             e.preventDefault();

               resultBox.innerHTML = "⏳ Analyzing property…";

                 const address = document.getElementById("address")?.value || "";
                   const interest = document.getElementById("interest")?.value || "";

                     try {
                         const res = await fetch(`${API_BASE}/api/analyze`, {
                               method: "POST",
                                     headers: {
                                             "Content-Type": "application/json"
                                                   },
                                                         body: JSON.stringify({ address, interest })
                                                             });

                                                                 if (!res.ok) {
                                                                       throw new Error(`Server error: ${res.status}`);
                                                                           }

                                                                               const data = await res.json();

                                                                                   resultBox.innerHTML = `
                                                                                         <h3>✅ Analysis Result</h3>
                                                                                               <pre>${JSON.stringify(data, null, 2)}</pre>
                                                                                                   `;
                                                                                                     } catch (err) {
                                                                                                         console.error(err);
                                                                                                             resultBox.innerHTML = "❌ Backend connection failed.";
                                                                                                               }
                                                                                                               });