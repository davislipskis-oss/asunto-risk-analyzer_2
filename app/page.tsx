'use client'

import { useMemo, useState } from 'react'

type ConditionLevel = 'ei tiedossa' | 'hyvä' | 'kohtalainen' | 'heikko'
type RemonttiLevel = 'ei tulossa' | 'suunnitteilla 1-3v' | 'todennäköinen 3-5v' | 'ajankohtainen nyt'
type ApartmentType = 'kerrostalo' | 'rivitalo' | 'omakotitalo'
type BathroomRemontti = 'ei' | 'kevyt' | 'täysi'
type KitchenRemontti = 'ei' | 'kevyt' | 'täysi'

type FormData = {
  address: string
  city: string
  apartmentType: ApartmentType
  yearBuilt: number
  areaSqm: number
  roomCount: string
  purchasePrice: number
  housingCompanyLoan: number
  maintenanceFee: number
  currentMonthlyLoanShare: number
  ownCashBudget: number
  loanTermYears: number
  bathroomRemontti: BathroomRemontti
  kitchenRemontti: KitchenRemontti
  flooringRenewal: boolean
  paintingNeeded: boolean
  putki: RemonttiLevel
  facade: RemonttiLevel
  roof: RemonttiLevel
  windows: RemonttiLevel
  hvac: RemonttiLevel
  bathroomCondition: ConditionLevel
  kitchenCondition: ConditionLevel
  generalCondition: ConditionLevel
}

type RiskRow = {
  label: string
  years: string
  estimate: number
  riskPoints: number
  reason: string
}

const initialForm: FormData = {
  address: '',
  city: 'Helsinki',
  apartmentType: 'kerrostalo',
  yearBuilt: 1992,
  areaSqm: 62,
  roomCount: '2h+k',
  purchasePrice: 289000,
  housingCompanyLoan: 12000,
  maintenanceFee: 310,
  currentMonthlyLoanShare: 85,
  ownCashBudget: 18000,
  loanTermYears: 20,
  bathroomRemontti: 'kevyt',
  kitchenRemontti: 'ei',
  flooringRenewal: true,
  paintingNeeded: true,
  putki: 'todennäköinen 3-5v',
  facade: 'ei tulossa',
  roof: 'suunnitteilla 1-3v',
  windows: 'ei tulossa',
  hvac: 'ei tulossa',
  bathroomCondition: 'kohtalainen',
  kitchenCondition: 'hyvä',
  generalCondition: 'kohtalainen'
}

const currency = new Intl.NumberFormat('fi-FI', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
})

const percent = new Intl.NumberFormat('fi-FI', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

const conditionMultipliers: Record<ConditionLevel, number> = {
  'ei tiedossa': 1.1,
  hyvä: 0.8,
  kohtalainen: 1,
  heikko: 1.25
}

const remonttiMap: Record<RemonttiLevel, { points: number; factor: number; years: string }> = {
  'ei tulossa': { points: 0, factor: 0, years: 'Ei tiedossa / ei tulossa' },
  'suunnitteilla 1-3v': { points: 22, factor: 0.7, years: '1–3 vuotta' },
  'todennäköinen 3-5v': { points: 14, factor: 0.45, years: '3–5 vuotta' },
  'ajankohtainen nyt': { points: 35, factor: 1, years: '0–12 kk' }
}

function annualRateToMonthly(rate: number) {
  return rate / 12
}

function monthlyLoanPayment(principal: number, annualRate = 0.045, years = 20) {
  if (principal <= 0) return 0
  const monthlyRate = annualRateToMonthly(annualRate)
  const months = years * 12
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
}

function round(value: number) {
  return Math.round(value)
}

function getSurfaceRemonttiCost(form: FormData) {
  const area = form.areaSqm
  let laborEligible = 0
  let total = 0

  if (form.bathroomRemontti === 'kevyt') {
    total += area * 110
    laborEligible += area * 45
  }
  if (form.bathroomRemontti === 'täysi') {
    total += Math.max(8500, area * 175)
    laborEligible += Math.max(3500, area * 70)
  }

  if (form.kitchenRemontti === 'kevyt') {
    total += Math.max(3800, area * 60)
    laborEligible += Math.max(1400, area * 22)
  }
  if (form.kitchenRemontti === 'täysi') {
    total += Math.max(9800, area * 150)
    laborEligible += Math.max(3200, area * 50)
  }

  if (form.flooringRenewal) {
    total += area * 38
    laborEligible += area * 16
  }

  if (form.paintingNeeded) {
    total += area * 16
    laborEligible += area * 10
  }

  const generalMultiplier = conditionMultipliers[form.generalCondition]
  return {
    total: round(total * generalMultiplier),
    laborEligible: round(laborEligible * generalMultiplier)
  }
}

function getTaloyhtioRiskRows(form: FormData): RiskRow[] {
  const area = form.areaSqm
  const age = new Date().getFullYear() - form.yearBuilt

  const baseRows = [
    {
      key: 'putki' as const,
      label: 'Putkiremontti',
      baseCost: form.apartmentType === 'kerrostalo' ? area * 650 : area * 420,
      ageBoost: age > 40 ? 1.15 : age > 25 ? 1.0 : 0.85,
      reason: 'Vesijohdot, viemärit ja märkätilojen riskit ovat yleensä suurin yksittäinen kuluerä.'
    },
    {
      key: 'facade' as const,
      label: 'Julkisivu / parvekkeet',
      baseCost: form.apartmentType === 'kerrostalo' ? area * 290 : area * 120,
      ageBoost: age > 35 ? 1.1 : 0.9,
      reason: 'Erityisesti vanhemmissa yhtiöissä julkisivu ja parvekkeet voivat siirtää vastikkeita selvästi ylöspäin.'
    },
    {
      key: 'roof' as const,
      label: 'Katto',
      baseCost: form.apartmentType === 'omakotitalo' ? area * 170 : area * 85,
      ageBoost: age > 30 ? 1.1 : 0.9,
      reason: 'Katto on kriittinen rakenne, ja vuotoriski tekee korjauksesta kalliin nopeasti.'
    },
    {
      key: 'windows' as const,
      label: 'Ikkunat ja ovet',
      baseCost: form.apartmentType === 'kerrostalo' ? area * 130 : area * 90,
      ageBoost: age > 30 ? 1.1 : 0.95,
      reason: 'Ikkunoiden uusinta osuu usein samaan sykliin muiden taloteknisten päivitysten kanssa.'
    },
    {
      key: 'hvac' as const,
      label: 'Ilmanvaihto / LVIS-päivitykset',
      baseCost: area * 95,
      ageBoost: age > 30 ? 1.15 : 0.95,
      reason: 'Talotekniikan päivitykset kasaantuvat usein, vaikka yksittäinen erä näyttäisi pieneltä.'
    }
  ]

  return baseRows
    .map((row) => {
      const level = form[row.key]
      const meta = remonttiMap[level]
      const estimate = round(row.baseCost * row.ageBoost * meta.factor)
      return {
        label: row.label,
        years: meta.years,
        estimate,
        riskPoints: meta.points,
        reason: row.reason
      }
    })
    .filter((row) => row.estimate > 0)
    .sort((a, b) => b.estimate - a.estimate)
}

function getRiskSummary(form: FormData) {
  const taloyhtioRows = getTaloyhtioRiskRows(form)
  const surface = getSurfaceRemonttiCost(form)
  const taloyhtioTotal = taloyhtioRows.reduce((sum, row) => sum + row.estimate, 0)

  const conditionPoints =
    (form.bathroomCondition === 'heikko' ? 12 : form.bathroomCondition === 'kohtalainen' ? 7 : form.bathroomCondition === 'ei tiedossa' ? 9 : 3) +
    (form.kitchenCondition === 'heikko' ? 8 : form.kitchenCondition === 'kohtalainen' ? 5 : form.kitchenCondition === 'ei tiedossa' ? 6 : 2) +
    (form.generalCondition === 'heikko' ? 10 : form.generalCondition === 'kohtalainen' ? 6 : form.generalCondition === 'ei tiedossa' ? 7 : 2)

  const agePoints = form.yearBuilt < 1985 ? 18 : form.yearBuilt < 2005 ? 10 : 4
  const leveragePoints = form.housingCompanyLoan > form.purchasePrice * 0.08 ? 8 : form.housingCompanyLoan > 0 ? 4 : 1

  const totalRiskPoints = round(
    taloyhtioRows.reduce((sum, row) => sum + row.riskPoints, 0) + conditionPoints + agePoints + leveragePoints
  )

  const riskLevel = totalRiskPoints >= 75 ? 'Korkea' : totalRiskPoints >= 45 ? 'Keskitaso' : 'Matala'

  const laborDeductionRaw = Math.min(surface.laborEligible * 0.35, 1600)
  const laborDeduction = Math.max(0, laborDeductionRaw - 150)
  const netSurfaceCost = Math.max(0, surface.total - laborDeduction)

  const hiddenCostEstimate = taloyhtioTotal + netSurfaceCost + form.housingCompanyLoan
  const truePurchaseCost = form.purchasePrice + hiddenCostEstimate
  const renovationShareOfPrice = truePurchaseCost > 0 ? hiddenCostEstimate / truePurchaseCost : 0
  const monthlyImpact = monthlyLoanPayment(hiddenCostEstimate - form.ownCashBudget, 0.045, form.loanTermYears)

  const strengths: string[] = []
  const warnings: string[] = []

  if (surface.total < 8000) strengths.push('Oman asunnon pintaremontin tarve näyttää maltilliselta.')
  if (form.housingCompanyLoan < form.purchasePrice * 0.05) strengths.push('Taloyhtiölainaa on suhteessa ostohintaan melko vähän.')
  if (form.yearBuilt >= 2005) strengths.push('Rakennusvuosi viittaa yleensä pienempään lähivuosien peruskorjauspaineeseen.')

  if (taloyhtioRows.some((row) => row.label === 'Putkiremontti' && row.estimate > 0)) {
    warnings.push('Putkiremonttiriski on merkittävä ja voi muuttaa kuukausikustannuksen nopeasti.')
  }
  if (monthlyImpact > 350) warnings.push('Arvioitu lisärahoituksen kuukausivaikutus on jo selvästi tuntuva.')
  if (renovationShareOfPrice > 0.18) warnings.push('Piilokustannusten osuus kokonaiskustannuksesta on korkea.')
  if (form.bathroomCondition === 'ei tiedossa') warnings.push('Kylpyhuoneen kunto ei ole tiedossa, mikä on ostotilanteessa punainen lippu.')

  return {
    taloyhtioRows,
    surface,
    taloyhtioTotal,
    laborDeduction: round(laborDeduction),
    netSurfaceCost,
    hiddenCostEstimate,
    truePurchaseCost,
    monthlyImpact: round(monthlyImpact),
    totalRiskPoints,
    riskLevel,
    renovationShareOfPrice,
    strengths,
    warnings
  }
}

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      {children}
      {help ? <span className="fieldHelp">{help}</span> : null}
    </label>
  )
}

export default function HomePage() {
  const [form, setForm] = useState<FormData>(initialForm)
  const summary = useMemo(() => getRiskSummary(form), [form])

  function setValue<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="pageShell">
      <section className="hero card">
        <div>
          <p className="eyebrow">MVP: Asunnon ostajan remontti- ja riskianalyysi</p>
          <h1>Selvitä paljonko asunto voi oikeasti maksaa remonteineen</h1>
          <p className="lead">
            Tämä versio laskee pintaremontin karkean budjetin, arvioi tulevia taloyhtiöriskejä ja näyttää,
            kuinka iso kuukausivaikutus piilokuluilla voi olla.
          </p>
        </div>
        <div className="heroStats">
          <div>
            <span>Riskitaso</span>
            <strong className={summary.riskLevel === 'Korkea' ? 'danger' : summary.riskLevel === 'Keskitaso' ? 'warning' : 'safe'}>
              {summary.riskLevel}
            </strong>
          </div>
          <div>
            <span>Piilokulut arviolta</span>
            <strong>{currency.format(summary.hiddenCostEstimate)}</strong>
          </div>
          <div>
            <span>Kuukausivaikutus</span>
            <strong>{currency.format(summary.monthlyImpact)} / kk</strong>
          </div>
        </div>
      </section>

      <section className="grid">
        <form className="card formCard">
          <h2>Kohteen tiedot</h2>
          <div className="grid2">
            <Field label="Osoite">
              <input value={form.address} onChange={(e) => setValue('address', e.target.value)} placeholder="Esim. Mannerheimintie 12 A 6" />
            </Field>
            <Field label="Kaupunki">
              <input value={form.city} onChange={(e) => setValue('city', e.target.value)} />
            </Field>
            <Field label="Asuntotyyppi">
              <select value={form.apartmentType} onChange={(e) => setValue('apartmentType', e.target.value as ApartmentType)}>
                <option value="kerrostalo">Kerrostalo</option>
                <option value="rivitalo">Rivitalo</option>
                <option value="omakotitalo">Omakotitalo</option>
              </select>
            </Field>
            <Field label="Rakennusvuosi">
              <input type="number" value={form.yearBuilt} onChange={(e) => setValue('yearBuilt', Number(e.target.value))} />
            </Field>
            <Field label="Pinta-ala m²">
              <input type="number" value={form.areaSqm} onChange={(e) => setValue('areaSqm', Number(e.target.value))} />
            </Field>
            <Field label="Huoneluku">
              <input value={form.roomCount} onChange={(e) => setValue('roomCount', e.target.value)} />
            </Field>
            <Field label="Ostohinta €">
              <input type="number" value={form.purchasePrice} onChange={(e) => setValue('purchasePrice', Number(e.target.value))} />
            </Field>
            <Field label="Taloyhtiölaina €">
              <input type="number" value={form.housingCompanyLoan} onChange={(e) => setValue('housingCompanyLoan', Number(e.target.value))} />
            </Field>
            <Field label="Hoitovastike €/kk">
              <input type="number" value={form.maintenanceFee} onChange={(e) => setValue('maintenanceFee', Number(e.target.value))} />
            </Field>
            <Field label="Nykyinen rahoitusvastike €/kk">
              <input type="number" value={form.currentMonthlyLoanShare} onChange={(e) => setValue('currentMonthlyLoanShare', Number(e.target.value))} />
            </Field>
            <Field label="Oma käytettävä remonttibudjetti €" help="Kuinka paljon voit maksaa ilman lisälainaa.">
              <input type="number" value={form.ownCashBudget} onChange={(e) => setValue('ownCashBudget', Number(e.target.value))} />
            </Field>
            <Field label="Lainan takaisinmaksu (vuotta)">
              <input type="number" min={5} max={30} value={form.loanTermYears} onChange={(e) => setValue('loanTermYears', Number(e.target.value))} />
            </Field>
          </div>

          <h2>Oma remonttitarve</h2>
          <div className="grid2">
            <Field label="Kylpyhuoneen remontti">
              <select value={form.bathroomRemontti} onChange={(e) => setValue('bathroomRemontti', e.target.value as BathroomRemontti)}>
                <option value="ei">Ei</option>
                <option value="kevyt">Kevyt päivitys</option>
                <option value="täysi">Täysi remontti</option>
              </select>
            </Field>
            <Field label="Keittiön remontti">
              <select value={form.kitchenRemontti} onChange={(e) => setValue('kitchenRemontti', e.target.value as KitchenRemontti)}>
                <option value="ei">Ei</option>
                <option value="kevyt">Kevyt päivitys</option>
                <option value="täysi">Täysi remontti</option>
              </select>
            </Field>
            <Field label="Lattioiden uusinta">
              <select value={String(form.flooringRenewal)} onChange={(e) => setValue('flooringRenewal', e.target.value === 'true')}>
                <option value="false">Ei</option>
                <option value="true">Kyllä</option>
              </select>
            </Field>
            <Field label="Maalaus / pintojen siistiminen">
              <select value={String(form.paintingNeeded)} onChange={(e) => setValue('paintingNeeded', e.target.value === 'true')}>
                <option value="false">Ei</option>
                <option value="true">Kyllä</option>
              </select>
            </Field>
          </div>

          <h2>Taloyhtiö- ja kuntoriskit</h2>
          <div className="grid2">
            <Field label="Putket">
              <select value={form.putki} onChange={(e) => setValue('putki', e.target.value as RemonttiLevel)}>
                {Object.keys(remonttiMap).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Julkisivu / parvekkeet">
              <select value={form.facade} onChange={(e) => setValue('facade', e.target.value as RemonttiLevel)}>
                {Object.keys(remonttiMap).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Katto">
              <select value={form.roof} onChange={(e) => setValue('roof', e.target.value as RemonttiLevel)}>
                {Object.keys(remonttiMap).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Ikkunat ja ovet">
              <select value={form.windows} onChange={(e) => setValue('windows', e.target.value as RemonttiLevel)}>
                {Object.keys(remonttiMap).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Ilmanvaihto / LVIS">
              <select value={form.hvac} onChange={(e) => setValue('hvac', e.target.value as RemonttiLevel)}>
                {Object.keys(remonttiMap).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Kylpyhuoneen kunto">
              <select value={form.bathroomCondition} onChange={(e) => setValue('bathroomCondition', e.target.value as ConditionLevel)}>
                {Object.keys(conditionMultipliers).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Keittiön kunto">
              <select value={form.kitchenCondition} onChange={(e) => setValue('kitchenCondition', e.target.value as ConditionLevel)}>
                {Object.keys(conditionMultipliers).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
            <Field label="Yleiskunto">
              <select value={form.generalCondition} onChange={(e) => setValue('generalCondition', e.target.value as ConditionLevel)}>
                {Object.keys(conditionMultipliers).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
          </div>
        </form>

        <div className="resultsColumn">
          <section className="card resultsCard">
            <h2>Yhteenveto</h2>
            <div className="summaryGrid">
              <div>
                <span>Ostohinta</span>
                <strong>{currency.format(form.purchasePrice)}</strong>
              </div>
              <div>
                <span>Taloyhtiölaina</span>
                <strong>{currency.format(form.housingCompanyLoan)}</strong>
              </div>
              <div>
                <span>Oma pintaremontti netto</span>
                <strong>{currency.format(summary.netSurfaceCost)}</strong>
              </div>
              <div>
                <span>Taloyhtiöriskit</span>
                <strong>{currency.format(summary.taloyhtioTotal)}</strong>
              </div>
              <div>
                <span>Kotitalousvähennys</span>
                <strong>{currency.format(summary.laborDeduction)}</strong>
              </div>
              <div>
                <span>Todellinen kokonaiskustannus</span>
                <strong>{currency.format(summary.truePurchaseCost)}</strong>
              </div>
            </div>
            <div className="bigMetric">
              <span>Piilokustannusten osuus kokonaisuudesta</span>
              <strong>{percent.format(summary.renovationShareOfPrice)}</strong>
            </div>
          </section>

          <section className="card resultsCard">
            <h2>Arvioidut isot riskierät</h2>
            <div className="riskList">
              {summary.taloyhtioRows.length === 0 ? (
                <p className="muted">Et ole merkinnyt lähivuosien taloyhtiöriskejä.</p>
              ) : (
                summary.taloyhtioRows.map((row) => (
                  <div key={row.label} className="riskRow">
                    <div>
                      <strong>{row.label}</strong>
                      <p>{row.reason}</p>
                    </div>
                    <div className="riskMeta">
                      <span>{row.years}</span>
                      <strong>{currency.format(row.estimate)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card resultsCard">
            <h2>Ostajan tulkinta</h2>
            <div className="interpretation">
              <div>
                <h3>Vahvuudet</h3>
                {summary.strengths.length ? (
                  <ul>
                    {summary.strengths.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="muted">Selviä vahvuuksia ei noussut esiin nykyisillä syötteillä.</p>
                )}
              </div>
              <div>
                <h3>Varoitukset</h3>
                {summary.warnings.length ? (
                  <ul>
                    {summary.warnings.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="muted">Suuria punaisia lippuja ei noussut esiin nykyisillä syötteillä.</p>
                )}
              </div>
            </div>
            <div className="decisionBox">
              <span>Johtopäätös</span>
              <strong>
                {summary.riskLevel === 'Korkea'
                  ? 'Neuvottele hinnasta aggressiivisesti tai vaadi lisäselvityksiä ennen ostoa.'
                  : summary.riskLevel === 'Keskitaso'
                    ? 'Kohde voi olla hyvä, mutta budjettiin pitää varata selkeä remonttipuskuri.'
                    : 'Kohde näyttää tämän karkean analyysin perusteella hallittavalta, jos tiedot pitävät paikkansa.'}
              </strong>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
