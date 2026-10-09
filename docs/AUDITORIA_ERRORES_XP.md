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

### Error 4 [MEDIO]: Desconexión entre `PerformanceMonitor` y Calidad Gráfica (`quality.js`)

- **Ubicación:** `apps/web/src/diorama/DioramaCanvas.jsx` (línea 66) frente a `quality.js`
- **Severidad:** **Media**
- **Descripción:**
  El módulo `quality.js` define tiers de rendimiento (`low`, `medium`, `high`) que regulan no solo la densidad de píxeles (`DPR`), sino el presupuesto de vértices del relieve (`vertexBudget`), el tamaño de mosaicos y la cantidad máxima de árboles (`TIERS.forest.max` entre 40.000 y 180.000). Sin embargo, `PerformanceMonitor` en `DioramaCanvas.jsx` solo ejecuta:
  ```javascript
  <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(deviceDpr())} />
  ```
  Nunca invoca `useRenderStore.getState().stepTier(-1)` ni `stepTier(+1)`.
- **Impacto:**
  Si el Mini PC del museo posee una GPU integrada modesta (como Intel Iris Xe o UHD Graphics) y sufre caídas de cuadros, el sistema solo reduce la resolución pero sigue renderizando decenas de miles de instancias de árboles y una malla densa, impidiendo que el motor alcance los 60 FPS estables.
- **Acción Correctiva XP:**
  Conectar `onDecline` y `onIncline` con `useRenderStore.getState().stepTier()` para que la degradación sea verdaderamente integral y alivie la carga geométrica de la GPU.

---

### Error 5 [ALTO/OPERATIVO]: Falta de Instalación de Dependencias Locales en el Host

- **Ubicación:** Raíz del monorepo (`package.json`)
- **Severidad:** **Alta para Desarrollo Local**
- **Descripción:**
  Al intentar ejecutar `npm test` o `npm run lint` en el host de Windows, el sistema arroja:
  `'vitest' is not recognized as an internal or external command`.
  Esto ocurre porque `npm install` no se ha ejecutado en la raíz de la máquina anfitriona (el flujo se asumió únicamente dentro de Docker).
- **Impacto:**
  Impide ejecutar la batería de pruebas automatizadas y chequeos de estilo de forma instantánea en el ciclo local de Pair Programming sin depender del contenedor Docker.
- **Acción Correctiva XP:**
  Ejecutar `npm install` en la raíz para enlazar los workspaces y disponer de los binarios locales (`vitest`, `eslint`, `prettier`).

---

### Error 6 [OPERATIVO]: Repositorio Git sin Commits (Estado Untracked)

- **Ubicación:** Raíz del repositorio (`.git`)
- **Severidad:** **Alta para Gestión de Configuración y Seguridad del Código**
- **Descripción:**
  `git status` indica `On branch main / No commits yet` con todos los archivos desatendidos.
- **Impacto:**
  No existe trazabilidad de cambios, historial de versiones ni mecanismo de rollback ante fallos en el código fuente.
- **Acción Correctiva XP:**
  Realizar un commit inicial estructurado que fije el punto de partida del proyecto.
