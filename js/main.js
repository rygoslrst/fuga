// ============================================================================
//  main.js  —  configuración de Phaser y arranque
// ============================================================================

import { PANTALLA, COLORES } from './config/ajustes.js';
import { Paso0 } from './escenas/Paso0.js';

// ----------------------------------------------------------------------------
//  1) Que el navegador no se coma los toques
// ----------------------------------------------------------------------------
//  Sin esto, en el celular arrastrar el dedo hace scroll, dos toques rápidos
//  hacen zoom, y deslizar desde arriba recarga la página en medio de una
//  partida. touch-action:none en el CSS cubre casi todo; esto tapa el resto.
function blindarGestos() {
  const parar = e => e.preventDefault();
  document.addEventListener('touchmove', parar, { passive: false });
  document.addEventListener('gesturestart', parar, { passive: false });  // pinch en iOS
  document.addEventListener('gesturechange', parar, { passive: false });
  document.addEventListener('dblclick', parar, { passive: false });
  document.addEventListener('contextmenu', parar);                        // mantener apretado
  // Evita el zoom por doble toque en iOS, que touch-action no siempre frena.
  let ultimo = 0;
  document.addEventListener('touchend', e => {
    const ahora = Date.now();
    if (ahora - ultimo < 320) e.preventDefault();
    ultimo = ahora;
  }, { passive: false });
}

// ----------------------------------------------------------------------------
//  2) Pantalla de "girá el teléfono"
// ----------------------------------------------------------------------------
//  No se puede FORZAR la rotación desde el navegador sin pantalla completa, y
//  en iOS no se puede ni con eso. Así que se le pide al jugador, y mientras
//  tanto se pausa el juego.
function vigilarOrientacion(juego) {
  const aviso = document.getElementById('gira');
  const revisar = () => {
    const vertical = window.innerHeight > window.innerWidth;
    aviso.classList.toggle('visible', vertical);
    if (!juego.scene.scenes.length) return;
    const escena = juego.scene.scenes[0];
    if (vertical && !escena.scene.isPaused()) escena.scene.pause();
    if (!vertical && escena.scene.isPaused()) escena.scene.resume();
  };
  window.addEventListener('resize', revisar);
  window.addEventListener('orientationchange', () => setTimeout(revisar, 250));
  revisar();
}

// ----------------------------------------------------------------------------
//  3) Cambio de pestaña / apagar la pantalla
// ----------------------------------------------------------------------------
//  Verificado en el paso 0: al ocultarse la pestaña el navegador congela
//  requestAnimationFrame, pero el AudioContext sigue avanzando. Sin esto, el
//  jugador que atiende un mensaje vuelve con la música adelantada respecto del
//  nivel. Congelamos los dos relojes juntos.
function vigilarVisibilidad(juego) {
  document.addEventListener('visibilitychange', () => {
    const escena = juego.scene.scenes[0];
    if (!escena || !escena.reloj) return;
    if (document.hidden) {
      escena.reloj.dormir();
      if (escena.scene.isActive()) escena.scene.pause();
    } else {
      escena.reloj.despertar();
      if (escena.scene.isPaused() && window.innerWidth >= window.innerHeight) {
        escena.scene.resume();
      }
    }
  });
}

// ----------------------------------------------------------------------------
//  4) Phaser
// ----------------------------------------------------------------------------
const config = {
  type: Phaser.AUTO,          // WebGL si se puede, Canvas si no
  parent: 'juego',
  backgroundColor: COLORES.FONDO_CSS,

  scale: {
    // La resolución virtual es FIJA: dibujamos siempre en 960x540 y Phaser
    // escala el canvas. En un celular con pantalla enorme seguimos rellenando
    // 960x540 píxeles, no 2400x1080: es la decisión que más FPS ahorra.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: PANTALLA.ANCHO,
    height: PANTALLA.ALTO,
  },

  render: {
    pixelArt: true,           // los sprites CC0 son pixel art: nada de suavizado
    antialias: false,
    powerPreference: 'high-performance',
    // Ahorra una limpieza de pantalla por cuadro: el fondo lo dibujamos nosotros.
    clearBeforeRender: true,
  },

  fps: { target: 60, min: 30, forceSetTimeOut: false },

  // Arcade physics: la más barata de las tres. Se usa SOLO para detectar
  // colisiones; la altura del salto la calculamos nosotros contra el reloj
  // de audio (ver ritmo.js -> alturaDeSalto).
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false, fixedStep: true, fps: 60 },
  },

  scene: [Paso0],
};

blindarGestos();
const juego = new Phaser.Game(config);
vigilarOrientacion(juego);
vigilarVisibilidad(juego);
window.juego = juego; // para inspeccionar desde la consola mientras desarrollamos
