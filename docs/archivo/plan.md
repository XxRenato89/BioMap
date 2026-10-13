# Prompt para el agente: BioMap, rediseño profesional + mascota y Bio-Book

> Pega todo lo de abajo en tu agente. Reemplaza al prompt anterior: ya incluye la mascota corriendo A → B y el libro con QR, adaptados al mapa 3D real (MapLibre).
> Completa los `[CORCHETES]` antes de enviarlo.

---

## 1. ROL Y ALCANCE

Eres un desarrollador front-end senior y diseñador de producto, con experiencia en MapLibre GL JS, interfaces táctiles tipo quiosco, animación web y accesibilidad. Trabajas sobre **BioMap – Mapa Vivo del Bío Bío**, un visor interactivo 3D para el Centro de Visitantes Angostura (Colbún S.A.), pensado para pantallas táctiles de visitantes.

**Stack existente (respétalo):** React + MapLibre GL JS (3D con pitch + terrain), tileserver-gl-light con MBTiles locales, backend Node/Express + PostgreSQL/PostGIS. Todo corre **100% local, sin internet** (no usar CDN, fuentes de Google, ni tiles/servicios externos).

**Alcance de este trabajo:** capa de presentación y experiencia (UI/UX, estilo del mapa, animaciones, mascota, Bio-Book). **No cambies contratos de la API ni el esquema de base de datos.** Si necesitas un dato nuevo, propónlo por escrito en el resumen final en vez de modificarlo.

**Antes de codificar:** revisa el repo (estructura, estilos, estilo MapLibre actual, componentes de UI, i18n), toma capturas del estado actual a 1920×1080 y a un viewport táctil vertical `[1080×1920 u otra resolución del quiosco]`, y resume en 10 líneas tu diagnóstico y plan. Luego implementa por fases (sección 9), verificando visualmente al cerrar cada una.

---

## 2. DIAGNÓSTICO DEL ESTADO ACTUAL (lo que se ve en la captura)

Corrige todo esto; es la lista de "por qué hoy no se ve profesional":

**Estado y errores**
1. Aparece un aviso permanente **"Sin conexión con el servidor. Reintentando…"** en el centro superior. Mezcla de mensaje técnico con un estado que, en un producto offline-first, no debería alarmar al visitante.
2. **No se ve ningún punto de interés en el mapa**, aunque el texto dice "Toca un punto para ver su ficha". Probablemente es consecuencia del fallo de conexión: falta un estado vacío/carga/error bien diseñado (skeleton, reintento, y degradación elegante).

**Jerarquía y consistencia de la interfaz**
3. Paneles con estilos distintos entre sí: tarjeta del título (verde oscuro, vidrio), botones de arriba a la derecha (crema, tamaños distintos), pila vertical de zoom/3D (crema + verde), selector inferior (verde oscuro con pastilla blanca). No hay un sistema de diseño único.
4. Panel **"CAPAS"** colapsado y casi vacío: no se entiende qué contiene ni cómo se abre.
5. Un botón con **ícono de montaña sin etiqueta** (control de relieve/terreno) que no se entiende solo.
6. Controles superiores (`Aa+`, `Contraste`, `English`) con anchos y alturas irregulares; la brújula flota aparte sin alinearse con el resto.
7. **Textos muy pequeños** para un quiosco táctil: la ayuda "Arrastra para girar la maqueta · pellizca para acercar", el texto "Vuelve sola al inicio tras 45 s sin uso", las etiquetas del selector Región/Zona/Detalle y la atribución.
8. **Idioma mezclado:** el widget inferior izquierdo dice *"Tap to open the Bio-Book!"* en inglés dentro de una interfaz en español.
9. El widget inferior izquierdo es un **rectángulo marrón en una caja gris casi vacía** (parece un placeholder del Bio-Book): no comunica nada ni invita a tocar.

**Calidad del mapa 3D**
10. **Etiquetas del mapa diminutas y sin jerarquía** ("Embalse Angostura", "Presa Angostura"): sin halo/contorno, tamaño ilegible a esa distancia, sin ícono.
11. **Agua** como polígono plano celeste con borde dentado, sin profundidad, sin transición con la orilla ni reflejo; destaca como "pegado" sobre el relieve.
12. **Artefactos en los bordes del terreno** (zona blanca/bloques cerca de la presa a la izquierda, corte brusco de la maqueta).
13. **Textura satelital borrosa y plana** en primer plano; contraste de color desbalanceado (verdes muy saturados y oscuros contra zonas amarillentas de baja resolución).
14. **Sin cielo ni atmósfera:** el horizonte se corta con montañas que se pierden en blanco, sin niebla de profundidad.
15. Árboles/vegetación se ven bien, pero **ruidosos** (patrón repetitivo, demasiado denso en primer plano) y pueden afectar el rendimiento.

---

## 3. SISTEMA DE DISEÑO (crear primero; todo lo demás lo usa)

Crea **design tokens** (variables CSS o archivo de tema) y úsalos en todos los componentes. Nada de colores/medidas sueltas.

- **Color:** paleta derivada de la marca BioMap/Colbún `[PALETA O "propón una"]`: 1 primario (verde bosque), 1 acento cálido (para llamadas a la acción y estados activos), neutros (5 pasos), colores semánticos (éxito, aviso, error, info). Dos temas: **normal** y **alto contraste** (el botón "Contraste" debe cambiar tokens, no solo "oscurecer").
- **Contraste:** texto/ícono ≥ **4.5:1** (WCAG AA) sobre cualquier fondo, incluyendo sobre el mapa (usar paneles con fondo sólido/translúcido suficiente, no texto suelto sobre el relieve).
- **Tipografía:** una familia sans-serif legible, **empaquetada localmente** (woff2 en el proyecto). Escala: título 28–32 px, subtítulo 18–20, cuerpo ≥ **16 px**, etiquetas/ayudas ≥ **14 px**. El botón `Aa+` debe escalar la tipografía global con `rem` (100 % / 125 % / 150 %), recordando la preferencia.
- **Espaciado y forma:** escala de 4/8 px, radios consistentes (p. ej. 12 y 20 px), una sola escala de sombras (3 niveles).
- **Objetivos táctiles:** mínimo **48×48 px** con 8 px de separación; área de toque, no solo el ícono.
- **Iconografía:** un solo set de íconos SVG coherente (mismo trazo y tamaño), todos con `aria-label` y, en controles ambiguos, etiqueta visible o tooltip largo-presionar.
- **Componentes base reutilizables:** `Panel`, `Boton` (primario/secundario/icono), `Segmentado`, `Chip`, `Toast/Estado`, `Tooltip`, `Skeleton`. Todos con estados: normal, hover, pressed, focus-visible, disabled, loading.
- **Movimiento:** duraciones (120/200/320/500 ms) y curvas definidas como tokens; transiciones solo con `transform`/`opacity`.

---

## 4. REDISEÑO DE LA INTERFAZ (componente por componente)

**4.1 Cabecera/Marca (arriba izquierda):** logotipo + nombre "BioMap" y subtítulo, compacto. La instrucción "Toca un punto…" pasa a ser un **onboarding de primera vez** (3 pasos cortos con ilustración, descartable) y no texto fijo permanente.

**4.2 Capas:** panel claro con **título "Capas" visible, ícono y contador**; al abrir, lista de capas temáticas (Historia, Ecología y biodiversidad, Turismo, …) con **interruptores grandes**, color/ícono de cada capa igual al de sus marcadores en el mapa, y leyenda. Cerrado por defecto, pero con flecha/estado evidente.

**4.3 Controles de accesibilidad e idioma (arriba derecha):** un único grupo alineado, mismo alto y estilo: `Tamaño de texto`, `Alto contraste`, `Idioma ES/EN` (con bandera o código, no solo "English"). Estado activo claramente distinto. El idioma cambia **toda** la interfaz y el contenido de fichas, sin recargar.

**4.4 Controles del mapa (derecha):** columna única y ordenada: Brújula (rota con el mapa; al tocar, norte arriba) · Zoom + / − · Alternar 2D/3D con **etiqueta visible** · Relieve (con etiqueta/tooltip claro y valor, p. ej. exageración suave/normal/alta) · "Reiniciar vista" **como botón secundario con ícono + texto**, separado del resto. Misma altura/anchos, sin solaparse con atribuciones.

**4.5 Selector Región / Zona / Detalle (abajo centro):** componente `Segmentado` más grande y legible, con ícono por nivel y descripción en una línea ("Toda la cuenca", "Cada lugar", "Nombres y hitos"), transición animada de la pastilla activa, y que **realmente cambie el nivel de detalle** (zoom + qué etiquetas/capas se muestran). La ayuda de gestos pasa a un **tip contextual** que aparece unos segundos y se oculta; el texto de "Vuelve sola al inicio tras 45 s" se sustituye por una **cuenta regresiva visible** solo en los últimos 10 s, con opción "Seguir explorando".

**4.6 Estados del sistema (reemplaza el aviso actual):**
- *Cargando:* skeletons en paneles y una pantalla de carga con la mascota y barra de progreso al abrir.
- *Servidor no disponible:* **no** un aviso permanente en el centro. Muestra el mapa base con lo que haya en caché/local y una **pastilla discreta** ("Contenido limitado · reintentando") con ícono; reintentos con backoff exponencial; al recuperarse, un toast breve "Contenido actualizado". Si no hay datos, estado vacío amable con la mascota y botón "Reintentar".
- *Sin puntos / error de ficha:* mensajes en lenguaje humano, nunca códigos técnicos.

---

## 5. MEJORAS DEL MAPA 3D (MapLibre)

Verifica cada API contra la **versión de MapLibre instalada** antes de usarla.

1. **Cielo y atmósfera:** configurar sky/fog (degradado de cielo, niebla de distancia) para que el horizonte no se corte en blanco; ajustar `maxPitch` y límites de cámara (`maxBounds`) para que **nunca se vean los bordes de la maqueta**.
2. **Relieve:** `terrain` con exageración moderada y configurable (≈1.2–1.6), **hillshade** suave con luz consistente (noroeste) y curvas de nivel sutiles solo en zoom alto, para dar volumen sin ruido.
3. **Imagen satelital:** equilibrar color (saturación y brillo; evitar verdes casi negros), mezclar con hillshade, y usar el nivel de detalle más alto disponible según zoom. Si la resolución local es insuficiente en primer plano, **suavizar con transición** en vez de mostrar bloques; reportar la limitación.
4. **Agua:** estilo propio para embalse y ríos: degradado de profundidad (más oscuro al centro), borde con transición/orilla clara, ligera animación de brillo o movimiento sutil (opcional, apagable) y **sin bordes dentados** (simplificar/suavizar geometría o usar bordes antialias). Revisar el corte cerca de la presa.
5. **Etiquetas:** capas de símbolos con **halo/contorno**, jerarquía por tipo (embalse/presa > hitos > caminos), tamaño interpolado por zoom, colisión controlada, ícono junto al texto, y mínimo ≥ 13–14 px efectivos. Idioma de etiquetas según ES/EN cuando exista el dato.
6. **Marcadores de puntos de interés:** diseño propio por capa (forma + ícono + color; no depender solo del color), tamaño táctil ≥ 48 px, animación de pulso suave en los disponibles, estado seleccionado claro, **clustering** o agrupación por zoom para evitar solapes, y anclaje correcto al terreno (que no floten ni queden bajo el relieve).
7. **Vegetación:** reducir densidad en primer plano, variar escala/rotación para romper patrones repetitivos, y desactivar o simplificar automáticamente si los FPS bajan.
8. **Rendimiento:** medir FPS y tiempo de carga en el equipo objetivo `[mini PC: CPU/GPU/RAM]`. Meta: **≥ 30 FPS estables** en navegación, primera pantalla útil < 5 s. Implementar degradación automática de calidad (menos árboles, sin animación de agua, menor resolución de terreno) si el rendimiento cae.
9. **Cámara:** transiciones con `easeTo`/`flyTo` y curvas suaves; el cambio Región/Zona/Detalle y la selección de un punto mueven la cámara con composición cuidada (el punto queda en el tercio visible, nunca tapado por el panel de ficha). Gesto de inactividad → vuelta a la vista inicial a los `[45] s` con animación.

---

## 6. FICHAS DE PUNTOS (panel de información)

- Abre como **panel lateral/inferior animado** (spring corto), sin tapar el punto seleccionado.
- Contenido: título, categoría (chip con el color de su capa), carrusel de fotos con indicadores y gestos de deslizar, botón **Ver en 360°**, texto en bloques cortos con subtítulos, datos clave en pares etiqueta/valor, y botón **Cómo llegar / Siguiente punto**.
- Entrada escalonada (stagger) de los bloques; estado de carga con skeleton; imágenes con `loading` progresivo y *fallback* si faltan.
- Visor 360° fluido, con indicador de que se puede arrastrar, y botón claro de salir.
- Botón de cerrar grande (≥ 48 px), cierre por gesto de arrastre hacia abajo y con tecla `Esc`.

---

## 7. MASCOTA Y RECORRIDO A → B (estilo Duolingo, sobre el mapa 3D)

**Mascota:** `[NOMBRE]`, mascota de `[EMPRESA/CLIENTE]`. Assets: `[RUTA o "no hay aún"]`. Si no hay arte final, crea un placeholder SVG con partes separables, reemplazable cambiando un solo archivo/config.

**Flujo:**
1. **Reposo:** la mascota está en el punto actual (A) con animación idle (respiración, parpadeo).
2. **Elegir destino:** el usuario toca el punto B (o "Siguiente").
3. **Recorrido:** la mascota **sale corriendo siguiendo la ruta real** entre A y B.
   - La ruta es un `LineString` GeoJSON (camino/sendero); la posición se calcula **a lo largo de la línea** (p. ej. con Turf `along`/`bearing`) y se interpola con easing (acelera, mantiene, frena).
   - La mascota es un **marcador/capa personalizada anclada al terreno** (consultar elevación con `queryTerrainElevation` si está disponible) para que suba y baje con el relieve.
   - **Ruta que se pinta** al avanzar (`line-gradient` con `lineMetrics: true` o equivalente).
   - **La cámara la sigue** con pitch y zoom suaves; ligera inclinación según la pendiente, sin marear.
   - Ciclo de carrera con rebote, orientación según dirección (voltear/rotar), polvo ligero opcional.
   - Duración por ruta configurable (2–5 s); **tocar para saltar** la animación.
4. **Llegada:** frena con pequeño derrape/rebote, pose de celebración y se abre la **ficha** (sección 6) con entrada animada y un detalle de recompensa sutil (brillo/confeti liviano).

**Máquina de estados explícita** (reducer o XState): `idle → eligiendoDestino → corriendo → llegando → mostrandoFicha → (mostrandoBioBook) → idle`. Ignorar o encolar toques durante animaciones para evitar estados rotos.

---

## 8. BIO-BOOK: LIBRO CON QR (reemplaza el widget inferior izquierdo actual)

El widget actual (caja gris con rectángulo marrón y texto en inglés) se convierte en la experiencia **Bio-Book**:

1. **Estado cerrado (siempre visible, abajo izquierda):** la mascota con su libro cerrado, tamaño compacto pero con presencia, con animación idle y una invitación en español ("Abre el Bio-Book"), traducible. Debe verse como un elemento de marca, no como un placeholder.
2. **Al tocarlo:** la mascota levanta el libro frente a cámara y **lo abre** (rotación 3D con `perspective`/`rotateY` o animación Lottie/Rive).
3. **Dentro del libro:** el **QR real y escaneable** en la página derecha (centrado, módulos oscuros sobre fondo claro, **zona de silencio** suficiente, tamaño mínimo ≥ 160 px en móvil y 200–240 px recomendado); en la página izquierda, un texto breve ("Escanéalo y lleva el mapa en tu celular") y el logo. Una vez abierto, la página del QR queda **plana y frontal** (sin deformación por la perspectiva).
4. **No mostrar tarjeta con QR en ningún caso.** Todo QR (acceso a la app local por wifi, QR de un punto concreto) se muestra dentro del libro.
5. El QR se **genera en el cliente** desde una URL configurable (librería local liviana, salida SVG/canvas). Debajo, la URL en texto corto como alternativa accesible.
6. **Cerrar:** botón claro y gesto; la mascota cierra el libro y vuelve al estado 1. Cierre automático tras inactividad.
7. Debe funcionar **sin internet**; el QR apunta a la dirección de la wifi local dedicada `[URL/IP local o variable de entorno]`.

---

## 9. ORDEN DE TRABAJO

1. Diagnóstico + capturas "antes" + plan.
2. Design tokens, tipografía local, componentes base, temas normal/contraste, escala de texto.
3. Estados del sistema (carga/error/vacío) y corrección del aviso de conexión.
4. Rediseño de cabecera, Capas, controles y selector Región/Zona/Detalle.
5. Estilo del mapa: cielo/niebla, relieve, agua, etiquetas, marcadores, límites de cámara, vegetación.
6. Fichas de puntos y visor 360°.
7. Mascota + recorrido A → B + máquina de estados.
8. Bio-Book con QR.
9. i18n completa ES/EN, accesibilidad, rendimiento y pulido final.

Tras cada fase: verificar en navegador (1920×1080 y vertical táctil), comparar con la captura "antes", corregir y recién avanzar.

---

## 10. CALIDAD Y ACCESIBILIDAD (transversal)

- **Táctil/quiosco:** sin selección de texto ni menú contextual accidental, sin zoom de página del navegador, gestos del mapa con inercia, **soporte multiusuario/concurrente** sin bloqueos (RNF: ≥ 6 usuarios táctiles), reinicio automático por inactividad.
- **Accesibilidad:** navegación completa por teclado con foco visible, roles/`aria-label`, anuncios `aria-live` al abrir fichas y cambiar estados, `prefers-reduced-motion` respetado (sin carrera larga ni confeti; la mascota "aparece" en B con fade), contraste AA verificado.
- **i18n:** cero textos hardcodeados; todo en archivos de traducción ES/EN (incluido *"Tap to open the Bio-Book!"*).
- **Offline:** auditar y eliminar cualquier petición externa (fuentes, íconos, CDNs, analíticas, tiles remotos).
- **Código:** componentes tipados, sin estilos en línea dispersos, sin warnings/errores en consola, build de producción OK. Pruebas con Vitest + Testing Library para la máquina de estados, el cálculo de la ruta, el cambio de idioma/contraste y la generación del QR.

---

## 11. CRITERIOS DE ACEPTACIÓN

- [ ] No aparece ningún aviso técnico permanente; el estado de conexión es discreto y recuperable, y el mapa muestra los puntos o un estado vacío claro.
- [ ] Un solo sistema visual en todos los paneles y botones; ningún texto de interfaz por debajo de 14 px; objetivos táctiles ≥ 48 px.
- [ ] Contraste AA en tema normal y alto contraste; `Aa+` escala toda la interfaz.
- [ ] Toda la interfaz y fichas cambian de ES a EN sin recargar; no queda texto en idioma equivocado.
- [ ] El mapa tiene cielo/niebla, relieve con volumen, agua cuidada, etiquetas legibles con halo y marcadores propios; no se ven bordes de la maqueta ni artefactos blancos.
- [ ] ≥ 30 FPS estables en el equipo objetivo y degradación automática si baja.
- [ ] La mascota recorre la ruta real A → B, anclada al terreno, con la cámara siguiéndola y la ruta pintándose; se puede saltar.
- [ ] Al llegar, la ficha aparece animada sin tapar el punto.
- [ ] El Bio-Book sustituye al widget actual; el QR está **dentro del libro abierto**, es escaneable con un celular real y no hay tarjetas con QR.
- [ ] Todo funciona sin internet.
- [ ] Respeta `prefers-reduced-motion` y es operable con teclado.

---

## 12. ENTREGA

- Código funcionando en el repo, con configuración de ejemplo (≥ 3 puntos, 2 rutas, 1 punto con QR).
- Capturas **antes/después** de cada fase en una carpeta `docs/rediseno/`.
- `README` corto: cómo agregar puntos/rutas, cambiar la mascota, cambiar la URL del QR, ajustar tokens de diseño y calidad gráfica.
- Resumen final: decisiones técnicas, dependencias agregadas, limitaciones conocidas (p. ej. resolución de la textura satelital) y datos nuevos que se necesitarían de la API.