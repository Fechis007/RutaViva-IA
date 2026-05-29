import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Seteamos la API KEY que creaste en el archivo .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// 🗺️ COORDENADAS REALES DE CALLES EN TIJUANA PARA LAS 5 DIAGONALES DE LA DEMO
const coordenadasRutas = {
  0: [ // Ruta 1: Zona Centro / Av. Revolución alterno por Calle 4ta
    [32.5322, -117.0392], [32.5302, -117.0392], [32.5301, -117.0345], [32.5255, -117.0315]
  ],
  1: [ // Ruta 2: Zona Río / Desvío de Vía Rápida a Paseo de los Héroes
    [32.5285, -117.0221], [32.5251, -117.0182], [32.5212, -117.0125], [32.5182, -117.0102]
  ],
  2: [ // Ruta 3: Conexión Centro hacia Garita de San Ysidro
    [32.5352, -117.0321], [32.5385, -117.0285], [32.5412, -117.0295], [32.5429, -117.0271]
  ],
  3: [ // Ruta 4: Blvd. Agua Caliente seguro
    [32.5195, -117.0255], [32.5175, -117.0212], [32.5141, -117.0152], [32.5112, -117.0111]
  ],
  4: [ // Ruta 5: Alternativa Inclusiva Interna Centro
    [32.5265, -117.0381], [32.5242, -117.0352], [32.5231, -117.0312], [32.5215, -117.0282]
  ]
};

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

function App() {
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

  const [reports, setReports] = useState([]); 
  const fileInputRef = useRef(null);

  const rutasAlternativas = [
    { nombre: "Ruta 1: Evitando Bloqueo en Av. Revolución", color: "#1CC0F3", detalles: "🤖 Gemini desvió la ruta por Calle 4ta debido a banquetas destruidas en la Revu." },
    { nombre: "Ruta 2: Conectando Zona Río Segura", color: "#10b981", detalles: "🤖 Alerta de rampa inexistente en Vía Rápida. Trayectoria corregida por Paseo de los Héroes." },
    { nombre: "Ruta 3: Acceso Libre a Línea Internacional", color: "#a855f7", detalles: "🤖 Ruta optimizada hacia la Garita de San Ysidro evadiendo obras en la línea." },
    { nombre: "Ruta 4: Cruce Accessible por Blvd. Agua Caliente", color: "#f59e0b", detalles: "🤖 Desvío activo en Blvd. Cuauhtémoc por semáforo peatonal auditivo averiado." },
    { nombre: "Ruta 5: Alternativa Inclusiva Zona Centro", color: "#ec4899", detalles: "🤖 Escaneo de telemetría completado. Usando calles con rampas 100% operativas." }
  ];

  const obtenerReportes = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('id', { ascending: false });

    if (!error && data) {
      setReports(data);
    } else {
      console.error("Error al traer reportes de Supabase:", error);
    }
  };

  useEffect(() => {
    obtenerReportes();
  }, []);

  const generarRutaAleatoria = () => {
    const randomIndex = Math.floor(Math.random() * rutasAlternativas.length);
    setCurrentRouteIndex(randomIndex);
    setActiveRoute(true);

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
    const escenariosDemo = [
      {
        image: 'https://images.unsplash.com/photo-1634712439169-7c85e6ac37a0?q=80&w=400', 
        type: 'Vehiculo Obstruyendo',
        severity: 'red',
        severityLabel: 'Crítico',
        descripcion: '🤖 Gemini Vision analizó la imagen: Automóvil sedán gris bloqueando rampa de acceso peatonal en esquina.'
      },
      {
        image: 'https://images.unsplash.com/photo-1596395817296-6e54f39f3794?q=80&w=400', 
        type: 'Banqueta Dañada',
        severity: 'amber',
        severityLabel: 'Precaución',
        descripcion: '🤖 Gemini Vision analizó la imagen: Pavimento de banqueta levantado y agrietado, representando riesgo de caída.'
      },
      {
        image: 'https://images.unsplash.com/photo-1579783901586-d88db74b4fe1?q=80&w=400', 
        type: 'Obras sin Señalizar',
        severity: 'red',
        severityLabel: 'Crítico',
        descripcion: '🤖 Gemini Vision analizó la imagen: Zanja abierta en paso peatonal sin rampa alternativa ni señalización auditiva.'
      }
    ];

    const escenarioAleatorio = escenariosDemo[Math.floor(Math.random() * escenariosDemo.length)];
    setUploadedImage(escenarioAleatorio.image);
    setReportStep('analyzing');

    setTimeout(() => {
      setAiData({
        type: escenarioAleatorio.type,
        severity: escenarioAleatorio.severity,
        severityLabel: escenarioAleatorio.severityLabel,
        descripcion: escenarioAleatorio.descripcion
      });
      setReportStep('results');
    }, 2500);
  };

  const publishReport = async () => {
    console.log("🚀 Iniciando el guardado en la Base de Datos...");
    const latDemo = 32.5225 + (Math.random() - 0.5) * 0.015;
    const lngDemo = -117.0195 + (Math.random() - 0.5) * 0.015;

    const nuevoReporte = {
      type: aiData.type,
      severity: aiData.severity, 
      severitylabel: aiData.severityLabel, 
      location: 'Tijuana (Demo)',
      lat: latDemo,
      lng: lngDemo,
      image: uploadedImage || PLACEHOLDER_IMG,
      descripcion: aiData.descripcion
    };

    const { error } = await supabase.from('reports').insert([nuevoReporte]);

    if (!error) {
      console.log("✅ ¡Guardado con éxito!");
      await obtenerReportes(); 
      setReportStep('published'); 
    } else {
      console.error("❌ Error Supabase:", error);
      alert("Error al guardar en Supabase: " + error.message);
    }
  };

  return (
    <div className="app-container">
      {/* Estilos CSS inyectados directo para asegurar el efecto de parpadeo neón de la ruta */}
      <style>{`
        .linea-neon {
          animation: pulsoNeon 1.5s ease-in-out infinite alternate;
        }
        @keyframes pulsoNeon {
          from { stroke-opacity: 0.6; stroke-width: 5; }
          to { stroke-opacity: 1; stroke-width: 7; }
        }
      `}</style>

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

      <main className="main-content" style={{ flex: 1, position: 'relative', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* ================= PANTALLA 1: MAPA ================= */}
        {currentScreen === 'map' && (
          <div className="map-screen" style={{ position: 'relative', flex: 1, width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0c1033' }}>
            
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
              <MapContainer 
                center={[32.5225, -117.0195]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CARTO'
                />
                
                {/* 🚀 AQUÍ PINTAMOS LA NUEVA LÍNEA REAL INTEGRADA EN LAS CALLES */}
                {activeRoute && currentRouteIndex !== null && coordenadasRutas[currentRouteIndex] && (
                  <Polyline 
                    positions={coordenadasRutas[currentRouteIndex]}
                    pathOptions={{
                      color: rutasAlternativas[currentRouteIndex].color,
                      weight: 6,
                      dashArray: '12, 8',
                      className: 'linea-neon'
                    }}
                  />
                )}

                {reports.filter(report => report.lat && report.lng).map(report => (
                  <Marker key={report.id} position={[report.lat, report.lng]}>
                    <Popup>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '20px' }}>{report.severity === 'red' ? '🔴' : report.severity === 'amber' ? '🟡' : '🟢'}</span>
                        <h3 style={{ margin: '5px 0', fontSize: '14px' }}>{report.type}</h3>
                        <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>{report.descripcion}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="map-panel" style={{ zIndex: 10, maxHeight: isPanelOpen ? '400px' : '45px', overflow: 'hidden', transition: 'all 0.3s ease-in-out', paddingBottom: isPanelOpen ? '16px' : '0px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', position: 'absolute', top: '16px', left: '16px', width: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPanelOpen ? '12px' : '0', cursor: 'pointer' }} onClick={() => setIsPanelOpen(!isPanelOpen)}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1CC0F3' }}>{isPanelOpen ? '🗺️ Planificador de Ruta IA' : '🗺️ Abrir Planificador'}</span>
                <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px' }}>{isPanelOpen ? '🔽 Ocultar' : '🔼 Mostrar'}</button>
              </div>

              {isPanelOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input className="map-input" placeholder="📍 Destino inicial en Tijuana..." value={origin} onChange={e => setOrigin(e.target.value)} />
                  <input className="map-input" placeholder="🏁 ¿A dónde deseas ir de forma segura?" value={destination} onChange={e => setDestination(e.target.value)} />
                  
                  {activeRoute && currentRouteIndex !== null && (
                    <div style={{ color: rutasAlternativas[currentRouteIndex].color, fontSize: '12px', fontWeight: 'bold', textAlign: 'center', padding: '4px', backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '4px' }}>📍 {rutasAlternativas[currentRouteIndex].nombre}</div>
                  )}

                  <button className="btn-primary" onClick={() => { if (activeRoute) { setActiveRoute(false); setCurrentRouteIndex(null); setOrigin(''); setDestination(''); } else { generarRutaAleatoria(); } }} style={{ backgroundColor: activeRoute ? '#ef4444' : '#1CC0F3' }}>
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

            <button className="fab-report" style={{ zIndex: 10, position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#10b981', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', width: 'auto', padding: '12px 24px', whiteSpace: 'nowrap' }} onClick={generarRutaAleatoria}>
              🔄 Recalcular Ruta Alternativa (Simular IA)
            </button>
          </div>
        )}

        {/* ================= PANTALLA 2: REPORTE CON CÁMARA ================= */}
        {currentScreen === 'report' && (
          <div className="report-screen" style={{ padding: '20px' }}>
            {reportStep === 'camera' && (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ color: 'white', marginBottom: '10px' }}>📸 Reportar Obstáculo</h2>
                <p style={{ color: 'gray', marginBottom: '20px' }}>Toma una foto para que Gemini IA analice el problema.</p>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                <button className="btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={() => fileInputRef.current.click()}>
                  Subir Foto Real
                </button>
                <button className="btn-primary" style={{ width: '100%', backgroundColor: '#a855f7' }} onClick={simulateCapture}>
                  Simular Captura (Demo)
                </button>
              </div>
            )}

            {reportStep === 'analyzing' && (
              <div className="analyzing-container" style={{ textAlign: 'center', padding: '40px 0' }}>
                <h3 style={{ color: '#1CC0F3' }}>🤖 Consultando IA de Gemini...</h3>
                <p style={{ color: 'gray' }}>Extrayendo riesgos de movilidad en Tijuana...</p>
              </div>
            )}

            {reportStep === 'results' && (
              <div className="results-form">
                <div className="form-group">
                  <label className="form-label" style={{ color: 'white' }}>Tipo clasificado por la IA</label>
                  <input className="form-input" value={aiData.type} readOnly style={{ fontWeight: 'bold', color: '#1CC0F3' }} />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label" style={{ color: 'white' }}>Semaforización de Gravedad</label>
                  <div style={{ padding: '12px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: aiData.severity === 'red' ? '#ef4444' : aiData.severity === 'amber' ? '#f59e0b' : '#10b981', color: 'white' }}>
                    {aiData.severity === 'red' ? '🔴 ALTA' : aiData.severity === 'amber' ? '🟡 MEDIA' : '🟢 BAJA'} — {aiData.severityLabel}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label" style={{ color: 'white' }}>Descripción generada automáticamente</label>
                  <textarea className="form-textarea" style={{ width: '100%', minHeight: '60px' }} value={aiData.descripcion} onChange={(e) => setAiData({...aiData, descripcion: e.target.value})}></textarea>
                </div>

                <button className="btn-primary" style={{ marginTop: '24px', width: '100%', backgroundColor: '#1CC0F3' }} onClick={publishReport}>
                Alimentar Mapa Colectivo
                </button>
              </div>
            )}

            {reportStep === 'published' && (
              <div className="published-container" style={{ textAlign: 'center', padding: '40px 0' }}>
                <h2 style={{ color: 'white', marginBottom: '8px' }}>¡Mapa Actualizado!</h2>
                <p style={{ color: 'gray', marginBottom: '32px' }}>La base de datos absorbió el reporte. Las próximas rutas evitarán esta zona.</p>
                <button className="btn-primary" onClick={() => setCurrentScreen('map')}>
                  Volver al Mapa Seguro
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= PANTALLA 3: COMUNIDAD ================= */}
        {currentScreen === 'community' && (
          <div className="community-screen" style={{ padding: '20px' }}>
            <div className="community-header" style={{ marginBottom: '20px' }}>
              <h2 style={{ color: 'white' }}>Reportes Activos</h2>
              <p style={{ color: 'gray' }}>Tijuana — Base de datos inteligente</p>
            </div>

            <div className="reports-feed">
              {reports.map(report => (
                <div key={report.id} className="report-card" style={{ display: 'flex', gap: '16px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', marginBottom: '12px' }}>
                  <img src={report.image} alt="Reporte" className="report-thumb" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' }} />
                  <div className="report-content">
                    <div className="report-header" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`report-badge ${report.severity}`} style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '12px', backgroundColor: report.severity === 'red' ? '#ef4444' : report.severity === 'amber' ? '#f59e0b' : '#10b981', color: 'white' }}>{report.severitylabel}</span>
                    </div>
                    <h3 style={{ margin: '4px 0', fontSize: '16px', color: 'white' }}>{report.type}</h3>
                    <p style={{ fontSize: '13px', color: 'lightgray', margin: '4px 0' }}>{report.descripcion}</p>
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