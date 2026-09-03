// Vercel serverless function: receives Hospitable v2 webhooks and texts the staff.
//
// Set up in Hospitable: Apps → Webhooks → +Add new, destination URL
//   https://<your-project>.vercel.app/api/hospitable-webhook?key=<WEBHOOK_SECRET>
// with the "Reservations" webhook type selected.
//
// Env vars: WEBHOOK_SECRET (any long random string, must match the ?key= above),
// plus the Twilio vars documented in lib/notify.js.
//
// Hospitable retries up to 5 times unless we answer 200, so we return 200 for
// events we deliberately ignore and 500 only when the SMS send itself failed.

import { fmtDay, fmtTime, guestName, statusOf, smsStaff } from "../lib/notify.js";

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function describe(r) {
  const bits = [`${fmtDay(r.check_in)} → ${fmtDay(r.check_out)}`];
  if (r.nights) bits.push(plural(r.nights, "night"));
  if (r.guests?.total) bits.push(plural(r.guests.total, "guest"));
  bits.push(r.platform === "airbnb" ? "Airbnb" : r.platform || "direct");
  return bits.join(", ");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || req.query.key !== secret) {
    return res.status(401).json({ error: "bad key" });
  }

  const body = req.body || {};
  const action = body.action || body.event || body.type || "";
  const r = body.data || body.reservation || {};
  if (!r.check_in || !r.check_out) {
    console.log("webhook ignored, unrecognised payload:", JSON.stringify(body).slice(0, 2000));
    return res.status(200).json({ ok: true, ignored: true });
  }

  const name = guestName(r);
  const status = statusOf(r);
  let msg;
  if (/created/i.test(action)) {
    msg = status === "request"
      ? `Sliema flat — booking REQUEST from ${name}: ${describe(r)}. Awaiting acceptance.`
      : `Sliema flat — NEW booking: ${name}, ${describe(r)}.`;
  } else if (status === "cancelled" || /cancel/i.test(action)) {
    msg = `Sliema flat — CANCELLED: ${name}, ${fmtDay(r.check_in)} → ${fmtDay(r.check_out)}. Those dates are free again.`;
  } else if (status === "not accepted") {
    msg = `Sliema flat — request from ${name} was declined (${fmtDay(r.check_in)} → ${fmtDay(r.check_out)}).`;
  } else {
    msg = `Sliema flat — booking UPDATED: ${name}, ${describe(r)}. Now: check-in ${fmtDay(r.check_in)} ${fmtTime(r.check_in)}, check-out ${fmtDay(r.check_out)} ${fmtTime(r.check_out)}, status ${status || "unknown"}.`;
  }

  try {
    const sent = await smsStaff(msg);
    return res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error("sms failed:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
