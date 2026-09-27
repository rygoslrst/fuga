// ============================================================================
//  ui.js — título, fin de partida, pausa y créditos
// ----------------------------------------------------------------------------
//  Son HTML encima del canvas: texto nítido en cualquier pantalla y cero costo
//  para el motor. Reintentar es tocar en cualquier lado: el ciclo "otra vez"
//  tiene que ser lo más corto posible.
// ============================================================================

const $ = id => document.getElementById(id);

const ICONO_SONIDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICONO_MUDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.escena = null;
    this.titulo = $('titulo');
    this.fin = $('fin');
    this.pausa = $('pausa');
    this.creditos = $('creditos');
    this.finDesde = 0;
    this.arrancando = false;
    this.tactil = window.matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('tactil', this.tactil);

    // Los botones no tienen que disparar "empezar" ni "reintentar".
    for (const b of document.querySelectorAll('.boton')) {
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('pointerup', e => e.stopPropagation());
    }
    for (const b of document.querySelectorAll('[data-accion="sonido"]')) {
      b.addEventListener('click', () => this.alternarSonido());
    }
    for (const b of document.querySelectorAll('[data-accion="creditos"]')) {
      b.addEventListener('click', () => this.abrirCreditos(true));
    }
    $('cerrar-creditos').addEventListener('click', () => this.abrirCreditos(false));
    this.creditos.addEventListener('pointerdown', e => e.stopPropagation());
    this.creditos.addEventListener('pointerup', e => e.stopPropagation());
    this.pintarSonido();

    // pointerup y no pointerdown: en iOS el audio sólo se destraba al levantar el dedo.
    this.titulo.addEventListener('pointerup', () => this.empezarDesdeTitulo());
    this.fin.addEventListener('pointerdown', () => this.reintentar());
    this.pausa.addEventListener('pointerup', () => this.escena && this.escena.seguir());

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      if (e.code === 'Escape' && !this.creditos.hidden) { this.abrirCreditos(false); return; }
      if (e.code === 'KeyM') { this.alternarSonido(); return; }
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      const est = this.escena && this.escena.estado;
      if (!this.creditos.hidden) return;
      if (est === 'titulo') { e.preventDefault(); this.empezarDesdeTitulo(); }
      else if (est === 'fin') { e.preventDefault(); this.reintentar(); }
      else if (est === 'pausa') { e.preventDefault(); this.escena.seguir(); }
    });
  }

  conectar(escena) {
    this.escena = escena;
    this.mostrarTitulo(escena.record);
    document.body.classList.add('listo');
  }

  mostrarTitulo(record) {
    $('titulo-record').textContent = record > 0 ? `Récord: ${record}` : '';
    this.titulo.hidden = false;
  }

  async empezarDesdeTitulo() {
    if (this.arrancando || !this.escena || this.escena.estado !== 'titulo') return;
    this.arrancando = true;
    this.pantallaCompleta();
    await this.audio.desbloquear();
    this.titulo.hidden = true;
    this.escena.empezar();
    this.arrancando = false;
  }

  // En el celular, al empezar se pide pantalla completa y horizontal. Si el
  // navegador no deja (iPhone), no pasa nada: el juego anda igual.
  pantallaCompleta() {
    if (!this.tactil) return;
    const el = document.documentElement;
    const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!pedir || document.fullscreenElement) return;
    try {
      const p = pedir.call(el, { navigationUI: 'hide' });
      if (p && p.then) {
        p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}))
         .catch(() => {});
      }
    } catch (e) { /* nada */ }
  }

  mostrarFin(d) {
    $('fin-causa').textContent = d.causa === 'atrapado' ? 'Te atrapó' : 'Te caíste';
    $('fin-puntos').textContent = d.puntos;
    $('fin-detalle').textContent =
      `${d.metros} m · ${d.trucos} ${d.trucos === 1 ? 'truco' : 'trucos'}` + (d.combo >= 2 ? ` · combo ×${d.combo}` : '');
    const rec = $('fin-record');
    rec.textContent = d.nuevo ? '¡Nuevo récord!' : `Récord: ${d.record}`;
    rec.classList.toggle('nuevo', d.nuevo);
    this.fin.hidden = false;
    this.finDesde = performance.now();
  }

  async reintentar() {
    // Medio segundo de guarda: el toque desesperado del final no reinicia solo.
    if (!this.escena || this.escena.estado !== 'fin' || performance.now() - this.finDesde < 500) return;
    this.fin.hidden = true;
    if (!this.audio.audioVivo) await this.audio.desbloquear();
    this.escena.empezar();
  }

  mostrarPausa(v) { this.pausa.hidden = !v; }

  alternarSonido() {
    this.audio.setSonido(!this.audio.sonido);
    this.pintarSonido();
  }

  pintarSonido() {
    for (const b of document.querySelectorAll('[data-accion="sonido"]')) {
      b.innerHTML = this.audio.sonido ? ICONO_SONIDO : ICONO_MUDO;
      b.setAttribute('aria-label', this.audio.sonido ? 'Silenciar' : 'Activar sonido');
    }
  }

  abrirCreditos(v) {
    this.creditos.hidden = !v;
    if (v) $('cerrar-creditos').focus();
  }
}
