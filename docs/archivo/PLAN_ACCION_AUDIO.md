# Plan de Acción y Especificaciones Técnicas (Requerimientos del Audio)

Este documento recopila de manera exhaustiva los requerimientos, diagnóstico técnico del repositorio, propuesta de diseño e interactividad, y requerimientos del modelo 3D según lo transmitido en el audio.

---

## 1. Resumen de Requerimientos Transmitidos en el Audio

1. **Enfoque Territorial y Escala (Sector Angostura, Biobío):**
   - El mapa interactivo se enfoca en la **Región del Biobío**, especialmente en el **Sector Angostura** (embalse, central Angostura de Colbún, Quilaco y Santa Bárbara).
   - Mantener el enfoque de **escala 1:1 y aspecto realista/fidedigno** como valor diferenciador clave del proyecto frente a mapas caricaturizados o abstractos, controlando los rangos de zoom según la necesidad del cliente.

2. **Rutas Terrestres Reales entre Puntos de Interés:**
   - La navegación del personaje no debe ser en línea recta ("volar" sobre el mapa).
   - Debe recorrer y dibujar las **rutas sobre los caminos y carreteras reales** ya disponibles en el mapa/OSM (por ejemplo: ruta desde la represa hasta la playa).

3. **Mascota 3D de Colbún (Personaje Interactivo):**
   - Incorporar el modelo 3D oficial de la mascota de Colbún.
   - Mientras se traslada por la ruta trazada, debe reproducir animaciones de **correr / desplazarse** orientándose al camino.
   - Al llegar a destino, el personaje debe presentarse en **primer plano / modal grande** con un libro en la mano u objeto distintivo.
   - Debe interactuar con el usuario: narrar la historia/ambientación, mostrar imágenes, e idealmente **hacer gestos para cambiar/mover las imágenes** de forma inmersiva.

4. **Modo Inactivo / Demostración Automática (Idle Kiosk):**
   - Cuando nadie esté interactuando con la pantalla táctil, el personaje debe patrullar de forma autónoma: moverse entre rutas, detenerse en puntos, hacer gestos y continuar al siguiente punto automáticamente.

5. **Reemplazo del Módulo QR por el Personaje con Libro:**
   - Sustituir la tarjeta actual de QR por un bloque interactivo de la mascota sosteniendo un libro.
   - Al presionarlo (o periódicamente en estado inactivo), se activa una animación donde **el personaje abre el libro**, revelando el código QR con el mensaje: *"Escanea este QR para usar este mapa en tu celular"*.

6. **Solución del Bug de Capas (Agua / Tierra / Bloque Negro):**
   - Corregir el conflicto de profundidad y superposición de capas donde el agua es traspasada por la tierra o falla el renderizado al hacer zoom, generando bloques negros (z-fighting / clipping / depth buffer / polígonos de agua en elevaciones variables).

---

## 2. Diagnóstico Técnico del Repositorio Actual

- **Motor 3D:** React Three Fiber (`@react-three/fiber`), Three.js (`three`), y `@react-three/drei`.
- **Relieve y Terreno:** `lod.js` y `builders.js` procesan terreno con chunks de elevación, normales horneadas y shader de curvas de nivel.
- **Red Vial (Caminos):** En `apps/web/src/diorama/roads.js` y `bake.js` ya se importan y rasterizan las líneas viales de OpenStreetMap (`roads.geojson` / OSM ways). Se requiere indexar estas vías en un grafo de conectividad (Network Graph con A* o Dijkstra) para calcular la trayectoria poli-línea sobre el asfalto.
- **Capa de Agua (`water.js` y `builders.js`):**
  - Actualmente `buildWater` triangula polígonos 2D de OSM y eleva vértices con un `WATER_LIFT = 0.0015`.
  - Cuando la elevación del terreno supera la cota de agua o al acercar la cámara con `logarithmicDepthBuffer` y `polygonOffset: true` (`polygonOffsetFactor: -4`), se produce intersección de mallas y fallos de frustum clipping/z-buffer (bloques negros de caras invertidas o fondo vacío).
  - *Solución planificada:* Alinear la máscara de agua (`inlay.js`) con un rebaje de terreno (carving) garantizado bajo el agua y ajustar el `near/far` plane y material de agua sin valores negativos extremos de `polygonOffset`.
- **Avatar Actual (`Avatar.jsx`):**
  - Actualmente es una figura procedural básica con cajas y esferas (`createAvatarMaterials`) que camina en línea recta hacia el punto.
  - Ya dispone de un store (`useAvatarStore`) con estados (`patrol`, `running_to_point`, `speaking`), lo que facilita la migración hacia un modelo `.glb` con `useGLTF` y `useAnimations`.

---

## 3. Especificaciones Solicitadas para el Modelo 3D de la Mascota

Para integrar la mascota de Colbún de manera óptima en Three.js / React Three Fiber, se solicitan los siguientes requerimientos al equipo de diseño 3D:

| Requisito | Especificación Recomendada | Justificación |
| :--- | :--- | :--- |
| **Formato de Archivo** | **`.glb`** (Binary GLTF 2.0) | Incluye geometría, esqueleto (rig), texturas y clips de animación en un solo archivo comprimido óptimo para WebGL. |
| **Límite de Polígonos** | **15.000 – 30.000 triángulos (tris)** | Garantiza 60 FPS estables en resolución 4K (pantalla de 55" del tótem). |
| **Materiales y Texturas** | PBR (Principled BSDF) con texturas embebidas de **2048x2048** (Albedo/BaseColor, Roughness, Normal Map). | Compatibilidad nativa con `MeshStandardMaterial` de Three.js. |
| **Estructura del Rig** | Esqueleto humanoide o bípedo estilizado, con huesos en brazos, manos, cabeza y **hueso dedicado para el libro**. | Permite controlar poses, apertura de libro y gestos sincronizados. |

### Lista de Clips de Animación Requeridos (Nombres exactos en el .glb):
1. `Idle`: Respiración y postura en reposo sobre el mapa.
2. `Run`: Ciclo de carrera ágil y dinámico (para desplazarse por las carreteras).
3. `Walk`: Ciclo de caminata pausada (para modo patrulla o aproximación final).
4. `OpenBook`: Animación donde abre el libro y lo sostiene hacia el frente/cámara (para activación del QR y presentación de puntos).
5. `IdleBook`: Postura estática o respirando con el libro abierto en sus manos.
6. `PageFlip` o `SwipeGesture`: Gesto con la mano pasando una página o deslizando el aire (para sincronizar con el cambio de fotos en el carrusel).
7. `TalkGesture`: Gestos de explicación amigables (mover cabeza y manos) mientras presenta la información.

---

## 4. Plan de Acción por Fases

### Fase 1: Corrección de Capas y Renderizado de Agua (Fix Bloque Negro)
- Revisar `water.js`, `builders.js` (`buildWater`) y `inlay.js` para asegurar que el relieve de tierra se rebaje limpiamente en el área del embalse.
- Ajustar `polygonOffset`, `renderOrder`, y los planos `near`/`far` de la cámara en `CameraRig.jsx` para evitar clipping negro al hacer zoom.
- Pruebas de zoom máximo en el sector de la presa y playas de Angostura.

### Fase 2: Red Vial y Generador de Rutas Terrestres
- Extraer la red vial de los datos geoespaciales existentes en `osm.js`/`roads.js`.
- Crear un calculador de rutas (Network Pathfinding con A* / Dijkstra) que trace la ruta sobre el camino más corto entre dos puntos seleccionados.
- Renderizar una línea trazada brillante/estilizada en 3D sobre la carretera que muestre el recorrido que hace el personaje.

### Fase 3: Integración del Personaje 3D (Mascota Colbún) en el Diorama
- Cargar el modelo `.glb` con `@react-three/drei` (`useGLTF` y `useAnimations`).
- Reemplazar el avatar procedural en `Avatar.jsx` por la mascota.
- Implementar la cinemática de carrera a lo largo de los waypoints de la ruta terrestre, orientando la rotación (heading) hacia la tangente del camino y muestreando la altura del suelo con `heightAt(x, z)`.

### Fase 4: Experiencia Interactiva al Llegar al Hito
- Al llegar al punto: transición suave de cámara y despliegue del personaje en primer plano interactivo.
- Animación de apertura de libro / presentación.
- Sincronización entre la animación de gestos del personaje (`PageFlip` / `SwipeGesture`) y la navegación de imágenes del carrusel informativo existente.
- Muestreo de los contenidos, historia y ambientación de Angostura presentes en la base de datos local.

### Fase 5: Rediseño del Módulo QR (Personaje con Libro Interactivo)
- Transformar `QrCard.jsx` en un componente con el personaje 3D / ilustración interactiva sosteniendo un libro.
- Al hacer clic o por timer en idle: animación de abrir el libro y desplegar el código QR con el texto: *"Escanea este código QR para explorar Angostura en tu celular"*.
- Conectar la inactividad global para que el personaje alterne entre patrullaje por rutas y llamado de atención con el QR.

---

## 5. Decisiones de Diseño Acordadas (/grill-me)

- **Decisión 1 (Asset 3D de la Mascota):** Aún no se cuenta con el archivo final de la mascota de Colbún. Se implementará una arquitectura con modelo 3D provisional/placeholder (.glb estilizado con rig de huesos y animaciones: Run, Walk, Idle, OpenBook, Swipe/PageFlip, Talk) para dejar todo el sistema funcional y desacoplado, listo para hacer un reemplazo transparente cuando se entregue el `.glb` final.
- **Decisión 2 (Presentación en Destino):** Al arribar a un punto, se desplegará un panel/modal interactivo enriquecido con un viewport 3D en primer plano donde la mascota sostiene el libro, mientras a su lado se exhiben la historia y la galería fotográfica. Los cambios de foto activan animaciones de pase de página o señalamiento de la mascota.
- **Decisión 3 (Trazado y Activación de Rutas):** Al tocar cualquier hito del mapa, se calcula el camino sobre la red vial existente y se dibuja una ruta luminosa 3D sobre la carretera desde la ubicación actual de la mascota hasta el destino. Además, se añade un selector de rutas temáticas populares (ej. "Ruta Represa a Playas", "Circuito Angostura") para recorridos guiados automáticos.
- **Decisión 4 (Widget Mascota + Libro + QR):** Se transformará el bloque de QR en un widget interactivo situado en la esquina inferior donde la mascota sostiene un libro cerrado. Al tocarlo directamente, o de forma automática cuando el kiosco detecte inactividad, se despliega en tamaño ampliado con animación 3D donde abre el libro y expone el código QR nítido para escanear con el teléfono móvil, volviendo a cerrarse al continuar la exploración.
- **Decisión 5 (Prioridad de Ejecución):** Se ejecutará en primer lugar la resolución del bug crítico visual de capas y clipping negro del agua al hacer zoom. A continuación, se construirá el cálculo de rutas sobre carreteras reales, seguido por la integración del sistema de la mascota 3D (con rig, animaciones de carrera, panel de llegada con libro interactivo y widget de QR).

