// ============================================================================
//  Esqueleto.js — el personaje, hecho con código
// ----------------------------------------------------------------------------
//  No hay sprites dibujados a mano. El corredor es un esqueleto de 10 huesos y
//  cada pose es una lista de ángulos. Al cargar el juego se "hornean" todas las
//  poses a cuadros de una textura (una sola vez), y durante la partida el
//  personaje es un sprite común: dibujarlo cuesta lo mismo que dibujar un cuadrado.
//
//  Convenciones (el personaje mira a la DERECHA):
//    t        torso: grados desde la vertical hacia arriba, + = inclinado adelante
//    h        cabeza: inclinación extra sobre el torso
//    uaA/uaB  brazo (cercano / lejano): grados desde "colgando", + = hacia adelante
//    elA/elB  codo: cuánto se dobla (siempre hacia adelante)
//    thA/thB  muslo: grados desde "colgando", + = hacia adelante
//    knA/knB  rodilla: cuánto se dobla (siempre hacia atrás)
//    rx/ry    corrimiento de la cadera en píxeles (ry + = más abajo)
// ============================================================================

const L = { MUSLO: 21, CANILLA: 21, TORSO: 27, CUELLO: 3, CABEZA: 8.5, BRAZO: 15, ANTEBRAZO: 15, PIE: 7 };
const G = { TORSO: 12, MUSLO: 9.5, CANILLA: 8, BRAZO: 7, ANTEBRAZO: 6, PIE: 5.5, MANO: 3.4 };
const RAD = Math.PI / 180;
const BASE = { rx: 0, ry: 0, t: 0, h: 0, uaA: 0, elA: 10, uaB: 0, elB: 10, thA: 0, knA: 0, thB: 0, knB: 0 };

// Tamaño de cada cuadro horneado y dónde cae el "punto de apoyo" (los pies).
export const CUADRO = { W: 124, H: 140, ANCLA_X: 50, ANCLA_Y: 128 };

const P = o => Object.assign({}, BASE, o);

// Espeja una pose: intercambia lado cercano y lejano. Sirve para la segunda
// mitad del ciclo de carrera sin escribir dos veces lo mismo.
const espejo = p => P({ ...p, uaA: p.uaB, elA: p.elB, uaB: p.uaA, elB: p.elA,
                           thA: p.thB, knA: p.knB, thB: p.thA, knB: p.knA });

// ----------------------------------------------------------------------------
//  Poses clave
// ----------------------------------------------------------------------------
const CORRER_0 = P({ t: 16, h: -6, thA: 38, knA: 14, thB: -30, knB: 78,
                     uaA: -45, elA: 75, uaB: 55, elB: 95 });
const CORRER_1 = P({ t: 18, h: -6, thA: 4, knA: 26, thB: 34, knB: 115,
                     uaA: -10, elA: 70, uaB: 20, elB: 90 });

export const ANIMACIONES = {
  // Ciclo de 8 cuadros = 2 zancadas = 1 pulso. Los pies caen en corcheas.
  correr: { cuadros: 8, ciclo: true, apoyado: true,
            claves: [CORRER_0, CORRER_1, espejo(CORRER_0), espejo(CORRER_1)],
            // Un pequeño vuelo después de cada impulso: sin esto el trote se ve pesado.
            elevar: u => 5 * Math.max(0, Math.sin(4 * Math.PI * (u - 0.25))) },

  quieto: { cuadros: 4, ciclo: true, apoyado: true,
            claves: [P({ t: 8, thA: 12, knA: 22, thB: -10, knB: 20, uaA: -12, elA: 55, uaB: 25, elB: 65 }),
                     P({ t: 10, thA: 12, knA: 26, thB: -10, knB: 24, uaA: -8, elA: 60, uaB: 28, elB: 70 })] },

  salto: { cuadros: 3, apoyado: false, claves: [
    P({ t: 20, ry: 2, thA: 20, knA: 20, thB: -35, knB: 30, uaA: 70, elA: 60, uaB: -40, elB: 40 }),
    P({ t: 10, ry: -4, thA: 50, knA: 95, thB: -20, knB: 60, uaA: 125, elA: 30, uaB: 60, elB: 50 }),
    P({ t: 12, ry: -10, thA: 72, knA: 125, thB: 32, knB: 118, uaA: 100, elA: 60, uaB: 80, elB: 70 }) ] },

  caida: { cuadros: 2, apoyado: false, claves: [
    P({ t: 6, thA: 25, knA: 30, thB: -12, knB: 20, uaA: 150, elA: 10, uaB: -150, elB: 10 }),
    P({ t: 14, thA: 30, knA: 25, thB: -8, knB: 35, uaA: 70, elA: 40, uaB: -40, elB: 40 }) ] },

  // Salto de valla: una mano apoyada en el obstáculo, piernas pasando de costado.
  valla: { cuadros: 5, apoyado: false, claves: [
    P({ t: 35, ry: -6, thA: 30, knA: 40, thB: -30, knB: 60, uaA: 60, elA: 10, uaB: 20, elB: 60 }),
    P({ t: 55, rx: 4, ry: -14, thA: 80, knA: 70, thB: 70, knB: 40, uaA: 15, elA: 0, uaB: 90, elB: 30 }),
    P({ t: 65, ry: -18, thA: 100, knA: 30, thB: 95, knB: 20, uaA: 5, elA: 0, uaB: 120, elB: 20 }),
    P({ t: 30, ry: -8, thA: 60, knA: 20, thB: 40, knB: 40, uaA: -30, elA: 20, uaB: 140, elB: 10 }),
    P({ t: 18, ry: -2, thA: 25, knA: 20, thB: -10, knB: 40, uaA: -20, elA: 50, uaB: 60, elB: 50 }) ] },

  // Vuelo sobre un hueco: zancada larga en el aire, brazos arriba.
  vuelo: { cuadros: 4, apoyado: false, claves: [
    P({ t: 25, thA: 40, knA: 60, thB: -40, knB: 10, uaA: 90, elA: 20, uaB: -60, elB: 20 }),
    P({ t: 30, ry: -6, thA: 58, knA: 10, thB: -45, knB: 30, uaA: 110, elA: 10, uaB: -70, elB: 20 }),
    P({ t: 22, ry: -8, thA: 20, knA: 80, thB: 50, knB: 50, uaA: 150, elA: 10, uaB: -140, elB: 10 }),
    P({ t: 10, ry: -2, thA: 40, knA: 30, thB: 20, knB: 60, uaA: 70, elA: 40, uaB: -30, elB: 40 }) ] },

  // Barrida: cadera al piso, pierna cercana estirada, mano arrastrando atrás.
  desliz: { cuadros: 4, apoyado: true, claves: [
    P({ t: -20, thA: 70, knA: 30, thB: 30, knB: 90, uaA: -40, elA: 30, uaB: 50, elB: 60 }),
    P({ t: -55, thA: 86, knA: 0, thB: 55, knB: 122, uaA: -62, elA: 0, uaB: 80, elB: 40 }),
    P({ t: -52, thA: 86, knA: 2, thB: 55, knB: 118, uaA: -58, elA: 4, uaB: 92, elB: 30 }),
    P({ t: 10, thA: 60, knA: 75, thB: -10, knB: 95, uaA: 30, elA: 60, uaB: -20, elB: 60 }) ] },

  // Una bola: el motor la hace girar para la voltereta. Rotar es gratis.
  bola: { cuadros: 1, apoyado: false, claves: [
    P({ t: 62, h: 30, ry: 20, thA: 122, knA: 150, thB: 112, knB: 145, uaA: 110, elA: 100, uaB: 100, elB: 110 }) ] },

  trepa: { cuadros: 3, apoyado: false, claves: [
    P({ t: 25, ry: -12, uaA: 160, elA: 20, uaB: 150, elB: 30, thA: 20, knA: 60, thB: -10, knB: 70 }),
    P({ t: 40, ry: -14, uaA: 100, elA: 90, uaB: 90, elB: 100, thA: 70, knA: 110, thB: 20, knB: 90 }),
    P({ t: 20, ry: -6, uaA: 30, elA: 60, uaB: 40, elB: 60, thA: 80, knA: 120, thB: -20, knB: 60 }) ] },

  tropiezo: { cuadros: 3, apoyado: true, claves: [
    P({ t: -25, h: -15, uaA: 150, elA: 40, uaB: 130, elB: 60, thA: 20, knA: 30, thB: -15, knB: 40 }),
    P({ t: 30, h: 15, uaA: -80, elA: 60, uaB: 110, elB: 20, thA: -10, knA: 80, thB: 45, knB: 20 }),
    P({ t: 22, uaA: 40, elA: 70, uaB: -30, elB: 70, thA: 25, knA: 40, thB: -25, knB: 70 }) ] },

  atrapado: { cuadros: 2, apoyado: false, claves: [
    P({ t: -40, h: -20, ry: 6, uaA: 160, elA: 20, uaB: -150, elB: 30, thA: 30, knA: 20, thB: -20, knB: 50 }),
    P({ t: -70, h: -25, ry: 16, uaA: 120, elA: 40, uaB: 170, elB: 20, thA: 50, knA: 10, thB: 20, knB: 30 }) ] },

  cayendo: { cuadros: 2, ciclo: true, apoyado: false, claves: [
    P({ t: 0, ry: -10, uaA: 150, elA: 30, uaB: -140, elB: 40, thA: 40, knA: 60, thB: -30, knB: 20 }),
    P({ t: -10, ry: -10, uaA: -140, elA: 40, uaB: 150, elB: 30, thA: -20, knA: 30, thB: 50, knB: 70 }) ] },

  aterriza: { cuadros: 1, apoyado: true, claves: [
    P({ t: 28, thA: 48, knA: 105, thB: -12, knB: 88, uaA: 40, elA: 70, uaB: -30, elB: 60 }) ] },

  // El perseguidor estirando los brazos cuando te alcanza.
  alcanzar: { cuadros: 2, ciclo: true, apoyado: true, claves: [
    P({ ...CORRER_0, t: 26, uaA: 82, elA: 6, uaB: 96, elB: 12 }),
    P({ ...espejo(CORRER_0), t: 26, uaA: 90, elA: 10, uaB: 100, elB: 8 }) ] },
};

// ----------------------------------------------------------------------------
//  Cinemática directa: de ángulos a posiciones
// ----------------------------------------------------------------------------
function cinematica(p, ax, ay) {
  const cad = { x: ax + p.rx, y: ay - (L.MUSLO + L.CANILLA) + p.ry };
  const t = p.t * RAD, st = Math.sin(t), ct = Math.cos(t);
  const cuello = { x: cad.x + st * L.TORSO, y: cad.y - ct * L.TORSO };
  const hh = (p.t + p.h) * RAD;
  const cabeza = { x: cuello.x + Math.sin(hh) * (L.CUELLO + L.CABEZA),
                   y: cuello.y - Math.cos(hh) * (L.CUELLO + L.CABEZA) };
  const hombro = { x: cad.x + st * (L.TORSO - 3), y: cad.y - ct * (L.TORSO - 3) };

  const brazo = (ua, el) => {
    const a = ua * RAD, b = (ua + el) * RAD;
    const codo = { x: hombro.x + Math.sin(a) * L.BRAZO, y: hombro.y + Math.cos(a) * L.BRAZO };
    const mano = { x: codo.x + Math.sin(b) * L.ANTEBRAZO, y: codo.y + Math.cos(b) * L.ANTEBRAZO };
    return { codo, mano };
  };
  const pierna = (th, kn) => {
    const a = th * RAD, b = (th - kn) * RAD, c = (th - kn + 80) * RAD;
    const rodilla = { x: cad.x + Math.sin(a) * L.MUSLO, y: cad.y + Math.cos(a) * L.MUSLO };
    const tobillo = { x: rodilla.x + Math.sin(b) * L.CANILLA, y: rodilla.y + Math.cos(b) * L.CANILLA };
    const punta = { x: tobillo.x + Math.sin(c) * L.PIE, y: tobillo.y + Math.cos(c) * L.PIE };
    return { rodilla, tobillo, punta };
  };

  return { cad, cuello, cabeza, hombro,
           bA: brazo(p.uaA, p.elA), bB: brazo(p.uaB, p.elB),
           pA: pierna(p.thA, p.knA), pB: pierna(p.thB, p.knB) };
}

// Corre todos los puntos del esqueleto la misma cantidad (para apoyar los pies).
function trasladar(j, dx, dy) {
  const mover = o => { for (const k in o) { const v = o[k]; if (v.x !== undefined) { v.x += dx; v.y += dy; } else mover(v); } };
  mover(j);
}

function linea(ctx, a, b, grosor) {
  ctx.lineWidth = grosor;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function dibujar(ctx, j) {
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pierna = pp => {
    linea(ctx, j.cad, pp.rodilla, G.MUSLO);
    linea(ctx, pp.rodilla, pp.tobillo, G.CANILLA);
    linea(ctx, pp.tobillo, pp.punta, G.PIE);
  };
  const brazo = bb => {
    linea(ctx, j.hombro, bb.codo, G.BRAZO);
    linea(ctx, bb.codo, bb.mano, G.ANTEBRAZO);
    ctx.beginPath(); ctx.arc(bb.mano.x, bb.mano.y, G.MANO, 0, Math.PI * 2); ctx.fill();
  };
  brazo(j.bB);
  pierna(j.pB);
  linea(ctx, j.cad, j.cuello, G.TORSO);
  ctx.beginPath(); ctx.arc(j.cabeza.x, j.cabeza.y, L.CABEZA, 0, Math.PI * 2); ctx.fill();
  pierna(j.pA);
  brazo(j.bA);
}

function mezclar(a, b, k) {
  const r = {};
  for (const key in BASE) r[key] = a[key] + (b[key] - a[key]) * k;
  return r;
}

// Pose interpolada de una animación en u ∈ [0, 1)
function poseEn(anim, u) {
  const c = anim.claves;
  if (c.length === 1) return c[0];
  if (anim.ciclo) {
    const pos = u * c.length, i = Math.floor(pos) % c.length;
    return mezclar(c[i], c[(i + 1) % c.length], pos - Math.floor(pos));
  }
  const pos = u * (c.length - 1), i = Math.min(c.length - 2, Math.floor(pos));
  const k = pos - i;
  return mezclar(c[i], c[i + 1], k * k * (3 - 2 * k));   // suavizado entre claves
}

// ----------------------------------------------------------------------------
//  Hornear: devuelve la lista de cuadros a meter en el atlas, cada uno con su
//  función de dibujo y los datos que el juego necesita (dónde está el cuello
//  para la bufanda, dónde está la cabeza para los ojos del perseguidor).
// ----------------------------------------------------------------------------
export function cuadrosDelPersonaje() {
  const lista = [];
  for (const nombre in ANIMACIONES) {
    const anim = ANIMACIONES[nombre];
    for (let i = 0; i < anim.cuadros; i++) {
      const u = anim.ciclo ? i / anim.cuadros : (anim.cuadros === 1 ? 0 : i / (anim.cuadros - 1));
      const pose = poseEn(anim, u);
      const j = cinematica(pose, CUADRO.ANCLA_X, CUADRO.ANCLA_Y);

      if (anim.apoyado) {
        // Los pies tocan el piso por geometría: rodillas dobladas = cadera baja.
        const pies = [j.pA.tobillo, j.pA.punta, j.pB.tobillo, j.pB.punta];
        let abajo = -Infinity;
        for (const q of pies) abajo = Math.max(abajo, q.y);
        const elevar = anim.elevar ? anim.elevar(u) : 0;
        trasladar(j, 0, CUADRO.ANCLA_Y - (abajo + G.PIE / 2) - elevar);
      }

      const meta = {
        cuelloX: j.cuello.x - CUADRO.ANCLA_X, cuelloY: j.cuello.y - CUADRO.ANCLA_Y,
        cabezaX: j.cabeza.x - CUADRO.ANCLA_X, cabezaY: j.cabeza.y - CUADRO.ANCLA_Y,
        centroX: j.cad.x, centroY: j.cad.y,   // en coordenadas del cuadro
      };
      lista.push({
        nombre: `${nombre}_${i}`, w: CUADRO.W, h: CUADRO.H, meta,
        dibujar: (ctx, x, y) => {
          ctx.save();
          ctx.translate(x, y);
          dibujar(ctx, j);
          ctx.restore();
        },
      });
    }
  }
  return lista;
}
