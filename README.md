# 🏆 Wargods Premier League - Ecosystem v16.5 (Master Edition)

**Wargods Premier** es el motor de gestión competitiva definitivo para League of Legends. Es un ecosistema masivo que transforma Google Sheets en una plataforma de eSports de alto rendimiento, integrando analíticas avanzadas, economía virtual, sistemas sociales y gamificación profunda.

---

## 🚀 Módulos Principales

### 1. 🕹️ Centro de Mando (Command Center)
La puerta de entrada a la plataforma. Un hub moderno que unifica todas las experiencias:
*   **Events Hub**: Acceso a la bolsa de valores, tienda y misiones.
*   **Ranking Oficial**: Clasificación de jugadores, medallero y estadísticas de temporada.
*   **Centro de Datos**: Analíticas Pro para equipos y analistas.
*   **Ligas y Torneos**: Gestión integral de brackets y enfrentamientos competitivos.
*   **Archivo Histórico**: Sistema "Ghost Filter" para navegar entre temporadas actuales y pasadas.

### 2. 📊 Engine de Puntuación "SoloQ Pro" (v13.0)
Un sistema de backend ultra-detallado en `Code.js` que analiza cada partida vía **Riot API**:
*   **Scoring Multidimensional**: Puntos por victoria/derrota, MVP (OP.GG), KDA, objetivos (épicos, placas, torres), y rendimiento temprano (CS/Oro/XP @10).
*   **Bonos de Rol**: Recompensas específicas para Tanques (daño mitigado), Supports (protección/curación) y Junglas (robos de objetivos).
*   **Misiones Secretas**: Logros ocultos como el "888", "777", "Comeback" (7k oro desventaja) o "Throw" (pérdida de ventaja masiva).
*   **Sistema de Tiers**: 8 rangos evolutivos desde "El Pozo" (<0 pts) hasta "Omnipotencia" (1500+ pts), pasando por materiales míticos y cósmicos.

### 3. 💸 Ecosistema Económico & Social
*   **Wargods Wall Street**: Mercado de valores en tiempo real donde los usuarios invierten en jugadores basados en su rendimiento.
*   **Casino de la Liga**: Sistema de apuestas dinámico con cuotas calculadas algorítmicamente.
*   **La Forja**: Sistema de crafteo donde los jugadores usan materiales para crear objetos y mejoras.
*   **La Purga**: Mecánica de Battle Royale/Supervivencia integrada en la liga.
*   **El Vestuario**: Chat de proximidad (Trash Talk) limitado a 140 caracteres con auto-borrado.

### 4. 🎁 Progresión y Gamificación
*   **Battle Pass**: Sistema de niveles con XP por actividad, desbloqueando títulos y cosméticos.
*   **Daily Roulette**: Ruleta de premios diaria para fomentar el login recurrente.
*   **Salón de la Fama**: 15 récords absolutos con generación dinámica de medallas y "Cromos" de jugador exportables.
*   **Pick'em**: Sistema de predicciones semanales con recompensas en WG Coins.

### 5. 🔬 Centro de Datos Avanzado
Suite de herramientas de análisis:
*   **Team Scouting**: Comparativa H2H de macro-estadísticas entre equipos.
*   **Synergy Dashboard**: Análisis de parejas de campeones y winrates combinados.
*   **Match Inspector**: Desglose técnico de cada partida registrada.
*   **Behavior Dashboard**: Análisis del estilo de juego y "momentum" de los jugadores.

---

## 🛠️ Stack Tecnológico

*   **Backend**: Google Apps Script (JavaScript V8) + Gemini AI (Match Analysis).
*   **Base de Datos**: Google Sheets (Relacional con +15 hojas activas).
*   **Frontend**: HTML5, Vanilla JS, CSS3 (Custom Design) + Tailwind CSS (Components).
*   **Librerías**: 
    *   `Chart.js`: Visualización de datos y radares.
    *   `html2canvas`: Generación de promociones y cromos.
    *   `Twitch API`: Integración de directos y programación de streams.

---

## 📂 Estructura del Proyecto

```bash
├── index.html           # Command Center (Main Entry)
├── LeagueMenu.html      # Dashboard Principal (Liga, Stats, Social)
├── Fantasy.html         # Sistema de Managers Independiente
├── Code.js              # El "Cerebro" (Riot API, Scoring, Economía)
├── Centro_de_Datos/     # Suite de Analíticas
│   ├── GlobalDashboard.html
│   ├── BehaviorDashboard.html
│   ├── SynergyDashboard.html
│   └── Match_Inspector.html
└── ...                  # Diálogos y Modales (Roulette, Profile, etc.)
```

---

## ✒️ Créditos

Desarrollado para la **Wargods Premier League**.  
*Versión Actual: 16.6 (Master Edition) - "The Omnipotence Update"*
*(Última actualización: 20 de Julio)*

### 🆕 Novedades Recientes (v16.6):
- **Análisis de Objetivos**: Integración de extracción de objetivos individuales por jugador (Dragones, Barones, Heraldos, Torres, Inhibidores) mediante el `RoflParser`.
- **Mejoras en LeagueMenu**: Inclusión de baneos de campeones en el resumen post-partida, rediseño de cromos de jugador añadiendo División y Equipo, y soporte global en el Pick'em para encuentros multiligas.
- **Perfil de Jugador Mejorado**: Nuevo diseño responsivo para la Pool de Campeones incluyendo total de partidas y porcentaje de victorias. Además se ha desglosado el detalle de KDA (Asesinatos/Muertes/Asistencias).
- **Core (Code.js)**: Optimización del manejo asíncrono para la generación de imágenes y adaptaciones en los endpoints de recolección de estadísticas.
