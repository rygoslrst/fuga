// ============================================================================
//  Perseguidor.js — el que te sigue
// ----------------------------------------------------------------------------
//  Es tu sombra: el mismo personaje pintado de rojo sólido. No tiene
//  inteligencia ni física propia: pisa exactamente por donde pisaste vos, con
//  tus mismas poses, unos píxeles más atrás. Nunca se cae en un hueco que vos
//  pasaste, y queda inquietante: te copia.
//
//  Lo único que importa es la VENTAJA (en la escena): la distancia que te saca.
//  Cada choque la achica; correr limpio y los trucos la agrandan.
// ============================================================================

import { PERSEGUIDOR, COLOR, RITMO, PX_POR_COLUMNA as COL, yDeNivel } from '../config.js';
import { CUADRO, FR } from '../motor/Sprites.js';

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
    // setTintFill: reemplaza los colores del sprite por uno solo y conserva la
    // forma. El mismo corredor, convertido en silueta roja.
    this.sprite = escena.add.image(0, 0, 'atlas', FR.correr[0])
      .setOrigin(ORIGEN_X, ORIGEN_Y).setScale(s).setTintFill(COLOR.PERSEGUIDOR).setDepth(8);
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
      frame = this.correrEn(xp);
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
      if (!forzado) frame = this.correrEn(xp);
    }

    const e = PERSEGUIDOR.ESCALA;
    this.sprite.setFrame(frame).setPosition(xp, y);

    // El ojo: lo que hace que se lo reconozca como amenaza de un vistazo. En
    // las poses dadas vuelta (voltereta, barrida) no se muestra.
    const m = this.meta[frame];
    const conOjos = !m.sinOjos;
    this.ojo.setVisible(conOjos);
    this.halo.setVisible(conOjos);
    if (conOjos) {
      const ex = xp + (m.cabezaX + 2) * e, ey = y + m.cabezaY * e;
      this.ojo.setPosition(ex, ey);
      this.halo.setPosition(ex, ey).setAlpha(0.7 + 0.3 * Math.sin(t * 10));
    }
  }

  // Cuadro de carrera según su propia posición: un ciclo cada pulso, como vos.
  correrEn(x) {
    const n = FR.correr.length;
    const fase = x / RITMO.PX_POR_PULSO;
    return FR.correr[Math.floor((fase - Math.floor(fase)) * n) % n];
  }
}
