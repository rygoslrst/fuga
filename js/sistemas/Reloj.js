// ============================================================================
//  Reloj.js  —  reloj musical
// ----------------------------------------------------------------------------
//  NO usa setTimeout ni el delta de Phaser. Usa AudioContext.currentTime, que
//  es el mismo reloj con el que suena la musica. Es la unica forma de que los
//  loops y el juego no se desfasen despues de dos minutos en un celular lento.
// ============================================================================

import { SEG_POR_PULSO, RITMO } from '../config/ritmo.js';

export class Reloj {
  constructor() {
    this.ctx = null;
    this.t0 = 0;          // currentTime cuando arranco la musica
    this.andando = false;
  }

  // Se llama en el PRIMER toque del usuario. iOS no deja sonar nada antes.
  async desbloquear() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    // Un buffer mudo de 1 sample: destraba iOS incluso cuando resume() miente.
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.ctx.destination);
    s.start(0);
    return this.ctx.state === 'running';
  }

  iniciar() {
    if (!this.ctx) return;
    this.t0 = this.ctx.currentTime;
    this.andando = true;
  }

  // Segundos desde que arranco la musica, ya calibrados.
  get tiempo() {
    if (!this.andando) return 0;
    return this.ctx.currentTime - this.t0 + RITMO.OFFSET_AUDIO_MS / 1000;
  }

  get pulsoFraccion() { return this.tiempo / SEG_POR_PULSO; }
  get pulso()         { return Math.floor(this.pulsoFraccion); }
  get compas()        { return Math.floor(this.pulso / 4); }

  // 0 en el pulso, sube a 1 justo antes del siguiente. Sirve para animar.
  get faseDelPulso() { const p = this.pulsoFraccion; return p - Math.floor(p); }

  // Distancia en ms al pulso mas cercano (positiva = tarde, negativa = temprano)
  desvioAlPulso(t = this.tiempo) {
    const p = t / SEG_POR_PULSO;
    const cercano = Math.round(p);
    return (p - cercano) * SEG_POR_PULSO * 1000;
  }

  // --------------------------------------------------------------------------
  //  Cambio de pestaña / bloqueo de pantalla
  // --------------------------------------------------------------------------
  //  El navegador congela requestAnimationFrame cuando la pestaña se oculta,
  //  pero el AudioContext SIGUE corriendo. Si el jugador atiende un mensaje en
  //  medio de una partida, vuelve con la música 30 segundos adelantada
  //  respecto del nivel. Suspender el contexto congela currentTime también, y
  //  así los dos relojes quedan atados sin tener que corregir nada a mano.
  async dormir() {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async despertar() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  get estadoAudio() { return this.ctx ? this.ctx.state : 'sin iniciar'; }
  get latenciaSalida() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || this.ctx.baseLatency || 0) * 1000;
  }
}
