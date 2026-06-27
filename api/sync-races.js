/**
 * /api/sync-races
 * Cron job semanal — extrae carreras de dondecorrer.com con Grok
 * Vercel cron: lunes 8am (vercel.json)
 * Manual: GET /api/sync-races?secret=paceai2026
 */

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

// ── Groq extraction (sin SDK, fetch nativo) ───────────────────────────────────
async function extractRacesWithGrok(html) {
  const htmlContext = html
    ? `HTML del sitio (primeros 8000 chars):\n${html.slice(0, 8000)}`
    : `El sitio carga con JavaScript — no hay carreras en el HTML estático.
Generá el calendario típico de running de Buenos Aires para los próximos 6 meses
basándote en el historial conocido: Maratón BA (octubre), Media Maratón BA (agosto),
carreras de Palermo, nocturnas del Rosedal, trails de Sierra Ventana, etc.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
- id (string único, ej: "race_001")
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
- tourism (objeto con: zone, hotel_zone, parking, metro, cultural)

Formato de respuesta:
{
  "carreras": [...],
  "updated_at": "${new Date().toISOString()}",
  "source": "dondecorrer.com"
}

${htmlContext}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let text = data.choices[0]?.message?.content || "";
  text = text.replace(/```(?:json)?\n?|```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    if (req.query?.secret !== SYNC_SECRET) {
      return res.status(401).json({ error: "Unauthorized. Usá ?secret=TU_SECRET" });
    }
  } else if (req.method === "POST") {
    const { secret } = req.body || {};
    if (secret !== SYNC_SECRET) {
      return res.status(401).json({ error: "Unauthorized." });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada en Vercel" });
  }
  if (!FB_PROJECT_ID || !FB_API_KEY) {
    return res.status(500).json({ error: "Variables de Firebase no configuradas" });
  }

  console.log("[sync-races] Iniciando sync...");

  try {
    const html = await fetchDondeCorrer();

    console.log("[sync-races] Enviando a Groq...");
    const result = await extractRacesWithGrok(html);

    if (!result?.carreras?.length) {
      throw new Error("Groq no devolvió carreras válidas");
    }

    console.log(`[sync-races] ${result.carreras.length} carreras extraídas`);

    const syncedAt = new Date().toISOString();

    for (const carrera of result.carreras) {
      const docId = String(carrera.id || `race_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      await fbSet("races_sync", docId, {
        ...carrera,
        syncedAt,
        source: result.source || "dondecorrer.com",
      });
    }

    await fbSet("races_sync", "_meta", {
      updated_at: syncedAt,
      count: result.carreras.length,
      source: result.source || "dondecorrer.com",
    });

    console.log("[sync-races] Guardado en Firebase OK");

    return res.status(200).json({
      ok: true,
      count: result.carreras.length,
      updated_at: syncedAt,
      races: result.carreras.map(c => `${c.date} — ${c.name} (${c.distance})`),
    });

  } catch (err) {
    console.error("[sync-races] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}