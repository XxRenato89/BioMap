# Carpeta de Animaciones 3D Estandarizadas (Quibar / Mascota)

Aquí se suben todas las animaciones del personaje 3D con su respectivo nombre para que el visor y la aplicación las carguen automáticamente.

## Archivos y Nombres Estándar

| Archivo | Acción | Descripción |
|---|---|---|
| `idle.fbx` | **idle** | Animación de reposo (Victory Idle). |
| `walk.fbx` | **walk** | Ciclo de caminata. |
| `run.fbx` | **run** | Ciclo de carrera. |
| `dance.fbx` | **dance** | Baile o festejo al llegar a un destino (Dancing Twerk). |
| `wave.fbx` | **wave** | Saludo inicial o presentación de fichas. |
| `clapping.fbx` | **clapping** | Aplausos. |

## Modelo 3D Base (Fuera de esta carpeta)

El modelo 3D con su malla y esqueleto se ubica fuera de la carpeta de animaciones:
- En la aplicación web: `/models/quibar.fbx` (o `/models/model.fbx`).

## Cómo agregar o reemplazar una animación

1. Exporta tu animación desde Mixamo o Blender en formato `.glb` o `.fbx`.
2. Renombra el archivo según su acción (`idle`, `walk`, `run`, `dance`, `wave`).
3. Cópialo directamente en esta carpeta (`public/animations/`).
4. Si agregas una animación con un nombre nuevo, agrégala a `manifest.json`.
