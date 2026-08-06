import { useState } from "react";
import {
  Search, FileText, Ruler, ShieldCheck, ShieldAlert, Bell, Clock,
  TrendingUp, ArrowUpRight, ChevronRight, CheckCircle2, AlertTriangle,
  Building2, HardHat, Filter,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tokens — paleta extraída del sitio de DataSeed, tema claro
// ---------------------------------------------------------------------------
const C = {
  bg: "#F6FBF7",
  card: "#FFFFFF",
  subtle: "#EAF4EB",
  border: "#DCEBDD",
  green: "#3F8C3A",
  greenDark: "#2E6B2A",
  greenSoft: "#E4F3E2",
  ink: "#102310",
  inkSoft: "#516152",
  amber: "#B7791F",
  amberSoft: "#FBF0DD",
  amberBorder: "#EAD3A3",
};

const fontDisplay = "'Space Grotesk', system-ui, sans-serif";
const fontBody = "'Inter', system-ui, sans-serif";
const fontMono = "'IBM Plex Mono', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Datos de ejemplo — mockup, no conectado a fuente real todavía
// ---------------------------------------------------------------------------
const estudios = [
  { nombre: "Estudio de suelo — Bodega Industrial Renca", etapa: "En terreno", avance: 65 },
  { nombre: "Impacto vial — Edificio Ñuñoa", etapa: "En informe", avance: 40 },
  { nombre: "Factibilidad hídrica — Cond. Los Álamos", etapa: "Entregado", avance: 100 },
  { nombre: "Geotécnico — Planta Concepción", etapa: "En terreno", avance: 20 },
];

const cubicaciones = [
  { nombre: "Hormigón — Edificio Ñuñoa", avance: 82 },
  { nombre: "Acero de refuerzo — PTAS RM", avance: 45 },
  { nombre: "Movimiento de tierra — Ciclovía Vespucio", avance: 30 },
];

const licitaciones = [
  {
    nombre: "Reposición pavimentos calle Los Aromos",
    organismo: "Municipalidad de Puente Alto",
    monto: "$184.500.000",
    cierre: "12 ago",
    dias: 7,
    certs: ["OS10", "Registro MOP 1ª cat."],
  },
  {
    nombre: "Construcción sede vecinal Villa Esperanza",
    organismo: "Municipalidad de La Florida",
    monto: "$96.200.000",
    cierre: "15 ago",
    dias: 10,
    certs: ["ISO 9001", "DOM"],
  },
  {
    nombre: "Ampliación planta de tratamiento aguas servidas",
    organismo: "MOP · Región Metropolitana",
    monto: "$2.340.000.000",
    cierre: "20 ago",
    dias: 15,
    certs: ["RCA", "ISO 45001", "Registro MOP 2ª cat."],
  },
  {
    nombre: "Mejoramiento cancha techada Liceo Bicentenario",
    organismo: "Municipalidad de San Bernardo",
    monto: "$312.000.000",
    cierre: "9 ago",
    dias: 4,
    certs: ["OS10"],
  },
  {
    nombre: "Construcción ciclovía Av. Vespucio",
    organismo: "MOP",
    monto: "$1.180.000.000",
    cierre: "25 ago",
    dias: 20,
    certs: ["Registro MOP 1ª cat.", "RCA"],
  },
];

const alertasFase2 = [
  {
    icon: ShieldAlert,
    titulo: "Vencimiento de certificación",
    detalle: "Avisar 30 días antes de que venza el OS10 o el registro MOP de la empresa.",
  },
  {
    icon: Clock,
    titulo: "Cierre de licitación próximo",
    detalle: "Avisar cuando falten 48 h para el cierre de una licitación en seguimiento.",
  },
  {
    icon: AlertTriangle,
    titulo: "Cubicación fuera de rango",
    detalle: "Avisar si el avance de cubicación se desvía más de 10 % del plan de obra.",
  },
];

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Crosshair({ corner }) {
  const pos = {
    tl: { top: -1, left: -1 },
    tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 },
    br: { bottom: -1, right: -1 },
  }[corner];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ position: "absolute", ...pos }}>
      <path d="M8 2 V14 M2 8 H14" stroke={C.green} strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function Kpi({ icon: Icon, label, value, sub, warn }) {
  return (
    <div
      className="flex-1 rounded-xl p-5"
      style={{ background: C.card, border: `1px solid ${warn ? C.amberBorder : C.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: warn ? C.amberSoft : C.greenSoft }}
        >
          <Icon size={17} color={warn ? C.amber : C.green} strokeWidth={2} />
        </div>
        {warn && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: C.amberSoft, color: C.amber, fontFamily: fontBody }}
          >
            revisar
          </span>
        )}
      </div>
      <div style={{ fontFamily: fontDisplay, color: C.ink }} className="text-3xl font-semibold leading-none mb-1">
        {value}
      </div>
      <div style={{ fontFamily: fontBody, color: C.inkSoft }} className="text-[13px]">
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: fontBody, color: warn ? C.amber : C.inkSoft }} className="text-[11px] mt-1.5">
          {sub}
        </div>
      )}
    </div>
  );
}

function Barra({ pct, color = C.green }) {
  return (
    <div className="w-full h-1.5 rounded-full" style={{ background: C.subtle }}>
      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function PanelArea({ icon: Icon, titulo, count, children }) {
  return (
    <div className="flex-1 rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={16} color={C.green} strokeWidth={2} />
          <span style={{ fontFamily: fontDisplay, color: C.ink }} className="text-[15px] font-semibold">
            {titulo}
          </span>
        </div>
        <span
          style={{ fontFamily: fontMono, color: C.inkSoft, background: C.subtle }}
          className="text-[11px] px-2 py-0.5 rounded-md"
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}

function CertBadge({ label }) {
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-md font-medium whitespace-nowrap"
      style={{ background: C.amberSoft, color: C.amber, border: `1px solid ${C.amberBorder}`, fontFamily: fontBody }}
    >
      {label}
    </span>
  );
}

export default function Tablero() {
  const [filtro, setFiltro] = useState("");

  const filtradas = licitaciones.filter((l) =>
    (l.nombre + l.organismo).toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: fontBody }} className="relative">
      {/* textura de grilla de plano, muy sutil — el guiño a construcción/cubicación */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            `linear-gradient(${C.border}55 1px, transparent 1px), linear-gradient(90deg, ${C.border}55 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, black, black 420px, transparent 900px)",
          WebkitMaskImage: "linear-gradient(to bottom, black, black 420px, transparent 900px)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* eyebrow */}
        <div className="flex items-center gap-2 mb-5" style={{ color: C.green }}>
          <span
            className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full"
            style={{ background: C.greenSoft, fontFamily: fontBody }}
          >
            Constructora Andes Sur
          </span>
          <ChevronRight size={12} color={C.inkSoft} />
          <span style={{ color: C.inkSoft, fontFamily: fontBody }} className="text-[11px]">
            Panel operativo · v1 mockup
          </span>
        </div>

        {/* header */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-3">
          <div>
            <h1
              style={{ fontFamily: fontDisplay, color: C.ink }}
              className="text-[32px] font-semibold leading-tight tracking-tight"
            >
              Estudios, licitaciones y cubicaciones
            </h1>
            <p style={{ color: C.inkSoft, fontFamily: fontBody }} className="text-[14px] mt-1">
              Una vista para agilizar las tres etapas del ciclo de obra, antes de sumar alertas automáticas.
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.inkSoft, fontFamily: fontMono }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
            actualizado hoy · 09:14
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <Kpi icon={Search} label="Estudios en curso" value="4" />
          <Kpi icon={Ruler} label="Cubicaciones en avance" value="3" />
          <Kpi icon={FileText} label="Licitaciones abiertas" value="5" sub="de 23 en el rubro esta semana" />
          <Kpi
            icon={ShieldAlert}
            label="Certificaciones sin verificar"
            value="9 de 12"
            sub="cargadas a mano — ver detalle abajo"
            warn
          />
        </div>

        {/* tres áreas */}
        <div className="flex gap-4 mb-8 flex-wrap md:flex-nowrap">
          <PanelArea icon={Search} titulo="Estudios" count={estudios.length}>
            {estudios.map((e) => (
              <div key={e.nombre}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: C.ink }} className="text-[12.5px] font-medium">{e.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Barra pct={e.avance} /></div>
                  <span style={{ color: C.inkSoft, fontFamily: fontMono }} className="text-[10.5px] w-8 text-right">
                    {e.avance}%
                  </span>
                </div>
                <span style={{ color: C.inkSoft }} className="text-[10.5px]">{e.etapa}</span>
              </div>
            ))}
          </PanelArea>

          <PanelArea icon={HardHat} titulo="Cubicaciones" count={cubicaciones.length}>
            {cubicaciones.map((c) => (
              <div key={c.nombre}>
                <span style={{ color: C.ink }} className="text-[12.5px] font-medium block mb-1">{c.nombre}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1"><Barra pct={c.avance} color={C.green} /></div>
                  <span style={{ color: C.inkSoft, fontFamily: fontMono }} className="text-[10.5px] w-8 text-right">
                    {c.avance}%
                  </span>
                </div>
              </div>
            ))}
          </PanelArea>

          <PanelArea icon={FileText} titulo="Licitaciones" count={licitaciones.length}>
            {licitaciones.slice(0, 4).map((l) => (
              <div key={l.nombre} className="flex items-center justify-between gap-2">
                <span style={{ color: C.ink }} className="text-[12.5px] font-medium leading-snug">{l.nombre}</span>
                <span
                  style={{
                    color: l.dias <= 5 ? C.amber : C.inkSoft,
                    fontFamily: fontMono,
                    background: l.dias <= 5 ? C.amberSoft : C.subtle,
                  }}
                  className="text-[10.5px] px-1.5 py-0.5 rounded-md shrink-0"
                >
                  {l.dias} d
                </span>
              </div>
            ))}
          </PanelArea>
        </div>

        {/* brecha de datos */}
        <div
          className="rounded-xl p-4 mb-4 flex items-start gap-3"
          style={{ background: C.amberSoft, border: `1px solid ${C.amberBorder}` }}
        >
          <ShieldAlert size={18} color={C.amber} className="shrink-0 mt-0.5" />
          <div>
            <div style={{ color: C.ink, fontFamily: fontBody }} className="text-[13px] font-semibold mb-0.5">
              Brecha de datos: certificaciones
            </div>
            <div style={{ color: C.inkSoft, fontFamily: fontBody }} className="text-[12.5px] leading-relaxed">
              Mercado Público no expone garantías ni criterios de evaluación por API: viven en las bases,
              en PDF. Hoy el equipo carga esta columna a mano. Es la primera candidata a automatizar
              (lectura de bases) antes de construir alertas de vencimiento.
            </div>
          </div>
        </div>

        {/* tabla licitaciones */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: fontDisplay, color: C.ink }} className="text-[15px] font-semibold">
              Licitaciones abiertas — certificaciones requeridas
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: C.subtle }}>
              <Filter size={13} color={C.inkSoft} />
              <input
                value={filtro}
                onChange={(ev) => setFiltro(ev.target.value)}
                placeholder="Filtrar por nombre u organismo"
                style={{ background: "transparent", color: C.ink, fontFamily: fontBody, outline: "none" }}
                className="text-[12.5px] w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: C.subtle }}>
                  {["Licitación", "Organismo", "Monto", "Cierre", "Certificación requerida", "Fuente"].map((h) => (
                    <th
                      key={h}
                      style={{ color: C.inkSoft, fontFamily: fontBody, borderBottom: `1px solid ${C.border}` }}
                      className="text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l, i) => (
                  <tr key={l.nombre} style={{ borderBottom: i < filtradas.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <td className="px-4 py-3 text-[12.5px]" style={{ color: C.ink, fontFamily: fontBody, maxWidth: 260 }}>
                      {l.nombre}
                    </td>
                    <td className="px-4 py-3 text-[12.5px]" style={{ color: C.inkSoft, fontFamily: fontBody }}>
                      {l.organismo}
                    </td>
                    <td className="px-4 py-3 text-[12.5px]" style={{ color: C.ink, fontFamily: fontMono }}>
                      {l.monto}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] whitespace-nowrap" style={{ color: l.dias <= 5 ? C.amber : C.ink, fontFamily: fontMono }}>
                      {l.cierre} · {l.dias} d
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap max-w-[220px]">
                        {l.certs.map((c) => <CertBadge key={c} label={c} />)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11.5px]" style={{ color: C.inkSoft, fontFamily: fontBody }}>
                      Manual (bases PDF)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* alertas automáticas — roadmap */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} color={C.ink} />
            <span style={{ fontFamily: fontDisplay, color: C.ink }} className="text-[15px] font-semibold">
              Alertas automáticas
            </span>
          </div>
          <span
            className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: C.subtle, color: C.inkSoft, fontFamily: fontBody }}
          >
            fase 2 · no activo en este mockup
          </span>
        </div>

        <div className="flex gap-4 flex-wrap md:flex-nowrap pb-10">
          {alertasFase2.map(({ icon: Icon, titulo, detalle }) => (
            <div
              key={titulo}
              className="flex-1 rounded-xl p-4 opacity-70"
              style={{ background: C.card, border: `1px dashed ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <Icon size={16} color={C.inkSoft} />
                <div className="w-8 h-4.5 rounded-full flex items-center px-0.5" style={{ background: C.subtle }}>
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#fff", border: `1px solid ${C.border}` }} />
                </div>
              </div>
              <div style={{ color: C.ink, fontFamily: fontBody }} className="text-[13px] font-semibold mb-1">
                {titulo}
              </div>
              <div style={{ color: C.inkSoft, fontFamily: fontBody }} className="text-[11.5px] leading-relaxed">
                {detalle}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>
    </div>
  );
}
