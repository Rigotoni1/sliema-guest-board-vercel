# Sliema Guest Board

A one-page dashboard for the property management team of the Quiet Sliema 2BR Airbnb.
It shows who is arriving, in house and leaving, with check-in/out times, party size,
booking code, notes and guest contact details, pulled live from Hospitable.

- `index.html` — the board (static).
- `api/data.js` — Vercel serverless function that calls the Hospitable public API with a
  token kept in the Vercel environment, so the token never reaches the browser.

## Deploy on Vercel

1. Import this repository in Vercel (Add New → Project → pick the repo). Framework preset: **Other**. No build command.
2. Add environment variables:
   - `HOSPITABLE_TOKEN` — a Hospitable personal access token (read scope is enough).
   - `BOARD_PASSWORD` — optional. If set, the team enters it once per browser.
3. Deploy. The board is at the project URL; the data endpoint is `/api/data`.

## Local check

`npx vercel dev` with a `.env` containing `HOSPITABLE_TOKEN=...`.
