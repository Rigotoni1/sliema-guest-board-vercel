// Vercel cron job (see vercel.json): every morning, text the staff which
// checkouts happen today so they know the apartment needs cleaning — and flag
// same-day turnovers where the next guest arrives within hours.
//
// Env vars: CRON_SECRET (Vercel automatically sends it as a Bearer token when
// set on the project), plus HOSPITABLE_TOKEN and the Twilio vars in lib/notify.js.
// Sends nothing on days with no checkout.

import { hospitable, dayKey, fmtDay, fmtTime, guestName, statusOf, smsStaff } from "../lib/notify.js";

const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const props = (await hospitable("/properties")).data || [];
    const now = new Date();
    const propQ = props.map((p) => `properties[]=${encodeURIComponent(p.id)}`).join("&");
    const j = await hospitable(
      `/reservations?${propQ}&start_date=${isoDate(addDays(now, -30))}&end_date=${isoDate(addDays(now, 30))}&include=guest&per_page=100`
    );
    const live = (j.data || []).filter((r) => statusOf(r) === "accepted");

    const today = dayKey(now);
    const checkouts = live
      .filter((r) => dayKey(new Date(r.check_out)) === today)
      .sort((a, b) => new Date(a.check_out) - new Date(b.check_out));
    if (!checkouts.length) return res.status(200).json({ ok: true, checkouts: 0 });

    const arrivals = live.filter((r) => dayKey(new Date(r.check_in)) === today);
    const nextArrival = live
      .filter((r) => dayKey(new Date(r.check_in)) > today)
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in))[0];

    const lines = checkouts.map(
      (r) => `${guestName(r)} checks out by ${fmtTime(r.check_out)} — apartment needs cleaning.`
    );
    if (arrivals.length) {
      for (const a of arrivals) {
        lines.push(`SAME-DAY TURNOVER: ${guestName(a)} arrives today at ${fmtTime(a.check_in)}.`);
      }
    } else if (nextArrival) {
      lines.push(`Next arrival: ${guestName(nextArrival)} on ${fmtDay(nextArrival.check_in)}.`);
    } else {
      lines.push("No upcoming arrival booked yet.");
    }

    const sent = await smsStaff(`Sliema flat, today ${fmtDay(now.toISOString())}:\n` + lines.join("\n"));
    return res.status(200).json({ ok: true, checkouts: checkouts.length, sent });
  } catch (e) {
    console.error("cron failed:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
