// ============================================================================
//  ajustes.js  —  todo lo que NO es sensacion de control
//  Resolucion, colores, reglas de partida. Se toca sin miedo.
// ============================================================================

// ----------------------------------------------------------------------------
//  Arte — medidas reales del pack Kings and Pigs, no estimadas
// ----------------------------------------------------------------------------
export const ARTE = {
  // Los sprites son chicos: el cuerpo del rey mide 37x29 px dentro de un cuadro
  // de 78x58 (los 32 px que sobran a la derecha son el martillo al golpear).
  // A 4x el personaje ocupa ~21% del alto de pantalla, que es lo que hace falta
  // para que se lea en un celular a un metro de distancia, en un stand.
  // Sólo números ENTEROS: en pixel art una escala 1.5 o 2.5 deforma los píxeles.
  ESCALA: 4,
  TILE: 32,             // tile original del tileset Terrain
};
export const TILE_PX = ARTE.TILE * ARTE.ESCALA;   // 128 px en pantalla

export const PANTALLA = {
  ANCHO: 960,   // resolucion virtual fija. Phaser escala esto a cualquier pantalla.
  ALTO: 540,    // 16:9. Mantener chico: el celular barato dibuja menos pixeles.
  PISO_Y: 430,  // altura del suelo dentro de la resolucion virtual
};

export const PARTIDA = {
  IMPACTOS_PARA_PERDER: 3,
  PUNTOS_POR_PIXEL: 0.02,
  PUNTOS_POR_GOLPE: 50,
  COMBO_MAXIMO: 32,
};

export const COLORES = {
  FONDO: 0x141322,
  FONDO_CSS: '#141322',
  PISO: 0x2a2740,
  ACENTO: 0x4dd8b0,
  ACENTO_CSS: '#4dd8b0',
  PELIGRO: 0xff5c72,
  TEXTO_CSS: '#e8e6f5',
  TENUE_CSS: '#6f6b91',
};

export const DEPURACION = {
  MOSTRAR_FPS: true,       // apagarlo recien el dia de la entrega
  MOSTRAR_DIAGNOSTICO: true,
};

export const ALMACEN = {
  RECORD: 'runner_record',
  OFFSET: 'runner_offset_audio',
};
