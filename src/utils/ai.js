/**
 * PaceAI — Helpers para llamadas a la API de Claude (Anthropic)
 * La API key se inyecta automáticamente desde el entorno de Claude.ai
 */

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'
const MODEL      = 'claude-sonnet-4-20250514'

export const callClaude = async ({ system, messages, maxTokens = 1000 }) => {
  const body = { model: MODEL, max_tokens: maxTokens, messages }
  if (system) body.system = system

  const r = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d.content?.[0]?.text || ''
}

export const callClaudeJSON = async (opts) => {
  const text = await callClaude(opts)
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    throw new Error('La IA no devolvió JSON válido')
  }
}

export const callClaudeVision = async ({ system, text, imageBase64, imageType }) => {
  return callClaude({
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
        { type: 'text', text },
      ],
    }],
  })
}

export const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload  = () => res(r.result.split(',')[1])
  r.onerror = rej
  r.readAsDataURL(file)
})

// System prompts centralizados
export const PROMPTS = {
  coach: (profile) =>
    `Sos PaceAI, el coach de running más avanzado de Argentina. Combinás el conocimiento técnico de Jack Daniels, la filosofía de Murakami sobre correr, y la calidez de un entrenador porteño.
${profile ? `Perfil: ${profile.name}, ${profile.age} años, ${profile.weight}kg, nivel ${profile.level}, objetivo "${profile.goal}", entrena ${profile.days} días/semana.` : ''}
Hablás de vos a vos. Respondés en español rioplatense. Conciso pero completo (máx 4 párrafos).`,

  trainingPlan: (race, profile) =>
    `Generá un plan de entrenamiento para "${race.name}" (${race.distance}), fecha ${race.date}, terreno ${race.terrain}, clima ${race.weather}.
${profile ? `Perfil: nivel ${profile.level}, ${profile.age} años, ${profile.days} días/semana.` : ''}
Respondé SOLO con JSON válido sin markdown:
{"semanas":[{"numero":1,"objetivo":"str","sesiones":[{"dia":"Lunes","tipo":"Recuperación","distancia":"5K","ritmo":"6:30/km","descripcion":"str"}],"consejo":"str"}],"consejos_generales":["str"],"nutricion":"str","calzado":"str"}
4 semanas, 4-5 sesiones/semana.`,

  postRace: (profile) =>
    `Analizás fotos post-carrera (resultados, llegada, capturas de apps de running).
${profile ? `El corredor es ${profile.name}, nivel ${profile.level}, objetivo: "${profile.goal}".` : ''}
Si es resultado: extraé tiempo, pace, posición y comparalo con el objetivo.
Si es foto: comentá postura, expresión, esfuerzo. Siempre terminá con: (1) puntaje 0-100%, (2) principal logro, (3) área a mejorar.
Hablás en español rioplatense de vos a vos.`,

  tourism: (race) =>
    `Sos un porteño experto en logística de carreras. Guía turística completa para "${race.name}" en ${race.location}.
Incluí: 🍝 dónde hacer carbo-loading (2-3 opciones con precio), 🏨 hoteles cerca (2-3), 🚗 estacionamiento y subte, 👨‍👩‍👧 qué hacer la familia mientras corro, 🎭 actividad cultural post-carrera, ⚡ 3 tips logísticos clave. Sé concreto.`,
}
