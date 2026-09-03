# Sliema Guest Board

A one-page dashboard for the property management team of the Quiet Sliema 2BR Airbnb.
It shows who is arriving, in house and leaving, with check-in/out times, party size,
booking code, notes and guest contact details, pulled live from Hospitable.

- `index.html` — the board (static).
- `api/data.js` — Vercel serverless function that calls the Hospitable public API with a
  token kept in the Vercel environment, so the token never reaches the browser.
- `api/hospitable-webhook.js` — receives Hospitable webhooks and texts the staff about
  new bookings, changes and cancellations (Twilio SMS).
- `api/cron-checkouts.js` — morning cron that texts the staff which checkouts happen
  today (cleaning needed), flagging same-day turnovers.
- `lib/notify.js` — shared SMS/Hospitable helpers for the two functions above.

## Deploy on Vercel

1. Import this repository in Vercel (Add New → Project → pick the repo). Framework preset: **Other**. No build command.
2. Add environment variables:
   - `HOSPITABLE_TOKEN` — a Hospitable personal access token (read scope is enough).
   - `BOARD_PASSWORD` — optional. If set, the team enters it once per browser.
3. Deploy. The board is at the project URL; the data endpoint is `/api/data`.

## Staff SMS notifications

Both features are off until their env vars are set — the board itself works without them.

1. In Vercel → Project → Settings → Environment Variables, add:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — from the Twilio console.
   - `TWILIO_FROM` — the Twilio SMS-capable number, E.164 (e.g. `+1...`).
   - `STAFF_PHONES` — comma-separated staff numbers, E.164 (e.g. `+35679xxxxxx,+35679yyyyyy`).
   - `WEBHOOK_SECRET` — any long random string.
   - `CRON_SECRET` — any long random string (Vercel sends it with cron requests automatically).
   Redeploy after adding them.
2. Instant alerts — in Hospitable go to **Apps → Webhooks → +Add new**, type
   **Reservations**, destination URL:
   `https://<project>.vercel.app/api/hospitable-webhook?key=<WEBHOOK_SECRET>`
   Staff get a text on every new booking, change or cancellation.
3. Checkout reminders — `vercel.json` schedules `/api/cron-checkouts` daily at 05:30 UTC
   (06:30/07:30 in Malta depending on DST). On days with a checkout, staff get a text
   listing who leaves and whether it is a same-day turnover. Days without a checkout
   send nothing.

## Local check

`npx vercel dev` with a `.env` containing `HOSPITABLE_TOKEN=...`.
