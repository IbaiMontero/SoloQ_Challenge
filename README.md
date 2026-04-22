# 🏆 Wargods Premier League - Tournament Engine

**Wargods Premier** es un ecosistema integral de gestión para ligas competitivas de League of Legends. A diferencia de las hojas de cálculo tradicionales, este sistema combina una base de datos dinámica en **Google Sheets** con un frontend de alto rendimiento inspirado en los mejores paneles de eSports (LVP, LEC).

-----

## 🚀 Funcionalidades Principales

### 📊 Dashboard e Inteligencia de Datos

  * **Riot API Integration:** Escaneo automático de partidas a través de Match IDs de Riot Games. Captura estadísticas avanzadas como DPM, GPM, daño mitigado (tank), puntos de visión y monstruos épicos.
  * **Power Ranking Dinámico:** Algoritmo propio que calcula la fuerza de los equipos basándose en la calidad de sus victorias, derrotas y rachas actuales.
  * **Hall of Fame:** 15 récords absolutos (El Verdugo, El Coloso, El Arquitecto...) con generación dinámica de medallas.

### 🎮 Sistema Fantasy & Gacha

  * **Mercado en Tiempo Real:** Fichajes, ventas y sistema de subastas ocultas que cierran a medianoche.
  * **Gestión de Plantillas:** Sistema de alineación (Titulares + Suplentes) con penalizaciones por huecos vacíos y bonos por sinergia de equipo.
  * **Cromos de Jugador (OVR):** Cálculo dinámico del "Overall" del jugador basado en su rendimiento estadístico global.
  * **Sistema Gacha:** Apertura de sobres para obtener cartas de mejora, sabotaje o misiones especiales.

### 🤝 El Vestuario (Sistema de Negociación)

  * **Acuerdo de Horarios:** Sistema "Double-Check" donde un capitán propone una fecha y el rival debe aceptarla o proponer otra.
  * **Seguridad por PIN:** Cada equipo posee un PIN de 4 dígitos para validar las acciones de los capitanes sin necesidad de logins complejos.
  * **Bloqueo de Casino:** La fecha pactada bloquea automáticamente las apuestas en el Casino en el momento del inicio del partido.

### 🎰 Casino Virtual

  * **Cuotas Dinámicas:** Las cuotas (Odds) se calculan automáticamente cruzando el Power Ranking de los equipos con el volumen de dinero apostado por la comunidad.
  * **Live Scoring:** Los puntos y balances se actualizan al instante tras el cierre oficial de cada acta.

-----

## 🛠️ Stack Tecnológico

  * **Backend:** Google Apps Script (JavaScript V8).
  * **Base de Datos:** Google Sheets (Relacional mediante IDs).
  * **Frontend:** HTML5, CSS3 (Tailwind CSS), JS (Nativo + Chart.js).
  * **Herramientas:** \* `html2canvas` para la exportación de promociones H2H y Cromos.
      * `Twitch API Embed` para la retransmisión automática en la web.
      * `clasp` / `Antigravity IDE` para el desarrollo y despliegue.

-----

## 📦 Estructura del Proyecto

```bash
├── Código.gs           # Lógica del servidor (CRUD, Riot API, Cálculos de Puntos)
├── LeagueMenu.html      # Frontend principal (Dashboard, Calendario, Casino, Stats)
├── Fantasy.html         # Módulo independiente del sistema de mánagers
├── Styles.html          # (Opcional) CSS Global personalizado
└── appsscript.json      # Manifiesto de configuración de permisos de Google
```

-----

## ⚙️ Configuración e Instalación

1.  **Spreadsheet:** Crear un Google Sheets con las pestañas: `TOURNAMENT_INFO`, `TOURNAMENT_TEAMS`, `TOURNAMENT_MATCHES`, `MATCHES`, `TOURNAMENT_MVP_VOTES` y `Liga_Bets`.
2.  **Scripts:** Copiar el contenido de `Código.gs` en el editor de Apps Script.
3.  **Frontend:** Crear archivos HTML con los nombres `LeagueMenu.html` y `Fantasy.html` y pegar el código correspondiente.
4.  **API:** Configurar tu `RIOT_API_KEY` en las Propiedades del Proyecto en Google Apps Script.
5.  **Despliegue:** Implementar como "Aplicación Web" con acceso "Cualquier persona".

-----

## 📸 Screenshots

  * **Dashboard:** Interfaz oscura con tickers de resultados en vivo.
  * **Radar Stats:** Comparativas H2H entre jugadores con gráficos de araña.
  * **TV Mode:** Integración automática del canal de Twitch al comenzar el directo.

-----

## ✒️ Créditos

Desarrollado para la **Wargods Premier League**.

-----

*Este proyecto está en constante desarrollo. Versión actual: 16.5 (Master Edition).*
