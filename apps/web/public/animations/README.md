# Carpeta de Animaciones 3D Estandarizadas (Quibar / Mascota)

Aquí se suben todas las animaciones del personaje 3D con su respectivo nombre para que el visor y la aplicación las carguen automáticamente.

## Archivos y Nombres Estándar

| Archivo    | Acción   | Descripción                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `walk.glb` | **walk** | Ciclo de caminata. Quieto, Quibar usa su primer cuadro. |
| `run.glb`  | **run**  | Ciclo de carrera.                                       |

## Modelo 3D Base (Fuera de esta carpeta)

El modelo 3D con su malla y esqueleto se ubica fuera de la carpeta de animaciones:

- En la aplicación web: `/models/quibar.glb` (o `/models/model.glb`).

## Cómo agregar o reemplazar una animación

1. Exporta tu animación desde Mixamo o Blender en formato `.glb` o `.fbx`.
2. Renombra el archivo según su acción (`idle`, `walk`, `run`, `dance`, `wave`).
3. Cópialo directamente en esta carpeta (`public/animations/`).
4. Si agregas una animación con un nombre nuevo, agrégala a `manifest.json`.
