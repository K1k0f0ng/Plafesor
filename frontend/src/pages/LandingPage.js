import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/* ---------------------------------------------------------------
   Revelado por scroll (equivalente al "Reveal" con Framer Motion,
   implementado aquí con IntersectionObserver — sin dependencias nuevas).
--------------------------------------------------------------- */

function useInView(threshold = 0.18) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold, rootMargin: '-40px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, visible] = useInView();
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------
   Contenido
--------------------------------------------------------------- */

const navLinks = [
  { href: '#plataforma', label: 'Plataforma' },
  { href: '#ia', label: 'Inteligencia artificial' },
  { href: '#capacidades', label: 'Capacidades' },
  { href: '#faq', label: 'Preguntas' },
];

const apuestas = [
  {
    n: '01',
    size: 'lg',
    tag: 'Predicción académica',
    icon: <IconTrend />,
    title: 'Saber quién va a perder el año, antes de que sea tarde',
    body: 'Cada noche el motor cruza promedio, tendencia de las últimas semanas, inasistencia y actividades incumplidas para calcular un score de riesgo por estudiante — con hasta 4 semanas de anticipación al cierre del período.',
    stats: [
      ['>75%', 'precisión de predicción'],
      ['>60%', 'recall sobre quienes pierden'],
      ['4 sem.', 'de anticipación mínima'],
    ],
    rivals: ['Q10', 'Phidias', 'Moodle', 'Classroom'],
  },
  {
    n: '02',
    size: 'md',
    tag: 'Gestión ejecutiva',
    icon: <IconChat />,
    title: 'Un copiloto que conoce cada estudiante, grupo y docente',
    body: 'El rector colombiano típico gestiona entre 200 y 2.000 estudiantes sin un sistema de información ejecutivo real. El Copiloto responde en lenguaje natural con el contexto institucional completo.',
    rivals: ['Q10', 'Phidias', 'Canvas'],
  },
  {
    n: '03',
    size: 'sm',
    tag: 'Automatización docente',
    icon: <IconPen />,
    title: 'El observador académico se escribe solo',
    body: 'Obligatorio por normativa MEN y una de las tareas más tediosas del docente. La IA lo redacta; el docente solo revisa y firma — 3 a 5 horas ahorradas al mes.',
    rivals: ['Q10', 'Phidias', 'Moodle'],
  },
  {
    n: '04',
    size: 'sm',
    tag: 'Acompañamiento 24/7',
    icon: <IconCap />,
    title: 'Cada estudiante, su propio tutor',
    body: 'Democratiza el acceso a tutoría personalizada. Conoce las notas del estudiante, en qué actividades falló y el currículo exacto de su colegio.',
    rivals: ['ChatGPT genérico', 'Q10', 'Phidias'],
  },
  {
    n: '05',
    size: 'sm',
    tag: 'Inteligencia institucional',
    icon: <IconChart />,
    title: 'El Power BI educativo que Colombia no tenía',
    body: 'Preconfigurado para el contexto educativo colombiano: escala MEN, estructura de grupos, períodos académicos y competencias curriculares — sin expertos de por medio.',
    rivals: ['Power BI', 'Tableau', 'Q10'],
  },
  {
    n: '06',
    size: 'xl',
    tag: 'Visión institucional en vivo',
    icon: <IconLayers />,
    title: 'La versión digital completa de su institución, viva y en tiempo real',
    body: 'No es un reporte: es una vista que se actualiza cada vez que un estudiante completa una actividad. Pulso académico, mapa de calor por grupo, termómetro de riesgo y proyecciones de qué pasa si se actúa ahora — o si no se actúa.',
    widget: <GemeloWidget />,
    rivals: ['Q10', 'Phidias', 'Reportes estáticos'],
  },
];

const featureGroups = [
  {
    tag: 'Gestión académica',
    title: 'El día a día del centro educativo, sin fricción',
    items: [
      'Instituciones, grupos, docentes, estudiantes y materias en una sola base',
      'Motor de actividades interactivas con calificación automática',
      'Escala de valoración oficial MEN configurada',
      'Control de asistencia por sesión',
      'Boletines oficiales listos para imprimir',
      'Exportación de reportes a Excel en un clic',
    ],
  },
  {
    tag: 'Comunicación y familias',
    title: 'Los padres informados sin saturar rectoría',
    items: [
      'Notificaciones automáticas por WhatsApp: notas, inasistencias, alertas',
      'Portal dedicado para consultar el progreso de sus hijos',
      'Comunicación oficial trazable, no en chats personales',
      'Reducción medible de llamadas telefónicas al centro educativo',
    ],
  },
  {
    tag: 'Analítica institucional',
    title: 'Un gemelo digital de su institución',
    items: [
      'Centro de métricas: salud académica en tiempo real',
      'Ranking de grupos y docentes con evolución histórica',
      'Mapas de calor por materia para detectar cuellos de botella',
      'Panel de dirección con la foto general de la institución',
    ],
  },
];

const riskStudents = [
  { n: 'María C. · 8°B', r: 87, c: 'alto' },
  { n: 'Andrés P. · 10°A', r: 71, c: 'alto' },
  { n: 'Laura M. · 7°C', r: 52, c: 'medio' },
  { n: 'Julián R. · 9°A', r: 34, c: 'bajo' },
];

const improvementSteps = [
  'Diagnóstico: ecuaciones lineales',
  '3 sesiones de refuerzo dirigido',
  '5 actividades interactivas asignadas',
  'Reevaluación programada · 22 de mayo',
];

const capabilities = [
  'Escala de valoración MEN nativa',
  'Boletines oficiales colombianos',
  'Actividades interactivas con calificación automática',
  'Notificaciones automáticas por WhatsApp',
  'Portal para padres',
  'IA predictiva de riesgo académico',
  'Copiloto conversacional para rectoría',
  'Observador académico generado por IA',
  'Tutor IA 24/7 para estudiantes',
  'Planes de mejoramiento generados por IA',
  'Gemelo digital de la institución',
];

const testimonialStats = [
  ['Instituciones activas', 'En operación'],
  ['Boletines MEN', 'Generados sin errores'],
  ['03:14 AM', 'IA corriendo cada noche'],
  ['24/7', 'Tutor disponible siempre'],
];

const faqs = [
  {
    q: '¿Playfesor ya está funcionando o es un prototipo?',
    a: 'Está en operación real. Hay centros educativos en Colombia usando Playfesor hoy para gestionar sus procesos académicos completos, no como piloto sino como sistema oficial.',
  },
  {
    q: '¿Cumple con el sistema de evaluación colombiano (MEN)?',
    a: 'Sí. La escala de valoración del Ministerio de Educación viene configurada por defecto y los boletines cumplen el formato oficial. Es un sistema diseñado específicamente para Colombia, no una traducción.',
  },
  {
    q: '¿Cómo se implementa en mi institución?',
    a: 'Acompañamos la migración de sus datos (grupos, docentes, estudiantes, materias) y la capacitación al equipo docente. La mayoría de instituciones están operando en semanas, no en meses.',
  },
  {
    q: '¿Los docentes necesitan formación técnica?',
    a: 'No. La interfaz está pensada para el flujo real del docente colombiano. Si maneja WhatsApp, maneja Playfesor.',
  },
  {
    q: '¿Los datos de mi institución están seguros?',
    a: 'Cada institución tiene su información aislada. Cumplimos con las normas colombianas de tratamiento de datos personales y sus datos nunca se usan para entrenar modelos externos.',
  },
  {
    q: '¿Qué hace diferente a Playfesor de un sistema de gestión académica tradicional?',
    a: 'Playfesor combina gestión académica completa con inteligencia artificial predictiva, copiloto conversacional y observador automático en un solo sistema — diseñado específicamente para el sistema educativo colombiano, no como módulos separados ni como una traducción genérica.',
  },
];

/* ---------------------------------------------------------------
   Mockups (pequeñas vistas ilustrativas del producto)
--------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="check-icon" fill="none">
      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M3 17l6-6 4 4 7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M4 5h16v10H8l-4 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M4 20h16M14 4l6 6-9 9H5v-6l9-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCap() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M2 8l10-4 10 4-10 4-10-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" className="apuesta-icon" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const gradeHealth = [
  { g: '5°', s: 'ok', p: '3.9' },
  { g: '6°', s: 'warn', p: '3.1' },
  { g: '7°', s: 'crit', p: '2.7' },
  { g: '8°', s: 'ok', p: '3.7' },
  { g: '9°', s: 'ok', p: '4.0' },
];

function GemeloWidget() {
  return (
    <div className="gemelo-widget">
      <div className="gemelo-grades">
        {gradeHealth.map((g) => (
          <div className={`gemelo-grade is-${g.s}`} key={g.g}>
            <span className="gemelo-grade-name">{g.g}</span>
            <span className="gemelo-grade-avg">{g.p}</span>
          </div>
        ))}
      </div>
      <div className="gemelo-projection">
        <div><span className="gemelo-projection-n">31</span> estudiantes perderían una materia sin intervención</div>
        <div className="gemelo-projection-arrow">→</div>
        <div><span className="gemelo-projection-n is-good">12</span> con intervención esta semana</div>
      </div>
    </div>
  );
}

function RiskDemo() {
  return (
    <div className="demo-risk">
      {riskStudents.map((s) => (
        <div className="demo-risk-row" key={s.n}>
          <span className="demo-risk-name">{s.n}</span>
          <div className="demo-risk-track">
            <div className={`demo-risk-fill demo-risk-${s.c}`} style={{ width: `${s.r}%` }} />
          </div>
          <span className="demo-risk-pct">{s.r}%</span>
        </div>
      ))}
    </div>
  );
}

function CopilotDemo() {
  return (
    <div className="demo-chat">
      <div className="demo-bubble demo-bubble-q">¿Qué materia tiene la mayor tasa de reprobación este año?</div>
      <div className="demo-bubble demo-bubble-a">
        <strong>Física en grado 10°</strong> con 34% de reprobación — concentrada en el grupo 10°C, donde 12 de 28 estudiantes están por debajo de 3.0.
      </div>
    </div>
  );
}

function ObservadorDemo() {
  return (
    <div className="demo-observador">
      <div className="demo-observador-head">
        <span>Observador · 8°B · P2</span>
        <span>Generado 00:02</span>
      </div>
      <p>
        <strong>María C.</strong> presenta un desempeño estable en humanidades pero una caída sostenida en matemáticas durante las últimas cuatro semanas. Se recomienda acompañamiento en álgebra básica y seguimiento del docente titular…
      </p>
    </div>
  );
}

function TutorDemo() {
  return (
    <div className="demo-chat">
      <div className="demo-bubble demo-bubble-a demo-bubble-left">Vamos por partes: primero despejamos <em>x</em>. ¿Qué operación harías?</div>
      <div className="demo-bubble demo-bubble-muted">Restar 4 a ambos lados</div>
      <div className="demo-bubble demo-bubble-a demo-bubble-left">Exacto ✓ Sigamos.</div>
    </div>
  );
}

function PlanDemo() {
  return (
    <ul className="demo-plan">
      {improvementSteps.map((s, i) => (
        <li key={s}>
          <span className="demo-plan-index">{i + 1}</span>
          {s}
        </li>
      ))}
    </ul>
  );
}

const aiCapabilities = [
  { name: 'Motor de riesgo predictivo', desc: 'Cada noche calcula qué estudiantes tienen probabilidad de perder el año — antes de que sea evidente.', demo: <RiskDemo />, span: 3 },
  { name: 'Copiloto de Rectoría', desc: 'Un chat conversacional donde el rector pregunta y recibe respuestas basadas en los datos reales de su institución.', demo: <CopilotDemo />, span: 3 },
  { name: 'Observador académico automático', desc: 'Genera el documento oficial de observación del estudiante que normalmente el docente escribe a mano.', demo: <ObservadorDemo />, span: 2 },
  { name: 'Tutor IA para estudiantes', desc: 'Acompañamiento personalizado disponible 24/7, fuera del horario de clase.', demo: <TutorDemo />, span: 2 },
  { name: 'Planes de mejoramiento automáticos', desc: 'Cuando un estudiante pierde una materia, el plan se genera con base en sus dificultades específicas.', demo: <PlanDemo />, span: 2 },
];

function HeroMockup() {
  const sidebarItems = ['Panel', 'Estudiantes', 'Docentes', 'Actividades', 'Riesgo académico', 'Copiloto IA', 'Reportes'];
  const metrics = [
    { k: 'Salud académica', v: '82%', t: '+3.4 vs. periodo anterior' },
    { k: 'Estudiantes en riesgo', v: '47', t: 'de 1,240 · alerta temprana' },
    { k: 'Asistencia semanal', v: '94%', t: '8 grupos por debajo del umbral' },
  ];
  const bars = [32, 41, 28, 52, 47, 63, 55, 68, 71, 58, 74, 82, 76, 69, 88];

  return (
    <div className="mockup-frame">
      <div className="mockup-window">
        <div className="mockup-titlebar">
          <span /><span /><span />
          <div className="mockup-path">app.playfesor.co · Centro de mando · Colegio San Rafael</div>
        </div>
        <div className="mockup-body">
          <aside className="mockup-sidebar">
            {sidebarItems.map((item, i) => (
              <div key={item} className={`mockup-sidebar-item ${i === 4 ? 'is-active' : ''}`}>{item}</div>
            ))}
          </aside>
          <div className="mockup-main">
            <div className="mockup-metrics">
              {metrics.map((m) => (
                <div className="mockup-metric-card" key={m.k}>
                  <div className="mockup-metric-label">{m.k}</div>
                  <div className="mockup-metric-value">{m.v}</div>
                  <div className="mockup-metric-trend">{m.t}</div>
                </div>
              ))}
            </div>
            <div className="mockup-split">
              <div className="mockup-chart-card">
                <div className="mockup-chart-head">
                  <span>Riesgo académico predictivo</span>
                  <span className="mockup-chart-time">Actualizado 03:14</span>
                </div>
                <div className="mockup-chart-bars">
                  {bars.map((h, i) => (
                    <div key={i} style={{ height: `${h}%` }} className={`mockup-bar ${h > 70 ? 'is-high' : h > 50 ? 'is-mid' : 'is-low'}`} />
                  ))}
                </div>
                <div className="mockup-chart-labels"><span>Grado 6°</span><span>Grado 11°</span></div>
              </div>
              <div className="mockup-copilot-card">
                <div className="mockup-copilot-label">Copiloto de Rectoría</div>
                <div className="mockup-copilot-q">¿Cuáles fueron los 3 grupos con mayor caída en matemáticas este periodo?</div>
                <div className="mockup-copilot-a"><strong>7°B, 9°A y 10°C</strong> presentan caídas de −0.6, −0.4 y −0.3. Docente común: prof. Rodríguez.</div>
                <div className="mockup-copilot-foot">Basado en datos reales de su institución</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Página
--------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="landing-page">
      <style>{styles}</style>

      <header className="lp-nav">
        <div className="lp-nav-inner">
          <a href="#top" className="lp-brand">
            <img src="/logo-icon.png" alt="Playfesor" className="lp-brand-icon" />
            <span>Playfesor</span>
          </a>
          <nav className="lp-nav-links">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-nav-login">Ingresar</Link>
            <a href="#demo" className="btn btn-navy btn-sm">Solicitar demo <span aria-hidden>→</span></a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="hero-section">
          <div className="hero-grid-bg" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-copy is-visible reveal">
              <div className="eyebrow hero-eyebrow">Sistema Inteligente de Gestión Académica</div>
              <div className="hero-badge">
                <span className="ping-dot"><span className="ping-dot-ring" /><span className="ping-dot-core" /></span>
                En operación real en centros educativos colombianos
              </div>
              <h1 className="hero-title">
                El sistema de gestión académica que <span className="font-display">piensa</span><br className="br-desktop" /> por su institución.
              </h1>
              <p className="hero-subtitle">
                Playfesor unifica a alumnos, padres y docentes en un ecosistema de alta eficiencia, donde la IA garantiza la oportunidad de éxito y la confiabilidad absoluta en cada decisión.
              </p>
              <div className="hero-actions">
                <a href="#demo" className="btn btn-navy btn-lg">Solicitar demo para mi institución <span aria-hidden>→</span></a>
                <Link to="/login" className="btn btn-outline btn-lg">Ingresar al sistema</Link>
              </div>
              <p className="hero-fineprint">Escala de valoración MEN · Boletines oficiales · WhatsApp a padres incluido</p>
            </div>

            <Reveal delay={150} className="hero-mockup-wrap">
              <HeroMockup />
            </Reveal>
          </div>
        </section>

        {/* Apuestas estratégicas */}
        <section className="section section-muted" id="apuestas">
          <div className="section-inner">
            <Reveal className="section-head">
              <div className="eyebrow">Hacia dónde vamos</div>
              <h2 className="h2">Seis apuestas que van a redefinir la <span className="font-display">gestión académica</span> en Colombia.</h2>
              <p className="section-lead">Mientras otros planean el futuro, Playfesor lo hace realidad hoy. Al centralizar su historia académica, construye un activo digital de máxima confiabilidad: entre más datos gestiona, más precisa es nuestra IA para detectar oportunidades de éxito y elevar la efectividad de su institución.</p>
            </Reveal>

            <div className="apuestas-grid">
              {apuestas.map((a, idx) => (
                <Reveal as="article" delay={idx * 60} className={`apuesta-card apuesta-${a.size}`} key={a.n}>
                  <div className="apuesta-content">
                    <div className="apuesta-head">
                      <span className="apuesta-n">Apuesta {a.n}</span>
                      <span className="apuesta-icon-wrap">{a.icon}</span>
                    </div>
                    <div className="apuesta-tag">{a.tag}</div>
                    <h3 className="apuesta-title">{a.title}</h3>
                    <p className="apuesta-body">{a.body}</p>

                    {a.stats && (
                      <div className="apuesta-stats">
                        {a.stats.map(([v, l]) => (
                          <div className="apuesta-stat" key={l}>
                            <span className="apuesta-stat-v">{v}</span>
                            <span className="apuesta-stat-l">{l}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="apuesta-edge">
                      {a.rivals.map((r) => (
                        <span className="apuesta-edge-chip is-rival" key={r}>✕ {r}</span>
                      ))}
                      <span className="apuesta-edge-chip is-playfesor">✓ Playfesor</span>
                    </div>
                  </div>

                  {a.widget && <div className="apuesta-widget">{a.widget}</div>}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section" id="plataforma">
          <div className="section-inner">
            <Reveal className="section-head">
              <div className="eyebrow">Todo lo que un centro educativo necesita</div>
              <h2 className="h2">Un sistema. Todos los procesos.</h2>
              <p className="section-lead">El sistema inteligente de gestión académica diseñado específicamente para el sistema educativo colombiano — no un producto genérico traducido.</p>
            </Reveal>

            <div className="feature-groups">
              {featureGroups.map((g, gi) => (
                <div className="feature-group" key={g.tag}>
                  <Reveal className="feature-group-head">
                    <div className="feature-group-tag">0{gi + 1} · {g.tag}</div>
                    <h3 className="h3">{g.title}</h3>
                  </Reveal>
                  <Reveal delay={100} className="feature-group-list">
                    {g.items.map((it) => (
                      <div className="feature-item" key={it}>
                        <span className="feature-item-check"><CheckIcon /></span>
                        <span>{it}</span>
                      </div>
                    ))}
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Section */}
        <section className="ai-section" id="ia">
          <div className="ai-dot-bg" aria-hidden="true" />
          <div className="ai-glow" aria-hidden="true" />
          <div className="section-inner">
            <Reveal className="section-head">
              <div className="eyebrow eyebrow-light">Inteligencia artificial · ya en producción</div>
              <h2 className="h2 h2-light">El primer sistema inteligente de gestión académica en Colombia con <span className="font-display font-display-light">IA que decide</span>, no que promete.</h2>
              <p className="section-lead section-lead-light">Ningún otro sistema de gestión académica en Colombia tiene esto hoy. Playfesor sí — y funciona en centros educativos reales.</p>
            </Reveal>

            <div className="ai-grid">
              {aiCapabilities.map((c, i) => (
                <Reveal as="div" delay={i * 60} className="ai-card" style={{ gridColumn: `span ${c.span}` }} key={c.name}>
                  <div className="ai-card-demo">{c.demo}</div>
                  <div className="ai-card-title">{c.name}</div>
                  <div className="ai-card-desc">{c.desc}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Capacidades */}
        <section className="section section-muted" id="capacidades">
          <div className="section-inner">
            <Reveal className="section-head">
              <div className="eyebrow">Capacidades</div>
              <h2 className="h2">Un sistema inteligente de gestión académica, completo desde el primer día.</h2>
            </Reveal>

            <Reveal className="capability-card">
              <div className="capability-grid">
                {capabilities.map((label) => (
                  <div className="capability-item" key={label}>
                    <span className="capability-check"><CheckIcon /></span>
                    {label}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Testimonial */}
        <section className="section">
          <div className="section-inner section-inner-narrow">
            <Reveal>
              <blockquote className="quote">“Antes descubríamos al estudiante en riesgo cuando ya era tarde. Con Playfesor lo vemos en septiembre — y hacemos algo al respecto.”</blockquote>
              <div className="quote-author">
                <div className="quote-avatar" />
                <div>
                  <div className="quote-name">Rectoría · Institución piloto</div>
                  <div className="quote-loc">Bogotá, Colombia</div>
                </div>
              </div>
            </Reveal>

            <div className="stats-grid">
              {testimonialStats.map(([k, v]) => (
                <div key={k} className="stats-cell">
                  <div className="stats-k">{k}</div>
                  <div className="stats-v">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="section-inner faq-layout">
            <Reveal className="faq-head">
              <div className="eyebrow">Preguntas frecuentes</div>
              <h2 className="h2">Lo que los rectores nos preguntan.</h2>
              <p className="section-lead">¿Otra pregunta específica sobre su institución? Agenda una demo y la resolvemos en vivo.</p>
            </Reveal>

            <div className="faq-list">
              {faqs.map((f, i) => (
                <Reveal as="details" delay={i * 40} className="faq-item" key={f.q}>
                  <summary>{f.q}<span className="faq-plus">+</span></summary>
                  <p>{f.a}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* CTA */}
      <section className="section" id="demo">
        <div className="section-inner">
          <Reveal className="cta-card">
            <div className="cta-grid-bg" aria-hidden="true" />
            <div className="cta-glow" aria-hidden="true" />
            <div className="cta-content">
              <div className="eyebrow eyebrow-light">Demo para su institución</div>
              <h2 className="h2 h2-light">Vea Playfesor con los <span className="font-display font-display-light">datos reales</span> de su institución en 30 minutos.</h2>
              <p className="section-lead section-lead-light">Le mostramos cómo se vería su institución dentro de Playfesor — grupos, boletines, WhatsApp a padres, riesgo predictivo. Sin compromiso.</p>
              <div className="hero-actions">
                <a href="mailto:demo@playfesor.co?subject=Solicitud%20de%20demo%20Playfesor" className="btn btn-white btn-lg">Solicitar demo <span aria-hidden>→</span></a>
                <Link to="/login" className="btn btn-outline-light btn-lg">Ya soy usuario · Ingresar</Link>
              </div>
              <div className="cta-fineprint">
                <span>✓ Migración de datos incluida</span>
                <span>✓ Capacitación al equipo docente</span>
                <span>✓ Soporte en español, en Colombia</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="section-inner">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src="/logo-icon.png" alt="Playfesor" className="lp-brand-icon" />
              <p>Sistema Inteligente de Gestión Académica para centros educativos en Colombia.</p>
            </div>
            <div>
              <div className="footer-title">Producto</div>
              <ul>
                <li><a href="#plataforma">Plataforma</a></li>
                <li><a href="#ia">Inteligencia artificial</a></li>
                <li><a href="#capacidades">Capacidades</a></li>
                <li><Link to="/login">Ingresar</Link></li>
              </ul>
            </div>
            <div>
              <div className="footer-title">Contacto</div>
              <ul>
                <li><a href="mailto:demo@playfesor.co">demo@playfesor.co</a></li>
                <li><a href="#demo">Solicitar demo</a></li>
                <li>Medellín, Colombia</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <div>© {new Date().getFullYear()} Playfesor. Todos los derechos reservados.</div>
            <div>Diseñado para el sistema educativo colombiano.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles = `
  :root { color-scheme: light; }
  html { scroll-behavior: smooth; }
  * { box-sizing: border-box; }

  .landing-page {
    --bg: #fbfaf7;
    --ink: #010a20;
    --foreground: #06132a;
    --card: #ffffff;
    --secondary: #eef2f7;
    --muted-fg: #535e6f;
    --border: #d8dfe7;
    --brand-blue: #2981fb;
    --brand-navy: #02183f;
    --radius-lg: 22px;

    min-height: 100vh;
    background: var(--bg);
    color: var(--foreground);
    font-family: 'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  .landing-page h1, .landing-page h2, .landing-page h3 { letter-spacing: -0.02em; }

  .font-display {
    font-family: 'Instrument Serif', Georgia, serif;
    font-style: italic;
    font-weight: 400;
    color: var(--brand-blue);
  }
  .font-display-light { color: rgba(255,255,255,0.92); }

  /* Nav */
  .lp-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(251,250,247,0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
  }
  .lp-nav-inner {
    max-width: 1200px; margin: 0 auto; padding: 0 24px;
    height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .lp-brand { display: flex; align-items: center; gap: 9px; color: var(--ink); text-decoration: none; font-weight: 700; font-size: 1.05rem; }
  .lp-brand-icon { width: 28px; height: 28px; object-fit: contain; }
  .lp-nav-links { display: flex; gap: 32px; }
  .lp-nav-links a { color: var(--muted-fg); text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
  .lp-nav-links a:hover { color: var(--ink); }
  .lp-nav-actions { display: flex; align-items: center; gap: 8px; }
  .lp-nav-login { color: rgba(6,19,42,0.8); text-decoration: none; font-size: 0.9rem; font-weight: 500; padding: 8px 12px; border-radius: 999px; transition: color 0.2s; }
  .lp-nav-login:hover { color: var(--ink); }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border-radius: 999px; font-weight: 600; text-decoration: none; white-space: nowrap;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }
  .btn-lg { padding: 14px 26px; font-size: 0.92rem; }
  .btn-sm { padding: 9px 17px; font-size: 0.85rem; }
  .btn-navy { background: var(--brand-navy); color: #fff; box-shadow: 0 10px 24px rgba(2,24,63,0.18); }
  .btn-navy:hover { box-shadow: 0 14px 30px rgba(2,24,63,0.26); transform: translateY(-1px); }
  .btn-outline { background: var(--card); color: var(--foreground); border: 1px solid var(--border); }
  .btn-outline:hover { background: var(--secondary); }
  .btn-white { background: #fff; color: var(--brand-navy); box-shadow: 0 10px 24px rgba(0,0,0,0.18); }
  .btn-white:hover { transform: translateY(-1px); }
  .btn-outline-light { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.24); }
  .btn-outline-light:hover { background: rgba(255,255,255,0.1); }

  /* Layout helpers */
  .section { padding: 96px 0; }
  .section-muted { background: var(--secondary); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .section-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .section-inner-narrow { max-width: 860px; }
  .section-head { max-width: 720px; margin-bottom: 56px; }
  .eyebrow { font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--brand-blue); }
  .eyebrow-light { color: rgba(255,255,255,0.7); }
  .h2 { font-size: clamp(1.9rem, 3.4vw, 3rem); line-height: 1.08; margin-top: 12px; color: var(--ink); }
  .h2-light { color: #fff; }
  .h3 { font-size: 1.7rem; margin-top: 14px; color: var(--ink); }
  .section-lead { margin-top: 18px; max-width: 640px; font-size: 1.1rem; color: var(--muted-fg); line-height: 1.6; }
  .section-lead-light { color: rgba(255,255,255,0.7); }
  .fine-note { margin-top: 16px; font-size: 0.8rem; color: var(--muted-fg); }
  .check-icon { width: 13px; height: 13px; }

  /* Hero */
  .hero-section { position: relative; overflow: hidden; }
  .hero-grid-bg {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(6,19,42,0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(6,19,42,0.05) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse at center, black 25%, transparent 72%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 25%, transparent 72%);
  }
  .hero-glow {
    position: absolute; top: -160px; left: 50%; transform: translateX(-50%);
    width: 900px; height: 520px; border-radius: 999px;
    background: rgba(41,129,251,0.22); filter: blur(120px); pointer-events: none;
  }
  .hero-inner { position: relative; max-width: 1200px; margin: 0 auto; padding: 88px 24px 0; }
  .hero-copy { max-width: 780px; margin: 0 auto; text-align: center; }
  .hero-eyebrow { display: block; margin-bottom: 14px; }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px;
    border: 1px solid var(--border); background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
    border-radius: 999px; padding: 7px 14px; font-size: 0.78rem; font-weight: 500; color: var(--muted-fg);
  }
  .ping-dot { position: relative; display: inline-flex; width: 8px; height: 8px; }
  .ping-dot-ring { position: absolute; inset: 0; border-radius: 50%; background: var(--brand-blue); opacity: 0.5; animation: ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
  .ping-dot-core { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--brand-blue); }
  @keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }

  .hero-title { font-size: clamp(2.4rem, 5.6vw, 4.6rem); line-height: 1.03; color: var(--ink); }
  .br-desktop { display: none; }
  .hero-subtitle { margin: 26px auto 0; max-width: 620px; font-size: clamp(1rem, 1.4vw, 1.2rem); color: var(--muted-fg); line-height: 1.65; }
  .hero-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin-top: 34px; }
  .hero-fineprint { margin-top: 18px; font-size: 0.78rem; color: var(--muted-fg); }

  .hero-mockup-wrap { position: relative; max-width: 1080px; margin: 60px auto 0; }
  .mockup-frame { position: relative; border-radius: 26px; border: 1px solid var(--border); background: var(--card); padding: 10px; box-shadow: 0 40px 90px rgba(2,24,63,0.14); }
  .mockup-window { border-radius: 18px; overflow: hidden; border: 1px solid var(--border); background: var(--bg); }
  .mockup-titlebar { display: flex; align-items: center; gap: 6px; padding: 12px 16px; background: rgba(238,242,247,0.7); border-bottom: 1px solid var(--border); }
  .mockup-titlebar span { width: 9px; height: 9px; border-radius: 50%; background: var(--border); }
  .mockup-path { margin-left: 10px; flex: 1; font-size: 0.72rem; color: var(--muted-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mockup-body { display: grid; grid-template-columns: 190px 1fr; gap: 16px; padding: 18px; }
  .mockup-sidebar { display: flex; flex-direction: column; gap: 4px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); padding: 10px; }
  .mockup-sidebar-item { padding: 8px 10px; border-radius: 8px; font-size: 0.75rem; color: var(--muted-fg); }
  .mockup-sidebar-item.is-active { background: var(--brand-navy); color: #fff; }
  .mockup-main { display: flex; flex-direction: column; gap: 14px; }
  .mockup-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .mockup-metric-card { border-radius: 10px; border: 1px solid var(--border); background: var(--card); padding: 14px; }
  .mockup-metric-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-fg); }
  .mockup-metric-value { margin-top: 4px; font-size: 1.5rem; font-weight: 700; color: var(--ink); }
  .mockup-metric-trend { margin-top: 4px; font-size: 0.7rem; color: var(--muted-fg); }
  .mockup-split { display: grid; grid-template-columns: 3fr 2fr; gap: 14px; }
  .mockup-chart-card, .mockup-copilot-card { border-radius: 10px; border: 1px solid var(--border); padding: 16px; }
  .mockup-chart-card { background: var(--card); }
  .mockup-chart-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: var(--ink); }
  .mockup-chart-time { font-size: 0.65rem; font-weight: 500; text-transform: uppercase; color: var(--muted-fg); }
  .mockup-chart-bars { margin-top: 16px; display: flex; align-items: flex-end; gap: 5px; height: 130px; }
  .mockup-bar { flex: 1; border-radius: 3px 3px 0 0; }
  .mockup-bar.is-high { background: var(--brand-blue); }
  .mockup-bar.is-mid { background: rgba(41,129,251,0.55); }
  .mockup-bar.is-low { background: rgba(41,129,251,0.22); }
  .mockup-chart-labels { margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--muted-fg); }
  .mockup-copilot-card { background: linear-gradient(160deg, var(--brand-navy), #061a3d); color: #fff; display: flex; flex-direction: column; }
  .mockup-copilot-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.6); }
  .mockup-copilot-q { margin-top: 10px; border-radius: 8px; background: rgba(255,255,255,0.1); padding: 9px; font-size: 0.72rem; }
  .mockup-copilot-a { margin-top: 8px; border-radius: 8px; background: rgba(255,255,255,0.05); padding: 9px; font-size: 0.72rem; line-height: 1.5; color: rgba(255,255,255,0.9); }
  .mockup-copilot-foot { margin-top: auto; padding-top: 10px; font-size: 0.62rem; color: rgba(255,255,255,0.5); }

  /* Apuestas estratégicas */
  .apuestas-grid { margin-top: 40px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; }
  .apuesta-card {
    display: flex; flex-direction: column; border-radius: var(--radius-lg); border: 1px solid var(--border);
    background: var(--card); padding: 30px; transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .apuesta-card:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(2,24,63,0.08); }
  .apuesta-content { display: flex; flex-direction: column; flex: 1; }
  .apuesta-lg { grid-column: span 4; }
  .apuesta-md { grid-column: span 2; }
  .apuesta-sm { grid-column: span 2; }
  .apuesta-xl { grid-column: span 6; flex-direction: row; align-items: center; gap: 40px; }
  .apuesta-xl .apuesta-content { flex: 1.1; }
  .apuesta-xl .apuesta-widget { flex: 1; margin-top: 0; }

  .apuesta-head { display: flex; align-items: center; justify-content: space-between; }
  .apuesta-n { font-family: monospace; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; color: var(--muted-fg); text-transform: uppercase; }
  .apuesta-icon-wrap { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: rgba(41,129,251,0.12); color: var(--brand-blue); flex-shrink: 0; }
  .apuesta-icon { width: 19px; height: 19px; }
  .apuesta-tag { margin-top: 20px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--brand-blue); }
  .apuesta-title { margin-top: 8px; font-size: 1.22rem; line-height: 1.32; color: var(--ink); }
  .apuesta-lg .apuesta-title, .apuesta-xl .apuesta-title { font-size: 1.5rem; }
  .apuesta-body { margin-top: 10px; font-size: 0.9rem; color: var(--muted-fg); line-height: 1.6; flex: 1; }

  .apuesta-stats { margin-top: 22px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding-top: 18px; border-top: 1px solid var(--border); }
  .apuesta-stat-v { display: block; font-size: 1.15rem; font-weight: 700; color: var(--ink); }
  .apuesta-stat-l { display: block; margin-top: 2px; font-size: 0.68rem; color: var(--muted-fg); line-height: 1.3; }

  .apuesta-edge { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 6px; }
  .apuesta-edge-chip { font-size: 0.68rem; font-weight: 600; padding: 5px 10px; border-radius: 999px; }
  .apuesta-edge-chip.is-rival { background: var(--secondary); color: var(--muted-fg); }
  .apuesta-edge-chip.is-playfesor { background: var(--brand-navy); color: #fff; }

  .gemelo-widget { flex: 1; border-radius: 14px; border: 1px solid var(--border); background: var(--secondary); padding: 20px; }
  .gemelo-grades { display: flex; gap: 8px; flex-wrap: wrap; }
  .gemelo-grade { flex: 1; min-width: 56px; border-radius: 10px; padding: 10px 8px; text-align: center; background: var(--card); border: 1px solid var(--border); }
  .gemelo-grade-name { display: block; font-size: 0.68rem; color: var(--muted-fg); font-weight: 600; }
  .gemelo-grade-avg { display: block; margin-top: 4px; font-size: 1rem; font-weight: 700; color: var(--ink); }
  .gemelo-grade.is-ok { box-shadow: inset 0 0 0 1px rgba(34,197,94,0.35); }
  .gemelo-grade.is-ok .gemelo-grade-avg { color: #16a34a; }
  .gemelo-grade.is-warn { box-shadow: inset 0 0 0 1px rgba(217,119,6,0.35); }
  .gemelo-grade.is-warn .gemelo-grade-avg { color: #d97706; }
  .gemelo-grade.is-crit { box-shadow: inset 0 0 0 1px rgba(220,38,38,0.4); }
  .gemelo-grade.is-crit .gemelo-grade-avg { color: #dc2626; }
  .gemelo-projection { margin-top: 16px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--muted-fg); line-height: 1.4; }
  .gemelo-projection-arrow { color: var(--brand-blue); font-size: 1.1rem; }
  .gemelo-projection-n { font-weight: 700; color: var(--ink); font-size: 1rem; }
  .gemelo-projection-n.is-good { color: #16a34a; }

  /* Features */
  .feature-groups { margin-top: 48px; display: flex; flex-direction: column; gap: 56px; }
  .feature-group { display: grid; grid-template-columns: 5fr 7fr; gap: 40px; padding-top: 36px; border-top: 1px solid var(--border); }
  .feature-group-tag { font-family: monospace; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--brand-blue); }
  .feature-group-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-content: start; }
  .feature-item { display: flex; gap: 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--card); padding: 14px; font-size: 0.88rem; color: var(--foreground); }
  .feature-item-check { flex-shrink: 0; margin-top: 2px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: rgba(41,129,251,0.14); color: var(--brand-blue); }

  /* AI section */
  .ai-section { position: relative; overflow: hidden; background: var(--brand-navy); color: #fff; }
  .ai-dot-bg { position: absolute; inset: 0; opacity: 0.35; background-image: radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px); background-size: 22px 22px; }
  .ai-glow { position: absolute; right: -80px; top: 30%; width: 380px; height: 380px; border-radius: 999px; background: rgba(41,129,251,0.4); filter: blur(120px); }
  .ai-grid { position: relative; margin-top: 48px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px; }
  .ai-card { border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); backdrop-filter: blur(8px); padding: 24px; transition: background 0.2s; }
  .ai-card:hover { background: rgba(255,255,255,0.06); }
  .ai-card-demo { height: 160px; overflow: hidden; border-radius: 10px; background: rgba(255,255,255,0.03); padding: 14px; margin-bottom: 18px; }
  .ai-card-title { font-size: 1.1rem; font-weight: 600; color: #fff; }
  .ai-card-desc { margin-top: 8px; font-size: 0.85rem; color: rgba(255,255,255,0.6); line-height: 1.5; }

  .demo-risk { display: flex; flex-direction: column; gap: 8px; font-family: monospace; font-size: 0.68rem; }
  .demo-risk-row { display: flex; align-items: center; gap: 10px; }
  .demo-risk-name { width: 108px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.6); }
  .demo-risk-track { flex: 1; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.1); overflow: hidden; }
  .demo-risk-fill { height: 100%; }
  .demo-risk-alto { background: var(--brand-blue); }
  .demo-risk-medio { background: rgba(41,129,251,0.6); }
  .demo-risk-bajo { background: rgba(41,129,251,0.25); }
  .demo-risk-pct { width: 30px; text-align: right; color: #fff; }

  .demo-chat { display: flex; flex-direction: column; gap: 10px; font-size: 0.72rem; }
  .demo-bubble { max-width: 88%; padding: 9px 12px; border-radius: 14px; line-height: 1.4; }
  .demo-bubble-q { margin-left: auto; background: var(--brand-navy); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-bottom-right-radius: 3px; }
  .demo-bubble-a { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.92); border-bottom-left-radius: 3px; }
  .demo-bubble-left { margin-right: auto; }
  .demo-bubble-muted { margin-left: auto; max-width: 65%; background: rgba(255,255,255,0.1); border-bottom-right-radius: 3px; color: #fff; }

  .demo-observador { font-size: 0.7rem; line-height: 1.6; color: rgba(255,255,255,0.7); }
  .demo-observador-head { display: flex; justify-content: space-between; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.62rem; color: var(--brand-blue); margin-bottom: 8px; }
  .demo-observador strong { color: #fff; }

  .demo-plan { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.7rem; color: rgba(255,255,255,0.7); }
  .demo-plan li { display: flex; align-items: center; gap: 8px; }
  .demo-plan-index { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); font-size: 0.6rem; color: var(--brand-blue); }

  /* Capacidades */
  .capability-card { margin-top: 40px; border-radius: var(--radius-lg); border: 1px solid var(--border); background: var(--card); padding: 10px; }
  .capability-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px; }
  .capability-item { display: flex; align-items: center; gap: 14px; padding: 18px 22px; border-radius: 14px; font-size: 0.95rem; color: var(--foreground); transition: background 0.2s; }
  .capability-item:hover { background: var(--secondary); }
  .capability-check { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(41,129,251,0.14); color: var(--brand-blue); }

  /* Testimonial */
  .quote { text-align: center; font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: clamp(1.5rem, 3vw, 2.4rem); line-height: 1.25; color: var(--ink); }
  .quote-author { margin-top: 28px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 0.88rem; color: var(--muted-fg); }
  .quote-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--brand-blue), var(--brand-navy)); }
  .quote-name { font-weight: 600; color: var(--foreground); }
  .stats-grid { margin-top: 64px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px 16px; padding-top: 40px; border-top: 1px solid var(--border); text-align: center; }
  .stats-k { font-size: 1.6rem; font-weight: 700; color: var(--ink); }
  .stats-v { margin-top: 4px; font-size: 0.72rem; color: var(--muted-fg); }

  /* FAQ */
  .faq-layout { display: grid; grid-template-columns: 4fr 8fr; gap: 56px; }
  .faq-list { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .faq-item { padding: 22px 0; border-bottom: 1px solid var(--border); }
  .faq-item:last-child { border-bottom: none; }
  .faq-item summary { list-style: none; cursor: pointer; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; font-size: 1.05rem; font-weight: 500; color: var(--ink); }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-plus { font-size: 1.4rem; line-height: 1; color: var(--muted-fg); transition: transform 0.2s; }
  .faq-item[open] .faq-plus { transform: rotate(45deg); }
  .faq-item p { margin-top: 10px; max-width: 620px; color: var(--muted-fg); line-height: 1.6; }

  /* CTA */
  .cta-card { position: relative; overflow: hidden; border-radius: 30px; background: var(--brand-navy); padding: 64px 40px; color: #fff; }
  .cta-grid-bg { position: absolute; inset: 0; opacity: 0.15; background-image: linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px); background-size: 56px 56px; }
  .cta-glow { position: absolute; right: -100px; top: -100px; width: 380px; height: 380px; border-radius: 999px; background: rgba(41,129,251,0.4); filter: blur(120px); }
  .cta-content { position: relative; max-width: 720px; }
  .cta-fineprint { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px 28px; font-size: 0.78rem; color: rgba(255,255,255,0.6); }

  /* Footer */
  .lp-footer { border-top: 1px solid var(--border); background: var(--secondary); }
  .footer-grid { padding: 56px 0 0; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 40px; }
  .footer-brand p { margin-top: 14px; max-width: 260px; font-size: 0.88rem; color: var(--muted-fg); }
  .footer-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--foreground); }
  .footer-grid ul { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem; }
  .footer-grid a { color: var(--muted-fg); text-decoration: none; }
  .footer-grid a:hover { color: var(--foreground); }
  .footer-bottom { margin-top: 48px; padding: 24px 0; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; font-size: 0.76rem; color: var(--muted-fg); }

  /* Reveal */
  .reveal { opacity: 0; transform: translateY(22px); transition: opacity 0.6s ease, transform 0.6s ease; }
  .reveal.is-visible { opacity: 1; transform: translateY(0); }

  @media (max-width: 1024px) {
    .feature-group { grid-template-columns: 1fr; }
    .faq-layout { grid-template-columns: 1fr; }
    .mockup-sidebar { display: none; }
    .mockup-body { grid-template-columns: 1fr; }
  }

  @media (max-width: 900px) {
    .br-desktop { display: block; }
    .lp-nav-links { display: none; }
    .apuestas-grid { grid-template-columns: 1fr 1fr; }
    .apuesta-lg, .apuesta-md, .apuesta-sm { grid-column: span 1; }
    .apuesta-xl { grid-column: span 2; flex-direction: column; align-items: stretch; }
    .feature-group-list { grid-template-columns: 1fr; }
    .ai-grid { grid-template-columns: 1fr 1fr; }
    .ai-card { grid-column: span 1 !important; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
    .footer-grid { grid-template-columns: 1fr 1fr; }
    .mockup-split { grid-template-columns: 1fr; }
    .capability-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 640px) {
    .section { padding: 64px 0; }
    .apuestas-grid { grid-template-columns: 1fr; }
    .apuesta-xl { grid-column: span 1; }
    .hero-actions, .cta-content .hero-actions { flex-direction: column; align-items: stretch; }
    .hero-actions .btn, .cta-content .btn { width: 100%; }
    .footer-grid { grid-template-columns: 1fr; }
    .cta-card { padding: 40px 22px; }
  }
`;
