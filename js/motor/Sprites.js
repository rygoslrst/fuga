// ============================================================================
//  Sprites.js — el corredor, con los cuadros del "Animated Pixel Adventurer"
// ----------------------------------------------------------------------------
//  Los cuadros originales miden 50x37. Se dibujan x3 en el atlas, sin
//  suavizado, para que el pixel art quede nítido. Qué cuadro va en cada pose
//  se decide en herramientas/armar_sprites.py (tabla POSES), que genera
//  js/datos/aventurero.js y assets/aventurero.png.
// ============================================================================

import { AVENTURERO } from '../datos/aventurero.js';

export const ESCALA_SPRITE = 3;
const A = AVENTURERO.cuadro;
const E = ESCALA_SPRITE;

// Tamaño de cada cuadro en el atlas y dónde caen los pies (el ancla).
export const CUADRO = { W: A.w * E, H: A.h * E, ANCLA_X: A.anclaX * E, ANCLA_Y: A.anclaY * E };

// Alturas medidas del cuerpo, en píxeles de pantalla.
export const ALTURAS = { DE_PIE: AVENTURERO.alturas.depie * E, BARRIDA: AVENTURERO.alturas.desliz * E };

// Nombres de cuadro por pose, precalculados: armar 'correr_' + n en cada cuadro
// crea basura para el recolector, y en un celular eso son tirones.
export const FR = {};
for (const pose in AVENTURERO.poses) {
  FR[pose] = AVENTURERO.poses[pose].map((_, i) => `${pose}_${i}`);
}

// Piezas para el atlas: una por cuadro ORIGINAL usado, con todos los nombres
// de pose que lo comparten (el cuadro de salto aparece en tres poses, pero se
// guarda una sola vez).
export function cuadrosDelPersonaje(imagen) {
  const sinOjos = new Set(AVENTURERO.sinOjos);
  const porOrigen = new Map();
  for (const pose in AVENTURERO.poses) {
    AVENTURERO.poses[pose].forEach((origen, i) => {
      if (!porOrigen.has(origen)) porOrigen.set(origen, []);
      porOrigen.get(origen).push({ nombre: `${pose}_${i}`, pose });
    });
  }

  const piezas = [];
  for (const [origen, usos] of porOrigen) {
    const [sx, sy] = AVENTURERO.posicion[origen];
    const m = AVENTURERO.meta[origen];
    const metas = {};
    for (const u of usos) {
      metas[u.nombre] = {
        cabezaX: m.cabezaX * E, cabezaY: m.cabezaY * E,
        centroX: m.centroX * E, centroY: m.centroY * E,
        sinOjos: sinOjos.has(u.pose),
      };
    }
    piezas.push({
      nombre: usos[0].nombre,
      alias: usos.map(u => u.nombre),
      metas,
      w: CUADRO.W, h: CUADRO.H,
      dibujar: (ctx, x, y) => {
        ctx.save();
        ctx.imageSmoothingEnabled = false;   // pixel art: cada pixel, un bloque de 3x3
        ctx.drawImage(imagen, sx, sy, A.w, A.h, x, y, CUADRO.W, CUADRO.H);
        ctx.restore();
      },
    });
  }
  return piezas;
}
