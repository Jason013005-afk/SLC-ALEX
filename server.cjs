function loadSAFMR() {
  console.log("🔄 Loading SAFMR data...");

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(__dirname, "fy2024_safmrs.clean.csv"))
      .pipe(csv())
      .on("data", (row) => {

        const rawZip = row["ZIP Code"];
        const zip = padZip(rawZip);
        if (!zip) return;

        safmrData[zip] = {
          studio: parseDollar(row["SAFMR 0BR"]),
          one: parseDollar(row["SAFMR 1BR"]),
          two: parseDollar(row["SAFMR 2BR"]),
          three: parseDollar(row["SAFMR 3BR"]),
          four: parseDollar(row["SAFMR 4BR"]),
          metro: row["HUD Metro Fair Market Rent Area Name"]
        };
      })
      .on("end", () => {
        console.log("🏠 SAFMR loaded:", Object.keys(safmrData).length);
        resolve();
      })
      .on("error", reject);
  });
}