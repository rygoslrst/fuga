// ============================================================================
//  ritmo.js  —  EL ARCHIVO DE LA SENSACION
// ----------------------------------------------------------------------------
//  Si el juego "se siente mal", se toca ACA y en ningun otro lado.
//  Todo lo de abajo de la linea DERIVADOS se calcula solo: no lo edites.
//
//  La idea central: elegis BPM, cuantos pixeles avanza el personaje por pulso
//  y que tan alto salta. De esos tres numeros salen la velocidad, la gravedad
//  y la fuerza del salto, de manera que UN SALTO DURE EXACTAMENTE UN PULSO.
// ============================================================================

export const RITMO = {
  // --- Los tres numeros que definen todo -----------------------------------
  BPM: 120,            // pulsos por minuto de la musica
  // Cuanto avanza el personaje en un pulso. 256 = DOS tiles de 128 px
  // (el tileset es de 32 px dibujado a escala 4). Que sea un multiplo exacto
  // del tile es lo que permite que las grillas de segmentos del paso 3 caigan
  // sobre el pulso sin numeros raros.
  PX_POR_PULSO: 256,

  // Pico del salto. 192 px = 1.5 tiles: pasa un obstaculo de un tile con
  // margen comodo, y son ~1.65 veces la altura del personaje (116 px a 4x),
  // que es lo que hace que el salto se LEA. Numero a ajustar en el paso 2.
  ALTURA_SALTO: 192,

  // Cuantos pulsos dura el salto. 1 = el salto cae justo en el pulso siguiente.
  // Es EL parametro musical. Cambiarlo a 2 hace saltos largos y flotados.
  PULSOS_EN_EL_AIRE: 1,

  // --- Ventanas de perdon (en milisegundos) --------------------------------
  // Sin esto el juego se siente injusto aunque los numeros esten bien.
  COYOTE_MS: 90,        // podes saltar hasta 90ms despues de dejar el piso
  BUFFER_SALTO_MS: 120, // si apretas 120ms antes de aterrizar, salta al tocar
  PERDON_ATERRIZAJE_MS: 70, // margen para que un aterrizaje cuente "en el pulso"

  // --- Golpe ---------------------------------------------------------------
  GOLPE_DURACION_MS: 140,   // cuanto vive la hitbox del golpe
  GOLPE_ENFRIAMIENTO_MS: 220, // no se puede spamear
  // El martillo llega hasta x=77 del cuadro y el cuerpo esta centrado en x=27:
  // son 50 px a escala 1, o sea 200 a escala 4. La hitbox tiene que coincidir
  // con lo que el jugador VE, o el juego se siente tramposo.
  GOLPE_ALCANCE: 200,

  // --- Calibracion de audio ------------------------------------------------
  // Si la musica se siente ADELANTADA respecto de lo que ves, subi este numero.
  // Se mide una sola vez por dispositivo. Los celulares baratos necesitan mas.
  OFFSET_AUDIO_MS: 0,
};

// ============================================================================
//  DERIVADOS  —  no editar a mano, salen de los de arriba
// ============================================================================
//  Fisica del salto (tiro vertical):
//    tiempo en el aire   T  = 2*v0/g
//    altura maxima       h  = v0^2 / (2g)
//  Despejando para que T y h sean los que pedimos:
//    g  = 8h / T^2
//    v0 = 4h / T
// ============================================================================

export const SEG_POR_PULSO   = 60 / RITMO.BPM;
export const MS_POR_PULSO    = SEG_POR_PULSO * 1000;
export const TIEMPO_EN_AIRE  = SEG_POR_PULSO * RITMO.PULSOS_EN_EL_AIRE;

export const VELOCIDAD       = RITMO.PX_POR_PULSO / SEG_POR_PULSO;              // px/seg
export const GRAVEDAD        = (8 * RITMO.ALTURA_SALTO) / (TIEMPO_EN_AIRE ** 2); // px/seg^2
export const VELOCIDAD_SALTO = (4 * RITMO.ALTURA_SALTO) / TIEMPO_EN_AIRE;        // px/seg

// Un salto cubre exactamente PX_POR_PULSO * PULSOS_EN_EL_AIRE pixeles de largo.
export const LARGO_SALTO = RITMO.PX_POR_PULSO * RITMO.PULSOS_EN_EL_AIRE;

// Ancho de una columna de las grillas de segmentos = medio pulso.
// Un segmento de 4 pulsos = 8 columnas de texto. (Se usa recien en el paso 3.)
export const PX_POR_COLUMNA = RITMO.PX_POR_PULSO / 2;

// Posicion vertical de la coordenada de un salto en curso, medida en segundos
// desde que despego. Se usa en vez de la gravedad de Arcade para que la
// duracion del salto NO dependa de los FPS: en un celular lento la integracion
// paso a paso se desfasa, y el desfase es justo lo que arruina la sensacion.
export function alturaDeSalto(t) {
  if (t <= 0 || t >= TIEMPO_EN_AIRE) return 0;
  return VELOCIDAD_SALTO * t - 0.5 * GRAVEDAD * t * t;
}

// Para el contador de diagnostico del paso 0.
export const RESUMEN = {
  segPorPulso: SEG_POR_PULSO,
  velocidad: VELOCIDAD,
  gravedad: GRAVEDAD,
  velocidadSalto: VELOCIDAD_SALTO,
  largoSalto: LARGO_SALTO,
};
