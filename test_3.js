
      let tournamentDataCache = null;
      let globalStatsData = [];
      let currentUserRole = "player";
      let radarChartInstance = null;
      let h2hRadarInstance = null;
      let h2hBarInstance = null;
      let teamRadarInstance = null;
      let teamObjChartInstance = null;
      let postGameObjChartInstance = null;
      let newsTimer = null;
      let powerChart = null;

      window.playoffsActive = false;
      window.currentScoutPlayer = null;

      const ROLE_CANON = {
        TOP: "TOP",
        JNG: "JNG",
        JUNGLE: "JNG",
        JGL: "JNG",
        MID: "MID",
        MIDDLE: "MID",
        ADC: "ADC",
        BOTTOM: "ADC",
        BOT: "ADC",
        SUPP: "SUPP",
        SUPPORT: "SUPP",
        UTILITY: "SUPP",
      };
      const ROLE_ICONS = {
        TOP: "🛡️",
        JNG: "🌲",
        MID: "🔥",
        ADC: "🏹",
        SUPP: "💖",
      };
      const ROLE_COLORS = {
        TOP: "#10b981",
        JNG: "#ef4444",
        MID: "#8b5cf6",
        ADC: "#f59e0b",
        SUPP: "#3b82f6",
      };
      const QUINTETO_ROLES = ["TOP", "JNG", "MID", "ADC", "SUPP"];

    