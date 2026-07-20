
      function resetMatchFilters() {
        if (document.getElementById("filter-match-jornada"))
          document.getElementById("filter-match-jornada").value = "ALL";
        if (document.getElementById("filter-match-date"))
          document.getElementById("filter-match-date").value = "";
        renderDashboard(tournamentDataCache);
      }

      function updateGlobalStreamTimer(targetDate) {
        if (newsTimer) clearInterval(newsTimer);
        const streamDate = targetDate;

        const streamInfoEl = document.getElementById("stream-info");
        if (streamInfoEl)
          streamInfoEl.innerText =
            "PRÓXIMO MATCH: " + streamDate.toLocaleString();

        newsTimer = setInterval(function () {
          const now = new Date().getTime();
          const dist = streamDate.getTime() - now;
          const timerDisplay = document.getElementById("timer-display");
          const timerCompact = document.getElementById("timer-compact");
          const topCountdown = document.getElementById("top-countdown");

          if (dist < 0) {
            if (dist < -21600000) {
              if (streamInfoEl) streamInfoEl.innerText = "A FILAR LAS HACHAS";
              if (timerDisplay) timerDisplay.innerText = "RECARGANDO PILAS 🔋";
              if (topCountdown) topCountdown.classList.add("hidden");
              return;
            }
            if (timerDisplay) timerDisplay.innerText = "🔴 EN DIRECTO";
            if (timerCompact) timerCompact.innerText = "🔴 EN DIRECTO";
            if (topCountdown) topCountdown.classList.remove("hidden");
            return;
          }
          const d = Math.floor(dist / 86400000);
          const h = Math.floor((dist % 86400000) / 3600000);
          const m = Math.floor((dist % 3600000) / 60000);
          const s = Math.floor((dist % 60000) / 1000);
          const txt = d + "d " + h + "h " + m + "m " + s + "s";
          if (timerDisplay) timerDisplay.innerText = txt;
          if (timerCompact) timerCompact.innerText = txt;
          if (topCountdown) topCountdown.classList.remove("hidden");
        }, 1000);
      }

      function populateTeamH2HDropdowns() {
        const selA = document.getElementById("team-h2h-select-a");
        const selB = document.getElementById("team-h2h-select-b");
        let opts = '<option value="">Selecciona un equipo...</option>';

        if (tournamentDataCache && tournamentDataCache.teams) {
          let sortedTeams = [...tournamentDataCache.teams].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          sortedTeams.forEach((t) => {
            opts +=
              '<option value="' +
              enc(t.name) +
              '">' +
              escHtml(t.name) +
              "</option>";
          });
        }

        if (selA) selA.innerHTML = opts;
        if (selB) selB.innerHTML = opts;
      }

      function updateTeamH2H() {
        const valA = document.getElementById("team-h2h-select-a").value;
        const valB = document.getElementById("team-h2h-select-b").value;
        const cA = document.getElementById("team-h2h-card-a");
        const cB = document.getElementById("team-h2h-card-b");
        const radarC = document.getElementById("team-h2h-chart-container");

        if (!valA || !valB) {
          cA.classList.add("hidden");
          cB.classList.add("hidden");
          radarC.classList.add("hidden");
          return;
        }

        const nameA = dec(valA);
        const nameB = dec(valB);
        const tA = tournamentDataCache.teams.find((x) => x.name === nameA);
        const tB = tournamentDataCache.teams.find((x) => x.name === nameB);
        if (!tA || !tB) return;

        cA.innerHTML =
          '<div class="text-center py-10 text-cyan-400 animate-pulse font-bold tracking-widest uppercase">📡 EXTRAYENDO ADN DE ' +
          escHtml(tA.name) +
          "...</div>";
        cB.innerHTML =
          '<div class="text-center py-10 text-red-400 animate-pulse font-bold tracking-widest uppercase">📡 EXTRAYENDO ADN DE ' +
          escHtml(tB.name) +
          "...</div>";
        cA.classList.remove("hidden");
        cB.classList.remove("hidden");
        radarC.classList.add("hidden");

        google.script.run
          .withSuccessHandler(function (resA) {
            google.script.run
              .withSuccessHandler(function (resB) {
                const pA_list = globalStatsData.filter((p) => p.team === nameA);
                const pB_list = globalStatsData.filter((p) => p.team === nameB);

                const roleColors = {
                  TOP: "#10b981",
                  JNG: "#ef4444",
                  MID: "#8b5cf6",
                  ADC: "#f59e0b",
                  SUPP: "#3b82f6",
                };
                const roles = ["TOP", "JNG", "MID", "ADC", "SUPP"];

                const calcTeamAdvanced = (teamInfo, players, backendData) => {
                  let totalGames = teamInfo.w + teamInfo.l;
                  let wr = totalGames > 0 ? (teamInfo.w / totalGames) * 100 : 0;

                  let dpmByRole = {
                    TOP: 0,
                    JUNGLE: 0,
                    MIDDLE: 0,
                    BOTTOM: 0,
                    SUPPORT: 0,
                  };
                  let totalDpm = 0;
                  let champCount = {};

                  let avgDur =
                    backendData && backendData.avgDuration
                      ? backendData.avgDuration
                      : "0.0";
                  let avgVis =
                    backendData && backendData.avgVision
                      ? backendData.avgVision
                      : "0.0";

                  let starPlayer = { name: "N/A", pts: -1, champ: "" };

                  players.forEach((p) => {
                    let r = p.role ? p.role.toUpperCase() : "FILL";
                    if (r === "UTILITY") r = "SUPPORT";

                    let d = parseFloat(p.dpm) || 0;
                    if (dpmByRole[r] !== undefined) {
                      dpmByRole[r] += d;
                      totalDpm += d;
                    }

                    let pPts = parseFloat(p.points) || 0;
                    if (pPts > starPlayer.pts) {
                      starPlayer = {
                        name: p.name,
                        pts: pPts,
                        champ: p.champs ? p.champs.split(",")[0].trim() : "",
                      };
                    }

                    if (p.champs) {
                      p.champs.split(",").forEach((c) => {
                        let clean = c.trim().split(" ")[0];
                        if (clean && clean !== "-")
                          champCount[clean] = (champCount[clean] || 0) + 1;
                      });
                    }
                  });

                  let comfort = Object.keys(champCount)
                    .sort((a, b) => champCount[b] - champCount[a])
                    .slice(0, 3);
                  let throwRate = Math.min(
                    100,
                    Math.max(0, 60 + (wr > 50 ? 15 : -15)),
                  );
                  let comebackRate = Math.min(
                    100,
                    Math.max(0, 30 + (wr > 50 ? 10 : -10)),
                  );

                  return {
                    wr,
                    totalDpm,
                    dpmByRole,
                    comfort,
                    throwRate,
                    comebackRate,
                    starPlayer,
                    avgDur,
                    avgVis,
                  };
                };

                const statsA = calcTeamAdvanced(tA, pA_list, resA);
                const statsB = calcTeamAdvanced(tB, pB_list, resB);

                const generateCardHTML = (teamInfo, stats, logoUrl, isBlue) => {
                  let colorHex = isBlue ? "#38bdf8" : "#ef4444";

                  let dmgBarHtml = roles
                    .map((r) => {
                      let pct =
                        stats.totalDpm > 0
                          ? (stats.dpmByRole[r] / stats.totalDpm) * 100
                          : 20;
                      return (
                        '<div style="width: ' +
                        pct +
                        "%; background-color: " +
                        roleColors[r] +
                        '" title="' +
                        r +
                        '"></div>'
                      );
                    })
                    .join("");

                  let comfortHtml = stats.comfort
                    .map(
                      (c) =>
                        '<img src="' +
                        getChampIcon(c) +
                        '" class="w-8 h-8 rounded-full border border-emerald-500 bg-slate-900" title="' +
                        c +
                        '">',
                    )
                    .join("");

                  let html =
                    '<div class="flex items-center gap-4 mb-4 border-b border-slate-700 pb-4 text-left">';
                  html +=
                    '<img src="' +
                    getLogo(logoUrl) +
                    '" class="w-16 h-16 object-contain bg-black rounded-xl border-2 border-slate-700 p-1 shadow-lg">';
                  html +=
                    '<div><div class="font-oswald text-2xl text-white tracking-widest truncate w-full">' +
                    escHtml(teamInfo.name) +
                    "</div>";
                  html +=
                    '<div class="text-xs text-emerald-400 font-bold">' +
                    teamInfo.w +
                    "W - " +
                    teamInfo.l +
                    "L (" +
                    stats.wr.toFixed(0) +
                    "% WR)</div></div></div>";

                  html +=
                    '<div class="mb-5 text-left"><div class="text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex justify-between">';
                  html +=
                    '<span>Share de Daño</span><span style="color: ' +
                    colorHex +
                    '">' +
                    stats.totalDpm.toFixed(0) +
                    " DPM</span></div>";
                  html +=
                    '<div class="w-full h-3 bg-slate-800 rounded-full flex overflow-hidden shadow-inner">' +
                    dmgBarHtml +
                    "</div></div>";

                  html +=
                    '<div class="grid grid-cols-2 gap-3 mb-5 border-t border-slate-700 pt-4 text-left">';
                  html +=
                    '<div class="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700"><div class="text-[9px] text-yellow-500 font-bold uppercase tracking-widest mb-1">👑 Win Condition</div>';
                  html +=
                    '<div class="flex items-center gap-2"><img src="' +
                    getChampIcon(stats.starPlayer.champ) +
                    '" class="w-6 h-6 rounded-full border border-yellow-500 bg-slate-900" onerror="this.style.display=\'none\'">';
                  html +=
                    '<div class="text-[11px] font-bold text-white truncate">' +
                    escHtml(stats.starPlayer.name) +
                    "</div></div></div>";

                  html +=
                    '<div class="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700 text-center"><div class="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-1">⏱️ Ritmo Partida</div>';
                  html +=
                    '<div class="text-lg font-black text-white font-oswald">' +
                    stats.avgDur +
                    '<span class="text-[10px] ml-1 text-slate-500">MIN</span></div></div>';

                  html +=
                    '<div class="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700 col-span-2 text-center"><div class="text-[9px] text-emerald-400 font-bold uppercase tracking-widest mb-1">🔦 Visión y Pinks Global</div>';
                  html +=
                    '<div class="text-base font-bold text-white font-mono">' +
                    stats.avgVis +
                    ' <span class="text-[8px] text-slate-500">PUNTOS / PARTIDA</span></div></div></div>';

                  html +=
                    '<div class="grid grid-cols-2 gap-4 mb-5 border-t border-slate-700 pt-4 text-left"><div><div class="text-[9px] text-emerald-400 uppercase font-bold tracking-widest mb-2">✅ Zona de Confort</div>';
                  html +=
                    '<div class="flex gap-2">' +
                    (comfortHtml ||
                      '<span class="text-xs text-slate-500">Sin datos</span>') +
                    "</div></div>";
                  html +=
                    '<div><div class="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-2">🎯 Capacidad Cierre</div>';
                  html +=
                    '<div class="text-xl font-black text-emerald-400 font-oswald">' +
                    stats.throwRate.toFixed(0) +
                    "%</div></div></div>";

                  return html;
                };

                cA.innerHTML = generateCardHTML(tA, statsA, tA.logo, true);
                cB.innerHTML = generateCardHTML(tB, statsB, tB.logo, false);

                radarC.classList.remove("hidden");

                // DIBUJAR RADAR DE EQUIPOS
                const ctx = document
                  .getElementById("teamH2HCompareRadar")
                  .getContext("2d");
                if (window.teamRadarInstance)
                  window.teamRadarInstance.destroy();

                const getNorm = (s) => [
                  Math.min(10, (s.totalDpm / 3500) * 10),
                  Math.min(10, (parseFloat(s.avgVis) / 100) * 10),
                  Math.min(10, s.throwRate / 10),
                  Math.min(10, s.comebackRate / 10),
                  Math.min(10, s.wr / 10),
                ];

                window.teamRadarInstance = new Chart(ctx, {
                  type: "radar",
                  data: {
                    labels: [
                      "Daño",
                      "Visión + Pinks",
                      "Cierre",
                      "Resiliencia",
                      "Eficacia",
                    ],
                    datasets: [
                      {
                        label: tA.name,
                        data: getNorm(statsA),
                        backgroundColor: "rgba(56, 189, 248, 0.3)",
                        borderColor: "rgba(56, 189, 248, 1)",
                        pointBackgroundColor: "#38bdf8",
                        borderWidth: 2,
                      },
                      {
                        label: tB.name,
                        data: getNorm(statsB),
                        backgroundColor: "rgba(239, 68, 68, 0.3)",
                        borderColor: "rgba(239, 68, 68, 1)",
                        pointBackgroundColor: "#ef4444",
                        borderWidth: 2,
                      },
                    ],
                  },
                  options: {
                    maintainAspectRatio: false,
                    scales: {
                      r: {
                        angleLines: { color: "rgba(255, 255, 255, 0.1)" },
                        grid: { color: "rgba(255, 255, 255, 0.1)" },
                        pointLabels: {
                          color: "#94a3b8",
                          font: { family: "Oswald", size: 14 },
                        },
                        ticks: { display: false, max: 10, min: 0 },
                      },
                    },
                    plugins: {
                      legend: {
                        display: true,
                        labels: {
                          color: "white",
                          font: { family: "Oswald", size: 14 },
                        },
                      },
                    },
                  },
                });

                // ==========================================
                // DIBUJAR GRÁFICO DE BARRAS DE OBJETIVOS APILADAS
                // ==========================================
                const ctxObj = document
                  .getElementById("teamH2HObjectivesChart")
                  .getContext("2d");
                if (window.teamObjChartInstance)
                  window.teamObjChartInstance.destroy();

                const getRoleAggDmg = (list, role, key) => {
                  let p = list.find((x) => {
                    let r = x.role ? x.role.toUpperCase() : "FILL";
                    if (r === "UTILITY" || r === "SUPPORT") r = "SUP";
                    if (r === "JUNGLE") r = "JGL";
                    if (r === "MIDDLE" || r === "MID") r = "MID";
                    if (r === "BOTTOM" || r === "ADC") r = "ADC";
                    return r === role;
                  });
                  return p ? parseFloat(p[key]) || 0 : 0;
                };

                let datasetsH2H = ["TOP", "JGL", "MID", "ADC", "SUP"].map(
                  (role) => {
                    const rc = {
                      TOP: "#10b981",
                      JGL: "#ef4444",
                      MID: "#8b5cf6",
                      ADC: "#f59e0b",
                      SUP: "#3b82f6",
                    };
                    return {
                      label: role,
                      data: [
                        getRoleAggDmg(pA_list, role, "dmgObj"),
                        getRoleAggDmg(pB_list, role, "dmgObj"),
                        getRoleAggDmg(pA_list, role, "dmgTurrets"),
                        getRoleAggDmg(pB_list, role, "dmgTurrets"),
                      ],
                      backgroundColor: rc[role],
                      borderColor: "#0f172a",
                      borderWidth: 2,
                      borderRadius: 4,
                    };
                  },
                );

                window.teamObjChartInstance = new Chart(ctxObj, {
                  type: "bar",
                  data: {
                    labels: [
                      (tA.name) + ' (Obj)',
                      (tB.name) + ' (Obj)',
                      (tA.name) + ' (Torres)',
                      (tB.name) + ' (Torres)',
                    ],
                    datasets: datasetsH2H,
                  },
                  options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        stacked: true,
                        ticks: {
                          color: "#94a3b8",
                          callback: (val) =>
                            val >= 1000 ? (val / 1000).toFixed(1) + "k" : val,
                        },
                        grid: { color: "rgba(51, 65, 85, 0.2)" },
                      },
                      y: {
                        stacked: true,
                        ticks: {
                          color: "#94a3b8",
                          font: { family: "Oswald", size: 12 },
                        },
                        grid: { display: false },
                      },
                    },
                    plugins: {
                      legend: {
                        labels: {
                          color: "#94a3b8",
                          font: { family: "Oswald", size: 12 },
                        },
                      },
                      tooltip: {
                        mode: "nearest",
                        callbacks: {
                          label: function (context) {
                            let val = context.raw || 0;
                            if (val === 0) return null;
                            let totalTeam = 0;
                            context.chart.data.datasets.forEach((ds) => {
                              totalTeam += ds.data[context.dataIndex] || 0;
                            });
                            let pct =
                              totalTeam > 0
                                ? Math.round((val / totalTeam) * 100)
                                : 0;
                            return (context.dataset.label) + ': ' + ((val / 1000).toFixed(1)) + 'k (' + (pct) + '%)';
                          },
                        },
                      },
                    },
                  },
                });

                // === STATS BARS COMPARISON ===
                var statsBarEl2 = document.getElementById("team-h2h-stats-bars");
                if (statsBarEl2) {
                  var _pB2 = function(vA, vB) { var tot = (vA||0)+(vB||0); if(tot===0) return [50,50]; var p2=Math.round((vA/tot)*100); return [p2,100-p2]; };
                  var _aF2 = function(list, field) { return list.length ? list.reduce(function(s,p){ return s+(parseFloat(p[field])||0); },0)/list.length : 0; };
                  var si2 = [
                    { label:"KDA", vA:_aF2(pA_list,"kdaNum"), vB:_aF2(pB_list,"kdaNum"), fmt:function(v){ return v.toFixed(2); } },
                    { label:"DPM", vA:statsA.totalDpm, vB:statsB.totalDpm, fmt:function(v){ return Math.round(v); } },
                    { label:"GPM", vA:_aF2(pA_list,"gpm"), vB:_aF2(pB_list,"gpm"), fmt:function(v){ return Math.round(v); } },
                    { label:"CS/M", vA:_aF2(pA_list,"cs"), vB:_aF2(pB_list,"cs"), fmt:function(v){ return v.toFixed(1); } },
                    { label:"VSPM", vA:parseFloat(statsA.avgVis)||0, vB:parseFloat(statsB.avgVis)||0, fmt:function(v){ return v.toFixed(1); } },
                    { label:"WR%", vA:statsA.wr, vB:statsB.wr, fmt:function(v){ return v.toFixed(0)+"%"; } },
                    { label:"ObjDmg", vA:_aF2(pA_list,"dmgObj"), vB:_aF2(pB_list,"dmgObj"), fmt:function(v){ return v>=1000?(v/1000).toFixed(1)+"k":Math.round(v); } },
                    { label:"TorreDmg", vA:_aF2(pA_list,"dmgTurrets"), vB:_aF2(pB_list,"dmgTurrets"), fmt:function(v){ return v>=1000?(v/1000).toFixed(1)+"k":Math.round(v); } },
                    { label:"Pinks", vA:_aF2(pA_list,"pinks"), vB:_aF2(pB_list,"pinks"), fmt:function(v){ return v.toFixed(1); } }
                  ];
                  var bH2 = '<div class="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-3 text-center">\uD83D\uDCCA Comparativa Estad\u00edstica Completa</div><div class="space-y-1.5">';
                  si2.forEach(function(s) {
                    var ps2 = _pB2(s.vA, s.vB);
                    var wA2 = s.vA >= s.vB;
                    bH2 += '<div class="flex items-center gap-1.5 text-[9px]">' +
                      '<span class="w-12 text-right font-mono font-bold ' + (wA2?"text-blue-300":"text-slate-500") + '">' + s.fmt(s.vA||0) + '</span>' +
                      '<div class="flex-1 flex items-center h-4">' +
                        '<div class="flex-1 flex justify-end h-full overflow-hidden rounded-l"><div style="width:' + ps2[0] + '%;background:' + (wA2?"#3b82f6":"#1e3a5f") + ';height:100%;transition:width 1s"></div></div>' +
                        '<div class="w-14 text-center text-[8px] font-black text-slate-500 flex-shrink-0">' + s.label + '</div>' +
                        '<div class="flex-1 h-full overflow-hidden rounded-r"><div style="width:' + ps2[1] + '%;background:' + (!wA2?"#ef4444":"#3b1f25") + ';height:100%;transition:width 1s"></div></div>' +
                      '</div>' +
                      '<span class="w-12 font-mono font-bold ' + (!wA2?"text-red-300":"text-slate-500") + '">' + s.fmt(s.vB||0) + '</span>' +
                    '</div>';
                  });
                  bH2 += '</div><div class="flex justify-between text-[9px] font-bold mt-2 pt-2 border-t border-slate-700/50"><span class="text-blue-400">' + escHtml(tA.name) + '</span><span class="text-red-400">' + escHtml(tB.name) + '</span></div>';
                  statsBarEl2.innerHTML = bH2;
                }
              })
              .getTeamAdvancedStats(tB.roster);
          })
          .getTeamAdvancedStats(tA.roster);
      }

      function openTeamHub(nameEnc, wins, losses, points, rosterEnc, logoEnc) {
        const teamName = dec(nameEnc);
        const roster = dec(rosterEnc);
        const logoUrl = dec(logoEnc);

        document.getElementById("tm-name").innerText = teamName;
        document.getElementById("tm-record").innerText =
          wins + " Victorias - " + losses + " Derrotas";

        let safeLogo = getLogo(logoUrl);
        let logoHtml =
          '<div class="bg-white w-40 h-40 flex items-center justify-center p-2 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] border-4 border-slate-700 mb-2 hover:scale-105 transition duration-300 mx-auto">';
        logoHtml +=
          '<img src="' +
          safeLogo +
          '" class="w-full h-full object-contain rounded-xl" onerror="this.src=\'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/logos/tier2-1.png\'">';
        logoHtml += "</div>";

        document.getElementById("tm-logo-container").innerHTML = logoHtml;

        let rosterHtml =
          '<p class="text-slate-500 text-sm italic">Agentes Libres</p>';
        if (roster && roster !== "undefined" && roster.trim() !== "") {
          let cleanRoster = roster
            .split(",")
            .map((p) => {
              let name = p.trim();
              if (!name.includes("#")) name += "#EUW";
              return name;
            })
            .join(",");
          let opggLink =
            "https://www.op.gg/multisearch/euw?summoners=" +
            encodeURIComponent(cleanRoster);
          rosterHtml = roster
            .split(",")
            .map(
              (p) =>
                '<div class="bg-slate-800 border border-slate-600 rounded px-4 py-2 text-emerald-300 font-bold shadow-inner text-center uppercase tracking-widest w-full max-w-[200px]">' +
                escHtml(p.trim()) +
                "</div>",
            )
            .join("");
          rosterHtml += '<a href="' + (opggLink) +
            '" target="_blank" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded mt-4 text-center block w-full max-w-[200px] uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> OP.GG MULTI</a>';
        }
        document.getElementById("tm-roster").innerHTML = rosterHtml;

        // 🟢 NUEVO: LÓGICA PARA BUSCAR Y PINTAR EL HISTORIAL DE PARTIDOS
        let matchesHtml =
          '<div class="text-slate-500 text-sm italic py-2 text-center border-2 border-dashed border-slate-700 rounded-lg">No hay partidos jugados todavía.</div>';

        if (
          tournamentDataCache &&
          tournamentDataCache.teams &&
          tournamentDataCache.matches
        ) {
          let teamObj = tournamentDataCache.teams.find(
            (t) => t.name === teamName,
          );
          if (teamObj) {
            // Filtramos partidos COMPLETAOS donde juegue el equipo (tA o tB) y cogemos los 5 últimos
            let teamMatches = tournamentDataCache.matches
              .filter(
                (m) =>
                  m.status === "COMPLETED" &&
                  (m.tA == teamObj.id || m.tB == teamObj.id),
              )
              .slice(-5)
              .reverse();

            if (teamMatches.length > 0) {
              matchesHtml = teamMatches
                .map((m) => {
                  let isTeamA = m.tA == teamObj.id;
                  let myScore = isTeamA ? parseInt(m.sA) : parseInt(m.sB);
                  let enemyScore = isTeamA ? parseInt(m.sB) : parseInt(m.sA);
                  let isWin = myScore > enemyScore;

                  let resColor = isWin ? "text-emerald-400" : "text-red-400";
                  let resText = isWin ? "VICTORIA" : "DERROTA";

                  let names = m.names.split(" vs ");
                  let enemyName = isTeamA ? names[1] : names[0];
                  let safeRiotId = m.riotId || m.id;

                  // Si pinchas, te abre el acta del post-game (openPostGame)
                  return ' <div class="bg-slate-800/80 border border-slate-700 p-3 rounded-lg flex justify-between items-center cursor-pointer hover:bg-slate-700 transition hover:border-purple-500 shadow" onclick="openPostGame(\'' +
                    (m.id) + '\', \'' + (safeRiotId) + '\')"> <div class="w-16 text-[10px] font-black ' + (resColor) +
                    ' tracking-widest uppercase">' + (resText) +
                    '</div> <div class="flex-1 text-center font-bold text-white text-sm truncate px-2">vs ' +
                    (escHtml(enemyName.trim())) +
                    '</div> <div class="w-16 text-center font-mono font-black text-white bg-black px-2 py-1 rounded shadow-inner text-xs border border-slate-600">' +
                    (m.sA) + ' - ' + (m.sB) + '</div> </div> ';
                })
                .join("");
            }
          }
        }
        document.getElementById("tm-recent-matches").innerHTML = matchesHtml;
        // -----------------------------------------------------

        document.getElementById("tm-stats-container").innerHTML =
          '<div class="col-span-2 md:col-span-4 text-yellow-500 font-bold tracking-widest text-sm py-4 animate-pulse">📡 Extrayendo ADN del equipo...</div>';
        document.getElementById("team-modal").style.display = "flex";

        const totalGames = Number(wins) + Number(losses);
        const wr =
          totalGames > 0
            ? Math.round((Number(wins) / totalGames) * 100) + "%"
            : "0%";

        google.script.run
          .withSuccessHandler(function (res) {
            if (!res || res.error || res.realGames === 0) {
              document.getElementById("tm-stats-container").innerHTML =
                '<div class="col-span-2 md:col-span-4 text-slate-500 text-sm italic py-4">Este equipo aún no ha debutado.</div>';
            } else {
              let h = "";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Winrate</div><div class="text-2xl font-bold text-emerald-400">' +
                wr +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Duración Media</div><div class="text-2xl font-bold text-blue-400">' +
                res.avgDuration +
                " min</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Kills / Partida</div><div class="text-2xl font-bold text-white">' +
                res.avgKills +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Muertes / Partida</div><div class="text-2xl font-bold text-red-400">' +
                res.avgDeaths +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Asistencias / Partida</div><div class="text-2xl font-bold text-orange-400">' +
                res.avgAssists +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">DPM Total Equipo</div><div class="text-2xl font-bold text-white">' +
                res.avgDpm +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">GPM Total Equipo</div><div class="text-2xl font-bold text-yellow-500">' +
                res.avgGpm +
                "</div></div>";
              h +=
                '<div class="bg-slate-900 border border-slate-700 p-3 rounded-2xl"><div class="text-[10px] text-slate-400 uppercase tracking-widest">Visión y Pinks / P.</div><div class="text-2xl font-bold text-purple-400">' +
                res.avgVision +
                "</div></div>";

              document.getElementById("tm-stats-container").innerHTML = h;
            }
          })
          .getTeamAdvancedStats(roster);
      }

      function populateH2HDropdowns() {
        const selA = document.getElementById("h2h-select-a");
        const selB = document.getElementById("h2h-select-b");
        let opts = '<option value="">Selecciona un jugador...</option>';

        let sortedData = [...globalStatsData].sort((a, b) => {
          if (a.team === b.team) return a.name.localeCompare(b.name);
          return (a.team || "").localeCompare(b.team || "");
        });

        sortedData.forEach((p) => {
          opts += '<option value="' + (enc(p.name)) + '">' + (escHtml(p.name)) + ' (' + (p.team) + ')</option>';
        });

        selA.innerHTML = opts;
        selB.innerHTML = opts;
      }

      // ==========================================
      // 🤝 SISTEMA DE VESTUARIO (NEGOCIACIÓN)
      // ==========================================
      let currentNegMatch = null;
      let currentNegTeamA = null;
      let currentNegTeamB = null;

      const LEAGUE_TZ = "Europe/Madrid";

      const formatNiceDate = (rawStr) => {
        const s = String(rawStr).trim();
        const wallClock = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
        if (wallClock) {
          return `${wallClock[3]}/${wallClock[2]} a las ${wallClock[4]}:${wallClock[5]}`;
        }
        let dObj = new Date(s);
        if (isNaN(dObj.getTime()) && s.includes(" "))
          dObj = new Date(s.replace(" ", "T"));
        if (!isNaN(dObj.getTime())) {
          return (
            dObj.toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              timeZone: LEAGUE_TZ,
            }) +
            " a las " +
            dObj.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: LEAGUE_TZ,
            })
          );
        }
        return rawStr;
      };

      const toNegDateInputValue = (rawStr) => {
        const s = String(rawStr).trim();
        const wallClock = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
        if (wallClock) {
          return `${wallClock[1]}-${wallClock[2]}-${wallClock[3]}T${wallClock[4]}:${wallClock[5]}`;
        }
        const dObj = new Date(s.includes(" ") ? s.replace(" ", "T") : s);
        if (isNaN(dObj.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: LEAGUE_TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(dObj);
        const get = (type) => parts.find((p) => p.type === type)?.value || "00";
        return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
      };

      function openNegotiationModal(matchId) {
        currentNegMatch = tournamentDataCache.matches.find(
          (m) => m.id === matchId,
        );
        if (!currentNegMatch) return;

        currentNegTeamA = tournamentDataCache.teams.find(
          (t) => t.id === currentNegMatch.tA,
        );
        currentNegTeamB = tournamentDataCache.teams.find(
          (t) => t.id === currentNegMatch.tB,
        );

        document.getElementById("neg-match-id").value = matchId;

        const btnA = document.getElementById("btn-neg-teamA");
        const btnB = document.getElementById("btn-neg-teamB");
        btnA.innerText = currentNegTeamA.name;
        btnB.innerText = currentNegTeamB.name;
        btnA.className =
          "flex-1 bg-slate-800 border border-slate-600 py-3 rounded-lg font-oswald text-white hover:bg-slate-700 transition truncate px-2 opacity-100";
        btnB.className =
          "flex-1 bg-slate-800 border border-slate-600 py-3 rounded-lg font-oswald text-white hover:bg-slate-700 transition truncate px-2 opacity-100";

        document.getElementById("neg-selected-team-id").value = "";
        document.getElementById("neg-pin").value = "";

        document.getElementById("neg-step-1").classList.remove("hidden");
        document.getElementById("neg-pin-container").classList.add("hidden");
        document.getElementById("neg-step-2").classList.add("hidden");

        document.getElementById("negotiation-modal").style.display = "flex";
      }

      function selectNegTeam(team) {
        document.getElementById("neg-selected-team-id").value =
          team === "A" ? currentNegTeamA.id : currentNegTeamB.id;

        if (team === "A") {
          document
            .getElementById("btn-neg-teamA")
            .classList.add("border-accent-blue", "bg-slate-700");
          document
            .getElementById("btn-neg-teamB")
            .classList.remove("border-accent-blue", "bg-slate-700");
          document.getElementById("btn-neg-teamB").classList.add("opacity-50");
          document
            .getElementById("btn-neg-teamA")
            .classList.remove("opacity-50");
        } else {
          document
            .getElementById("btn-neg-teamB")
            .classList.add("border-accent-blue", "bg-slate-700");
          document
            .getElementById("btn-neg-teamA")
            .classList.remove("border-accent-blue", "bg-slate-700");
          document.getElementById("btn-neg-teamA").classList.add("opacity-50");
          document
            .getElementById("btn-neg-teamB")
            .classList.remove("opacity-50");
        }
        document.getElementById("neg-pin-container").classList.remove("hidden");
      }

      function loadNegotiationState() {
        let pin = document.getElementById("neg-pin").value.trim();
        if (currentUserRole !== "admin" && !pin)
          return alert("Introduce el PIN de capitán.");

        let teamId = document.getElementById("neg-selected-team-id").value;
        let m = currentNegMatch;

        document.getElementById("neg-step-1").classList.add("hidden");
        document.getElementById("neg-step-2").classList.remove("hidden");

        let statusBox = document.getElementById("neg-status-box");
        let actionPropose = document.getElementById("neg-action-propose");
        let actionRespond = document.getElementById("neg-action-respond");

        actionPropose.classList.add("hidden");
        actionRespond.classList.add("hidden");

        if (m.date && String(m.date).trim() !== "") {
          statusBox.innerHTML = '<div class="text-emerald-400 font-bold text-lg mb-1">🏁 FECHA CERRADA</div><div class="text-sm text-white">' +
            (formatNiceDate(m.date)) +
            '</div><div class="text-[10px] text-slate-400 mt-2">El horario ya es oficial.</div>';
          actionPropose.classList.remove("hidden");
          document.getElementById("btn-neg-submit-propose").innerText =
            "REPROGRAMAR FECHA (NUEVA PROPUESTA)";

          document.getElementById("neg-date-input").value = toNegDateInputValue(m.date);
        } else if (m.proposedDate && String(m.proposedDate).trim() !== "") {
          if (m.proposedBy === teamId) {
            statusBox.innerHTML = '<div class="text-yellow-400 font-bold text-lg mb-1">⏳ ESPERANDO RIVAL</div><div class="text-sm text-white">Has propuesto: ' +
              (formatNiceDate(m.proposedDate)) + '</div>';
            actionPropose.classList.remove("hidden");
            document.getElementById("btn-neg-submit-propose").innerText =
              "ACTUALIZAR / EDITAR FECHA";
          } else {
            statusBox.innerHTML = '<div class="text-accent-blue font-bold text-lg mb-1">📬 PROPUESTA RECIBIDA</div><div class="text-sm text-white">El rival propone: ' +
              (formatNiceDate(m.proposedDate)) + '</div>';
            actionRespond.classList.remove("hidden");
            actionPropose.classList.remove("hidden");
            document.getElementById("btn-neg-submit-propose").innerText =
              "CONTRAPROPUESTA / EDITAR";
          }

          document.getElementById("neg-date-input").value = toNegDateInputValue(m.proposedDate);
        } else {
          statusBox.innerHTML = '<div class="text-slate-500 italic">No hay propuestas activas.</div>';
          actionPropose.classList.remove("hidden");
          document.getElementById("btn-neg-submit-propose").innerText =
            "ENVIAR PROPUESTA";
        }
      }

      function setNegQuickTime(timeStr) {
        let input = document.getElementById("neg-date-input");
        if (!input.value) {
          let now = new Date();
          let day = ("0" + now.getDate()).slice(-2);
          let month = ("0" + (now.getMonth() + 1)).slice(-2);
          input.value = (now.getFullYear()) + '-' + (month) + '-' + (day) + 'T' + (timeStr);
        } else {
          let currentVal = input.value;
          input.value = currentVal.split("T")[0] + "T" + timeStr;
        }
      }

      function submitNegotiation(action, evt) {
        let matchId = document.getElementById("neg-match-id").value;
        let teamId = document.getElementById("neg-selected-team-id").value;
        let pin = document.getElementById("neg-pin").value.trim();
        let dateStr = "";
        let notesStr = "";

        if (action === "PROPOSE") {
          dateStr = document.getElementById("neg-date-input").value;
          notesStr = document.getElementById("neg-notes-input").value.trim();
          if (!dateStr) return alert("Selecciona una fecha y hora.");
        }

        if (!confirm('¿Estás seguro de confirmar esta acción?')) return;

        let originalText = evt.target.innerText;
        evt.target.innerText = "⏳...";
        evt.target.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            if (res.success) {
              closeModal("negotiation-modal");
              refreshData();
            } else {
              evt.target.innerText = originalText;
              evt.target.disabled = false;
            }
          })
          .withFailureHandler(function (err) {
            // 🛡️ NUEVO: Atrapador de errores para que no se quede colgado
            alert("❌ Error de comunicación con el Servidor: " + err.message);
            evt.target.innerText = originalText;
            evt.target.disabled = false;
          })
          .handleMatchNegotiation(
            action,
            matchId,
            teamId,
            pin,
            dateStr,
            notesStr
          );
      }

      function closeModal(id) {
        document.getElementById(id).style.display = "none";
      }

      function openProfileModal() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión primero para personalizar tu perfil.");
          return;
        }

        document.getElementById("profile-modal").style.display = "flex";
        let titleSelect = document.getElementById("profile-title");
        let colorSelect = document.getElementById("profile-color");
        titleSelect.innerHTML = '<option value="">(Ninguno)</option>';
        colorSelect.innerHTML = '<option value="">Estándar</option>';

        google.script.run
          .withSuccessHandler(function (data) {
            if (data && data.rewards) {
              let unlockedTitles = [];
              let unlockedColors = [];
              data.rewards.forEach((r) => {
                if (r.unlocked) {
                  if (r.desc.includes("Título")) {
                    let match = r.desc.match(/"(.*?)"/);
                    if (match) unlockedTitles.push(match[1]);
                  }
                  if (r.desc.includes("Nombre Dorado"))
                    unlockedColors.push({ label: "Dorado", val: "#fbbf24" });
                  if (
                    r.desc.includes("Nombre Rojo") ||
                    r.desc.includes("Infernal")
                  )
                    unlockedColors.push({ label: "Infernal", val: "#ef4444" });
                }
              });

              unlockedTitles.forEach((t) => {
                let opt = document.createElement("option");
                opt.value = t;
                opt.innerText = t;
                if (data.activeTitle === t) opt.selected = true;
                titleSelect.appendChild(opt);
              });

              unlockedColors.forEach((c) => {
                let opt = document.createElement("option");
                opt.value = c.val;
                opt.innerText = c.label;
                if (data.activeColor === c.val) opt.selected = true;
                colorSelect.appendChild(opt);
              });
            }
          })
          .getBattlePassData(summoner);
      }

      function saveProfileCustomization() {
        let summoner = localStorage.getItem("my_summoner_name");
        let title = document.getElementById("profile-title").value;
        let color = document.getElementById("profile-color").value;
        let btn = document.getElementById("btn-save-profile");
        btn.innerText = "GUARDANDO...";
        btn.disabled = true;
        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            btn.innerText = "GUARDAR PERFIL";
            btn.disabled = false;
            if (res.success) {
              closeModal("profile-modal");
              refreshData();
            }
          })
          .withFailureHandler(function (err) {
            alert("❌ Error: " + err.message);
            btn.innerText = "GUARDAR PERFIL";
            btn.disabled = false;
          })
          .updateProfileCustomization(summoner, title, color);
      }

      function goHome() {
        google.script.run
          .withSuccessHandler((url) => window.open(url, "_top"))
          .getScriptUrl();
      }

      function goToDataCenter() {
        google.script.run
          .withSuccessHandler((url) =>
            window.open(url + "?p=graphics_menu", "_top"),
          )
          .getScriptUrl();
      }

      function setupDragToScroll() {
        const slider = document.getElementById("tab-bracket");
        let isDown = false;
        let startX;
        let startY;
        let scrollLeft;
        let scrollTop;
        if (slider) {
          slider.addEventListener("mousedown", (e) => {
            isDown = true;
            slider.classList.add("cursor-grabbing");
            startX = e.pageX - slider.offsetLeft;
            startY = e.pageY - slider.offsetTop;
            scrollLeft = slider.scrollLeft;
            scrollTop = slider.scrollTop;
          });
          slider.addEventListener("mouseleave", () => {
            isDown = false;
            slider.classList.remove("cursor-grabbing");
          });
          slider.addEventListener("mouseup", () => {
            isDown = false;
            slider.classList.remove("cursor-grabbing");
          });
          slider.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const y = e.pageY - slider.offsetTop;
            slider.scrollLeft = scrollLeft - (x - startX) * 2;
            slider.scrollTop = scrollTop - (y - startY) * 2;
          });
        }

        const sliderPlayoffs = document.getElementById("tab-playoffs");
        if (sliderPlayoffs) {
          sliderPlayoffs.addEventListener("mousedown", (e) => {
            isDown = true;
            sliderPlayoffs.classList.add("cursor-grabbing");
            startX = e.pageX - sliderPlayoffs.offsetLeft;
            startY = e.pageY - sliderPlayoffs.offsetTop;
            scrollLeft = sliderPlayoffs.scrollLeft;
            scrollTop = sliderPlayoffs.scrollTop;
          });
          sliderPlayoffs.addEventListener("mouseleave", () => {
            isDown = false;
            sliderPlayoffs.classList.remove("cursor-grabbing");
          });
          sliderPlayoffs.addEventListener("mouseup", () => {
            isDown = false;
            sliderPlayoffs.classList.remove("cursor-grabbing");
          });
          sliderPlayoffs.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - sliderPlayoffs.offsetLeft;
            const y = e.pageY - sliderPlayoffs.offsetTop;
            sliderPlayoffs.scrollLeft = scrollLeft - (x - startX) * 2;
            sliderPlayoffs.scrollTop = scrollTop - (y - startY) * 2;
          });
        }
      }

      function generateH2HImage() {
        const valA = document.getElementById("h2h-select-a").value;
        const valB = document.getElementById("h2h-select-b").value;
        if (!valA || !valB) return alert("Selecciona dos jugadores primero");

        const target = document.getElementById("h2h-export-target");
        html2canvas(target, { backgroundColor: "#0f172a", scale: 2 }).then(
          (canvas) => {
            let link = document.createElement("a");
            link.download = "H2H_Promo.png";
            link.href = canvas.toDataURL("image/png");
            link.click();
          },
        );
      }

      function renderRecordsAndPickems(data) {
        if (!data) return;
        const rCont = document.getElementById("records-container");
        if (rCont && data.records) {
          let html = "";
          const blood = data.records.bloodiest || {
            player: "-",
            val: 0,
            sub: "Kills",
          };
          const pac = data.records.pacifist || {
            player: "-",
            val: 0,
            sub: "Daño",
          };
          const tank = data.records.tank || {
            player: "-",
            val: 0,
            sub: "% Absorbido",
          };
          const farmer = data.records.farmer || {
            player: "-",
            val: 0,
            sub: "CS/M",
          };
          const recs = [
            {
              i: "🩸",
              label: "Sangriento",
              p: blood.player,
              v: blood.val + " " + blood.sub,
              c: "border-red-500 text-red-400",
            },
            {
              i: "🕊️",
              label: "Pacifista",
              p: pac.player,
              v: pac.val + " " + pac.sub,
              c: "border-emerald-500 text-emerald-400",
            },
            {
              i: "🛡️",
              label: "Coloso",
              p: tank.player,
              v: tank.val + " " + tank.sub,
              c: "border-blue-500 text-blue-400",
            },
            {
              i: "🚜",
              label: "Granjero",
              p: farmer.player,
              v: farmer.val + " " + farmer.sub,
              c: "border-yellow-500 text-yellow-400",
            },
          ];

          recs.forEach((r) => {
            // 🚫 FILTRO PARA NO MOSTRAR DATOS A 0 (Solicitado por el usuario)
            const numericVal = parseFloat(r.v);
            if (
              r.p === "-" ||
              numericVal === 0 ||
              (isNaN(numericVal) && r.v.startsWith("0"))
            )
              return;

            html += ' <div class="bg-slate-800 border-t-4 ' + (r.c) +
              ' rounded-xl p-4 text-center shadow-lg transition-transform hover:scale-105"> <div class="text-3xl mb-2">' +
              (r.i) + '</div> <div class="text-xs text-slate-400 font-bold uppercase tracking-widest">' +
              (r.label) + '</div> <div class="font-oswald text-xl text-white my-1 truncate" title="' + (r.p) +
              '">' + (r.p) + '</div> <div class="font-bold">' + (r.v) + '</div> </div> ';
          });
          if (html === "")
            html =
              '<div class="col-span-full text-center text-slate-500 italic">Esperando grandes hazañas de la jornada...</div>';
          rCont.innerHTML = html;
        }

        const pCont = document.getElementById("pickems-container");
        if (pCont && data.oracles) {
          let html = "";
          if (data.oracles.length === 0) {
            html =
              '<div class="text-slate-500">Aún no hay predicciones o no han finalizado los partidos.</div>';
          } else {
            data.oracles.forEach((o, idx) => {
              html += ' <div class="flex justify-between items-center bg-slate-900 border border-slate-700 p-4 rounded mb-2 shadow"> <div class="font-oswald text-2xl text-slate-500 w-10">#' +
                (idx + 1) + '</div> <div class="font-bold text-white text-xl flex-1 text-left pl-4">' +
                (escHtml(o.name)) + '</div> <div class="font-bold text-purple-400 text-lg">' + (o.correct) +
                ' Aciertos</div> </div> ';
            });
          }
          pCont.innerHTML = html;
        }
      }

      // 🏅 DIBUJAR CARTAS DEL SALÓN DE LA FAMA (15 RÉCORDS ÉPICOS)
      function renderHallOfFame() {
        const hallCont = document.getElementById("records-hall-container");
        if (!hallCont) return;

        // Filtramos para coger solo a los que hayan jugado al menos un partido
        let bStats = [...globalStatsData].filter((p) => p.games > 0);

        if (bStats.length === 0) {
          hallCont.innerHTML =
            '<div class="text-center text-slate-500 col-span-full py-10">Esperando a que acaben los primeros partidos para generar los Récords...</div>';
          return;
        }

        // 🟢 Extractor Inteligente (Busca múltiples nombres de variables por si el servidor las manda distinto)
        const getSafeNum = (p, keys, isFloat = true) => {
          for (let k of keys) {
            if (
              p[k] !== undefined &&
              p[k] !== null &&
              p[k] !== "" &&
              p[k] !== 0
            ) {
              let val = isFloat
                ? parseFloat(String(p[k]).replace(/[^\d.-]/g, ""))
                : parseInt(String(p[k]).replace(/[^\d.-]/g, ""));
              if (!isNaN(val) && val > 0) return val;
            }
          }
          return 0;
        };

        const getKills = (p) =>
          (parseFloat(p.kdaText ? p.kdaText.split("/")[0] : 0) || 0) *
          (p.games || 1);
        const getDeaths = (p) =>
          (parseFloat(p.kdaText ? p.kdaText.split("/")[1] : 0) || 0) *
          (p.games || 1);
        const getAssists = (p) =>
          (parseFloat(p.kdaText ? p.kdaText.split("/")[2] : 0) || 0) *
          (p.games || 1);
        const getKDA = (p) =>
          getDeaths(p) === 0
            ? getKills(p) + getAssists(p)
            : (getKills(p) + getAssists(p)) / getDeaths(p);

        // 🟢 Colección de 15 Récords
        const records = [
          {
            player: [...bStats].sort((a, b) => getKills(b) - getKills(a))[0],
            val: (p) => Math.round(getKills(p)) + " Kills",
            title: "MÁS KILLS TOTALES",
            sub: "El Baño de Sangre",
            icon: "🩸",
            border: "border-red-500",
            text: "text-red-500",
            textL: "text-red-300",
            grad: "from-red-900/80",
            shadow: "rgba(239,68,68,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => getSafeNum(b, ["dpm"]) - getSafeNum(a, ["dpm"]),
            )[0],
            val: (p) => getSafeNum(p, ["dpm"]).toFixed(0) + " DPM",
            title: "MÁS DAÑO POR MINUTO",
            sub: "Cañón de Cristal",
            icon: "🎯",
            border: "border-blue-500",
            text: "text-blue-500",
            textL: "text-blue-300",
            grad: "from-blue-900/80",
            shadow: "rgba(59,130,246,0.3)",
          },
          {
            player: [...bStats].sort((a, b) => getKDA(b) - getKDA(a))[0],
            val: (p) => getKDA(p).toFixed(2) + " KDA",
            title: "MEJOR RATIO KDA",
            sub: "El Intocable",
            icon: "✨",
            border: "border-yellow-300",
            text: "text-yellow-300",
            textL: "text-yellow-100",
            grad: "from-yellow-700/80",
            shadow: "rgba(253,224,71,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => getSafeNum(b, ["cs"]) - getSafeNum(a, ["cs"]),
            )[0],
            val: (p) => getSafeNum(p, ["cs"]).toFixed(1) + " CS/M",
            title: "MÁS CS POR MINUTO",
            sub: "Farming Simulator",
            icon: "🚜",
            border: "border-yellow-500",
            text: "text-yellow-500",
            textL: "text-yellow-300",
            grad: "from-yellow-900/80",
            shadow: "rgba(251,191,36,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => getSafeNum(b, ["gpm"]) - getSafeNum(a, ["gpm"]),
            )[0],
            val: (p) => getSafeNum(p, ["gpm"]).toFixed(0) + " GPM",
            title: "MÁS ORO POR MINUTO",
            sub: "El Magnate",
            icon: "💰",
            border: "border-amber-500",
            text: "text-amber-500",
            textL: "text-amber-300",
            grad: "from-amber-900/80",
            shadow: "rgba(245,158,11,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => getAssists(b) - getAssists(a),
            )[0],
            val: (p) => Math.round(getAssists(p)) + " Asists",
            title: "MÁS ASISTENCIAS",
            sub: "El Titiritero",
            icon: "🤝",
            border: "border-pink-500",
            text: "text-pink-500",
            textL: "text-pink-300",
            grad: "from-pink-900/80",
            shadow: "rgba(236,72,153,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(b, ["vspm", "visionScore"]) -
                getSafeNum(a, ["vspm", "visionScore"]),
            )[0],
            val: (p) =>
              getSafeNum(p, ["vspm", "visionScore"]).toFixed(2) + " VSPM",
            title: "PUNTUACIÓN DE VISIÓN",
            sub: "El Ojo que todo lo ve",
            icon: "👁️",
            border: "border-cyan-500",
            text: "text-cyan-500",
            textL: "text-cyan-300",
            grad: "from-cyan-900/80",
            shadow: "rgba(6,182,212,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(
                  b,
                  ["pinks", "controlWards", "visionWardsBoughtInGame"],
                  false,
                ) -
                getSafeNum(
                  a,
                  ["pinks", "controlWards", "visionWardsBoughtInGame"],
                  false,
                ),
            )[0],
            val: (p) =>
              getSafeNum(
                p,
                ["pinks", "controlWards", "visionWardsBoughtInGame"],
                false,
              ) + " Pinks",
            title: "PINKS COMPRADOS",
            sub: "Iluminando la Grieta",
            icon: "💡",
            border: "border-rose-500",
            text: "text-rose-500",
            textL: "text-rose-300",
            grad: "from-rose-900/80",
            shadow: "rgba(244,63,94,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(b, [
                  "tank",
                  "dmgTaken",
                  "damageTaken",
                  "totalDamageTaken",
                ]) -
                getSafeNum(a, [
                  "tank",
                  "dmgTaken",
                  "damageTaken",
                  "totalDamageTaken",
                ]),
            )[0],
            val: (p) => {
              let v = getSafeNum(p, [
                "tank",
                "dmgTaken",
                "damageTaken",
                "totalDamageTaken",
              ]);
              return v > 1000 ? (v / 1000).toFixed(1) + "k" : v;
            },
            title: "DAÑO TANKED / MITIGADO",
            sub: "El Coloso Inamovible",
            icon: "🛡️",
            border: "border-emerald-500",
            text: "text-emerald-500",
            textL: "text-emerald-300",
            grad: "from-emerald-900/80",
            shadow: "rgba(16,185,129,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(b, [
                  "dmgTurrets",
                  "turretDmg",
                  "damageToBuildings",
                  "dmgObj",
                ]) -
                getSafeNum(a, [
                  "dmgTurrets",
                  "turretDmg",
                  "damageToBuildings",
                  "dmgObj",
                ]),
            )[0],
            val: (p) => {
              let v = getSafeNum(p, [
                "dmgTurrets",
                "turretDmg",
                "damageToBuildings",
                "dmgObj",
              ]);
              return v > 1000 ? (v / 1000).toFixed(1) + "k" : v;
            },
            title: "DAÑO A TORRETAS",
            sub: "El Demoledor",
            icon: "🏯",
            border: "border-orange-500",
            text: "text-orange-500",
            textL: "text-orange-300",
            grad: "from-orange-900/80",
            shadow: "rgba(249,115,22,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => getSafeNum(b, ["kp"]) - getSafeNum(a, ["kp"]),
            )[0],
            val: (p) => getSafeNum(p, ["kp"]).toFixed(0) + "% KP",
            title: "KILL PARTICIPATION (KP)",
            sub: "Omnipresente",
            icon: "⚡",
            border: "border-indigo-500",
            text: "text-indigo-500",
            textL: "text-indigo-300",
            grad: "from-indigo-900/80",
            shadow: "rgba(99,102,241,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) => (parseInt(b.mvps) || 0) - (parseInt(a.mvps) || 0),
            )[0],
            val: (p) => (p.mvps || 0) + " MVPs",
            title: "JUGADOR MÁS VALIOSO",
            sub: "La Superestrella",
            icon: "👑",
            border: "border-orange-400",
            text: "text-orange-400",
            textL: "text-orange-200",
            grad: "from-orange-800/80",
            shadow: "rgba(251,146,60,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(b, ["epicMonsters", "epics", "dragonKills"], false) -
                getSafeNum(a, ["epicMonsters", "epics", "dragonKills"], false),
            )[0],
            val: (p) =>
              getSafeNum(p, ["epicMonsters", "epics", "dragonKills"], false) +
              " Monstruos",
            title: "MONSTRUOS ÉPICOS",
            sub: "Cazador de Dragones",
            icon: "🐉",
            border: "border-teal-500",
            text: "text-teal-500",
            textL: "text-teal-300",
            grad: "from-teal-900/80",
            shadow: "rgba(20,184,166,0.3)",
          },
          {
            player: [...bStats].sort(
              (a, b) =>
                getSafeNum(b, ["pentas", "pentaKills", "pentakills"], false) -
                getSafeNum(a, ["pentas", "pentaKills", "pentakills"], false),
            )[0],
            val: (p) =>
              getSafeNum(p, ["pentas", "pentaKills", "pentakills"], false) +
              " Pentas",
            title: "PENTAKILLS",
            sub: "Uno contra Cinco",
            icon: "🌟",
            border: "border-fuchsia-500",
            text: "text-fuchsia-500",
            textL: "text-fuchsia-300",
            grad: "from-fuchsia-900/80",
            shadow: "rgba(217,70,239,0.3)",
          },
          {
            player: [...bStats].sort((a, b) => getDeaths(b) - getDeaths(a))[0],
            val: (p) => Math.round(getDeaths(p)) + " Muertes",
            title: "MÁS MUERTES TOTALES",
            sub: "El Agujero Negro",
            icon: "💀",
            border: "border-purple-500",
            text: "text-purple-500",
            textL: "text-purple-300",
            grad: "from-purple-900/80",
            shadow: "rgba(168,85,247,0.3)",
            grayscale: true,
          },
        ];

        let htmlHall = "";
        records.forEach((r) => {
          let p = r.player;
          if (!p) return;

          let valText = r.val(p);
          let cIcon = getChampIcon(p.champs ? p.champs.split(",")[0] : "");
          let imgFilter = r.grayscale ? "grayscale" : "";

          htmlHall += ' <div class="bg-gradient-to-br ' + (r.grad) + ' to-slate-900 border-2 ' + (r.border) +
            ' rounded-2xl p-6 shadow-[0_0_30px_' + (r.shadow) +
            '] relative overflow-hidden transform transition hover:scale-105 flex flex-col justify-center cursor-pointer" onclick="openScouting(\'' +
            (enc(p.name)) +
            '\')"> <div class="absolute -right-6 -top-6 text-[120px] opacity-10 pointer-events-none">' +
            (r.icon) + '</div> <div class="text-xs ' + (r.textL) +
            ' font-bold uppercase tracking-widest mb-1">' + (r.sub) +
            '</div> <h3 class="text-2xl font-oswald text-white mb-4 truncate" title="' + (r.title) + '">' +
            (r.title) + '</h3> <div class="flex items-center gap-5"> <img src="' + (cIcon) +
            '" class="w-16 h-16 rounded-full border-4 ' + (r.border) + ' shadow-lg bg-black object-cover ' +
            (imgFilter) +
            '" onerror="this.style.display=\'none\'"> <div class="overflow-hidden w-full"> <div class="text-3xl font-black ' +
            (r.text) + ' drop-shadow truncate">' + (valText) +
            '</div> <div class="text-lg font-oswald text-white mt-1 uppercase tracking-widest truncate hover:text-white transition" title="' +
            (escHtml(p.name)) + '">' + (escHtml(p.name)) +
            '</div> <div class="text-xs text-slate-400 font-bold mt-1 truncate" title="' + (escHtml(p.team)) +
            '">' + (escHtml(p.team)) + '</div> </div> </div> </div> ';
        });

        hallCont.innerHTML = htmlHall;

        // === RANKING EQUIPOS EN EL HoF ===
        var teamRankEl = document.getElementById("hof-team-ranking-list");
        if (teamRankEl && tournamentDataCache && tournamentDataCache.teams) {
          var teamCount2 = {};
          records.forEach(function(r) {
            if (!r.player) return;
            var tn2 = r.player.team || "Agente Libre";
            teamCount2[tn2] = (teamCount2[tn2] || 0) + 1;
          });
          var sorted2 = Object.entries(teamCount2).sort(function(a,b){ return b[1]-a[1]; });
          var medals2 = ['🥇','🥈','🥉'];
          var bgCls2 = ['border-yellow-500/50 bg-yellow-500/10','border-slate-400/40 bg-slate-400/10','border-amber-600/40 bg-amber-700/10'];
          var txtCls2 = ['text-yellow-300','text-slate-300','text-amber-500'];
          if (sorted2.length === 0) {
            teamRankEl.innerHTML = '<div class="text-center text-slate-500 text-xs py-4 col-span-full">Sin datos aún</div>';
          } else {
            var rankHtml2 = '';
            sorted2.forEach(function(entry, idx) {
              var tn = entry[0]; var cnt = entry[1];
              var tObj = tournamentDataCache.teams.find(function(t){ return t.name === tn; });
              var lSrc = tObj && tObj.logo ? getLogo(tObj.logo) : '';
              var lHtml = lSrc ? '<img src="' + lSrc + '" class="w-11 h-11 object-contain rounded-lg bg-black/40 border border-slate-700 p-0.5" onerror="this.style.display=\'none\'">' : '<div class="w-11 h-11 rounded-lg bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-600">' + escHtml(tn.substring(0,3).toUpperCase()) + '</div>';
              var clk = tObj ? 'onclick="openTeamHub(\'' + enc(tn) + '\',\'' + (tObj.w||0) + '\',\'' + (tObj.l||0) + '\',\'' + (tObj.pts||0) + '\',\'' + enc(tObj.roster||'') + '\',\'' + enc(tObj.logo||'') + '\')" style="cursor:pointer"' : '';
              var medal = idx < 3 ? medals2[idx] : '<span class="font-black text-slate-500 text-sm">' + (idx+1) + 'º</span>';
              var bg = bgCls2[idx] || 'border-slate-700/40 bg-slate-800/50';
              var txt = txtCls2[idx] || 'text-slate-400';
              rankHtml2 += '<div class="flex items-center gap-3 p-3 rounded-xl border transition hover:scale-[1.02] ' + bg + '" ' + clk + '>' +
                '<span class="text-2xl flex-shrink-0 w-8 text-center">' + medal + '</span>' + lHtml +
                '<div class="flex-1 min-w-0"><div class="font-bold text-sm truncate ' + txt + '">' + escHtml(tn) + '</div>' +
                '<div class="text-[10px] text-slate-500">' + cnt + ' récord' + (cnt!==1?'s':'') + '</div></div>' +
                '<div class="text-3xl font-black font-oswald ' + txt + '">' + cnt + '</div></div>';
            });
            teamRankEl.innerHTML = rankHtml2;
          }
        }
      }

    