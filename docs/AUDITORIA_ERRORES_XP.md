# BioMap – Auditoría Técnica de Errores y Plan de Acción (Metodología XP)

> **Marco de Trabajo:** Este informe adopta la **metodología Extreme Programming (XP)**, fundamentada en sus cinco valores esenciales (**Comunicación, Simplicidad, Retroalimentación, Valentía y Respeto**) y sus prácticas clave (**Test-Driven Development (TDD), Pair Programming, Refactorización Continua, Integración Continua y Diseño Simple**).

---

## 1. Aplicación de la Metodología XP al Proyecto

| Práctica XP                               | Aplicación en BioMap                                                                                                                                                |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Test-Driven Development (TDD)**         | Todo bug identificado debe reproducirse primero mediante una prueba unitaria o de integración fallida antes de modificar el código de producción.                   |
| **Diseño Simple (Simple Design / YAGNI)** | Eliminar código residual, sobreingeniería o suposiciones que ya no aplican (ej. limpiar residuos de exploración multi-ventana que interfieren con la cámara única). |
| **Refactorización Continua**              | Mejorar la estructura interna del código manteniendo la suite de pruebas automatizadas en verde.                                                                    |
| **Pequeñas Entregas (Small Releases)**    | Resolver los problemas en incrementos pequeños, atómicos y verificables.                                                                                            |
| **Pair Programming (Coprogramación)**     | Revisión cruzada constante, validación de contratos entre API y Web, y transparencia en los hallazgos.                                                              |

---

## 2. Inventario de Errores, Bugs y Riesgos Detectados

### Error 1 [CRÍTICO - RESUELTO]: Bloqueo de Vuelo de Cámara al Seleccionar Nuevos Puntos

- **Ubicación:** `apps/web/src/App.jsx` (líneas 192–207)
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se eliminó el bloqueo `if (!first) return;`. Ahora `selectPoint` actualiza el punto activo en el store, reubica la cámara fluidamente hacia el nuevo objetivo y comanda al Avatar 3D ("BioGuía") para que corra inmediatamente hacia el punto seleccionado para entregar su explicación hablada y visual.

---

### Error 2 [ALTO - RESUELTO]: Desincronización de Límites Geográficos en Configuración `.env`

- **Ubicación:** `.env` (línea 13)
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se actualizó el valor de `VITE_MAP_BOUNDS` en `.env` a `-71.855,-37.7672,-71.75374,-37.672`, alineándolo exactamente con `terrain.json` y la proyección del diorama 4K.

---

### Error 3 [MEDIO - RESUELTO]: Ausencia de Semilla de Imágenes en la Base de Datos (`seed.js`)

- **Ubicación:** `apps/api/seeds/seed.js` y `apps/api/seeds/sample-data.js`
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se agregó la exportación `SAMPLE_IMAGES` en `sample-data.js` con fotografías y panoramas 360° reales para los puntos principales (Central Angostura, Parque Angostura, Mirador Huequecura), y se implementó su inserción idempotente en `seed.js`.

---

### Error 4 [MEDIO - RESUELTO]: Desconexión entre `PerformanceMonitor` y Calidad Gráfica (`quality.js`)

- **Ubicación:** `apps/web/src/diorama/DioramaCanvas.jsx` (línea 66) frente a `quality.js`
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se conectó `PerformanceMonitor` con `useRenderStore.getState().stepTier(-1)` (ante caída de cuadros) y `stepTier(1)` (ante holgura de rendimiento), asegurando que tanto la resolución (DPR) como el presupuesto geométrico de árboles y relieve se adapten dinámicamente.

---

### Error 5 [ALTO/OPERATIVO - RESUELTO]: Falta de Instalación de Dependencias Locales en el Host

- **Ubicación:** Raíz del monorepo (`package.json`)
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se ejecutó `npm install` en la raíz del monorepo en Windows. Todas las dependencias quedaron vinculadas, los linters (`eslint`), formateadores (`prettier`) y suites de prueba (`vitest`) se encuentran plenamente operativos y en verde (191 pruebas unitarias pasando, 0 errores de lint).

---

### Error 6 [OPERATIVO - RESUELTO]: Repositorio Git sin Commits (Estado Untracked)

- **Ubicación:** Raíz del repositorio (`.git`)
- **Estado:** **RESUELTO ✅**
- **Solución aplicada:**
  Se configuró la identidad del autor local y se realizó el commit inicial estructurado en la rama `main`, garantizando la trazabilidad y el versionado completo del proyecto.
- **Descripción:**
  `git status` indica `On branch main / No commits yet` con todos los archivos desatendidos.
- **Impacto:**
  No existe trazabilidad de cambios, historial de versiones ni mecanismo de rollback ante fallos en el código fuente.
- **Acción Correctiva XP:**
  Realizar un commit inicial estructurado que fije el punto de partida del proyecto.
