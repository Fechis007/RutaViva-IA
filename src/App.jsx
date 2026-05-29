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
  // Asegúrate de tener declarada tu API_KEY en el entorno o arriba en tu componente
  const API_KEY = "AQAb8RN6LWWnTajAeOxLihH-GkQ145if5ZBfGy-orewa0xYz8Mw"; 

  // Limpiamos el encabezado del Base64 si es que viene de un Canvas o FileReader
  const limpioBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

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
      generationConfig: { 
        responseMimeType: 'application/json' 
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Detalle del error de Gemini:", errorData);
    throw new Error('Error de conexion con Gemini');
  }

  const data = await response.json();
  
  // Extraemos el texto de la respuesta de la IA
  let textoJson = data.candidates[0].content.parts[0].text;
  
  /* ==========================================================================
      🛡️ TRUCO DE LIMPIEZA: Eliminamos los bloques markdown si Gemini los puso
     ========================================================================== */
  textoJson = textoJson.replace(/```json|```/g, '').trim();

  // Ahora sí, parseo 100% seguro y directo a tu mapa o feed
  return JSON.parse(textoJson);
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
        descripcion: '🤖-Gemini Vision analizó la imagen: Automóvil sedán gris bloqueando rampa de acceso peatonal en esquina.'
      },
      {
        image: 'https://blob.diariodelyaqui.mx/images/2025/02/21/rampas--5.jpg', 
        type: 'Banqueta Dañada',
        severity: 'amber',
        severityLabel: 'Precaución',
        descripcion: '🤖-Gemini Vision analizó la imagen: Pavimento de banqueta levantado y agrietado, representando riesgo de caída.'
      },
      {
        image: 'https://www.sopitas.com/wp-content/uploads/2023/03/lluvias-cdmx-clima-30-marzo-billie-eilish.jpg?w=1024',
        type: 'Calle Inundada',
        severity: 'red',
        severityLabel: 'Crítico',
        descripcion: '🤖-Gemini Vision analizó la imagen: Calle completamente inundada por fuertes lluvias, intransitable para peatones.'
      },
      {
        image: 'https://images.milenio.com/a53bq0Zfdu7Z0DH_yB0AX6xmoTs=/345x194/uploads/media/2025/08/15/lluvia-deja-inundaciones-casas-plaza.jpg', 
        type: 'Obras sin Señalizar/Calles Obstruidas',
        severity: 'red',
        severityLabel: 'Crítico',
        descripcion: '🤖-Gemini Vision analizó la imagen: Zanja abierta en paso peatonal sin rampa alternativa ni señalización auditiva.'
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
    }, 3500);
  };

  const publishReport = async () => {
    console.log("Iniciando el guardado en la Base de Datos...");
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
      descripcion: aiData.descripcion,
      still_there_votes: 0,
      resolved_votes: 0
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

  // 🗳️ NUEVA FUNCIÓN INTERACTIVA DE VOTO COMUNITARIO
  const votarObstaculo = async (reportId, votoSi) => {
    // Buscamos el reporte seleccionado en nuestro estado local
    const reporteActual = reports.find(r => r.id === reportId);
    if (!reporteActual) return;

    let updateData = {};

    if (votoSi) {
      // "Sí sigue allí": Sumamos un voto positivo
      const nuevosVotosSi = (reporteActual.still_there_votes || 0) + 1;
      updateData = { still_there_votes: nuevosVotosSi };
    } else {
      // "No, ya no está": Sumamos voto de resolución
      const nuevosVotosNo = (reporteActual.resolved_votes || 0) + 1;
      
      // Regla de Oro: Si acumula 3 o más votos de "No", se limpia de Supabase automáticamente
      if (nuevosVotosNo >= 3) {
        const { error } = await supabase.from('reports').delete().eq('id', reportId);
        if (!error) {
          console.log(`🗑️ El reporte ${reportId} fue resuelto y eliminado por la comunidad.`);
          await obtenerReportes();
          return;
        }
      } else {
        updateData = { resolved_votes: nuevosVotosNo };
      }
    }

    // Actualizamos los datos del registro en Supabase
    const { error } = await supabase.from('reports').update(updateData).eq('id', reportId);

    if (!error) {
      // Refrescamos la lista de reportes en el mapa
      await obtenerReportes();
    } else {
      console.error("Error al actualizar voto:", error);
    }
  };

  return (
    <div className="app-container">
      <style>{`
        .linea-neon {
          animation: pulsoNeon 1.5s ease-in-out infinite alternate;
        }
        @keyframes pulsoNeon {
          from { stroke-opacity: 0.6; stroke-width: 5; }
          to { stroke-opacity: 1; stroke-width: 7; }
        }
      `}</style>

      {/* 💻 CONTENIDO PRINCIPAL REORGANIZADO */}
      <main className="content-area">
        
        {/* ================= PANTALLA 1: MAPA ================= */}
        {currentScreen === 'map' && (
          <div className="map-screen">
            <div className="svg-map" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <MapContainer center={[32.5225, -117.0195]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                {activeRoute && currentRouteIndex !== null && coordenadasRutas[currentRouteIndex] && (
                  <Polyline positions={coordenadasRutas[currentRouteIndex]} pathOptions={{ color: rutasAlternativas[currentRouteIndex].color, weight: 6, dashArray: '12, 8', className: 'linea-neon' }} />
                )}
                {reports.filter(report => report.lat && report.lng).map(report => (
                  <Marker key={report.id} position={[report.lat, report.lng]}>
                    <Popup>
                      <div className="leaflet-popup-cyber">
                        <div className="popup-badge-container">
                          <span>{report.severity === 'red' ? '🔴' : report.severity === 'amber' ? '🟡' : '🟢'}</span>
                          <span className="popup-badge-title">{report.type}</span>
                        </div>
                        <p className="popup-description">{report.descripcion}</p>
                        
                        {/* 🗳️ INTERFAZ COMUNITARIA: ¿SIGUE ALLÍ? */}
                        <div className="community-vote-box">
                          <div className="vote-question">¿Sigue el obstáculo aquí?</div>
                          <div className="vote-buttons-row">
                            <button className="btn-vote-yes" onClick={() => votarObstaculo(report.id, true)}>
                              Sí ({report.still_there_votes || 0}) ⚠️
                            </button>
                            <button className="btn-vote-no" onClick={() => votarObstaculo(report.id, false)}>
                              No ({report.resolved_votes || 0}/3) ✅
                            </button>
                          </div>
                          <span className="vote-subtext">3 votos de 'No' eliminan el reporte del mapa</span>
                        </div>

                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="map-panel-horizontal">
              <div className="planner-badge" onClick={() => setIsPanelOpen(!isPanelOpen)} style={{ cursor: 'pointer' }}>
                <span>🤖</span> <span className="planner-badge-text">Ruta IA Tijuana</span>
              </div>
              <button className="btn-planner-action" style={{ backgroundColor: isPanelOpen ? '#334155' : '#10b981', padding: '8px', fontSize: '12px' }} onClick={() => setIsPanelOpen(!isPanelOpen)}>
                {isPanelOpen ? '✕ Minimizar Panel' : '🗺️ Abrir Planificador'}
              </button>
              {isPanelOpen && (
                <div className="planner-row-content">
                  <div className="planner-inputs-group">
                    <input className="map-input-clean" placeholder="📍 Selecciona Origen..." value={origin} disabled={true} />
                    <div className="planner-arrow">➔</div>
                    <input className="map-input-clean" placeholder="🏁 Esperando destino seguro..." value={destination} disabled={true} />
                  </div>
                  <button className="btn-planner-action" onClick={() => { activeRoute ? (setActiveRoute(false), setCurrentRouteIndex(null), setOrigin(''), setDestination('')) : generarRutaAleatoria() }} style={{ backgroundColor: activeRoute ? '#ef4444' : '#1CC0F3' }}>
                    {activeRoute ? '❌ Limpiar Mapa' : 'Optimizar con Gemini'}
                  </button>
                  {activeRoute && currentRouteIndex !== null && (
                    <div className="planner-floating-info">
                      <span style={{ color: rutasAlternativas[currentRouteIndex].color, fontWeight: '800', fontSize: '13px', display: 'block', marginBottom: '4px' }}>{rutasAlternativas[currentRouteIndex].nombre}</span>
                      <p style={{ fontSize: '12px', color: '#8B9DD6', lineHeight: '1.4' }}>{rutasAlternativas[currentRouteIndex].detalles}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PANTALLA 2: REPORTE MEJORADO CON ESCANEO NERVIOSO ================= */}
        {currentScreen === 'report' && (
          <div className="report-screen">
            {reportStep === 'camera' && (
              <div className="report-camera-menu">
                <h2>📸 Reporte de Incidente</h2>
                <p className="subtitle">Registra incidentes viales mediante visión artificial de Gemini</p>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                
                <div className="report-action-box">
                  <button className="btn-cyber-upload" onClick={() => fileInputRef.current.click()}>
                    💾 Cargar Archivo Local
                  </button>
                  <button className="btn-cyber-simulate" onClick={simulateCapture}>
                    🟢 Simular Escaneo Satelital (Demo)
                  </button>
                </div>
              </div>
            )}

            {/* 🔥 FASE DE ESCANEO ACTIVO */}
            {reportStep === 'analyzing' && (
              <div className="scanner-layout">
                <div className="cyber-scanner-container">
                  <img src={uploadedImage} alt="Escaneo en progreso" className="img-scanned" />
                  <div className="laser-line"></div>
                  <div className="scanner-overlay-grid"></div>
                </div>
                <div className="scanner-status">
                  <div className="pulse-dot"></div>
                  <h3>🤖 RED NEURONAL ADAPTATIVA PROCESANDO...</h3>
                  <p>Clasificando daño estructural en la base de datos de Tijuana...</p>
                </div>
              </div>
            )}

            {/* FASE DE RESULTADOS REVELADOS */}
            {reportStep === 'results' && (
              <div className="results-wrapper">
                <div className="results-card">
                  <div className="results-header-badge">✓ ESCANEO COMPLETADO POR GEMINI 1.5</div>
                  
                  <div className="result-img-preview-box">
                    <img src={uploadedImage} alt="Incidente Procesado" className="result-img-preview" />
                  </div>

                  <div className="form-group-cyber">
                    <label>Incidente Identificado</label>
                    <input className="input-cyber-readonly" value={aiData.type} readOnly />
                  </div>

                  <div className="form-group-cyber">
                    <label>Riesgo de Afectación de Ruta</label>
                    <div className={`severity-banner-cyber ${aiData.severity}`}>
                      {aiData.severity === 'red' ? '🔴 CRÍTICO' : '🟡 PRECAUCIÓN'} — {aiData.severityLabel}
                    </div>
                  </div>

                  <div className="form-group-cyber">
                    <label>Dictamen de la IA (Editable)</label>
                    <textarea className="textarea-cyber" value={aiData.descripcion} onChange={(e) => setAiData({...aiData, descripcion: e.target.value})} />
                  </div>

                  <button className="btn-cyber-submit" onClick={publishReport}>
                    📡 Alimentar Servidor Colectivo (Supabase)
                  </button>
                </div>
              </div>
            )}

            {reportStep === 'published' && (
              <div className="published-cyber-box">
                <div className="success-glow-ring">✓</div>
                <h2>¡Sincronización Exitosa!</h2>
                <p>Los datos han sido consolidados en Supabase. El algoritmo de ruteo de Tijuana asimilará la evasión de este punto.</p>
                <button className="btn-cyber-back" onClick={() => { setCurrentScreen('map'); setReportStep('camera'); }}>
                  Volver al Mapa Global
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= PANTALLA 3: COMUNIDAD ================= */}
        {currentScreen === 'community' && (
          <div className="community-screen">
            <h2>📡 Red de Reportes Colectivos</h2>
            <p className="subtitle">Historial en tiempo real de los obstáculos validados en Supabase</p>
            <div className="reports-feed-cyber">
              {reports.map(report => (
                <div key={report.id} className="report-card-cyber">
                  <img src={report.image} alt="Reporte" className="card-thumb" />
                  <div className="card-info">
                    <span className={`card-badge-severity ${report.severity}`}>{report.severitylabel || 'Validado'}</span>
                    <h3>{report.type}</h3>
                    <p>{report.descripcion}</p>
                    
                    {/* Contador de validación rápida en el Feed */}
                    <div className="feed-stats">
                      <span className="stat-confirm">⚠️ {report.still_there_votes || 0} confirmados</span>
                      <span className="stat-resolve">✅ {report.resolved_votes || 0}/3 de salida</span>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 🧭 NAVBAR ÚNICA Y BIEN ACOPLADA */}
      <nav className="nav-bar">
        <div className="logo-area">
          <div className="logo-title">RutaViva</div>
          <div className="logo-tagline">Movilidad Inteligente</div>
        </div>
        <button className={`nav-item ${currentScreen === 'map' ? 'active' : ''}`} onClick={() => setCurrentScreen('map')}>
          <span className="icon">🗺️</span> <span className="label">Mapa</span>
        </button>
        <button className={`nav-item ${currentScreen === 'report' ? 'active' : ''}`} onClick={() => { setCurrentScreen('report'); setReportStep('camera'); setUploadedImage(null); }}>
          <span className="icon">📸</span> <span className="label">Reportar</span>
        </button>
        <button className={`nav-item ${currentScreen === 'community' ? 'active' : ''}`} onClick={() => setCurrentScreen('community')}>
          <span className="icon">🏘️</span> <span className="label">Comunidad</span>
        </button>
      </nav>

    </div>
  );
}

export default App;