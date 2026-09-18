# 🚀 Guía de Compilación y Descarga del Instalador Windows (.EXE) con GitHub Actions

Esta aplicación está 100% configurada para empaquetarse de manera automática como una **aplicación de escritorio nativa para Windows** (`.exe`) cada vez que realices cambios o lo solicites manualmente en tu repositorio de GitHub.

---

## 📁 Archivos Configurados en el Proyecto

1. **`.github/workflows/build-desktop.yml`**: Flujo de trabajo de GitHub Actions automatizado en máquinas virtuales Windows (`windows-latest`).
2. **`electron-builder.json`**: Configuración de empaquetado de Electron Builder (creación de instalador NSIS y versión portable independiente).
3. **`electron/main.cjs`**: Proceso principal de Electron con aceleración por hardware, soporte POS, pantalla completa e impresión directa de facturas y tickets.
4. **`electron/preload.cjs`**: Puente seguro de contexto entre Node.js y la aplicación web React.
5. **`vite.config.ts`**: Configuración con rutas relativas (`base: './'`) para compatibilidad tanto en servidor web como en archivo local de escritorio.

---

## ⚡ ¿Cómo se Genera el .EXE Automáticamente?

El proceso de compilación se inicia en cualquiera de estas situaciones:

1. **Automático al hacer Push:** Al enviar cambios (`git push`) a las ramas `main` o `master`.
2. **Manual desde GitHub (Workflow Dispatch):**
   - Ve a la pestaña **Actions** en tu repositorio de GitHub.
   - En el menú lateral izquierdo, haz clic en **"Compilar y Generar Instalador Windows .EXE"**.
   - Haz clic en el botón gris **"Run workflow"**.
   - (Opcional) Escribe la versión (ej. `v1.0.0`) y haz clic en el botón verde **"Run workflow"**.
3. **Al crear un Tag o Release:** Al crear una etiqueta como `v1.0.0`, GitHub Actions compila y adjunta automáticamente los `.exe` a la sección de **Releases**.

---

## 📥 ¿Dónde y Cómo Descargar los Archivos .EXE?

### Opción A: Desde los Artefactos de la Ejecución (Recomendada)
1. Entra a tu repositorio en GitHub y haz clic en la pestaña superior **"Actions"**.
2. Haz clic sobre la última ejecución que tenga un círculo verde de éxito (✔ **Compilar y Generar Instalador Windows .EXE**).
3. Desplázate hacia abajo hasta la sección **"Artifacts"** (Artefactos).
4. Verás los enlaces listos para descargar:
   - 💾 **`Distribuidora-LaGranBodega-Instalador-Setup-EXE`**: Descarga el instalador asistido con accesos directos en el Escritorio y Menú Inicio.
   - ⚡ **`Distribuidora-LaGranBodega-Ejecutable-Portable-EXE`**: Descarga la versión portable lista para abrir sin instalación (ideal para pendrives o cajas rápidas).
   - 📦 **`Todos-Los-Ejecutables-Windows-EXE`**: Paquete completo con ambos archivos.

*(Nota: GitHub descarga los artefactos en formato `.zip`. Solo debes descomprimir el archivo descargado para obtener tu `.exe` listo para usar).*

---

### Opción B: Desde GitHub Releases
Si activaste la opción de Release o hiciste un tag, ve a la sección **"Releases"** en la columna derecha de tu repositorio en GitHub y descarga el `.exe` directamente sin necesidad de descomprimir.

---

## 💻 Instrucciones de Instalación y Ejecución en Windows

1. **Instalador (`Distribuidora-Setup-Installer.exe`):**
   - Haz doble clic para iniciar el asistente de instalación.
   - Puedes elegir la carpeta de destino.
   - Se creará un acceso directo en tu Escritorio: **"Distribuidora La Gran Bodega ERP"**.

2. **Portable (`Distribuidora-Demo-Portable.exe`):**
   - Haz doble clic y el sistema abrirá la ventana maximizada inmediatamente.

3. **Aviso de Windows SmartScreen (Primer inicio):**
   - Al tratarse de un ejecutable recién compilado sin certificado de firma de pago, Windows puede mostrar la ventana azul *"Windows protegió su PC"*.
   - Simplemente haz clic en **"Más información"** (*More info*) y luego en **"Ejecutar de todas formas"** (*Run anyway*).
