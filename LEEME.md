# Runner rítmico — auto-runner 2D de dos botones

Juego para el torneo del colegio. Phaser 3 por CDN, sin build step, sin npm.

**Estado: paso 0 terminado.** Lo que hay es una prueba de humo, no el juego: existe
para que los problemas del navegador y del celular **fallen ahora** y no la última
semana. El personaje ya está integrado y animado contra el reloj musical.

Próximo: paso 1 — obstáculo, enemigo, colisiones, muerte y reinicio.

## Correrlo en tu PC

Parado en esta carpeta:

```
python -m http.server 8123
```

y abrí `http://localhost:8123`. Para cortarlo, Ctrl+C.

Tiene que ser por servidor, no abriendo el archivo con doble clic: el juego usa
módulos de JavaScript y el navegador los bloquea si el origen es `file://`.

## Publicarlo (GitHub Pages)

1. Creá un repo en GitHub llamado, por ejemplo, `runner`.
2. Subí **el contenido de esta carpeta** a la raíz del repo (que `index.html`
   quede en la raíz, no adentro de otra carpeta).
3. Settings → Pages → Source: `Deploy from a branch`, rama `main`, carpeta `/root`.
4. En 1–2 minutos queda en `https://TUUSUARIO.github.io/runner/`.

Desde el primer día el link existe. Cada `git push` lo actualiza.

## Qué mirar en tu teléfono

Abrí el link en el celular y andá tachando:

- [ ] En **vertical** aparece "Girá el teléfono" y el juego se pausa.
- [ ] Al girar a **horizontal**, el juego ocupa la pantalla y se ve completo.
- [ ] El **primer toque** hace sonar el metrónomo (esto es la prueba de iOS).
- [ ] La **mitad izquierda** salta, la **mitad derecha** golpea (vibra la cámara).
- [ ] Se puede tocar las dos mitades **a la vez**.
- [ ] Arrastrar el dedo **no hace scroll**. Dos toques rápidos **no hacen zoom**.
      Deslizar desde arriba **no recarga** la página.
- [ ] Mantener el dedo apretado **no abre** el menú de copiar/pegar.
- [ ] Los **FPS** arriba a la izquierda. Anotá el número de "peor".
- [ ] **Retraso de detección del aterrizaje**: anotá el "peor". A 60 fps debería
      dar ~16 ms. Ese número decide cuán grandes tienen que ser las ventanas
      de perdón del paso 2.
- [ ] Salí a otra app y volvé: la música **no** tiene que quedar adelantada.

Decime los números y en qué teléfono los sacaste.

## Dónde se toca cada cosa

| Quiero cambiar…                              | Archivo |
|----------------------------------------------|---------|
| BPM, velocidad, altura y duración del salto, ventanas de perdón | `js/config/ritmo.js` |
| Resolución virtual, colores, vidas, puntaje  | `js/config/ajustes.js` |
| Cómo se lee al jugador (teclas y mitades)    | `js/sistemas/Entrada.js` |
| Animaciones y anclaje del personaje          | `js/sistemas/Personaje.js` |
| Rearmar el atlas al agregar sprites          | `herramientas/empaquetar_atlas.py` |
| El reloj musical                             | `js/sistemas/Reloj.js` |
| Configuración de Phaser, gestos, orientación | `js/main.js` |

**`ritmo.js` es el archivo importante.** Cambiás `BPM`, `PX_POR_PULSO` y
`ALTURA_SALTO`, y la gravedad, el impulso y la velocidad se recalculan solos para
que el salto siga durando exactamente un pulso. No edites los valores de abajo
de la línea `DERIVADOS`.
