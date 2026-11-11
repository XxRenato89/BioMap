# Carpeta de Animaciones 3D Estandarizadas (Quibar / Mascota)

Aquí se suben todas las animaciones del personaje 3D con su respectivo nombre para que el visor y la aplicación las carguen automáticamente.

## Archivos y Nombres Estándar

| Archivo    | Acción   | Descripción                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `walk.glb` | **walk** | Ciclo de caminata (Mixamo).                             |
| `run.glb`  | **run**  | Ciclo de carrera (Mixamo).                              |
| `idle.glb` | **idle** | Reposo: respira, mueve la cola y la cabeza.             |
| `look.glb` | **look** | Pausa del paseo: mira el paisaje.                       |
| `wave.glb` | **wave** | Saludo (pausa del paseo y al abrir una ficha).          |
| `clapping.glb` | **clapping** | Aplauso (pausa y al hallar un lugar secreto).   |
| `sit.glb`  | **sit**  | Pausa del paseo: se sienta a descansar.                 |

`idle`, `look`, `wave`, `clapping` y `sit` se generan con Blender:
`blender -b -P apps/web/scripts/quibar.blender.py -- <quibar-original.glb> <salida> apps/web/public/animations/walk.glb`.
El mismo script aligera el modelo (de 25 MB a 3,4 MB) y le agrega los tres huesos de la cola.
Sin `idle.glb`, Quibar queda quieto en el primer cuadro de la caminata.

## Modelo 3D Base (Fuera de esta carpeta)

El modelo 3D con su malla y esqueleto se ubica fuera de la carpeta de animaciones:

- En la aplicación web: `/models/quibar.glb`.

## Cómo agregar o reemplazar una animación

1. Exporta tu animación desde Mixamo o Blender en formato `.glb` o `.fbx`.
2. Renombra el archivo según su acción (`idle`, `walk`, `run`, `dance`, `wave`).
3. Cópialo directamente en esta carpeta (`public/animations/`).
4. Si agregas una animación con un nombre nuevo, agrégala a `manifest.json`.
