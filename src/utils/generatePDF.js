/**
 * generatePlanPDF — Genera y descarga el plan de entrenamiento como PDF
 * Usa canvas del browser + jsPDF (cargado dinámicamente desde CDN)
 * Sin dependencias en package.json — se carga solo cuando el usuario pide el PDF
 */

const COLORS = {
  bg: [8, 8, 8],
  bg2: [17, 17, 17],
  bg3: [26, 26, 26],
  orange: [255, 69, 0],
  gold: [255, 215, 0],
  white: [240, 240, 240],
  muted: [136, 136, 136],
  border: [42, 42, 42],
  green: [34, 197, 94],
  blue: [59, 130, 246],
  red: [239, 68, 68],
  purple: [156, 39, 176],
};

const SESSION_COLORS = {
  Recuperación: [76, 175, 80],
  Rodaje: [0, 188, 212],
  Calidad: [244, 67, 54],
  Intervalo: [244, 67, 54],
  "Fondo Largo": [156, 39, 176],
  "Long run": [156, 39, 176],
  Tempo: [255, 152, 0],
  Fuerza: [33, 150, 243],
  Descanso: [64, 64, 64],
  Cuestas: [255, 107, 53],
  Tapering: [76, 175, 80],
};

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function rgb(color) {
  return { r: color[0], g: color[1], b: color[2] };
}

export async function generatePlanPDF(trainPlan, activeWeek = null) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210; // A4 width mm
  const H = 297; // A4 height mm
  const margin = 14;
  const contentW = W - margin * 2;

  const {
    semanas = [],
    race,
    paceZones: pz,
    macrociclo = [],
    nutricion,
    calzado,
    consejos_generales = [],
    validacion,
    races,
  } = trainPlan;

  // Decidir qué semanas exportar
  const semanasToExport = activeWeek !== null ? [semanas[activeWeek]] : semanas;
  const exportLabel = activeWeek !== null ? `Semana ${activeWeek + 1}` : "Plan completo";

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const setFill = (color) => doc.setFillColor(color[0], color[1], color[2]);
  const setDraw = (color) => doc.setDrawColor(color[0], color[1], color[2]);
  const setTxt = (color) => doc.setTextColor(color[0], color[1], color[2]);
  const setFont = (style = "normal", size = 10) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  // ── PÁGINA 1: Portada ────────────────────────────────────────────────────────
  // Fondo negro
  setFill(COLORS.bg);
  doc.rect(0, 0, W, H, "F");

  // Header naranja
  setFill(COLORS.orange);
  doc.rect(0, 0, W, 52, "F");

  // Logo PACEAI
  setTxt(COLORS.white);
  setFont("bold", 28);
  doc.text("PACE", margin, 22);
  setTxt(COLORS.bg);
  doc.text("AI", margin + 34, 22);

  // Subtítulo
  setTxt(COLORS.white);
  setFont("normal", 10);
  doc.text("Coach de running · Buenos Aires", margin, 30);

  // Línea separadora
  setDraw(COLORS.white);
  doc.setLineWidth(0.3);
  doc.line(margin, 35, W - margin, 35);

  // Nombre de la carrera
  setFont("bold", 20);
  setTxt(COLORS.white);
  const raceName = race?.name || "Plan de Entrenamiento";
  doc.text(raceName.toUpperCase(), margin, 46);

  // Info del plan
  let y = 68;
  const infoItems = [
    ["🏃 Distancia", race?.distance || "—"],
    ["📅 Fecha de carrera", race?.date ? new Date(race.date).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "—"],
    ["🗺️ Terreno", race?.terrain || "—"],
    ["📋 Exportado", exportLabel],
    ["📆 Generado", new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })],
  ];

  if (races && races.length > 1) {
    infoItems.splice(1, 0, ["🏁 Carreras en el plan", `${races.length} carreras`]);
  }

  infoItems.forEach(([label, value]) => {
    setFill(COLORS.bg3);
    setDraw(COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y - 5, contentW, 12, 2, 2, "FD");
    setFont("bold", 8);
    setTxt(COLORS.orange);
    doc.text(label, margin + 4, y + 2);
    setFont("normal", 9);
    setTxt(COLORS.white);
    doc.text(String(value), margin + 52, y + 2);
    y += 15;
  });

  // Macrociclo overview
  if (macrociclo.length > 0) {
    y += 6;
    setFont("bold", 9);
    setTxt(COLORS.orange);
    doc.text("MACROCICLO", margin, y);
    y += 6;

    const phaseW = (contentW - (macrociclo.length - 1) * 3) / macrociclo.length;
    const phaseColors = {
      "Base / Fuerza": COLORS.blue,
      Específica: COLORS.gold,
      Sharpening: COLORS.red,
      Tapering: COLORS.green,
      Activación: COLORS.blue,
      "Específica compacta": COLORS.gold,
    };

    macrociclo.forEach((f, i) => {
      const x = margin + i * (phaseW + 3);
      const col = phaseColors[f.fase] || COLORS.orange;
      setFill(col);
      doc.roundedRect(x, y, phaseW, 10, 2, 2, "F");
      setFont("bold", 6.5);
      setTxt(COLORS.bg);
      const label = f.fase.length > 12 ? f.fase.slice(0, 12) + "." : f.fase;
      doc.text(label, x + phaseW / 2, y + 4.5, { align: "center" });
      setFont("normal", 6);
      doc.text(`S${f.semanas_inicio}-${f.semanas_fin}`, x + phaseW / 2, y + 8.5, { align: "center" });
    });
    y += 16;
  }

  // Ritmos
  if (pz) {
    y += 4;
    setFont("bold", 9);
    setTxt(COLORS.orange);
    doc.text("TUS ZONAS DE RITMO", margin, y);
    y += 6;

    const zones = [
      ["Fácil", pz.easy],
      ["Fondo", pz.long_run],
      ["Tempo", pz.tempo],
      ["Int. 1K", pz.interval_1k],
      ["Int. 400m", pz.interval_400],
    ];
    const zW = (contentW - zones.length * 3) / zones.length;
    zones.forEach(([label, val], i) => {
      const x = margin + i * (zW + 3);
      setFill(COLORS.bg3);
      setDraw(COLORS.border);
      doc.roundedRect(x, y, zW, 14, 2, 2, "FD");
      setFont("normal", 6);
      setTxt(COLORS.muted);
      doc.text(label, x + zW / 2, y + 5, { align: "center" });
      setFont("bold", 8);
      setTxt(COLORS.orange);
      doc.text(val || "—", x + zW / 2, y + 11, { align: "center" });
    });
    y += 20;
  }

  // Coach note
  if (validacion) {
    y += 4;
    setFill(COLORS.bg2);
    setDraw([100, 85, 0]);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 22, 2, 2, "FD");
    setFont("bold", 8);
    setTxt(COLORS.gold);
    doc.text("NOTA DEL COACH", margin + 4, y + 7);
    setFont("normal", 8);
    setTxt(COLORS.muted);
    const lines = doc.splitTextToSize(validacion, contentW - 8);
    doc.text(lines.slice(0, 2), margin + 4, y + 14);
  }

  // Footer
  setFont("normal", 7);
  setTxt(COLORS.muted);
  doc.text("paceai.vercel.app · Coach IA para corredores de Buenos Aires", W / 2, H - 8, { align: "center" });

  // ── PÁGINAS DE SEMANAS ───────────────────────────────────────────────────────
  semanasToExport.forEach((sem, semIdx) => {
    if (!sem) return;
    doc.addPage();

    // Fondo
    setFill(COLORS.bg);
    doc.rect(0, 0, W, H, "F");

    // Header de semana
    setFill(COLORS.bg2);
    doc.rect(0, 0, W, 22, "F");
    setFill(COLORS.orange);
    doc.rect(0, 0, 4, 22, "F");

    setFont("bold", 13);
    setTxt(COLORS.white);
    const semNum = activeWeek !== null ? activeWeek + 1 : sem.numero || semIdx + 1;
    doc.text(`SEMANA ${semNum}`, margin, 10);
    setFont("normal", 8);
    setTxt(COLORS.orange);
    doc.text(sem.fase || "", margin, 17);
    setFont("normal", 8);
    setTxt(COLORS.muted);
    doc.text(`${sem.volumen_km || "—"} km/semana`, W - margin, 10, { align: "right" });
    doc.text(race?.name || "", W - margin, 17, { align: "right" });

    // Objetivo
    y = 30;
    if (sem.objetivo) {
      setFill(COLORS.bg3);
      setDraw(COLORS.orange);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, contentW, 10, 2, 2, "FD");
      setFont("bold", 7.5);
      setTxt(COLORS.orange);
      doc.text("OBJETIVO: ", margin + 3, y + 6.5);
      setFont("normal", 7.5);
      setTxt(COLORS.white);
      const objLines = doc.splitTextToSize(sem.objetivo, contentW - 28);
      doc.text(objLines[0], margin + 22, y + 6.5);
      y += 14;
    }

    // Carrera control badge
    if (sem.carrera_control) {
      setFill([255, 69, 0, 0.1]);
      setDraw(COLORS.orange);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin, y, contentW, 9, 2, 2, "FD");
      setFont("bold", 8);
      setTxt(COLORS.orange);
      doc.text(`🏁 CARRERA CONTROL: ${sem.carrera_control}`, margin + 3, y + 6);
      y += 13;
    }

    // Tabla de sesiones
    const cols = { dia: 22, tipo: 26, dist: 18, ritmo: 24, desc: contentW - 90 };
    const rowH = 13;

    // Header tabla
    setFill(COLORS.bg3);
    doc.rect(margin, y, contentW, 8, "F");
    setFont("bold", 7);
    setTxt(COLORS.orange);
    let x = margin + 2;
    ["DÍA", "TIPO", "DIST.", "RITMO", "SESIÓN"].forEach((h, i) => {
      doc.text(h, x, y + 5.5);
      x += [cols.dia, cols.tipo, cols.dist, cols.ritmo, cols.desc][i];
    });
    y += 8;

    (sem.sesiones || []).forEach((s, i) => {
      const isEven = i % 2 === 0;
      setFill(isEven ? COLORS.bg : COLORS.bg2);
      doc.rect(margin, y, contentW, rowH, "F");

      // Línea separadora
      setDraw(COLORS.border);
      doc.setLineWidth(0.1);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      const sesColor = SESSION_COLORS[s.tipo] || COLORS.orange;

      x = margin + 2;
      // Día
      setFont("bold", 7.5);
      setTxt(s.tipo === "Descanso" ? COLORS.muted : COLORS.white);
      doc.text(s.dia?.slice(0, 3) || "—", x, y + rowH / 2 + 2);
      x += cols.dia;

      // Tipo badge
      setFill(sesColor);
      doc.setFillColor(sesColor[0], sesColor[1], sesColor[2]);
      doc.roundedRect(x - 1, y + 2, cols.tipo - 4, 8, 1.5, 1.5, "F");
      setFont("bold", 6.5);
      setTxt(COLORS.white);
      const tipoLabel = (s.tipo || "").slice(0, 11);
      doc.text(tipoLabel, x + (cols.tipo - 5) / 2, y + 7.5, { align: "center" });
      x += cols.tipo;

      // Distancia
      setFont("bold", 8);
      setTxt(s.distancia === "-" ? COLORS.muted : COLORS.gold);
      doc.text(s.distancia || "—", x, y + rowH / 2 + 2);
      x += cols.dist;

      // Ritmo
      setFont("normal", 7);
      setTxt(s.ritmo === "-" ? COLORS.muted : COLORS.orange);
      const ritmoTxt = (s.ritmo || "—").slice(0, 14);
      doc.text(ritmoTxt, x, y + rowH / 2 + 2);
      x += cols.ritmo;

      // Descripción
      setFont("normal", 6.5);
      setTxt(COLORS.muted);
      const descLines = doc.splitTextToSize(s.descripcion || "", cols.desc - 4);
      doc.text(descLines.slice(0, 2), x, y + 4.5);

      y += rowH;
    });

    // Consejo de la semana
    if (sem.consejo) {
      y += 4;
      setFill(COLORS.bg2);
      setDraw(COLORS.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin, y, contentW, 14, 2, 2, "FD");
      setFill(COLORS.orange);
      doc.rect(margin, y, 3, 14, "F");
      setFont("bold", 7.5);
      setTxt(COLORS.orange);
      doc.text("💡 CONSEJO", margin + 6, y + 6);
      setFont("normal", 7.5);
      setTxt(COLORS.muted);
      const consejoLines = doc.splitTextToSize(sem.consejo, contentW - 10);
      doc.text(consejoLines.slice(0, 1), margin + 6, y + 11);
      y += 18;
    }

    // Footer
    setFont("normal", 6.5);
    setTxt(COLORS.muted);
    doc.text(`PaceAI · ${race?.name || ""} · Semana ${semNum} de ${semanas.length}`, W / 2, H - 8, { align: "center" });
    setFont("bold", 6.5);
    setTxt(COLORS.orange);
    doc.text(`paceai.vercel.app`, W - margin, H - 8, { align: "right" });
  });

  // ── PÁGINA FINAL: Consejos + Nutrición + Calzado ──────────────────────────
  if (!activeWeek && (consejos_generales.length > 0 || nutricion || calzado)) {
    doc.addPage();
    setFill(COLORS.bg);
    doc.rect(0, 0, W, H, "F");

    setFill(COLORS.bg2);
    doc.rect(0, 0, W, 22, "F");
    setFont("bold", 14);
    setTxt(COLORS.white);
    doc.text("GUÍA COMPLEMENTARIA", margin, 14);

    y = 32;

    if (consejos_generales.length > 0) {
      setFont("bold", 9);
      setTxt(COLORS.orange);
      doc.text("✅ CONSEJOS GENERALES", margin, y);
      y += 7;
      consejos_generales.forEach((c) => {
        setFill(COLORS.bg2);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
        setFill(COLORS.green);
        doc.rect(margin, y, 3, 10, "F");
        setFont("normal", 7.5);
        setTxt(COLORS.white);
        const cLines = doc.splitTextToSize(c, contentW - 8);
        doc.text(cLines[0], margin + 7, y + 6.5);
        y += 13;
      });
      y += 4;
    }

    if (nutricion) {
      setFont("bold", 9);
      setTxt(COLORS.orange);
      doc.text("🍽️ NUTRICIÓN", margin, y);
      y += 7;
      setFill(COLORS.bg2);
      const nutLines = doc.splitTextToSize(nutricion, contentW - 8);
      const nutH = Math.max(16, nutLines.length * 5 + 8);
      doc.roundedRect(margin, y, contentW, nutH, 2, 2, "F");
      setFont("normal", 8);
      setTxt(COLORS.muted);
      doc.text(nutLines, margin + 4, y + 7);
      y += nutH + 10;
    }

    if (calzado) {
      setFont("bold", 9);
      setTxt(COLORS.orange);
      doc.text("👟 CALZADO RECOMENDADO", margin, y);
      y += 7;
      setFill(COLORS.bg2);
      const calLines = doc.splitTextToSize(calzado, contentW - 8);
      const calH = Math.max(16, calLines.length * 5 + 8);
      doc.roundedRect(margin, y, contentW, calH, 2, 2, "F");
      setFont("normal", 8);
      setTxt(COLORS.muted);
      doc.text(calLines, margin + 4, y + 7);
    }

    setFont("normal", 6.5);
    setTxt(COLORS.muted);
    doc.text("PaceAI · Coach de running con IA · paceai.vercel.app", W / 2, H - 8, { align: "center" });
  }

  // ── Descargar ──────────────────────────────────────────────────────────────
  const filename = `PaceAI_${(race?.name || "Plan").replace(/\s+/g, "_")}_${exportLabel.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}