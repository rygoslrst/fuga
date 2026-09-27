// ============================================================================
//  Jugador.js — física, acrobacias y dibujo del corredor
// ----------------------------------------------------------------------------
//  FÍSICA. La x no se integra: es el pulso de la música multiplicado por los
//  píxeles por pulso. La altura del salto es una parábola cerrada contra el
//  mismo reloj. Resultado: el salto dura exactamente un pulso a 60 fps y a 20.
//
//  SUBPASOS. Si un cuadro tarda (un celular que tironea), el corredor puede
//  avanzar 30 px de golpe y atravesar una caja sin tocarla. Por eso cada cuadro
//  se simula en pasitos de 8 px: la colisión nunca se saltea.
//
//  ACROBACIAS. Dos acciones, pero el salto cambia según lo que tengas enfrente:
//  caja adelante = voltereta sobre la caja; hueco adelante = vuelo. Barrerse
//  en el aire = caés rodando.
// ============================================================================

import { SALTO, DESLIZ, TERRENO, PX_POR_COLUMNA as COL, RITMO, PERSEGUIDOR, PUNTOS, COLOR,
         fisicaSalto, segPorPulso, yDeNivel } from '../config.js';
import { CUADRO, ALTURAS, FR } from '../motor/Sprites.js';
import { ESTADO } from './Mundo.js';

// Caja de colisión del corredor: un poco más chica que el dibujo (de pie mide
// 90 px, barriéndose 45). Rozar algo con el borde del dibujo no es un choque:
// eso es lo que se siente justo.
const HB = { MEDIO: 13, ALTO: ALTURAS.DE_PIE - 12, BAJO: 32 };
const ORIGEN_X = CUADRO.ANCLA_X / CUADRO.W;
const ORIGEN_Y = CUADRO.ANCLA_Y / CUADRO.H;

const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
const caja = [0, 0, 0, 0];

export class Jugador {
  constructor(escena, mundo, audio) {
    this.escena = escena;
    this.mundo = mundo;
    this.audio = audio;

    // Sin tint: el corredor muestra sus propios colores (y su bufanda roja).
    this.sprite = escena.add.image(0, 0, 'atlas', FR.quieto[0])
      .setOrigin(ORIGEN_X, ORIGEN_Y).setDepth(10);

    this.a = { t0: 0, y0: 0, v0: 0, g: 1, T: 0.5, tipo: 'salto' };
    this.frame = FR.quieto[0];
    this.angulo = 0;          // el perseguidor lo lee; con sprites siempre es 0
  }

  reiniciar(x) {
    this.x = x;
    this.y = this.yBase = yDeNivel(0);
    this.estado = 'quieto';
    this.combo = 0;
    this.puntosTrucos = 0;
    this.trucos = 0;
    this.golpes = 0;
    this.invulnerableHasta = -1;
    this.tGolpe = -9;
    this.tAterrizo = -9;
    this.tUltSuelo = 0;
    this.volteretaPedida = false;
    this.tVolteretaPedida = 0;
    this.voltereta = false;
    this.cruzoHueco = false;
    this.colgando = false;
    this.yMin = this.yDespegue = this.y;
    this.tDesliz = 0;
    this.durDesliz = 0;
    this.colRevisada = Math.floor(x / COL);
    this.pedidoSalto = -9;
    this.pedidoDesliz = -9;
    this.muerte = null;
    this.sprite.setAlpha(1);
    this.dibujar(0, 0);
  }

  empezar() { this.estado = 'suelo'; }

  pedirSalto(t) { this.pedidoSalto = t; }
  pedirDesliz(t) { this.pedidoDesliz = t; }

  get vivo() { return this.estado !== 'muerto'; }
  get agachado() { return this.estado === 'desliz'; }

  // --------------------------------------------------------------------------
  //  Simulación: de tPrev a t en pasitos de 8 px
  // --------------------------------------------------------------------------
  paso(tPrev, t, xEn) {
    const dx = xEn(t) - xEn(tPrev);
    const n = Math.max(1, Math.min(40, Math.ceil(dx / 8)));
    for (let i = 1; i <= n; i++) {
      this.pasoFino(tPrev + (t - tPrev) * i / n, xEn);
      if (this.estado === 'muerto') break;
    }
  }

  pasoFino(ts, xEn) {
    this.x = xEn(ts);
    const sup = this.mundo.superficie(this.x);
    const quiereSaltar = this.pedidoSalto <= ts && ts - this.pedidoSalto <= SALTO.BUFFER_MS / 1000;
    const quiereDesliz = this.pedidoDesliz <= ts && ts - this.pedidoDesliz <= DESLIZ.BUFFER_MS / 1000;

    switch (this.estado) {
      case 'suelo':
      case 'desliz': {
        if (sup === null || sup > this.yBase + 3) { this.caer(ts); break; }
        if (sup < this.yBase - 3) { this.pared(ts, sup); break; }
        this.y = this.yBase = sup;
        this.tUltSuelo = ts;
        if (this.estado === 'desliz' && ts - this.tDesliz >= this.durDesliz) {
          // Si todavía hay un cartel encima, seguís agachado hasta salir.
          if (this.carteEncima()) this.durDesliz += 0.03;
          else { this.estado = 'suelo'; this.voltereta = false; }
        }
        if (quiereSaltar) {
          // Pedir saltar todavía debajo de un cartel es lo natural (ya viene
          // la caja siguiente). Pararse ahí sería comérselo: el salto queda en
          // espera y sale justo al dejar el cartel atrás.
          if (this.estado === 'desliz' && this.bajoCartel()) this.pedidoSalto = ts;
          else this.saltar(ts);
        } else if (quiereDesliz) this.deslizar(ts);
        break;
      }
      case 'aire': {
        const a = this.a, dt = ts - a.t0;
        const yN = a.y0 - a.v0 * dt + 0.5 * a.g * dt * dt;
        const vy = a.v0 - a.g * dt;
        // Tiempo de coyote: saltar un instante después de dejar el borde vale.
        if (a.tipo === 'caida' && quiereSaltar && ts - this.tUltSuelo <= SALTO.COYOTE_MS / 1000) {
          this.y = this.yBase;
          this.saltar(ts);
          break;
        }
        if (quiereDesliz && !this.volteretaPedida) {
          this.volteretaPedida = true;
          this.tVolteretaPedida = ts;
          this.pedidoDesliz = -9;
        }
        if (sup !== null) {
          if (vy <= 0 && yN >= sup && this.y <= sup + 6) { this.aterrizar(ts, sup); break; }
          if (yN > sup + 6) {
            // Llegaste al edificio de enfrente por debajo del borde: te agarrás
            // y trepás. Si venías colgando de un hueco, cuesta mucho más.
            if (this.colgando || yN - sup > 70) this.caidaEnHueco(ts, sup);
            else this.pared(ts, sup);
            break;
          }
          this.y = yN;
        } else {
          this.cruzoHueco = true;
          // Caer en un hueco no mata: caés hasta la altura del borde del
          // edificio siguiente y quedás colgando hasta llegar a él. Todo error
          // pasa por la persecución, que es lo que se entiende de un vistazo.
          const tope = this.bordeSiguiente() + 58;
          if (yN > tope) { this.y = tope; this.colgando = true; }
          else this.y = yN;
        }
        if (this.y < this.yMin) this.yMin = this.y;
        if (this.y > TERRENO.LINEA_MUERTE) this.morir('caida', this.x);   // no debería pasar nunca
        break;
      }
      case 'trepa': {
        const p = (ts - this.tr0) / this.trDur;
        if (p >= 1) {
          this.estado = 'suelo';
          this.y = this.yBase = this.trY1;
          this.tUltSuelo = ts;
        } else {
          this.y = this.trY0 + (this.trY1 - this.trY0) * (1 - (1 - p) * (1 - p));
        }
        break;
      }
      default:
        return;
    }
    if (this.estado !== 'muerto' && this.estado !== 'trepa') this.colisiones(ts);
    if (this.estado !== 'muerto') this.revisarTrucos(ts);
  }

  // --------------------------------------------------------------------------
  //  Acciones
  // --------------------------------------------------------------------------
  saltar(ts) {
    const f = fisicaSalto(this.audio.bpmEn(ts));
    const a = this.a;
    a.t0 = ts; a.y0 = this.y; a.v0 = f.v0; a.g = f.g; a.T = f.T;
    a.tipo = this.tipoDeSalto();
    this.estado = 'aire';
    this.pedidoSalto = -9;
    this.pedidoDesliz = -9;
    this.yDespegue = this.yMin = this.y;
    this.cruzoHueco = false;
    this.colgando = false;
    this.volteretaPedida = false;
    this.voltereta = false;
    this.audio.salto();
    this.escena.efectos.polvo(this.x, this.y, 4, -1);
  }

  // Mira lo que hay en el largo de un salto y elige la acrobacia.
  tipoDeSalto() {
    const c0 = Math.floor((this.x + 10) / COL);
    const c1 = Math.floor((this.x + RITMO.PX_POR_PULSO * 0.8) / COL);
    for (let c = c0; c <= c1; c++) {
      if (this.mundo.obstEn(c) && this.mundo.estadoEn(c) === ESTADO.PENDIENTE) return 'valla';
    }
    const c2 = Math.floor((this.x + RITMO.PX_POR_PULSO) / COL);
    for (let c = Math.floor(this.x / COL); c <= c2; c++) if (this.mundo.hayHueco(c)) return 'vuelo';
    return 'salto';
  }

  caer(ts) {
    const f = fisicaSalto(this.audio.bpmEn(ts));
    const a = this.a;
    a.t0 = ts; a.y0 = this.yBase; a.v0 = 0; a.g = f.g; a.T = f.T; a.tipo = 'caida';
    this.estado = 'aire';
    this.yDespegue = this.yMin = this.yBase;
    this.cruzoHueco = false;
    this.colgando = false;
    this.volteretaPedida = false;
    this.voltereta = false;
  }

  deslizar(ts) {
    this.estado = 'desliz';
    this.voltereta = false;
    this.tDesliz = ts;
    this.durDesliz = DESLIZ.PULSOS * segPorPulso(this.audio.bpmEn(ts));
    this.pedidoDesliz = -9;
    this.audio.barrida();
  }

  aterrizar(ts, sup) {
    const caida = sup - this.yMin;
    this.y = this.yBase = sup;
    this.tUltSuelo = ts;
    if (this.cruzoHueco) this.truco('vuelo');
    if (sup < this.yDespegue - 10) this.truco('subida');
    if (this.volteretaPedida && caida >= DESLIZ.VOLTERETA_CAIDA_MIN) {
      this.estado = 'desliz';
      this.voltereta = true;
      this.tDesliz = ts;
      this.durDesliz = DESLIZ.PULSOS * segPorPulso(this.audio.bpmEn(ts));
      this.truco('voltereta');
      this.audio.voltereta();
    } else {
      this.estado = 'suelo';
      this.tAterrizo = ts;
      this.audio.aterrizar(Math.min(1, caida / 220));
    }
    this.volteretaPedida = false;
    this.escena.efectos.polvo(this.x, sup, caida > 120 ? 9 : 5, 1);
  }

  pared(ts, sup) {
    this.golpe(ts, 'pared');
    this.trepar(ts, sup, 0.2);
  }

  caidaEnHueco(ts, sup) {
    // Un hueco cuesta caro aunque todavía estés invulnerable por otro choque.
    this.invulnerableHasta = -1;
    this.golpe(ts, 'hueco');
    this.trepar(ts, sup, 0.3);
  }

  trepar(ts, sup, dur) {
    this.estado = 'trepa';
    this.tr0 = ts;
    this.trDur = dur;
    this.trY0 = this.y;
    this.trY1 = this.yBase = sup;
    this.colgando = false;
    this.volteretaPedida = false;
    this.voltereta = false;
  }

  // Altura del techo del primer edificio después del hueco en el que estás.
  bordeSiguiente() {
    let c = Math.floor(this.x / COL);
    for (let k = 0; k < 8 && this.mundo.hayHueco(c); k++) c++;
    return yDeNivel(this.mundo.nivelEnCol(c));
  }

  bajoCartel() {
    const c0 = Math.floor((this.x - HB.MEDIO) / COL);
    const c1 = Math.floor((this.x + HB.MEDIO) / COL);
    for (let c = c0; c <= c1; c++) if (this.mundo.barraEn(c)) return true;
    return false;
  }

  carteEncima() {
    const c0 = Math.floor((this.x - HB.MEDIO) / COL);
    const c1 = Math.floor((this.x + HB.MEDIO + 30) / COL);
    for (let c = c0; c <= c1; c++) if (this.mundo.barraEn(c)) return true;
    return false;
  }

  // --------------------------------------------------------------------------
  //  Colisiones y trucos
  // --------------------------------------------------------------------------
  colisiones(ts) {
    const alto = this.estado === 'desliz' ? HB.BAJO : HB.ALTO;
    const izq = this.x - HB.MEDIO, der = this.x + HB.MEDIO;
    const arriba = this.y - alto, abajo = this.y - 2;
    const c0 = Math.floor(izq / COL), c1 = Math.floor(der / COL);
    for (let c = c0; c <= c1; c++) {
      if (this.mundo.estadoEn(c) !== ESTADO.PENDIENTE) continue;
      const esObst = this.mundo.obstEn(c) !== 0;
      if (esObst) this.mundo.cajaObst(c, caja);
      else if (this.mundo.barraEn(c)) this.mundo.cajaCartel(c, caja);
      else continue;
      if (der > caja[0] && izq < caja[1] && abajo > caja[2] && arriba < caja[3]) {
        if (esObst) {
          this.mundo.marcar(c, ESTADO.CHOCADO);
          this.mundo.despedir(c);
        } else {
          // El cartel entero cuenta como un solo choque.
          let k = c; while (this.mundo.barraEn(k - 1)) k--;
          while (this.mundo.barraEn(k)) { this.mundo.marcar(k, ESTADO.CHOCADO); k++; }
        }
        this.golpe(ts, esObst ? 'caja' : 'cartel');
      }
    }
  }

  revisarTrucos() {
    while ((this.colRevisada + 1) * COL < this.x - HB.MEDIO) {
      const c = this.colRevisada;
      if (this.mundo.estadoEn(c) === ESTADO.PENDIENTE) {
        if (this.mundo.obstEn(c)) {
          this.mundo.marcar(c, ESTADO.SUPERADO);
          this.truco('valla');
        } else if (this.mundo.barraEn(c)) {
          this.mundo.marcar(c, ESTADO.SUPERADO);
          if (!this.mundo.barraEn(c - 1)) this.truco('barrida');
        }
      }
      this.colRevisada++;
    }
  }

  golpe(ts, tipo) {
    if (ts < this.invulnerableHasta) return false;
    this.invulnerableHasta = ts + PERSEGUIDOR.INVULNERABLE_MS / 1000;
    this.combo = 0;
    this.golpes++;
    this.tGolpe = ts;
    this.escena.alGolpe(tipo);
    return true;
  }

  truco(tipo) {
    this.combo = Math.min(PUNTOS.COMBO_MAX, this.combo + 1);
    const pts = PUNTOS.TRUCO[tipo] * Math.min(this.combo, 10);
    this.puntosTrucos += pts;
    this.trucos++;
    this.escena.alTruco(tipo, this.combo, pts);
  }

  morir(causa, xFinal) {
    this.estado = 'muerto';
    this.muerte = { causa, x: xFinal, y: this.y, vy: 0, t: 0 };
    this.escena.alMorir(causa);
  }

  // --------------------------------------------------------------------------
  //  Dibujo
  // --------------------------------------------------------------------------
  dibujar(t, beat) {
    let frame = FR.correr[0];
    let yDib = this.y, xDib = this.x;
    const nCorrer = FR.correr.length;

    switch (this.estado) {
      case 'quieto':
        frame = FR.quieto[Math.floor(performance.now() / 160) % FR.quieto.length];
        break;
      case 'suelo': {
        const eg = t - this.tGolpe;
        if (eg < 0.3) frame = FR.tropiezo[limitar(Math.floor(eg / 0.1), 0, 2)];
        else if (t - this.tAterrizo < 0.07) frame = FR.aterriza[0];
        // Un ciclo de carrera por pulso: los pies caen con la música.
        else frame = FR.correr[Math.floor((beat - Math.floor(beat)) * nCorrer) % nCorrer];
        break;
      }
      case 'desliz': {
        const e = t - this.tDesliz;
        if (this.voltereta && e < 0.36) frame = FR.voltereta[Math.floor(e / 0.09) & 3];
        else if (e < 0.07) frame = FR.desliz[0];
        else if (this.durDesliz - e < 0.08) frame = FR.desliz[3];
        else frame = FR.desliz[1 + ((Math.floor(e / 0.07)) & 1)];
        break;
      }
      case 'aire': {
        const a = this.a, e = t - a.t0, p = e / a.T;
        if (this.colgando) {
          frame = FR.cayendo[Math.floor(t * 6) & 1];
        } else if (this.volteretaPedida) {
          // Pidió rodar: gira en el aire para que se vea que el toque entró.
          frame = FR.voltereta[Math.floor((t - this.tVolteretaPedida) / 0.08) & 3];
        } else if (a.tipo === 'caida' || p > 1.15) {
          frame = e > 0.45 ? FR.cayendo[Math.floor(t * 6) & 1] : FR.caida[Math.floor(t * 10) & 1];
        } else if (a.tipo === 'valla') frame = FR.valla[limitar(Math.floor(p * 5), 0, 4)];
        else if (a.tipo === 'vuelo') frame = FR.vuelo[limitar(Math.floor(p * 4), 0, 3)];
        else frame = p < 0.12 ? FR.salto[0] : p < 0.3 ? FR.salto[1] : p < 0.62 ? FR.salto[2]
                   : FR.caida[Math.floor(t * 10) & 1];
        break;
      }
      case 'trepa':
        frame = FR.trepa[limitar(Math.floor(((t - this.tr0) / this.trDur) * 3), 0, 2)];
        break;
      case 'muerto': {
        const m = this.muerte;
        xDib = m.x;
        yDib = m.y;
        frame = m.causa === 'atrapado'
          ? FR.atrapado[Math.min(FR.atrapado.length - 1, Math.floor(m.t / 0.09))]
          : FR.cayendo[Math.floor(m.t * 6) & 1];
        break;
      }
    }

    this.sprite.setFrame(frame).setPosition(xDib, yDib);
    this.frame = frame;
    this.sprite.setAlpha(this.estado !== 'muerto' && t < this.invulnerableHasta ? ((Math.floor(t * 16) & 1) ? 0.35 : 1) : 1);
  }

  actualizarMuerte(dt) {
    const m = this.muerte;
    m.t += dt;
    if (m.causa === 'caida') {
      m.vy += 2200 * dt;
      m.y += m.vy * dt;
    } else if (m.t < 0.35) {
      m.x -= 90 * dt;       // el tirón hacia atrás
    }
  }
}
