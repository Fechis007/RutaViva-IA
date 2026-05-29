import React, { useState, useEffect, useRef } from 'react';
import './index.css';

// Seteamos la API KEY que creaste en el archivo .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Función segura y limpia para llamar a Google Gemini
async function llamarAGeminiIA(imageBase64) {
  const limpioBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + API_KEY;

  const instruccionIA = 'Analiza la imagen de Tijuana. Detecta obstaculos de movilidad urbana. Devuelve solo un objeto JSON con este formato: {"type": "Rampa Inexistente", "severity": "red", "severityLabel": "Critico", "descripcion": "resumen de una linea"}. Usa exactamente "Rampa Inexistente", "Banqueta Danada", "Vehiculo Obstruyendo" o "Semaforo Averiado" para el type. Usa "red", "amber" o "green" para la severity.';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: instruccionIA },
          { inlineData: { mimeType: 'image/jpeg', data: limpioBase64 } }
        ]
      }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    throw new Error('Error de conexion');
  }

  const data = await response.json();
  const textoJson = data.candidates[0].content.parts[0].text;
  return JSON.parse(textoJson.trim());
}

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80&w=400';

const INITIAL_REPORTS = [
  { id: 1, type: 'Rampa Inexistente', severity: 'red', severityLabel: 'Crítico', location: 'Zona Centro, Tijuana', time: 'Hace 3 min', votes: 28, image: PLACEHOLDER_IMG, descripcion: 'Falta rampa de acceso en esquina principal.' },
  { id: 2, type: 'Banqueta Dañada', severity: 'amber', severityLabel: 'Precaución', location: 'Av. Revolución, Tijuana', time: 'Hace 15 min', votes: 12, image: 'https://images.unsplash.com/photo-1584464457692-75d8d4c98e16?auto=format&fit=crop&q=80&w=400', descripcion: 'Grietas profundas impiden el paso seguro.' },
  { id: 3, type: 'Paso Peatonal Reparado', severity: 'green', severityLabel: 'Resuelto', location: 'Calle 3ª, Tijuana', time: 'Hace 47 min', votes: 5, image: 'https://images.unsplash.com/photo-1558000143-a6750dc39906?auto=format&fit=crop&q=80&w=400', descripcion: 'Pintura y acceso renovados por el ayuntamiento.' },
];

function App() {
  // --- ESTADOS DE LAS RUTAS E INTERFAZ ---
  const [currentRouteIndex, setCurrentRouteIndex] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('map');
  const [activeRoute, setActiveRoute] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const [reportStep, setReportStep] = useState('camera');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [aiData, setAiData] = useState({
    type: 'Rampa Inexistente',
    severity: 'red',
    severityLabel: 'Crítico',
    descripcion: ''
  });

  const [reports, setReports] = useState(INITIAL_REPORTS);
  const fileInputRef = useRef(null);

  // 🗺️ Coordenadas ficticias en pantalla para simular los trazos sobre OpenStreetMap
  const rutasAlternativas = [
    {
      nombre: "Ruta 1: Evitando Bloqueo en Av. Revolución",
      color: "#1CC0F3",
      detalles: "🤖 Gemini desvió la ruta por Calle 4ta debido a banquetas destruidas en la Revu."
    },
    {
      nombre: "Ruta 2: Conectando Zona Río Segura",
      color: "#10b981",
      detalles: "🤖 Alerta de rampa inexistente en Vía Rápida. Trayectoria corregida por Paseo de los Héroes."
    },
    {
      nombre: "Ruta 3: Acceso Libre a Línea Internacional",
      color: "#a855f7",
      detalles: "🤖 Ruta optimizada hacia la Garita de San Ysidro evadiendo obras en la línea."
    },
    {
      nombre: "Ruta 4: Cruce Accesible por Blvd. Agua Caliente",
      color: "#f59e0b",
      detalles: "🤖 Desvío activo en Blvd. Cuauhtémoc por semáforo peatonal auditivo averiado."
    },
    {
      nombre: "Ruta 5: Alternativa Inclusiva Zona Centro",
      color: "#ec4899",
      detalles: "🤖 Escaneo de telemetría completado. Usando calles con rampas 100% operativas."
    }
  ];

  const generarRutaAleatoria = () => {
    const randomIndex = Math.floor(Math.random() * rutasAlternativas.length);
    setCurrentRouteIndex(randomIndex);
    setActiveRoute(true);

    //ESTO ACTUALIZA LOS TEXTBOX EN CALIENTE DEPENDIENDO DE LA RUTA SELECCIONADA
    if (randomIndex === 0) {
      setOrigin('📍 Blvd. Fundadores');
      setDestination('🏁 Av. Revolución (Desvío Calle 4ta)');
    } else if (randomIndex === 1) {
      setOrigin('📍 Vía Rápida Poniente');
      setDestination('🏁 Paseo de los Héroes (Zona Río Segura)');
    } else if (randomIndex === 2) {
      setOrigin('📍 Calle 3ª (Centro)');
      setDestination('🏁 Garita de San Ysidro (Línea Libre)');
    } else if (randomIndex === 3) {
      setOrigin('📍 Blvd. Cuauhtémoc Sur');
      setDestination('🏁 Blvd. Agua Caliente (Accesible)');
    } else if (randomIndex === 4) {
      setOrigin('📍 Calle Posada (Zona Centro)');
      setDestination('🏁 Av. Negrete (Rampas Operativas)');
    }
  };

  const convertoToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const analizarImagenConGemini = async (base64Img) => {
    setReportStep('analyzing');
    try {
      const resultadoIA = await llamarAGeminiIA(base64Img);
      setAiData({
        type: resultadoIA.type || 'Rampa Inexistente',
        severity: resultadoIA.severity || 'red',
        severityLabel: resultadoIA.severityLabel || 'Crítico',
        descripcion: resultadoIA.descripcion || 'Detectado por telemetría automática.'
      });
      setReportStep('results');
    } catch (error) {
      console.error('Fallo Gemini:', error);
      setAiData({
        type: 'Banqueta Dañada',
        severity: 'amber',
        severityLabel: 'Precaución',
        descripcion: 'Obstáculo analizado en Zona Centro (Modo Respaldo).'
      });
      setReportStep('results');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedImage(URL.createObjectURL(file));
      try {
        const base64 = await convertoToBase64(file);
        await analizarImagenConGemini(base64);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const simulateCapture = () => {
    setUploadedImage(PLACEHOLDER_IMG);
    setReportStep('analyzing');
    setTimeout(() => {
      setAiData({
        type: 'Rampa Inexistente',
        severity: 'red',
        severityLabel: 'Crítico',
        descripcion: 'Esquina bloqueada por falta de infraestructura incluyente en Tijuana.'
      });
      setReportStep('results');
    }, 2000);
  };

  const publishReport = () => {
    const newReport = {
      id: Date.now(),
      type: aiData.type,
      severity: aiData.severity,
      severityLabel: aiData.severityLabel,
      location: 'Zona Centro, Tijuana',
      time: 'Hace 1 min',
      votes: 0,
      image: uploadedImage || PLACEHOLDER_IMG,
      descripcion: aiData.descripcion
    };
    setReports(prev => [newReport, ...prev]);
    setReportStep('published');
  };

  return (
    <div className="app-container">
      <nav className="nav-bar">
        <div className="logo-area">
          <div className="logo-title">RutaViva</div>
          <div className="logo-tagline">Movilidad Inteligente</div>
        </div>
        <button className={`nav-item ${currentScreen === 'map' ? 'active' : ''}`} onClick={() => setCurrentScreen('map')}>
          <span className="icon">🗺️</span>
          <span className="label">Mapa</span>
        </button>
        <button className={`nav-item ${currentScreen === 'report' ? 'active' : ''}`} onClick={() => { setCurrentScreen('report'); setReportStep('camera'); setUploadedImage(null); }}>
          <span className="icon">📷</span>
          <span className="label">Reportar</span>
        </button>
        <button className={`nav-item ${currentScreen === 'community' ? 'active' : ''}`} onClick={() => setCurrentScreen('community')}>
          <span className="icon">🏘️</span>
          <span className="label">Comunidad</span>
        </button>
      </nav>

      <main className="content-area">
        {currentScreen === 'map' && (
          <div className="map-screen" style={{ position: 'relative', height: '100%', width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0c1033' }}>
            
            {/* 🗺️ CONTAINER INDEPENDIENTE PARA EL MAPA ABSOLUTO */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
              <iframe 
                title="Mapa de Tijuana"
                width="100%" 
                height="100%" 
                style={{ border: 0 }}
                src="https://www.openstreetmap.org/export/embed.html?bbox=-117.0600%2C32.5000%2C-116.9900%2C32.5400&amp;layer=mapnik"
              ></iframe>
            </div>

            {/* ⚡ CAPA SVG PARA LAS RUTAS ANIMADAS */}
            {activeRoute && currentRouteIndex !== null && (
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                {currentRouteIndex === 0 && <path d="M 150 450 Q 250 300 400 380 T 650 200" stroke="#1CC0F3" strokeWidth="6" fill="none" strokeDasharray="12,6" style={{ animation: 'dash 2s linear infinite' }} />}
                {currentRouteIndex === 1 && <path d="M 120 250 Q 300 150 450 280 T 750 350" stroke="#10b981" strokeWidth="6" fill="none" strokeDasharray="12,6" style={{ animation: 'dash 2s linear infinite' }} />}
                {currentRouteIndex === 2 && <path d="M 200 500 Q 150 350 400 200 T 550 100" stroke="#a855f7" strokeWidth="6" fill="none" strokeDasharray="12,6" style={{ animation: 'dash 2s linear infinite' }} />}
                {currentRouteIndex === 3 && <path d="M 50 150 Q 250 180 500 120 T 700 400" stroke="#f59e0b" strokeWidth="6" fill="none" strokeDasharray="12,6" style={{ animation: 'dash 2s linear infinite' }} />}
                {currentRouteIndex === 4 && <path d="M 300 450 Q 400 300 550 350 T 650 180" stroke="#ec4899" strokeWidth="6" fill="none" strokeDasharray="12,6" style={{ animation: 'dash 2s linear infinite' }} />}
                <style>{`@keyframes dash { to { stroke-dashoffset: -30; } }`}</style>
              </svg>
            )}

            {/* 🔽 PANEL INTELIGENTE COLAPSABLE */}
            <div className="map-panel" style={{ 
              zIndex: 10, 
              maxHeight: isPanelOpen ? '400px' : '45px', 
              overflow: 'hidden', 
              transition: 'all 0.3s ease-in-out',
              paddingBottom: isPanelOpen ? '16px' : '0px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              position: 'absolute', top: '16px', left: '16px', width: '320px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPanelOpen ? '12px' : '0', cursor: 'pointer' }} onClick={() => setIsPanelOpen(!isPanelOpen)}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1CC0F3' }}>
                  {isPanelOpen ? '🗺️ Planificador de Ruta IA' : '🗺️ Abrir Planificador'}
                </span>
                <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px' }}>
                  {isPanelOpen ? '🔽 Ocultar' : '🔼 Mostrar'}
                </button>
              </div>

              {isPanelOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input className="map-input" placeholder="📍 Destino inicial en Tijuana..." value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="map-input" placeholder="🏁 ¿A dónde deseas ir de forma segura?" value={destination} onChange={e => setDestination(e.target.value)} />
                  
                  {activeRoute && currentRouteIndex !== null && (
                    <div style={{ color: rutasAlternativas[currentRouteIndex].color, fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '4px', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '4px' }}>
                      📍 {rutasAlternativas[currentRouteIndex].nombre}
                    </div>
                  )}

                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      if (activeRoute) {
                        setActiveRoute(false);
                        setCurrentRouteIndex(null);
                        setOrigin('');       // 🧹 Limpia origen
                        setDestination('');  // 🧹 Limpia destino
                      } else {
                        generarRutaAleatoria();
                      }
                    }}
                    style={{ backgroundColor: activeRoute ? '#ef4444' : '#1CC0F3' }}
                  >
                    {activeRoute ? '❌ Limpiar Ruta' : 'Optimizar Ruta con IA'}
                  </button>
                  {activeRoute && currentRouteIndex !== null && (
                    <div className="route-info" style={{ color: '#ffffff', backgroundColor: 'rgba(12, 16, 51, 0.9)', padding: '10px', borderRadius: '6px', borderLeft: `4px solid ${rutasAlternativas[currentRouteIndex].color}`, marginTop: '4px', fontSize: '12px' }}>
                      {rutasAlternativas[currentRouteIndex].detalles}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🔥 EL BOTÓN FLOTANTE MÁGICO: SIMULADOR DE ESCANEO */}
            <button 
              className="fab-report" 
              style={{ zIndex: 10, position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#10b981', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap' }} 
              onClick={generarRutaAleatoria}
            >
              🔄 Recalcular Ruta Alternativa (Simular IA)
            </button>
          </div>
        )}

        {currentScreen === 'report' && (
          <div className="report-screen">
            <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>Telemetría Multimodal</h2>
            
            {reportStep === 'camera' && (
              <>
                <div className="camera-container" style={{ backgroundImage: uploadedImage ? `url(${uploadedImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', height: '200px', backgroundColor: '#1e293b', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  {!uploadedImage && (
                    <span className="camera-text" style={{ color: 'white' }}>Captura o sube una foto urbana</span>
                  )}
                </div>
                <div className="shutter-btn-wrapper" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                  <button className="btn-primary" onClick={() => fileInputRef.current.click()}>Subir Foto Real</button>
                  <button className="btn-primary" style={{ backgroundColor: '#475569' }} onClick={simulateCapture}>Simular Cámara</button>
                </div>
              </>
            )}

            {reportStep === 'analyzing' && (
              <div className="analyzing-container" style={{ textAlign: 'center', padding: '40px 0' }}>
                <h3 style={{ color: '#1CC0F3' }}>🤖 Consultando tokens ilimitados de Gemini 1.5 Flash...</h3>
                <p style={{ color: 'gray' }}>Extrayendo riesgos de movilidad en Tijuana...</p>
              </div>
            )}

            {reportStep === 'results' && (
              <div className="results-form">
                <div className="form-group">
                  <label className="form-label">Tipo clasificado por la IA</label>
                  <input className="form-input" value={aiData.type} readOnly style={{ fontWeight: 'bold', color: '#1CC0F3' }} />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Semaforización de Gravedad</label>
                  <div className={`severity-option active ${aiData.severity}`} style={{ padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: aiData.severity === 'red' ? '#ef4444' : aiData.severity === 'amber' ? '#f59e0b' : '#10b981', color: 'white' }}>
                    {aiData.severity === 'red' ? '🔴 ALTA' : aiData.severity === 'amber' ? '🟡 MEDIA' : '🟢 BAJA'} — {aiData.severityLabel}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Descripción generada automáticamente</label>
                  <textarea className="form-textarea" style={{ width: '100%', minHeight: '60px' }} value={aiData.descripcion} onChange={(e) => setAiData({...aiData, descripcion: e.target.value})}></textarea>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Ubicación asignada</label>
                  <input className="form-input" defaultValue="Zona Centro, Tijuana, B.C." />
                </div>

                <button className="btn-primary" style={{ marginTop: '24px', width: '100%' }} onClick={publishReport}>
                  ✅ Alimentar Mapa Colectivo
                </button>
              </div>
            )}

            {reportStep === 'published' && (
              <div className="published-container" style={{ textAlign: 'center', padding: '40px 0' }}>
                <h2 style={{ marginBottom: '8px' }}>¡Mapa Actualizado!</h2>
                <p style={{ color: 'gray', marginBottom: '32px' }}>La base de datos absorbió el reporte de la IA. Las próximas rutas evitarán esta calle.</p>
                <button className="btn-primary" onClick={() => setCurrentScreen('map')}>
                  Volver al Mapa Seguro
                </button>
              </div>
            )}
          </div>
        )}

        {currentScreen === 'community' && (
          <div className="community-screen">
            <div className="community-header" style={{ marginBottom: '20px' }}>
              <h2>Reportes Activos</h2>
              <p style={{ color: 'gray' }}>Tijuana — Base de datos inteligente</p>
            </div>

            <div className="reports-feed">
              {reports.map(report => (
                <div key={report.id} className="report-card" style={{ display: 'flex', gap: '16px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', marginBottom: '12px' }}>
                  <img src={report.image} alt="Reporte" className="report-thumb" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                  <div className="report-content">
                    <div className="report-header" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`report-badge ${report.severity}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '12px', backgroundColor: report.severity === 'red' ? '#ef4444' : report.severity === 'amber' ? '#f59e0b' : '#10b981', color: 'white' }}>{report.severityLabel}</span>
                      <span className="report-time" style={{ fontSize: '12px', color: 'gray' }}>{report.time}</span>
                    </div>
                    <h3 style={{ margin: '4px 0', fontSize: '16px' }}>{report.type}</h3>
                    <p style={{ fontSize: '13px', color: 'lightgray', margin: '4px 0' }}>{report.descripcion}</p>
                    <div className="report-location" style={{ fontSize: '12px', color: 'gray' }}>📍 {report.location}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;