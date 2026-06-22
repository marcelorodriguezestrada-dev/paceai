import { useState, useEffect } from "react";

/**
 * DailyCoach — Check-in diario del coach
 *
 * Aparece una vez por día en la vista de entrenamiento.
 * Pregunta cómo se sintió el corredor y ajusta la sesión de hoy si hace falta.
 *
 * Props:
 *   todaySession  : objeto sesión de hoy { dia, tipo, distancia, ritmo, descripcion }
 *   profile       : perfil del corredor
 *   weekNumber    : número de semana actual
 *   onAdjust      : función(sessionAjustada) — callback cuando el coach ajusta la sesión
 *   apiEndpoint   : URL del endpoint de chat (default: /api/chat)
 */

const STORAGE_KEY = "paceai_daily_checkin";

function getToday() {
  return new Date().toISOString().split("T")[0]; // "2025-06-22"
}

function loadCheckin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.date !== getToday()) return null; // expiró
    return data;
  } catch {
    return null;
  }
}

function saveCheckin(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, date: getToday() }));
  } catch {}
}

// Preguntas del coach — rotativas para no ser repetitivas
const COACH_QUESTIONS = [
  { id: "sensacion", emoji: "💪", text: "¿Cómo te sentiste en el último entrenamiento?" },
  { id: "energia", emoji: "⚡", text: "¿Cómo está tu energía hoy?" },
  { id: "descanso", emoji: "😴", text: "¿Cómo dormiste esta semana?" },
  { id: "trabajo", emoji: "💼", text: "¿Tenés mucha carga laboral o estrés esta semana?" },
  { id: "muscular", emoji: "🦵", text: "¿Cómo están tus piernas? ¿Sentís alguna molestia?" },
];

const OPTIONS = {
  sensacion: [
    { value: 5, label: "Excelente 🔥", color: "#22c55e" },
    { value: 4, label: "Bien 💪", color: "#84cc16" },
    { value: 3, label: "Regular 😐", color: "#f59e0b" },
    { value: 2, label: "Cansado 😓", color: "#ef4444" },
    { value: 1, label: "Muy mal 🤕", color: "#dc2626" },
  ],
  energia: [
    { value: 5, label: "Lleno de energía ⚡", color: "#22c55e" },
    { value: 4, label: "Bien 👍", color: "#84cc16" },
    { value: 3, label: "Normal 😐", color: "#f59e0b" },
    { value: 2, label: "Bajo 😴", color: "#ef4444" },
    { value: 1, label: "Agotado 💤", color: "#dc2626" },
  ],
  descanso: [
    { value: 5, label: "+8 horas 😴✨", color: "#22c55e" },
    { value: 4, label: "7-8 horas 👍", color: "#84cc16" },
    { value: 3, label: "6-7 horas 😐", color: "#f59e0b" },
    { value: 2, label: "Menos de 6 😓", color: "#ef4444" },
    { value: 1, label: "Muy mal 🥴", color: "#dc2626" },
  ],
  trabajo: [
    { value: 5, label: "Muy tranquilo 😌", color: "#22c55e" },
    { value: 4, label: "Normal 👌", color: "#84cc16" },
    { value: 3, label: "Algo estresado 😤", color: "#f59e0b" },
    { value: 2, label: "Mucho estrés 😰", color: "#ef4444" },
    { value: 1, label: "Caótico 🔥", color: "#dc2626" },
  ],
  muscular: [
    { value: 5, label: "Perfecto 💪", color: "#22c55e" },
    { value: 4, label: "Bien 👍", color: "#84cc16" },
    { value: 3, label: "Algo de tensión 🤔", color: "#f59e0b" },
    { value: 2, label: "Dolor muscular 😬", color: "#ef4444" },
    { value: 1, label: "Lesión posible 🚨", color: "#dc2626" },
  ],
};

export default function DailyCoach({ todaySession, profile, weekNumber, onAdjust, apiEndpoint = "/api/chat" }) {
  const [phase, setPhase] = useState("idle"); // idle | asking | loading | result | done | minimized
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [comment, setComment] = useState("");
  const [result, setResult] = useState(null); // { mensaje, ajuste, sesionAjustada }
  const [expanded, setExpanded] = useState(true);

  // Seleccionar pregunta del día (rota día a día)
  useEffect(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    setQuestionIdx(dayOfYear % COACH_QUESTIONS.length);

    const saved = loadCheckin();
    if (saved) {
      setResult(saved.result);
      setAnswers(saved.answers || {});
      setPhase("done");
    } else {
      setPhase("asking");
    }
  }, []);

  const question = COACH_QUESTIONS[questionIdx];
  const options = OPTIONS[question.id] || OPTIONS.sensacion;
  const selectedValue = answers[question.id];

  const handleAnswer = async (value) => {
    const newAnswers = { ...answers, [question.id]: value };
    setAnswers(newAnswers);

    // Score promedio de todas las respuestas
    const allValues = Object.values(newAnswers);
    const avgScore = allValues.reduce((a, b) => a + b, 0) / allValues.length;

    setPhase("loading");

    try {
      const sessionStr = todaySession
        ? `Sesión de hoy: ${todaySession.tipo} — ${todaySession.distancia} a ${todaySession.ritmo}. ${todaySession.descripcion}`
        : "Sin sesión definida para hoy.";

      const pregunta = question.text;
      const respuesta = options.find(o => o.value === value)?.label || value;

      const prompt = `Sos PaceAI, coach de running argentino. Hablás de vos a vos, en español rioplatense. Sos directo, cálido, sin tecnicismos innecesarios.

El corredor ${profile?.name || ""} está en la semana ${weekNumber || "?"} de su plan.
Pregunta de hoy: "${pregunta}"
Respuesta: "${respuesta}"
Comentario adicional: "${comment || "ninguno"}"
${sessionStr}
Score general de bienestar: ${avgScore.toFixed(1)}/5

Basado en esto, respondé con JSON (sin markdown):
{
  "saludo": "frase corta de bienvenida personalizada (max 10 palabras)",
  "mensaje": "análisis de 2-3 oraciones de cómo está el corredor y qué implica para hoy",
  "ajuste": "NINGUNO | REDUCIR | CANCELAR | AUMENTAR",
  "razon": "una oración explicando por qué ajustás o no",
  "sesionAjustada": ${todaySession ? `{
    "tipo": "${todaySession.tipo}",
    "distancia": "distancia ajustada o igual",
    "ritmo": "ritmo ajustado o igual",
    "descripcion": "descripción ajustada según el estado del corredor"
  }` : "null"},
  "emoji": "un emoji que representa el estado del corredor hoy"
}

Reglas:
- Si score >= 4: NINGUNO o AUMENTAR levemente
- Si score 3: NINGUNO, solo un mensaje motivador  
- Si score <= 2: REDUCIR volumen 20-30% o CANCELAR si hay lesión
- Si hay lesión posible: CANCELAR la sesión de calidad, reemplazar por descanso activo`;

      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
        }),
      });
      const d = await res.json();
      let text = d?.content?.[0]?.text || d?.choices?.[0]?.message?.content || "";
      text = text.replace(/```(?:json)?\n?|```/g, "").trim();
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : text);

      const checkin = { result: parsed, answers: newAnswers };
      saveCheckin(checkin);
      setResult(parsed);
      setPhase("result");

      if (parsed.sesionAjustada && parsed.ajuste !== "NINGUNO" && onAdjust) {
        onAdjust(parsed.sesionAjustada);
      }
    } catch (err) {
      console.error("[DailyCoach]", err);
      const fallback = {
        saludo: "¡Hola!",
        mensaje: value >= 4
          ? "¡Estás en gran forma! Aprovechá la sesión de hoy al máximo."
          : value >= 3
            ? "Día normal. Escuchá tu cuerpo durante la sesión."
            : "Tomátela con calma hoy. Tu cuerpo pide un poco menos de intensidad.",
        ajuste: value <= 2 ? "REDUCIR" : "NINGUNO",
        razon: value <= 2 ? "Bajás la carga para proteger la recuperación." : "El plan sigue igual.",
        sesionAjustada: null,
        emoji: value >= 4 ? "🔥" : value >= 3 ? "👍" : "😴",
      };
      saveCheckin({ result: fallback, answers: newAnswers });
      setResult(fallback);
      setPhase("result");
    }
  };

  const ajusteColors = {
    NINGUNO: "#22c55e",
    AUMENTAR: "#3b82f6",
    REDUCIR: "#f59e0b",
    CANCELAR: "#ef4444",
  };

  const ajusteLabels = {
    NINGUNO: "✓ Sesión sin cambios",
    AUMENTAR: "↑ Podés exigirte más hoy",
    REDUCIR: "↓ Bajamos la carga hoy",
    CANCELAR: "✕ Sesión cancelada — descansá",
  };

  if (phase === "idle") return null;

  // Versión minimizada
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--bd)",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>{result?.emoji || "🏃"}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: ".82rem", color: "var(--mu)" }}>Check-in del coach · </span>
          <span style={{
            fontSize: ".82rem",
            fontWeight: 700,
            color: ajusteColors[result?.ajuste] || "var(--or)",
          }}>
            {ajusteLabels[result?.ajuste] || "Ver resultado"}
          </span>
        </div>
        <span style={{ color: "var(--mu)", fontSize: ".75rem" }}>Ver ▼</span>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--bd)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--bd)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,69,0,.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #FF4500, #FF8C42)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem",
          }}>
            🏃
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".88rem" }}>Check-in diario</div>
            <div style={{ fontSize: ".72rem", color: "var(--mu)" }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: "none", border: "none", color: "var(--mu)", cursor: "pointer", fontSize: "1rem", padding: "4px 8px" }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "18px 20px" }}>

        {/* FASE: preguntando */}
        {phase === "asking" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: "1.4rem" }}>{question.emoji}</span>
              <p style={{ fontSize: ".95rem", fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
                {question.text}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  style={{
                    background: "var(--bg3)",
                    border: "1px solid var(--bd)",
                    borderRadius: 8,
                    padding: "11px 16px",
                    color: "var(--tx)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: ".88rem",
                    fontFamily: "var(--fb)",
                    transition: ".15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={e => {
                    e.target.style.borderColor = opt.color;
                    e.target.style.background = `${opt.color}15`;
                  }}
                  onMouseLeave={e => {
                    e.target.style.borderColor = "var(--bd)";
                    e.target.style.background = "var(--bg3)";
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: ".75rem", color: opt.color, fontWeight: 700 }}>
                    {"●".repeat(opt.value)}{"○".repeat(5 - opt.value)}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <textarea
                placeholder="Algo más que quieras contarle al coach... (opcional)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--bg3)",
                  border: "1px solid var(--bd)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "var(--tx)",
                  fontFamily: "var(--fb)",
                  fontSize: ".82rem",
                  resize: "vertical",
                  outline: "none",
                  minHeight: 60,
                }}
              />
            </div>
          </>
        )}

        {/* FASE: cargando */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 32, height: 32,
              border: "3px solid var(--bd)", borderTopColor: "var(--or)",
              borderRadius: "50%",
              animation: "sp .8s linear infinite",
              margin: "0 auto 12px",
            }} />
            <div style={{ color: "var(--mu)", fontSize: ".88rem" }}>
              El coach está analizando cómo estás...
            </div>
          </div>
        )}

        {/* FASE: resultado */}
        {(phase === "result" || phase === "done") && result && (
          <>
            {/* Saludo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: "1.8rem" }}>{result.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".95rem" }}>{result.saludo}</div>
                <div style={{ fontSize: ".82rem", color: "var(--mu)", marginTop: 2, lineHeight: 1.5 }}>
                  {result.mensaje}
                </div>
              </div>
            </div>

            {/* Ajuste de sesión */}
            <div style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: `${ajusteColors[result.ajuste]}15`,
              border: `1px solid ${ajusteColors[result.ajuste]}40`,
              marginBottom: result.sesionAjustada && result.ajuste !== "NINGUNO" ? 14 : 0,
            }}>
              <div style={{
                fontWeight: 700,
                color: ajusteColors[result.ajuste],
                fontSize: ".82rem",
                marginBottom: 4,
              }}>
                {ajusteLabels[result.ajuste]}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--mu)" }}>{result.razon}</div>
            </div>

            {/* Sesión ajustada */}
            {result.sesionAjustada && result.ajuste !== "NINGUNO" && (
              <div style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--bg3)",
                border: "1px solid var(--bd)",
              }}>
                <div style={{
                  fontSize: ".68rem",
                  color: "var(--or)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}>
                  Sesión ajustada para hoy
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "6px 14px", fontSize: ".82rem" }}>
                  <span style={{ color: "var(--mu)" }}>Tipo</span>
                  <span style={{ fontWeight: 600 }}>{result.sesionAjustada.tipo}</span>
                  <span style={{ color: "var(--mu)" }}>Distancia</span>
                  <span style={{ color: "#FFD700", fontFamily: "'Anton', sans-serif" }}>{result.sesionAjustada.distancia}</span>
                  <span style={{ color: "var(--mu)" }}>Ritmo</span>
                  <span>{result.sesionAjustada.ritmo}</span>
                  <span style={{ color: "var(--mu)" }}>Sesión</span>
                  <span style={{ color: "var(--mu)", fontSize: ".78rem", lineHeight: 1.4 }}>{result.sesionAjustada.descripcion}</span>
                </div>
              </div>
            )}

            {/* Nuevo check-in mañana */}
            <div style={{ marginTop: 12, fontSize: ".72rem", color: "#444", textAlign: "center" }}>
              El próximo check-in será mañana · {COACH_QUESTIONS[(questionIdx + 1) % COACH_QUESTIONS.length].emoji} {COACH_QUESTIONS[(questionIdx + 1) % COACH_QUESTIONS.length].text.slice(0, 40)}...
            </div>
          </>
        )}
      </div>
    </div>
  );
}