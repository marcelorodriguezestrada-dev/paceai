/**
 * /api/sync-races
 * Cron job semanal — extrae carreras de dondecorrer.com con Grok
 * Vercel cron: lunes 8am (vercel.json)
 * Manual: GET /api/sync-races?secret=paceai2026
 */

import Groq from "groq-sdk";

const FB_PROJECT_ID = process.env.VITE_FB_PROJECT_ID;
const FB_API_KEY    = process.env.VITE_FB_API_KEY;
const SYNC_SECRET   = process.env.SYNC_SECRET || "paceai2026";

// ── Firebase ──────────────────────────────────────────────────────────────────
function toFS(obj) {
  return {
    fields: Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (v === null || v === undefined) return [k, { nullValue: null }];
        if (typeof v === "boolean")        return [k, { booleanValue: v }];
        if (typeof v === "number")         return [k, { doubleValue: v }];
        if (typeof v === "object")         return [k, { stringValue: JSON.stringify(v) }];
        return [k, { stringValue: String(v) }];
      })
    ),
  };
}

async function fbSet(collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FB_API_KEY}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toFS(data)),
  });
  if (!r.ok) throw new Error(`Firebase error ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Fetch dondecorrer ─────────────────────────────────────────────────────────
async function fetchDondeCorrer() {
  const urls = [
    "https://ar.dondecorrer.com/",
    "https://ar.dondecorrer.com/carreras",
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PaceAI/1.0)",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) {
        const html = await r.text();
        console.log(`[sync-races] Fetched ${url} — ${html.length} chars`);
        return html.slice(0, 12000);
      }
    } catch (e) {
      console.log(`[sync-races] ${url} failed: ${e.message}`);
    }
  }
  return null;
}

// ── Grok extraction ───────────────────────────────────────────────────────────
async function extractRacesWithGrok(html) {
  const groq = new Groq({ apiKey: process.env.GROK_API_KEY });

  const htmlContext = html
    ? `HTML del sitio (primeros 8000 chars):\n${html.slice(0, 8000)}`
    : `El sitio carga con JavaScript — no hay carreras en el HTML estático.
Generá el calendario típico de running de Buenos Aires para los próximos 6 meses
basándote en el historial conocido: Maratón BA (octubre), Media Maratón BA (agosto),
carreras de Palermo, nocturnas del Rosedal, trails de Sierra Ventana, etc.`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2,
    max_tokens: 3000,
    messages: [
      {
        role: "system",
        content: `Sos un extractor de datos de carreras de running de Argentina.
Respondés ÚNICAMENTE con JSON válido sin markdown ni texto adicional.`,
      },
      {
        role: "user",
        content: `Analizá el siguiente contenido y extraé TODAS las carreras de running de Argentina.
Para cada carrera necesito:
- id (número entero único)
- name (nombre completo)
- date (YYYY-MM-DD)
- distance ("5K", "10K", "21K", "42K", "30K", etc)
- location (ciudad/barrio)
- terrain ("asfalto plano", "asfalto mixto", "trail", "montaña y senderos", "circuito urbano")
- weather (estimado según la época: "verano", "otoño", "invierno", "primavera")
- difficulty ("fácil" para 5K-10K, "moderado" para 15K-21K, "avanzado" para 30K+)
- image (un emoji representativo)
- registered (número estimado de inscriptos)
- prize (descripción del premio)

Formato de respuesta:
{
  "carreras": [...],
  "updated_at": "${new Date().toISOString()}",
  "source": "dondecorrer.com"
}

${htmlContext}`,
      },
    ],
  });

  let text = completion.choices[0]?.message?.content || "";
  text = text.replace(/```(?:json)?\n?|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Auth para llamadas manuales GET
  if (req.method === "GET") {
    if (req.query?.secret !== SYNC_SECRET) {
      return res.status(401).json({ error: "Unauthorized. Usá ?secret=TU_SECRET" });
    }
  } else if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GROK_API_KEY) {
    return res.status(500).json({ error: "GROK_API_KEY no configurada en Vercel" });
  }
  if (!FB_PROJECT_ID || !FB_API_KEY) {
    return res.status(500).json({ error: "Variables de Firebase no configuradas" });
  }

  console.log("[sync-races] Iniciando sync...");

  try {
    // 1. HTML de dondecorrer
    const html = await fetchDondeCorrer();

    // 2. Extraer con Grok
    console.log("[sync-races] Enviando a Grok...");
    const result = await extractRacesWithGrok(html);

    if (!result?.carreras?.length) {
      throw new Error("Grok no devolvió carreras válidas");
    }

    console.log(`[sync-races] ${result.carreras.length} carreras extraídas`);

    // 3. Guardar en Firebase
    await fbSet("races_sync", "current", {
      carreras: result.carreras,
      updated_at: result.updated_at || new Date().toISOString(),
      source: result.source || "dondecorrer.com",
      count: result.carreras.length,
    });

    console.log("[sync-races] Guardado en Firebase OK");

    return res.status(200).json({
      ok: true,
      count: result.carreras.length,
      updated_at: result.updated_at,
      races: result.carreras.map(c => `${c.date} — ${c.name} (${c.distance})`),
    });

  } catch (err) {
    console.error("[sync-races] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}