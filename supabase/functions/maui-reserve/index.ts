// maui-reserve v3: table reservations Thu-Sat only, day-aware experiences,
// party of 10 max. Free event RSVPs still ride through with an event slug.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// experiences by weekday (0=Sun..6=Sat), UTC-safe on a plain date string
const EXPERIENCES: Record<number, string[]> = {
  4: ["Ladies Night & $10 Happy Hour Menu"],
  5: ["Luau Dinner Party"],
  6: ["Luau Brunch (11 AM - 5 PM)", "Summer Luau Day Party - Live DJ (5 PM - 10 PM)"],
};
// one-off open days outside the Thu-Sat rule
const SPECIAL: Record<string, string[]> = {
  "2026-07-19": ["World Cup Final Watch Party"],
};

function weekday(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }

  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const phone = String(b.phone ?? "").trim().slice(0, 40);
  const date = String(b.date ?? "");
  const time = String(b.time ?? "").slice(0, 30);
  const party = Math.min(Math.max(parseInt(String(b.party ?? "2"), 10) || 2, 1), 10);
  const event = String(b.event ?? "").trim().slice(0, 60);
  const experience = String(b.experience ?? "").trim().slice(0, 80);
  const occasion = String(b.occasion ?? "").trim().slice(0, 40);

  if (!name || !/.+@.+\..+/.test(email)) return json(400, { error: "name and a valid email are required" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2026-07-01" || date > "2026-09-30") {
    return json(400, { error: "pick a date between July 1 and September 30, 2026" });
  }
  if (!time) return json(400, { error: "pick a time" });

  const status = event ? `rsvp:${event.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}` : "confirmed";

  // table reservations: Thu-Sat only, experience must match the day
  if (!event) {
    const allowed = SPECIAL[date] ?? EXPERIENCES[weekday(date)];
    if (!allowed) return json(400, { error: "reservations run Thursday to Saturday" });
    if (!allowed.includes(experience)) return json(400, { error: "pick the experience for that day" });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supa.from("maui_bookings").insert({
    booking_date: date, booking_time: time, party_size: party,
    name, email, phone: phone || null, status,
    experience: experience || null, occasion: occasion || null,
  }).select("id").single();
  if (error) { console.error(error.message); return json(500, { error: "could not save reservation" }); }
  return json(200, { ok: true, id: data.id });
});
