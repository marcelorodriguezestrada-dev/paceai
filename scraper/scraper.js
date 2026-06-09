/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  PaceAI — Scraper de Carreras                           ║
 * ║  Fuente: ar.dondecorrer.com                             ║
 * ║  Destino: Firebase Firestore                            ║
 * ║  Ejecutar: node scraper.js                              ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * INSTALACIÓN:
 *   npm install puppeteer node-fetch@2 dotenv
 *
 * VARIABLES DE ENTORNO (.env):
 *   FB_API_KEY=...
 *   FB_PROJECT_ID=...
 */

require("dotenv").config();
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

// ── CONFIG ──────────────────────────────────────────────────
const CONFIG = {
  url: "https://ar.dondecorrer.com/",
  firebase: {
    apiKey: process.env.FB_API_KEY || "TU_API_KEY",
    projectId: process.env.FB_PROJECT_ID || "TU_PROJECT_ID",
    serviceEmail: process.env.FB_SERVICE_EMAIL || "",   // cuenta admin para escribir
    servicePass: process.env.FB_SERVICE_PASS || "",
  },
  // Cuántas páginas de resultados scrapear (cada página ~20 carreras)
  maxPages: 5,
  // Espera entre requests para no saturar el servidor (ms)
  delay: 1500,
};

// ── FIREBASE REST HELPERS ────────────────────────────────────
const fbLogin = async () => {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.firebase.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: CONFIG.firebase.serviceEmail,
        password: CONFIG.firebase.servicePass,
        returnSecureToken: true,
      }),
    }
  );
  const d = await r.json();
  if (d.error) throw new Error(`Firebase auth error: ${d.error.message}`);
  console.log(`✅ Firebase: sesión iniciada como ${d.email}`);
  return d.idToken;
};

const toFirestore = (obj) => ({
  fields: Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === null || v === undefined) return [k, { nullValue: null }];
      if (typeof v === "boolean") return [k, { booleanValue: v }];
      if (typeof v === "number") return [k, { doubleValue: v }];
      return [k, { stringValue: String(v) }];
    })
  ),
});

const fbSaveRace = async (race, token) => {
  const docId = race.id || slugify(race.name);
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.firebase.projectId}/databases/(default)/documents/races/${docId}`;
  const r = await fetch(`${url}?key=${CONFIG.firebase.apiKey}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(toFirestore(race)),
  });
  const d = await r.json();
  if (d.error) throw new Error(`Firestore write error: ${d.error.message}`);
  return docId;
};

// ── UTILS ────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const slugify = (str) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const parseDate = (str) => {
  // Maneja formatos: "13 jul 2025", "13/07/2025", "julio 13"
  if (!str) return null;
  const months = {
    ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
    jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
    enero:"01", febrero:"02", marzo:"03", abril:"04", mayo:"05", junio:"06",
    julio:"07", agosto:"08", septiembre:"09", octubre:"10", noviembre:"11", diciembre:"12",
  };
  const clean = str.toLowerCase().trim();
  // Formato: "13 jul 2025" o "13 de julio de 2025"
  const match1 = clean.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
  if (match1) {
    const [, day, monthStr, year] = match1;
    const month = months[monthStr.slice(0, 3)];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  // Formato: "13/07/2025"
  const match2 = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match2) {
    const [, day, month, year] = match2;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return str; // devolver original si no parsea
};

const inferDifficulty = (distance) => {
  const km = parseFloat(distance);
  if (isNaN(km)) return "moderado";
  if (km <= 10) return "fácil";
  if (km <= 21) return "moderado";
  return "avanzado";
};

const inferTerrain = (location, name) => {
  const text = `${location} ${name}`.toLowerCase();
  if (text.includes("trail") || text.includes("sierra") || text.includes("montaña") || text.includes("cerro")) return "trail / montaña";
  if (text.includes("parque") || text.includes("rosedal") || text.includes("bosque")) return "parque / tierra compactada";
  return "asfalto urbano";
};

const inferWeather = (dateStr) => {
  if (!dateStr) return "variable";
  const month = parseInt(dateStr.split("-")[1]);
  if ([6, 7, 8].includes(month)) return "invierno";
  if ([9, 10, 11].includes(month)) return "primavera";
  if ([12, 1, 2].includes(month)) return "verano";
  return "otoño";
};

// ── SCRAPER PRINCIPAL ────────────────────────────────────────
async function scrapeRaces() {
  console.log("\n🏃 PaceAI Scraper — iniciando...\n");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();

  // Imitar navegador real para evitar bloqueos
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  const allRaces = [];

  try {
    console.log(`📡 Navegando a ${CONFIG.url}...`);
    await page.goto(CONFIG.url, { waitUntil: "networkidle2", timeout: 30000 });
    console.log("✅ Página cargada");

    // Esperar a que cargue el contenido dinámico
    await sleep(2000);

    // Screenshot para debugging (opcional)
    // await page.screenshot({ path: "debug.png" });

    // ── ESTRATEGIA 1: Selectores específicos de dondecorrer.com ──
    // Intentar múltiples selectores posibles según la estructura del sitio
    const possibleSelectors = [
      ".event-card",
      ".race-card",
      ".event-item",
      "[class*='event']",
      "[class*='race']",
      "[class*='carrera']",
      "article",
      ".card",
    ];

    let workingSelector = null;
    for (const sel of possibleSelectors) {
      const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
      if (count > 0) {
        console.log(`✅ Selector encontrado: "${sel}" (${count} elementos)`);
        workingSelector = sel;
        break;
      }
    }

    if (!workingSelector) {
      // ── ESTRATEGIA 2: Interceptar llamadas a la API ──
      console.log("⚠️  No se encontraron selectores directos. Intentando interceptar API...");
      const races = await interceptAPIRequests(page, CONFIG.url);
      if (races.length > 0) {
        allRaces.push(...races);
      } else {
        // ── ESTRATEGIA 3: Extraer todo el texto estructurado ──
        console.log("⚠️  Extrayendo datos estructurados del DOM...");
        const extracted = await extractFromDOM(page);
        allRaces.push(...extracted);
      }
    } else {
      // Scrapear con el selector que funcionó
      const races = await extractWithSelector(page, workingSelector);
      allRaces.push(...races);

      // Scrapear páginas adicionales si hay paginación
      for (let p = 2; p <= CONFIG.maxPages; p++) {
        const nextBtn = await page.$('[aria-label="Next"]') || await page.$(".next") || await page.$("[class*='next']");
        if (!nextBtn) break;
        await nextBtn.click();
        await sleep(CONFIG.delay);
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
        const moreRaces = await extractWithSelector(page, workingSelector);
        if (moreRaces.length === 0) break;
        allRaces.push(...moreRaces);
        console.log(`  📄 Página ${p}: +${moreRaces.length} carreras`);
      }
    }

  } catch (err) {
    console.error("❌ Error durante el scraping:", err.message);
  } finally {
    await browser.close();
  }

  return allRaces;
}

// ── EXTRACCIÓN CON SELECTOR ──────────────────────────────────
async function extractWithSelector(page, selector) {
  return page.$$eval(selector, (elements) => {
    return elements.map((el) => {
      const getText = (s) => el.querySelector(s)?.textContent?.trim() || "";
      const getAttr = (s, a) => el.querySelector(s)?.[a] || "";

      // Intentar múltiples nombres de campo posibles
      const name =
        getText("h2") || getText("h3") || getText(".title") ||
        getText("[class*='title']") || getText("[class*='name']") ||
        getText("strong") || "Sin nombre";

      const dateRaw =
        getText("[class*='date']") || getText("time") ||
        getText("[class*='fecha']") || getAttr("time", "dateTime") || "";

      const distance =
        getText("[class*='distance']") || getText("[class*='distancia']") ||
        getText("[class*='km']") || "";

      const location =
        getText("[class*='location']") || getText("[class*='lugar']") ||
        getText("[class*='address']") || getText("[class*='ciudad']") || "";

      const imgSrc = getAttr("img", "src") || "";
      const link = getAttr("a", "href") || "";

      return { name, dateRaw, distance, location, imgSrc, link };
    });
  });
}

// ── INTERCEPCIÓN DE API ──────────────────────────────────────
async function interceptAPIRequests(page, url) {
  const capturedRaces = [];

  page.on("response", async (response) => {
    const resUrl = response.url();
    const contentType = response.headers()["content-type"] || "";
    if (contentType.includes("application/json") && (resUrl.includes("event") || resUrl.includes("race") || resUrl.includes("carrera"))) {
      try {
        const json = await response.json();
        const items = json.data || json.events || json.races || json.results || (Array.isArray(json) ? json : []);
        if (items.length > 0) {
          console.log(`  📡 API capturada: ${resUrl} (${items.length} items)`);
          capturedRaces.push(...items);
        }
      } catch {}
    }
  });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(3000);
  return capturedRaces;
}

// ── EXTRACCIÓN GENÉRICA DEL DOM ──────────────────────────────
async function extractFromDOM(page) {
  return page.evaluate(() => {
    const results = [];
    // Buscar cualquier elemento que parezca una tarjeta de evento
    const candidates = document.querySelectorAll("a[href*='carrera'], a[href*='event'], a[href*='race'], a[href*='run']");
    candidates.forEach((el) => {
      const text = el.textContent.trim();
      if (text.length > 10 && text.length < 200) {
        results.push({ name: text.split("\n")[0].trim(), link: el.href, dateRaw: "", distance: "", location: "" });
      }
    });
    return results;
  });
}

// ── NORMALIZAR DATOS ─────────────────────────────────────────
function normalizeRace(raw, index) {
  const name = raw.name || raw.title || raw.nombre || "Carrera sin nombre";
  const dateRaw = raw.dateRaw || raw.date || raw.fecha || "";
  const dateISO = parseDate(dateRaw);
  const distanceRaw = raw.distance || raw.distancia || raw.km || "";
  const distanceClean = distanceRaw.match(/\d+[\.,]?\d*/)?.[0]
    ? `${distanceRaw.match(/\d+[\.,]?\d*/)[0]}K`
    : distanceRaw || "N/D";
  const location = raw.location || raw.lugar || raw.ciudad || raw.address || "Buenos Aires";

  return {
    id: slugify(name) + `-${index}`,
    name: name.trim(),
    date: dateISO || dateRaw,
    dateRaw,
    distance: distanceClean,
    distanceRaw,
    location: location.trim(),
    terrain: inferTerrain(location, name),
    weather: inferWeather(dateISO),
    difficulty: inferDifficulty(distanceClean),
    link: raw.link || raw.url || "",
    imgSrc: raw.imgSrc || raw.image || "",
    scraped_at: new Date().toISOString(),
    source: "dondecorrer.com",
  };
}

// ── GUARDAR EN FIREBASE ──────────────────────────────────────
async function saveToFirebase(races) {
  if (!CONFIG.firebase.serviceEmail || !CONFIG.firebase.servicePass) {
    console.log("\n⚠️  Sin credenciales Firebase. Guardando en races_scraped.json en su lugar...");
    const fs = require("fs");
    fs.writeFileSync("races_scraped.json", JSON.stringify(races, null, 2));
    console.log(`✅ ${races.length} carreras guardadas en races_scraped.json`);
    return;
  }

  console.log("\n🔥 Guardando en Firebase Firestore...");
  const token = await fbLogin();
  let saved = 0;
  let errors = 0;

  for (const race of races) {
    try {
      const docId = await fbSaveRace(race, token);
      console.log(`  ✅ ${race.name} → races/${docId}`);
      saved++;
      await sleep(200); // rate limiting
    } catch (err) {
      console.error(`  ❌ Error guardando "${race.name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Resultado: ${saved} guardadas, ${errors} errores`);
}

// ── MAIN ─────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Scrapear
    const rawRaces = await scrapeRaces();
    console.log(`\n📦 Total crudo: ${rawRaces.length} elementos encontrados`);

    if (rawRaces.length === 0) {
      console.log("\n⚠️  No se encontraron carreras. Posibles causas:");
      console.log("   • El sitio cambió su estructura HTML");
      console.log("   • Requiere JavaScript adicional para cargar");
      console.log("   • Bloqueo por bot detection");
      console.log("\n💡 Sugerencia: revisá debug.png (descomentá la línea de screenshot)");
      console.log("   o ejecutá manualmente en modo headless:false para ver qué pasa");
      process.exit(1);
    }

    // 2. Normalizar
    const normalized = rawRaces
      .map((r, i) => normalizeRace(r, i))
      .filter((r) => r.name !== "Carrera sin nombre" && r.name.length > 3);

    // Deduplicar por nombre + fecha
    const seen = new Set();
    const unique = normalized.filter((r) => {
      const key = `${r.name}-${r.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`✅ Normalizadas y deduplicadas: ${unique.length} carreras`);

    // 3. Mostrar preview
    console.log("\n📋 Preview (primeras 5):");
    unique.slice(0, 5).forEach((r) => {
      console.log(`  • ${r.name} | ${r.date} | ${r.distance} | ${r.location}`);
    });

    // 4. Guardar
    await saveToFirebase(unique);

    console.log("\n🏁 Scraping completado exitosamente!\n");

  } catch (err) {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  }
})();
