# FUGA

Huí por las azoteas. Que no te alcance.

Un runner 2D de dos botones para el navegador, en computadora y celular, sin instalar
nada. Hecho para el torneo del colegio.

## Cómo se juega

| | Celular | Computadora |
|---|---|---|
| Saltar | mitad izquierda de la pantalla | ↑, espacio, W o Z |
| Deslizarse | mitad derecha | ↓, S o X |
| Voltereta | deslizarse en el aire, antes de caer | ↓ en el aire |
| Pausa | — (se pausa sola al salir) | Esc o P |
| Sonido | botón arriba a la derecha | M |

No hay vidas. Hay un tipo que te persigue. Cada choque lo acerca, caer en un hueco
lo acerca mucho, y los trucos lo alejan. Al principio se queda atrás si corrés
limpio; pasado el minuto corre cada vez más, y sólo los trucos lo mantienen lejos.

## Correrlo en tu computadora

Parado en esta carpeta:

```
python servidor.py
```

y abrí `http://localhost:8123`. Agregá `?debug` a la dirección para ver los FPS.

`servidor.py` es `python -m http.server` con la caché apagada: si usás el comando
común, a veces el navegador sigue mostrando la versión vieja de un archivo que
acabás de cambiar.

## Dónde se toca cada cosa

**Casi todo lo que define cómo se siente el juego está en `js/config.js`.** Los
números vienen comentados. Lo más probable que quieras ajustar:

| Quiero… | Tocá en `config.js` |
|---|---|
| que el juego arranque más rápido o más lento | `RITMO.BPM_INICIAL` / `BPM_FINAL` |
| saltos más altos o más bajos | `SALTO.ALTURA` (la duración siempre es un pulso) |
| que perdone más o menos al apretar a destiempo | `SALTO.COYOTE_MS`, `SALTO.BUFFER_MS` |
| que el perseguidor sea más o menos malo | todo el bloque `PERSEGUIDOR` |
| otros colores | `COLOR` |

| Quiero… | Archivo |
|---|---|
| agregar o cambiar tramos de nivel | `js/datos/segmentos.js` |
| cambiar la curva de dificultad | `js/juego/Generador.js` → `objetivo()` |
| cambiar poses o animaciones del corredor | `js/motor/Esqueleto.js` |
| cambiar la música | `js/motor/Audio.js` → `PROGRESION`, `MELODIA` |

### Agregar un tramo de nivel

Los niveles nunca se escriben enteros: se encadenan tramos cortos de
`js/datos/segmentos.js`. Cada tramo es una grilla de texto. Copiá uno parecido,
cambiale el nombre y dibujá. Si rompe alguna regla (un hueco imposible, dos saltos
demasiado pegados), el juego lo descarta al arrancar y avisa en la consola del
navegador (F12) qué regla rompió.

## Cómo está hecho

- **Phaser 3.90** en `vendor/`, sin build ni npm. Va dentro del repo para no
  depender de ningún CDN el día del torneo.
- **Nada de imágenes ni sonidos de terceros.** El corredor es un esqueleto de 10
  huesos animado por código; la ciudad, los obstáculos, la música y los efectos
  también se generan al cargar. La única pieza externa es la tipografía Anton
  (licencia OFL, en `fuentes/`).
- **Rendimiento.** Todo se dibuja desde una sola textura generada al arrancar; no
  se crea ni se destruye ningún objeto durante la partida (todo sale de pools);
  el puntaje usa una fuente bitmap para no re-subir texturas en cada cuadro.
- **Reloj.** El mundo avanza según el pulso de la música, que se programa sobre el
  reloj del audio: música y juego no se pueden desfasar. Un salto dura siempre
  exactamente un pulso, a cualquier cantidad de cuadros por segundo.

## Publicar cambios

El juego está publicado con GitHub Pages. Cada `git push` a `main` lo actualiza en
uno o dos minutos. Después de publicar, los teléfonos pueden tardar hasta 10
minutos en ver la versión nueva (GitHub guarda caché): **no publiques nada durante
el torneo**.
