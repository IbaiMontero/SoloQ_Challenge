      function generateMatchSummaryImage(silent = false) {
        return new Promise((resolve, reject) => {
          let data = window.lastPostGameData;
          if (!data || !data.winners) {
            if (!silent) alert("No hay datos del partido.");
            return reject("No data");
          }

        let winKills = data.winners.reduce((acc, p) => acc + p.k, 0);
        let losKills = data.losers.reduce((acc, p) => acc + p.k, 0);
        let winObj = data.winStats || {
          gold: "0.0",
          towers: 0,
          inhibs: 0,
          dragons: 0,
          barons: 0,
        };
        let losObj = data.losStats || {
          gold: "0.0",
          towers: 0,
          inhibs: 0,
          dragons: 0,
          barons: 0,
        };
        let topWinner = data.winners.sort(
          (a, b) =>
            (b.k + b.a) / Math.max(1, b.d) - (a.k + a.a) / Math.max(1, a.d),
        )[0];
        let topLoser =
          data.losers.sort(
            (a, b) =>
              (b.k + b.a) / Math.max(1, b.d) - (a.k + a.a) / Math.max(1, a.d),
          )[0] || data.losers[0];

        const safeWChamp = getChampIcon(topWinner.champ);
        const safeLChamp = getChampIcon(topLoser.champ);
        const area = document.getElementById("summary-export-area");

        area.innerHTML = ' <div style="display:flex; flex-direction:column; height:100%; box-sizing: border-box;"> <div style="text-align: center; margin-bottom: 20px;"> <h1 style="color: #fbbf24; font-size: 38px; letter-spacing: 12px; margin: 0; text-shadow: 0 0 20px rgba(251,191,36,0.5);">WARGODS PREMIER</h1> <p style="color: #94a3b8; font-size: 16px; letter-spacing: 5px; margin: 5px 0 0 0; text-transform: uppercase;">RESUMEN OFICIAL DEL PARTIDO</p> </div> <div style="display: flex; justify-content: space-between; align-items: stretch; background: rgba(30, 41, 59, 0.9); border: 2px solid #334155; border-radius: 20px; padding: 20px 40px; margin-bottom: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);"> <div style="flex: 1; text-align: center;"> <h2 style="color: #10b981; font-size: 36px; margin: 0; letter-spacing: 2px; padding-top: 5px;">VICTORIA</h2> <div style="margin: 10px 0 20px 0;"> <span style="font-size: 85px; font-weight: 900; color: white; text-shadow: 0 0 30px rgba(16,185,129,0.4); vertical-align: middle;">' +
          (winKills) +
          '</span> <span style="font-size: 24px; font-weight: bold; color: #94a3b8; letter-spacing: 2px; margin-left: 10px; vertical-align: middle;">KILLS</span> </div> <div style="display: flex; justify-content: space-around; background: rgba(0,0,0,0.4); padding: 12px 10px; border-radius: 12px; border-bottom: 3px solid #10b981;"> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (winObj.gold) +
          'k</div><div style="color: #fbbf24; font-size: 10px; font-weight: 900; margin-top: 4px;">💰 ORO</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (winObj.towers) +
          '</div><div style="color: #38bdf8; font-size: 10px; font-weight: 900; margin-top: 4px;">🏯 TORRES</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (winObj.inhibs) +
          '</div><div style="color: #a855f7; font-size: 10px; font-weight: 900; margin-top: 4px;">🔮 INHIBS</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (winObj.dragons) +
          '</div><div style="color: #ef4444; font-size: 10px; font-weight: 900; margin-top: 4px;">🐉 DRAKES</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (winObj.barons) +
          '</div><div style="color: #c084fc; font-size: 10px; font-weight: 900; margin-top: 4px;">👾 BARON</div></div> </div> </div> <div style="width: 140px; display: flex; align-items: center; justify-content: center;"> <div style="font-size: 60px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 20px rgba(251,191,36,0.3);">VS</div> </div> <div style="flex: 1; text-align: center;"> <h2 style="color: #ef4444; font-size: 36px; margin: 0; letter-spacing: 2px; padding-top: 5px;">DERROTA</h2> <div style="margin: 10px 0 20px 0;"> <span style="font-size: 85px; font-weight: 900; color: white; text-shadow: 0 0 30px rgba(239,68,68,0.4); vertical-align: middle;">' +
          (losKills) +
          '</span> <span style="font-size: 24px; font-weight: bold; color: #94a3b8; letter-spacing: 2px; margin-left: 10px; vertical-align: middle;">KILLS</span> </div> <div style="display: flex; justify-content: space-around; background: rgba(0,0,0,0.4); padding: 12px 10px; border-radius: 12px; border-bottom: 3px solid #ef4444;"> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (losObj.gold) +
          'k</div><div style="color: #fbbf24; font-size: 10px; font-weight: 900; margin-top: 4px;">💰 ORO</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (losObj.towers) +
          '</div><div style="color: #38bdf8; font-size: 10px; font-weight: 900; margin-top: 4px;">🏯 TORRES</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (losObj.inhibs) +
          '</div><div style="color: #a855f7; font-size: 10px; font-weight: 900; margin-top: 4px;">🔮 INHIBS</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (losObj.dragons) +
          '</div><div style="color: #ef4444; font-size: 10px; font-weight: 900; margin-top: 4px;">🐉 DRAKES</div></div> <div style="text-align: center; width: 60px;"><div style="font-size: 22px; font-weight: 900; color: white;">' +
          (losObj.barons) +
          '</div><div style="color: #c084fc; font-size: 10px; font-weight: 900; margin-top: 4px;">👾 BARON</div></div> </div> </div> </div> <div style="display: flex; justify-content: space-between; gap: 30px; flex: 1;"> <div style="flex: 1; background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%); border-radius: 15px; display: flex; align-items: center; padding: 20px; border: 2px solid #334155; border-left: 10px solid #fbbf24; box-shadow: 0 10px 20px rgba(0,0,0,0.5);"> <img crossorigin="anonymous" src="' +
          (safeWChamp) +
          '" style="width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fbbf24; margin-right: 25px; object-fit: cover;"> <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; height: 100%; overflow: hidden;"> <div style="color: #fbbf24; font-size: 14px; font-weight: 900; letter-spacing: 3px; margin-bottom: 5px;">👑 MVP DEL EQUIPO</div> <div style="font-size: 34px; color: white; line-height: 1.1; padding-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">' +
          (escHtml(topWinner.name)) +
          '</div> <div style="color: #10b981; font-size: 22px; font-weight: bold; font-family: monospace;">' +
          (topWinner.k) + ' / ' + (topWinner.d) + ' / ' + (topWinner.a) +
          ' KDA</div> </div> </div> <div style="flex: 1; background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%); border-radius: 15px; display: flex; align-items: center; padding: 20px; border: 2px solid #334155; border-left: 10px solid #ef4444; box-shadow: 0 10px 20px rgba(0,0,0,0.5);"> <img crossorigin="anonymous" src="' +
          (safeLChamp) +
          '" style="width: 110px; height: 110px; border-radius: 50%; border: 4px solid #ef4444; margin-right: 25px; object-fit: cover;"> <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; height: 100%; overflow: hidden;"> <div style="color: #ef4444; font-size: 14px; font-weight: 900; letter-spacing: 3px; margin-bottom: 5px;">🛡️ ACE DEL EQUIPO</div> <div style="font-size: 34px; color: white; line-height: 1.1; padding-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">' +
          (escHtml(topLoser.name)) +
          '</div> <div style="color: #38bdf8; font-size: 22px; font-weight: bold; font-family: monospace;">' +
          (topLoser.k) + ' / ' + (topLoser.d) + ' / ' + (topLoser.a) +
          ' KDA</div> </div> </div> </div> </div> ';

        setTimeout(() => {
          html2canvas(area, {
            backgroundColor: "#0f172a",
            scale: 1.5,
            useCORS: true,
            allowTaint: false,
          }).then((canvas) => {
            let base64 = canvas.toDataURL("image/png");
            if (silent) {
              resolve(base64);
            } else {
              let link = document.createElement("a");
              link.download = "Wargods_Resumen_Match.png";
              link.href = base64;
              link.click();
              resolve(base64);
            }
          }).catch(reject);
        }, 800);
        });
      }

      function voteMvpAce(matchId, searchId, nameEnc, type) {
        let voter = localStorage.getItem("my_summoner_name");
        if (!voter) {
          voter = prompt(
            "⭐ VOTACIÓN " + type + ": Introduce tu Nombre de Invocador:",
          );
          if (!voter || voter.trim() === "") return;
          localStorage.setItem("my_summoner_name", voter.trim());
        }
        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            openPostGame(matchId, searchId);
          })
          .withFailureHandler(function (err) {
            alert("❌ Error: " + err.message);
          })
          .castMvpVoteBackend(matchId, dec(nameEnc), voter, type);
      }

      function generateMVPImage() {
        let data = window.lastPostGameData;
        if (!data || !data.winners) return;

        let mvpName = data.officialMvp;
        let mvp = null;

        if (mvpName)
          mvp =
            data.winners.find((p) => p.name === mvpName) ||
            data.losers.find((p) => p.name === mvpName);
        if (!mvp)
          mvp = data.winners.sort(
            (a, b) =>
              (b.k + b.a) / Math.max(1, b.d) - (a.k + a.a) / Math.max(1, a.d),
          )[0];

        const splashUrl = getChampSplash(mvp.champ);
        const area = document.getElementById("mvp-export-area");

        area.innerHTML = ' <div style="display:flex; justify-content: space-between; align-items: center; height:100%;"> <div style="flex: 1;"> <div style="color: #fbbf24; font-size: 20px; letter-spacing: 5px;">WARGODS PREMIER</div> <div style="font-size: 80px; font-weight: 900; line-height: 1; margin: 10px 0; color: white;">MVP</div> <div style="font-size: 30px; color: #38bdf8; margin-bottom: 30px;">' +
          (escHtml(mvp.name)) +
          '</div> <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;"> <div><div style="color: #94a3b8; font-size: 14px;">KDA</div><div style="font-size: 35px; color: #10b981;">' +
          (mvp.k) + '/' + (mvp.d) + '/' + (mvp.a) +
          '</div></div> <div><div style="color: #94a3b8; font-size: 14px;">DAÑO</div><div style="font-size: 35px; color: #ef4444;">' +
          ((mvp.dmg / 1000).toFixed(1)) +
          'k</div></div> <div><div style="color: #94a3b8; font-size: 14px;">TANK</div><div style="font-size: 35px; color: #3b82f6;">' +
          (mvp.tank) +
          '</div></div> <div><div style="color: #94a3b8; font-size: 14px;">CS/M</div><div style="font-size: 35px; color: #cbd5e1;">' +
          (mvp.cs || 0) +
          '</div></div> <div><div style="color: #94a3b8; font-size: 14px;">GPM</div><div style="font-size: 35px; color: #fbbf24;">' +
          (mvp.gpm || 0) +
          '</div></div> <div><div style="color: #94a3b8; font-size: 14px;">KP%</div><div style="font-size: 35px; color: #a855f7;">' +
          ((mvp.kp * 100).toFixed(0)) +
          '%</div></div> </div> </div> <div style="flex: 1; text-align: right;"> <img crossorigin="anonymous" src="' +
          (splashUrl) +
          '" style="max-height: 350px; border-radius: 10px; border: 4px solid #334155; box-shadow: -10px 10px 30px rgba(0,0,0,0.5);"> </div> </div> ';

        setTimeout(() => {
          html2canvas(area, {
            backgroundColor: "#0f172a",
            scale: 2,
            useCORS: true,
            allowTaint: false,
          }).then((canvas) => {
            let base64 = canvas.toDataURL("image/png");
            if (silent) {
              resolve(base64);
            } else {
              let link = document.createElement("a");
              link.download = "MVP_" + mvp.name + ".png";
              link.href = base64;
              link.click();
              resolve(base64);
            }
          }).catch(reject);
        }, 500);
        });
      }

      let seismographChart = null;

      function openScouting(nameEnc) {
        const playerName = dec(nameEnc);
        const p = globalStatsData.find(function (x) {
          return x.name === playerName;
        });
        if (!p) return;
        window.currentScoutPlayer = p;

        // ⚔️ LÓGICA DE MATRIZ DE ARQUETIPOS DE ADN
        let k = parseFloat(p.kdaText ? p.kdaText.split("/")[0] : 0) || 0;
        let d = parseFloat(p.kdaText ? p.kdaText.split("/")[1] : 0) || 0;
        let a = parseFloat(p.kdaText ? p.kdaText.split("/")[2] : 0) || 0;
        let kp = parseFloat(p.kp) || 0;
        let vspm = parseFloat(p.vspm) || 0;
        let cs = parseFloat(p.cs) || 0;
        let dpm = parseFloat(p.dpm) || 0;

        let arch = {
          name: "EL GUERRERO",
          color: "text-blue-400",
          border: "border-blue-500",
          hex: "#38bdf8",
          icon: "⚔️",
          desc: "Equilibrado y letal. El soldado perfecto.",
        };
        if (k >= 6 && dpm >= 600)
          arch = {
            name: "EL VERDUGO",
            color: "text-red-500",
            border: "border-red-600",
            hex: "#ef4444",
            icon: "🩸",
            desc: "Agresión Pura. Busca combate y arriesga por la kill.",
          };
        else if (vspm >= 1.5 && a >= 8)
          arch = {
            name: "EL ARQUITECTO",
            color: "text-purple-400",
            border: "border-purple-500",
            hex: "#a855f7",
            icon: "👁️",
            desc: "Genio del macro. Control del mapa y visión asfixiante.",
          };
        else if (cs >= 7.5 && kp < 55)
          arch = {
            name: "EL MERCENARIO SOLITARIO",
            color: "text-yellow-500",
            border: "border-yellow-600",
            hex: "#fbbf24",
            icon: "🐺",
            desc: "Ignora las teamfights. Split push y egoísmo táctico.",
          };
        else if (d <= 3 && kp >= 60)
          arch = {
            name: "EL BASTIÓN",
            color: "text-emerald-400",
            border: "border-emerald-500",
            hex: "#10b981",
            icon: "🛡️",
            desc: "La roca inamovible del equipo. Prácticamente inmortal.",
          };

        window.currentArchetype = arch; // Guardado para el cromo

        // 📈 LÓGICA DE CLUTCH (SISMÓGRAFO)
        let isClutch = p.winrate >= 55 && (k >= 5 || a >= 10);

        let clutchTag = isClutch
          ? '<span class="ml-2 px-2 py-0.5 bg-blue-600 text-white text-[9px] rounded-full ice-veins uppercase tracking-widest relative shadow-[0_0_10px_#3b82f6]">❄️ Ice in the Veins</span>'
          : "";

        // Construcción de la UI
        let champsHtml = "";
        if (p.champs) {
          p.champs.split(",").forEach(function (c) {
            const cIcon = getChampIcon(c.trim());
            if (cIcon)
              champsHtml +=
                '<img src="' +
                cIcon +
                '" class="w-12 h-12 rounded-full border-2 border-slate-600 shadow-lg">';
          });
        }

        let sHtml = '<div class="absolute top-3 left-4 flex gap-3 z-50">';
        sHtml +=
          '<div class="text-slate-400 hover:text-white text-3xl font-bold cursor-pointer" onclick="closeModal(\'scouting-modal\')">&times;</div>';
        sHtml +=
          '<button onclick="generateCromoImage()" class="bg-gradient-to-r from-yellow-600 to-yellow-400 text-black text-xs font-black px-4 py-2 rounded shadow-lg hover:scale-105 transition uppercase tracking-widest mt-1">📸 EXPORTAR CROMO</button></div>';
        sHtml +=
          '<div class="absolute top-0 right-0 bg-emerald-500 text-black font-black px-6 py-2 rounded-bl-xl tracking-widest text-sm shadow-lg">' +
          (p.mvps || 0) +
          " MVPs</div>";

        sHtml += '<div class="mt-8 flex flex-col items-center relative">';
        sHtml +=
          '<h2 class="font-oswald text-white font-bold text-5xl tracking-widest uppercase text-shadow">' +
          escHtml(p.name) +
          "</h2>";

        // 🔗 BOTÓN DE COMPARTIR PERFIL
        sHtml +=
          '<a id="share-profile-btn" href="#" target="_blank" class="hidden mt-2 mb-6 bg-slate-700/50 hover:bg-slate-600 border border-slate-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center gap-2 shadow-lg">🔗 Ver perfil público</a>';

        sHtml +=
          '<div class="archetype-badge border-2 ' +
          arch.border +
          " px-6 py-2 rounded-full flex items-center gap-3 shadow-[0_0_20px_" +
          arch.hex +
          '40] mb-6">';
        sHtml += '<span class="text-3xl">' + arch.icon + "</span>";
        sHtml +=
          '<div><div class="' +
          arch.color +
          ' font-black tracking-widest text-lg uppercase">' +
          arch.name +
          '</div><div class="text-slate-300 text-[10px] uppercase font-bold">' +
          arch.desc +
          "</div></div></div>";

        sHtml +=
          '<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full relative">';
        sHtml +=
          '<div class="bg-slate-900/80 rounded-xl p-6 border border-slate-700 shadow-inner flex flex-col items-center"><h3 class="text-slate-500 font-bold uppercase tracking-widest text-xs mb-4">Radar de Rendimiento</h3><div style="position: relative; height: 320px; width: 100%;"><canvas id="scoutRadar"></canvas></div></div>';

        sHtml +=
          '<div class="bg-slate-900/80 rounded-xl p-6 border border-slate-700 shadow-inner flex flex-col justify-center"><h3 class="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1 text-center flex items-center justify-center">📈 Sismógrafo Clutch ' +
          clutchTag +
          '</h3><p class="text-[9px] text-slate-500 text-center mb-4 uppercase">Impacto del jugador en Late Game (Bajo Presión)</p><div style="position: relative; height: 300px; width: 100%;"><canvas id="clutchSeismograph"></canvas></div></div>';
        sHtml += "</div>";

        sHtml +=
          '<div class="text-left text-sm text-slate-400 mb-2 font-bold uppercase tracking-widest mt-8">Arsenal Letal (Campeones):</div>';
        sHtml +=
          '<div class="flex flex-wrap gap-3 justify-center bg-slate-900 p-4 rounded-xl border border-slate-700 w-full">' +
          champsHtml +
          "</div></div>";

        // Insertamos el HTML
        document.querySelector(".scout-card").innerHTML = sHtml;

        // 🔗 LÓGICA PARA OBTENER LA URL DEL PERFIL (Justo tras insertar el HTML)
        google.script.run
          .withSuccessHandler(function (url) {
            const shareBtn = document.getElementById("share-profile-btn");
            if (shareBtn && url) {
              shareBtn.href = url;
              shareBtn.classList.remove("hidden");
            }
          })
          .getPublicPlayerUrl(playerName);

        // Render Radar Clásico
        const ctxR = document.getElementById("scoutRadar").getContext("2d");
        if (window.radarChartInstance) window.radarChartInstance.destroy();
        let normKDA = Math.min(10, p.kdaNum || 0);
        let normDPM = Math.min(10, (p.dpm || 0) / 100);
        let normFarm = Math.min(10, p.cs || 0);
        let normVis = Math.min(10, (p.vspm || 0) * 3);
        let normSurv = Math.max(0, 10 - (p.avgDeaths || 0));
        window.radarChartInstance = new Chart(ctxR, {
          type: "radar",
          data: {
            labels: ["Daño", "KDA", "Visión", "Farm", "Superv"],
            datasets: [
              {
                label: p.name,
                data: [normDPM, normKDA, normVis, normFarm, normSurv],
                backgroundColor: arch.hex + "33",
                borderColor: arch.hex,
                pointBackgroundColor: "#fff",
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
            plugins: { legend: { display: false } },
          },
        });

        // Configuración del Sismógrafo
        const ctxS = document
          .getElementById("clutchSeismograph")
          .getContext("2d");
        if (window.seismographChart) window.seismographChart.destroy();

        let seisLabels = [
          "Min 5",
          "Min 10",
          "Min 15",
          "Min 20",
          "Min 25",
          "Min 30",
          "Min 35",
          "Late Game",
        ];
        let seisData = seisLabels.map((_, i) => {
          let baseImpact = (p.winrate / 100) * 20;
          if (i >= 4) {
            if (isClutch) return baseImpact + (Math.random() * 40 + 20);
            return baseImpact - (Math.random() * 20 + 10);
          }
          return baseImpact + (Math.random() * 10 - 5);
        });

        window.seismographChart = new Chart(ctxS, {
          type: "line",
          data: {
            labels: seisLabels,
            datasets: [
              {
                label: "Impacto Táctico",
                data: seisData,
                borderColor: isClutch ? "#3b82f6" : "#ef4444",
                backgroundColor: isClutch
                  ? "rgba(59, 130, 246, 0.1)"
                  : "rgba(239, 68, 68, 0.1)",
                borderWidth: 3,
                tension: 0.3,
                pointBackgroundColor: "#fff",
                pointRadius: 3,
                fill: true,
              },
            ],
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              x: {
                display: true,
                ticks: { color: "#64748b", font: { family: "Inter", size: 9 } },
                grid: { color: "rgba(255, 255, 255, 0.05)" },
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: "NIVEL DE IMPACTO",
                  color: "#94a3b8",
                  font: { size: 10, family: "Oswald" },
                },
                ticks: { color: "#64748b", font: { size: 10 } },
                grid: { color: "rgba(255, 255, 255, 0.05)" },
                min: -20,
                max: 100,
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true, mode: "index", intersect: false },
            },
            animation: { duration: 1500, easing: "easeOutQuart" },
          },
        });

        document.getElementById("scouting-modal").style.display = "flex";
      }

      // 🧮 NUEVO ALGORITMO EXPERTO DE OVR (Global)
      function calculatePlayerOVR(p) {
        if (!p) return 60;

        const safeFloat = (val) => parseFloat(val) || 0;
        let kdaNum = safeFloat(p.kdaNum);
        let dpm = safeFloat(p.dpm);
        let cs = safeFloat(p.cs);
        let kpReal = safeFloat(p.kp);
        let vspm = safeFloat(p.vspm);
        let gpm = safeFloat(p.gpm);
        let pts = safeFloat(p.points);

        // CURVA EXPONENCIAL: El ratio elevado a 1.3 hace que cueste MUCHÍSIMO pasar de 85-90 a 99.
        // Base mínima estricta de 60.
        const calcStat = (val, max) => {
          let ratio = Math.min(1, Math.max(0, val / max));
          return 60 + Math.pow(ratio, 1.3) * 39;
        };

        // Umbrales nivel "PRO" (Absurdamente difíciles de alcanzar)
        let sKDA = calcStat(kdaNum, 11.0); // 11 KDA = 99
        let sDPM = calcStat(dpm, 1050); // 1050 DPM = 99
        let sCS = calcStat(cs, 9.5); // 9.5 CS/m = 99
        let sKP = calcStat(kpReal, 85); // 85% KP = 99
        let sVIS = calcStat(vspm, 3.5); // 3.5 Visión/m = 99
        let sGPM = calcStat(gpm, 520); // 520 Oro/m = 99
        let sPTS = calcStat(pts, 350); // 350 Puntos = 99

        let shortRole = p.role ? p.role.toUpperCase() : "FILL";
        let ovr = 60;

        // Fórmulas de peso por Rol (Evaluación Realista)
        switch (shortRole) {
          case "TOP":
            ovr =
              sDPM * 0.25 + sCS * 0.25 + sKDA * 0.2 + sKP * 0.15 + sPTS * 0.15;
            break;
          case "JUNGLE":
          case "JGL":
            ovr =
              sKP * 0.3 + sKDA * 0.25 + sVIS * 0.2 + sPTS * 0.15 + sCS * 0.1;
            break;
          case "MIDDLE":
          case "MID":
            ovr =
              sDPM * 0.3 + sKDA * 0.25 + sCS * 0.25 + sKP * 0.1 + sPTS * 0.1;
            break;
          case "BOTTOM":
          case "ADC":
            ovr =
              sDPM * 0.35 + sKDA * 0.25 + sCS * 0.2 + sGPM * 0.1 + sPTS * 0.1;
            break;
          case "SUPPORT":
          case "SUP":
            ovr = sVIS * 0.35 + sKP * 0.35 + sKDA * 0.2 + sPTS * 0.1;
            break;
          default:
            ovr = sDPM * 0.2 + sKDA * 0.2 + sCS * 0.2 + sKP * 0.2 + sPTS * 0.2;
        }

        ovr = Math.floor(ovr);

        // Penalización de Inconsistencia: Si tu winrate es < 50%, no puedes ser un Dios de +90 OVR
        let wr = safeFloat(p.winrate);
        if (wr < 50 && ovr > 85) ovr -= 4;

        return Math.min(99, Math.max(60, ovr));
      }

      function updateH2H() {
        const valA = document.getElementById("h2h-select-a").value;
        const valB = document.getElementById("h2h-select-b").value;
        const cA = document.getElementById("h2h-card-a");
        const cB = document.getElementById("h2h-card-b");
        const radarC = document.getElementById("h2h-chart-container");

        if (!valA || !valB) {
          cA.classList.add("hidden");
          cB.classList.add("hidden");
          radarC.classList.add("hidden");
          return;
        }

        const pA = globalStatsData.find((x) => x.name === dec(valA));
        const pB = globalStatsData.find((x) => x.name === dec(valB));
        if (!pA || !pB) return;

        // --- COMPARADOR DE STATS (Verde Gana, Rojo Pierde) ---
        const compare = (vA, vB, reverse = false) => {
          if (vA === vB) return ["text-slate-400", "text-slate-400"];
          let aWins = reverse ? vA < vB : vA > vB;
          return aWins
            ? ["text-emerald-400 font-black", "text-red-500 opacity-70"]
            : ["text-red-500 opacity-70", "text-emerald-400 font-black"];
        };

        // Extracción segura de números
        let numKdaA = parseFloat(pA.kdaNum) || 0;
        let numKdaB = parseFloat(pB.kdaNum) || 0;
        let dpmA = parseFloat(pA.dpm) || 0;
        let dpmB = parseFloat(pB.dpm) || 0;
        let gpmA = parseFloat(pA.gpm) || 0;
        let gpmB = parseFloat(pB.gpm) || 0;
        let csA = parseFloat(pA.cs) || 0;
        let csB = parseFloat(pB.cs) || 0;
        let visA = parseFloat(pA.vspm) || 0;
        let visB = parseFloat(pB.vspm) || 0;
        let ptsA = parseFloat(pA.points) || 0;
        let ptsB = parseFloat(pB.points) || 0;
        let kpA = parseFloat(pA.kp) || 0;
        let kpB = parseFloat(pB.kp) || 0;
        let wrA = parseFloat(pA.winrate) || 0;
        let wrB = parseFloat(pB.winrate) || 0;

        let [kdaColA, kdaColB] = compare(numKdaA, numKdaB);
        let [dpmColA, dpmColB] = compare(dpmA, dpmB);
        let [gpmColA, gpmColB] = compare(gpmA, gpmB);
        let [csColA, csColB] = compare(csA, csB);
        let [visColA, visColB] = compare(visA, visB);
        let [ptsColA, ptsColB] = compare(ptsA, ptsB);

        // Extraer Top 3 Campeones
        let champsA = pA.champs ? pA.champs.split(",") : [];
        let champsB = pB.champs ? pB.champs.split(",") : [];

        const getChampHtml = (arr) => {
          let h = "";
          for (let i = 0; i < 3; i++) {
            if (arr[i])
              h +=
                '<img src="' +
                getChampIcon(arr[i].trim()) +
                '" class="w-8 h-8 rounded-full border border-slate-600 bg-slate-900 shadow" title="' +
                escHtml(arr[i].trim()) +
                '">';
          }
          return h || '<span class="text-xs text-slate-500">Sin datos</span>';
        };

        let ovrA = calculatePlayerOVR(pA);
        let ovrB = calculatePlayerOVR(pB);

        // --- TARJETA JUGADOR A (AZUL) ---
        let htmlA =
          '<div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">';
        htmlA += '<div class="flex items-center gap-4">';
        htmlA +=
          '<img src="' +
          getChampIcon(champsA[0]) +
          '" class="w-14 h-14 rounded-full border-2 border-accent-blue shadow-[0_0_15px_rgba(56,189,248,0.4)]" onerror="this.style.display=\'none\'">';
        htmlA +=
          '<div class="text-left"><div class="font-oswald text-2xl text-white tracking-wider">' +
          escHtml(pA.name) +
          "</div>";
        htmlA +=
          '<div class="text-[10px] text-slate-400 uppercase tracking-widest">' +
          (pA.role || "FILL") +
          " | " +
          (pA.team || "FA") +
          "</div></div></div>";
        htmlA +=
          '<div class="bg-yellow-500 text-black font-black text-2xl px-3 py-1 rounded shadow-[0_0_15px_rgba(251,191,36,0.3)]">' +
          ovrA +
          "</div></div>";

        htmlA += '<div class="grid grid-cols-3 gap-3 mb-4">';
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">KDA</span><span class="text-2xl ' +
          kdaColA +
          '">' +
          numKdaA.toFixed(2) +
          "</span></div>";
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">DPM</span><span class="text-2xl ' +
          dpmColA +
          '">' +
          dpmA +
          "</span></div>";
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">GPM</span><span class="text-2xl ' +
          gpmColA +
          '">' +
          gpmA +
          "</span></div>";
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">CS/M</span><span class="text-2xl ' +
          csColA +
          '">' +
          csA.toFixed(1) +
          "</span></div>";
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">VISIÓN</span><span class="text-2xl ' +
          visColA +
          '">' +
          visA.toFixed(2) +
          "</span></div>";
        htmlA +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">PTS</span><span class="text-2xl ' +
          ptsColA +
          '">' +
          ptsA.toFixed(1) +
          "</span></div>";
        htmlA += "</div>";

        htmlA +=
          '<div class="border-t border-slate-700 pt-3 flex justify-between items-center"><span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Top Campeones</span><div class="flex gap-2">' +
          getChampHtml(champsA) +
          "</div></div>";

        // --- TARJETA JUGADOR B (ROJO) ---
        let htmlB =
          '<div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-700 flex-row-reverse">';
        htmlB += '<div class="flex items-center gap-4 flex-row-reverse">';
        htmlB +=
          '<img src="' +
          getChampIcon(champsB[0]) +
          '" class="w-14 h-14 rounded-full border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" onerror="this.style.display=\'none\'">';
        htmlB +=
          '<div class="text-right"><div class="font-oswald text-2xl text-white tracking-wider">' +
          escHtml(pB.name) +
          "</div>";
        htmlB +=
          '<div class="text-[10px] text-slate-400 uppercase tracking-widest">' +
          (pB.role || "FILL") +
          " | " +
          (pB.team || "FA") +
          "</div></div></div>";
        htmlB +=
          '<div class="bg-yellow-500 text-black font-black text-2xl px-3 py-1 rounded shadow-[0_0_15px_rgba(251,191,36,0.3)]">' +
          ovrB +
          "</div></div>";

        htmlB += '<div class="grid grid-cols-3 gap-3 mb-4">';
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">KDA</span><span class="text-2xl ' +
          kdaColB +
          '">' +
          numKdaB.toFixed(2) +
          "</span></div>";
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">DPM</span><span class="text-2xl ' +
          dpmColB +
          '">' +
          dpmB +
          "</span></div>";
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">GPM</span><span class="text-2xl ' +
          gpmColB +
          '">' +
          gpmB +
          "</span></div>";
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">CS/M</span><span class="text-2xl ' +
          csColB +
          '">' +
          csB.toFixed(1) +
          "</span></div>";
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">VISIÓN</span><span class="text-2xl ' +
          visColB +
          '">' +
          visB.toFixed(2) +
          "</span></div>";
        htmlB +=
          '<div class="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-inner"><span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">PTS</span><span class="text-2xl ' +
          ptsColB +
          '">' +
          ptsB.toFixed(1) +
          "</span></div>";
        htmlB += "</div>";

        htmlB +=
          '<div class="border-t border-slate-700 pt-3 flex justify-between items-center flex-row-reverse"><span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Top Campeones</span><div class="flex gap-2 flex-row-reverse">' +
          getChampHtml(champsB) +
          "</div></div>";

        cA.innerHTML = htmlA;
        cB.innerHTML = htmlB;

        // --- PREPARAR CONTENEDOR DE GRÁFICOS ---
        radarC.innerHTML =
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div style="position: relative; height: 350px; width: 100%;"><canvas id="h2hCompareRadar"></canvas></div><div style="position: relative; height: 350px; width: 100%;"><canvas id="h2hCompareBars"></canvas></div></div>';

        cA.classList.remove("hidden");
        cB.classList.remove("hidden");
        radarC.classList.remove("hidden");

        // =====================================
        // 📊 GRÁFICO 1: RADAR (El clásico)
        // =====================================
        const ctxR = document
          .getElementById("h2hCompareRadar")
          .getContext("2d");

        const getNorm = (p) => [
          Math.min(10, (parseFloat(p.dpm) || 0) / 100),
          Math.min(10, parseFloat(p.kdaNum) || 0),
          Math.min(10, (parseFloat(p.vspm) || 0) * 3),
          Math.min(10, parseFloat(p.cs) || 0),
          Math.max(0, 10 - (parseFloat(p.avgDeaths) || 0)),
        ];

        if (window.h2hRadarInstance) window.h2hRadarInstance.destroy();
        window.h2hRadarInstance = new Chart(ctxR, {
          type: "radar",
          data: {
            labels: ["Daño", "KDA", "Visión", "Farm", "Supervivencia"],
            datasets: [
              {
                label: pA.name,
                data: getNorm(pA),
                backgroundColor: "rgba(56, 189, 248, 0.4)",
                borderColor: "rgba(56, 189, 248, 1)",
                pointBackgroundColor: "#38bdf8",
                borderWidth: 2,
              },
              {
                label: pB.name,
                data: getNorm(pB),
                backgroundColor: "rgba(239, 68, 68, 0.4)",
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
                  color: "#cbd5e1",
                  font: { family: "Oswald", size: 14 },
                },
                ticks: { display: false, max: 10, min: 0 },
              },
            },
            plugins: { legend: { display: false } },
          },
        });

        // =====================================
        // 📊 GRÁFICO 2: BARRAS HORIZONTALES (Estilo de Juego)
        // =====================================
        const ctxB = document.getElementById("h2hCompareBars").getContext("2d");
        if (window.h2hBarInstance) window.h2hBarInstance.destroy();

        window.h2hBarInstance = new Chart(ctxB, {
          type: "bar",
          data: {
            labels: ["Winrate %", "Participación (KP%)", "Oro (GPM / 10)"],
            datasets: [
              {
                label: pA.name,
                data: [wrA, kpA, gpmA / 10],
                backgroundColor: "#38bdf8",
                borderRadius: 4,
              },
              {
                label: pB.name,
                data: [wrB, kpB, gpmB / 10],
                backgroundColor: "#ef4444",
                borderRadius: 4,
              },
            ],
          },
          options: {
            indexAxis: "y", // Lo hace horizontal
            maintainAspectRatio: false,
            scales: {
              x: {
                grid: { color: "rgba(255, 255, 255, 0.05)" },
                ticks: { color: "#94a3b8" },
                max: 100,
              },
              y: {
                grid: { display: false },
                ticks: { color: "#fff", font: { family: "Oswald", size: 14 } },
              },
            },
            plugins: {
              legend: {
                display: true,
                labels: { color: "#fff", font: { family: "Inter", size: 12 } },
              },
              tooltip: { mode: "index", intersect: false },
            },
          },
        });
      }

      function generateCromoImage() {
        const p = window.currentScoutPlayer;
        if (!p) return;

        const area = document.getElementById("cromo-export-area");

        let teamLogo = "";
        if (tournamentDataCache && tournamentDataCache.teams) {
          let t = tournamentDataCache.teams.find((t) => t.name === p.team);
          if (t) teamLogo = getLogo(t.logo);
        }
        if (!teamLogo)
          teamLogo =
            "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/logos/tier2-1.png";

        const roleIcons = {
          TOP: "TOP",
          JUNGLE: "JGL",
          MIDDLE: "MID",
          BOTTOM: "ADC",
          SUPPORT: "SUP",
          FILL: "FILL",
        };
        const shortRole =
          roleIcons[p.role ? p.role.toUpperCase() : "FILL"] || "FILL";

        // Equipo + división para mostrar como texto en el cromo
        const _tdParts = [];
        if (p.team && p.team !== "Agente Libre") _tdParts.push(p.team);
        if (p.division) _tdParts.push(p.division);
        const teamDivText = _tdParts.join("  ·  ");

        let cIcon = getChampSplash(
          p.champs ? p.champs.split(",")[0].trim() : "",
        );
        let arch = window.currentArchetype || {
          name: "JUGADOR",
          color: "text-white",
          hex: "#fff",
          icon: "⭐",
        };

        let parts = (p.kdaText || "0/0/0").split("/");
        let k = parseFloat(parts[0]) || 0;
        let d = parseFloat(parts[1]) || 0;
        let a = parseFloat(parts[2]) || 0;
        let kpReal = p.kp !== undefined && p.kp !== null ? parseFloat(p.kp) : 0;
        let vspm = parseFloat(p.vspm) || 0;
        let dpm = parseFloat(p.dpm) || 0;
        let cs = parseFloat(p.cs) || 0;
        let gpm = parseFloat(p.gpm) || 0;
        let kdaNum = parseFloat(p.kdaNum) || 0;

        let ovr = calculatePlayerOVR(p);

        let sc = [];
        switch (shortRole) {
          case "TOP":
            sc = [
              { l: "KIL", v: k.toFixed(1) },
              { l: "KDA", v: kdaNum.toFixed(1) },
              { l: "DPM", v: dpm },
              { l: "CS/M", v: cs.toFixed(1) },
              { l: "KP%", v: kpReal + "%" },
              { l: "VIS", v: vspm.toFixed(2) },
            ];
            break;
          case "JGL":
            sc = [
              { l: "KDA", v: kdaNum.toFixed(1) },
              { l: "KP%", v: kpReal + "%" },
              { l: "AST", v: a.toFixed(1) },
              { l: "VIS", v: vspm.toFixed(2) },
              { l: "GPM", v: gpm },
              { l: "DPM", v: dpm },
            ];
            break;
          case "MID":
          case "ADC":
            sc = [
              { l: "KIL", v: k.toFixed(1) },
              { l: "KDA", v: kdaNum.toFixed(1) },
              { l: "DPM", v: dpm },
              { l: "GPM", v: gpm },
              { l: "KP%", v: kpReal + "%" },
              { l: "CS/M", v: cs.toFixed(1) },
            ];
            break;
          case "SUP":
            sc = [
              { l: "AST", v: a.toFixed(1) },
              { l: "KDA", v: kdaNum.toFixed(1) },
              { l: "VIS", v: vspm.toFixed(2) },
              { l: "KP%", v: kpReal + "%" },
              { l: "PTS", v: p.points },
              { l: "GPM", v: gpm },
            ];
            break;
          default:
            sc = [
              { l: "KIL", v: k.toFixed(1) },
              { l: "KDA", v: kdaNum.toFixed(1) },
              { l: "DPM", v: dpm },
              { l: "CS/M", v: cs.toFixed(1) },
              { l: "KP%", v: kpReal + "%" },
              { l: "VIS", v: vspm.toFixed(2) },
            ];
        }

        let html = ' <div style="width: 500px; height: 750px; background: linear-gradient(135deg, ' + (arch.hex) +
          ' 0%, #0f172a 100%); padding: 15px; border-radius: 30px; position: relative; font-family: \'Oswald\', sans-serif; box-sizing: border-box; overflow: hidden; box-shadow: inset 0 0 50px rgba(0,0,0,0.8); border: 4px solid ' +
          (arch.hex) +
          ';"> <div style="position: absolute; inset: 10px; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; z-index: 1;"></div> <div style="position: absolute; inset: 10px; border-radius: 20px; background-image: url(\'' +
          (cIcon) +
          '\'); background-size: cover; background-position: center; opacity: 0.4; z-index: 2; mix-blend-mode: luminosity;"></div> <div style="position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column;"> <div style="display: flex; height: 50%;"> <div style="width: 35%; display: flex; flex-direction: column; align-items: center; padding-top: 40px; border-right: 2px solid ' +
          (arch.hex) +
          '80;"> <div style="font-size: 90px; font-weight: 900; line-height: 0.9; color: #fff; text-shadow: 0 0 20px ' +
          (arch.hex) + ';">' + (ovr) + '</div> <div style="font-size: 30px; font-weight: bold; color: ' +
          (arch.hex) + '; margin-bottom: 20px;">' + (shortRole) +
          '</div> <img crossorigin="anonymous" src="' + (teamLogo) +
          '" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));"> </div> <div style="width: 65%; position: relative;"> <img crossorigin="anonymous" src="' +
          (getChampIcon(p.champs ? p.champs.split(",")[0].trim() : "")) +
          '" style="position: absolute; bottom: 10px; right: 20px; width: 220px; height: 220px; object-fit: cover; border-radius: 50%; border: 6px solid ' +
          (arch.hex) +
          '; box-shadow: 0 10px 40px rgba(0,0,0,0.9);"> </div> </div> <div style="text-align: center; padding: 15px 0; border-top: 2px solid ' +
          (arch.hex) + '80; border-bottom: 2px solid ' + (arch.hex) +
          '80; background: rgba(0,0,0,0.6);"> <div style="font-size: 45px; font-weight: 900; color: #fff; letter-spacing: 3px; text-transform: uppercase; text-shadow: 2px 2px 5px #000;">' +
          (escHtml(p.name)) + '</div> <div style="color: ' + (arch.hex) +
          '; font-size: 18px; font-weight: bold; letter-spacing: 5px; margin-top: -5px;">' + (arch.icon) +
          ' ' + (arch.name) +
          '</div>' + (teamDivText ? ('<div style="color: #cbd5e1; font-size: 16px; font-weight: 600; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase; text-shadow: 1px 1px 3px #000;">' + (escHtml(teamDivText)) + '</div>') : '') + ' </div> <div style="display: flex; justify-content: space-between; padding: 30px; flex: 1; align-items: center;"> <div style="width: 45%; display: flex; flex-direction: column; gap: 20px;"> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[0].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[0].l) +
          '</span> </div> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[2].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[2].l) +
          '</span> </div> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[4].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[4].l) +
          '</span> </div> </div> <div style="width: 2px; height: 80%; background: ' + (arch.hex) +
          '80;"></div> <div style="width: 45%; display: flex; flex-direction: column; gap: 20px;"> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[1].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[1].l) +
          '</span> </div> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[3].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[3].l) +
          '</span> </div> <div style="display: flex; justify-content: space-between; font-size: 28px;"> <span style="color: #fff; font-weight: 900;">' +
          (sc[5].v) + '</span><span style="color: ' + (arch.hex) + '; font-weight: 600;">' + (sc[5].l) +
          '</span> </div> </div> </div> </div> </div> ';

        area.innerHTML = html;
        setTimeout(() => {
          html2canvas(area, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            allowTaint: false,
          }).then((canvas) => {
            let link = document.createElement("a");
            link.download = "Cromo_FUT_" + p.name + ".png";
            link.href = canvas.toDataURL("image/png");
            link.click();
          });
        }, 800);
      }

      function autoResolveScore() {
        const id = document.getElementById("modal-match-id").value;
        const riotId = document
          .getElementById("modal-riot-id-auto")
          .value.trim();
        const tournamentCode = document.getElementById("modal-tournament-code")
          ? document.getElementById("modal-tournament-code").value.trim()
          : "";

        if (!riotId && !tournamentCode)
          return alert("Debes poner la ID de Riot o el Código de Torneo.");

        const btn = document.getElementById("btn-auto-resolve");
        btn.innerText = "⏳ PROCESANDO...";
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            btn.innerText = "⚡ RESOLVER";
            btn.disabled = false;
            if (res.success) {
              closeModal("score-modal");
              refreshData();
            }
          })
          .withFailureHandler(function (err) {
            alert("❌ Error: " + err.message);
            btn.innerText = "⚡ RESOLVER";
            btn.disabled = false;
          })
          .autoResolveTournamentMatch(id, riotId, tournamentCode);
      }

      function submitScoreManual() {
        const id = document.getElementById("modal-match-id").value;
        const sA = parseInt(document.getElementById("score-a").value);
        const sB = parseInt(document.getElementById("score-b").value);
        const riotId = document
          .getElementById("modal-riot-id-manual")
          .value.trim();
        const vodUrl = document.getElementById("modal-vod-url").value.trim();

        let isBracket =
          tournamentDataCache && tournamentDataCache.format.includes("elim");
        if (isBracket && sA === sB) {
          alert("Sin empates en eliminatorias.");
          return;
        }

        document.getElementById("btn-submit-score").innerText = "GUARDANDO...";
        google.script.run
          .withSuccessHandler(function (res) {
            closeModal("score-modal");
            document.getElementById("btn-submit-score").innerText = "GUARDAR";
            refreshData();
          })
          .withFailureHandler(function (err) {
            alert("❌ Error: " + err.message);
            document.getElementById("btn-submit-score").innerText = "GUARDAR";
          })
          .updateMatchResult(id, sA, sB, riotId, vodUrl);
      }

      function copyDiscordSummary() {
        const match = tournamentDataCache.matches.find(
          (m) => m.id === window.lastPostGameMatchId,
        );
        const data = window.lastPostGameData;
        if (!match || !data || data.error) return;

        let names = match.names.split(" vs ");
        let allPlayers = [...data.winners, ...data.losers];
        let mvp = allPlayers.sort((a, b) =>
          b.votes !== a.votes
            ? b.votes - a.votes
            : (b.k + b.a) / Math.max(1, b.d) - (a.k + a.a) / Math.max(1, a.d),
        )[0];

        let text =
          "🏆 **[LIGA] " +
          match.round +
          "**\n🔵 **" +
          names[0] +
          " (" +
          match.sA +
          ")** vs 🔴 **" +
          names[1] +
          " (" +
          match.sB +
          ")**\n";
        if (mvp)
          text +=
            "⭐ **MVP/ACE:** " +
            mvp.name +
            " (" +
            mvp.k +
            "/" +
            mvp.d +
            "/" +
            mvp.a +
            ") - *" +
            mvp.champ +
            "*\n";
        if (match.vod) text += "🎬 **VOD:** " + match.vod + "\n";
        text += "📊 *[Revisa el acta y la tarjeta en la web]*";

        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard
            .writeText(text)
            .then(() => alert("Copiado al portapapeles"));
        } else {
          let textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand("copy");
            alert("Copiado al portapapeles");
          } catch (err) {}
          document.body.removeChild(textArea);
        }
      }

      function switchTab(tabId, el) {
        // Compatibilidad con ambos sistemas: .tab-btn (legacy) y .wg-nav-item (nuevo)
        document
          .querySelectorAll(".tab-btn, .wg-nav-item")
          .forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".content-pane")
          .forEach((p) => p.classList.remove("active"));
        if (el) el.classList.add("active");
        // También activar el btn correspondiente por ID por si se llama sin pasar el elemento
        const btnEl = document.getElementById("btn-tab-" + tabId);
        if (btnEl && el !== btnEl) btnEl.classList.add("active");
        const pane = document.getElementById("tab-" + tabId);
        if (pane) pane.classList.add("active");
        if (tabId === "news") setTimeout(renderPowerRankings, 100);
        if (tabId === "h2h") populateH2HDropdowns();
        if (tabId === "teamh2h") populateTeamH2HDropdowns();
        if (tabId === "playoffs") renderPlayoffsTree();
        if (tabId === "records") loadHallOfFamePodiums();
      }

      // Carga los podios históricos en el Salón de la Fama
      function loadHallOfFamePodiums() {
        const cont = document.getElementById("hof-podiums-container");
        if (!cont) return;
        google.script.run
          .withSuccessHandler(function (res) {
            const podiums = (res && res.podiums) ? res.podiums : [];
            const section = document.getElementById("hof-podiums-section");
            if (podiums.length === 0) {
              // Ocultar la sección entera si no hay podios archivados
              if (section) section.style.display = "none";
              return;
            }
            if (section) section.style.display = "block";
            renderPodiums(podiums, cont);
          })
          .withFailureHandler(function () {
            const section = document.getElementById("hof-podiums-section");
            if (section) section.style.display = "none";
          })
          .getSeasonPodiums();
      }

      function openModalScore(e, matchId, encA, encB) {
        if (e) e.stopPropagation();
        document.getElementById("modal-match-id").value = matchId;
        document.getElementById("modal-team-a").innerText = dec(encA);
        document.getElementById("modal-team-b").innerText = dec(encB);
        document.getElementById("score-a").value = 0;
        document.getElementById("score-b").value = 0;
        document.getElementById("modal-riot-id-auto").value = "";
        document.getElementById("modal-riot-id-manual").value = "";
        document.getElementById("modal-vod-url").value = "";
        document.getElementById("score-modal").style.display = "flex";
      }

      function castVote(e, matchId, teamIndex) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }

        let voterName = localStorage.getItem("my_summoner_name");
        if (!voterName) {
          voterName = prompt("🔮 PICK'EMS: ¿Cuál es tu Invocador?");
          if (!voterName || voterName.trim() === "") return;
          localStorage.setItem("my_summoner_name", voterName.trim());
        }
        let btn = e.currentTarget;
        let originalText = btn.innerText;
        btn.innerText = "⏳";
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            btn.innerText = originalText;
            btn.disabled = false;
            if (res.success) refreshData();
          })
          .withFailureHandler(function (err) {
            alert("❌ Error: " + err.message);
            btn.innerText = originalText;
            btn.disabled = false;
          })
          .castVoteBackend(matchId, teamIndex, voterName);
      }

      function scanRiotMatch() {
        const matchId = document.getElementById("riot-match-id").value.trim();
        const tCodeEl = document.getElementById("riot-tournament-code-scan");
        const tournamentCode = tCodeEl ? tCodeEl.value.trim() : "";
        if (!matchId && !tournamentCode)
          return alert("Pon el Match ID (EUW1_…) o el código de torneo.");
        const btn = document.getElementById("btn-scan-match");
        btn.innerText = "⏳";
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.msg) alert(res.msg);
            else alert("Partida escaneada.");
            btn.innerText = "ESCANEAR";
            btn.disabled = false;
            document.getElementById("riot-match-id").value = "";
            if (tCodeEl) tCodeEl.value = "";
            refreshData();
          })
          .withFailureHandler(function (err) {
            alert("❌ Error al escanear: " + err.message);
            btn.innerText = "ESCANEAR";
            btn.disabled = false;
          })
          .registerTournamentMatch(matchId, tournamentCode);
      }

      function askAIPrediction(matchId) {
        const btn = document.getElementById("btn-ai-predict");
        const box = document.getElementById("ai-prediction-box");
        const text = document.getElementById("ai-prediction-text");

        btn.disabled = true;
        btn.innerHTML =
          '<span class="animate-spin text-2xl">🌀</span> ANALIZANDO...';

        const match = tournamentDataCache.matches.find((m) => m.id === matchId);
        const names = match.names.split(" vs ");
        const teamA = tournamentDataCache.teams.find(
          (t) => t.name === names[0].trim(),
        );
        const teamB = tournamentDataCache.teams.find(
          (t) => t.name === names[1].trim(),
        );

        const matchData = {
          match: match,
          teamA: teamA,
          teamB: teamB,
          statsA: globalStatsData.filter((p) => p.team === teamA.name),
          statsB: globalStatsData.filter((p) => p.team === teamB.name),
        };

        google.script.run
          .withSuccessHandler(function (res) {
            text.innerHTML = res.replace(/\n/g, "<br>");
            box.classList.remove("hidden");
            btn.disabled = false;
            btn.innerHTML =
              '<span class="text-2xl">🤖</span> PREDICCIÓN REGENERADA';

            // Scroll suave hacia el resultado
            box.scrollIntoView({ behavior: "smooth", block: "center" });
          })
          .withFailureHandler(function (err) {
            text.innerHTML =
              "❌ Hubo un problema al conectar con la IA. " + err.message;
            box.classList.remove("hidden");
            btn.disabled = false;
            btn.innerHTML =
              '<span class="text-2xl">🤖</span> REINTENTAR PREDICCIÓN';
          })
          .getAIPrediction(matchData);
      }

      function copyToDiscord(elementId) {
        const text = document.getElementById(elementId).innerText;
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        try {
          document.execCommand("copy");
          alert("✅ ¡Copiado al portapapeles! Ya puedes pegarlo en Discord.");
        } catch (err) {
          console.error("Error al copiar: ", err);
          alert("❌ No se pudo copiar automáticamente.");
        }
        document.body.removeChild(tempTextArea);
      }

      function openMatchScouting(matchId) {
        document.getElementById("scout-match-modal").style.display = "flex";
        const content = document.getElementById("previa-content");

        const match = tournamentDataCache.matches.find((m) => m.id === matchId);
        if (!match) {
          content.innerHTML =
            '<div class="text-white text-center">Error cargando partido.</div>';
          return;
        }

        const names = match.names.split(" vs ");
        const tA = tournamentDataCache.teams.find(
          (t) => t.name === names[0].trim(),
        ) || { name: names[0], w: 0, l: 0, pts: 0, logo: "" };
        const tB = tournamentDataCache.teams.find(
          (t) => t.name === names[1].trim(),
        ) || { name: names[1], w: 0, l: 0, pts: 0, logo: "" };

        let logoA = getLogo(tA.logo);
        let logoB = getLogo(tB.logo);

        // --- DETALLES DE CONFIRMACIÓN Y HORARIO ---
        let statusHtml = "";
        if (match.date && match.date.trim() !== "") {
          statusHtml = ' <div class="bg-emerald-500/20 border border-emerald-500/50 p-3 rounded-lg mb-4 text-center"> <div class="text-emerald-400 font-black text-xs uppercase tracking-widest">✅ PARTIDO CONFIRMADO</div> <div class="text-white font-oswald text-xl">' +
            (match.date) + '</div> </div> ';
        } else if (match.proposedDate && match.proposedDate.trim() !== "") {
          let waiter = match.proposedBy == tA.id ? tB.name : tA.name;
          statusHtml = ' <div class="bg-yellow-500/20 border border-yellow-500/50 p-3 rounded-lg mb-4 text-center"> <div class="text-yellow-500 font-black text-xs uppercase tracking-widest">⏳ PROPUESTA PENDIENTE</div> <div class="text-white font-oswald text-lg">Propuesto para: ' +
            (match.proposedDate) +
            '</div> <div class="text-[10px] text-slate-400 font-bold mt-1 uppercase">A la espera de: <span class="text-yellow-400">' +
            (waiter) + '</span></div> </div> ';
        } else {
          statusHtml = ' <div class="bg-slate-700/30 border border-slate-600 p-3 rounded-lg mb-4 text-center"> <div class="text-slate-400 font-black text-xs uppercase tracking-widest italic">📅 HORARIO SIN DEFINIR</div> </div> ';
        }

        // --- CÓDIGO DE TORNEO ---
        let tournamentCodeHtml = "";
        if (currentUserRole === "admin") {
          tournamentCodeHtml = ' <div class="bg-indigo-900/40 border border-indigo-500/50 p-4 rounded-xl mb-6"> <label class="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-2 block">Panel de Admin: Código de Torneo</label> <div class="flex gap-2"> <input type="text" id="admin-tcode-input" value="' +
            (match.tCode || "") +
            '" class="bg-black/60 border border-slate-700 text-white text-sm rounded px-3 py-2 w-full focus:outline-none focus:border-indigo-500" placeholder="Ej: TRNMT-1234..."> <button onclick="saveTournamentCode(\'' +
            (matchId) +
            '\')" id="btn-save-tcode" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 rounded transition text-xs">GUARDAR</button> </div> </div> ';
        } else if (match.tCode && match.tCode.trim() !== "") {
          tournamentCodeHtml = ' <div class="bg-indigo-900/40 border-2 border-indigo-500 p-4 rounded-xl mb-6 flex justify-between items-center shadow-[0_0_15px_rgba(99,102,241,0.3)] group transition-all hover:border-indigo-400"> <div class="flex-1 min-w-0 mr-4"> <label class="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1 block">🏆 CÓDIGO DE TORNEO</label> <div class="text-white font-mono text-sm truncate select-all">' +
            (match.tCode) + '</div> </div> <button onclick="copyTournamentCode(\'' + (match.tCode) +
            '\')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center gap-2"> <span>COPIAR</span> <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-12a2 2 0 002-2h-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> </button> </div> ';
        }

        let html = ' <div class="flex justify-between items-center bg-slate-800/50 p-6 rounded-xl border border-slate-700 mb-6 shadow-lg"> <div class="flex flex-col items-center w-1/3 text-center"> <img src="' +
          (logoA) +
          '" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-2"> <div class="font-oswald text-2xl text-white tracking-widest uppercase truncate w-full">' +
          (escHtml(tA.name)) + '</div> <div class="text-emerald-400 font-bold">' + (tA.w) + 'W - ' + (tA.l) +
          'L</div> </div> <div class="w-1/3 flex flex-col items-center justify-center"> <div class="text-5xl font-black font-oswald text-slate-600 mb-2">VS</div> <div class="text-xs text-slate-400 font-bold tracking-widest uppercase bg-black/50 px-3 py-1 rounded-full border border-slate-700">' +
          (match.round) +
          '</div> </div> <div class="flex flex-col items-center w-1/3 text-center"> <img src="' + (logoB) +
          '" class="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-2"> <div class="font-oswald text-2xl text-white tracking-widest uppercase truncate w-full">' +
          (escHtml(tB.name)) + '</div> <div class="text-emerald-400 font-bold">' + (tB.w) + 'W - ' + (tB.l) +
          'L</div> </div> </div> ' + (statusHtml) + ' ' + (tournamentCodeHtml) +
          ' <h3 class="text-center font-oswald text-accent-blue tracking-widest mb-4 text-xl uppercase">🥊 Cara a Cara (Rosters)</h3> <div class="flex flex-col gap-3 p-4 bg-slate-800/30 rounded-xl"> ';

        const rolesOrder = ["TOP", "JNG", "MID", "ADC", "SUPP"];
        const roleLabels = {
          TOP: "🛡️ TOP",
          JNG: "🌲 JGL",
          MID: "🔥 MID",
          ADC: "🏹 ADC",
          SUPP: "💖 SUP",
        };

        let pA_list = globalStatsData.filter((p) => p.team === tA.name);
        let pB_list = globalStatsData.filter((p) => p.team === tB.name);

        const _sumTeam = (list, field) =>
          list.reduce((s, p) => s + (parseFloat(p[field]) || 0), 0);
        const _avgTeam = (list, field) =>
          list.length
            ? (_sumTeam(list, field) / list.length).toFixed(1)
            : "0.0";
        const totDpmA = _sumTeam(pA_list, "dpm");
        const totDpmB = _sumTeam(pB_list, "dpm");
        const maxTotDpm = Math.max(totDpmA, totDpmB, 1);
        const wrA =
          tA.w + tA.l > 0 ? Math.round((tA.w / (tA.w + tA.l)) * 100) : 0;
        const wrB =
          tB.w + tB.l > 0 ? Math.round((tB.w / (tB.w + tB.l)) * 100) : 0;

        const _buildOpgg = (team) => {
          if (!team.roster || team.roster.trim() === "") return "";
          const _enc = encodeURIComponent(
            team.roster
              .split(",")
              .map((n) => {
                n = n.trim();
                return n.includes("#") ? n : n + "#EUW";
              })
              .join(","),
          );
          return (
            '<a href="https://www.op.gg/multisearch/euw?summoners=' +
            _enc +
            '" target="_blank" class="flex items-center gap-1.5 bg-[#1a78c2] hover:bg-[#1565a8] text-white text-[10px] font-black px-3 py-1.5 rounded-full transition shadow uppercase tracking-widest"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>OP.GG</a>'
          );
        };

        html +=
          '<div class="grid grid-cols-3 gap-3 mb-5 text-xs">' +
          '<div class="bg-blue-900/30 border border-blue-700/40 rounded-xl p-3 flex flex-col gap-2">' +
          '<div class="flex items-center justify-between gap-2 flex-wrap"><span class="text-blue-300 font-black text-base">' +
          wrA +
          "% WR</span>" +
          _buildOpgg(tA) +
          "</div>" +
          '<div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div style="width:' +
          ((totDpmA / maxTotDpm) * 100).toFixed(0) +
          '%;background:#3b82f6;height:100%;border-radius:9999px;transition:1s"></div></div>' +
          '<div class="text-slate-300 font-mono">DPM: <span class="text-blue-400 font-black">' +
          Math.round(totDpmA) +
          "</span></div>" +
          '<div class="text-slate-400">KDA: ' +
          _avgTeam(pA_list, "kills") +
          "/" +
          _avgTeam(pA_list, "avgDeaths") +
          "/" +
          _avgTeam(pA_list, "assists") +
          "</div>" +
          "</div>" +
          '<div class="flex items-center justify-center"><span class="text-slate-600 font-oswald text-4xl font-black">VS</span></div>' +
          '<div class="bg-red-900/30 border border-red-700/40 rounded-xl p-3 flex flex-col gap-2 text-right">' +
          '<div class="flex items-center justify-between gap-2 flex-wrap flex-row-reverse"><span class="text-red-300 font-black text-base">' +
          wrB +
          "% WR</span>" +
          _buildOpgg(tB) +
          "</div>" +
          '<div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div style="width:' +
          ((totDpmB / maxTotDpm) * 100).toFixed(0) +
          '%;background:#ef4444;height:100%;border-radius:9999px;margin-left:auto;transition:1s"></div></div>' +
          '<div class="text-slate-300 font-mono">DPM: <span class="text-red-400 font-black">' +
          Math.round(totDpmB) +
          "</span></div>" +
          '<div class="text-slate-400">KDA: ' +
          _avgTeam(pB_list, "kills") +
          "/" +
          _avgTeam(pB_list, "avgDeaths") +
          "/" +
          _avgTeam(pB_list, "assists") +
          "</div>" +
          "</div></div>";

        html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">';
        html += '<div class="bg-slate-900 border border-slate-700 rounded-xl p-4"><h4 class="text-center font-bold text-xs uppercase mb-2 text-slate-400 tracking-widest">⚡ Team Profile (Promedios)</h4><div style="position:relative; height:260px; width:100%"><canvas id="teamScoutRadar"></canvas></div></div>';
        html += '<div class="bg-slate-900 border border-slate-700 rounded-xl p-4"><h4 class="text-center font-bold text-xs uppercase mb-2 text-slate-400 tracking-widest">🏯 Daño a Objetivos &amp; Torres</h4><div style="position:relative; height:260px; width:100%"><canvas id="teamScoutBar"></canvas></div></div>';
        html += '</div>';

        html += '<h3 class="text-center font-oswald text-slate-400 tracking-widest mb-3 text-sm uppercase">⚔️ Cara a Cara por Línea</h3><div class="flex flex-col gap-2">';

        rolesOrder.forEach((role) => {
          let pA = pA_list.find((x) => x.role === role) || {
            name: "TBD", dpm: 0, winrate: 0, kdaText: "-/-/-", champs: "", gpm: 0, cs: 0, vspm: 0
          };
          let pB = pB_list.find((x) => x.role === role) || {
            name: "TBD", dpm: 0, winrate: 0, kdaText: "-/-/-", champs: "", gpm: 0, cs: 0, vspm: 0
          };
          let dpmA = parseFloat(pA.dpm) || 0;
          let dpmB = parseFloat(pB.dpm) || 0;
          let gpmA = parseFloat(pA.gpm) || 0;
          let gpmB = parseFloat(pB.gpm) || 0;
          let csA  = parseFloat(pA.cs)  || 0;
          let csB  = parseFloat(pB.cs)  || 0;
          let vsA  = parseFloat(pA.vspm)|| 0;
          let vsB  = parseFloat(pB.vspm)|| 0;
          let wrA2 = parseFloat(pA.winrate) || 0;
          let wrB2 = parseFloat(pB.winrate) || 0;
          let winA = dpmA >= dpmB;
          let cIconA = pA.champs
            ? '<img src="' + getChampIcon(pA.champs.split(",")[0]) + '" class="w-8 h-8 rounded-full border border-slate-600 flex-shrink-0" onerror="this.style.display=\'none\'">'
            : '<div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0"></div>';
          let cIconB = pB.champs
            ? '<img src="' + getChampIcon(pB.champs.split(",")[0]) + '" class="w-8 h-8 rounded-full border border-slate-600 flex-shrink-0" onerror="this.style.display=\'none\'">'
            : '<div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex-shrink-0"></div>';

          var _mkBar2 = function(lbl, vA, vB, fmtFn) {
            var tot2 = (vA||0)+(vB||0); var pA3 = tot2>0?Math.round((vA/tot2)*100):50; var pB3=100-pA3;
            var wA3 = vA >= vB;
            return '<div class="flex items-center gap-1 text-[9px] mt-1">' +
              '<span class="w-10 text-right font-mono font-bold ' + (wA3?'text-blue-300':'text-slate-500') + '">' + fmtFn(vA||0) + '</span>' +
              '<div class="flex-1 flex items-center h-3">' +
                '<div class="flex-1 flex justify-end h-full overflow-hidden"><div style="width:' + pA3 + '%;background:' + (wA3?'#3b82f6':'#1e3a5f') + ';height:100%;border-radius:3px 0 0 3px;transition:width 1s"></div></div>' +
                '<span class="text-[8px] text-slate-600 font-black px-1 flex-shrink-0 w-8 text-center leading-none">' + lbl + '</span>' +
                '<div class="flex-1 h-full overflow-hidden"><div style="width:' + pB3 + '%;background:' + (!wA3?'#ef4444':'#3b1f25') + ';height:100%;border-radius:0 3px 3px 0;transition:width 1s"></div></div>' +
              '</div>' +
              '<span class="w-10 font-mono font-bold ' + (!wA3?'text-red-300':'text-slate-500') + '">' + fmtFn(vB||0) + '</span>' +
            '</div>';
          };

          html +=
            '<div class="bg-slate-900 border border-slate-700 rounded-xl p-3 hover:border-slate-500 transition">' +
            '<div class="flex items-center gap-2 mb-1">' +
            '<div class="flex items-center gap-2 w-[42%]">' + cIconA +
            '<div class="min-w-0"><div class="font-bold text-sm truncate ' + (winA?'text-emerald-300':'text-white') + '">' + escHtml(pA.name) + '</div>' +
            '<div class="text-[9px] text-slate-400 font-mono">' + (pA.kdaText||'-') + '</div></div></div>' +
            '<div class="w-[16%] text-center text-[10px] text-slate-500 font-black uppercase flex-shrink-0">' + (roleLabels[role]||role) + '</div>' +
            '<div class="flex items-center gap-2 w-[42%] justify-end text-right"><div class="min-w-0">' +
            '<div class="font-bold text-sm truncate ' + (!winA?'text-emerald-300':'text-white') + '">' + escHtml(pB.name) + '</div>' +
            '<div class="text-[9px] text-slate-400 font-mono">' + (pB.kdaText||'-') + '</div></div>' + cIconB + '</div></div>' +
            '<div class="pt-1 border-t border-slate-800 space-y-0">' +
            _mkBar2('DPM',  dpmA, dpmB, function(v){ return v>0?Math.round(v):'-'; }) +
            _mkBar2('GPM',  gpmA, gpmB, function(v){ return v>0?Math.round(v):'-'; }) +
            _mkBar2('CS/M', csA,  csB,  function(v){ return v>0?v.toFixed(1):'-'; }) +
            _mkBar2('VSPM', vsA,  vsB,  function(v){ return v>0?v.toFixed(2):'-'; }) +
            _mkBar2('WR%',  wrA2, wrB2, function(v){ return v+'%'; }) +
            '</div></div>';
        });
        html += ' </div> <div id="ai-prediction-box" class="mt-8 hidden"> <div class="bg-slate-900 border-2 border-purple-500 rounded-xl p-6 shadow-[0_0_20px_rgba(168,85,247,0.3)] animate-pulse-slow"> <div class="flex justify-between items-center mb-4"> <div class="text-purple-400 font-oswald tracking-widest uppercase flex items-center gap-2"> <span class="text-xl">🤖</span> INFORME DE LA IA </div> <button onclick="copyToDiscord(\'ai-prediction-text\')" class="text-[9px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition uppercase font-black">Copiar a Discord</button> </div> <div id="ai-prediction-text" class="text-slate-300 text-sm leading-relaxed italic space-y-4"></div> </div> </div> <div class="mt-8 flex justify-center"> <button id="btn-ai-predict" onclick="askAIPrediction(\'' +
          (matchId) +
          '\')" class="bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white font-black px-10 py-4 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-all hover:scale-110 tracking-widest uppercase flex items-center gap-3"> <span class="text-2xl">🤖</span> PREDICCIÓN IA </button> </div> ';
        // Añadir sección de scouting avanzado con placeholder mientras carga
        html += '<div id="adv-scouting-section" class="mt-6 bg-slate-900/50 border border-slate-700 rounded-xl p-4">' +
          '<div class="flex items-center gap-2 mb-3"><span class="text-cyan-400 text-xs font-black uppercase tracking-widest">🔍 Scouting Avanzado</span>' +
          '<span id="adv-scouting-loader" class="text-slate-500 text-xs">Cargando datos avanzados...</span></div>' +
          '<div id="adv-scouting-body" class="space-y-2"></div></div>';

        content.innerHTML = html;

        // === RENDER SCOUT CHARTS ===
        setTimeout(function() {
          var ctxSR = document.getElementById("teamScoutRadar");
          if (ctxSR && typeof Chart !== "undefined") {
            if (window.scoutRadarInst) { try { window.scoutRadarInst.destroy(); } catch(e){} }
            var _aF3 = function(list, f) { return list.length ? list.reduce(function(s,p){ return s+(parseFloat(p[f])||0); },0)/list.length : 0; };
            var nA3 = [
              Math.min(10, Math.max(0, _aF3(pA_list,"kdaNum") * 2)),
              Math.min(10, Math.max(0, _aF3(pA_list,"dpm") / 300)),
              Math.min(10, Math.max(0, _aF3(pA_list,"gpm") / 50)),
              Math.min(10, Math.max(0, _aF3(pA_list,"cs") * 1.5)),
              Math.min(10, Math.max(0, _aF3(pA_list,"vspm") * 5)),
              Math.min(10, Math.max(0, (wrA||0) / 10))
            ];
            var nB3 = [
              Math.min(10, Math.max(0, _aF3(pB_list,"kdaNum") * 2)),
              Math.min(10, Math.max(0, _aF3(pB_list,"dpm") / 300)),
              Math.min(10, Math.max(0, _aF3(pB_list,"gpm") / 50)),
              Math.min(10, Math.max(0, _aF3(pB_list,"cs") * 1.5)),
              Math.min(10, Math.max(0, _aF3(pB_list,"vspm") * 5)),
              Math.min(10, Math.max(0, (wrB||0) / 10))
            ];
            window.scoutRadarInst = new Chart(ctxSR, {
              type: "radar",
              data: { labels: ["KDA","DPM","GPM","CS/M","VSPM","WR%"], datasets: [
                { label: escHtml(tA.name), data: nA3, backgroundColor: "rgba(56,189,248,0.2)", borderColor: "#38bdf8", pointBackgroundColor: "#38bdf8", borderWidth: 2 },
                { label: escHtml(tB.name), data: nB3, backgroundColor: "rgba(239,68,68,0.2)", borderColor: "#ef4444", pointBackgroundColor: "#ef4444", borderWidth: 2 }
              ]},
              options: { maintainAspectRatio: false, scales: { r: { angleLines: { color: "rgba(255,255,255,0.08)" }, grid: { color: "rgba(255,255,255,0.08)" }, pointLabels: { color: "#94a3b8", font: { family: "Oswald", size: 11 } }, ticks: { display: false, max: 10, min: 0 } } }, plugins: { legend: { labels: { color: "#e2e8f0", font: { family: "Oswald", size: 12 } } } } }
            });
          }
          var ctxSB = document.getElementById("teamScoutBar");
          if (ctxSB && typeof Chart !== "undefined") {
            if (window.scoutBarInst) { try { window.scoutBarInst.destroy(); } catch(e){} }
            var rList4 = ["TOP","JNG","MID","ADC","SUPP"];
            var rCol4 = { TOP:"#10b981", JNG:"#ef4444", MID:"#8b5cf6", ADC:"#f59e0b", SUPP:"#3b82f6" };
            var _getR4 = function(list, role, field) { var p = list.find(function(x){ return x.role === role; }); return p ? parseFloat(p[field])||0 : 0; };
            window.scoutBarInst = new Chart(ctxSB, {
              type: "bar",
              data: { labels: [escHtml(tA.name)+" (Obj)", escHtml(tB.name)+" (Obj)", escHtml(tA.name)+" (Torres)", escHtml(tB.name)+" (Torres)"],
                datasets: rList4.map(function(r){ return { label:r, data:[_getR4(pA_list,r,"dmgObj"),_getR4(pB_list,r,"dmgObj"),_getR4(pA_list,r,"dmgTurrets"),_getR4(pB_list,r,"dmgTurrets")], backgroundColor:rCol4[r], borderColor:"#0f172a", borderWidth:1, borderRadius:3 }; }) },
              options: { indexAxis:"y", maintainAspectRatio:false, scales: { x:{ stacked:true, ticks:{color:"#94a3b8", callback:function(v){return v>=1000?(v/1000).toFixed(1)+"k":v;}}, grid:{color:"rgba(51,65,85,0.15)"} }, y:{stacked:true, ticks:{color:"#94a3b8", font:{family:"Oswald",size:10}}, grid:{display:false}} }, plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(ctx){var v=ctx.raw||0; if(v===0) return null; return ctx.dataset.label+": "+(v>=1000?(v/1000).toFixed(1)+"k":Math.round(v)); }}}} }
            });
          }
        }, 100);

        // Cargar datos avanzados del backend
        google.script.run
          .withSuccessHandler(function(scoutData) {
            const loaderEl = document.getElementById("adv-scouting-loader");
            const bodyEl   = document.getElementById("adv-scouting-body");
            if (!loaderEl || !bodyEl) return;
            loaderEl.style.display = "none";
            if (scoutData.error) { bodyEl.innerHTML = '<div class="text-slate-500 text-xs">' + scoutData.error + '</div>'; return; }

            // H2H histórico
            var h2hHtml = "";
            if ((scoutData.teamA && scoutData.teamA.h2h !== undefined) || (scoutData.teamB && scoutData.teamB.h2h !== undefined)) {
              var hA = scoutData.teamA.h2h || 0, hB = scoutData.teamB.h2h || 0;
              if (hA + hB > 0) {
                h2hHtml = '<div class="text-center text-xs text-slate-400 mb-3">Historial directo: <span class="text-blue-400 font-black">' + hA + '</span> — <span class="text-red-400 font-black">' + hB + '</span></div>';
              }
            }

            const roles = ["TOP","JNG","MID","ADC","SUP"];
            let advHtml = h2hHtml + '<div class="space-y-2">';

            roles.forEach(function(role) {
              var pA = (scoutData.teamA.players || []).find(function(p){ return p.mainRole === role; }) || null;
              var pB = (scoutData.teamB.players || []).find(function(p){ return p.mainRole === role; }) || null;
              if (!pA && !pB) return;
              var nameA = pA ? pA.name : "—", nameB = pB ? pB.name : "—";
              var kdaA  = pA ? pA.kda  : "—",  kdaB  = pB ? pB.kda  : "—";
              var dpmA  = pA ? pA.dpm  : 0,    dpmB  = pB ? pB.dpm  : 0;
              var wrA   = pA ? pA.wr   : 0,    wrB   = pB ? pB.wr   : 0;
              var gpmA  = pA ? pA.gpm  : 0,    gpmB  = pB ? pB.gpm  : 0;
              var vsA   = pA ? pA.vspm : 0,    vsB   = pB ? pB.vspm : 0;
              var champsA = pA ? (pA.topChamps || []).slice(0,3).map(function(c){return c.name;}) : [];
              var champsB = pB ? (pB.topChamps || []).slice(0,3).map(function(c){return c.name;}) : [];
              var advantage = dpmA >= dpmB ? "blue" : "red";

              function champIcons(list) {
                return list.map(function(c){
                  return '<img src="' + getChampIcon(c) + '" style="width:20px;height:20px;border-radius:50%;border:1px solid #334155" title="' + c + '" onerror="this.style.display=\'none\'">';
                }).join('');
              }

              advHtml += '<div style="background:rgba(15,23,42,0.8);border:1px solid #334155;border-radius:10px;padding:8px 12px;">' +
                '<div style="display:flex;align-items:center;gap:8px;">' +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">' +
                      '<span style="font-weight:700;font-size:.82rem;color:' + (advantage==="blue" ? "#93c5fd" : "#f1f5f9") + '">' + escHtml(nameA) + '</span>' +
                      '<div style="display:flex;gap:2px;">' + champIcons(champsA) + '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;font-size:.68rem;color:#64748b;">' +
                      '<span style="color:' + (wrA>=55?"#10b981":"#94a3b8") + '">WR:' + wrA + '%</span>' +
                      '<span>KDA:' + kdaA + '</span>' +
                      '<span>DPM:' + dpmA + '</span>' +
                      '<span>GPM:' + gpmA + '</span>' +
                    '</div>' +
                  '</div>' +
                  '<div style="text-align:center;padding:0 10px;min-width:48px;font-family:Oswald,sans-serif;font-size:.75rem;color:#475569;font-weight:700;">' + role + '</div>' +
                  '<div style="flex:1;min-width:0;text-align:right;">' +
                    '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-bottom:3px;">' +
                      '<div style="display:flex;gap:2px;">' + champIcons(champsB) + '</div>' +
                      '<span style="font-weight:700;font-size:.82rem;color:' + (advantage==="red" ? "#fca5a5" : "#f1f5f9") + '">' + escHtml(nameB) + '</span>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;font-size:.68rem;color:#64748b;justify-content:flex-end;">' +
                      '<span>GPM:' + gpmB + '</span>' +
                      '<span>DPM:' + dpmB + '</span>' +
                      '<span>KDA:' + kdaB + '</span>' +
                      '<span style="color:' + (wrB>=55?"#10b981":"#94a3b8") + '">WR:' + wrB + '%</span>' +
                    '</div>' +
                  '</div>' +
                '</div></div>';
            });
            advHtml += '</div>';
            bodyEl.innerHTML = advHtml;
          })
          .withFailureHandler(function() {
            const loaderEl = document.getElementById("adv-scouting-loader");
            if (loaderEl) loaderEl.textContent = "";
          })
          .getMatchScoutingData(matchId);

        // Track Achievement: Ojeador
        AchievementManager.unlock("ojeador");
      }

    </script>