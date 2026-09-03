// Vercel serverless function: proxies Hospitable so the API token never reaches the browser.
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   HOSPITABLE_TOKEN   required — a Hospitable personal access token (read scope is enough)
//   BOARD_PASSWORD     optional — if set, viewers must enter this password once

const API = "https://public.api.hospitable.com/v2";
const DAYS_BACK = 60;
const DAYS_AHEAD = 240;

const isoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

async function hospitable(path, token) {
  const res = await fetch(API + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const err = new Error(`Hospitable returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const password = process.env.BOARD_PASSWORD;
  if (password && req.headers["x-board-password"] !== password) {
    return res.status(401).json({ error: "password required" });
  }

  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "HOSPITABLE_TOKEN is not set on the server" });
  }

  try {
    const props = (await hospitable("/properties", token)).data || [];
    const now = new Date();
    const start = isoDate(addDays(now, -DAYS_BACK));
    const end = isoDate(addDays(now, DAYS_AHEAD));
    const propQ = props.map((p) => `properties[]=${encodeURIComponent(p.id)}`).join("&");

    let page = 1, last = 1, all = [];
    do {
      const j = await hospitable(
        `/reservations?${propQ}&start_date=${start}&end_date=${end}&include=guest&per_page=100&page=${page}`,
        token
      );
      all = all.concat(j.data || []);
      last = j.meta?.last_page || 1;
      page++;
    } while (page <= last && page < 20);

    const p = props[0] || null;
    const property = p && {
      id: p.id, name: p.name, address: p.address, checkin: p.checkin, checkout: p.checkout, timezone: p.timezone,
    };
    // Send only what the board shows — no financials.
    const reservations = all.map((r) => ({
      id: r.id, code: r.code, platform: r.platform, platform_id: r.platform_id, status: r.status,
      reservation_status: { current: r.reservation_status?.current },
      check_in: r.check_in, check_out: r.check_out, booking_date: r.booking_date, nights: r.nights,
      notes: r.notes, conversation_language: r.conversation_language, guests: r.guests, guest: r.guest,
    }));

    return res.status(200).json({ property, reservations });
  } catch (e) {
    return res.status(502).json({
      error: e.status === 401 || e.status === 403
        ? "Hospitable rejected the token — it may have been revoked"
        : e.message,
    });
  }
}
