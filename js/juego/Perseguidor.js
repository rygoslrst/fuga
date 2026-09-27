// ============================================================================
//  Perseguidor.js — el que te sigue
// ----------------------------------------------------------------------------
//  No tiene inteligencia ni física propia: pisa exactamente por donde pisaste
//  vos, con tus mismas poses, unos píxeles más atrás. Eso garantiza que nunca
//  se caiga en un hueco que vos pasaste, y queda inquietante: te copia.
//
//  Lo único que importa es la VENTAJA (en la escena): la distancia que te saca.
//  Cada choque la achica; correr limpio y los trucos la agrandan.
// ============================================================================

import { PERSEGUIDOR, COLOR, RITMO, PX_POR_COLUMNA as COL, yDeNivel } from '../config.js';
import { CUADRO } from '../motor/Esqueleto.js';
import { FR } from './Jugador.js';

const N = 512;
const ORIGEN_X = CUADRO.ANCLA_X / CUADRO.W;
const ORIGEN_Y = CUADRO.ANCLA_Y / CUADRO.H;

// Poses del corredor que el perseguidor NO copia: él no se tropieza.
const REEMPLAZO = {};
for (const f of FR.tropiezo) REEMPLAZO[f] = FR.correr[2];
for (const f of FR.trepa) REEMPLAZO[f] = FR.salto[2];

export class Perseguidor {
  constructor(escena, mundo, meta) {
    this.mundo = mundo;
    this.meta = meta;
    const s = PERSEGUIDOR.ESCALA;
    this.sprite = escena.add.image(0, 0, 'atlas', FR.correr[0])
      .setOrigin(ORIGEN_X, ORIGEN_Y).setScale(s).setTint(COLOR.PERSEGUIDOR).setDepth(8);
    this.halo = escena.add.image(0, 0, 'atlas', 'brillo')
      .setTint(COLOR.OJOS).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setDepth(8.4);
    this.ojo = escena.add.image(0, 0, 'atlas', 'punto').setTint(0xffe8e8).setScale(0.42).setDepth(8.5);

    this.hx = new Float32Array(N);
    this.hy = new Float32Array(N);
    this.ha = new Float32Array(N);
    this.hf = new Array(N).fill(FR.correr[0]);
    this.reiniciar();
  }

  reiniciar() {
    this.n = 0;
    this.cabeza = 0;
    this.visible(false);
  }

  visible(v) {
    this.sprite.setVisible(v);
    this.halo.setVisible(v);
    this.ojo.setVisible(v);
  }

  // Guarda un punto del recorrido del corredor (sólo si avanzó).
  registrar(x, y, frame, ang) {
    if (this.n > 0 && x <= this.hx[(this.cabeza - 1 + N) % N]) return;
    const i = this.cabeza;
    this.hx[i] = x; this.hy[i] = y; this.hf[i] = frame; this.ha[i] = ang;
    this.cabeza = (i + 1) % N;
    if (this.n < N) this.n++;
  }

  // forzado: nombre de cuadro para imponer una pose (quieto en el título,
  // brazos estirados cuando te alcanza). null = copia tu recorrido.
  actualizar(xJugador, ventaja, forzado, t) {
    const xp = xJugador - ventaja;
    let y, frame, ang = 0;

    // Busca en el recorrido, del más nuevo al más viejo, el punto donde está.
    let encontrado = -1;
    for (let k = 1; k <= this.n; k++) {
      const i = (this.cabeza - k + N) % N;
      if (this.hx[i] <= xp) { encontrado = i; break; }
    }
    if (encontrado < 0) {
      const sup = this.mundo.superficie(xp);
      y = sup === null ? yDeNivel(0) : sup;
      frame = FR.correr[Math.floor((xp / RITMO.PX_POR_PULSO) * 8) & 7];
    } else {
      const sig = (encontrado + 1) % N;
      const hayCabeza = sig !== this.cabeza;
      const x0 = this.hx[encontrado], x1 = hayCabeza ? this.hx[sig] : x0;
      const k = x1 > x0 ? (xp - x0) / (x1 - x0) : 0;
      y = this.hy[encontrado] + (hayCabeza ? (this.hy[sig] - this.hy[encontrado]) * k : 0);
      frame = this.hf[encontrado];
      ang = this.ha[encontrado];
      frame = REEMPLAZO[frame] || frame;
    }
    if (forzado) {
      frame = forzado;
      ang = 0;
    }

    // Él no se cae: si vos caíste en un hueco y trepaste, él lo cruza de un
    // salto. Y nunca se hunde por debajo de un techo.
    const sup = this.mundo.superficie(xp);
    if (sup === null) {
      let cL = Math.floor(xp / COL), cR = cL;
      while (this.mundo.hayHueco(cL - 1) && cL > 0) cL--;
      while (this.mundo.hayHueco(cR + 1)) cR++;
      const x0 = cL * COL, x1 = (cR + 1) * COL, u = (xp - x0) / (x1 - x0);
      const yA = yDeNivel(this.mundo.nivelEnCol(cL - 1)), yB = yDeNivel(this.mundo.nivelEnCol(cR + 1));
      const arco = yA + (yB - yA) * u - 90 * Math.sin(Math.PI * u);
      if (y > arco) { y = arco; if (!forzado) { frame = FR.vuelo[1]; ang = 0; } }
    } else if (y > sup) {
      y = sup;
      if (!forzado && frame !== FR.bola) frame = FR.correr[Math.floor((xp / RITMO.PX_POR_PULSO) * 8) & 7];
    }

    const s = this.sprite, e = PERSEGUIDOR.ESCALA;
    if (frame === FR.bola) {
      const mb = this.meta[FR.bola];
      s.setFrame(frame).setOrigin(mb.centroX / CUADRO.W, mb.centroY / CUADRO.H).setAngle(ang)
       .setPosition(xp, y - (CUADRO.ANCLA_Y - mb.centroY) * e);
      this.ojo.setVisible(false);
      this.halo.setVisible(false);
      return;
    }
    s.setFrame(frame).setOrigin(ORIGEN_X, ORIGEN_Y).setAngle(0).setPosition(xp, y);

    // Los ojos: lo que hace que se lo reconozca como amenaza de un vistazo.
    const m = this.meta[frame];
    const ex = xp + (m.cabezaX + 3.5) * e, ey = y + (m.cabezaY - 1) * e;
    this.ojo.setVisible(true).setPosition(ex, ey);
    this.halo.setVisible(true).setPosition(ex, ey).setAlpha(0.7 + 0.3 * Math.sin(t * 10));
  }
}
