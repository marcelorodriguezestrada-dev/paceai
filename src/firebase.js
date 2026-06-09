/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  PaceAI — Firebase Config & REST Helpers                ║
 * ║                                                          ║
 * ║  1. Copiá tus credenciales de Firebase Console           ║
 * ║  2. O usá variables de entorno (recomendado)             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────
// Opción A: hardcodeado (solo para desarrollo local)
// Opción B: variables de entorno .env.local (recomendado para producción)
export const FB = {
  apiKey:    import.meta.env.VITE_FB_API_KEY    || "TU_API_KEY",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "TU_PROJECT_ID",
  bucket:    import.meta.env.VITE_FB_BUCKET     || "TU_PROJECT_ID.appspot.com",
}

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`
const FS_URL   = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`
const ST_URL   = `https://firebasestorage.googleapis.com/v0/b/${FB.bucket}/o`

// ── AUTH ─────────────────────────────────────────────────────
export const fbRegister = async (email, password) => {
  const r = await fetch(`${AUTH_URL}:signUp?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return { uid: d.localId, email: d.email, token: d.idToken }
}

export const fbLogin = async (email, password) => {
  const r = await fetch(`${AUTH_URL}:signInWithPassword?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return { uid: d.localId, email: d.email, token: d.idToken }
}

// ── FIRESTORE SERIALIZERS ────────────────────────────────────
export const toFS = (obj) => ({
  fields: Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === null || v === undefined) return [k, { nullValue: null }]
      if (typeof v === 'boolean')        return [k, { booleanValue: v }]
      if (typeof v === 'number')         return [k, { doubleValue: v }]
      if (typeof v === 'object')         return [k, { stringValue: JSON.stringify(v) }]
      return [k, { stringValue: String(v) }]
    })
  ),
})

export const fromFS = (doc) => {
  if (!doc?.fields) return null
  return Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => {
      const raw = v.stringValue ?? v.doubleValue ?? v.integerValue ?? v.booleanValue ?? null
      try { return [k, JSON.parse(raw)] } catch { return [k, raw] }
    })
  )
}

// ── FIRESTORE CRUD ───────────────────────────────────────────
export const fbSet = async (collection, docId, data, token) => {
  const r = await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(toFS(data)),
  })
  return r.json()
}

export const fbGet = async (collection, docId, token) => {
  const r = await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return fromFS(await r.json())
}

export const fbList = async (collection, token) => {
  const r = await fetch(`${FS_URL}/${collection}?key=${FB.apiKey}&pageSize=50`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const d = await r.json()
  return (d.documents || []).map(doc => ({
    id: doc.name.split('/').pop(),
    ...fromFS(doc),
  }))
}

export const fbDelete = async (collection, docId, token) => {
  await fetch(`${FS_URL}/${collection}/${docId}?key=${FB.apiKey}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ── STORAGE ──────────────────────────────────────────────────
export const fbUpload = async (path, file, token) => {
  const r = await fetch(
    `${ST_URL}?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
      body: file,
    }
  )
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return `${ST_URL}/${encodeURIComponent(path)}?alt=media&token=${d.downloadTokens}`
}

// ── RACES (lectura pública sin token) ────────────────────────
export const fbGetRaces = async () => {
  try {
    const r = await fetch(`${FS_URL}/races?key=${FB.apiKey}&pageSize=100`)
    const d = await r.json()
    return (d.documents || []).map(doc => {
      const f = doc.fields
      const g = (k) => f[k]?.stringValue ?? f[k]?.doubleValue ?? null
      return {
        id: doc.name.split('/').pop(),
        name: g('name'), date: g('date'), distance: g('distance'),
        location: g('location'), terrain: g('terrain'), weather: g('weather'),
        difficulty: g('difficulty'), link: g('link'), image: '🏃',
        registered: Number(g('registered')) || 0,
        prize: g('prize') || 'Medalla finisher',
      }
    }).filter(r => r.name && r.date)
  } catch {
    return [] // fallback silencioso
  }
}
