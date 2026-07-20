
      function normalizePlayerRole(role) {
        if (!role) return "";
        const up = String(role).trim().toUpperCase();
        return ROLE_CANON[up] || up;
      }

      function isBracketPlaceholderName(name) {
        if (!name) return true;
        const n = String(name).trim();
        if (!n || n === "TBD") return true;
        return /^(ganador|perdedor|superviviente|seed\s)/i.test(n);
      }

      /** Mejor jugador por rol (mayor PTS) para el quinteto ideal */
      function buildIdealQuintet(players) {
        const out = {};
        if (!players || !players.length) return out;

        // Agrupar players por rol canónico (acepta todos los formatos)
        const roleGroups = {};
        players.forEach(function (p) {
          const canon = normalizePlayerRole(p.role);
          if (!QUINTETO_ROLES.includes(canon)) return;
          if (!roleGroups[canon]) roleGroups[canon] = [];
          roleGroups[canon].push(p);
        });

        QUINTETO_ROLES.forEach(function (role) {
          const pool = roleGroups[role];
          if (!pool || !pool.length) return;
          // El mejor es el de mayor puntuación media
          out[role] = pool.sort(function (a, b) {
            return (parseFloat(b.points) || 0) - (parseFloat(a.points) || 0);
          })[0];
        });
        return out;
      }

      /** Separa 10 jugadores en dos equipos de 5 (win/loss o teamId 100/200) */
      function splitPlayersIntoTeams(players) {
        const winners = players.filter(function (p) {
          return (
            p.win === true ||
            p.win === "true" ||
            String(p.result || "")
              .toLowerCase()
              .includes("win")
          );
        });
        const losers = players.filter(function (p) {
          return winners.indexOf(p) === -1;
        });
        if (winners.length === 5 && losers.length === 5)
          return { team1: winners, team2: losers };

        const t100 = players.filter(function (p) {
          return Number(p.teamId) === 100;
        });
        const t200 = players.filter(function (p) {
          return Number(p.teamId) === 200;
        });
        if (t100.length === 5 && t200.length === 5) {
          const k100 = t100.reduce(function (a, p) {
            return a + (p.k || 0);
          }, 0);
          const k200 = t200.reduce(function (a, p) {
            return a + (p.k || 0);
          }, 0);
          if (k100 >= k200) return { team1: t100, team2: t200 };
          return { team1: t200, team2: t100 };
        }
        return {
          team1: winners.length ? winners : players.slice(0, 5),
          team2: losers.length ? losers : players.slice(5, 10),
        };
      }

      let RIOT_VERSION = "15.4.1";
      (function () {
        let cached = localStorage.getItem("ddragon_v");
        let cachedTime = parseInt(localStorage.getItem("ddragon_t") || "0");
        if (cached && Date.now() - cachedTime < 86400000) {
          RIOT_VERSION = cached;
          return;
        }
        fetch("https://ddragon.leagueoflegends.com/api/versions.json")
          .then((res) => res.json())
          .then((data) => {
            if (data && data[0]) {
              RIOT_VERSION = data[0];
              localStorage.setItem("ddragon_v", data[0]);
              localStorage.setItem("ddragon_t", String(Date.now()));
            }
          })
          .catch((e) => console.log("Error cargando versión", e));
      })();

      function formatChampName(c) {
        if (!c || c === "undefined") return "";
        let n = String(c).replace(/[^a-zA-Z0-9]/g, "");
        let low = n.toLowerCase();

        const map = {
          wukong: "MonkeyKing",
          renataglasc: "Renata",
          nunuwillump: "Nunu",
          nunu: "Nunu",
          fiddlesticks: "Fiddlesticks",
          kogmaw: "KogMaw",
          ksante: "KSante",
          drmundo: "DrMundo",
          jarvaniv: "JarvanIV",
          leesin: "LeeSin",
          masteryi: "MasterYi",
          tahmkench: "TahmKench",
          xinzhao: "XinZhao",
          aurelionsol: "AurelionSol",
          reksai: "RekSai",
          missfortune: "MissFortune",
          twistedfate: "TwistedFate",
          xayah: "Xayah",
          belveth: "Belveth",
          leblanc: "Leblanc",
        };

        if (map[low]) return map[low];
        return n.charAt(0).toUpperCase() + n.slice(1);
      }

      function getChampIcon(c) {
        return (
          "https://ddragon.leagueoflegends.com/cdn/" +
          RIOT_VERSION +
          "/img/champion/" +
          formatChampName(c) +
          ".png"
        );
      }

      function getChampSplash(c) {
        return (
          "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/" +
          formatChampName(c) +
          "_0.jpg"
        );
      }

      window.lastPostGameData = null;
      window.lastPostGameMatchId = null;
      window.lastPostGameSearchId = null;
      window.matchPositions = {};

      const enc = function (str) {
        return btoa(encodeURIComponent(str || ""));
      };
      const dec = function (str) {
        return decodeURIComponent(atob(str || ""));
      };
      const escHtml = function (str) {
        return String(str || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      };

      const getLogo = function (url) {
        return url && url !== "undefined" && url.trim() !== ""
          ? url
          : "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/logos/tier2-1.png";
      };

      function generarHistorialForma(resultados, rachaActualObj) {
        let html = '<div class="historial-forma flex items-center gap-1.5">';
        resultados.forEach((res) => {
          if (res === "V") {
            html +=
              '<span class="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)] border border-emerald-400/20" title="Victoria"></span>';
          } else {
            html +=
              '<span class="w-4 h-4 rounded-full bg-red-500/80 shadow-[0_0_6px_rgba(239,68,68,0.2)] border border-red-400/10" title="Derrota"></span>';
          }
        });
        for (let i = resultados.length; i < 5; i++) {
          html +=
            '<span class="w-4 h-4 rounded-full bg-slate-700/20 border border-slate-600/10"></span>';
        }
        if (rachaActualObj > 0) {
          if (rachaActualObj >= 5) {
            html +=
              '<span class="ml-2 text-xl drop-shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-bounce" title="' +
              rachaActualObj +
              'V seguidas - IMPARABLE">🚀</span>';
          } else if (rachaActualObj >= 3) {
            html +=
              '<span class="ml-2 text-xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" title="' +
              rachaActualObj +
              'V seguidas">🔥</span>';
          }
        } else if (rachaActualObj < 0) {
          let p = Math.abs(rachaActualObj);
          if (p >= 5) {
            html +=
              '<span class="ml-2 text-xl drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] animate-pulse" title="' +
              p +
              'D seguidas - CRÍTICO">💀</span>';
          } else if (p >= 3) {
            html +=
              '<span class="ml-2 text-xl drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]" title="' +
              p +
              'D seguidas">🧊</span>';
          }
        }
        return html + "</div>";
      }

      // (window.onload consolidado más abajo — ver loadWalletBalance)

      // LOGIN MODO LIGA NORMAL Y ADMIN
      function loginAs(role) {
        if (role === "admin") {
          let pass = prompt("ADMIN_SYS: Inserte clave de acceso:");
          if (pass === null || pass.trim() === "") return;

          document.body.style.cursor = "wait";
          google.script.run
            .withSuccessHandler(function (isValid) {
              document.body.style.cursor = "default";
              if (isValid) {
                currentUserRole = "admin";
                sessionStorage.setItem("wg_admin_pw", pass);
                document.getElementById("header-role").innerText = "ADMIN MODE";
                document
                  .getElementById("btn-set-stream")
                  .classList.remove("hidden");
                if (document.getElementById("btn-season-manager"))
                  document
                    .getElementById("btn-season-manager")
                    .classList.remove("hidden");
                document
                  .getElementById("admin-scanner-block")
                  .classList.remove("hidden");
                document
                  .getElementById("admin-scanner-block")
                  .classList.add("flex");
                if (document.getElementById("btn-admin-gazette"))
                  document
                    .getElementById("btn-admin-gazette")
                    .classList.remove("hidden");
                document.getElementById("login-state").style.display = "none";
                // Mostramos el dashboard de la LIGA NORMAL
                document.getElementById("dashboard-state").style.display =
                  "flex";
                refreshData();
              } else {
                alert("❌ Acceso Denegado");
              }
            })
            .checkAdminPassword(pass);
        } else if (role === "guest") {
          currentUserRole = "guest";
          document.getElementById("header-role").innerText = "";
          document.getElementById("login-state").style.display = "none";

          // Mostramos el dashboard de la LIGA NORMAL
          document.getElementById("dashboard-state").style.display = "flex";

          // Aseguramos que el panel del fantasy esté oculto
          if (document.getElementById("fantasy-dashboard")) {
            document
              .getElementById("fantasy-dashboard")
              .classList.add("hidden");
            document
              .getElementById("fantasy-dashboard")
              .classList.remove("flex");
          }
          refreshData();
        }
      }

      // 🚀 POWER SCORE CALCULATOR v2.0 — H2H FOCUSED (reducida influencia de rachas)
      function calculatePowerScores(data) {
        if (!data || !data.teams || !data.matches) return;
        let teamWR = {};
        data.teams.forEach((t) => {
          let total = Math.max(1, t.w + t.l);
          teamWR[t.id] = t.w / total;
        });

        // Construir H2H desde los partidos completados
        let h2h = data.h2h || {};
        let completedMatches = data.matches.filter(
          (m) => m.status === "COMPLETED",
        );

        data.teams.forEach((t) => {
          let winQuality = 0;
          let lossGravity = 0;
          let h2hDominance = 0;
          let sosTotal = 0;
          let matchCount = 0;

          let myMatches = completedMatches.filter(
            (m) => m.tA == t.id || m.tB == t.id,
          );
          myMatches.forEach((m) => {
            let isTeamA = m.tA == t.id;
            let myScore = isTeamA ? parseInt(m.sA) : parseInt(m.sB);
            let enemyScore = isTeamA ? parseInt(m.sB) : parseInt(m.sA);
            let enemyId = isTeamA ? m.tB : m.tA;
            let enemyWR = teamWR[enemyId] || 0.5;
            sosTotal += enemyWR;
            matchCount++;

            if (myScore > enemyScore) {
              winQuality += 10 + enemyWR * 15;
            } else if (enemyScore > myScore) {
              lossGravity += 5 + (1.0 - enemyWR) * 10;
            }
          });

          // H2H Dominance: bonus por cada enfrentamiento directo ganado
          let h2hRecord = h2h[t.id] || {};
          let h2hWins = 0,
            h2hLosses = 0;
          Object.keys(h2hRecord).forEach((oppId) => {
            let rec = h2hRecord[oppId];
            if (rec) {
              h2hWins += rec.w || 0;
              h2hLosses += rec.l || 0;
            }
          });
          h2hDominance = (h2hWins - h2hLosses) * 5;

          // SoS: Fuerza de calendario promedio
          let avgSoS = matchCount > 0 ? sosTotal / matchCount : 0.5;
          let sosBonus = avgSoS * 15;

          let consistencyBonus = (teamWR[t.id] || 0) * 20;

          // 🔥 RACHA: Influencia MÍNIMA (aditivo, no multiplicativo)
          let streakBonus = 0;
          if (t.streak > 0) streakBonus = t.streak * 2;
          else if (t.streak < 0) streakBonus = t.streak * 1.5;

          // Tie-breaker para asegurar que nadie tenga la misma puntuación (pequeño factor basado en posición/ID)
          let tieBreaker = (100 - (t.pos || 0)) * 0.001;

          let baseScore = Math.max(
            1,
            winQuality -
              lossGravity +
              consistencyBonus +
              h2hDominance +
              sosBonus +
              streakBonus +
              tieBreaker,
          );
          t.powerScore = baseScore;
          t.breakdown = {
            winQ: winQuality,
            lossG: lossGravity,
            h2hDom: h2hDominance,
            sos: sosBonus,
            consist: consistencyBonus,
            streakB: streakBonus,
            h2hW: h2hWins,
            h2hL: h2hLosses,
          };
        });
      }

      function refreshData() {
        console.time("refreshData");
        document.getElementById("loading-state").style.display = "flex";
        const roundFilter = document.getElementById("filter-round")
          ? document.getElementById("filter-round").value
          : "ALL";
        const divisionFilter = getActiveDivision();

        // 🧪 PING: Verificar que el servidor responde
        google.script.run
          .withSuccessHandler(function(ping) { console.log('[PING servidor]', ping); })
          .withFailureHandler(function(err) { console.error('[PING ERROR]', err); })
          .pingServer();

        google.script.run
          .withSuccessHandler(function (payload) {
            // 🟢 UNIFIED: Un solo objeto con todo
            if (!payload || payload.__error) {
              const msg = payload ? payload.errorMessage : 'El servidor no devolvió información.';
              console.error('refreshData: error del backend ->', msg);
              document.getElementById('loading-state').style.display = 'none';
              alert('❌ Error del servidor: ' + msg + '\n\nRevisa Apps Script → Ejecuciones para ver el stack completo.');
              return;
            }
            // Poblar el selector de divisiones (solo la primera vez o si cambian)
            if (payload.divisions) populateDivisionSelector(payload.divisions);

            const data = payload.tournament;
            calculatePowerScores(data);
            tournamentDataCache = data;
            renderDashboard(data);

            // Stats (must be before renderPowerRankings so globalStatsData is populated)
            renderStatsAndAwards(payload.statsPayload);
            renderRecordsAndPickems(payload.recordsPayload);

            renderPowerRankings();

            // News
            processNews(payload.news);

            // ⭐ Jugador destacado + próximo enfrentamiento
            renderFeaturedPlayer(payload.featuredPlayer);
            renderNextMatch(payload.nextMatch);

            // Meta
            renderMetaSnapshot(payload.meta);

            // Casino
            window.casinoRankingData = payload.casinoRanking;
            sortCasinoRanking("balance");

            // Playoffs
            window.playoffsActive = payload.playoffsActive;
            if (payload.playoffsActive || currentUserRole === "admin") {
              document
                .getElementById("btn-tab-playoffs")
                .classList.remove("hidden");
              if (currentUserRole === "admin") {
                let btnTgl = document.getElementById("btn-toggle-playoffs");
                btnTgl.innerText = payload.playoffsActive
                  ? "🔒 OCULTAR PLAYOFFS"
                  : "🏆 ACTIVAR PLAYOFFS";
                btnTgl.classList.remove("bg-yellow-600", "bg-slate-600");
                btnTgl.classList.add(
                  payload.playoffsActive ? "bg-slate-600" : "bg-yellow-600",
                );
                btnTgl.classList.remove("hidden");
              }
            } else {
              document
                .getElementById("btn-tab-playoffs")
                .classList.add("hidden");
            }
            if (payload.playoffsActive || currentUserRole === "admin") {
              renderPlayoffsTree();
            }

            document.getElementById("loading-state").style.display = "none";
            console.timeEnd("refreshData");
          })
          .withFailureHandler(function (err) {
            console.error("Error cargando datos:", err);
            document.getElementById("loading-state").style.display = "none";
            alert("❌ Error al cargar datos: " + err.message);
          })
          .getAllDashboardData(roundFilter, divisionFilter);
      }

      function togglePlayoffs() {
        let newState = !window.playoffsActive;
        let p1Opponent = null;
        let p2Opponent = null;

        if (newState && tournamentDataCache && tournamentDataCache.teams) {
          let powerTeams = [...tournamentDataCache.teams].sort(
            (a, b) => a.pos - b.pos,
          );
          if (powerTeams.length >= 4) {
            let seed1 = powerTeams[0];
            let seed2 = powerTeams[1];
            let seed3 = powerTeams[2];
            let seed4 = powerTeams[3];

            let choice = prompt(
              '👑 ' + (seed1.name) +
                ' (Seed 1) debe elegir su rival.\\nEscribe el NÚMERO del equipo al que se enfrentará:\\n3 - ' +
                (seed3.name) + '\\n4 - ' + (seed4.name),
              "4",
            );

            if (choice === "3") {
              p1Opponent = seed3.id;
              p2Opponent = seed4.id;
              alert(
                (seed1.name) + ' ha elegido a ' + (seed3.name) + '.\\n' + (seed2.name) + ' jugará contra ' +
                  (seed4.name) + '.',
              );
            } else if (choice === "4") {
              p1Opponent = seed4.id;
              p2Opponent = seed3.id;
              alert(
                (seed1.name) + ' ha elegido a ' + (seed4.name) + '.\\n' + (seed2.name) + ' jugará contra ' +
                  (seed3.name) + '.',
              );
            } else if (choice === null) {
              return; // Cancelled
            } else {
              alert(
                "Elección inválida. Se usará el formato tradicional (1º vs 4º).",
              );
              p1Opponent = seed4.id;
              p2Opponent = seed3.id;
            }
          }
        }

        document.getElementById("btn-toggle-playoffs").innerText = "⏳...";
        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            refreshData();
          })
          .togglePlayoffsBackend(newState, p1Opponent, p2Opponent);
      }

      function buildMatchBox(
        m,
        label,
        isBo3 = false,
        ghostA = "",
        ghostB = "",
      ) {
        if (!m) {
          return ' <div class="bracket-box bracket-box-pending bg-slate-800/30 border-2 border-slate-700/50 p-4 rounded-xl w-[280px] opacity-60"> <div class="text-[10px] text-slate-500 font-bold mb-3 tracking-widest uppercase">' +
            (label) + '</div> <div class="bg-black/40 p-2.5 rounded mb-1 text-slate-400 italic text-[11px]">' +
            (ghostA || "TBD") +
            '</div> <div class="bg-black/40 p-2.5 rounded text-slate-400 italic text-[11px]">' +
            (ghostB || "TBD") + '</div> </div> ';
        }
        let names = String(m.names || "").split(" vs ");
        let sA = parseInt(m.sA) || 0;
        let sB = parseInt(m.sB) || 0;
        const isCompleted = m.status === "COMPLETED";

        // Para partidos PENDIENTES, los ghost names calculados de resultados reales
        // tienen prioridad sobre el nombre almacenado (que puede ser obsoleto).
        // Esto corrige casos como la LB Final donde el slot A debe mostrar
        // al perdedor de la UB Final aunque el match tenga otro nombre guardado.
        const isGhostARealTeam = ghostA && !isBracketPlaceholderName(ghostA);
        const isGhostBRealTeam = ghostB && !isBracketPlaceholderName(ghostB);

        let tA = (!isCompleted && isGhostARealTeam)
          ? ghostA
          : (names[0] && !isBracketPlaceholderName(names[0])
            ? names[0].trim()
            : ghostA || names[0] || "TBD");
        let tB = (!isCompleted && isGhostBRealTeam)
          ? ghostB
          : (names[1] && !isBracketPlaceholderName(names[1])
            ? names[1].trim()
            : ghostB || names[1] || "TBD");

        let winA =
          isCompleted && sA > sB
            ? "border-l-4 border-emerald-500 text-white bg-slate-800"
            : "text-slate-400 bg-slate-900";
        let winB =
          isCompleted && sB > sA
            ? "border-l-4 border-emerald-500 text-white bg-slate-800"
            : "text-slate-400 bg-slate-900";
        let safeRiotId = m.riotId || m.id;

        // Badge de estado
        let statusBadge = isCompleted
          ? '<span class="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 tracking-widest">✓ JUGADO</span>'
          : '<span class="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600 tracking-widest">PENDIENTE</span>';

        let click = isCompleted
          ? 'onclick="openPostGame(\'' + (m.id) + '\', \'' + (safeRiotId) + '\')" class="bracket-box ' +
            (isCompleted ? "bracket-box-completed" : "bracket-box-pending") +
            ' bg-slate-800/90 border border-yellow-500/50 p-4 rounded-xl w-[280px] shadow-[0_0_20px_rgba(251,191,36,0.15)] relative z-10 transition-all hover:scale-105 cursor-pointer"'
          : 'onclick="openMatchScouting(\'' + (m.id) +
            '\')" class="bracket-box bracket-box-pending bg-slate-800/90 border border-slate-600 p-4 rounded-xl w-[280px] shadow-xl relative z-10 transition-all hover:border-accent-blue cursor-pointer"';

        let dotsHTML_A = "";
        let dotsHTML_B = "";

        if (isBo3) {
          let dA = "";
          for (let i = 0; i < 2; i++) {
            let active =
              i < sA
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981] border-emerald-400"
                : "bg-slate-800 border-slate-600";
            dA += '<span class="inline-block w-2.5 h-2.5 rounded-full border ' + (active) +
              ' mx-0.5 transition-colors"></span>';
          }
          dotsHTML_A = '<div class="flex items-center mr-3">' + (dA) + '</div>';

          let dB = "";
          for (let i = 0; i < 2; i++) {
            let active =
              i < sB
                ? "bg-emerald-500 shadow-[0_0_8px_#10b981] border-emerald-400"
                : "bg-slate-800 border-slate-600";
            dB += '<span class="inline-block w-2.5 h-2.5 rounded-full border ' + (active) +
              ' mx-0.5 transition-colors"></span>';
          }
          dotsHTML_B = '<div class="flex items-center mr-3">' + (dB) + '</div>';
        }

        return ' <div ' + (click) +
          '> <div class="flex justify-between items-center mb-3"> <div class="text-[10px] text-yellow-500 font-bold tracking-widest uppercase bg-yellow-500/10 px-2 py-0.5 rounded">' +
          (m.round) + '</div> ' + (statusBadge) +
          ' </div> <div class="flex justify-between items-center p-2.5 rounded mb-1.5 transition-colors ' +
          (winA) + '"> <span class="font-bold truncate text-sm flex-1">' + (escHtml(tA)) +
          '</span> <div class="flex items-center">' + (dotsHTML_A) + '<span class="font-black text-lg">' +
          (sA) +
          '</span></div> </div> <div class="flex justify-between items-center p-2.5 rounded transition-colors ' +
          (winB) + '"> <span class="font-bold truncate text-sm flex-1">' + (escHtml(tB)) +
          '</span> <div class="flex items-center">' + (dotsHTML_B) + '<span class="font-black text-lg">' +
          (sB) + '</span></div> </div> </div> ';
      }

      /** Propaga ganadores/perdedores en el cache del bracket (UI) según partidos COMPLETED */
      function propagatePlayoffBracketInCache(matches) {
        const ADVANCE = {
          P1: { win: { id: "P3", slot: "A" }, lose: { id: "P8", slot: "A" } },
          P2: { win: { id: "P3", slot: "B" }, lose: { id: "P9", slot: "A" } },
          P3: { win: { id: "P12", slot: "A" }, lose: { id: "P11", slot: "A" } },
          P4: { win: { id: "P6", slot: "B" } },
          P5: { win: { id: "P7", slot: "B" } },
          P6: { win: { id: "P8", slot: "B" } },
          P7: { win: { id: "P9", slot: "B" } },
          P8: { win: { id: "P10", slot: "A" } },
          P9: { win: { id: "P10", slot: "B" } },
          P10: { win: { id: "P11", slot: "B" } },
          P11: { win: { id: "P12", slot: "B" } },
        };
        const findM = function (id) {
          return matches.find(function (m) {
            return String(m.id) === String(id);
          });
        };
        const winnerOfLocal = function (m) {
          if (!m) return "";
          let sA = parseInt(m.sA) || 0,
            sB = parseInt(m.sB) || 0;
          if (sA === sB) return "";
          let names = String(m.names || "").split(" vs ");
          if (sA > sB)
            return !isBracketPlaceholderName(names[0]) ? names[0].trim() : "";
          return !isBracketPlaceholderName(names[1]) ? names[1].trim() : "";
        };
        const loserOfLocal = function (m) {
          if (!m) return "";
          let sA = parseInt(m.sA) || 0,
            sB = parseInt(m.sB) || 0;
          if (sA === sB) return "";
          let names = String(m.names || "").split(" vs ");
          if (sA > sB)
            return !isBracketPlaceholderName(names[1]) ? names[1].trim() : "";
          return !isBracketPlaceholderName(names[0]) ? names[0].trim() : "";
        };
        Object.keys(ADVANCE).forEach(function (mid) {
          const src = findM(mid);
          if (!src || (parseInt(src.sA) || 0) === (parseInt(src.sB) || 0))
            return;
          const cfg = ADVANCE[mid];
          const wName = winnerOfLocal(src);
          const lName = loserOfLocal(src);
          if (cfg.win && wName) {
            const tgt = findM(cfg.win.id);
            if (tgt) {
              let parts = String(tgt.names || "TBD vs TBD").split(" vs ");
              if (cfg.win.slot === "A") parts[0] = wName;
              else parts[1] = wName;
              tgt.names = parts[0].trim() + " vs " + (parts[1] || "TBD").trim();
            }
          }
          if (cfg.lose && lName) {
            const tgt = findM(cfg.lose.id);
            if (tgt) {
              let parts = String(tgt.names || "TBD vs TBD").split(" vs ");
              if (cfg.lose.slot === "A") parts[0] = lName;
              else parts[1] = lName;
              tgt.names = parts[0].trim() + " vs " + (parts[1] || "TBD").trim();
            }
          }
        });
      }

      function renderPlayoffsTree() {
        if (!tournamentDataCache || !tournamentDataCache.matches) return;
        const matches = tournamentDataCache.matches;
        propagatePlayoffBracketInCache(matches);
        const teams = tournamentDataCache.teams || [];

        // Helper: find team name by id
        const teamName = (id) => {
          let t = teams.find((t) => String(t.id) === String(id));
          return t ? t.name : String(id);
        };

        // Helper: get winner name of a match (returns '' if not played)
        const winnerOf = (m) => {
          if (!m) return "";
          let sA = parseInt(m.sA) || 0,
            sB = parseInt(m.sB) || 0;
          if (m.status !== "COMPLETED" && sA === sB) return "";
          let names = String(m.names || "").split(" vs ");
          if (sA > sB) {
            let n = (names[0] || "").trim();
            return !isBracketPlaceholderName(n) ? n : teamName(m.tA);
          }
          if (sB > sA) {
            let n = (names[1] || "").trim();
            return !isBracketPlaceholderName(n) ? n : teamName(m.tB);
          }
          return "";
        };

        const loserOf = (m) => {
          if (!m) return "";
          let sA = parseInt(m.sA) || 0,
            sB = parseInt(m.sB) || 0;
          if (m.status !== "COMPLETED" && sA === sB) return "";
          let names = String(m.names || "").split(" vs ");
          if (sA > sB) {
            let n = (names[1] || "").trim();
            return !isBracketPlaceholderName(n) ? n : teamName(m.tB);
          }
          if (sB > sA) {
            let n = (names[0] || "").trim();
            return !isBracketPlaceholderName(n) ? n : teamName(m.tA);
          }
          return "";
        };

        // 🟢 Helper flexible: busca partidos probando varios nombres de ronda
        const findByRound = (...keywords) => {
          for (let kw of keywords) {
            let found = matches.filter((m) =>
              m.round.toLowerCase().includes(kw.toLowerCase()),
            );
            if (found.length > 0) return found;
          }
          return [];
        };

        // Upper Bracket
        let ubSemi = findByRound("ub semi", "upper semi");
        let ubFinal = findByRound("ub final", "upper final");

        // Play-In
        let piR1 = findByRound("play-in r1");
        let piR2 = findByRound("play-in r2");
        if (piR1.length === 0 && piR2.length === 0) {
          let allPI = findByRound("play-in", "play in");
          piR1 = allPI.slice(0, 2);
          piR2 = allPI.slice(2, 4);
        }

        // Lower Bracket
        let lbR1 = findByRound("lb r1", "lower r1", "lb ronda 1");
        let lbSemi = findByRound("lb semi", "lower semi", "lb semifinal");
        let lbFinal = findByRound("lb final", "lower final");

        let granFinal = matches.filter((m) => {
          let r = m.round.toLowerCase();
          return (
            r.includes("gran final") ||
            (r.includes("final") &&
              !r.includes("ub") &&
              !r.includes("lb") &&
              !r.includes("upper") &&
              !r.includes("lower"))
          );
        });

        // ── Propagate winners into next-round ghost names ──
        // UB Semi → UB Final
        let ubFinalGhostA = winnerOf(ubSemi[0]) || "Ganador UB Semi 1";
        let ubFinalGhostB = winnerOf(ubSemi[1]) || "Ganador UB Semi 2";

        // UB Final → Gran Final
        let granFinalGhostA = winnerOf(ubFinal[0]) || "Ganador Upper";

        // Play-In R1 → Play-In R2 (winners advance)
        let piR2GhostA_B = winnerOf(piR1[0]) || "Ganador PI R1-A";
        let piR2GhostB_B = winnerOf(piR1[1]) || "Ganador PI R1-B";

        // LB R1: loser UB Semi drops here
        let lbR1GhostA_A = loserOf(ubSemi[0]) || "Perdedor UB Semi 1";
        let lbR1GhostB_A = loserOf(ubSemi[1]) || "Perdedor UB Semi 2";
        // LB R1 survivor from PI R2
        let lbR1GhostA_B = winnerOf(piR2[0]) || "Superviviente PI";
        let lbR1GhostB_B = winnerOf(piR2[1]) || "Superviviente PI";

        // LB Semi
        let lbSemiGhostA = winnerOf(lbR1[0]) || "Ganador LBR1 A";
        let lbSemiGhostB = winnerOf(lbR1[1]) || "Ganador LBR1 B";

        // LB Final
        let lbFinalGhostA = loserOf(ubFinal[0]) || "Perdedor UB Final";
        let lbFinalGhostB = winnerOf(lbSemi[0]) || "Ganador LB Semi";

        // Gran Final lower slot
        let granFinalGhostB = winnerOf(lbFinal[0]) || "Ganador Lower";

        let badgeBo3 =
          ' <span class="bg-orange-600 text-black px-1.5 py-0.5 rounded ml-1 font-black tracking-widest shadow-[0_0_8px_rgba(234,88,12,0.8)] align-middle text-[8px]">BO3 FEARLESS</span>';

        // ── Helper: conector entre columnas del bracket ──
        // Dibuja una línea horizontal que conecta la salida de una columna con la entrada de la siguiente.
        const buildConnector = (sourceMatch, direction = "single") => {
          let match1 = null,
            match2 = null;
          if (Array.isArray(sourceMatch)) {
            match1 = sourceMatch[0];
            match2 = sourceMatch[1];
          } else {
            match1 = sourceMatch;
            match2 = sourceMatch;
          }
          const done1 = match1 && match1.status === "COMPLETED";
          const done2 = match2 && match2.status === "COMPLETED";
          const c1 = done1 ? "#10b981" : "#475569";
          const c2 = done2 ? "#10b981" : "#475569";
          const d1 = done1 ? "" : 'stroke-dasharray="6 3"';
          const d2 = done2 ? "" : 'stroke-dasharray="6 3"';
          const cls1 = done1 ? "" : ' class="connector-pend"';
          const cls2 = done2 ? "" : ' class="connector-pend"';
          const glow = (c) =>
            c === "#10b981"
              ? "drop-shadow(0 0 5px rgba(16,185,129,0.8))"
              : "none";

          if (direction === "single") {
            return '<div style="display:flex;align-items:center;align-self:center;width:36px;"> <svg width="36" height="24" viewBox="0 0 36 24" fill="none"> <path d="M0 12 L28 12" stroke="' +
              (c1) + '" stroke-width="2.5" stroke-linecap="round" ' + (d1) + (cls1) +
              '/> <polygon points="26,7 34,12 26,17" fill="' + (c1) + '" style="filter:' + (glow(c1)) +
              '"/> </svg></div>';
          }
          if (direction === "fork-down") {
            const doneAll = done1 && done2;
            const cA = doneAll ? "#10b981" : "#475569";
            const dA = doneAll ? "" : 'stroke-dasharray="6 3"';
            return '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;align-self:stretch;width:44px;"> <svg width="44" height="160" viewBox="0 0 44 160" fill="none" preserveAspectRatio="none"> <path d="M0 40 L14 40 Q22 40 22 48 L22 72 Q22 80 14 80" stroke="' +
              (c1) + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" ' + (d1) +
              (cls1) + '/> <path d="M0 120 L14 120 Q22 120 22 112 L22 88 Q22 80 14 80" stroke="' + (c2) +
              '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" ' + (d2) + (cls2) +
              '/> <path d="M14 80 L38 80" stroke="' + (cA) + '" stroke-width="2.5" stroke-linecap="round" ' +
              (dA) + ' style="filter:' + (glow(cA)) + '"/> <polygon points="36,75 44,80 36,85" fill="' + (cA) +
              '" style="filter:' + (glow(cA)) + '"/> </svg></div>';
          }
          if (direction === "parallel") {
            return '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;align-self:stretch;width:36px;"> <svg width="36" height="160" viewBox="0 0 36 160" fill="none" preserveAspectRatio="none"> <path d="M0 40 L28 40" stroke="' +
              (c1) + '" stroke-width="2.5" stroke-linecap="round" ' + (d1) + ' style="filter:' + (glow(c1)) +
              '"' + (cls1) + '/> <polygon points="26,35 34,40 26,45" fill="' + (c1) + '" style="filter:' +
              (glow(c1)) + '"/> <path d="M0 120 L28 120" stroke="' + (c2) +
              '" stroke-width="2.5" stroke-linecap="round" ' + (d2) + ' style="filter:' + (glow(c2)) + '"' +
              (cls2) + '/> <polygon points="26,115 34,120 26,125" fill="' + (c2) + '" style="filter:' +
              (glow(c2)) + '"/> </svg></div>';
          }
          return "";
        };

        // Estado combinado: un conector dual solo se activa verde si AMBOS semis están completos
        const bothUbSemiDone =
          ubSemi[0] &&
          ubSemi[0].status === "COMPLETED" &&
          ubSemi[1] &&
          ubSemi[1].status === "COMPLETED";
        const ubFinalForGF = ubFinal[0] && ubFinal[0].status === "COMPLETED";
        const lbR1ForSemi =
          lbR1.length >= 2 &&
          lbR1[0].status === "COMPLETED" &&
          lbR1[1].status === "COMPLETED";
        const lbSemiForFinal = lbSemi[0] && lbSemi[0].status === "COMPLETED";

        // Inyectamos el CSS de conectores la primera vez
        if (!document.getElementById("bracket-connector-css")) {
          const style = document.createElement("style");
          style.id = "bracket-connector-css";
          style.textContent = ' .bracket-connector { display:flex; align-items:center; align-self:center; } .bracket-box-completed { box-shadow: 0 0 18px rgba(16,185,129,0.20) !important; } @keyframes connectorPulse { 0%,100%{opacity:1} 50%{opacity:0.3} } .connector-pend { animation: connectorPulse 2s ease-in-out infinite; } ';
          document.head.appendChild(style);
        }

        let html = ' <div class="flex flex-col gap-12 w-full max-w-7xl mx-auto"> <!-- 👑 UPPER BRACKET --> <div class="bg-slate-800/40 border border-emerald-500/30 p-8 rounded-2xl shadow-lg relative"> <div class="absolute top-0 left-4 bg-emerald-500 text-black text-xs font-black px-4 py-1.5 rounded-b-lg tracking-widest uppercase">UPPER BRACKET (Top 4)</div> <div class="flex flex-row items-center justify-around gap-0 mt-6"> <!-- Col 1: UB Semis --> <div class="flex flex-col justify-center gap-12"> ' +
          (buildMatchBox(ubSemi[0], "UB Semifinal" + badgeBo3, true, "Seed 1º", "Seed 4º")) + ' ' +
          (buildMatchBox(ubSemi[1], "UB Semifinal" + badgeBo3, true, "Seed 2º", "Seed 3º")) +
          ' </div> <!-- Conector UB Semis → UB Final --> ' +
          (buildConnector([ubSemi[0], ubSemi[1]], "fork-down")) +
          ' <!-- Col 2: UB Final --> <div class="flex flex-col justify-center gap-12"> ' +
          (buildMatchBox(ubFinal[0], "UB Final" + badgeBo3, true, ubFinalGhostA, ubFinalGhostB)) +
          ' </div> <!-- Conector UB Final → Gran Final --> ' + (buildConnector(ubFinal[0], "single")) +
          ' <!-- Col 3: Gran Final --> <div class="flex flex-col justify-center gap-12"> ' +
          (buildMatchBox(granFinal[0], "GRAN FINAL" + badgeBo3, true, granFinalGhostA, granFinalGhostB)) +
          ' </div> </div> </div> <!-- 🔥 LOWER BRACKET (5 COLUMNS) --> <div class="bg-slate-800/40 border border-red-500/30 p-8 rounded-2xl shadow-lg relative overflow-x-auto"> <div class="absolute top-0 left-4 bg-red-500 text-white text-xs font-black px-4 py-1.5 rounded-b-lg tracking-widest uppercase">LOWER BRACKET &amp; PLAY-IN</div> <div class="flex flex-row items-center gap-0 mt-6 min-w-max pb-4"> <!-- Col 1: Play-In R1 --> <div class="flex flex-col justify-center gap-8"> <div class="text-[9px] text-slate-500 font-bold uppercase text-center mb-2 tracking-widest">Play-In Ronda 1</div> ' +
          (buildMatchBox(piR1[0], "Play-In R1" + badgeBo3, true, "Seed 7º", "Seed 10º")) + ' ' +
          (buildMatchBox(piR1[1], "Play-In R1" + badgeBo3, true, "Seed 8º", "Seed 9º")) +
          ' </div> <!-- Conector PI R1 → PI R2 --> ' + (buildConnector([piR1[0], piR1[1]], "parallel")) +
          ' <!-- Col 2: Play-In R2 --> <div class="flex flex-col justify-center gap-8"> <div class="text-[9px] text-slate-500 font-bold uppercase text-center mb-2 tracking-widest">Play-In Ronda 2</div> ' +
          (buildMatchBox(piR2[0], "Play-In R2" + badgeBo3, true, "Seed 5º", piR2GhostA_B)) + ' ' +
          (buildMatchBox(piR2[1], "Play-In R2" + badgeBo3, true, "Seed 6º", piR2GhostB_B)) +
          ' </div> <!-- Conector PI R2 → LB R1 --> ' + (buildConnector([piR2[0], piR2[1]], "parallel")) +
          ' <!-- Col 3: Lower Bracket R1 --> <div class="flex flex-col justify-center gap-8"> <div class="text-[9px] text-slate-500 font-bold uppercase text-center mb-2 tracking-widest">LB Ronda 1</div> ' +
          (buildMatchBox(lbR1[0], "LB Ronda 1" + badgeBo3, true, lbR1GhostA_A, lbR1GhostA_B)) + ' ' +
          (buildMatchBox(lbR1[1], "LB Ronda 1" + badgeBo3, true, lbR1GhostB_A, lbR1GhostB_B)) +
          ' </div> <!-- Conector LB R1 → LB Semi --> ' + (buildConnector([lbR1[0], lbR1[1]], "fork-down")) +
          ' <!-- Col 4: Lower Bracket Semi --> <div class="flex flex-col justify-center gap-8"> <div class="text-[9px] text-slate-500 font-bold uppercase text-center mb-2 tracking-widest">LB Semifinal</div> ' +
          (buildMatchBox(lbSemi[0], "LB Semifinal" + badgeBo3, true, lbSemiGhostA, lbSemiGhostB)) +
          ' </div> <!-- Conector LB Semi → LB Final --> ' + (buildConnector(lbSemi[0], "single")) +
          ' <!-- Col 5: Lower Bracket Final --> <div class="flex flex-col justify-center gap-8"> <div class="text-[9px] text-slate-500 font-bold uppercase text-center mb-2 tracking-widest">LB Final</div> ' +
          (buildMatchBox(lbFinal[0], "LB Final" + badgeBo3, true, lbFinalGhostA, lbFinalGhostB)) +
          ' </div> </div> </div> </div>';

        document.getElementById("playoffs-bracket-container").innerHTML = html;
      }

      function openVod(url) {
        if (!url || url === "undefined") return;
        let embedUrl = url;
        if (url.includes("youtube.com/watch?v="))
          embedUrl = url.replace("watch?v=", "embed/");
        else if (url.includes("youtu.be/"))
          embedUrl = url.replace("youtu.be/", "youtube.com/embed/");
        else if (url.includes("twitch.tv/videos/")) {
          let vId = url.split("videos/")[1].split("?")[0];
          embedUrl =
            "https://player.twitch.tv/?video=" +
            vId +
            "&parent=" +
            window.location.hostname;
        }
        document.getElementById("vod-iframe").src = embedUrl;
        document.getElementById("vod-modal").style.display = "flex";
      }

      function closeVod() {
        document.getElementById("vod-iframe").src = "";
        closeModal("vod-modal");
      }

      function renderMetaSnapshot(metaData) {
        if (!metaData || metaData.length === 0) return;

        const pickedContainer = document.getElementById("meta-most-picked");
        const winrateContainer = document.getElementById("meta-best-winrate");
        const bannedContainer = document.getElementById("meta-most-banned");
        const duosContainer = document.getElementById("meta-lethal-duos");

        let htmlPicks = "";
        const topPicks = [...metaData].slice(0, 10);
        topPicks.forEach((c, idx) => {
          let champIcon = getChampIcon(c.champ);
          htmlPicks +=
            '<div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 shadow hover:border-yellow-500 transition">';
          htmlPicks +=
            '<div class="flex items-center gap-3"><span class="font-oswald text-xl text-slate-500 w-5">#' +
            (idx + 1) +
            '</span><img src="' +
            champIcon +
            '" class="w-8 h-8 rounded-full border-2 border-slate-600"><div class="font-bold text-white">' +
            escHtml(c.champ) +
            "</div></div>";
          htmlPicks +=
            '<div class="text-right"><div class="text-yellow-500 font-black text-base">' +
            c.picks +
            ' Picks</div><div class="text-[10px] text-slate-400 font-bold uppercase">' +
            c.winrate +
            "% WR</div></div></div>";
        });
        if (pickedContainer) pickedContainer.innerHTML = htmlPicks;

        let htmlBans = "";
        const topBans = [...metaData]
          .sort((a, b) => (b.bans || 0) - (a.bans || 0))
          .slice(0, 10);
        topBans.forEach((c, idx) => {
          let champIcon = getChampIcon(c.champ);
          let bans = c.bans || 0;
          htmlBans +=
            '<div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 shadow hover:border-red-500 transition">';
          htmlBans +=
            '<div class="flex items-center gap-3"><span class="font-oswald text-xl text-slate-500 w-5">#' +
            (idx + 1) +
            '</span><img src="' +
            champIcon +
            '" class="w-8 h-8 rounded-full border-2 border-slate-600 grayscale"><div class="font-bold text-white">' +
            escHtml(c.champ) +
            "</div></div>";
          htmlBans +=
            '<div class="text-right"><div class="text-red-500 font-black text-base">' +
            bans +
            " Bans</div></div></div>";
        });
        if (bannedContainer) bannedContainer.innerHTML = htmlBans;

        let htmlWr = "";
        const topWr = [...metaData]
          .filter((c) => c.picks >= 2)
          .sort((a, b) => b.winrate - a.winrate || b.picks - a.picks)
          .slice(0, 10);
        if (topWr.length === 0) {
          htmlWr =
            '<div class="text-slate-500 text-center py-4">Faltan datos (min 2 picks).</div>';
        } else {
          topWr.forEach((c, idx) => {
            let champIcon = getChampIcon(c.champ);
            let colorClass =
              c.winrate >= 60
                ? "text-emerald-400"
                : c.winrate >= 50
                  ? "text-yellow-400"
                  : "text-red-400";
            htmlWr +=
              '<div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 shadow hover:border-emerald-400 transition">';
            htmlWr +=
              '<div class="flex items-center gap-3"><span class="font-oswald text-xl text-slate-500 w-5">#' +
              (idx + 1) +
              '</span><img src="' +
              champIcon +
              '" class="w-8 h-8 rounded-full border-2 border-slate-600"><div class="font-bold text-white">' +
              escHtml(c.champ) +
              "</div></div>";
            htmlWr +=
              '<div class="text-right"><div class="' +
              colorClass +
              ' font-black text-base">' +
              c.winrate +
              '% WR</div><div class="text-[10px] text-slate-400 font-bold uppercase">' +
              c.picks +
              " Partidas</div></div></div>";
          });
        }
        if (winrateContainer) winrateContainer.innerHTML = htmlWr;

        if (duosContainer) {
          let htmlDuos = "";
          if (metaData.length >= 5) {
            let popular = [...metaData].sort((a, b) => b.picks - a.picks);
            let duos = [
              { c1: popular[0], c2: popular[2] },
              { c1: popular[1], c2: popular[3] },
              { c1: popular[4], c2: popular[5] || popular[0] },
              { c1: popular[0], c2: popular[1] },
              { c1: popular[2], c2: popular[4] || popular[1] },
              { c1: popular[3], c2: popular[6] || popular[0] },
              { c1: popular[5] || popular[0], c2: popular[7] || popular[2] },
              { c1: popular[1], c2: popular[6] || popular[3] },
            ];

            duos.forEach((d, idx) => {
              if (!d.c1 || !d.c2) return;
              let synergyPicks =
                Math.floor(Math.min(d.c1.picks, d.c2.picks) * 0.6) + 1;
              let synergyWinrate = Math.min(
                100,
                Math.round((d.c1.winrate + d.c2.winrate) / 2 + 5 + idx * 2),
              );
              let icon1 = getChampIcon(d.c1.champ);
              let icon2 = getChampIcon(d.c2.champ);

              htmlDuos +=
                '<div class="flex justify-between items-center bg-slate-800 p-2.5 rounded-lg border border-slate-700 shadow hover:border-purple-400 transition">';
              htmlDuos +=
                '<div class="flex items-center gap-2"><span class="font-oswald text-lg text-slate-500 w-4">#' +
                (idx + 1) +
                '</span><div class="flex -space-x-2"><img src="' +
                icon1 +
                '" class="w-8 h-8 rounded-full border-2 border-slate-600 relative z-10"><img src="' +
                icon2 +
                '" class="w-8 h-8 rounded-full border-2 border-slate-600 relative z-0"></div></div>';
              htmlDuos +=
                '<div class="text-right"><div class="text-purple-400 font-black text-base">' +
                synergyWinrate +
                '% WR</div><div class="text-[10px] text-slate-400 font-bold uppercase">' +
                synergyPicks +
                " Partidas</div></div></div>";
            });
            duosContainer.innerHTML = htmlDuos;
          } else {
            duosContainer.innerHTML =
              '<div class="text-slate-500 text-center py-4">Faltan datos para sinergias.</div>';
          }
        }
      }

      function refreshStatsOnly() {
        const roundFilter = document.getElementById("filter-round")
          ? document.getElementById("filter-round").value
          : "ALL";
        const divisionFilter = getActiveDivision();
        document.getElementById("quinteto-container").innerHTML =
          '<div class="text-slate-500 italic text-sm text-center w-full">Cargando quinteto...</div>';
        if (document.getElementById("stats-body"))
          document.getElementById("stats-body").innerHTML =
            '<tr><td colspan="12" class="text-center text-slate-500 py-8 animate-pulse">Consultando base de datos...</td></tr>';

        // 🚀 OPTIMIZADO: Una sola llamada unificada en vez de 3 separadas
        google.script.run
          .withSuccessHandler(function (payload) {
            renderStatsAndAwards(payload.statsPayload);
            renderRecordsAndPickems(payload.recordsPayload);
            window.casinoRankingData = payload.casinoRanking;
            sortCasinoRanking("balance");
          })
          .getAllDashboardData(roundFilter, divisionFilter);
      }

      // ============================================================
      // SISTEMA MULTI-DIVISION
      // ============================================================
      function getActiveDivision() {
        var sel = document.getElementById("filter-division");
        if (sel && sel.value) return sel.value;
        return sessionStorage.getItem("wg_active_division") || "ALL";
      }

      var _divisionSelectorPopulated = false;
      function populateDivisionSelector(divInfo) {
        var sel = document.getElementById("filter-division");
        if (!sel || !divInfo) return;

        var realDivs = divInfo.divisions || [];
        var icons = { 'Premier': '&#128081;', 'Aspirante': '&#9876;&#65039;', 'Aspirante A': '&#128200;', 'Aspirante B': '&#128200;', 'Elite': '&#128142;', 'Promesas': '&#128175;', 'Academia': '&#127891;' };

        if (realDivs.length > 1 || divInfo.multiDivision) {
          sel.classList.remove("hidden");
        } else {
          sel.classList.add("hidden");
        }

        if (_divisionSelectorPopulated) return;

        var saved = sessionStorage.getItem("wg_active_division") || "ALL";
        var html = '<option value="ALL">&#127942; Todas las divisiones</option>';
        realDivs.forEach(function(d) {
          var ic = icons[d] || '&#127885;';
          var selAttr = (d === saved) ? ' selected' : '';
          html += '<option value="' + d + '"' + selAttr + '>' + ic + ' ' + d + '</option>';
        });
        sel.innerHTML = html;
        if (saved !== "ALL") {
          sel.value = saved;
          if (!sel.value) sel.value = "ALL";
        }
        _divisionSelectorPopulated = true;
      }

      function onDivisionChange() {
        var sel = document.getElementById("filter-division");
        var val = sel ? sel.value : "ALL";
        sessionStorage.setItem("wg_active_division", val);
        refreshData();
        if (typeof loadPickemData === 'function') loadPickemData();
      }


      // ============================================================
      // 🗂️ GESTIÓN DE TEMPORADA (Admin)
      // ============================================================
      function openSeasonManager() {
        if (currentUserRole !== "admin") {
          alert("Solo los administradores pueden gestionar la temporada.");
          return;
        }
        document.getElementById("season-manager-modal").style.display = "flex";
        showSeasonTab("finalize");
      }

      function closeSeasonManager() {
        document.getElementById("season-manager-modal").style.display = "none";
      }

      function showSeasonTab(tab) {
        ["finalize", "builder", "podiums"].forEach(function (t) {
          const pane = document.getElementById("sm-pane-" + t);
          const btn = document.getElementById("sm-tab-" + t);
          if (pane) pane.style.display = (t === tab) ? "block" : "none";
          if (btn) {
            btn.classList.toggle("bg-rose-600", t === tab);
            btn.classList.toggle("text-white", t === tab);
            btn.classList.toggle("bg-slate-800", t !== tab);
            btn.classList.toggle("text-slate-400", t !== tab);
          }
        });
        if (tab === "builder") loadSeasonBuilder();
        if (tab === "podiums") loadPodiumsPreview();
      }

      // --- FINALIZAR LIGA: archivar TOP 4 ---
      function finalizeCurrentSeason() {
        const label = document.getElementById("sm-season-label").value.trim();
        if (!label) {
          alert("Pon una etiqueta para esta temporada (ej: Season 2026 - Split 1).");
          return;
        }
        if (!confirm('Esto guardará el TOP 4 de cada división en el Salón de la Fama.\n\n¿Continuar?')) return;
        const adminKey = sessionStorage.getItem("wg_admin_pw") || "";
        const btn = document.getElementById("sm-finalize-btn");
        btn.disabled = true; btn.innerText = "⏳ Archivando...";
        google.script.run
          .withSuccessHandler(function (res) {
            btn.disabled = false; btn.innerText = "🏆 ARCHIVAR TOP 4 DE TODAS LAS DIVISIONES";
            alert(res.msg || (res.success ? "Hecho" : "Error"));
            if (res.success) loadPodiumsPreview();
          })
          .withFailureHandler(function (err) {
            btn.disabled = false; btn.innerText = "🏆 ARCHIVAR TOP 4 DE TODAS LAS DIVISIONES";
            alert("❌ Error: " + err.message);
          })
          .finalizeSeasonPodiums("ALL", label, adminKey);
      }

      // --- CONSTRUCTOR DE NUEVA LIGA desde la bolsa de equipos ---
      let _seasonBuilderData = null;
      let _builderAssignments = {};

      function loadSeasonBuilder() {
        const cont = document.getElementById("sm-builder-content");
        cont.innerHTML = '<div class="text-center py-8 text-slate-500 animate-pulse">Cargando bolsa de equipos...</div>';
        const adminKey = sessionStorage.getItem("wg_admin_pw") || "";
        google.script.run
          .withSuccessHandler(function (res) {
            if (!res || !res.success) {
              cont.innerHTML = '<div class="text-center py-8 text-red-400">' + (res ? res.msg : "Error") + '</div>';
              return;
            }
            _seasonBuilderData = res;
            _builderAssignments = {};
            res.divisions.forEach(function (d) { _builderAssignments[d] = []; });
            Object.keys(res.byDivision).forEach(function (divKey) {
              if (divKey === "_sin_asignar") return;
              res.byDivision[divKey].forEach(function (t) {
                if (_builderAssignments[divKey]) _builderAssignments[divKey].push(t);
              });
            });
            renderSeasonBuilder();
          })
          .withFailureHandler(function (err) {
            cont.innerHTML = '<div class="text-center py-8 text-red-400">❌ ' + err.message + '</div>';
          })
          .getSeasonBuilderData(adminKey);
      }

      function renderSeasonBuilder() {
        if (!_seasonBuilderData) return;
        const cont = document.getElementById("sm-builder-content");
        const icons = { 'Premier': '👑', 'Aspirante': '⚔️', 'Élite': '💎', 'Promesas': '💫', 'Academia': '🎓' };
        const unassigned = (_seasonBuilderData.byDivision["_sin_asignar"] || []);

        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">';
        _seasonBuilderData.divisions.forEach(function (div) {
          const teams = _builderAssignments[div] || [];
          html += '<div class="bg-slate-900/60 border border-slate-700 rounded-xl p-4 transition-colors duration-200" ondragover="allowDropBuilderTeam(event)" ondragleave="dragLeaveBuilderTeam(event)" ondrop="dropBuilderTeam(event, \'' + div + '\')">';
          html += '<div class="flex items-center justify-between mb-3 pointer-events-none"><h4 class="font-oswald text-cyan-300 tracking-widest text-sm uppercase">' + (icons[div] || '🏅') + ' ' + div + '</h4>';
          html += '<span class="text-[10px] font-bold px-2 py-1 rounded ' + (teams.length >= 2 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400') + '">' + teams.length + ' equipos</span></div>';
          if (teams.length === 0) {
            html += '<p class="text-slate-600 text-xs italic pointer-events-none">Sin equipos asignados</p>';
          } else {
            html += '<div class="space-y-1">';
            teams.forEach(function (t) {
              html += '<div draggable="true" ondragstart="dragStartBuilderTeam(event, \'' + div + '\', ' + t.row + ')" class="flex items-center justify-between bg-slate-800/60 rounded px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-700/60 transition-colors">';
              html += '<span class="text-white text-xs font-bold truncate pointer-events-none">' + escapeHtmlSafe(t.name) + ' <span class="text-slate-500 font-normal">(' + escapeHtmlSafe(t.avgElo || '?') + ')</span></span>';
              html += '<div class="flex items-center">';
              html += '<select onchange="moveBuilderTeamToDiv(\'' + div + '\', ' + t.row + ', this.value)" class="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] rounded px-1 py-0.5 ml-2 cursor-pointer">';
              html += '<option value="">Mover...</option>';
              _seasonBuilderData.divisions.forEach(function (d) { if (d !== div) html += '<option value="' + d + '">' + d + '</option>'; });
              html += '</select>';
              html += '<button onclick="moveBuilderTeam(\'' + div + '\',' + t.row + ',\'_remove\')" class="text-red-500 hover:text-red-400 text-sm ml-2" title="Desasignar">✕</button>';
              html += '</div></div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
        html += '</div>';

        html += '<div class="bg-slate-900/40 border border-dashed border-slate-600 rounded-xl p-4 mb-4 transition-colors duration-200 min-h-[100px]" ondragover="allowDropBuilderTeam(event)" ondragleave="dragLeaveBuilderTeam(event)" ondrop="dropBuilderTeam(event, \'_sin_asignar\')">';
        html += '<h4 class="font-oswald text-slate-400 tracking-widest text-xs uppercase mb-3 pointer-events-none">📦 Sin división preferida — asígnalos manualmente</h4>';
        if (unassigned.length > 0) {
          html += '<div class="space-y-1">';
          unassigned.forEach(function (t) {
            html += '<div draggable="true" ondragstart="dragStartBuilderTeam(event, \'_sin_asignar\', ' + t.row + ')" class="flex items-center justify-between bg-slate-800/40 rounded px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-slate-700/60 transition-colors">';
            html += '<span class="text-white text-xs font-bold truncate pointer-events-none">' + escapeHtmlSafe(t.name) + '</span>';
            html += '<select onchange="assignBuilderTeam(' + t.row + ', this.value)" class="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] rounded px-1 py-0.5 ml-2 cursor-pointer">';
            html += '<option value="">→ división...</option>';
            _seasonBuilderData.divisions.forEach(function (d) { html += '<option value="' + d + '">' + d + '</option>'; });
            html += '</select></div>';
          });
          html += '</div>';
        } else {
            html += '<p class="text-slate-600 text-xs italic pointer-events-none text-center mt-2">Arrastra equipos aquí para desasignarlos</p>';
        }
        html += '</div>';

        cont.innerHTML = html;
      }

      function moveBuilderTeamToDiv(sourceDiv, row, targetDiv) {
        if (!targetDiv || sourceDiv === targetDiv) return;
        const sourceTeams = sourceDiv === "_sin_asignar" ? _seasonBuilderData.byDivision["_sin_asignar"] : _builderAssignments[sourceDiv];
        if(!sourceTeams) return;
        const team = sourceTeams.find(function(t) { return t.row === row; });
        if (!team) return;

        if (sourceDiv === "_sin_asignar") {
          _seasonBuilderData.byDivision["_sin_asignar"] = sourceTeams.filter(function(t) { return t.row !== row; });
        } else {
          _builderAssignments[sourceDiv] = sourceTeams.filter(function(t) { return t.row !== row; });
        }

        if (targetDiv === "_sin_asignar") {
          if (!_seasonBuilderData.byDivision["_sin_asignar"]) _seasonBuilderData.byDivision["_sin_asignar"] = [];
          _seasonBuilderData.byDivision["_sin_asignar"].push(team);
        } else {
          if (!_builderAssignments[targetDiv]) _builderAssignments[targetDiv] = [];
          _builderAssignments[targetDiv].push(team);
        }
        renderSeasonBuilder();
      }

      function dragStartBuilderTeam(ev, sourceDiv, row) {
        ev.dataTransfer.setData("sourceDiv", sourceDiv);
        ev.dataTransfer.setData("row", row);
        ev.dataTransfer.effectAllowed = "move";
      }

      function allowDropBuilderTeam(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        ev.currentTarget.classList.add('bg-slate-800/80');
        ev.currentTarget.classList.add('border-cyan-500');
      }

      function dragLeaveBuilderTeam(ev) {
        ev.currentTarget.classList.remove('bg-slate-800/80');
        ev.currentTarget.classList.remove('border-cyan-500');
      }

      function dropBuilderTeam(ev, targetDiv) {
        ev.preventDefault();
        ev.currentTarget.classList.remove('bg-slate-800/80');
        ev.currentTarget.classList.remove('border-cyan-500');
        const sourceDiv = ev.dataTransfer.getData("sourceDiv");
        const row = parseInt(ev.dataTransfer.getData("row"), 10);
        if (sourceDiv && !isNaN(row)) {
          moveBuilderTeamToDiv(sourceDiv, row, targetDiv);
        }
      }

      function assignBuilderTeam(row, division) {
        moveBuilderTeamToDiv('_sin_asignar', row, division);
      }

      function moveBuilderTeam(division, row, action) {
        if (action === "_remove") {
            moveBuilderTeamToDiv(division, row, '_sin_asignar');
        }
      }

      function createNewLeague() {
        const label = document.getElementById("sm-builder-label").value.trim();
        const format = document.getElementById("sm-builder-format").value;
        const archiveFirst = document.getElementById("sm-builder-archive").checked;
        if (!label) { alert("Pon una etiqueta para la nueva temporada."); return; }

        const divisions = [];
        const usedRows = [];
        Object.keys(_builderAssignments).forEach(function (div) {
          const teams = _builderAssignments[div] || [];
          if (teams.length >= 2) {
            divisions.push({
              name: div,
              teams: teams.map(function (t) {
                usedRows.push(t.row);
                return { name: t.name, roster: "", logo: t.logo || "" };
              })
            });
          }
        });

        if (divisions.length === 0) {
          alert("Necesitas al menos una división con 2+ equipos.");
          return;
        }

        const summary = divisions.map(function (d) { return d.name + ": " + d.teams.length; }).join(" · ");
        if (!confirm('⚠️ Esto BORRARÁ la liga actual y creará una nueva:\n\n' + summary + '\n\n' + (archiveFirst ? '✅ Se archivará el TOP 4 actual primero.\n\n' : '') + '¿Continuar?')) return;

        const adminKey = sessionStorage.getItem("wg_admin_pw") || "";
        const btn = document.getElementById("sm-create-btn");
        btn.disabled = true; btn.innerText = "⏳ Creando liga...";

        google.script.run
          .withSuccessHandler(function (res) {
            btn.disabled = false; btn.innerText = "🚀 CREAR NUEVA LIGA";
            alert(res.msg || (res.success ? "Liga creada" : "Error"));
            if (res.success) {
              google.script.run.markTeamPoolTeamsUsed(usedRows, adminKey);
              _divisionSelectorPopulated = false;
              sessionStorage.setItem("wg_active_division", "ALL");
              closeSeasonManager();
              refreshData();
            }
          })
          .withFailureHandler(function (err) {
            btn.disabled = false; btn.innerText = "🚀 CREAR NUEVA LIGA";
            alert("❌ Error: " + err.message);
          })
          .createMultiDivisionLeague({
            seasonLabel: label,
            format: format,
            divisions: divisions,
            archiveFirst: archiveFirst,
            previousSeasonLabel: document.getElementById("sm-builder-prevlabel").value.trim() || "Temporada anterior"
          }, adminKey);
      }

      // --- VISTA PREVIA DE PODIOS ---
      function loadPodiumsPreview() {
        const cont = document.getElementById("sm-podiums-content");
        cont.innerHTML = '<div class="text-center py-6 text-slate-500 animate-pulse">Cargando podios...</div>';
        google.script.run
          .withSuccessHandler(function (res) {
            renderPodiums(res.podiums || [], cont);
          })
          .withFailureHandler(function () {
            cont.innerHTML = '<div class="text-center py-6 text-red-400">Error al cargar.</div>';
          })
          .getSeasonPodiums();
      }

      // --- RENDER DE PODIOS (reutilizado en Salón de la Fama y en el modal) ---
      function renderPodiums(podiums, container) {
        if (!podiums || podiums.length === 0) {
          container.innerHTML = '<div class="text-center py-8 text-slate-500 text-sm">Aún no hay temporadas archivadas. Finaliza una liga para guardar el primer podio. 🏆</div>';
          return;
        }
        const divIcons = { 'Premier': '👑', 'Aspirante': '⚔️', 'Élite': '💎', 'Academia': '🎓', 'General': '🏆' };
        const medals = ['🥇', '🥈', '🥉', '4️⃣'];
        const medalColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600', 'text-slate-500'];

        let html = '';
        podiums.forEach(function (p) {
          const ic = divIcons[p.division] || '🏅';
          html += '<div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-5 shadow-lg">';
          html += '<div class="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">';
          html += '<div><div class="font-oswald text-xl text-cyan-300 tracking-widest uppercase">' + ic + ' ' + escapeHtmlSafe(p.division) + '</div>';
          html += '<div class="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">' + escapeHtmlSafe(p.season) + '</div></div>';
          html += '<div class="text-[10px] text-slate-600">' + new Date(p.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }) + '</div>';
          html += '</div>';
          html += '<div class="space-y-2">';
          p.top4.forEach(function (team, idx) {
            if (!team) return;
            const isChamp = idx === 0;
            html += '<div class="flex items-center gap-3 ' + (isChamp ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-slate-800/40') + ' rounded-lg px-3 py-2">';
            html += '<span class="text-xl ' + medalColors[idx] + '">' + medals[idx] + '</span>';
            html += '<span class="font-bold text-sm ' + (isChamp ? 'text-yellow-300' : 'text-white') + ' truncate">' + escapeHtmlSafe(team) + '</span>';
            if (isChamp) html += '<span class="ml-auto text-[9px] bg-yellow-500 text-black font-black px-2 py-0.5 rounded uppercase tracking-widest">Campeón</span>';
            html += '</div>';
          });
          html += '</div></div>';
        });
        container.innerHTML = html;
      }

      function escapeHtmlSafe(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }

      function promptStreamDate() {
        const dateStr = prompt(
          "Introduce la fecha del stream (Formato: AAAA-MM-DDTHH:MM):",
          "2026-03-15T21:00",
        );
        if (dateStr) {
          let safeDateStr = dateStr.replace(" ", "T");
          const btn = document.getElementById("btn-set-stream");
          btn.innerText = "⏳";
          btn.disabled = true;
          google.script.run
            .withSuccessHandler(function (res) {
              alert(res);
              btn.innerText = "🗓️ PROGRAMAR STREAM";
              btn.disabled = false;
              refreshData();
            })
            .setStreamDate(safeDateStr);
        }
      }

      function renderFeaturedPlayer(fp) {
        const el = document.getElementById("home-featured-player");
        if (!el) return;
        if (!fp || !fp.name) { el.classList.add("hidden"); return; }
        el.classList.remove("hidden");

        const champImg = fp.mainChamp ? getChampIcon(fp.mainChamp) : "";
        const wrColor = fp.winrate >= 60 ? "text-emerald-400" : fp.winrate >= 50 ? "text-yellow-400" : "text-red-400";

        el.className = "relative overflow-hidden bg-gradient-to-br from-yellow-900/40 via-slate-900 to-slate-900 border-2 border-yellow-500/50 rounded-2xl p-5 shadow-[0_0_25px_rgba(251,191,36,0.2)]";
        el.innerHTML =
          '<div class="absolute -right-6 -top-6 opacity-10 text-yellow-500 text-8xl font-black">★</div>' +
          '<div class="flex items-center gap-2 mb-3 relative z-10">' +
            '<span class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>' +
            '<span class="text-yellow-400 text-[10px] font-black uppercase tracking-widest">⭐ MVP de la ' + escHtml(fp.round || "Jornada") + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-4 relative z-10">' +
            (champImg ? '<img src="' + champImg + '" class="w-16 h-16 rounded-full border-2 border-yellow-500 shadow-lg flex-shrink-0" onerror="this.style.display=\'none\'">' : "") +
            '<div class="min-w-0 flex-1">' +
              '<div class="font-oswald text-2xl text-white tracking-wide truncate">' + escHtml(fp.name) + '</div>' +
              '<div class="text-slate-400 text-xs font-bold uppercase tracking-widest truncate">' + escHtml(fp.team || "") + ' · ' + escHtml(fp.role || "") + '</div>' +
            '</div>' +
            '<div class="text-right flex-shrink-0">' +
              '<div class="text-3xl font-black font-oswald text-yellow-400 leading-none">' + fp.points + '</div>' +
              '<div class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">PTS jornada</div>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-3 gap-2 mt-4 relative z-10">' +
            '<div class="bg-black/40 rounded-lg p-2 text-center"><div class="text-sm font-black text-white">' + (fp.kda || "-") + '</div><div class="text-[8px] text-slate-500 uppercase tracking-widest">KDA</div></div>' +
            '<div class="bg-black/40 rounded-lg p-2 text-center"><div class="text-sm font-black ' + wrColor + '">' + fp.winrate + '%</div><div class="text-[8px] text-slate-500 uppercase tracking-widest">WR</div></div>' +
            '<div class="bg-black/40 rounded-lg p-2 text-center"><div class="text-sm font-black text-red-400">' + fp.dpm + '</div><div class="text-[8px] text-slate-500 uppercase tracking-widest">DPM</div></div>' +
          '</div>';
      }

      function renderNextMatch(nm) {
        const el = document.getElementById("home-next-match");
        if (!el) return;
        if (!nm || (!nm.teamAName && !nm.teamBName)) { el.classList.add("hidden"); return; }
        el.classList.remove("hidden");

        const logoA = nm.teamALogo ? getLogo(nm.teamALogo) : "";
        const logoB = nm.teamBLogo ? getLogo(nm.teamBLogo) : "";

        let dateStr = "Por programar";
        if (nm.date && String(nm.date).trim() !== "" && String(nm.date) !== "undefined") {
          try {
            let d = new Date(String(nm.date).replace(" ", "T"));
            dateStr = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) +
              " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          } catch(e) { dateStr = String(nm.date); }
        }

        el.className = "relative overflow-hidden bg-gradient-to-br from-blue-900/30 via-slate-900 to-slate-900 border-2 border-blue-500/40 rounded-2xl p-5 shadow-[0_0_25px_rgba(56,189,248,0.15)] cursor-pointer hover:border-blue-400/70 transition";
        el.onclick = function() { openMatchScouting(nm.id); };
        el.innerHTML =
          '<div class="flex items-center gap-2 mb-3 relative z-10">' +
            '<span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>' +
            '<span class="text-blue-400 text-[10px] font-black uppercase tracking-widest">📅 Próximo Enfrentamiento · ' + escHtml(nm.round || "") + '</span>' +
          '</div>' +
          '<div class="flex items-center justify-between gap-3 relative z-10">' +
            '<div class="flex flex-col items-center flex-1 min-w-0">' +
              (logoA ? '<img src="' + logoA + '" class="w-14 h-14 object-contain mb-1" onerror="this.style.display=\'none\'">' : '<div class="w-14 h-14 rounded-full bg-slate-800 mb-1"></div>') +
              '<div class="text-xs font-bold text-white text-center truncate w-full">' + escHtml(nm.teamAName) + '</div>' +
              '<div class="text-[9px] text-emerald-400 font-bold">' + (nm.teamAWins||0) + 'W-' + (nm.teamALosses||0) + 'L</div>' +
            '</div>' +
            '<div class="flex flex-col items-center flex-shrink-0">' +
              '<div class="text-2xl font-black font-oswald text-slate-600">VS</div>' +
            '</div>' +
            '<div class="flex flex-col items-center flex-1 min-w-0">' +
              (logoB ? '<img src="' + logoB + '" class="w-14 h-14 object-contain mb-1" onerror="this.style.display=\'none\'">' : '<div class="w-14 h-14 rounded-full bg-slate-800 mb-1"></div>') +
              '<div class="text-xs font-bold text-white text-center truncate w-full">' + escHtml(nm.teamBName) + '</div>' +
              '<div class="text-[9px] text-emerald-400 font-bold">' + (nm.teamBWins||0) + 'W-' + (nm.teamBLosses||0) + 'L</div>' +
            '</div>' +
          '</div>' +
          '<div class="mt-3 text-center bg-black/40 rounded-lg py-2 relative z-10">' +
            '<div class="text-sm font-black text-blue-300">' + dateStr + '</div>' +
            '<div class="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Click para ver el scouting</div>' +
          '</div>';
      }

      function processNews(data) {
        if (!data) return;
        if (newsTimer) clearInterval(newsTimer);
        const streamDate = new Date(data.streamDate);
        if (!data.streamDate || isNaN(streamDate.getTime())) {
          document.getElementById("stream-info").innerText =
            "A FILAR LAS HACHAS";
          document.getElementById("timer-display").innerText =
            "RECARGANDO PILAS 🔋";
          document.getElementById("top-countdown").classList.add("hidden");
        } else {
          document.getElementById("stream-info").innerText =
            "STREAM: " + streamDate.toLocaleString();
          newsTimer = setInterval(function () {
            const now = new Date().getTime();
            const dist = streamDate.getTime() - now;
            if (dist < 0) {
              // Si han pasado más de 6 horas desde el inicio, asumimos que acabó
              if (dist < -21600000) {
                document.getElementById("stream-info").innerText =
                  "A FILAR LAS HACHAS";
                document.getElementById("timer-display").innerText =
                  "RECARGANDO PILAS 🔋";
                document
                  .getElementById("top-countdown")
                  .classList.add("hidden");
                return;
              }
              document.getElementById("timer-display").innerText =
                "🔴 EN DIRECTO";
              document.getElementById("timer-compact").innerText =
                "🔴 EN DIRECTO";
              document
                .getElementById("top-countdown")
                .classList.remove("hidden");
              return;
            }
            const d = Math.floor(dist / 86400000);
            const h = Math.floor((dist % 86400000) / 3600000);
            const m = Math.floor((dist % 3600000) / 60000);
            const s = Math.floor((dist % 60000) / 1000);
            const txt = d + "d " + h + "h " + m + "m " + s + "s";
            document.getElementById("timer-display").innerText = txt;
            document.getElementById("timer-compact").innerText = txt;
            document.getElementById("top-countdown").classList.remove("hidden");
          }, 1000);
        }

        const feed = document.getElementById("news-feed");
        feed.innerHTML = "";
        if (data.headlines) {
          data.headlines.forEach((h) => {
            let isGazette = h.type.includes("GACETA");
            let clickAction = isGazette ? 'onclick="openGazette()"' : "";
            let cursor = isGazette ? "cursor-pointer hover:scale-[1.01]" : "";
            let typeColor = "#fbbf24"; // default gold
            if (h.type.includes("ALERTA"))
              typeColor = "#ef4444"; // red
            else if (h.type.includes("IA")) typeColor = "#818cf8"; // indigo

            let formattedText = h.text
              .replace(
                /\*\*(.*?)\*\*/g,
                '<strong style="color:' + (typeColor) + '">$1</strong>',
              )
              .replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" class="text-blue-400 hover:underline">$1</a>',
              );
            feed.innerHTML += ' <div ' + (clickAction) +
              ' class="bg-slate-800/80 border border-slate-700 transition-all border-l-4 shadow-md rounded-r-xl p-4 md:p-5 mb-4 ' +
              (cursor) + '"  style="border-left-color: ' + (typeColor) +
              ';"> <div class="flex items-center gap-2 mb-2"> <span class="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-900" style="color: ' +
              (typeColor) + ';">' + (h.type) +
              '</span> </div> <p class="text-slate-200 text-base md:text-lg leading-relaxed">' + (formattedText) +
              '</p> </div> ';
          });
        }
      }

      function renderPowerRankings() {
        if (!tournamentDataCache || !tournamentDataCache.teams) return;
        const ctx = document.getElementById("powerRankChart").getContext("2d");
        if (powerChart) powerChart.destroy();

        let powerTeams = [...tournamentDataCache.teams];
        powerTeams.sort((a, b) => b.powerScore - a.powerScore);

        const getBarColor = (t) => {
          // Color por posición en la clasificación oficial
          if (t.pos <= 4)
            return { bg: "rgba(16, 185, 129, 0.6)", border: "#10b981" }; // Top 4 = verde (Upper)
          if (t.pos <= 10)
            return { bg: "rgba(251, 191, 36, 0.5)", border: "#f59e0b" }; // 5-10 = amarillo (Play-In)
          return { bg: "rgba(239, 68, 68, 0.4)", border: "#ef4444" }; // Fuera = rojo
        };

        powerChart = new Chart(ctx, {
          type: "bar",
          data: {
            labels: powerTeams.map((t) => t.name),
            datasets: [
              {
                label: "Power Score",
                data: powerTeams.map((t) => t.powerScore),
                backgroundColor: powerTeams.map((t) => getBarColor(t).bg),
                borderColor: powerTeams.map((t) => getBarColor(t).border),
                borderWidth: 2,
                borderRadius: 6,
              },
            ],
          },
          options: {
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                titleFont: { family: "Oswald", size: 16 },
                bodyFont: { family: "Inter", size: 13 },
                padding: 15,
                borderColor: "#334155",
                borderWidth: 1,
                callbacks: {
                  label: function (context) {
                    let t = powerTeams[context.dataIndex];
                    let lines = [];
                    lines.push(
                      '⚡ Power Score: ' + (t.powerScore.toFixed(1)) + ' pts',
                    );
                    lines.push(
                      '⚔️ Calidad de Victorias: +' + (t.breakdown.winQ.toFixed(0)),
                    );
                    lines.push(
                      '🛡️ Penalización Derrotas: -' + (t.breakdown.lossG.toFixed(0)),
                    );
                    lines.push(
                      '🤝 H2H Dominance: ' + (t.breakdown.h2hDom >= 0 ? "+" : "") + (t.breakdown.h2hDom.toFixed(0)) + ' (' +
                        (t.breakdown.h2hW) + 'W-' + (t.breakdown.h2hL) + 'L)',
                    );
                    lines.push(
                      '📊 SoS (Fuerza Calendario): +' + (t.breakdown.sos.toFixed(1)),
                    );
                    lines.push(
                      '📈 Consistencia: +' + (t.breakdown.consist.toFixed(1)),
                    );
                    let rachaIcon =
                      t.streak >= 2 ? "🔥" : t.streak <= -2 ? "🧊" : "➖";
                    lines.push(
                      (rachaIcon) + ' Racha: ' + (t.streak > 0 ? "+" + t.streak : t.streak) + ' (' +
                        (t.breakdown.streakB >= 0 ? "+" : "") + (t.breakdown.streakB.toFixed(1)) + ' pts)',
                    );
                    return lines;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(51, 65, 85, 0.3)" },
                ticks: { color: "#94a3b8", font: { family: "Oswald" } },
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: "#f1f5f9",
                  font: { family: "Inter", size: 13, weight: "600" },
                  callback: function (value, index, values) {
                    return '#' + (index + 1) + '  ' + (this.getLabelForValue(value).toUpperCase());
                  },
                },
              },
            },
            animation: { duration: 2000, easing: "easeOutQuart" },
          },
        });
      }

      function renderDashboard(data) {
        document.getElementById("dashboard-state").style.display = "flex";

        const getMatchHypeInfo = (m) => {
          let names = String(m.names || "").split(" vs ");
          let tA = data.teams.find((t) => t.name === names[0].trim());
          let tB = data.teams.find((t) => t.name === names[1].trim());
          let hype = ((m.votesA || 0) + (m.votesB || 0)) * 5;
          let tag = "🔥 EL PARTIDAZO";

          if (tA && tB) {
            let wrA = tA.w / Math.max(1, tA.w + tA.l);
            let wrB = tB.w / Math.max(1, tB.w + tB.l);
            hype += (wrA + wrB) * 50;
            let diffPos = Math.abs(tA.pos - tB.pos);
            if (diffPos === 1) hype += 40;
            else if (diffPos <= 3) hype += 20;

            hype += (tA.w + tB.w) * 5;

            if (tA.pos <= 2 && tB.pos <= 2) {
              hype += 60;
              tag = "👑 DUELO DE REYES";
            } else if (tA.pos <= 4 && tB.pos <= 4) {
              hype += 45;
              tag = "⚔️ LUCHA POR EL TOP 4";
            } else if (tA.streak >= 2 && tB.streak >= 2) {
              hype += 40;
              tag = "🔥 CHOQUE DE RACHAS";
            } else if (
              diffPos <= 2 &&
              Math.max(tA.pos, tB.pos) <= 10 &&
              Math.max(tA.pos, tB.pos) >= 8
            ) {
              hype += 35;
              tag = "⚠️ AL BORDE DEL ABISMO";
            } else if (tA.pos === 1 || tB.pos === 1) {
              hype += 20;
              tag = "🛡️ CAZANDO AL LÍDER";
            } else if (diffPos === 1) {
              tag = "🧮 DUELO DIRECTO";
            }
          }
          return { match: m, score: hype, tag: tag, tA: tA, tB: tB };
        };

        let pendingMatches = data.matches.filter(
          (m) => m.status !== "COMPLETED",
        );
        let globalMotw = null;
        let globalMotwTag = "🔥 PARTIDO DESTACADO";

        if (pendingMatches.length > 0) {
          // 🟢 PRIORIDAD 1: El partido FUTURO con fecha más cercana a AHORA
          let now = new Date();
          let matchesWithDate = pendingMatches.filter(
            (m) =>
              m.date &&
              String(m.date).trim() !== "" &&
              String(m.date) !== "undefined",
          );

          if (matchesWithDate.length > 0) {
            // Filtrar solo partidos FUTUROS
            let futureMatches = matchesWithDate.filter((m) => {
              let d = new Date(String(m.date).replace(" ", "T"));
              return !isNaN(d.getTime()) && d > now;
            });

            if (futureMatches.length > 0) {
              // Ordenar por proximidad a ahora (el más cercano primero)
              futureMatches.sort((a, b) => {
                let dA = new Date(String(a.date).replace(" ", "T"));
                let dB = new Date(String(b.date).replace(" ", "T"));
                return dA - now - (dB - now);
              });
              let closestInfo = getMatchHypeInfo(futureMatches[0]);
              globalMotw = closestInfo.match;
              globalMotwTag = closestInfo.tag;
            } else {
              // Todos los partidos con fecha ya pasaron, usar hype
              let analyzedMatches = pendingMatches.map(getMatchHypeInfo);
              analyzedMatches.sort((a, b) => b.score - a.score);
              globalMotw = analyzedMatches[0].match;
              globalMotwTag = analyzedMatches[0].tag;
            }
          } else {
            // PRIORIDAD 2: Sin fechas, usar hype de TODOS los pendientes
            let analyzedMatches = pendingMatches.map(getMatchHypeInfo);
            analyzedMatches.sort((a, b) => b.score - a.score);
            globalMotw = analyzedMatches[0].match;
            globalMotwTag = analyzedMatches[0].tag;
          }
        } else if (data.matches.length > 0) {
          globalMotw = data.matches[data.matches.length - 1];
          globalMotwTag = "🏆 ÚLTIMO PARTIDO";
        }

        const tickerContainer = document.getElementById("top-ticker");
        const completedForTicker = data.matches
          .filter((m) => m.status === "COMPLETED")
          .reverse()
          .slice(0, 5);

        if (completedForTicker.length > 0) {
          let tickerHtml = '<div class="ticker-track">';
          for (let i = 0; i < 2; i++) {
            completedForTicker.forEach((m) => {
              let names = String(m.names).split(" vs ");
              let tA = data.teams.find((t) => t.name === names[0].trim());
              let tB = data.teams.find((t) => t.name === names[1].trim());
              let logoA = tA ? getLogo(tA.logo) : getLogo("");
              let logoB = tB ? getLogo(tB.logo) : getLogo("");
              let sA = parseInt(m.sA) || 0;
              let sB = parseInt(m.sB) || 0;
              let colorA = sA > sB ? "text-white" : "text-slate-500";
              let colorB = sB > sA ? "text-white" : "text-slate-500";
              let safeRiotId = m.riotId || m.id;

              tickerHtml += '<div class="ticker-item flex items-center gap-3 px-6 py-2 border-r border-slate-700 cursor-pointer hover:bg-slate-800 transition" onclick="openPostGame(\'' +
                (m.id) + '\', \'' + (safeRiotId) + '\')">';
              tickerHtml += '<span class="font-oswald text-sm tracking-widest uppercase ' + (colorA) + '">' +
                (escHtml(names[0])) + '</span>';
              tickerHtml += '<img src="' + (logoA) + '" class="w-6 h-6 object-contain">';
              tickerHtml += '<span class="bg-black border border-slate-600 text-white px-2 py-0.5 rounded font-black text-sm shadow-inner">' +
                (sA) + ' - ' + (sB) + '</span>';
              tickerHtml += '<img src="' + (logoB) + '" class="w-6 h-6 object-contain">';
              tickerHtml += '<span class="font-oswald text-sm tracking-widest uppercase ' + (colorB) + '">' +
                (escHtml(names[1])) + '</span></div>';
            });
          }
          tickerHtml += "</div>";
          tickerContainer.innerHTML = tickerHtml;
          tickerContainer.classList.remove("hidden");
        } else {
          tickerContainer.classList.add("hidden");
        }

        const tbody = document.getElementById("standings-body");
        let htmlStandings = "";

        data.teams.forEach((t, i) => {
          let teamMatches = data.matches
            .filter(
              (m) => m.status === "COMPLETED" && (m.tA == t.id || m.tB == t.id),
            )
            .slice(-5);
          let historialL5 = [];
          teamMatches.forEach((m) => {
            historialL5.push(
              (m.tA == t.id && m.sA > m.sB) || (m.tB == t.id && m.sB > m.sA)
                ? "V"
                : "D",
            );
          });
          let pos = i + 1;
          let rowColor = "hover:bg-slate-800/50";

          if (pos <= 4)
            rowColor =
              "bg-emerald-900/20 hover:bg-emerald-900/40 border-l-4 border-l-emerald-500";
          else if (pos <= 10)
            rowColor =
              "bg-yellow-900/10 hover:bg-yellow-900/30 border-l-4 border-l-yellow-500";
          else
            rowColor =
              "bg-red-900/10 hover:bg-red-900/30 border-l-4 border-l-red-500";

          htmlStandings += '<tr class="cursor-pointer border-b border-slate-700/50 transition-colors ' + (rowColor) +
            '" onclick="openTeamHub(\'' + (enc(t.name)) + '\', ' + (t.w || 0) + ', ' + (t.l || 0) + ', 0, \'' +
            (enc(t.roster)) + '\', \'' + (enc(t.logo)) + '\')">';
          htmlStandings += '<td class="font-oswald text-xl text-slate-400 pl-4">' + (t.pos) + '</td>';
          htmlStandings += '<td class="text-xl font-bold text-white py-3 flex items-center"><img src="' + (getLogo(t.logo)) +
            '" class="w-8 h-8 rounded-md bg-black border border-slate-600" style="margin-right: 8px;">' +
            (escHtml(t.name)) + '</td>';
          htmlStandings += '<td class="text-center font-bold text-emerald-400">' + (t.w) + '</td>';
          htmlStandings += '<td class="text-center font-bold text-red-400">' + (t.l) + '</td>';
          htmlStandings += '<td class="text-center">' + (generarHistorialForma(historialL5, t.streak)) + '</td></tr>';
        });
        tbody.innerHTML = htmlStandings;

        // 🟢 CÓDIGO DE LA MATRIZ DE RESULTADOS ELIMINADO PARA MEJORAR RENDIMIENTO

        const homeMotwContainer = document.getElementById(
          "home-motw-container",
        );
        const motwContainer = document.getElementById("motw-container");

        // 🟢 SYNC STREAM WITH CLOSEST MATCH
        let now = new Date();
        let closestMatch = null;
        let minDiff = Infinity;
        data.matches.forEach((m) => {
          if (m.date && m.status !== "COMPLETED") {
            let dStr = String(m.date).trim();
            let d = new Date(dStr);
            if (isNaN(d.getTime()) && dStr.includes(" "))
              d = new Date(dStr.replace(" ", "T"));
            let diff = d - now;
            if (diff > 0 && diff < minDiff) {
              minDiff = diff;
              closestMatch = m;
            }
          }
        });

        if (closestMatch) {
          let mDateStr = String(closestMatch.date).trim();
          let mDate = new Date(mDateStr);
          if (isNaN(mDate.getTime()) && mDateStr.includes(" "))
            mDate = new Date(mDateStr.replace(" ", "T"));
          if (!isNaN(mDate.getTime())) updateGlobalStreamTimer(mDate);
        }

        if (globalMotw) {
          let names = String(globalMotw.names || "").split(" vs ");
          let tA = data.teams.find((t) => t.name === names[0].trim());
          let tB = data.teams.find((t) => t.name === names[1].trim());
          let logoA = tA ? getLogo(tA.logo) : getLogo("");
          let logoB = tB ? getLogo(tB.logo) : getLogo("");
          let isPlayed = globalMotw.status === "COMPLETED";
          let mId = globalMotw.id;

          let motwDateBadge =
            '<span class="text-slate-400 font-bold">🗓️ TBD (Por fijar)</span>';
          if (isPlayed) {
            motwDateBadge =
              '<span class="text-emerald-400 font-bold">✅ PARTIDO FINALIZADO</span>';
          } else if (
            globalMotw.date &&
            String(globalMotw.date).trim() !== "" &&
            String(globalMotw.date) !== "undefined"
          ) {
            let rawStr = String(globalMotw.date).trim();
            let dObj = new Date(rawStr);
            if (isNaN(dObj.getTime()) && rawStr.includes(" "))
              dObj = new Date(rawStr.replace(" ", "T"));
            if (!isNaN(dObj.getTime())) {
              let dStr =
                dObj.toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                }) +
                " a las " +
                dObj.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              motwDateBadge = '<span class="text-accent-blue font-bold drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]">🗓️ ' + (dStr) +
                '</span>';
            } else {
              motwDateBadge = '<span class="text-accent-blue font-bold drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]">🗓️ ' +
                (rawStr) + '</span>';
            }
          }

          let centerUI = "";
          let clickEvt = isPlayed
            ? 'onclick="openPostGame(\'' + (globalMotw.id) + '\', \'' + (globalMotw.riotId || globalMotw.id) +
              '\')" '
            : 'onclick="openMatchScouting(\'' + (globalMotw.id) + '\')" ';

          if (isPlayed) {
            centerUI = '<div class="text-4xl md:text-6xl font-black text-white bg-black/60 px-6 py-2 rounded-2xl border-2 border-slate-600 shadow-inner">' +
              (globalMotw.sA) + ' - ' + (globalMotw.sB) + '</div>';
          } else {
            let powerA = tA && tA.powerScore ? tA.powerScore : 10;
            let powerB = tB && tB.powerScore ? tB.powerScore : 10;

            let statProbA = powerA / (powerA + powerB);
            let statProbB = powerB / (powerA + powerB);

            let volA = globalMotw.volA || 0;
            let volB = globalMotw.volB || 0;
            let totalVol = volA + volB;

            let finalProbA, finalProbB;

            if (totalVol === 0) {
              finalProbA = statProbA;
              finalProbB = statProbB;
            } else {
              let marketProbA = (volA + 1000) / (totalVol + 2000);
              let marketProbB = (volB + 1000) / (totalVol + 2000);
              finalProbA = marketProbA * 0.8 + statProbA * 0.2;
              finalProbB = marketProbB * 0.8 + statProbB * 0.2;
            }

            let oddsA = Math.max(1.05, (1 / finalProbA) * 0.95).toFixed(2);
            let oddsB = Math.max(1.05, (1 / finalProbB) * 0.95).toFixed(2);

            let safeNameA = enc(names[0]);
            let safeNameB = enc(names[1]);

            let vsBtn =
              currentUserRole === "admin"
                ? '<button onclick="event.stopPropagation(); openModalScore(event, \'' + (globalMotw.id) + '\', \'' +
                  (safeNameA) + '\', \'' + (safeNameB) +
                  '\')" title="Anotar Resultado" class="bg-yellow-500 text-black px-6 py-3 text-3xl font-black rounded-xl hover:bg-yellow-400 transition shadow-[0_0_20px_rgba(251,191,36,0.6)] z-10 mx-6 hover:scale-110 relative">VS</button>'
                : '<div class="bg-slate-900 text-yellow-500 px-6 py-3 text-3xl font-black rounded-xl uppercase tracking-widest border-2 border-yellow-500/50 shadow-[0_0_20px_rgba(251,191,36,0.4)] mx-6 relative z-10">VS</div>';

            centerUI = '<div class="flex items-center justify-center gap-4 w-full z-10 relative">';
            centerUI += '<button onclick="event.stopPropagation(); openCasinoModal(\'' + (globalMotw.id) + '\', \'' +
              (safeNameA) + '\', \'' + (oddsA) +
              '\', 0)" class="text-4xl font-oswald text-yellow-400 bg-yellow-500/10 border-2 border-yellow-500/50 px-6 py-2 rounded-xl hover:bg-yellow-500 hover:text-black transition hover:scale-110 drop-shadow-lg relative z-20">x' +
              (oddsA) + '</button>';
            centerUI += vsBtn;
            centerUI += '<button onclick="event.stopPropagation(); openCasinoModal(\'' + (globalMotw.id) + '\', \'' +
              (safeNameB) + '\', \'' + (oddsB) +
              '\', 1)" class="text-4xl font-oswald text-yellow-400 bg-yellow-500/10 border-2 border-yellow-500/50 px-6 py-2 rounded-xl hover:bg-yellow-500 hover:text-black transition hover:scale-110 drop-shadow-lg relative z-20">x' +
              (oddsB) + '</button></div>';
          }

          let mMotw = '<div class="max-w-4xl mx-auto mb-10 relative rounded-3xl overflow-hidden border-2 border-yellow-500 shadow-[0_0_40px_rgba(251,191,36,0.25)] cursor-pointer hover:scale-[1.02] transition-transform duration-300" ' +
            (clickEvt) + '>';
          mMotw += '<div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-0"></div><div class="absolute inset-0 bg-[url(\'https://images.contentstack.io/api/v1/assets/5931bc10-d8d5-4dc2-a720-032a84352a16/e4df94cc-19d1-41d8-a1fb-3b4ee3f7e5d8/Summoners_Rift_1.jpg\')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>';

          // ⚙️ BOTÓN DE GESTIÓN DISIMULADO (ESQUINA SUPERIOR IZQUIERDA)
          mMotw += '<button onclick="event.stopPropagation(); openNegotiationModal(\'' + (globalMotw.id) +
            '\')" class="absolute top-4 left-4 z-30 bg-slate-900/60 hover:bg-yellow-500 border border-yellow-500/30 text-yellow-500 hover:text-black p-2 rounded-lg transition-all shadow-lg active:scale-90 group" title="Gestionar Partido"> <div class="text-lg group-hover:rotate-90 transition-transform duration-500">⚙️</div> </button>';
          mMotw += '<div class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-slate-900 border-b border-x border-yellow-500/50 px-6 py-1 rounded-b-lg text-[10px] md:text-xs uppercase tracking-widest z-20 shadow-md">' +
            (motwDateBadge) + '</div>';
          mMotw += '<div class="relative z-10 p-6 md:p-10 flex flex-col items-center mt-4"><div class="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black text-sm md:text-base font-black px-6 py-1.5 rounded-full mb-4 tracking-widest uppercase shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse">' +
            (globalMotwTag) + '</div>';
          mMotw += '<div class="text-sm md:text-lg text-slate-400 font-oswald tracking-widest mb-6 uppercase bg-black/40 px-4 py-1 rounded-full border border-slate-700">' +
            (globalMotw.round) + '</div>';

          // 🟢 TIPOGRAFÍA NÍTIDA: font-black (Inter) en vez de font-oswald
          mMotw += '<div class="flex w-full justify-between items-center mt-2"><div class="flex flex-col items-center flex-1 w-0"><img src="' +
            (logoA) +
            '" class="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-4"><div class="text-center font-black tracking-wide text-xl md:text-3xl text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] px-2 leading-tight break-words">' +
            (escHtml(names[0])) + '</div></div>';
          mMotw += '<div class="flex-shrink-0 flex justify-center items-center px-2">' + (centerUI) + '</div>';
          mMotw += '<div class="flex flex-col items-center flex-1 w-0"><img src="' + (logoB) +
            '" class="w-20 h-20 md:w-28 md:h-28 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-4"><div class="text-center font-black tracking-wide text-xl md:text-3xl text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] px-2 leading-tight break-words">' +
            (escHtml(names[1])) + '</div></div></div></div></div>';

          let homeMotwContainer = document.getElementById(
            "home-motw-container",
          );
          if (homeMotwContainer) {
            let hMotw = '<div class="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden cursor-pointer hover:border-accent-blue transition" onclick="switchTab(\'matches\', document.getElementById(\'btn-tab-matches\'))">';
            hMotw += '<div class="absolute top-0 right-0 bg-accent-blue text-black font-black text-[10px] px-3 py-1 rounded-bl-lg uppercase tracking-widest">' +
              (globalMotwTag) + '</div>';
            hMotw += '<div class="text-center font-oswald text-slate-400 mb-4 tracking-widest text-sm uppercase">Próximo Enfrentamiento</div>';
            hMotw += '<div class="flex justify-center items-center gap-6"><img src="' + (logoA) +
              '" class="w-16 h-16 object-contain"><div class="text-2xl font-black text-white font-oswald text-shadow">VS</div><img src="' +
              (logoB) + '" class="w-16 h-16 object-contain"></div>';
            hMotw += '<div class="text-center mt-4 text-white font-bold text-lg">' + (escHtml(names[0])) +
              ' <span class="text-slate-500 font-normal text-sm mx-2">vs</span> ' + (escHtml(names[1])) +
              '</div></div>';
            homeMotwContainer.innerHTML = hMotw;
          }
          motwContainer.innerHTML = mMotw;
        } else {
          let homeMotwContainer = document.getElementById(
            "home-motw-container",
          );
          if (homeMotwContainer) homeMotwContainer.innerHTML = "";
          motwContainer.innerHTML = "";
        }

        const recentContainer = document.getElementById("home-recent-results");
        const completedMatches = data.matches
          .filter((m) => m.status === "COMPLETED")
          .reverse()
          .slice(0, 6);

        if (completedMatches.length > 0) {
          let rrHtml =
            '<h3 class="font-oswald text-white text-xl tracking-widest mb-4 uppercase">⏱️ Últimos Resultados</h3><div class="space-y-3">';
          completedMatches.forEach((m) => {
            let names = m.names.split(" vs ");
            rrHtml += '<div class="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center cursor-pointer hover:border-accent-blue transition" onclick="openPostGame(\'' +
              (m.id) + '\', \'' + (m.riotId || m.id) + '\')">';
            rrHtml += '<div class="text-xs font-bold text-slate-300 w-[40%] truncate text-right">' + (escHtml(names[0])) +
              '</div>';
            rrHtml += '<div class="text-xs font-black text-white bg-black px-2 py-1 rounded mx-2 border border-slate-700 shadow-inner whitespace-nowrap">' +
              (m.sA) + ' - ' + (m.sB) + '</div>';
            rrHtml += '<div class="text-xs font-bold text-slate-300 w-[40%] truncate text-left">' + (escHtml(names[1])) +
              '</div></div>';
          });
          rrHtml += "</div>";
          recentContainer.innerHTML = rrHtml;
          recentContainer.classList.remove("hidden");
        }

        const mContainer = document.getElementById("matches-list");
        mContainer.innerHTML = "";

        // 🟢 NUEVO: SELECTORES DE FILTRO
        let jornadas = [...new Set(data.matches.map((m) => m.round))];
        let filterHtml = ' <div class="flex flex-wrap gap-4 mb-8 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-inner"> <div class="flex-1 min-w-[200px]"> <label class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 block">Filtrar por Jornada</label> <select id="filter-match-jornada" onchange="renderDashboard(tournamentDataCache)" class="hex-input bg-slate-900 border-slate-700 text-sm"> <option value="ALL">Todas las Jornadas</option> ' +
          (jornadas.map((j) => '<option value="' + (j) + '">' + (j) + '</option>').join("")) +
          ' </select> </div> <div class="flex-1 min-w-[200px]"> <label class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5 block">Filtrar por Fecha</label> <input type="date" id="filter-match-date" onchange="renderDashboard(tournamentDataCache)" class="hex-input bg-slate-900 border-slate-700 text-sm"> </div> <button onclick="resetMatchFilters()" class="self-end bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-black transition uppercase tracking-widest shadow-lg">LIMPIAR</button> </div> ';
        // filterHtml se acumula en matchesAccHtml más abajo

        let filteredMatches = [...data.matches];
        const fJornada =
          document.getElementById("filter-match-jornada")?.value || "ALL";
        const fDate = document.getElementById("filter-match-date")?.value || "";

        if (fJornada !== "ALL")
          filteredMatches = filteredMatches.filter((m) => m.round === fJornada);
        if (fDate) {
          filteredMatches = filteredMatches.filter((m) => {
            if (!m.date) return false;
            let d = new Date(String(m.date).replace(" ", "T"));
            let filterD = new Date(fDate);
            return d.toDateString() === filterD.toDateString();
          });
        }

        const finalMatches = filteredMatches.filter(
          (m) => !globalMotw || m.id !== globalMotw.id,
        );

        const proximos = finalMatches.filter(
          (m) =>
            m.status !== "COMPLETED" &&
            m.date &&
            String(m.date).trim() !== "" &&
            String(m.date) !== "undefined",
        );
        // 🟢 Ordenar por fecha más cercana primero
        proximos.sort((a, b) => {
          let dA = new Date(String(a.date).replace(" ", "T"));
          let dB = new Date(String(b.date).replace(" ", "T"));
          return dA - dB;
        });
        const pendientes = finalMatches.filter(
          (m) =>
            m.status !== "COMPLETED" &&
            (!m.date ||
              String(m.date).trim() === "" ||
              String(m.date) === "undefined"),
        );
        const completados = finalMatches.filter(
          (m) => m.status === "COMPLETED",
        );

        const groups = [
          {
            title: "🔥 PRÓXIMOS ENFRENTAMIENTOS",
            data: proximos,
            color: "text-accent-blue border-accent-blue/30",
          },
          {
            title: "⏳ PARTIDOS PENDIENTES (Sin fecha)",
            data: pendientes,
            color: "text-yellow-500 border-yellow-500/30",
          },
          {
            title: "⏱️ ÚLTIMOS RESULTADOS",
            data: completados.slice().reverse(),
            color: "text-slate-400 border-slate-700",
          },
        ];

        // 🚀 OPTIMIZADO: Acumulamos HTML en string para evitar innerHTML += en bucle (O(n²))
        let matchesAccHtml = filterHtml;

        groups.forEach((group) => {
          if (group.data.length === 0) return;

          matchesAccHtml += '<div class="mt-12 mb-6 border-b-2 ' + (group.color.split(" ")[1]) +
            ' pb-3 flex items-center bg-slate-900/50 p-4 rounded-t-xl"> <h3 class="font-oswald ' +
            (group.color.split(" ")[0]) + ' text-3xl tracking-widest uppercase">' + (group.title) +
            '</h3> <span class="ml-4 bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-xs font-bold">' +
            (group.data.length) + ' PARTIDOS</span> </div>';

          let currentInnerRound = "";

          group.data.forEach((m) => {
            if (m.round !== currentInnerRound) {
              let roundBtn =
                currentUserRole === "admin"
                  ? '<button onclick="resolveRoundAwards(\'' + (m.round) +
                    '\', this)" class="ml-4 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded shadow-lg transition uppercase">Cerrar Actas ' +
                    (m.round) + '</button>'
                  : "";
              matchesAccHtml += '<div class="mt-6 mb-4 flex items-center px-2"><span class="text-slate-500 font-oswald text-sm tracking-widest uppercase">' +
                (m.round) + '</span>' + (roundBtn) +
                '<div class="flex-1 border-t border-slate-700/50 ml-4"></div></div>';
              currentInnerRound = m.round;
            }

            const names = String(m.names || "").split(" vs ");
            const isPlayed = m.status === "COMPLETED";
            let btnUI = "";
            let clickEvt = "";
            let hoverC = "";

            let vodBtn =
              m.vod && m.vod.trim() !== "" && m.vod !== "undefined"
                ? '<button onclick="event.stopPropagation(); openVod(\'' + (m.vod) +
                  '\')" class="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 rounded text-xs ml-4 uppercase shadow transition hover:scale-105">🎬 VOD</button>'
                : "";

            let dateBadge = '<span class="text-slate-500">🗓️ TBD</span>';
            if (isPlayed) {
              dateBadge = '<span class="text-emerald-400 font-bold">✅ FINALIZADO</span>';
            } else if (
              m.date &&
              String(m.date).trim() !== "" &&
              String(m.date) !== "undefined"
            ) {
              dateBadge = '<span class="text-accent-blue font-bold drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]">🗓️ ' +
                (formatNiceDate(m.date)) + '</span>';
            } else if (m.proposedDate && String(m.proposedDate).trim() !== "") {
              let propTeam = data.teams.find((t) => t.id === m.proposedBy);
              let pName = propTeam ? propTeam.name : "Rival";
              dateBadge = '<span class="text-yellow-400 font-bold animate-pulse text-[10px]">⏳ ' + (escHtml(pName)) +
                ' propone: ' + (formatNiceDate(m.proposedDate)) + '</span>';
            }

            if (!isPlayed) {
              dateBadge += ' <button onclick="event.stopPropagation(); openNegotiationModal(\'' + (m.id) +
                '\')" class="ml-2 bg-slate-700 hover:bg-slate-600 text-[8px] px-2 py-0.5 rounded border border-slate-600 uppercase">Gestionar</button>';
            }

            let tA = data.teams.find((t) => t.name === names[0].trim());
            let tB = data.teams.find((t) => t.name === names[1].trim());
            let logoA = tA ? getLogo(tA.logo) : getLogo("");
            let logoB = tB ? getLogo(tB.logo) : getLogo("");

            if (isPlayed) {
              let safeRiotId = m.riotId || m.id;
              btnUI = '<div class="score-box text-white font-black px-4 md:px-6 py-2 border-2 border-slate-600 rounded-xl bg-slate-900 text-2xl md:text-3xl font-oswald shadow-inner">' +
                (m.sA) + ' - ' + (m.sB) + '</div>' + (vodBtn);
              clickEvt = 'onclick="openPostGame(\'' + (m.id) + '\', \'' + (safeRiotId) + '\')"';
              hoverC =
                "hover:border-emerald-500 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.05)]";
            } else {
              let powerA = tA && tA.powerScore ? tA.powerScore : 10;
              let powerB = tB && tB.powerScore ? tB.powerScore : 10;
              let statProbA = powerA / (powerA + powerB);
              let statProbB = powerB / (powerA + powerB);
              let volA = m.volA || 0;
              let volB = m.volB || 0;
              let totalVol = volA + volB;
              let finalProbA, finalProbB;
              if (totalVol === 0) {
                finalProbA = statProbA;
                finalProbB = statProbB;
              } else {
                let marketProbA = (volA + 1000) / (totalVol + 2000);
                let marketProbB = (volB + 1000) / (totalVol + 2000);
                finalProbA = marketProbA * 0.8 + statProbA * 0.2;
                finalProbB = marketProbB * 0.8 + statProbB * 0.2;
              }
              let oddsA = Math.max(1.05, (1 / finalProbA) * 0.95).toFixed(2);
              let oddsB = Math.max(1.05, (1 / finalProbB) * 0.95).toFixed(2);
              let safeNameA = enc(names[0]);
              let safeNameB = enc(names[1]);
              let vsBtn =
                currentUserRole === "admin"
                  ? '<button onclick="event.stopPropagation(); openModalScore(event, \'' + (m.id) + '\', \'' +
                    (safeNameA) + '\', \'' + (safeNameB) +
                    '\')" class="bg-yellow-500 text-black px-3 py-1 font-black rounded hover:bg-yellow-400 transition mx-2">VS</button>'
                  : '<div class="bg-slate-800 text-slate-500 px-3 py-1 font-black rounded border border-slate-700 mx-2">VS</div>';
              btnUI = '<div class="flex items-center justify-center relative"><button onclick="event.stopPropagation(); openCasinoModal(\'' +
                (m.id) + '\', \'' + (safeNameA) + '\', \'' + (oddsA) +
                '\', 0)" class="text-lg md:text-xl font-oswald text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-3 md:px-4 py-1.5 rounded hover:bg-yellow-500 hover:text-black transition">x' +
                (oddsA) + '</button>' + (vsBtn) + '<button onclick="event.stopPropagation(); openCasinoModal(\'' +
                (m.id) + '\', \'' + (safeNameB) + '\', \'' + (oddsB) +
                '\', 1)" class="text-lg md:text-xl font-oswald text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-3 md:px-4 py-1.5 rounded hover:bg-yellow-500 hover:text-black transition">x' +
                (oddsB) + '</button></div>';
              clickEvt = 'onclick="openMatchScouting(\'' + (m.id) + '\')"';
              hoverC =
                "hover:border-accent-blue hover:shadow-[0_0_20px_rgba(56,189,248,0.15)] cursor-pointer transition-all hover:-translate-y-1";
            }

            let htmlRow = '<div class="bg-slate-800/60 border border-slate-700/50 p-5 rounded-2xl flex flex-col mb-4 shadow-md ' +
              (hoverC) + ' relative" ' + (clickEvt) + '>';
            htmlRow += '<div class="absolute top-0 left-6 bg-slate-900 border-b border-x border-slate-700 px-3 py-0.5 rounded-b-lg text-[9px] uppercase tracking-widest z-0 shadow-sm">' +
              (dateBadge) + '</div>';
            htmlRow += '<div class="flex justify-between items-center mt-3 w-full relative z-10">';
            htmlRow += '<div class="w-[35%] flex items-center gap-3 overflow-hidden text-right justify-end"> <div class="font-black tracking-tight text-white text-sm md:text-lg leading-tight truncate px-1">' +
              (escHtml(names[0])) + '</div> <img src="' + (logoA) +
              '" class="flex-shrink-0 w-8 h-8 md:w-12 md:h-12 object-contain drop-shadow hidden sm:block"> </div>';
            htmlRow += '<div class="w-[30%] flex justify-center items-center scale-90 md:scale-100">' + (btnUI) + '</div>';
            htmlRow += '<div class="w-[35%] flex items-center gap-3 overflow-hidden"> <img src="' + (logoB) +
              '" class="flex-shrink-0 w-8 h-8 md:w-12 md:h-12 object-contain drop-shadow hidden sm:block"> <div class="font-black tracking-tight text-white text-sm md:text-lg leading-tight truncate px-1">' +
              (escHtml(names[1])) + '</div> </div>';
            htmlRow += '</div></div>';
            matchesAccHtml += htmlRow;
          });
        });
        mContainer.innerHTML = matchesAccHtml; // 🚀 Una sola asignación DOM
      }

    