# Safe to Spend / Sa mund të shpenzoj

A free, browser-only calculator that tells a small business owner how much cash
they can safely use after the obligations coming at them in the next 15, 30, 60
or 90 days.

Bilingual (Albanian / English), ALL and EUR.

## Why it exists

Small businesses know their bank balance and know their bills, but rarely hold
both in view at once. This answers one question: **after everything I owe in
this period, and the buffer I want to keep, what is actually free?**

## Privacy model — the core design constraint

Everything is calculated in the browser. There is no account, no backend, no
database and no analytics on the figures. Nothing the user types is transmitted
anywhere. This is deliberate: the tool is aimed at owners who will not upload
their real numbers to a stranger's server, and the privacy promise is the
product's main trust asset. **Do not add server-side processing of user figures
without rethinking the entire positioning.**

## How the calculation works

```
available    = cash + bank + (expected collections × reliability %)
obligations  = payroll + taxes + loans + rent + suppliers + other
safe         = available − obligations − safety reserve
```

**Period scaling.** Every line is tagged Monthly, Quarterly or One-off.
Monthly figures scale by `days / 30`, quarterly by `days / 90`, one-off amounts
count in full. So a 15-day view halves monthly figures and a 90-day view triples
them.

**Known limitation.** Linear scaling assumes smooth payments. Payroll, rent and
loan instalments land on fixed dates. On the 15-day view a payment due inside
the window is understated by half — the UI warns about this and tells the user
to switch that line to One-off. The durable fix is asking for payment dates,
at the cost of more input friction.

**Reliability slider.** 0–100% in 5% steps, default 75%. Discounts expected
collections. A café collects fast; a distributor waits. The owner sets it.

**Safety reserve.** The suggestion is 15 days of recurring running costs,
computed on a monthly-equivalent base (quarterly items contribute a third).
It is fixed regardless of the period selected, because a buffer is a buffer.

## Run it locally

```bash
npm install
npm run dev
```

## Before going live

- [ ] Set `PREFILL_DEMO = false` in `src/SafeToSpend.jsx` — real visitors must land on empty fields
- [ ] Persist `lang`, `currency` and `reliability` to `localStorage`; never persist the financial figures
- [ ] Update the privacy copy to mention that preferences are remembered on the device
- [ ] Add a privacy policy and terms page
- [ ] Have the Albanian copy read by a native speaker
- [ ] Add privacy-respecting analytics (Plausible) — page and completion events only, never the values

## Stack

Vite + React + Tailwind. No backend by design.
