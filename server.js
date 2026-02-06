import express from "express";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SAFMR = new Map();

const normalizeZip = z => z?.toString().replace(/\D/g,"").padStart(5,"0");

function loadSAFMR() {
  return new Promise(resolve => {

    let headerLogged = false;

    fs.createReadStream("fy2024_safmrs.clean.csv")
      .pipe(csv())
      .on("data", row => {

        if (!headerLogged) {
          console.log("📄 SAFMR Headers:", Object.keys(row));
          headerLogged = true;
        }

        const zipKey = Object.keys(row).find(k => k.toLowerCase().includes("zip"));
        if (!zipKey) return;

        const zip = normalizeZip(row[zipKey]);
        if (!zip) return;

        ["0","1","2","3","4"].forEach(b => {
          const col = Object.keys(row).find(k => k.includes(`SAFMR ${b}BR`));
          if (!col) return;

          const rent = Number(row[col]);
          if (!rent) return;

          SAFMR.set(`${zip}-${b}`, {
            rent,
            p90: Math.round(rent * .9),
            p100: rent,
            p110: Math.round(rent * 1.1),
            source: "SAFMR"
          });
        });

      })
      .on("end", () => {
        console.log("🔥 SAFMR Loaded:", SAFMR.size);
        resolve();
      });
  });
}

app.post("/api/analyze", (req,res)=>{

  const zip = normalizeZip(req.body.zip);
  const beds = String(req.body.bedrooms ?? 1);

  const result = SAFMR.get(`${zip}-${beds}`);

  if(!result){
    return res.json({
      error:"No SAFMR found",
      zip,
      beds,
      sample:[...SAFMR.keys()].slice(0,5)
    });
  }

  res.json({ zip, bedrooms:Number(beds), ...result });
});

app.get("/",(_,res)=>res.sendFile(path.join(__dirname,"public/index.html")));
app.get("/system",(_,res)=>res.sendFile(path.join(__dirname,"public/system.html")));
app.get("/pricing",(_,res)=>res.sendFile(path.join(__dirname,"public/pricing.html")));
app.get("/contact",(_,res)=>res.sendFile(path.join(__dirname,"public/contact.html")));

await loadSAFMR();

app.listen(8080,()=>console.log("🚀 ALEX live http://127.0.0.1:8080"));