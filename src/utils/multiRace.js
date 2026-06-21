/**
 * buildMultiRacePrompt — Genera un prompt para un plan unificado con múltiples carreras
 *
 * Las carreras se ordenan por fecha y la más lejana es el objetivo principal.
 * Las intermedias son "carreras control" (escalones) dentro del macrociclo.
 */
export function buildMultiRacePrompt(races, profile, paceZones) {
  if (!races || races.length === 0) return null;

  // Ordenar por fecha
  const sorted = [...races].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const mainRace = sorted[sorted.length - 1];
  const controlRaces = sorted.slice(0, -1);

  const today = new Date();
  const mainRaceDate = new Date(mainRace.date);
  const totalWeeks = Math.max(
    4,
    Math.ceil((mainRaceDate - today) / (7 * 24 * 60 * 60 * 1000))
  );

  // Calcular semana de cada carrera control
  const controlRacesWithWeek = controlRaces.map((r) => {
    const raceDate = new Date(r.date);
    const weeksFromNow = Math.ceil(
      (raceDate - today) / (7 * 24 * 60 * 60 * 1000)
    );
    return { ...r, weekNumber: Math.max(1, weeksFromNow) };
  });

  const profileStr = profile
    ? `CORREDOR: ${profile.name || "sin nombre"} | Nivel: ${profile.level || "principiante"} | ${profile.age ? profile.age + " años" : ""} | ${profile.weight ? profile.weight + "kg" : ""} | ${profile.height ? profile.height + "cm" : ""} | ${profile.days || 4} días/semana | Ritmo de vida: ${profile.lifeRhythm || "moderado"}`
    : "CORREDOR: perfil no disponible";

  const paceStr = paceZones
    ? `RITMOS DEL ATLETA: Fácil: ${paceZones.easy} | Tempo: ${paceZones.tempo} | Intervalos 1K: ${paceZones.interval_1k}`
    : "Sin marca de tiempo — usá ritmos apropiados al nivel.";

  const controlRacesStr =
    controlRacesWithWeek.length > 0
      ? `CARRERAS CONTROL (escalones dentro del plan):\n${controlRacesWithWeek
          .map(
            (r) =>
              `  • Semana ${r.weekNumber}: ${r.name} — ${r.distance} — ${r.terrain} — ${r.weather}`
          )
          .join("\n")}`
      : "Sin carreras control.";

  const dist = (mainRace.distance || "").toLowerCase();
  const is42 = dist.includes("42");
  const is21 = dist.includes("21");
  const longRunPeak = is42 ? "32-35km" : is21 ? "24-26km" : "15-18km";

  return `Sos PaceAI, coach de running que aplica la metodología del Prof. Diego Ortiguera y los planes de Marcelo Rodríguez. Generás macrociclos EVOLUTIVOS con múltiples carreras integradas.

OBJETIVO PRINCIPAL: ${mainRace.name} — ${mainRace.distance} — Fecha: ${mainRace.date} — Terreno: ${mainRace.terrain}
SEMANAS DISPONIBLES: ${totalWeeks} semanas totales
${profileStr}
${paceStr}

${controlRacesStr}

REGLAS PARA PLAN MULTI-CARRERA:
1. Las carreras control NO son el objetivo — son herramientas de entrenamiento. NO hacer tapering completo para ellas.
2. La semana de una carrera control: reducir volumen 30%, sin series de calidad los 2 días previos.
3. La semana POST-carrera control: 3-4 días de recuperación activa, luego retomar carga normal.
4. El tapering completo solo para la carrera objetivo principal (últimas 2-3 semanas).
5. El fondo largo pico (${longRunPeak}) se alcanza 3-4 semanas antes de la carrera principal.
6. Cada semana con carrera control debe tener ese evento marcado en el campo "carrera_control".

ESTRUCTURA DE FASES (adaptada a ${totalWeeks} semanas):
- Fase 1 Base/Fuerza: ${Math.round(totalWeeks * 0.3)} semanas — cuestas, fondo aeróbico, core
- Fase 2 Específica: ${Math.round(totalWeeks * 0.35)} semanas — intervalos 1K-4K, tempo runs
- Fase 3 Sharpening: ${Math.round(totalWeeks * 0.2)} semanas — velocidad, reducción progresiva  
- Fase 4 Tapering: ${Math.max(2, totalWeeks - Math.round(totalWeeks * 0.85))} semanas — descanso activo

RESPONDÉ ÚNICAMENTE CON JSON VÁLIDO SIN MARKDOWN:
{
  "objetivo_principal": "${mainRace.name}",
  "carreras_control": [${controlRacesWithWeek.map((r) => `{"nombre":"${r.name}","semana":${r.weekNumber},"distancia":"${r.distance}"}`).join(",")}],
  "macrociclo": [{"fase":"string","semanas_inicio":1,"semanas_fin":4,"objetivo":"string"}],
  "semanas": [{
    "numero":1,
    "fase":"Base / Fuerza",
    "objetivo":"string",
    "volumen_km":"45",
    "carrera_control": null,
    "sesiones":[
      {"dia":"Lunes","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso activo + elongación 10min","core":false},
      {"dia":"Martes","tipo":"Calidad","distancia":"10km","ritmo":"string","descripcion":"10' suaves + [sesión] + 10' suaves + core","core":true},
      {"dia":"Miércoles","tipo":"Rodaje","distancia":"8km","ritmo":"string","descripcion":"Trote fácil + elongación","core":false},
      {"dia":"Jueves","tipo":"Calidad","distancia":"10km","ritmo":"string","descripcion":"10' suaves + [sesión] + core","core":true},
      {"dia":"Viernes","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso o caminata suave","core":false},
      {"dia":"Sábado","tipo":"Fondo Largo","distancia":"18km","ritmo":"string","descripcion":"Fondo suave progresivo + elongación completa","core":false},
      {"dia":"Domingo","tipo":"Descanso","distancia":"-","ritmo":"-","descripcion":"Descanso total. Hidratación y recuperación.","core":false}
    ],
    "consejo":"string"
  }],
  "consejos_generales":["string"],
  "nutricion":"string",
  "calzado":"string",
  "validacion":"Observación del coach sobre el plan multi-carrera"
}
Generá exactamente ${totalWeeks} semanas. Las semanas con carrera control (${controlRacesWithWeek.map((r) => `semana ${r.weekNumber}`).join(", ")}) deben tener "carrera_control" con el nombre de la carrera y reducción de volumen. Incluí los 7 días siempre.`;
}

/**
 * calcRecalibratedPlan — Ajusta el plan de semanas restantes
 * basado en el resultado post-carrera
 *
 * postRaceData: { tiempo, sensacion (1-5), comentarios }
 * remainingWeeks: semanas que quedan del plan
 */
export function buildRecalibrationPrompt(
  mainRace,
  controlRace,
  postRaceData,
  remainingWeeks,
  profile,
  originalPlan
) {
  const sensacion = parseInt(postRaceData.sensacion) || 3;
  const cargaStr =
    sensacion >= 4
      ? "AUMENTAR carga un 10-15% — el corredor llegó muy descansado"
      : sensacion <= 2
        ? "REDUCIR carga un 15-20% — el corredor llegó muy cansado"
        : "MANTENER carga similar — el corredor llegó en buen estado";

  return `Sos PaceAI. Acabás de correr "${controlRace.name}" (${controlRace.distance}) como carrera control dentro de tu preparación para "${mainRace.name}" (${mainRace.distance}).

RESULTADO DE LA CARRERA CONTROL:
- Tiempo: ${postRaceData.tiempo || "no registrado"}
- Sensación: ${sensacion}/5
- Comentarios: "${postRaceData.comentarios || "sin comentarios"}"

ANÁLISIS REQUERIDO: ${cargaStr}

PERFIL: ${profile?.name || "Corredor"} — Nivel ${profile?.level || "moderado"}

Quedan ${remainingWeeks} semanas hasta "${mainRace.name}".

Ajustá el plan de las próximas semanas. RESPONDÉ SOLO JSON:
{
  "recalibracion": {
    "diagnostico": "string — qué pasó y por qué",
    "ajuste": "string — qué cambia en el plan",
    "alerta": "string o null — si hay riesgo de lesión o sobreentrenamiento"
  },
  "semanas": [misma estructura que antes, ${remainingWeeks} semanas ajustadas]
}`;
}

/**
 * mergeRecalibratedWeeks — Reemplaza las semanas restantes con el plan recalibrado
 */
export function mergeRecalibratedWeeks(originalPlan, recalibratedWeeks, fromWeekIndex) {
  const newSemanas = [
    ...originalPlan.semanas.slice(0, fromWeekIndex),
    ...recalibratedWeeks,
  ];
  return { ...originalPlan, semanas: newSemanas };
}