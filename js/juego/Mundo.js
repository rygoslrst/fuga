// ============================================================================
//  Mundo.js — el terreno y su dibujo
// ----------------------------------------------------------------------------
//  El terreno es una tira de columnas de 70 px. Por columna se guarda: altura
//  del techo (o hueco), obstáculo, cartel y si ya se superó o se chocó.
//  Se guarda en arreglos tipados circulares: no se crea nada mientras corre.
//
//  Todo lo que se ve (edificios, ventanas, obstáculos, carteles) sale de pools
//  creados al arrancar. Cuando algo sale de pantalla por la izquierda, vuelve
//  al pool. Durante la partida no se crea ni se destruye ningún objeto.
// ============================================================================

import { PX_POR_COLUMNA as COL, TERRENO, yDeNivel, COLOR, RENDIMIENTO, ALTO } from '../config.js';
import { OBST } from './Generador.js';

const MASK = 4095;

// Cajas de colisión: un poco más chicas que el dibujo. Rozar el borde de una
// caja no tiene que contar como choque: eso es lo que se siente "justo".
export const OBST_INFO = {
  [OBST.CAJA]: { marco: 'caja', w: 38, h: 42 },
  [OBST.VENT]: { marco: 'ventilacion', w: 44, h: 38 },
  [OBST.MAQ]: { marco: 'maquina', w: 52, h: 48 },
};
export const CARTEL = { BASE: 52, ALTO: 118 };   // el borde de abajo, a 52 px del techo

export const ESTADO = { PENDIENTE: 0, SUPERADO: 1, CHOCADO: 2 };

class Pool {
  constructor(crear, n) {
    this.libres = [];
    for (let i = 0; i < n; i++) {
      const o = crear();
      o.setActive(false).setVisible(false);
      this.libres.push(o);
    }
  }
  tomar() {
    const o = this.libres.pop();
    if (o) o.setActive(true).setVisible(true);
    return o || null;
  }
  soltar(o) { o.setActive(false).setVisible(false); this.libres.push(o); }
}

// Azar determinista por columna: el mismo edificio siempre tiene las mismas ventanas.
function hash(n) {
  let x = (n * 2654435761) >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

export class Mundo {
  constructor(escena) {
    this.escena = escena;
    this.nivel = new Int8Array(MASK + 1);
    this.obst = new Uint8Array(MASK + 1);
    this.barra = new Uint8Array(MASK + 1);
    this.estado = new Uint8Array(MASK + 1);

    const img = (frame, depth) => () => escena.add.image(0, 0, 'atlas', frame).setDepth(depth);
    this.pEdificios = new Pool(img('blanco', 5), RENDIMIENTO.EDIFICIOS_POOL);
    this.pCornisas = new Pool(img('blanco', 5.5), RENDIMIENTO.EDIFICIOS_POOL);
    this.pVentanas = new Pool(img('blanco', 6), RENDIMIENTO.VENTANAS_POOL);
    this.pObst = new Pool(img('caja', 7), RENDIMIENTO.OBSTACULOS_POOL);
    this.pCarteles = new Pool(img('cartel', 7), RENDIMIENTO.OBSTACULOS_POOL);
    this.pCables = new Pool(img('blanco', 4), RENDIMIENTO.OBSTACULOS_POOL);
    this.pMonedas = new Pool(img('moneda', 8), RENDIMIENTO.MONEDAS_POOL);

    // Monedas: a lo sumo una por columna. monY = altura en pantalla (0 = no
    // hay), monDX = corrimiento desde el centro de la columna.
    this.monY = new Int16Array(MASK + 1);
    this.monDX = new Int8Array(MASK + 1);

    // Lo que está en pantalla, con el borde derecho para saber cuándo sacarlo.
    this.vivos = [];        // { obj, pool, der, col?, mapa? }
    this.volando = [];      // obstáculos chocados que salen despedidos
    this.obstPorCol = new Map();
    this.monPorCol = new Map();
    this.reloj = 0;
  }

  reiniciar(generador) {
    for (const v of this.vivos) v.pool.soltar(v.obj);
    for (const v of this.volando) this.pObst.soltar(v.obj);
    this.vivos.length = 0;
    this.volando.length = 0;
    this.obstPorCol.clear();
    this.monPorCol.clear();
    this.nivel.fill(0); this.obst.fill(0); this.barra.fill(0); this.estado.fill(0);
    this.monY.fill(0); this.monDX.fill(0);
    this.generador = generador;
    this.colGen = 0;
    this.colVis = 0;
    this.colMon = 0;
  }

  // --------------------------------------------------------------------------
  //  Consultas
  // --------------------------------------------------------------------------
  nivelEnCol(col) { return this.nivel[(col < 0 ? 0 : col) & MASK]; }

  // Altura del techo en la x dada, o null si ahí hay un hueco.
  superficie(x) {
    const n = this.nivelEnCol(Math.floor(x / COL));
    return n < 0 ? null : yDeNivel(n);
  }

  hayHueco(col) { return this.nivelEnCol(col) < 0; }
  obstEn(col) { return col < 0 ? 0 : this.obst[col & MASK]; }
  barraEn(col) { return col < 0 ? 0 : this.barra[col & MASK]; }
  estadoEn(col) { return this.estado[col & MASK]; }
  marcar(col, e) { this.estado[col & MASK] = e; }
  monedaY(col) { return col < 0 ? 0 : this.monY[col & MASK]; }
  monedaX(col) { return col * COL + COL / 2 + this.monDX[col & MASK]; }

  // Caja de colisión de lo que haya en la columna: [izq, der, arriba, abajo]
  cajaObst(col, fuera) {
    const info = OBST_INFO[this.obstEn(col)];
    const y = yDeNivel(this.nivelEnCol(col));
    const cx = col * COL + COL / 2;
    fuera[0] = cx - info.w / 2; fuera[1] = cx + info.w / 2;
    fuera[2] = y - info.h; fuera[3] = y;
    return fuera;
  }

  cajaCartel(col, fuera) {
    const y = yDeNivel(this.nivelEnCol(col));
    fuera[0] = col * COL; fuera[1] = col * COL + COL;
    fuera[3] = y - CARTEL.BASE; fuera[2] = fuera[3] - CARTEL.ALTO;
    return fuera;
  }

  // --------------------------------------------------------------------------
  //  Generación: siempre al menos hasta xDerecha
  // --------------------------------------------------------------------------
  asegurar(xDerecha) {
    const objetivo = Math.ceil(xDerecha / COL) + 6;
    while (this.colGen < objetivo) this.escribir(this.generador.siguiente());
    this.construir();
    this.construirMonedas();
  }

  escribir({ seg, offset }) {
    const x0 = this.colGen * COL;
    for (let c = 0; c < seg.n; c++) {
      const i = this.colGen & MASK;
      this.nivel[i] = seg.niv[c] < 0 ? -1 : seg.niv[c] + offset;
      this.obst[i] = seg.obs[c];
      this.barra[i] = seg.bar[c];
      this.estado[i] = ESTADO.PENDIENTE;
      this.monY[i] = 0;
      this.colGen++;
    }
    for (const m of seg.monedas) {
      const x = x0 + m.x, col = Math.floor(x / COL), i = col & MASK;
      if (this.monY[i]) continue;                         // una por columna: gana la primera
      this.monY[i] = Math.round(yDeNivel(m.nivel + offset) - m.h);
      this.monDX[i] = Math.round(x - (col * COL + COL / 2));
    }
  }

  construirMonedas() {
    while (this.colMon < this.colGen) {
      const c = this.colMon++;
      if (!this.monY[c & MASK]) continue;
      const o = this.pMonedas.tomar();
      if (!o) continue;
      o.setPosition(this.monedaX(c), this.monY[c & MASK]).setScale(1);
      const reg = { obj: o, pool: this.pMonedas, der: c * COL + COL, col: c, mapa: this.monPorCol };
      this.vivos.push(reg);
      this.monPorCol.set(c, reg);
    }
  }

  // La moneda deja de existir en el terreno y su dibujo vuelve al pool.
  recogerMoneda(col) {
    this.monY[col & MASK] = 0;
    const reg = this.monPorCol.get(col);
    if (!reg) return;
    this.monPorCol.delete(col);
    const i = this.vivos.indexOf(reg);
    if (i >= 0) { this.vivos[i] = this.vivos[this.vivos.length - 1]; this.vivos.pop(); }
    reg.pool.soltar(reg.obj);
  }

  // Agrupa columnas de igual altura en edificios. Un edificio no pasa de 10
  // columnas: más variedad visual, y el dibujo nunca se atrasa a la generación.
  construir() {
    while (this.colVis < this.colGen - 1) {
      const c = this.colVis;
      const n = this.nivelEnCol(c);
      if (n < 0) { this.colVis++; continue; }
      let e = c + 1;
      while (e < this.colGen && this.nivelEnCol(e) === n && e - c < 10) e++;
      if (e === this.colGen && e - c < 10) break;
      this.edificio(c, e, n);
      this.colVis = e;
    }
  }

  vivo(obj, pool, der) { this.vivos.push({ obj, pool, der }); }

  edificio(c0, c1, n) {
    const x0 = c0 * COL, w = (c1 - c0) * COL, y = yDeNivel(n);
    const cuerpo = this.pEdificios.tomar();
    if (cuerpo) {
      cuerpo.setOrigin(0, 0).setPosition(x0, y).setDisplaySize(w + 1, ALTO - y + 60).setTint(COLOR.EDIFICIO);
      this.vivo(cuerpo, this.pEdificios, x0 + w);
    }
    const cornisa = this.pCornisas.tomar();
    if (cornisa) {
      cornisa.setOrigin(0, 0).setPosition(x0 - 3, y - 3).setDisplaySize(w + 6, 6).setTint(0x2e2250);
      this.vivo(cornisa, this.pCornisas, x0 + w + 3);
    }

    // Ventanas encendidas: le dan vida a la ciudad y cuestan un sprite cada una.
    const r = hash(c0 + n * 7919);
    for (let vy = y + 22; vy < ALTO - 10; vy += 30) {
      for (let vx = x0 + 12; vx < x0 + w - 16; vx += 22) {
        if (r() > 0.3) continue;
        const v = this.pVentanas.tomar();
        if (!v) break;
        v.setOrigin(0, 0).setPosition(vx, vy).setDisplaySize(9, 13).setTint(COLOR.VENTANA).setAlpha(0.3 + r() * 0.5);
        this.vivo(v, this.pVentanas, vx + 9);
      }
    }

    for (let col = c0; col < c1; col++) {
      const tipo = this.obstEn(col);
      if (tipo) {
        const o = this.pObst.tomar();
        if (o) {
          o.setFrame(OBST_INFO[tipo].marco).setOrigin(0.5, 1).setPosition(col * COL + COL / 2, y + 1)
           .setTint(COLOR.EDIFICIO).setAngle(0).setAlpha(1);
          const reg = { obj: o, pool: this.pObst, der: col * COL + COL, col, mapa: this.obstPorCol };
          this.vivos.push(reg);
          this.obstPorCol.set(col, reg);
        }
      }
      if (this.barraEn(col)) {
        const k = this.pCarteles.tomar();
        const base = y - CARTEL.BASE;
        if (k) {
          k.setOrigin(0, 1).setPosition(col * COL - 1, base).setTint(COLOR.EDIFICIO);
          this.vivo(k, this.pCarteles, col * COL + COL);
        }
        const cable = this.pCables.tomar();
        if (cable) {
          const arriba = base - CARTEL.ALTO;
          cable.setOrigin(0.5, 1).setPosition(col * COL + COL / 2, arriba + 1)
               .setDisplaySize(2, arriba + 20).setTint(COLOR.EDIFICIO);
          this.vivo(cable, this.pCables, col * COL + COL);
        }
      }
    }
  }

  // Un obstáculo chocado sale volando: el choque se VE, no sólo se siente.
  despedir(col) {
    const reg = this.obstPorCol.get(col);
    if (!reg) return;
    const i = this.vivos.indexOf(reg);
    if (i >= 0) { this.vivos[i] = this.vivos[this.vivos.length - 1]; this.vivos.pop(); }
    this.obstPorCol.delete(col);
    this.volando.push({ obj: reg.obj, vx: 420, vy: -520, vr: 620 });
  }

  // --------------------------------------------------------------------------
  //  Por cuadro: sacar lo que quedó atrás y mover lo que vuela
  // --------------------------------------------------------------------------
  actualizar(camX, dt) {
    const limite = camX - 60;
    this.reloj += dt;
    for (let i = this.vivos.length - 1; i >= 0; i--) {
      const v = this.vivos[i];
      if (v.der < limite) {
        if (v.mapa) v.mapa.delete(v.col);
        v.pool.soltar(v.obj);
        this.vivos[i] = this.vivos[this.vivos.length - 1];
        this.vivos.pop();
      } else if (v.pool === this.pMonedas) {
        // Giran en ola: cada una un poco después que la anterior.
        v.obj.scaleX = 0.3 + 0.7 * Math.abs(Math.cos(this.reloj * 4 - v.col * 0.8));
      }
    }

    for (let i = this.volando.length - 1; i >= 0; i--) {
      const v = this.volando[i];
      v.vy += 1600 * dt;
      v.obj.x += v.vx * dt;
      v.obj.y += v.vy * dt;
      v.obj.angle += v.vr * dt;
      if (v.obj.y > ALTO + 120) {
        this.pObst.soltar(v.obj);
        this.volando[i] = this.volando[this.volando.length - 1];
        this.volando.pop();
      }
    }
  }
}
