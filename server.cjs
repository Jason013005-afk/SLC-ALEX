require('dotenv').config({ path: './.env' })

const express = require('express')
const fs = require('fs')
const csv = require('csv-parser')
const axios = require('axios')
const path = require('path')

const app = express()
app.use(express.json())
app.use(express.static('public'))

const PORT = 8080

/* =========================
   LOAD HUD SAFMR DATA
========================= */

let hudRents = {}

console.log('🔄 Loading SAFMR data...')

fs.createReadStream('fy2024_safmrs_clean.csv')
  .pipe(csv())
  .on('data', (row) => {
    const zip = String(row['ZIP Code']).trim()

    hudRents[zip] = {
      0: parseMoney(row['SAFMR 0BR']),
      1: parseMoney(row['SAFMR 1BR']),
      2: parseMoney(row['SAFMR 2BR']),
      3: parseMoney(row['SAFMR 3BR']),
      4: parseMoney(row['SAFMR 4BR'])
    }
  })
  .on('end', () => {
    console.log(`🏠 SAFMR loaded: ${Object.keys(hudRents).length} ZIPs`)
  })

function parseMoney(value) {
  if (!value) return 0
  return Number(value.replace(/[$,]/g, ''))
}

/* =========================
   MORTGAGE CALCULATOR
========================= */

function calcMortgage(principal, rate, years = 30) {
  const r = rate / 100 / 12
  const n = years * 12
  return principal * r / (1 - Math.pow(1 + r, -n))
}

/* =========================
   DEAL GRADE ENGINE
========================= */

function gradeDeal(dscr, cashFlow) {
  if (dscr >= 1.3 && cashFlow > 500) return 'A'
  if (dscr >= 1.15 && cashFlow > 200) return 'B'
  if (dscr >= 1.0) return 'C'
  return 'D'
}

/* =========================
   MAIN DEAL ENDPOINT
========================= */

app.post('/api/deal-grade', async (req, res) => {
  try {
    const { address, interestRate } = req.body

    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }

    if (!process.env.RENTCAST_API_KEY) {
      return res.status(500).json({ error: 'RentCast API key missing' })
    }

    /* =====================
       1️⃣ GET PROPERTY
    ===================== */

    const propertyResponse = await axios.get(
      'https://api.rentcast.io/v1/properties',
      {
        params: { address },
        headers: { 'X-Api-Key': process.env.RENTCAST_API_KEY }
      }
    )

    const property = propertyResponse.data?.[0]

    if (!property) {
      return res.status(404).json({ error: 'Property not found' })
    }

    const zip = property.zipCode
    const bedrooms = property.bedrooms || 3
    const price = property.lastSalePrice || property.taxAssessments?.['2024']?.value

    /* =====================
       2️⃣ GET HUD RENT
    ===================== */

    const rent = hudRents[zip]?.[bedrooms]

    if (!rent) {
      return res.status(404).json({ error: `Rent not found for ZIP ${zip}` })
    }

    /* =====================
       3️⃣ CALCULATE DEAL
    ===================== */

    const purchasePrice = price || 250000
    const downPayment = purchasePrice * 0.2
    const loanAmount = purchasePrice - downPayment

    const monthlyMortgage = calcMortgage(
      loanAmount,
      interestRate || 6.5
    )

    const annualRent = rent * 12
    const annualExpenses = annualRent * 0.35
    const annualNOI = annualRent - annualExpenses
    const annualDebt = monthlyMortgage * 12
    const cashFlow = annualNOI - annualDebt
    const capRate = (annualNOI / purchasePrice) * 100
    const dscr = annualNOI / annualDebt

    const dealScore = gradeDeal(dscr, cashFlow)

    /* =====================
       4️⃣ RETURN EVERYTHING
    ===================== */

    res.json({
      address,
      propertyDetails: property,
      hudRent: rent,
      purchasePrice,
      annualRent,
      annualExpenses,
      annualNOI,
      annualDebt,
      cashFlow,
      capRatePct: Number(capRate.toFixed(2)),
      dscr: Number(dscr.toFixed(2)),
      dealScore
    })

  } catch (err) {
    console.error(err.message)
    res.status(500).json({ error: 'Deal analysis failed' })
  }
})

/* ========================= */

app.listen(PORT, () => {
  console.log(`🚀 ALEX running at http://localhost:${PORT}`)
})