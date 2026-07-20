# 📁 Estructura de Archivos y Estado del Proyecto
*Documento generado para entender la arquitectura y el estado local de la Wargods Premier League.*

## 📌 Estado del Repositorio Local
Este proyecto está vinculado a un repositorio Git y se encuentra en la rama `main`. 
Actualmente, la carpeta local está completamente limpia de errores y **está 4 actualizaciones (commits) por delante** del servidor remoto.
Esto significa que esta carpeta contiene la **versión más absoluta y reciente** de todo el código de la web y de la liga, incluyendo cambios que aún no se han subido a la nube.

---

## 🏗️ Archivos Más Importantes (Core de la Liga)

A continuación, se detallan los archivos fundamentales que hacen que la liga funcione, calculen puntos, conecten con la base de datos y muestren la interfaz web:

### ⚙️ El "Cerebro" (Backend y Lógica Principal)
*   **`Code.js`**: Este es el archivo **más crítico de todo el proyecto** (pesa más de 1 MB). Contiene toda la lógica del lado del servidor que se ejecuta en **Google Apps Script**. 
    *   **Funciones Principales**: Procesamiento de datos de los jugadores, llamadas a la API de Riot Games, lectura y escritura en la base de datos (Google Sheets), cálculo de puntuaciones de la liga, gestión de misiones secretas, economía, y envío de información al frontend.

### 🖥️ Interfaz y Vistas (Frontend)
Estos archivos son los que los usuarios ven y con los que interactúan en su navegador:
*   **`index.html`**: El archivo principal que sirve como punto de entrada de la aplicación web (Command Center).
*   **`LeagueMenu.html`**: Un archivo muy extenso que contiene la estructura principal del dashboard de la liga, la navegación y los menús interactivos.
*   **`Fantasy.html`**: Controla toda la sección del modo "Fantasy" o predicciones, donde los usuarios actúan como managers.
*   **Paneles de Datos (Dashboards)**:
    *   **`dashboard.html` / `analytics.html` / `BehaviorDashboard.html`**: Páginas dedicadas a mostrar gráficos, estadísticas avanzadas de equipos y jugadores, y analíticas de comportamiento.
*   **Páginas de Detalles**:
    *   **`PlayerProfile.html`**: La interfaz donde se muestra el "cromo" y estadísticas individuales de un jugador.
    *   **`MatchDetails.html`**: Vista detallada con el resumen de una partida específica.
*   **Herramientas Especiales**:
    *   **`RoflParser.html`**: Herramienta integrada para parsear y analizar archivos de repeticiones nativos de League of Legends (`.rofl`).

### 🗂️ Datos Estáticos y Configuración
*   **`CHAMPION_DATA.js`**: Contiene la información estática y metadatos de todos los campeones de League of Legends utilizados por la aplicación (nombres, imágenes, IDs, roles).
*   **Archivos de Despliegue (`.clasp.json` y `appsscript.json`)**: Son los archivos de configuración esenciales de **clasp** (Command Line Apps Script Projects). Permiten que todo este código local se sincronice, suba y se despliegue directamente en los servidores de Google.
*   **`SoloQ_Challenge_S2.xlsx`**: Archivo de Excel de gran tamaño que funciona como respaldo local de la base de datos o registro histórico de la Temporada 2 de la liga.

---

> [!IMPORTANT]
> **Nota de Seguridad:** Si necesitas hacer una copia de seguridad manual o transferir el proyecto a otro equipo, asegúrate de copiar la carpeta `SoloQ_Challenge` entera. La combinación de estos archivos (especialmente el `Code.js` junto con la configuración de `.clasp`) es lo que mantiene la plataforma viva y funcional.
