# 🛡️ Guía Maestra del Proyecto: Wargods Premier / SoloQ Pro

Este documento sirve como referencia técnica y conceptual completa para explicar el estado actual de la plataforma a nuevos desarrolladores, usuarios o IAs de asistencia.

---

## 1. Concepto General
La aplicación es una plataforma de gestión de ligas competitivas de League of Legends que elimina la necesidad de hojas de cálculo manuales. Utiliza un backend robusto que consume la **Riot Games API** para automatizar el 100% de la recolección de datos y la asignación de recompensas.

## 2. El Motor de Datos (Backend: `Code.js`)
El "Cerebro" de la aplicación maneja:
-   **Scoring Dinámico**: Evalúa más de 40 parámetros por partida (KDA, DPM, GPM, Vision, Placas, Objetivos Épicos, Early Game Advantage).
-   **Inteligencia Artificial**: Integración con Gemini AI para análisis cualitativo de partidas y misiones.
-   **Sistema de Rangos**: Una escalera de progresión basada en materiales (Piedra -> Oro -> Diamante -> Cósmico).
-   **Gestión Económica**: Control de la moneda virtual `WG Coins`, transacciones de bolsa y apuestas.

## 3. La Interfaz de Usuario (Frontend)
El sistema se divide en tres capas principales:

### A. Centro de Mando (`index.html`)
-   Navegación centralizada.
-   Sistema de **Archivo** para visualizar temporadas previas.
-   Control de acceso (Login con PIN para Managers).

### B. Dashboard de Liga (`LeagueMenu.html`)
-   **TV en Directo**: Integración con Twitch y contador para el próximo stream.
-   **Social Hub**: El "Vestuario" (Trash talk) y sistema de notificaciones.
-   **Estadísticas Pro**: Ranking de jugadores con filtros por rol y equipo, incluyendo un "Quinteto Ideal" generado por stats.
-   **Herramientas Visuales**: Generación de imágenes H2H (Cara a Cara) para redes sociales usando `html2canvas`.

### C. Centro de Analítica
Herramientas específicas para el análisis de alto nivel:
-   **Synergy Dashboard**: ¿Qué campeones funcionan mejor juntos en esta liga?
-   **Behavior Tracker**: Análisis de rachas (Fuego/Hielo) y comportamiento bajo presión.
-   **Team Scouting**: Radar de fortalezas y debilidades de los equipos rivales.

## 4. Gamificación y Retención
La plataforma utiliza mecánicas de juegos RPG y Gacha:
-   **Battle Pass**: Progresión de temporada con recompensas cosméticas (títulos, colores de nombre).
-   **Daily Roulette**: Incentivo de login diario.
-   **Market & Casino**: Un juego dentro del juego donde los usuarios pueden "apostar" por sus jugadores favoritos o el resultado de los partidos.
-   **La Forja**: Un sistema de inventario donde se recolectan materiales de las partidas para fabricar mejoras.

## 5. Resumen para Prompt de IA
Si necesitas que otra IA trabaje en este proyecto, usa este prompt:

> "Estoy trabajando en un proyecto de gestión de eSports basado en Google Apps Script y HTML/JS. El sistema integra Riot API para puntuar jugadores de League of Legends. Tiene una economía completa con una moneda virtual (WG Coins), una bolsa de valores de jugadores, un casino de apuestas y un sistema de Battle Pass. El backend está en Code.js y maneja una lógica compleja de scoring v13.0. El frontend principal está en index.html y LeagueMenu.html. Necesito ayuda para [INSERTAR TAREA] manteniendo la estética premium y la integración con la base de datos de Google Sheets."

---

## 6. Estado Actual de Desarrollo
-   **Backend**: Estable v16.5.
-   **Frontend**: Diseño premium con efectos de "Mood" (Bull/Bear Market) y animaciones avanzadas.
-   **Base de Datos**: 100% funcional en Google Sheets con automatización de backups y logs.

---
*Este documento se actualiza automáticamente con cada iteración mayor del sistema.*
