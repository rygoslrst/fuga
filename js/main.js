// ============================================================================
//  main.js — arranque
// ============================================================================

import { ALTO, DEBUG, VISTA, anchoParaPantalla } from './config.js';
import { Audio } from './motor/Audio.js';
import { UI } from './ui.js';
import { Juego } from './escenas/Juego.js';

// ----------------------------------------------------------------------------
//  Que el navegador no se coma los toques: sin esto, arrastrar el dedo hace
//  scroll, dos toques rápidos hacen zoom y deslizar desde arriba recarga la
//  página en medio de una partida. El panel de créditos sí puede desplazarse.
// ----------------------------------------------------------------------------
function blindarGestos() {
  const enPanel = e => e.target && e.target.closest && e.target.closest('.desplazable');
  const parar = e => { if (!enPanel(e)) e.preventDefault(); };
  document.addEventListener('touchmove', parar, { passive: false });
  document.addEventListener('gesturestart', parar, { passive: false });
  document.addEventListener('gesturechange', parar, { passive: false });
  document.addEventListener('dblclick', parar, { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());
  let ultimo = 0;
  document.addEventListener('touchend', e => {
    const ahora = Date.now();
    if (ahora - ultimo < 320 && !enPanel(e) && !e.target.closest('.boton')) e.preventDefault();
    ultimo = ahora;
  }, { passive: false });
}

function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

// ----------------------------------------------------------------------------
//  Girá el teléfono: no se puede forzar la rotación desde el navegador (en
//  iPhone ni con pantalla completa). Se le pide al jugador y se pausa.
// ----------------------------------------------------------------------------
function vigilarOrientacion(obtenerEscena) {
  const aviso = document.getElementById('gira');
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const revisar = () => {
    const vertical = tactil && window.innerHeight > window.innerWidth;
    aviso.hidden = !vertical;
    const e = obtenerEscena();
    if (vertical && e && e.estado === 'jugando') e.pausar();
  };
  window.addEventListener('resize', revisar);
  window.addEventListener('orientationchange', () => setTimeout(revisar, 250));
  revisar();
}

// Al girar el teléfono (o cambiar el tamaño de la ventana) el mundo se
// ensancha o se angosta para llenar la pantalla. Sólo en horizontal: en
// vertical está la pantalla de "girá el teléfono".
function vigilarAncho(juego, obtenerEscena) {
  let pendiente = 0;
  const revisar = () => {
    if (window.innerHeight > window.innerWidth) return;
    const w = anchoParaPantalla(window.innerWidth, window.innerHeight);
    if (w === VISTA.ancho) return;
    juego.scale.setGameSize(w, ALTO);
    juego.scale.refresh();          // sin esto, el canvas conserva el tamaño en pantalla viejo
    const e = obtenerEscena();
    if (e && e.cielo) e.redimensionar(w);
    else VISTA.ancho = w;
  };
  window.addEventListener('resize', () => { clearTimeout(pendiente); pendiente = setTimeout(revisar, 120); });
}

// Al cambiar de app o apagar la pantalla, el navegador congela el dibujo pero
// el audio seguiría corriendo: se pausa todo junto.
function vigilarVisibilidad(obtenerEscena, audio) {
  document.addEventListener('visibilitychange', () => {
    const e = obtenerEscena();
    if (document.hidden) {
      if (e && e.estado === 'jugando') e.pausar();
      else audio.pausar();
    } else if (!e || e.estado !== 'pausa') {
      audio.reanudar();
    }
  });
}

async function arrancar() {
  blindarGestos();
  if (!hayWebGL()) {
    document.getElementById('error').hidden = false;
    document.getElementById('cargando').hidden = true;
    return;
  }

  // La tipografía y la hoja del corredor tienen que estar cargadas antes de
  // armar el atlas. Se piden las dos a la vez.
  const fuente = Promise.race([document.fonts.load('64px Anton'), new Promise(r => setTimeout(r, 3000))])
    .catch(() => { /* seguimos con la de respaldo */ });
  const imagenPersonaje = new Image();
  imagenPersonaje.src = 'assets/aventurero.png';
  await Promise.all([fuente, imagenPersonaje.decode()]);

  const audio = new Audio();
  const ui = new UI(audio);

  VISTA.ancho = anchoParaPantalla(window.innerWidth, window.innerHeight);
  const juego = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'juego',
    width: VISTA.ancho,
    height: ALTO,
    backgroundColor: '#241640',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60, min: 20 },
    audio: { noAudio: true },                  // el audio es nuestro: un solo AudioContext
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },   // eventos nativos
    banner: false,
  });
  juego.scene.add('Juego', Juego, true, { audio, ui, imagenPersonaje });

  const escena = () => juego.scene.getScene('Juego');
  vigilarOrientacion(escena);
  vigilarAncho(juego, escena);
  vigilarVisibilidad(escena, audio);
  document.getElementById('cargando').hidden = true;
  if (DEBUG) window.juego = juego;
}

arrancar();
