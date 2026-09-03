// Shared helpers for the staff SMS notifications (Twilio) and Hospitable lookups.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   TWILIO_ACCOUNT_SID  required — from the Twilio console
//   TWILIO_AUTH_TOKEN   required — from the Twilio console
//   TWILIO_FROM         required — the Twilio SMS-capable number, E.164 (e.g. +15005550006)
//   STAFF_PHONES        required — comma-separated staff numbers, E.164 (e.g. +35679xxxxxx,+35679yyyyyy)

const TZ = "Europe/Malta";

export const dayKey = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const fmtDay = (iso) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export const fmtTime = (iso) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

export const guestName = (r) =>
  [r?.guest?.first_name, r?.guest?.last_name].filter(Boolean).join(" ").trim() || "Guest";

export const statusOf = (r) => r?.reservation_status?.current?.category || r?.status || "";

export async function hospitable(path) {
  const token = process.env.HOSPITABLE_TOKEN;
  if (!token) throw new Error("HOSPITABLE_TOKEN is not set");
  const res = await fetch("https://public.api.hospitable.com/v2" + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Hospitable returned ${res.status}`);
  return res.json();
}

// Sends one SMS to every number in STAFF_PHONES. Throws if any send fails so the
// caller can return a non-200 and get a retry.
export async function smsStaff(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const staff = (process.env.STAFF_PHONES || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!sid || !tok || !from) throw new Error("Twilio env vars are not set");
  if (!staff.length) throw new Error("STAFF_PHONES is not set");

  const auth = "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64");
  const results = await Promise.allSettled(
    staff.map((to) =>
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Twilio ${r.status} for ${to}: ${(await r.text()).slice(0, 200)}`);
        return to;
      })
    )
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) throw new Error(failed.map((f) => f.reason.message).join("; "));
  return staff.length;
}
