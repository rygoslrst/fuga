// ============================================================================
//  Personaje.js  —  el rey, dibujado y animado
// ----------------------------------------------------------------------------
//  Las animaciones NO usan el temporizador de animación de Phaser: el cuadro
//  se calcula a partir del reloj musical. Así los pies caen sobre el pulso
//  siempre, en cualquier aparato, y no se desfasan después de dos minutos.
//
//  Medidas reales del pack (medidas, no estimadas):
//    cuadro:            78x58
//    cuerpo dentro:     x 9..45  ·  y 16..44
//    o sea: el cuerpo está a la IZQUIERDA del cuadro. Los 32 px sobrantes de
//    la derecha son el espacio que ocupa el martillo al golpear.
// ============================================================================

import { ARTE } from '../config/ajustes.js';
import { RITMO, TIEMPO_EN_AIRE, alturaDeSalto } from '../config/ritmo.js';

// Anclaje: el punto del cuadro que queremos apoyar en el piso.
//  X = 27  -> centro real del cuerpo (9..45), no el centro del cuadro (39)
//  Y = 45  -> un pixel debajo del pie más bajo (y=44 en Aterrizar y en Correr)
const ANCLA_X = 27 / 78;
const ANCLA_Y = 45 / 58;

// Cuántos cuadros tiene cada animación y en cuántos PULSOS se reparten.
// "correr" en 1 pulso = los 8 cuadros son 2 zancadas, o sea un pie por corchea.
const ANIMS = {
  quieto:    { cuadros: 11, pulsos: 4, cicla: true },
  correr:    { cuadros: 8,  pulsos: 1, cicla: true },
  saltar:    { cuadros: 1,  pulsos: 1, cicla: true },
  caer:      { cuadros: 1,  pulsos: 1, cicla: true },
  aterrizar: { cuadros: 1,  pulsos: 1, cicla: true },
  golpear:   { cuadros: 3,  pulsos: 0.5, cicla: false },
  dolor:     { cuadros: 2,  pulsos: 0.5, cicla: false },
  morir:     { cuadros: 4,  pulsos: 1,   cicla: false },
};

export class Personaje {
  // Se llama desde preload() de la escena.
  static precargar(escena) {
    escena.load.atlas('atlas', 'assets/img/atlas.png', 'assets/img/atlas.json');
  }

  constructor(escena, x, pisoY) {
    this.escena = escena;
    this.pisoY = pisoY;

    this.sprite = escena.add.sprite(x, pisoY, 'atlas', 'rey_correr_0');
    this.sprite.setOrigin(ANCLA_X, ANCLA_Y);
    this.sprite.setScale(ARTE.ESCALA);

    this.estado = 'correr';
    this.tEstado = 0;        // cuándo empezó el estado actual (reloj musical)
    this.enElAire = false;
    this.tDespegue = 0;
    this.retrasoCuadro = 0;
  }

  get x() { return this.sprite.x; }
  get alto() { return 29 * ARTE.ESCALA; }   // alto real del cuerpo, no del cuadro

  // --- acciones -------------------------------------------------------------
  saltar(t) {
    if (this.enElAire || this.estado === 'morir') return false;
    this.enElAire = true;
    this.tDespegue = t;
    return true;
  }

  golpear(t) {
    if (this.estado === 'morir') return false;
    this.cambiarA('golpear', t);
    return true;
  }

  recibirGolpe(t) { this.cambiarA('dolor', t); }
  morir(t)        { this.cambiarA('morir', t); this.enElAire = false; }

  cambiarA(estado, t) {
    this.estado = estado;
    this.tEstado = t;
  }

  // --- por cuadro -----------------------------------------------------------
  actualizar(t, pulsoFraccion) {
    // 1) altura: parábola cerrada contra el reloj de audio (ver ritmo.js)
    if (this.enElAire) {
      const dt = t - this.tDespegue;
      if (dt >= TIEMPO_EN_AIRE) {
        this.enElAire = false;
        this.sprite.y = this.pisoY;
        this.retrasoCuadro = (dt - TIEMPO_EN_AIRE) * 1000;
        if (this.estado !== 'morir' && this.estado !== 'dolor') {
          this.cambiarA('aterrizar', t);
        }
      } else {
        this.sprite.y = this.pisoY - alturaDeSalto(dt) ;
      }
    } else {
      this.sprite.y = this.pisoY;
    }

    // 2) qué animación corresponde
    let anim = this.estado;
    const edad = t - this.tEstado;
    const duracionEstado = ANIMS[anim] ? ANIMS[anim].pulsos * (60 / RITMO.BPM) : 0;

    if (anim === 'golpear' || anim === 'dolor') {
      if (edad >= duracionEstado) anim = this.estado = 'correr';
    } else if (anim === 'aterrizar') {
      // El cuadro de aterrizaje dura un suspiro: es peso, no una pausa.
      if (edad >= 0.06) anim = this.estado = 'correr';
    }

    if (this.estado !== 'morir' && this.estado !== 'golpear' && this.estado !== 'dolor') {
      if (this.enElAire) {
        const dt = t - this.tDespegue;
        anim = this.estado = (dt < TIEMPO_EN_AIRE / 2) ? 'saltar' : 'caer';
      }
    }

    // 3) qué cuadro de esa animación
    const def = ANIMS[anim] || ANIMS.correr;
    let i;
    if (def.cicla) {
      // Enganchado al reloj musical: los pies caen sobre el pulso, siempre.
      i = Math.floor((pulsoFraccion / def.pulsos) * def.cuadros) % def.cuadros;
    } else {
      const avance = duracionEstado > 0 ? edad / duracionEstado : 1;
      i = Math.min(def.cuadros - 1, Math.floor(avance * def.cuadros));
    }
    this.sprite.setFrame(`rey_${anim}_${i}`);
  }
}
