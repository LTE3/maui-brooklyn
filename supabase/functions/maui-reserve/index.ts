// maui-reserve: free table reservations for the Maui x Swan Marina pop-up.
// Deliberately isolated from the La Casita platform functions in this
// project: its own slug, its own table, no shared code.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { error: "bad json" }); }

  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const phone = String(b.phone ?? "").trim().slice(0, 40);
  const date = String(b.date ?? "");
  const time = String(b.time ?? "").slice(0, 20);
  const party = Math.min(Math.max(parseInt(String(b.party ?? "2"), 10) || 2, 1), 20);

  if (!name || !/.+@.+\..+/.test(email)) return json(400, { error: "name and a valid email are required" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2026-07-01" || date > "2026-09-30") {
    return json(400, { error: "pick a date between July 1 and September 30, 2026" });
  }
  if (!time) return json(400, { error: "pick a time" });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supa.from("maui_bookings").insert({
    booking_date: date, booking_time: time, party_size: party,
    name, email, phone: phone || null,
  }).select("id").single();
  if (error) { console.error(error.message); return json(500, { error: "could not save reservation" }); }
  return json(200, { ok: true, id: data.id });
});
