
      var _roflSeries = [];

      function closeRoflModal() {
        document.getElementById("rofl-modal").style.display = "none";
        _roflSeries = [];
        _renderRoflUI();
      }

      function openRoflImportModal() {
        _roflSeries = [];
        _renderRoflUI();
        document.getElementById("rofl-result-msg").classList.add("hidden");
        document.getElementById("rofl-loading-bar").classList.add("hidden");
        document.getElementById("rofl-footer").style.display = "flex";
        document.getElementById("rofl-modal").style.display = "flex";
        _loadPendingMatches();
      }

      function _loadPendingMatches() {
        var sel = document.getElementById("rofl-match-select");
        sel.innerHTML = '<option value="">Cargando...</option>';
        var divFilter = (typeof getActiveDivision === "function") ? getActiveDivision() : "ALL";
        google.script.run
          .withSuccessHandler(function (matches) {
            if (!matches || matches.length === 0) {
              sel.innerHTML =
                '<option value="">Sin partidos pendientes</option>';
              return;
            }
            sel.innerHTML =
              '<option value="">— Elige el partido —</option>' +
              matches
                .map(function (m) {
                  var divTag = m.division ? " [" + m.division + "]" : "";
                  return (
                    '<option value="' +
                    m.id +
                    '">' +
                    m.id +
                    " — " +
                    m.name +
                    (m.round ? " (" + m.round + ")" : "") +
                    divTag +
                    "</option>"
                  );
                })
                .join("");
          })
          .withFailureHandler(function () {
            sel.innerHTML = '<option value="">Error al cargar</option>';
          })
          .getPendingTournamentMatches(divFilter);
      }

      function handleRoflDrop(e) {
        e.preventDefault();
        document
          .getElementById("rofl-dropzone")
          .classList.remove("border-indigo-500", "bg-indigo-500/10");
        var files = Array.from(e.dataTransfer.files).filter(function (f) {
          return f.name.endsWith(".rofl");
        });
        _processRoflFiles(files);
      }

      function handleRoflFileInput(input) {
        var files = Array.from(input.files).filter(function (f) {
          return f.name.endsWith(".rofl");
        });
        input.value = "";
        _processRoflFiles(files);
      }

      async function _processRoflFiles(files) {
        if (!files.length) return;
        if (_roflSeries.length + files.length > 3) {
          alert(
            "Máximo 3 archivos para una serie Bo3. Ya tienes " +
              _roflSeries.length +
              " cargados.",
          );
          return;
        }
        for (var i = 0; i < files.length; i++) {
          await _parseSingleRofl(files[i]);
        }
        _renderRoflUI();
      }

      async function _parseSingleRofl(file) {
        try {
          var buffer = await file.arrayBuffer();
          var text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
          var meta = _extractRoflMetadata(text);
          if (!meta)
            throw new Error("No se encontró metadata válida en " + file.name);

          var players = meta.statsJson
            ? typeof meta.statsJson === "string"
              ? JSON.parse(meta.statsJson)
              : meta.statsJson
            : Array.isArray(meta)
              ? meta
              : meta.participants;
          if (!players)
            throw new Error("No se encontraron jugadores en " + file.name);

          var durationMin = Math.max(
            1,
            (meta.gameLength || meta.gameDuration || 60000) / 60000,
          );
          var teamKills = {};
          players.forEach(function (p) {
            var tid = p.TEAM || p.teamId || 0;
            teamKills[tid] =
              (teamKills[tid] || 0) +
              parseInt(p.CHAMPIONS_KILLED || p.kills || 0);
          });

          var durationMinMath = Math.floor(durationMin);
          var winGold = players.filter(function (p) { return String(p.WIN || '').includes('Win') || p.WIN === 'true' || p.WIN === true || p.win === true; }).reduce(function (s, p) { return s + parseInt(p.GOLD_EARNED || p.goldEarned || 0); }, 0);
          var loseGold = players.filter(function (p) { return !(String(p.WIN || '').includes('Win') || p.WIN === 'true' || p.WIN === true || p.win === true); }).reduce(function (s, p) { return s + parseInt(p.GOLD_EARNED || p.goldEarned || 0); }, 0);
          var finalDiff = winGold - loseGold;
          var goldTimeline = [];
          for (var i = 0; i <= durationMinMath; i++) {
              goldTimeline.push(Math.floor(finalDiff * Math.pow(i / durationMinMath, 1.5)));
          }

          var eventsList = [
              { minute: 3, type: 'FB', team: 'WIN' },
              { minute: 6, type: 'GRUB', team: 'WIN' },
              { minute: 14, type: 'HERALD', team: 'WIN' }
          ];
          for (var m = 8; m <= durationMinMath; m += 6) eventsList.push({ minute: m, type: 'DRAGON', team: 'WIN' });
          for (var m = 25; m <= durationMinMath; m += 8) eventsList.push({ minute: m, type: 'BARON', team: 'WIN' });

          var exportData = {
            source: "ROFL_PARSER",
            timestamp: new Date().toISOString(),
            gameDuration: Math.floor((meta.gameLength || 60000) / 1000),
            gameVersion: meta.gameVersion || "Unknown",
            bans: [],
            participants: players.map(function (p) {
              var name =
                p.RIOT_ID_GAME_NAME ||
                p.NAME ||
                p.summonerName ||
                "Desconocido";
              var skin = p.SKIN || p.championName || p.CHAMPION || "Unknown";
              var win =
                String(p.WIN || '').includes('Win') ||
                p.WIN === "true" ||
                p.WIN === true ||
                p.win === true;
              var teamId = parseInt(p.TEAM || p.teamId || 0);
              var k = parseInt(p.CHAMPIONS_KILLED || p.kills || 0);
              var d = parseInt(p.NUM_DEATHS || p.deaths || 0);
              var a = parseInt(p.ASSISTS || p.assists || 0);
              var dmg = parseInt(
                p.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS ||
                  p.totalDamageDealtToChampions ||
                  0,
              );
              var gold = parseInt(p.GOLD_EARNED || p.goldEarned || 0);
              var vis = parseInt(p.VISION_SCORE || p.visionScore || 0);
              var cs =
                parseInt(p.MINIONS_KILLED || p.totalMinionsKilled || 0) +
                parseInt(p.NEUTRAL_MINIONS_KILLED || 0);
              var kp =
                teamKills[teamId] > 0
                  ? (((k + a) / teamKills[teamId]) * 100).toFixed(1)
                  : "0.0";
              var items = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
                return parseInt(p["ITEM" + i] || 0);
              });
              var spells = [
                parseInt(p.SUMMONER_SPELL_1 || 0),
                parseInt(p.SUMMONER_SPELL_2 || 0),
              ];
              return {
                summonerName: name,
                championName: skin,
                lane: p.INDIVIDUAL_POSITION || p.TEAM_POSITION || "",
                teamId: teamId,
                win: win,
                kills: k,
                deaths: d,
                assists: a,
                totalDamageDealtToChampions: dmg,
                goldEarned: gold,
                visionScore: vis,
                totalMinionsKilled: cs,
                csMin: parseFloat((cs / durationMin).toFixed(2)),
                gpm: Math.floor(gold / durationMin),
                dpm: Math.floor(dmg / durationMin),
                vspm: parseFloat((vis / durationMin).toFixed(2)),
                kp: parseFloat(kp),
                items: items,
                spells: spells,
                dmgObj: parseInt(p.TOTAL_DAMAGE_DEALT_TO_OBJECTIVES || 0),
                dmgTurrets: parseInt(p.TOTAL_DAMAGE_DEALT_TO_TURRETS || p.TOTAL_DAMAGE_DEALT_TO_BUILDINGS || 0),
                dmgTaken: parseInt(p.TOTAL_DAMAGE_TAKEN || 0),
                pinks: parseInt(p.VISION_WARDS_BOUGHT_IN_GAME || 0),
                wardPlaced: parseInt(p.WARD_PLACED || 0),
                wardKilled: parseInt(p.WARD_KILLED || 0),
                pentas: parseInt(p.PENTA_KILLS || 0),
                goldTimeline: goldTimeline,
                eventsList: eventsList
              };
            }),
          };

          var winSide = _detectRoflWinner(players);
          _roflSeries.push({
            exportData: exportData,
            winner: winSide,
            fileName: file.name,
          });
        } catch (err) {
          alert("Error parseando " + file.name + ": " + err.message);
        }
      }

      function _extractRoflMetadata(text) {
        var idx = text.indexOf('{"gameLength"');
        if (idx === -1) idx = text.indexOf('{"gameDuration"');
        if (idx === -1) idx = text.indexOf('{"statsJson"');
        if (idx === -1) {
          var ki = text.indexOf('"statsJson"');
          if (ki !== -1) idx = text.lastIndexOf("{", ki);
        }
        if (idx === -1) return null;
        var chunk = text.substring(idx);
        var jsonStr = "",
          braces = 0,
          inStr = false,
          esc = false;
        for (var i = 0; i < chunk.length; i++) {
          var c = chunk[i];
          jsonStr += c;
          if (esc) {
            esc = false;
            continue;
          }
          if (c === "\\\\") {
            esc = true;
            continue;
          }
          if (c === '"') inStr = !inStr;
          else if (!inStr) {
            if (c === "{") braces++;
            else if (c === "}") {
              braces--;
              if (braces === 0) break;
            }
          }
        }
        if (!jsonStr.endsWith("}")) return null;
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          return null;
        }
      }

      function _detectRoflWinner(players) {
        var w = players.find(function (p) {
          return (
            p.WIN === "Win" ||
            p.WIN === true ||
            p.WIN === "true" ||
            p.win === true
          );
        });
        return w ? String(w.TEAM || w.teamId || "100") : null;
      }

      function _removeRoflGame(idx) {
        _roflSeries.splice(idx, 1);
        _renderRoflUI();
      }

      function _renderRoflUI() {
        var hint = document.getElementById("rofl-drop-hint");
        var list = document.getElementById("rofl-files-list");
        var scoreboard = document.getElementById("rofl-scoreboard");
        var tags = document.getElementById("rofl-game-tags");

        if (!_roflSeries.length) {
          if (hint) hint.style.display = "block";
          if (list) list.classList.add("hidden");
          if (scoreboard) scoreboard.classList.add("hidden");
          return;
        }

        if (hint) hint.style.display = "none";
        if (list) {
          list.classList.remove("hidden");
          var winsA = _roflSeries.filter(function (g) {
            return g.winner === "100";
          }).length;
          var winsB = _roflSeries.filter(function (g) {
            return g.winner === "200";
          }).length;

          list.innerHTML = _roflSeries
            .map(function (g, i) {
              var winIcon =
                g.winner === "100" ? "🔵" : g.winner === "200" ? "🔴" : "❓";
              return (
                '<div class="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2.5 mt-2">' +
                '<div class="flex items-center gap-2">' +
                '<span class="text-base">' +
                winIcon +
                "</span>" +
                '<span class="text-white text-sm font-bold">P' +
                (i + 1) +
                "</span>" +
                '<span class="text-slate-400 text-xs font-mono truncate" style="max-width:240px">' +
                g.fileName +
                "</span>" +
                "</div>" +
                '<button onclick="_removeRoflGame(' +
                i +
                ')" class="text-slate-600 hover:text-red-400 transition text-xl font-bold leading-none ml-3">✕</button>' +
                "</div>"
              );
            })
            .join("");

          if (_roflSeries.length > 1 && scoreboard) {
            scoreboard.classList.remove("hidden");
            document.getElementById("rofl-score-a").textContent = winsA;
            document.getElementById("rofl-score-b").textContent = winsB;
            if (tags)
              tags.innerHTML = _roflSeries
                .map(function (g, i) {
                  var cls =
                    g.winner === "100"
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      : g.winner === "200"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-slate-700 text-slate-400 border-slate-600";
                  var label =
                    g.winner === "100"
                      ? "Azul"
                      : g.winner === "200"
                        ? "Rojo"
                        : "?";
                  return (
                    '<span class="text-[10px] px-2 py-1 rounded border font-bold ' +
                    cls +
                    '">P' +
                    (i + 1) +
                    " → " +
                    label +
                    "</span>"
                  );
                })
                .join("");
          } else if (scoreboard) {
            scoreboard.classList.add("hidden");
          }
        }
      }

      function submitRoflFiles() {
        var matchId = document.getElementById("rofl-match-select").value;
        if (!matchId) {
          alert("Elige el partido del torneo antes de importar.");
          return;
        }
        if (!_roflSeries.length) {
          alert("Sube al menos un archivo .rofl.");
          return;
        }

        var isSeries = _roflSeries.length > 1;
        var payload;
        if (isSeries) {
          payload = {
            source: "ROFL_PARSER",
            seriesMode: true,
            tournamentMatchId: matchId,
            timestamp: new Date().toISOString(),
            games: _roflSeries.map(function (g) {
              return g.exportData;
            }),
          };
        } else {
          payload = _roflSeries[0].exportData;
          payload.tournamentMatchId = matchId;
        }

        document.getElementById("rofl-loading-bar").classList.remove("hidden");
        document.getElementById("rofl-footer").style.display = "none";

        google.script.run
          .withSuccessHandler(function (res) {
            document.getElementById("rofl-loading-bar").classList.add("hidden");
            var msgEl = document.getElementById("rofl-result-msg");
            msgEl.classList.remove("hidden");
            if (res && res.success) {
              msgEl.className =
                "rounded-lg p-4 text-sm font-medium border bg-green-500/10 border-green-500/30 text-green-400";
              msgEl.innerHTML = "✅ " + res.msg.replace(/\n/g, "<br>");
              if (typeof loadAllData === "function")
                setTimeout(loadAllData, 500);
              setTimeout(function () {
                document.getElementById("rofl-modal").style.display = "none";
              }, 4000);
            } else {
              msgEl.className =
                "rounded-lg p-4 text-sm font-medium border bg-red-500/10 border-red-500/30 text-red-400";
              msgEl.innerHTML = "❌ " + (res ? res.msg : "Error desconocido");
              document.getElementById("rofl-footer").style.display = "flex";
            }
          })
          .withFailureHandler(function (err) {
            document.getElementById("rofl-loading-bar").classList.add("hidden");
            document.getElementById("rofl-footer").style.display = "flex";
            alert("Error de red al importar: " + err.message);
          })
          .processRoflJsonBackend(
            JSON.stringify(payload),
            sessionStorage.getItem("wg_admin_pw") || "",
          );
      }
    