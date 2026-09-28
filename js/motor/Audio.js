// ============================================================================
//  Audio.js — el reloj maestro, la música y los efectos
// ----------------------------------------------------------------------------
//  1) RELOJ. El mundo avanza según el pulso de la música, y la música se
//     programa sobre AudioContext.currentTime. Un solo reloj para las dos
//     cosas: no se pueden desfasar nunca, ni en un celular que tironea.
//     Si el audio no arranca (navegador raro, permiso negado), el juego sigue
//     con un reloj de respaldo basado en performance.now().
//
//  2) MÚSICA. Sintetizada en vivo, sin archivos. Un secuenciador de 16 pasos
//     por compás con capas que entran según el combo y se caen al chocar.
//     Cuando el perseguidor está cerca, la música se "ahoga" y suena un latido.
//
//  3) EFECTOS. También sintetizados: cero descargas, cero licencias.
// ============================================================================

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const esperar = ms => new Promise(r => setTimeout(r, ms));

// La menor, con la progresión i–VI–III–VII: épica y en movimiento, ideal para huir.
const PROGRESION = [
  { raiz: 45, notas: [69, 72, 76] },   // Am
  { raiz: 41, notas: [69, 72, 77] },   // F
  { raiz: 48, notas: [72, 76, 79] },   // C
  { raiz: 43, notas: [71, 74, 79] },   // G
];
const BAJO = [1, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0];   // 1 = raíz, 2 = octava
const MELODIA = [
  [76, 0, 0, 74, 0, 72, 0, 0, 69, 0, 72, 0, 74, 0, 0, 0],
  [72, 0, 0, 72, 0, 69, 0, 0, 65, 0, 69, 0, 72, 0, 0, 0],
  [79, 0, 0, 76, 0, 74, 0, 0, 72, 0, 74, 0, 76, 0, 0, 0],
  [74, 0, 0, 74, 0, 71, 0, 0, 67, 0, 71, 0, 74, 0, 79, 0],
];
// Cada truco toca la nota siguiente de esta escala: un combo largo suena a melodía.
const PENTATONICA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93];

export class Audio {
  constructor() {
    this.ctx = null;
    this.sonido = true;
    try { this.sonido = localStorage.getItem('fuga_sonido_v1') !== '0'; } catch (e) { /* sin almacenamiento */ }

    this._ultAudio = 0; this._ultPerf = 0; this._ultEst = 0;
    this._usarPerf = true;
    this._perfPausado = 0; this._pausadoEn = null;
    // Tiempo del juego = reloj crudo − _desfase. El tutorial lo congela (ver
    // congelar) sin detener el AudioContext, y al seguir suma lo que duró.
    this._desfase = 0; this._congeladoEn = null;

    this.cambios = [{ t: 0, beat: 0, bpm: 120 }];
    this.proxPaso = 0;
    this.musicaActiva = false;
    this.intensidad = 0;
    this.peligro = 0;
    this._peligroAplicado = 0;
  }

  // --------------------------------------------------------------------------
  //  Desbloqueo: se llama en el PRIMER toque. iOS no deja sonar nada antes.
  // --------------------------------------------------------------------------
  async desbloquear() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this._construir();
      }
      const reanudar = this.ctx.resume();            // tiene que ser dentro del gesto
      const b = this.ctx.createBufferSource();       // buffer mudo: destraba iOS viejos
      b.buffer = this.ctx.createBuffer(1, 1, 22050);
      b.connect(this.ctx.destination);
      b.start(0);
      await Promise.race([reanudar, esperar(500)]);
    } catch (e) { /* seguimos con el reloj de respaldo */ }
    this.resincronizar();
    return this.ctx !== null && this.ctx.state === 'running';
  }

  _construir() {
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(c.destination);

    this.master = c.createGain();
    this.master.gain.value = this.sonido ? 0.9 : 0;
    this.master.connect(this.comp);

    this.filtro = c.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = 18000;
    this.filtro.connect(this.master);

    this.musica = c.createGain();
    this.musica.gain.value = 0;
    this.musica.connect(this.filtro);

    this.sfx = c.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);

    const n = c.sampleRate;
    this.ruido = c.createBuffer(1, n, n);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  get audioVivo() { return this.ctx !== null && this.ctx.state === 'running'; }

  setSonido(on) {
    this.sonido = on;
    try { localStorage.setItem('fuga_sonido_v1', on ? '1' : '0'); } catch (e) { /* nada */ }
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02);
  }

  // --------------------------------------------------------------------------
  //  RELOJ
  // --------------------------------------------------------------------------
  //  currentTime avanza a saltos (bloques de audio). Para que el movimiento sea
  //  suave, entre salto y salto se interpola con performance.now().
  ahora() {
    if (this._congeladoEn !== null) return this._congeladoEn;
    return this._crudo() - this._desfase;
  }

  _crudo() {
    if (this._usarPerf) {
      const p = this._pausadoEn !== null ? this._pausadoEn : performance.now() / 1000;
      return p - this._perfPausado;
    }
    const a = this.ctx.currentTime, p = performance.now() / 1000;
    if (a !== this._ultAudio) { this._ultAudio = a; this._ultPerf = p; }
    let est = this._ultAudio + (p - this._ultPerf);
    if (est > a + 0.06) est = a + 0.06;
    if (est < this._ultEst) est = this._ultEst;
    this._ultEst = est;
    return est;
  }

  resincronizar() {
    if (!this.ctx) return;
    this._ultAudio = this.ctx.currentTime;
    this._ultPerf = performance.now() / 1000;
    this._ultEst = this.ctx.currentTime;
  }

  async pausar() {
    if (this._usarPerf) {
      if (this._pausadoEn === null) this._pausadoEn = performance.now() / 1000;
    } else if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  async reanudar() {
    if (this._usarPerf) {
      if (this._pausadoEn !== null) {
        this._perfPausado += performance.now() / 1000 - this._pausadoEn;
        this._pausadoEn = null;
      }
    }
    if (this.ctx && this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (e) { /* nada */ }
    }
    this.resincronizar();
  }

  // El tutorial detiene el juego en un instante exacto (t, que ya pasó por muy
  // poco) hasta que el jugador hace el gesto. La música se apaga; al seguir,
  // el tiempo retoma desde t y la música desde el mismo pulso.
  congelar(t) {
    if (this._congeladoEn !== null) return;
    this._congeladoEn = t;
    if (this.musica) {
      const c = this.ctx.currentTime;
      this.musica.gain.cancelScheduledValues(c);
      this.musica.gain.setTargetAtTime(0, c, 0.03);
    }
  }

  descongelar() {
    const t = this._congeladoEn;
    if (t === null) return;
    this._congeladoEn = null;
    this._desfase = this._crudo() - t;
    // Los pasos que ya estaban agendados sonaron en silencio: se vuelven a
    // agendar desde el pulso donde se congeló.
    this.proxPaso = Math.ceil(this.beatEn(t) * 4 - 1e-6);
    if (this.musica && this.musicaActiva) {
      const c = this.ctx.currentTime;
      this.musica.gain.cancelScheduledValues(c);
      this.musica.gain.setTargetAtTime(0.55, c, 0.05);
    }
  }

  // --------------------------------------------------------------------------
  //  MAPA DE TEMPO: el BPM puede subir durante la carrera, siempre al empezar
  //  un compás. beat(t) y t(beat) atraviesan todos los cambios.
  // --------------------------------------------------------------------------
  iniciarCarrera(bpm) {
    // El reloj se elige al empezar cada carrera y no se cambia a mitad.
    this._usarPerf = !this.audioVivo;
    this._perfPausado = 0; this._pausadoEn = null;
    this._desfase = 0; this._congeladoEn = null;
    this.resincronizar();
    const t0 = this.ahora() + 0.05;
    this.cambios.length = 0;
    this.cambios.push({ t: t0, beat: 0, bpm });
    this.tInicio = t0;
    this.proxPaso = 0;
    this.musicaActiva = true;
    this.intensidad = 0;
    this.peligro = 0;
    if (this.musica) {
      this.musica.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musica.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.05);
    }
    return t0;
  }

  _cambioT(t) {
    const c = this.cambios;
    for (let i = c.length - 1; i > 0; i--) if (c[i].t <= t) return c[i];
    return c[0];
  }

  beatEn(t) { const c = this._cambioT(t); return c.beat + (t - c.t) * c.bpm / 60; }
  bpmEn(t) { return this._cambioT(t).bpm; }

  tiempoDeBeat(b) {
    const c = this.cambios;
    let k = c[0];
    for (let i = 1; i < c.length; i++) if (c[i].beat <= b) k = c[i];
    return k.t + (b - k.beat) * 60 / k.bpm;
  }

  // --------------------------------------------------------------------------
  //  SECUENCIADOR — se llama cada cuadro. Programa por adelantado los pasos
  //  que caen en los próximos ~220 ms.
  // --------------------------------------------------------------------------
  programar(bpmDeseado) {
    if (!this.musicaActiva) return;
    const hasta = this.ahora() + 0.22;
    for (let guarda = 0; guarda < 64; guarda++) {
      const beat = this.proxPaso / 4;
      if (this.proxPaso % 16 === 0) {
        const ult = this.cambios[this.cambios.length - 1];
        if (bpmDeseado !== ult.bpm && beat > ult.beat) {
          this.cambios.push({ t: this.tiempoDeBeat(beat), beat, bpm: bpmDeseado });
        }
      }
      const t = this.tiempoDeBeat(beat);
      if (t > hasta) break;
      // t es tiempo del juego; el AudioContext va adelantado lo que duraron
      // las lecciones del tutorial.
      const tAudio = t + this._desfase;
      if (!this._usarPerf && tAudio >= this.ctx.currentTime - 0.005) this._paso(this.proxPaso, tAudio, this.bpmEn(t));
      this.proxPaso++;
    }
    // Sólo se toca el filtro si el peligro cambió: agendar automatizaciones
    // 60 veces por segundo llena la línea de tiempo del parámetro para nada.
    if (this.filtro && Math.abs(this.peligro - this._peligroAplicado) > 0.03) {
      this._peligroAplicado = this.peligro;
      const f = 18000 * Math.pow(700 / 18000, this.peligro);
      this.filtro.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.12);
    }
  }

  detenerMusica(suave = true) {
    this.musicaActiva = false;
    if (this.musica) {
      const t = this.ctx.currentTime;
      this.musica.gain.cancelScheduledValues(t);
      this.musica.gain.setTargetAtTime(0, t, suave ? 0.15 : 0.02);
    }
    if (this.filtro) this.filtro.frequency.setTargetAtTime(18000, this.ctx.currentTime, 0.3);
    this.peligro = 0;
    this._peligroAplicado = 0;
  }

  _paso(paso, t, bpm) {
    const k = paso % 16;
    const compas = Math.floor(paso / 16);
    const acorde = PROGRESION[compas % 4];
    const I = this.intensidad;
    const seg16 = 60 / bpm / 4;

    if (k % 4 === 0) this._bombo(t, 1);
    if (I >= 2 && compas % 4 === 3 && k === 14) this._bombo(t, 0.6);
    if (I >= 1 && (k === 4 || k === 12)) this._caja(t);
    if (I >= 1 && k % 4 === 2) this._hat(t, 0.5);
    if (I >= 3 && k % 2 === 1) this._hat(t, 0.22);
    if (BAJO[k]) this._bajo(t, acorde.raiz + (BAJO[k] === 2 ? 12 : 0), seg16 * 1.7);
    if (I >= 2) this._pluck(t, acorde.notas[[0, 1, 2, 1][k % 4]] + (k >= 8 ? 12 : 0) - 12);
    if (I >= 3 && k === 0) this._pad(t, acorde, seg16 * 16);
    if (I >= 4 && MELODIA[compas % 4][k]) this._lead(t, MELODIA[compas % 4][k], seg16 * 2.5);
    if (this.peligro > 0.45 && (k === 0 || k === 3 || k === 8 || k === 11)) this._latido(t);
  }

  // --------------------------------------------------------------------------
  //  VOCES
  // --------------------------------------------------------------------------
  _env(g, t, pico, dur) {
    g.gain.setValueAtTime(pico, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  }

  _osc(tipo, f, t, dur, pico, destino, fFinal) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (fFinal) o.frequency.exponentialRampToValueAtTime(fFinal, t + dur);
    this._env(g, t, pico, dur);
    o.connect(g); g.connect(destino);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  _ruido(t, dur, pico, destino, tipoFiltro, fFiltro, fFinal, q = 1) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.ruido;
    const f = c.createBiquadFilter();
    f.type = tipoFiltro; f.Q.value = q;
    f.frequency.setValueAtTime(fFiltro, t);
    if (fFinal) f.frequency.exponentialRampToValueAtTime(fFinal, t + dur);
    const g = c.createGain();
    this._env(g, t, pico, dur);
    s.connect(f); f.connect(g); g.connect(destino);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  _bombo(t, v) { this._osc('sine', 150, t, 0.26, 0.95 * v, this.musica, 42); }
  _caja(t) {
    this._ruido(t, 0.14, 0.42, this.musica, 'highpass', 1400);
    this._osc('triangle', 190, t, 0.08, 0.25, this.musica, 120);
  }
  _hat(t, v) { this._ruido(t, 0.045, 0.3 * v, this.musica, 'highpass', 7500); }

  _bajo(t, n, dur) {
    const c = this.ctx;
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(420 + this.intensidad * 160, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    this._env(g, t, 0.34, dur);
    o.connect(f); f.connect(g); g.connect(this.musica);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _pluck(t, n) { this._osc('square', midi(n), t, 0.12, 0.06, this.musica); }
  _lead(t, n, dur) { this._osc('triangle', midi(n), t, dur, 0.16, this.musica); }

  _pad(t, acorde, dur) {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.25);
    g.gain.setValueAtTime(0.045, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    f.connect(g); g.connect(this.musica);
    for (const n of acorde.notas) {
      const o = c.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = midi(n - 12);
      o.connect(f); o.start(t); o.stop(t + dur + 0.02);
    }
  }

  _latido(t) { this._osc('sine', 62, t, 0.16, 0.55, this.master, 40); }

  // --------------------------------------------------------------------------
  //  EFECTOS — todos protegidos: si no hay audio, no hacen nada.
  // --------------------------------------------------------------------------
  get _t() { return this.ctx.currentTime + 0.005; }
  get _ok() { return this.audioVivo; }

  salto() {
    if (!this._ok) return;
    this._osc('sine', 320, this._t, 0.1, 0.16, this.sfx, 760);
    this._ruido(this._t, 0.09, 0.12, this.sfx, 'bandpass', 900, 3000, 0.8);
  }
  aterrizar(fuerza) {
    if (!this._ok) return;
    this._osc('sine', 150, this._t, 0.1, 0.12 + 0.3 * fuerza, this.sfx, 50);
  }
  barrida() {
    if (!this._ok) return;
    this._ruido(this._t, 0.3, 0.22, this.sfx, 'bandpass', 2200, 500, 1.2);
  }
  voltereta() {
    if (!this._ok) return;
    this._ruido(this._t, 0.3, 0.25, this.sfx, 'bandpass', 400, 2400, 1.5);
  }
  truco(combo) {
    if (!this._ok) return;
    const n = PENTATONICA[Math.min(PENTATONICA.length - 1, Math.max(0, combo - 1))];
    this._osc('triangle', midi(n), this._t, 0.28, 0.2, this.sfx);
    this._osc('sine', midi(n + 7), this._t + 0.03, 0.2, 0.06, this.sfx);
  }
  // Moneda: dos notas cortas, cada vez más agudas si vienen seguidas (las tres
  // de un salto suenan como un arpegio).
  moneda(racha) {
    if (!this._ok) return;
    const n = PENTATONICA[Math.min(PENTATONICA.length - 1, 4 + racha)] + 12;
    this._osc('square', midi(n), this._t, 0.06, 0.035, this.sfx);
    this._osc('triangle', midi(n + 5), this._t + 0.045, 0.16, 0.14, this.sfx);
  }
  // Trepar un escalón sin saltarlo: un golpe sordo, no el de un choque.
  trepada() {
    if (!this._ok) return;
    this._osc('sine', 120, this._t, 0.09, 0.3, this.sfx, 70);
    this._ruido(this._t, 0.08, 0.1, this.sfx, 'lowpass', 900, 300);
  }
  // Tutorial: el tiempo se detiene.
  pausaLeccion() {
    if (!this._ok) return;
    this._osc('sine', 660, this._t, 0.22, 0.1, this.sfx, 330);
  }
  golpe() {
    if (!this._ok) return;
    const t = this._t;
    this._ruido(t, 0.22, 0.6, this.sfx, 'lowpass', 1200, 200);
    this._osc('sawtooth', 110, t, 0.18, 0.3, this.sfx, 45);
    this.musica.gain.cancelScheduledValues(t);
    this.musica.gain.setValueAtTime(0.18, t);
    this.musica.gain.setTargetAtTime(0.55, t + 0.15, 0.25);
  }
  atrapado() {
    if (!this._ok) return;
    const t = this._t;
    this._osc('sine', 90, t, 0.7, 0.9, this.sfx, 28);
    this._ruido(t, 0.4, 0.5, this.sfx, 'lowpass', 1800, 150);
    this._osc('sawtooth', 220, t + 0.05, 0.6, 0.12, this.sfx, 55);
  }
  caida() {
    if (!this._ok) return;
    this._osc('sine', 950, this._t, 0.95, 0.16, this.sfx, 170);
  }
  record() {
    if (!this._ok) return;
    [69, 73, 76, 81, 85].forEach((n, i) => this._osc('triangle', midi(n), this._t + i * 0.07, 0.3, 0.16, this.sfx));
  }
  arranque() {
    if (!this._ok) return;
    this._ruido(this._t, 0.4, 0.2, this.sfx, 'bandpass', 300, 3000, 1);
    this._osc('sine', 220, this._t, 0.3, 0.12, this.sfx, 660);
  }
}
