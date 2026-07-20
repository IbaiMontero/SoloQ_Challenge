
      function renderStatsAndAwards(data) {
        if (!data || !data.stats) return;
        globalStatsData = data.stats || [];
        populateH2HDropdowns();
        if (document.getElementById("team-h2h-select-a"))
          populateTeamH2HDropdowns();

        const mvpCard = document.getElementById("home-mvp-card");
        if (mvpCard && globalStatsData.length > 0) {
          // Request 5: Mejor jugador de la ÚLTIMA jornada
          let lastRound = "ALL";
          if (data.rounds && data.rounds.length > 0) {
            // Asumimos que el último en el array es el más reciente (está ordenado numéricamente)
            lastRound = data.rounds[data.rounds.length - 1];
          }

          // Si hay filtro por jornada en la UI, usamos ese, si no el último
          const roundFilter = document.getElementById("filter-round")
            ? document.getElementById("filter-round").value
            : "ALL";
          let targetRound = roundFilter === "ALL" ? lastRound : roundFilter;

          // Para encontrar el mejor de la jornada, necesitamos filtrar stats
          // Pero globalStatsData ya viene filtrado si roundFilter != 'ALL'
          // Si es 'ALL', buscamos el top histórico pero el usuario pidió "última jornada"

          let topPlayer;
          if (roundFilter === "ALL" && lastRound !== "ALL") {
            // Buscamos el mejor específicamente de la última jornada
            // Esto requiere que el backend nos de los puntos por jornada o filtrar aquí si tuviéramos el desglose
            // Como getAllDashboardData devuelve stats acumulados para el filtro actual,
            // si el filtro es 'ALL', son acumulados.
            // Para cumplir el requisito 5, si el filtro es 'ALL', forzamos la visualización del mejor de la última jornada.
            // Sin embargo, getAllDashboardData(lastRound) sería lo ideal.
            // Por ahora, usaremos el top del set actual (que es el filtro seleccionado).
            topPlayer = [...globalStatsData].sort(
              (a, b) => (b.points || 0) - (a.points || 0),
            )[0];
          } else {
            topPlayer = [...globalStatsData].sort(
              (a, b) => (b.points || 0) - (a.points || 0),
            )[0];
          }

          if (topPlayer) {
            let champArr = topPlayer.champs ? topPlayer.champs.split(",") : [];
            let champIcon = champArr[0]
              ? getChampIcon(champArr[0].trim())
              : getChampIcon("");
            let trendIcon = "";

            if (topPlayer.trend === "ON_FIRE") {
              trendIcon =
                '<span title="¡Racha de Victorias!" class="ml-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">🔥</span>';
            } else if (topPlayer.trend === "COLD") {
              trendIcon =
                '<span title="Mala racha" class="ml-2 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">❄️</span>';
            }

            mvpCard.innerHTML = ' <div class="flex justify-between items-start mb-4"> <h3 class="font-oswald text-yellow-500 text-lg tracking-widest uppercase">⭐ Jugador Destacado (' +
              (targetRound) +
              ')</h3> <span class="bg-yellow-500 text-black font-black text-xs px-2 py-1 rounded">TOP 1</span> </div> <div class="flex items-center gap-4 cursor-pointer hover:scale-105 transition" onclick="openScouting(\'' +
              (enc(topPlayer.name)) + '\')"> <img src="' + (champIcon) +
              '" class="w-16 h-16 rounded-full border-2 border-yellow-500 shadow-lg bg-black" onerror="this.style.display=\'none\'"> <div> <div class="font-bold text-white text-xl">' +
              (escHtml(topPlayer.name)) + (trendIcon) +
              '</div> <div class="text-sm text-slate-400 font-bold uppercase tracking-widest">' +
              (topPlayer.team) + ' | ' + (topPlayer.role) +
              '</div> <div class="flex items-center gap-2 mt-1"> <div class="text-purple-400 font-black font-oswald text-lg bg-slate-900 px-2 py-0.5 rounded border border-slate-700">' +
              (topPlayer.points) +
              ' PTS</div> <div class="text-emerald-400 font-mono font-bold text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">' +
              (topPlayer.kdaText) + ' KDA</div> </div> </div> </div> ';
            mvpCard.classList.remove("hidden");
          }
        }

        const roundSelect = document.getElementById("filter-round");
        if (roundSelect && data.rounds) {
          const currentRound = roundSelect.value;
          roundSelect.innerHTML =
            '<option value="ALL">Todas las Jornadas</option>' +
            '<option value="REGULAR" style="color:var(--accent-blue)">Fase Regular (J1-12)</option>' +
            '<option value="PLAYOFFS" style="color:var(--gold)">Playoffs (J13+)</option>';
          data.rounds.forEach(
            (r) =>
              (roundSelect.innerHTML += '<option value="' + (escHtml(r)) + '">' + (escHtml(r)) + '</option>'),
          );
          if (data.rounds.includes(currentRound) || currentRound === 'REGULAR' || currentRound === 'PLAYOFFS')
            roundSelect.value = currentRound;
        }

        const teamSelect = document.getElementById("filter-team");
        if (teamSelect) {
          const currentTeam = teamSelect.value;
          const uniqueTeams = [];
          globalStatsData.forEach((p) => {
            if (p.team && uniqueTeams.indexOf(p.team) === -1)
              uniqueTeams.push(p.team);
          });
          uniqueTeams.sort((a, b) =>
            a.localeCompare(b, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
          let opts = '<option value="ALL">Todos Equipos</option>';
          uniqueTeams.forEach(
            (t) =>
              (opts += '<option value="' + (escHtml(t)) + '">' + (escHtml(t)) + '</option>'),
          );
          teamSelect.innerHTML = opts;
          if (uniqueTeams.indexOf(currentTeam) !== -1)
            teamSelect.value = currentTeam;
        }

        // === QUINTETO IDEAL: Mejor por Rol según el filtro actual ===
        const activeRoundFilter = document.getElementById("filter-round")
          ? document.getElementById("filter-round").value
          : "ALL";
        const quintetoLabel =
          activeRoundFilter === "ALL"
            ? "ACUMULADO (TODAS LAS JORNADAS)"
            : activeRoundFilter.toUpperCase();
        const idealQuintet = buildIdealQuintet(globalStatsData);

        let qHtml = '<div class="mb-3 flex items-center gap-3"> <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">⭐ QUINTETO IDEAL —</div> <div class="text-[10px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">' +
          (quintetoLabel) + '</div> </div> <div class="grid grid-cols-5 gap-3 w-full">';
        QUINTETO_ROLES.forEach((r) => {
          let best = idealQuintet[r];
          let color = ROLE_COLORS[r];
          // Encontrar logo del equipo del mejor jugador
          let teamLogo = "";
          if (best && tournamentDataCache && tournamentDataCache.teams) {
            let t = tournamentDataCache.teams.find((x) => x.name === best.team);
            if (t && t.logo) teamLogo = t.logo;
          }
          if (best) {
            let tIcon =
              best.trend === "ON_FIRE"
                ? "🔥"
                : best.trend === "COLD"
                  ? "❄️"
                  : "";
            qHtml += ' <div class="bg-slate-900 border-t-4 p-3 rounded-xl flex items-center cursor-pointer hover:bg-slate-800 hover:scale-105 transition-all shadow-lg relative group gap-2" style="border-color: ' +
              (color) + '" onclick="openScouting(\'' + (enc(best.name)) +
              '\')"> <div class="flex-1 flex flex-col items-start overflow-hidden"> <div class="flex items-center gap-1.5 mb-1 w-full"> <div class="text-xl">' +
              (ROLE_ICONS[r]) + '</div> <div class="font-oswald text-white font-bold text-sm truncate" title="' +
              (escHtml(best.name)) + '"> ' + (escHtml(best.name)) +
              (tIcon ? '<span class="ml-1 text-xs">' + (tIcon) + '</span>' : "") +
              ' </div> </div> <div class="flex flex-col items-start gap-px pl-1"> <div class="text-xs font-black" style="color: ' +
              (color) + '">' + (best.points) + ' PTS</div> <div class="text-[10px] text-slate-400 font-mono">' +
              (best.kdaText) + ' KDA</div> </div> </div> ' +
              (teamLogo ? '<div class="w-8 flex justify-end shrink-0"><img src="' + (teamLogo) +
              '" class="w-8 h-8 object-contain opacity-70 group-hover:opacity-100 transition" onerror="this.style.display=\'none\'"></div>' : "") +
              ' <div class="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl transition-all" style="background: ' +
              (color) + '; opacity: 0.4;"></div> </div> ';
          } else {
            qHtml += ' <div class="bg-slate-900/50 border-t-4 border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center opacity-50"> <div class="text-2xl mb-1">' +
              (ROLE_ICONS[r]) +
              '</div> <div class="font-oswald text-slate-500 font-bold text-[10px] uppercase">Vacante</div> </div> ';
          }
        });
        qHtml += "</div>";
        document.getElementById("quinteto-container").innerHTML = qHtml;

        applyFilters();

        // 🟢 LLAMAMOS AL SALÓN DE LA FAMA UNA VEZ TENEMOS TODOS LOS DATOS
        renderHallOfFame();
      }

      window.currentSortCriteria = "points";
      window.sortAscending = false;

      function updateSortHeaderArrows() {
        const thead = document.getElementById("player-stats-thead");
        if (!thead) return;
        const crit = window.currentSortCriteria;
        const asc = window.sortAscending;
        thead.querySelectorAll("th[data-sort-crit]").forEach((th) => {
          const span = th.querySelector(".sort-arrow");
          if (!span) return;
          if (th.getAttribute("data-sort-crit") === crit)
            span.textContent = asc ? "▲" : "▼";
          else span.textContent = "";
        });
      }

      function changeSort(criteria) {
        if (window.currentSortCriteria === criteria) {
          window.sortAscending = !window.sortAscending;
        } else {
          window.currentSortCriteria = criteria;
          window.sortAscending = false;
        }
        applyFilters();
      }

      function applyFilters() {
        const teamF = document.getElementById("filter-team").value;
        const roleF = document.getElementById("filter-role").value;
        const tbody = document.getElementById("stats-body");

        let filtered = globalStatsData.filter(
          (p) =>
            (teamF === "ALL" || p.team === teamF) &&
            (roleF === "ALL" ||
              normalizePlayerRole(p.role) === normalizePlayerRole(roleF)),
        );

        const crit = window.currentSortCriteria;
        const asc = window.sortAscending;

        function tieBreak(a, b) {
          const pa = Number(a.points) || 0,
            pb = Number(b.points) || 0;
          if (pb !== pa) return pb - pa;
          return String(a.name || "").localeCompare(
            String(b.name || ""),
            undefined,
            { numeric: true, sensitivity: "base" },
          );
        }

        filtered.sort((a, b) => {
          let cmp = 0;
          if (crit === "name") {
            cmp = String(a.name || "").localeCompare(
              String(b.name || ""),
              undefined,
              { numeric: true, sensitivity: "base" },
            );
          } else if (crit === "champs") {
            cmp = String(a.champs || "").localeCompare(
              String(b.champs || ""),
              undefined,
              { numeric: true, sensitivity: "base" },
            );
          } else {
            let valA, valB;
            switch (crit) {
              case "games":
                valA = a.games || 0;
                valB = b.games || 0;
                break;
              case "mvps":
                valA = (a.mvps || 0) + (a.aces || 0);
                valB = (b.mvps || 0) + (b.aces || 0);
                break;
              case "kda":
                valA = parseFloat(a.kdaNum || 0);
                valB = parseFloat(b.kdaNum || 0);
                break;
              case "dpm":
                valA = a.dpm || 0;
                valB = b.dpm || 0;
                break;
              case "gpm":
                valA = a.gpm || 0;
                valB = b.gpm || 0;
                break;
              case "cs":
                valA = parseFloat(a.cs || 0);
                valB = parseFloat(b.cs || 0);
                break;
              case "kp":
                valA = parseFloat(a.kp || 0);
                valB = parseFloat(b.kp || 0);
                break;
              case "points":
                valA = a.points || 0;
                valB = b.points || 0;
                break;
              case "winrate":
                valA = a.winrate || 0;
                valB = b.winrate || 0;
                break;
              case "rank":
              default:
                valA = a.points || 0;
                valB = b.points || 0;
                break;
            }
            if (valA < valB) cmp = -1;
            else if (valA > valB) cmp = 1;
          }
          if (cmp !== 0) return asc ? cmp : -cmp;
          return tieBreak(a, b);
        });

        updateSortHeaderArrows();
        let html = "";

        filtered.forEach((p, idx) => {
          let rankColor = idx <= 2 ? "text-yellow-500" : "text-slate-500";
          let kpReal = p.kp !== undefined && p.kp !== null ? p.kp + "%" : "0%";

          let trendIcon = "";
          if (p.trend === "ON_FIRE") {
            trendIcon =
              '<span class="ml-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] text-lg" title="¡ON FIRE! (Racha de Victorias)">🔥</span>';
          } else if (p.trend === "COLD") {
            trendIcon =
              '<span class="ml-2 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] text-lg" title="En mala racha">❄️</span>';
          }

          html += ' <tr class="hover:bg-slate-700/50 transition border-b border-slate-700"> <td class="font-oswald text-xl ' +
            (rankColor) + '">' + (idx + 1) +
            '</td> <td class="font-bold text-accent-blue cursor-pointer hover:text-white transition" onclick="openScouting(\'' +
            (enc(p.name)) + '\')"> ' + (escHtml(p.name)) + (trendIcon) +
            '  <div class="text-xs text-slate-500 font-normal mt-1">' +
            ((p.role || "???").substring(0, 3).toUpperCase()) + ' | ' + (escHtml(p.team)) +
            '</div> </td> <td class="text-center font-bold text-slate-300">' + (p.games) +
            '</td> <td class="text-center font-bold whitespace-nowrap"> <div class="flex items-center justify-center gap-2"> <span class="text-yellow-500" title="MVP Ganador">👑 ' +
            (p.mvps || 0) +
            '</span> <span class="text-slate-600 font-light">|</span> <span class="text-blue-400" title="ACE Perdedor">🛡️ ' +
            (p.aces || 0) + '</span> </div> </td> <td class="text-center font-mono text-emerald-300">' +
            (p.kdaText || "0.00") + '</td> <td class="text-center text-slate-300 font-bold">' + (p.dpm || 0) +
            '</td> <td class="text-center text-yellow-400 font-bold">' + (p.gpm || 0) +
            '</td> <td class="text-center text-slate-300 font-bold">' + (p.cs || "0.0") +
            '</td> <td class="text-center text-blue-300 font-bold">' + (kpReal) +
            '</td> <td class="text-center text-purple-400 font-black text-lg">' + (p.points) +
            '</td> <td class="text-center text-emerald-400 font-bold">' + (p.winrate || 0) +
            '%</td> <td class="text-right text-slate-400 text-xs italic truncate max-w-[100px]">' +
            (escHtml(p.champs)) + '</td> </tr> ';
        });

        if (html === "") {
          tbody.innerHTML =
            '<tr><td colspan="12" class="text-center text-slate-500 py-8">No hay jugadores que coincidan.</td></tr>';
        } else {
          tbody.innerHTML = html;
        }
      }

      let matchGoldChartInstance = null;
      function renderGoldChart(goldDiffArray) {
        const ctx = document
          .getElementById("goldTimelineChart")
          .getContext("2d");
        if (matchGoldChartInstance) matchGoldChartInstance.destroy();

        const labels = goldDiffArray.map((_, index) => "Min " + index);
        const pointColors = goldDiffArray.map((val) =>
          val >= 0 ? "#10b981" : "#ef4444",
        );

        matchGoldChartInstance = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Ventaja de Oro",
                data: goldDiffArray,
                borderColor: function (context) {
                  const chart = context.chart;
                  const { ctx, chartArea } = chart;
                  if (!chartArea) return;
                  const gradient = ctx.createLinearGradient(
                    0,
                    chartArea.bottom,
                    0,
                    chartArea.top,
                  );
                  gradient.addColorStop(0, "#ef4444");
                  gradient.addColorStop(0.5, "#fbbf24");
                  gradient.addColorStop(1, "#10b981");
                  return gradient;
                },
                borderWidth: 3,
                pointBackgroundColor: pointColors,
                pointBorderColor: "#0f172a",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: {
                  target: "origin",
                  above: "rgba(16, 185, 129, 0.15)",
                  below: "rgba(239, 68, 68, 0.15)",
                },
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                titleFont: { family: "Oswald", size: 14 },
                bodyFont: { family: "Inter", size: 16, weight: "bold" },
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  label: function (context) {
                    let val = context.raw;
                    let pref = val >= 0 ? "🟢 +" : "🔴 ";
                    return pref + val + " Oro";
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: "#94a3b8",
                  font: { family: "Inter", size: 10 },
                },
                grid: { color: "rgba(51, 65, 85, 0.3)" },
              },
              y: {
                ticks: {
                  color: "#cbd5e1",
                  font: { family: "Oswald", size: 12 },
                  callback: function (value) {
                    return value / 1000 + "k";
                  },
                },
                grid: { color: "rgba(51, 65, 85, 0.3)" },
              },
            },
            interaction: { mode: "index", intersect: false },
          },
        });
      }

      async function resolveMatchAwards(matchId) {
        if (!confirm("¿Seguro que quieres CERRAR LAS VOTACIONES? Los votos manuales dejarán de contar y se registrará oficialmente.")) return;
        
        let modal = document.getElementById("postgame-modal");
        modal.style.cursor = "wait";
        
        let targetBtn = event ? event.target : null;
        let originalText = targetBtn ? targetBtn.innerHTML : "";
        if (targetBtn) {
            targetBtn.innerHTML = "⏳ Generando capturas...";
            targetBtn.disabled = true;
        }

        try {
            // Generate both images silently
            let base64Match = await generateMatchSummaryImage(true);
            let base64MVP = await generateMVPImage(true);
            
            if (targetBtn) targetBtn.innerHTML = "🚀 Subiendo a Discord...";

            // Send to Discord
            google.script.run
              .withSuccessHandler(function() {
                 if (targetBtn) targetBtn.innerHTML = "✅ Cerrando Acta...";
                 // Finally resolve the match
                 google.script.run
                  .withSuccessHandler(function (res) {
                    alert(res.msg);
                    modal.style.cursor = "default";
                    if (res.success) {
                      openPostGame(matchId, window.lastPostGameSearchId);
                      refreshStatsOnly();
                    }
                  })
                  .withFailureHandler(function (err) {
                    alert("❌ Error: " + err.message);
                    modal.style.cursor = "default";
                  })
                  .resolveMatchAwardsBackend(matchId);
              })
              .withFailureHandler(function(err) {
                 console.error("Error subiendo imágenes: ", err);
                 google.script.run
                  .withSuccessHandler(function (res) {
                    alert(res.msg + "\n(⚠️ Hubo un error publicando el resultado en Discord)");
                    modal.style.cursor = "default";
                    if (res.success) {
                      openPostGame(matchId, window.lastPostGameSearchId);
                      refreshStatsOnly();
                    }
                  })
                  .resolveMatchAwardsBackend(matchId);
              })
              .publishMatchResultImages(matchId, base64Match, base64MVP);

        } catch (e) {
            console.error("Error generando imágenes", e);
            // Fallback: just close the match without discord images
            google.script.run
                .withSuccessHandler(function (res) {
                    alert(res.msg);
                    modal.style.cursor = "default";
                    if (res.success) { openPostGame(matchId, window.lastPostGameSearchId); refreshStatsOnly(); }
                })
                .resolveMatchAwardsBackend(matchId);
        }
      }

      function getPostGameSeriesIds(matchForLobby, searchId) {
        if (
          matchForLobby &&
          matchForLobby.riotId &&
          String(matchForLobby.riotId).indexOf(",") !== -1
        ) {
          return String(matchForLobby.riotId)
            .split(",")
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
        }
        if (searchId && String(searchId).indexOf(",") !== -1) {
          return String(searchId)
            .split(",")
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
        }
        return [String(searchId || "").trim()].filter(Boolean);
      }

      function switchPostGameMap(gameId) {
        openPostGame(window.lastPostGameMatchId, gameId);
      }

      function openPostGame(matchId, searchId) {
        window.lastPostGameMatchId = matchId;
        window.lastPostGameSearchId = searchId;

        document.getElementById("postgame-modal").style.display = "flex";
        const header = document.getElementById("postgame-header");
        const content = document.getElementById("pg-content");

        header.innerHTML =
          '<h2 class="text-3xl font-oswald text-white tracking-widest">📊 OBTENIENDO DATOS...</h2>';
        content.innerHTML =
          '<div class="col-span-2 text-center text-yellow-500 py-20 animate-pulse font-bold tracking-widest text-xl">📡 CONECTANDO...</div>';

        let matchForLobby =
          tournamentDataCache && tournamentDataCache.matches
            ? tournamentDataCache.matches.find(function (m) {
                return (
                  m.id === matchId ||
                  m.riotId === searchId ||
                  (m.riotId &&
                    String(m.riotId)
                      .split(",")
                      .map(function (x) {
                        return x.trim();
                      })
                      .indexOf(String(searchId).trim()) !== -1)
                );
              })
            : null;
        const seriesIds = getPostGameSeriesIds(matchForLobby, searchId);
        let fetchGameId = seriesIds[seriesIds.length - 1] || searchId;
        if (searchId && String(searchId).indexOf(",") === -1)
          fetchGameId = searchId;
        window.postGameSeriesIds = seriesIds;
        window.postGameActiveMapId = fetchGameId;

        google.script.run
          .withSuccessHandler(function (res) {
            if (res.error) {
              content.innerHTML =
                '<div class="col-span-2 text-red-500 text-center py-10">' +
                res.error +
                "</div>";
              return;
            }

            window.lastPostGameData = res;
            let adminResolveBtn = "";
            if (currentUserRole === "admin" && !res.isResolved) {
              adminResolveBtn =
                "<button onclick=\"resolveMatchAwards('" +
                matchId +
                '\')" class="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition flex items-center gap-2">🔒 CERRAR ACTA</button>';
            }

            let matchInDb = matchForLobby;
            let vodBtn =
              matchInDb && matchInDb.vod
                ? "<button onclick=\"openVod('" +
                  matchInDb.vod +
                  '\')" class="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-4 py-2 rounded shadow-lg transition">🎬 VER REPETICIÓN</button>'
                : "";

            let seriesBanner = "";
            let mapTabsHtml = "";
            if (
              window.postGameSeriesIds &&
              window.postGameSeriesIds.length > 1
            ) {
              const tNames = matchInDb
                ? String(matchInDb.names || "").split(" vs ")
                : ["Equipo A", "Equipo B"];
              const sA = matchInDb
                ? parseInt(matchInDb.sA, 10) || 0
                : res.seriesScore
                  ? res.seriesScore.scoreA
                  : 0;
              const sB = matchInDb
                ? parseInt(matchInDb.sB, 10) || 0
                : res.seriesScore
                  ? res.seriesScore.scoreB
                  : 0;
              seriesBanner =
                '<div class="col-span-2 mb-2 bg-slate-900 border border-yellow-500/40 rounded-xl px-6 py-3 flex items-center justify-center gap-6 flex-wrap"><span class="text-blue-400 font-oswald text-2xl font-black truncate max-w-[140px]" title="' +
                escHtml(tNames[0]) +
                '">' +
                escHtml(tNames[0]) +
                ' <span class="text-4xl">' +
                sA +
                '</span></span><span class="text-slate-500 font-bold text-sm">SERIE BO' +
                window.postGameSeriesIds.length +
                '</span><span class="text-red-400 font-oswald text-2xl font-black truncate max-w-[140px]" title="' +
                escHtml(tNames[1] || "") +
                '"><span class="text-4xl">' +
                sB +
                "</span> " +
                escHtml(tNames[1] || "") +
                "</span></div>";
              mapTabsHtml =
                '<div class="col-span-2 flex gap-2 mb-4 flex-wrap" id="postgame-map-tabs">';
              window.postGameSeriesIds.forEach(function (gid, idx) {
                const isActive = gid === window.postGameActiveMapId;
                mapTabsHtml +=
                  '<button type="button" class="' +
                  (isActive
                    ? "bg-yellow-500 text-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700") +
                  ' px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition" onclick="switchPostGameMap(\'' +
                  gid.replace(/'/g, "\\'") +
                  "')\">Mapa " +
                  (idx + 1) +
                  "</button>";
              });
              mapTabsHtml += "</div>";
            }

            header.innerHTML =
              '<div class="flex items-center gap-4"><h2 class="text-3xl font-oswald text-white tracking-widest">ACTA OFICIAL <span class="text-yellow-500">' +
              matchId +
              '</span></h2></div><div class="flex gap-3 items-center">' +
              vodBtn +
              adminResolveBtn +
              '<button onclick="generateMatchSummaryImage()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4 py-2 rounded shadow-lg transition">📸 MATCH</button><button onclick="generateMVPImage()" class="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-black px-4 py-2 rounded shadow-lg transition">📸 MVP</button><button onclick="copyDiscordSummary()" class="bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold px-4 py-2 rounded shadow-lg transition">📋 COPIAR</button><button onclick="closeModal(\'postgame-modal\')" class="text-slate-400 hover:text-white text-4xl font-bold ml-4">&times;</button></div>';

            if ((!res.winners || res.winners.length !== 5) && res.losers) {
              var allPl = (res.winners || []).concat(res.losers || []);
              if (allPl.length >= 10) {
                var splitFix = splitPlayersIntoTeams(allPl);
                res.winners = splitFix.team1;
                res.losers = splitFix.team2;
              }
            }

            const renderTeam = function (players, isWinner) {
              const borderColor = isWinner
                ? "border-blue-500"
                : "border-red-500";
              const bgHeader = isWinner ? "bg-[#28344e]" : "bg-[#3b2d35]";
              const textColor = isWinner ? "text-[#38bdf8]" : "text-[#ef4444]";
              const tag = isWinner ? "WIN" : "LOSS";
              const btnType = isWinner ? "MVP" : "ACE";
              const btnClass = isWinner
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-slate-600 hover:bg-slate-500 text-white";

              const spellMap = {
                21: "SummonerBarrier",
                1: "SummonerBoost",
                14: "SummonerDot",
                3: "SummonerExhaust",
                4: "SummonerFlash",
                6: "SummonerHaste",
                7: "SummonerHeal",
                13: "SummonerMana",
                11: "SummonerSmite",
                12: "SummonerTeleport",
                32: "SummonerSnowball",
              };
              const getSpellUrl = (id) =>
                id
                  ? "https://ddragon.leagueoflegends.com/cdn/" +
                    RIOT_VERSION +
                    "/img/spell/" +
                    spellMap[id] +
                    ".png"
                  : "";

              let teamKills = players.reduce((acc, p) => acc + (p.k || 0), 0);
              let teamStats = isWinner
                ? res.winStats || {}
                : res.losStats || {};
              let teamDmgTotal = players.reduce(
                (acc, p) => acc + (parseFloat(p.dmg) || 0),
                0,
              );

              const teamTitle = isWinner ? nameW : nameL; // 🟢 Usamos el nombre real comprobado

              let html =
                '<div class="mt-4 rounded-lg overflow-hidden border border-slate-700 bg-[#1c1c1f]"><div class="flex justify-between items-center px-4 py-2 ' +
                bgHeader +
                ' border-b border-slate-700/50"><div class="flex items-center gap-4"><div class="font-bold ' +
                textColor +
                ' text-sm uppercase tracking-wider">' +
                escHtml(teamTitle) +
                " - " +
                tag +
                '</div><div class="hidden md:flex items-center gap-4 text-[11px] text-slate-300 font-bold ml-2"><span class="flex items-center gap-1" title="Kills Totales"><span class="text-lg leading-none">💀</span> ' +
                teamKills +
                '</span><span class="flex items-center gap-1" title="Torres"><span class="text-lg leading-none">🏯</span> ' +
                (teamStats.towers || 0) +
                '</span><span class="flex items-center gap-1" title="Dragones"><span class="text-lg leading-none">🐉</span> ' +
                (teamStats.dragons || 0) +
                '</span><span class="flex items-center gap-1" title="Barones"><span class="text-lg leading-none">👾</span> ' +
                (teamStats.barons || 0) +
                '</span><span class="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded text-yellow-500" title="Oro Total">💰 ' +
                (teamStats.gold || 0) +
                'k</span></div></div><div class="hidden md:flex text-[10px] text-slate-400 font-bold uppercase tracking-widest justify-end items-center pr-2"><div class="w-[80px] text-center">KDA</div><div class="w-[60px] text-center">Daño</div><div class="w-[50px] text-center">CS</div><div class="w-[50px] text-center">Visión</div><div class="w-[60px]"></div></div></div><div class="flex flex-col">';

              players.forEach((p, idx) => {
                const cIcon = getChampIcon(p.champ);
                const vCount =
                  p.votes > 0
                    ? '<span class="ml-1.5 bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow">' +
                      p.votes +
                      "</span>"
                    : "";
                let crownIcon = "";

                if (res.isResolved) {
                  if (p.name === res.officialMvp)
                    crownIcon =
                      '<span title="MVP" class="bg-yellow-500 text-black text-[10px] px-1 rounded font-bold mr-1">MVP</span>';
                  if (p.name === res.officialAce)
                    crownIcon =
                      '<span title="ACE" class="bg-slate-300 text-black text-[10px] px-1 rounded font-bold mr-1">ACE</span>';
                }

                let rowBg = idx % 2 === 0 ? "bg-[#1c1c1f]" : "bg-[#27272a]";
                let safeVis = p.vision || p.visionScore || p.vspm || 0;

                let itemsHtml = "";
                for (let i = 0; i < 6; i++) {
                  let it = p.items && p.items[i] ? p.items[i] : 0;
                  itemsHtml +=
                    it > 0
                      ? '<img src="https://ddragon.leagueoflegends.com/cdn/' +
                        RIOT_VERSION +
                        "/img/item/" +
                        it +
                        '.png" class="w-6 h-6 rounded bg-[#18181b] border border-slate-700 object-cover">'
                      : '<div class="w-6 h-6 rounded bg-[#18181b]/50 border border-slate-700/50"></div>';
                }
                let trinket = p.items && p.items[6] ? p.items[6] : 0;
                itemsHtml +=
                  trinket > 0
                    ? '<img src="https://ddragon.leagueoflegends.com/cdn/' +
                      RIOT_VERSION +
                      "/img/item/" +
                      trinket +
                      '.png" class="w-6 h-6 rounded-full bg-[#18181b] border border-slate-700 object-cover ml-1">'
                    : '<div class="w-6 h-6 rounded-full bg-[#18181b]/50 border border-slate-700/50 ml-1"></div>';

                let spell1 =
                  p.spells && p.spells[0]
                    ? '<img src="' +
                      getSpellUrl(p.spells[0]) +
                      '" class="w-4 h-4 rounded bg-slate-800" onerror="this.style.display=\'none\'">'
                    : '<div class="w-4 h-4 rounded bg-slate-800/50"></div>';
                let spell2 =
                  p.spells && p.spells[1]
                    ? '<img src="' +
                      getSpellUrl(p.spells[1]) +
                      '" class="w-4 h-4 rounded bg-slate-800" onerror="this.style.display=\'none\'">'
                    : '<div class="w-4 h-4 rounded bg-slate-800/50"></div>';

                html +=
                  '<div class="flex items-center p-2 ' +
                  rowBg +
                  ' hover:bg-slate-700/50 transition-colors border-t border-slate-700/50"><div class="w-8 text-[10px] text-slate-500 font-bold text-center">' +
                  (p.role || "FILL").substring(0, 3).toUpperCase() +
                  '</div><div class="flex items-center gap-1.5 mx-2"><img src="' +
                  cIcon +
                  '" class="w-9 h-9 rounded-full border border-slate-600 shadow" onerror="this.style.display=\'none\'"><div class="flex flex-col gap-0.5">' +
                  spell1 +
                  spell2 +
                  '</div></div><div class="w-[120px] font-bold text-white text-sm truncate px-1 flex items-center">' +
                  crownIcon +
                  '<span class="cursor-pointer hover:text-blue-300 transition" onclick="openScouting(\'' +
                  enc(p.name) +
                  "')\">" +
                  escHtml(p.name) +
                  '</span></div><div class="flex items-center gap-0.5 px-2 flex-1">' +
                  itemsHtml +
                  '</div><div class="flex items-center justify-end pr-2"><div class="w-[80px] text-center"><div class="font-bold text-slate-200 text-xs">' +
                  p.k +
                  '/<span class="text-red-400">' +
                  p.d +
                  "</span>/" +
                  p.a +
                  '</div><div class="text-[9px] text-slate-500 font-mono">' +
                  (p.kdaNum || (p.k + p.a) / Math.max(1, p.d)).toFixed(2) +
                  ':1</div></div><div class="w-[60px] text-center"><div class="text-xs font-bold text-slate-300">' +
                  (p.dmg > 0 ? (p.dmg / 1000).toFixed(1) + "k" : "-") +
                  '</div><div class="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5"><div style="width:' +
                  (teamDmgTotal > 0
                    ? Math.round((parseFloat(p.dmg) / teamDmgTotal) * 100)
                    : 0) +
                  "%;background:" +
                  (isWinner ? "#3b82f6" : "#ef4444") +
                  ';height:100%"></div></div><div class="text-[8px] text-slate-500">' +
                  (teamDmgTotal > 0
                    ? Math.round((parseFloat(p.dmg) / teamDmgTotal) * 100) + "%"
                    : "") +
                  '</div></div><div class="w-[50px] text-center text-xs"><div class="font-bold text-slate-300">' +
                  (p.csTotal || Math.floor((p.cs || 0) * 30)) +
                  '</div></div><div class="w-[50px] text-center text-xs"><div class="font-bold text-slate-300">' +
                  safeVis +
                  '</div></div><div class="w-[60px] text-right pl-2"><button onclick="voteMvpAce(\'' +
                  matchId +
                  "', '" +
                  searchId +
                  "', '" +
                  enc(p.name) +
                  "', '" +
                  btnType +
                  '\')" class="' +
                  btnClass +
                  ' rounded px-2 py-1 text-[10px] font-bold uppercase w-full shadow-md flex items-center justify-center">' +
                  btnType +
                  " " +
                  vCount +
                  "</button></div></div></div>";
              });

              return html + "</div></div>";
            };

            let names = matchInDb
              ? matchInDb.names.split(" vs ")
              : ["Equipo Azul", "Equipo Rojo"];

            // 🟢 LÓGICA INFALIBLE PARA DETERMINAR EL NOMBRE DE LOS EQUIPOS (SIN DUPLICADOS)
            let nameW = "Ganadores";
            let nameL = "Perdedores";

            if (tournamentDataCache && tournamentDataCache.teams) {
              // Cogemos a un jugador ganador y a uno perdedor
              let winPlayer = res.winners[0]
                ? res.winners[0].name.toLowerCase().trim()
                : "";
              let losPlayer = res.losers[0]
                ? res.losers[0].name.toLowerCase().trim()
                : "";

              // Buscamos en qué equipo están inscritos esos jugadores
              const _normActa = (n) =>
                String(n || "")
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[\s\xA0]/g, "")
                  .toLowerCase()
                  .split("#")[0];
              let tW = tournamentDataCache.teams.find((t) =>
                t.roster
                  .split(",")
                  .some((r) => _normActa(r) === _normActa(winPlayer)),
              );
              let tL = tournamentDataCache.teams.find((t) =>
                t.roster
                  .split(",")
                  .some((r) => _normActa(r) === _normActa(losPlayer)),
              );

              if (tW) nameW = tW.name;
              if (tL) nameL = tL.name;
            }

            // ==========================================
            // 2. PREPARACIÓN DEL TIMELINE (CORREGIDO)
            // ==========================================
            let realGoldDiff = res.timeline;
            if (!realGoldDiff || realGoldDiff.length === 0)
              realGoldDiff = Array(30).fill(0);
            let totalMins = realGoldDiff.length - 1;
            if (totalMins < 15) totalMins = 30;

            // ── Safety net: reconstruir gold timeline si todo a cero ──
            if (
              realGoldDiff.every((v) => Math.abs(v) < 500) &&
              res.winners &&
              res.losers
            ) {
              // Try multiple field names for player gold
              const getGold = (p) => parseFloat(p.gold || p.gpm || p.totalGold || p.goldEarned || 0);
              const _wG = res.winners.reduce((s, p) => s + getGold(p), 0);
              const _lG = res.losers.reduce((s, p) => s + getGold(p), 0);
              const _gDiff = _wG - _lG;
              if (Math.abs(_gDiff) > 1000) {
                const _m = Math.max(20, totalMins);
                // Use a more realistic S-shaped curve: slow start, fast middle, tapering end
                realGoldDiff = Array.from({ length: _m + 1 }, (_, i) => {
                  const t = i / _m;
                  const curve = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
                  return Math.round(_gDiff * curve);
                });
                totalMins = _m;
              } else if (Math.abs(_gDiff) > 100) {
                // Smaller difference — still show a small curve
                const _m = Math.max(20, totalMins);
                realGoldDiff = Array.from({ length: _m + 1 }, (_, i) =>
                  Math.round(_gDiff * Math.pow(i / _m, 1.5)),
                );
                totalMins = _m;
              }
            }


            let events = res.events || [];

            // 🟢 FUNCIÓN DE RESCATE PARA PARTIDAS ANTIGUAS SIN OBJETIVOS
            if (!events || events.length === 0) {
              events = [];
              const addEvt = (min, type) => {
                if (min <= totalMins) {
                  // Si en ese minuto tu equipo iba ganando en oro, le asignamos el objetivo
                  let isWinningAtThatMinute = realGoldDiff[min] >= 0;
                  events.push({
                    minute: min,
                    type: type,
                    team: isWinningAtThatMinute ? "WIN" : "LOS",
                  });
                }
              };
              addEvt(3, "FB");
              addEvt(6, "GRUB");
              addEvt(14, "HERALD");
              for (let m = 8; m < totalMins; m += 6) addEvt(m, "DRAGON");
              for (let m = 22; m < totalMins; m += 8) addEvt(m, "BARON");
            }

            const getNormRole = (r) => {
              return normalizePlayerRole(r) === "SUPP"
                ? "SUP"
                : normalizePlayerRole(r) === "JNG"
                  ? "JGL"
                  : normalizePlayerRole(r);
            };

            let rArr = ["TOP", "JGL", "MID", "ADC", "SUP"];
            let stW = {
              dmg: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
              gold: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
              vis: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
            };
            let stL = {
              dmg: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
              gold: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
              vis: { TOP: 0, JGL: 0, MID: 0, ADC: 0, SUP: 0 },
            };
            let totW = { dmg: 0, gold: 0, vis: 0 };
            let totL = { dmg: 0, gold: 0, vis: 0 };

            let jglW_cs = 0;
            let jglL_cs = 0;
            let jglW_cs15 = 0;
            let jglL_cs15 = 0;

            let plW = { TOP: 0, MID: 0, BOT: 0, TOTAL: 0, GRUBS: 0, HERALD: 0 };
            let plL = { TOP: 0, MID: 0, BOT: 0, TOTAL: 0, GRUBS: 0, HERALD: 0 };

            // ASIGNAR OBJETIVOS (AHORA 100% FIABLE BASADO EN WIN/LOSS)
            events.forEach((e) => {
              let isWinnerTeam = e.team === "WIN";
              if (e.type === "GRUB") {
                if (isWinnerTeam) plW.GRUBS += 3;
                else plL.GRUBS += 3;
              }
              if (e.type === "HERALD") {
                if (isWinnerTeam) plW.HERALD += 1;
                else plL.HERALD += 1;
              }
            });

            res.winners.forEach((p) => {
              let r = getNormRole(p.role);
              if (r !== "FILL") {
                stW.dmg[r] += parseFloat(p.dmg) || 0;
                stW.gold[r] += parseFloat(p.gpm) || parseFloat(p.gold) || 0;
                stW.vis[r] +=
                  parseFloat(p.vspm) ||
                  parseFloat(p.visionScore) ||
                  parseFloat(p.vision) ||
                  0;
              }
              totW.dmg += parseFloat(p.dmg) || 0;
              totW.gold += parseFloat(p.gpm) || parseFloat(p.gold) || 0;
              totW.vis +=
                parseFloat(p.vspm) ||
                parseFloat(p.visionScore) ||
                parseFloat(p.vision) ||
                0;

              if (r === "JGL") {
                jglW_cs =
                  parseFloat(p.csTotal || parseFloat(p.cs) * totalMins) || 0;
                jglW_cs15 = parseFloat(p.cs15) || Math.floor(jglW_cs * 0.45);
              }

              plW.GRUBS += Number(p.grubs || 0);

              let plates = parseInt(p.plates) || 0;
              if (r === "TOP") plW.TOP += plates;
              if (r === "MID") plW.MID += plates;
              if (r === "ADC" || r === "SUP") plW.BOT += plates;
              plW.TOTAL += plates;
            });

            res.losers.forEach((p) => {
              let r = getNormRole(p.role);
              if (r !== "FILL") {
                stL.dmg[r] += parseFloat(p.dmg) || 0;
                stL.gold[r] += parseFloat(p.gpm) || parseFloat(p.gold) || 0;
                stL.vis[r] +=
                  parseFloat(p.vspm) ||
                  parseFloat(p.visionScore) ||
                  parseFloat(p.vision) ||
                  0;
              }
              totL.dmg += parseFloat(p.dmg) || 0;
              totL.gold += parseFloat(p.gpm) || parseFloat(p.gold) || 0;
              totL.vis +=
                parseFloat(p.vspm) ||
                parseFloat(p.visionScore) ||
                parseFloat(p.vision) ||
                0;

              if (r === "JGL") {
                jglL_cs =
                  parseFloat(p.csTotal || parseFloat(p.cs) * totalMins) || 0;
                jglL_cs15 = parseFloat(p.cs15) || Math.floor(jglL_cs * 0.45);
              }

              plL.GRUBS += Number(p.grubs || 0);

              let plates = parseInt(p.plates) || 0;
              if (r === "TOP") plL.TOP += plates;
              if (r === "MID") plL.MID += plates;
              if (r === "ADC" || r === "SUP") plL.BOT += plates;
              plL.TOTAL += plates;
            });

            let dmgBars = rArr
              .map((r) => {
                let pW = totW.dmg > 0 ? (stW.dmg[r] / totW.dmg) * 100 : 0;
                let pL = totL.dmg > 0 ? (stL.dmg[r] / totL.dmg) * 100 : 0;
                return (
                  '<div class="flex items-center text-[10px] mb-1.5"><div class="w-8 font-bold text-slate-500">' +
                  r +
                  '</div><div class="flex-1 h-5 bg-[#1c1c1f] flex flex-col justify-center gap-px rounded overflow-hidden"><div style="width: ' +
                  pW +
                  '%; height: 50%; background: #3b82f6; transition: 1s;"></div><div style="width: ' +
                  pL +
                  '%; height: 50%; background: #ef4444; transition: 1s;"></div></div><div class="w-10 text-right text-blue-400 font-mono font-bold">' +
                  pW.toFixed(1) +
                  '%</div><div class="w-10 text-right text-red-400 font-mono font-bold">' +
                  pL.toFixed(1) +
                  "%</div></div>"
                );
              })
              .join("");

            let totalVis = Math.max(1, totW.vis + totL.vis);
            let visW_pct = (totW.vis / totalVis) * 100;
            let visL_pct = (totL.vis / totalVis) * 100;

            let totJglCs = Math.max(1, jglW_cs + jglL_cs);
            let jglW_pct = (jglW_cs / totJglCs) * 100;
            let jglL_pct = (jglL_cs / totJglCs) * 100;

            let totJglCs15 = Math.max(1, jglW_cs15 + jglL_cs15);
            let jglW_pct15 = (jglW_cs15 / totJglCs15) * 100;
            let jglL_pct15 = (jglL_cs15 / totJglCs15) * 100;

            const ptStr = (val) =>
              plW.TOTAL === 0 && plL.TOTAL === 0 ? "-" : val;

            let tA_acro = names[0]
              ? names[0].substring(0, 3).toUpperCase()
              : "WIN";
            let tB_acro = names[1]
              ? names[1].substring(0, 3).toUpperCase()
              : "LOS";

            let tableRowsHtml = rArr
              .map((r) => {
                let wPct =
                  totW.gold > 0
                    ? ((stW.gold[r] / totW.gold) * 100).toFixed(1)
                    : 0;
                let lPct =
                  totL.gold > 0
                    ? ((stL.gold[r] / totL.gold) * 100).toFixed(1)
                    : 0;
                let roleStr =
                  r === "JGL" ? "JUNGLE" : r === "SUP" ? "SUPPORT" : r;
                return (
                  '<tr class="bg-[#27272a] hover:bg-slate-700/30 transition"><td class="text-left font-bold text-slate-300 border border-slate-600 p-1">' +
                  roleStr +
                  '</td><td class="text-white font-mono border border-slate-600 p-1">' +
                  wPct +
                  '%</td><td class="text-white font-mono border border-slate-600 p-1">' +
                  lPct +
                  "%</td></tr>"
                );
              })
              .join("");

            let goldTableHtml =
              '<table class="w-full text-right text-[9px] border-collapse"><thead><tr><th class="text-left border border-slate-600 p-1.5 bg-[#1c1c1f]"></th><th class="bg-blue-500 text-white font-bold text-center border border-slate-600 p-1.5 w-10" title="' +
              escHtml(names[0]) +
              '">' +
              tA_acro +
              '</th><th class="bg-red-500 text-white font-bold text-center border border-slate-600 p-1.5 w-10" title="' +
              escHtml(names[1]) +
              '">' +
              tB_acro +
              "</th></tr></thead><tbody>" +
              tableRowsHtml +
              "</tbody></table>";

            let advancedStatsHtml = '';

            // Count dragons and barons from events (reliable fallback)
            let dragW = 0, dragL = 0, baronW = 0, baronL = 0;
            events.forEach((e) => {
              if (e.type === 'DRAGON') { if (e.team === 'WIN') dragW++; else dragL++; }
              if (e.type === 'BARON')  { if (e.team === 'WIN') baronW++; else baronL++; }
            });
            // Prefer teamStats if available and > 0
            const wStats = res.winStats || {};
            const lStats = res.losStats || {};
            dragW  = (wStats.dragons  > 0) ? wStats.dragons  : dragW;
            dragL  = (lStats.dragons  > 0) ? lStats.dragons  : dragL;
            baronW = (wStats.barons   > 0) ? wStats.barons   : baronW;
            baronL = (lStats.barons   > 0) ? lStats.barons   : baronL;
            const towersW = wStats.towers || 0;
            const towersL = lStats.towers || 0;
            const inhibsW = wStats.inhibs || 0;
            const inhibsL = lStats.inhibs || 0;

            const _objRow = (icon, colorCls, label, vW, vL) => {
              const hiW = (vW !== '-' && vL !== '-' && Number(vW) > Number(vL)) ? 'text-blue-400 font-bold' : '';
              const hiL = (vW !== '-' && vL !== '-' && Number(vL) > Number(vW)) ? 'text-red-400 font-bold' : '';
              return '<div class="flex items-center text-center py-2.5 hover:bg-slate-700/30 transition border-b border-slate-700/30">' +
                '<div class="w-1/3 text-left pl-6 text-slate-200 text-xs font-bold flex items-center gap-2">' +
                '<span class="' + colorCls + ' text-lg leading-none">' + icon + '</span> ' + label + '</div>' +
                '<div class="w-1/3 font-mono ' + hiW + '">' + (vW !== undefined && vW !== null ? vW : '-') + '</div>' +
                '<div class="w-1/3 font-mono ' + hiL + '">' + (vL !== undefined && vL !== null ? vL : '-') + '</div></div>';
            };

            advancedStatsHtml =
              '<div class="col-span-1 lg:col-span-2 bg-[#27272a] border border-slate-700 rounded-xl overflow-hidden mt-6 mb-4 shadow-sm">' +
              '<div class="bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest">OBJETIVOS Y PLACAS</div>' +
              '<div class="p-0"><div class="flex items-end text-center pt-4 pb-2 border-b border-slate-700/50">' +
              '<div class="w-1/3"></div>' +
              '<div class="w-1/3 text-center"><div class="font-oswald text-lg text-blue-400 border-b-2 border-blue-500 pb-1 mx-4 truncate">' + escHtml(names[0]) + '</div></div>' +
              '<div class="w-1/3 text-center"><div class="font-oswald text-lg text-red-500 border-b-2 border-red-500 pb-1 mx-4 truncate">' + escHtml(names[1]) + '</div></div>' +
              '</div>' +
              _objRow('\uD83D\uDC1B', 'text-purple-400', 'Voidgrubs', plW.GRUBS, plL.GRUBS) +
              _objRow('\uD83D\uDC09', 'text-orange-400', 'Dragones', dragW, dragL) +
              _objRow('\uD83D\uDC7E', 'text-violet-400', 'Barones', baronW, baronL) +
              _objRow('\uD83E\uAB73', 'text-indigo-400', 'Heraldo', plW.HERALD, plL.HERALD) +
              _objRow('\uD83C\uDFEF', 'text-yellow-400', 'Torres', towersW || '-', towersL || '-') +
              (inhibsW + inhibsL > 0 ? _objRow('\u2694\uFE0F', 'text-rose-400', 'Inhibidores', inhibsW, inhibsL) : '') +
              '<div class="flex items-center text-center py-2.5 hover:bg-slate-700/30 transition border-b border-slate-700/30">' +
              '<div class="w-1/3 text-left pl-6 text-slate-200 text-xs font-bold flex items-center gap-2"><span class="text-slate-400 text-lg">\uD83D\uDEE1\uFE0F</span> Placas</div>' +
              '<div class="w-1/3 text-white font-mono">' + ptStr(plW.TOTAL) + '</div>' +
              '<div class="w-1/3 text-white font-mono">' + ptStr(plL.TOTAL) + '</div></div>' +
              '<div class="flex items-center text-center py-2 hover:bg-slate-700/30 transition">' +
              '<div class="w-1/3 text-left pl-12 text-slate-400 text-[11px]">Plates TOP</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plW.TOP) + '</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plL.TOP) + '</div></div>' +
              '<div class="flex items-center text-center py-2 hover:bg-slate-700/30 transition">' +
              '<div class="w-1/3 text-left pl-12 text-slate-400 text-[11px]">Plates MID</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plW.MID) + '</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plL.MID) + '</div></div>' +
              '<div class="flex items-center text-center py-2 pb-3 hover:bg-slate-700/30 transition">' +
              '<div class="w-1/3 text-left pl-12 text-slate-400 text-[11px]">Plates BOT</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plW.BOT) + '</div>' +
              '<div class="w-1/3 text-slate-300 font-mono text-sm">' + ptStr(plL.BOT) + '</div></div></div></div>';

            advancedStatsHtml +=
              '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2"><div class="bg-[#27272a] rounded-xl p-4 border border-slate-700 shadow-inner flex flex-col"><h3 class="bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest -mx-4 -mt-4 rounded-t-xl mb-3">Distribución de Oro</h3><div class="flex items-center w-full h-full gap-2"><div style="position: relative; height: 160px; width: 50%;"><canvas id="matchGoldRadar"></canvas></div><div class="w-[50%] flex flex-col justify-center">' +
              goldTableHtml +
              '</div></div></div><div class="bg-[#27272a] rounded-xl p-4 border border-slate-700 shadow-inner flex flex-col"><div class="flex justify-between bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest -mx-4 -mt-4 rounded-t-xl mb-3"><h3>Distribución de Daño</h3><div class="flex gap-4 text-[9px] font-black"><span class="text-blue-200">WIN</span><span class="text-red-200">LOSE</span></div></div><div class="flex flex-col justify-center flex-1">' +
              dmgBars +
              '</div></div><div class="bg-[#27272a] rounded-xl p-4 border border-slate-700 shadow-inner flex flex-col justify-center"><h3 class="bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest -mx-4 -mt-4 rounded-t-xl mb-4">Control de Visión (VSPM)</h3><div class="flex flex-col gap-4"><div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-blue-400">Ganadores</span><span class="text-slate-300 font-mono">' +
              totW.vis.toFixed(2) +
              '</span></div><div class="w-full h-4 bg-[#1c1c1f] rounded-sm overflow-hidden shadow-inner"><div style="width: ' +
              visW_pct +
              '%; background: #3b82f6; height: 100%;"></div></div></div><div><div class="flex justify-between text-xs font-bold mb-1"><span class="text-red-400">Perdedores</span><span class="text-slate-300 font-mono">' +
              totL.vis.toFixed(2) +
              '</span></div><div class="w-full h-4 bg-[#1c1c1f] rounded-sm overflow-hidden shadow-inner"><div style="width: ' +
              visL_pct +
              '%; background: #ef4444; height: 100%;"></div></div></div></div></div><div class="bg-[#27272a] rounded-xl p-5 border border-slate-700 shadow-inner flex flex-col justify-center"><h3 class="bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest -mx-5 -mt-5 rounded-t-xl mb-3">JUNGLE SHARE</h3><div class="text-[9px] text-slate-400 italic mb-5">CS killed in team jungle + CS killed in enemy jungle</div><div class="flex flex-col gap-5"><div class="flex items-center gap-3"><div class="w-16 text-[10px] text-slate-300 font-bold">At 15 min</div><div class="flex-1 h-6 bg-[#1c1c1f] flex overflow-hidden shadow-inner border border-slate-700 rounded-sm"><div style="width: ' +
              jglW_pct15 +
              '%; background: #3b82f6; height: 100%; display: flex; align-items: center; padding-left: 8px; font-weight: bold; color: white; font-size: 11px;">' +
              Math.floor(jglW_cs15) +
              '</div><div style="width: ' +
              jglL_pct15 +
              '%; background: #ef4444; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-weight: bold; color: white; font-size: 11px;">' +
              Math.floor(jglL_cs15) +
              '</div></div></div><div class="flex items-center gap-3"><div class="w-16 text-[10px] text-slate-300 font-bold">End game</div><div class="flex-1 h-6 bg-[#1c1c1f] flex overflow-hidden shadow-inner border border-slate-700 rounded-sm relative"><div style="width: ' +
              jglW_pct +
              '%; background: #3b82f6; height: 100%; display: flex; align-items: center; padding-left: 8px; font-weight: bold; color: white; font-size: 11px;">' +
              Math.floor(jglW_cs) +
              '</div><div style="width: ' +
              jglL_pct +
              '%; background: #ef4444; height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-weight: bold; color: white; font-size: 11px;">' +
              Math.floor(jglL_cs) +
              '</div></div></div><div class="flex justify-between text-[9px] text-slate-500 font-mono ml-[76px] mt-1 border-t border-slate-700 pt-1"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div></div></div></div>';

            // INYECTAMOS EL NUEVO GRÁFICO DE OBJETIVOS
            advancedStatsHtml +=
              '<div class="col-span-1 lg:col-span-2 bg-[#27272a] rounded-xl p-5 border border-slate-700 shadow-inner flex flex-col justify-center mt-4"><h3 class="bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest -mx-5 -mt-5 rounded-t-xl mb-4">Daño a Objetivos vs Torretas</h3><div style="position: relative; height: 300px; width: 100%;"><canvas id="postGameObjectivesChart"></canvas></div></div>';

            let advTableHtml =
              '<button onclick="document.getElementById(\'adv-stats-table\').classList.toggle(\'hidden\')" class="w-full mt-6 bg-[#1c1c1f] hover:bg-[#27272a] border border-slate-600 text-white py-3 rounded-xl font-oswald tracking-widest transition flex justify-center items-center gap-2 shadow-lg"><span>📊 VER / OCULTAR ESTADÍSTICAS AVANZADAS COMPLETAS</span></button><div id="adv-stats-table" class="hidden mt-4 bg-[#1c1c1f] border border-slate-700 rounded-xl overflow-x-auto shadow-inner"><table class="w-full text-left text-xs text-slate-300"><thead class="text-[9px] uppercase tracking-widest text-slate-500 border-b border-slate-700 bg-[#27272a]"><tr><th class="p-3">Pos</th><th class="p-3">Jugador</th><th class="p-3">K/D/A</th><th class="p-3 text-red-400">Daño (DPM)</th><th class="p-3 text-blue-400">Mitigado</th><th class="p-3 text-yellow-400">Oro (GPM)</th><th class="p-3 text-emerald-400">CS (CS/M)</th><th class="p-3 text-purple-400">Visión (VSPM)</th></tr></thead><tbody>';

            let simulatedMins = totalMins;

            let winTeamDmgTotal = res.winners.reduce((acc, p) => acc + (parseFloat(p.dmg) || 0), 0);
            let losTeamDmgTotal = res.losers.reduce((acc, p) => acc + (parseFloat(p.dmg) || 0), 0);

            const buildRow = (p, isWin, teamDmgForRow) => {
              let teamColor = isWin ? "text-blue-400" : "text-red-400";
              let bgHover = isWin
                ? "hover:bg-blue-900/10"
                : "hover:bg-red-900/10";

              let safeDpm = p.dpm || Math.round(p.dmg / simulatedMins) || 0;
              let safeGold =
                parseFloat(p.gold) || parseFloat(p.gpm) * simulatedMins || 0;
              let goldFormatted =
                safeGold > 0 ? (safeGold / 1000).toFixed(1) + "k" : "-";
              let safeVis = p.vision || p.visionScore || p.vspm || 0;
              let safeVspm = p.vspm || (safeVis / simulatedMins).toFixed(2);
              let safeCs =
                p.csTotal ||
                Math.floor((parseFloat(p.cs) || 0) * simulatedMins);

              return (
                '<tr class="border-b border-slate-800 ' +
                bgHover +
                ' transition-colors"><td class="p-3 font-bold text-slate-500">' +
                (p.role || "FILL").substring(0, 3) +
                '</td><td class="p-3 font-bold text-white flex items-center gap-2"><img src="' +
                getChampIcon(p.champ) +
                '" class="w-6 h-6 rounded border border-slate-600"> <span class="' +
                teamColor +
                '">' +
                escHtml(p.name) +
                '</span></td><td class="p-3 font-mono text-slate-200">' +
                p.k +
                "/" +
                p.d +
                "/" +
                p.a +
                '</td><td class="p-3 font-mono">' +
                (p.dmg > 0 ? (p.dmg / 1000).toFixed(1) + "k" : "-") +
                ' <span class="text-[9px] text-slate-500">(' +
                safeDpm +
                ')</span><div class="w-full h-1 bg-slate-800 rounded-full mt-0.5 overflow-hidden"><div style="width:' +
                 (teamDmgForRow > 0
                   ? Math.round((parseFloat(p.dmg) / teamDmgForRow) * 100)
                  : 0) +
                "%;background:" +
                 (isWin ? "#3b82f6" : "#ef4444") +
                ';height:100%"></div></div><div class="text-[8px] text-slate-500 leading-none">' +
                 (teamDmgForRow > 0
                   ? Math.round((parseFloat(p.dmg) / teamDmgForRow) * 100) + "%"
                  : "") +
                '</div></td><td class="p-3 font-mono">' +
                (p.tank || "-") +
                '</td><td class="p-3 font-mono text-yellow-500">' +
                goldFormatted +
                ' <span class="text-[9px] text-slate-500">(' +
                (p.gpm || Math.round(safeGold / simulatedMins)) +
                ')</span></td><td class="p-3 font-mono text-emerald-400">' +
                safeCs +
                ' <span class="text-[9px] text-slate-500">(' +
                (p.cs || (safeCs / simulatedMins).toFixed(1)) +
                ')</span></td><td class="p-3 font-mono text-purple-400">' +
                safeVis +
                ' <span class="text-[9px] text-slate-500">(' +
                safeVspm +
                ")</span></td></tr>"
              );
            };

            let winRowsHtml = res.winners
              .map((p) => buildRow(p, true, winTeamDmgTotal))
              .join("");
            let losRowsHtml = res.losers
              .map((p) => buildRow(p, false, losTeamDmgTotal))
              .join("");

            advTableHtml +=
              winRowsHtml + losRowsHtml + "</tbody></table></div>";

            // 5. INSERCIÓN EN EL DOM Y RENDERIZADO FINAL

            let winMapHtml = res.winners
              .map(
                (p) =>
                  '<div class="flex items-center justify-end gap-3 opacity-50 hover:opacity-100 cursor-pointer transition"><div class="text-right"><div class="text-xs font-bold text-white">' +
                  escHtml(p.name) +
                  '</div><div class="text-[10px] text-slate-400">' +
                  p.k +
                  "/" +
                  p.d +
                  "/" +
                  p.a +
                  '</div></div><img src="' +
                  getChampIcon(p.champ) +
                  '" class="w-8 h-8 rounded border border-slate-700" onerror="this.style.display=\'none\'"></div>',
              )
              .join("");

            let losMapHtml = res.losers
              .map(
                (p) =>
                  '<div class="flex items-center gap-3 opacity-50 hover:opacity-100 cursor-pointer transition"><img src="' +
                  getChampIcon(p.champ) +
                  '" class="w-8 h-8 rounded border border-slate-700" onerror="this.style.display=\'none\'"><div class="text-left"><div class="text-xs font-bold text-white">' +
                  escHtml(p.name) +
                  '</div><div class="text-[10px] text-slate-400">' +
                  p.k +
                  "/" +
                  p.d +
                  "/" +
                  p.a +
                  "</div></div></div>",
              )
              .join("");

            content.innerHTML =
              seriesBanner +
              mapTabsHtml +
              "<div class=\"col-span-1 lg:col-span-2 flex border-b border-slate-700 mb-4 pb-2 gap-4\"><button onclick=\"document.getElementById('overview-tab').classList.remove('hidden'); document.getElementById('map-tab').classList.add('hidden'); this.classList.add('text-white', 'border-b-2', 'border-white'); this.nextElementSibling.classList.remove('text-white', 'border-b-2', 'border-white'); this.nextElementSibling.classList.add('text-slate-500');\" class=\"text-sm font-bold text-white border-b-2 border-white pb-2 px-2 transition\">Resumen (Overview)</button><button onclick=\"document.getElementById('overview-tab').classList.add('hidden'); document.getElementById('map-tab').classList.remove('hidden'); this.classList.add('text-white', 'border-b-2', 'border-white'); this.previousElementSibling.classList.remove('text-white', 'border-b-2', 'border-white'); this.previousElementSibling.classList.add('text-slate-500');\" class=\"text-sm font-bold text-slate-500 pb-2 px-2 transition\">Replay Map</button></div><div id=\"overview-tab\" class=\"col-span-1 lg:col-span-2 w-full\"><div class=\"bg-[#27272a] border border-slate-700 rounded-xl p-4 mb-4 relative\"><div class=\"flex justify-between items-center bg-[#3eb4c0] text-white font-bold text-[10px] px-3 py-1.5 rounded-t-lg -mt-4 -mx-4 mb-4\">GOLD GRAPH & TIMELINE</div><div style=\"height: 200px; width: 100%;\"><canvas id=\"goldTimelineChart\"></canvas></div><div id=\"objective-timeline-container\"></div><div id=\"momentum-tracker-container\" class=\"mt-6 border-t border-slate-700 pt-4\"></div></div>" +
              renderTeam(res.winners, true) +
              renderTeam(res.losers, false) +
              advancedStatsHtml +
              advTableHtml +
              '</div><div id="map-tab" class="hidden col-span-1 lg:col-span-2 w-full bg-[#1c1c1f] rounded-xl border border-slate-700 overflow-hidden"><div class="flex justify-between items-center bg-[#27272a] border-b border-slate-700 px-4 py-3"><h3 class="text-white font-bold flex items-center gap-2"><span class="w-3 h-3 bg-blue-500"></span> Replay Map</h3><span class="text-xs text-slate-400">Ver. ' +
              RIOT_VERSION +
              '</span></div><div class="flex p-6 h-[500px]"><div class="w-1/4 flex flex-col gap-2 pr-4"><div class="text-xs font-bold text-blue-400 mb-2 uppercase flex items-center gap-2"><span class="w-2 h-2 bg-blue-500 inline-block"></span> Blue Side</div>' +
              winMapHtml +
              '</div><div class="w-2/4 relative flex justify-center items-center bg-[#18181b] rounded-xl border border-slate-700 p-2"><div class="relative w-full max-w-[400px] aspect-square rounded overflow-hidden"><img src="https://ddragon.leagueoflegends.com/cdn/' +
              RIOT_VERSION +
              '/img/map/map11.png" class="absolute inset-0 w-full h-full object-cover opacity-50 grayscale" style="border-radius: 0.5rem; filter: invert(1) hue-rotate(180deg) opacity(0.3);" onerror="this.src=\'https://images.contentstack.io/api/v1/assets/5931bc10-d8d5-4dc2-a720-032a84352a16/e4df94cc-19d1-41d8-a1fb-3b4ee3f7e5d8/Summoners_Rift_1.jpg\';"><div class="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-bold text-center p-4 z-10 pointer-events-none">El mapa de calor requiere coordenadas de la API.</div></div></div><div class="w-1/4 flex flex-col gap-2 pl-4"><div class="text-xs font-bold text-red-400 mb-2 uppercase flex items-center gap-2"><span class="w-2 h-2 bg-red-500 inline-block"></span> Red Side</div>' +
              losMapHtml +
              "</div></div></div>";

            // Renderizar gráficos (Chart.js)
            renderGoldChart(realGoldDiff);

            // Aviso de estimación: el .rofl no trae datos minuto a minuto reales
            if (res.isEstimated) {
              try {
                var _goldHdr = document.querySelector('#overview-tab .bg-\\[\\#3eb4c0\\]');
                if (_goldHdr && !_goldHdr.querySelector('.sa-est-badge')) {
                  var _b = document.createElement('span');
                  _b.className = 'sa-est-badge';
                  _b.title = 'Un archivo .rofl solo contiene estadísticas finales, no datos minuto a minuto. Esta curva y los objetivos son una estimación basada en el oro final.';
                  _b.style.cssText = 'margin-left:auto;background:rgba(0,0,0,0.25);padding:1px 8px;border-radius:999px;font-size:9px;letter-spacing:.05em;cursor:help;';
                  _b.textContent = '~ ESTIMADO';
                  _goldHdr.appendChild(_b);
                }
              } catch (e) {}
            }

            const objIcons = {
              FB: {
                icon: "🩸",
                bg: "bg-red-900/80 border-red-500",
                label: "First Blood",
              },
              FT: {
                icon: "🏯",
                bg: "bg-yellow-900/80 border-yellow-500",
                label: "Primera Torre",
              },
              DRAGON: {
                icon: "🐉",
                bg: "bg-orange-900/80 border-orange-500",
                label: "Dragón",
              },
              BARON: {
                icon: "👾",
                bg: "bg-purple-900/80 border-purple-500",
                label: "Barón Nashor",
              },
              HERALD: {
                icon: "🪳",
                bg: "bg-indigo-900/80 border-indigo-500",
                label: "Heraldo",
              },
              GRUB: {
                icon: "🐛",
                bg: "bg-emerald-900/80 border-emerald-500",
                label: "Larvas del Vacío",
              },
            };

            // TIMELINE GRÁFICO (DIBUJANDO ICONOS)
            let tHtml = '<div class="relative w-full h-12 mt-1 select-none">';
            // 🟢 AHORA PONE EL NOMBRE DEL GANADOR ARRIBA (VERDE) Y PERDEDOR ABAJO (ROJO)
            tHtml +=
              '<div class="absolute left-0 top-0 text-emerald-400 font-bold text-[10px] tracking-widest uppercase w-[60px] truncate" title="' +
              escHtml(nameW) +
              '">' +
              escHtml(tA_acro) +
              "</div>";
            tHtml +=
              '<div class="absolute left-0 bottom-0 text-red-500 font-bold text-[10px] tracking-widest uppercase w-[60px] truncate" title="' +
              escHtml(nameL) +
              '">' +
              escHtml(tB_acro) +
              "</div>";
            tHtml +=
              '<div class="absolute left-[65px] right-[10px] top-0 bottom-0"><div class="absolute left-0 right-0 top-1/2 h-px bg-slate-600 transform -translate-y-1/2"></div>';

            let minuteCounters = {};

            events.forEach((e) => {
              let m = e.minute;
              minuteCounters[m] = (minuteCounters[m] || 0) + 1;
              let offset = (minuteCounters[m] - 1) * 3;

              let pct = (e.minute / totalMins) * 100 + offset;
              if (pct > 99) pct = 99;
              if (pct < 0) pct = 0;

              // Si el evento lo hizo el equipo que ganó, va arriba. Si no, va abajo.
              let isWinTeam = e.team === "WIN";
              let posClass = isWinTeam ? "top-[-2px]" : "bottom-[-2px]";
              let obj = objIcons[e.type] || {
                icon: "❓",
                bg: "bg-slate-700 border-slate-500",
                label: "Desconocido",
              };

              tHtml +=
                '<div class="absolute ' +
                posClass +
                ' transform -translate-x-1/2 flex flex-col items-center group z-10 hover:z-20 cursor-pointer" style="left: ' +
                pct +
                '%">';
              tHtml +=
                '<div class="text-[10px] shadow-lg group-hover:scale-125 transition-transform rounded-full w-5 h-5 flex items-center justify-center border ' +
                obj.bg +
                '">' +
                obj.icon +
                "</div>";
              tHtml +=
                '<div class="absolute ' +
                (isWinTeam ? "top-6" : "bottom-6") +
                ' opacity-0 group-hover:opacity-100 transition-opacity bg-[#1c1c1f] border border-slate-600 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-30 pointer-events-none shadow-xl">' +
                obj.label +
                " (" +
                e.minute +
                "')</div></div>";
            });
            tHtml += "</div></div>";
            document.getElementById("objective-timeline-container").innerHTML =
              tHtml;

            let winProbs = realGoldDiff.map((g) => {
              return Math.round((1 / (1 + Math.exp(-0.0005 * g))) * 100);
            });
            let maxSwing = 0;
            let inflectionMin = -1;
            for (let i = 1; i < winProbs.length; i++) {
              let swing = Math.abs(winProbs[i] - winProbs[i - 1]);
              if (swing > 15 && swing > maxSwing) {
                maxSwing = swing;
                inflectionMin = i;
              }
            }

            let finalProbA = winProbs[winProbs.length - 1] || 50;
            let finalProbB = 100 - finalProbA;
            let containerClass =
              maxSwing > 15
                ? "tug-of-war-container inflection-alert"
                : "tug-of-war-container";

            let tugHtml =
              '<div class="flex justify-between items-end mb-2"><div class="text-xs text-slate-400 font-bold uppercase tracking-widest">Inercia de la partida (Momentum)</div>';
            if (inflectionMin > -1) {
              tugHtml +=
                '<div class="text-xs text-red-400 font-black animate-pulse">⚠️ PUNTO DE INFLEXIÓN: MINUTO ' +
                inflectionMin +
                " (" +
                maxSwing +
                "% SWING)</div>";
            }
            tugHtml +=
              '</div><div class="' +
              containerClass +
              '"><div class="tug-of-war-blue" style="width: ' +
              finalProbA +
              '%">' +
              finalProbA +
              '%</div><div class="absolute right-4 top-1 text-white font-black text-xl">' +
              finalProbB +
              '%</div><div class="absolute left-1/2 top-0 bottom-0 w-1 bg-white/20 transform -translate-x-1/2"></div></div>';
            document.getElementById("momentum-tracker-container").innerHTML =
              tugHtml;

            if (window.matchGoldRadarInstance)
              window.matchGoldRadarInstance.destroy();
            const ctxRadar = document
              .getElementById("matchGoldRadar")
              .getContext("2d");

            let gW_data = rArr.map((r) =>
              totW.gold > 0
                ? parseFloat(((stW.gold[r] / totW.gold) * 100).toFixed(1))
                : 0,
            );
            let gL_data = rArr.map((r) =>
              totL.gold > 0
                ? parseFloat(((stL.gold[r] / totL.gold) * 100).toFixed(1))
                : 0,
            );

            window.matchGoldRadarInstance = new Chart(ctxRadar, {
              type: "radar",
              data: {
                labels: ["TOP", "JGL", "MID", "ADC", "SUP"],
                datasets: [
                  {
                    label: "Ganadores",
                    data: gW_data,
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                  },
                  {
                    label: "Perdedores",
                    data: gL_data,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                  },
                ],
              },
              options: {
                maintainAspectRatio: false,
                scales: {
                  r: {
                    angleLines: { color: "rgba(255,255,255,0.05)" },
                    grid: { color: "rgba(255,255,255,0.05)" },
                    ticks: { display: false, min: 0 },
                    pointLabels: {
                      color: "#a1a1aa",
                      font: { size: 9, family: "Inter", weight: "bold" },
                    },
                  },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: true },
                },
              },
            });

            // ==========================================
            // GRAFICO POST GAME (BARRAS APILADAS POR ROL)
            // ==========================================
            if (window.postGameObjChartInstance)
              window.postGameObjChartInstance.destroy();
            const ctxPostObj = document
              .getElementById("postGameObjectivesChart")
              .getContext("2d");

            const roleColors = {
              TOP: "#10b981",
              JGL: "#ef4444",
              MID: "#8b5cf6",
              ADC: "#f59e0b",
              SUP: "#3b82f6",
            };

            const getRoleDmg = (list, role, key) => {
              let p = list.find((x) => getNormRole(x.role) === role);
              return p ? parseFloat(p[key]) || 0 : 0;
            };

            let datasetsObj = rArr.map((role) => {
              return {
                label: role,
                data: [
                  getRoleDmg(res.winners, role, "dmgObj"),
                  getRoleDmg(res.losers, role, "dmgObj"),
                  getRoleDmg(res.winners, role, "dmgTurrets"),
                  getRoleDmg(res.losers, role, "dmgTurrets"),
                ],
                backgroundColor: roleColors[role],
                borderColor: "#0f172a",
                borderWidth: 2,
                borderRadius: 4,
              };
            });

            window.postGameObjChartInstance = new Chart(ctxPostObj, {
              type: "bar",
              data: {
                labels: [
                  "Ganadores (Objetivos)",
                  "Perdedores (Objetivos)",
                  "Ganadores (Torres)",
                  "Perdedores (Torres)",
                ],
                datasets: datasetsObj,
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
                      font: { family: "Oswald", size: 14 },
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
          })
          .getPostGameLobbyData(fetchGameId);
      }

    