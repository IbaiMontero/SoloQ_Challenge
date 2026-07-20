
      function copyTournamentCode(code) {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = code;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        try {
          document.execCommand("copy");
          alert("✅ ¡Código de Torneo copiado! Pégalo en el cliente de LoL.");
        } catch (err) {
          alert("❌ No se pudo copiar.");
        }
        document.body.removeChild(tempTextArea);
      }

      function saveTournamentCode(matchId) {
        const code = document.getElementById("admin-tcode-input").value;
        const btn = document.getElementById("btn-save-tcode");
        btn.innerText = "⏳";
        btn.disabled = true;
        google.script.run
          .withSuccessHandler(function (res) {
            alert(res.msg);
            btn.innerText = "GUARDAR";
            btn.disabled = false;
            refreshData();
          })
          .setTournamentCode(matchId, code);
      }

      // 💡 NUEVA FUNCIÓN PARA CERRAR ACTAS EN BUCLE
      function resolveRoundAwards(roundName, btnElement) {
        if (
          !confirm(
            "¿Seguro que quieres CERRAR TODAS LAS ACTAS de la " +
              roundName +
              "? Los votos manuales dejarán de contar para todos los partidos completados.",
          )
        )
          return;

        let matchesToResolve = tournamentDataCache.matches.filter(
          (m) => m.round === roundName && m.status === "COMPLETED",
        );
        if (matchesToResolve.length === 0) {
          alert("No hay partidos completados en esta ronda para cerrar.");
          return;
        }

        btnElement.innerText = "⏳ CERRANDO...";
        btnElement.disabled = true;

        let completedCount = 0;

        function resolveNext() {
          if (completedCount >= matchesToResolve.length) {
            alert(
              "✅ Se han cerrado " +
                completedCount +
                " actas de la jornada: " +
                roundName,
            );
            btnElement.innerText = "🔒 JORNADA CERRADA";
            refreshData();
            return;
          }

          let mId = matchesToResolve[completedCount].id;
          google.script.run
            .withSuccessHandler(function (res) {
              completedCount++;
              resolveNext();
            })
            .withFailureHandler(function (err) {
              completedCount++;
              resolveNext(); // Continúa aunque uno falle temporalmente
            })
            .resolveMatchAwardsBackend(mId);
        }

        resolveNext();
      }

      // Variables globales para la sesión
      let currentManager = null;

      // Animaciones del menú inicial
      function showFantasyLogin() {
        document.getElementById("login-menu-doors").classList.add("hidden");
        document
          .getElementById("login-fantasy-form")
          .classList.remove("hidden");
        document.getElementById("login-fantasy-form").classList.add("flex");
      }

      function hideFantasyLogin() {
        document.getElementById("login-fantasy-form").classList.add("hidden");
        document.getElementById("login-fantasy-form").classList.remove("flex");
        document.getElementById("login-menu-doors").classList.remove("hidden");
      }

      function loadDashboard() {
        if (!currentManager) return;
        document.getElementById("ui-manager-name").innerText =
          currentManager.name;

        google.script.run
          .withFailureHandler(function (err) {
            alert("Error de conexión con el servidor: " + err.message);
          })
          .withSuccessHandler(function (res) {
            if (!res.success) {
              alert("Error cargando tu Club: " + res.error);
              return;
            }

            currentManager.budget = res.financials.budget;
            currentManager.points =
              res.ranking.find((r) => r.name === currentManager.name)?.points ||
              0;
            document.getElementById("ui-budget").innerText =
              formatMoney(res.financials.budget) + " Disp.";
            document.getElementById("ui-bids-budget").innerText = formatMoney(
              res.financials.bids,
            );
            document.getElementById("ui-points").innerText =
              currentManager.points + " PTS";

            renderFantasyRanking(res.ranking);
            renderFantasyActivity(res.activity);

            // 🟢 QUITAMOS EL IF PARA QUE DIBUJE SIEMPRE EL GRÁFICO (AUNQUE SEA TEXTO GIGANTE)
            renderFantasyCharts(res.charts);

            if (!res.roster) {
              res.roster = {
                top: "",
                jgl: "",
                mid: "",
                adc: "",
                sup: "",
                captain: "NONE",
                sub: "",
                isLocked: false,
                activeCard: "",
              };
            }
            currentRoster = res.roster;
            renderRoster();

            let activeBanner = document.getElementById("gacha-active-banner");
            if (
              activeBanner &&
              res.roster.activeCard &&
              res.roster.activeCard !== ""
            ) {
              document.getElementById("gacha-active-name").innerText =
                res.roster.activeCard;
              activeBanner.classList.remove("hidden");
            } else if (activeBanner) {
              activeBanner.classList.add("hidden");
            }
          })
          .getFantasyInitData(currentManager.name);

        fetchAllLigaData(function () {
          if (currentRoster) renderRoster();
          if (
            document.getElementById("f-tab-market").classList.contains("block")
          )
            loadMarket();
        });
      }

      function renderFantasyCharts(data) {
        let ptsContainer = document.getElementById("fantasyPointsChart")
          ? document.getElementById("fantasyPointsChart").parentNode
          : null;
        let budContainer = document.getElementById("fantasyBudgetChart")
          ? document.getElementById("fantasyBudgetChart").parentNode
          : null;

        if (!ptsContainer || !budContainer) return;

        // 🟢 SI AÚN NO HAY JORNADAS, PONE LOS NÚMEROS EN GIGANTE
        if (!data || !data.labels || data.labels.length === 0) {
          let currentPts = document.getElementById("ui-points").innerText;
          let currentBud = document
            .getElementById("ui-budget")
            .innerText.replace(" Disp.", "");

          ptsContainer.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-center"><div class="text-6xl font-black text-purple-400 font-oswald drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">' +
            (currentPts) +
            '</div><div class="text-xs text-slate-400 uppercase tracking-widest font-bold mt-2">Puntos Actuales</div><div class="text-[9px] text-slate-500 mt-2 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">El gráfico aparecerá en la Jornada 1</div></div>';

          budContainer.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-center"><div class="text-5xl font-black text-emerald-400 font-mono drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">' +
            (currentBud) +
            '</div><div class="text-xs text-slate-400 uppercase tracking-widest font-bold mt-2">Presupuesto Actual</div><div class="text-[9px] text-slate-500 mt-2 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">El gráfico aparecerá en la Jornada 1</div></div>';
          return;
        }

        ptsContainer.innerHTML = '<canvas id="fantasyPointsChart"></canvas>';
        budContainer.innerHTML = '<canvas id="fantasyBudgetChart"></canvas>';

        let ctxPts = document
          .getElementById("fantasyPointsChart")
          .getContext("2d");
        if (fPtsChart) fPtsChart.destroy();
        fPtsChart = new Chart(ctxPts, {
          type: "line",
          data: {
            labels: data.labels,
            datasets: [
              {
                label: "Puntos Acumulados",
                data: data.points,
                borderColor: "#a855f7",
                backgroundColor: "rgba(168, 85, 247, 0.2)",
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          },
          options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: { ticks: { color: "#94a3b8" } },
            },
          },
        });

        let ctxBud = document
          .getElementById("fantasyBudgetChart")
          .getContext("2d");
        if (fBudChart) fBudChart.destroy();
        fBudChart = new Chart(ctxBud, {
          type: "line",
          data: {
            labels: data.labels,
            datasets: [
              {
                label: "Patrimonio (€)",
                data: data.budget,
                borderColor: "#10b981",
                backgroundColor: "rgba(16, 185, 129, 0.2)",
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          },
          options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: {
                ticks: {
                  color: "#94a3b8",
                  callback: function (v) {
                    return (v / 1000000).toFixed(1) + "M";
                  },
                },
              },
            },
          },
        });
      }

      // LOGIN MODO FANTASY
      function handleFantasyLogin() {
        let user = document.getElementById("fantasy-user").value.trim();
        let pin = document.getElementById("fantasy-pin").value.trim();
        let btn = document.getElementById("btn-fantasy-login");
        let errDiv = document.getElementById("login-error");

        if (!user || !pin) {
          errDiv.innerText = "Faltan credenciales.";
          errDiv.classList.remove("hidden");
          return;
        }

        btn.innerText = "⏳ CONECTANDO...";
        btn.disabled = true;
        errDiv.classList.add("hidden");

        google.script.run
          .withSuccessHandler(function (res) {
            if (res.success) {
              currentManager = res;
              currentUserRole = "manager";

              // Ocultamos la pantalla de login
              document.getElementById("login-state").style.display = "none";

              // Ocultamos el dashboard de la liga normal (por si acaso)
              document.getElementById("dashboard-state").style.display = "none";

              // AQUI ACTIVAMOS EL FANTASY (Debes asegurarte de tener el <div id="fantasy-dashboard"> copiado en este archivo)
              if (document.getElementById("fantasy-dashboard")) {
                document
                  .getElementById("fantasy-dashboard")
                  .classList.remove("hidden");
                document
                  .getElementById("fantasy-dashboard")
                  .classList.add("flex");
                loadDashboard(); // Tu función de la Fase 1 del Fantasy
              } else {
                alert(
                  "Aviso: El código del dashboard del Fantasy no se encuentra en este archivo.",
                );
              }
            } else if (res.error === "NOT_FOUND") {
              let wantRegister = confirm(
                "El club '" +
                  user +
                  "' no existe. ¿Fundar club ahora con este PIN y recibir 10.000.000€ de presupuesto inicial?",
              );
              if (wantRegister) {
                btn.innerText = "⏳ FUNDANDO CLUB...";
                google.script.run
                  .withSuccessHandler(function (regRes) {
                    if (regRes.success) {
                      currentManager = regRes;
                      currentUserRole = "manager";
                      document.getElementById("login-state").style.display =
                        "none";
                      document.getElementById("dashboard-state").style.display =
                        "none";

                      if (document.getElementById("fantasy-dashboard")) {
                        document
                          .getElementById("fantasy-dashboard")
                          .classList.remove("hidden");
                        document
                          .getElementById("fantasy-dashboard")
                          .classList.add("flex");
                        loadDashboard();
                      }
                    } else {
                      errDiv.innerText = regRes.error;
                      errDiv.classList.remove("hidden");
                      btn.innerText = "ENTRAR AL CLUB";
                      btn.disabled = false;
                    }
                  })
                  .registerManager(user, pin);
              } else {
                btn.innerText = "ENTRAR AL CLUB";
                btn.disabled = false;
              }
            } else {
              errDiv.innerText = res.error;
              errDiv.classList.remove("hidden");
              btn.innerText = "ENTRAR AL CLUB";
              btn.disabled = false;
            }
          })
          .loginManager(user, pin);
      }

      // ==========================================
      // 💰 CARTERA Y APUESTAS DE LA LIGA (CASINO)
      // ==========================================
      window.myLigaWalletBalance = 0;

      window.onload = function () {
        setupDragToScroll();
        loadWalletBalance();
      };

      // 🔗 VINCULAR CUENTA: función inteligente del botón del header
      function handleWalletClick() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          openLinkAccountModal();
        } else {
          // Ya vinculada: recarga el saldo
          loadWalletBalance();
        }
      }

      // 🔗 Abre el modal de vinculación de cuenta
      function openLinkAccountModal() {
        let summoner = localStorage.getItem("my_summoner_name");
        let input = document.getElementById("link-account-input");
        let errDiv = document.getElementById("link-account-error");
        let unlinkSection = document.getElementById("link-account-unlink-section");
        let currentSpan = document.getElementById("link-account-current");

        // Limpiar estado
        if (errDiv) { errDiv.innerText = ""; errDiv.classList.add("hidden"); }
        if (input) input.value = summoner || "";

        if (summoner) {
          // Mostrar sección de desvincular
          if (unlinkSection) unlinkSection.classList.remove("hidden");
          if (currentSpan) currentSpan.innerText = summoner;
        } else {
          if (unlinkSection) unlinkSection.classList.add("hidden");
        }

        document.getElementById("link-account-modal").style.display = "flex";
        setTimeout(function() { if (input) input.focus(); }, 100);
      }

      // 🔗 Confirmar y guardar la cuenta vinculada
      function submitLinkAccount() {
        let input = document.getElementById("link-account-input");
        let btn = document.getElementById("btn-link-account");
        let errDiv = document.getElementById("link-account-error");

        let summoner = input ? input.value.trim() : "";
        if (!summoner) {
          if (errDiv) { errDiv.innerText = "❌ Debes introducir tu nombre de invocador."; errDiv.classList.remove("hidden"); }
          return;
        }

        btn.innerText = "⏳ VINCULANDO...";
        btn.disabled = true;
        if (errDiv) errDiv.classList.add("hidden");

        // Guardamos en localStorage
        localStorage.setItem("my_summoner_name", summoner);

        // Verificamos que el invocador tenga cartera (o creamos una)
        google.script.run
          .withSuccessHandler(function(res) {
            btn.innerText = "🔗 VINCULAR CUENTA";
            btn.disabled = false;
            if (res.success) {
              window.myLigaWalletBalance = res.balance;
              document.getElementById("header-wallet-balance").innerText =
                parseInt(res.balance).toLocaleString() + " WG";
              closeModal("link-account-modal");
              // Mostrar confirmación sutil
              let balEl = document.getElementById("header-wallet-balance");
              if (balEl) {
                balEl.style.color = "#10b981";
                setTimeout(function() { balEl.style.color = ""; }, 2000);
              }
            } else {
              // Si no tiene cartera todavía, simplemente guardamos el nombre
              document.getElementById("header-wallet-balance").innerText = "0 WG";
              closeModal("link-account-modal");
            }
          })
          .withFailureHandler(function(err) {
            btn.innerText = "🔗 VINCULAR CUENTA";
            btn.disabled = false;
            // Aunque falle el servidor, el nombre ya está guardado en localStorage
            document.getElementById("header-wallet-balance").innerText = "✓ " + summoner;
            closeModal("link-account-modal");
          })
          .getWalletBalance(summoner);
      }

      // 🔓 Desvincular cuenta
      function unlinkAccount() {
        if (!confirm("¿Seguro que quieres desvincular tu cuenta? Perderás acceso a tu cartera en este dispositivo.")) return;
        localStorage.removeItem("my_summoner_name");
        window.myLigaWalletBalance = 0;
        document.getElementById("header-wallet-balance").innerText = "VINCULAR CUENTA";
        closeModal("link-account-modal");
      }

      function loadWalletBalance() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          document.getElementById("header-wallet-balance").innerText =
            "VINCULAR CUENTA";
          return;
        }
        google.script.run
          .withSuccessHandler(function (res) {
            if (res.success) {
              window.myLigaWalletBalance = res.balance;
              document.getElementById("header-wallet-balance").innerText =
                parseInt(res.balance).toLocaleString() + " WG";
            }
          })
          .getWalletBalance(summoner);
      }

      function openCasinoModal(matchId, encTeamName, odds, teamIndex) {
        // 🟢 BUSCAMOS EL PARTIDO EXACTO EN LA BASE DE DATOS
        const match = tournamentDataCache.matches.find((m) => m.id === matchId);

        // 🟢 NUEVO BLOQUEO INTELIGENTE POR FECHA/HORA DEL PARTIDO
        if (match) {
          // Si el partido ya está terminado, bloqueamos
          if (match.status === "COMPLETED") {
            return alert(
              "⛔ APUESTAS CERRADAS.\n\nEste partido ya ha finalizado.",
            );
          }

          // Si el partido tiene una fecha programada, comprobamos si ya ha pasado
          if (match.date && match.date.trim() !== "") {
            let matchDate = new Date(match.date);
            let now = new Date();

            if (now >= matchDate && currentUserRole !== "admin") {
              return alert(
                "⛔ APUESTAS CERRADAS.\n\nLa hora límite para este partido ha pasado. ¡Las espadas ya están en alto, disfruta del encuentro!",
              );
            }
          }
        }

        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          summoner = prompt(
            "🎫 CASINO: Introduce tu Nombre de Invocador (El mismo que usas en los Pick'ems) para crear tu Cartera Virtual:",
          );
          if (!summoner || summoner.trim() === "") return;
          localStorage.setItem("my_summoner_name", summoner.trim());
          loadWalletBalance();
        }

        document.getElementById("casino-match-id").value = matchId;
        document.getElementById("casino-team-index").value = teamIndex;
        document.getElementById("casino-odds").value = odds;

        document.getElementById("casino-selected-team").innerText =
          dec(encTeamName);
        document.getElementById("casino-selected-odds").innerText = odds;

        document.getElementById("casino-wallet-display").innerText =
          window.myLigaWalletBalance + " WG";
        document.getElementById("casino-bet-amount").value = "";
        document.getElementById("casino-potential-return").innerText = "0 🪙";

        document.getElementById("casino-modal").style.display = "flex";
      }

      function setBetAmount(amount) {
        let input = document.getElementById("casino-bet-amount");
        if (amount === "ALL") {
          input.value = window.myLigaWalletBalance;
        } else {
          let current = parseInt(input.value) || 0;
          input.value = current + amount;
        }
        updateCasinoReturn();
      }

      function updateCasinoReturn() {
        let amount =
          parseInt(document.getElementById("casino-bet-amount").value) || 0;
        let odds =
          parseFloat(document.getElementById("casino-odds").value) || 0;
        let pot = Math.floor(amount * odds);
        document.getElementById("casino-potential-return").innerText =
          pot.toLocaleString() + " 🪙";
      }

      // 💰 WALL STREET: SUB-TABS Y HISTORIAL
      function switchCasinoSubTab(tab) {
        document
          .getElementById("casino-panel-rank")
          .classList.toggle("hidden", tab !== "rank");
        document
          .getElementById("casino-panel-games")
          .classList.toggle("hidden", tab !== "games");
        document
          .getElementById("casino-panel-history")
          .classList.toggle("hidden", tab !== "history");

        const btnRank = document.getElementById("btn-casino-sub-rank");
        const btnGames = document.getElementById("btn-casino-sub-games");
        const btnHist = document.getElementById("btn-casino-sub-history");

        // Reset all buttons
        [btnRank, btnGames, btnHist].forEach((btn) => {
          if (!btn) return;
          btn.classList.remove("border-yellow-500", "text-yellow-500");
          btn.classList.add("border-transparent", "text-slate-500");
        });

        // Set active button
        const activeBtn =
          tab === "rank" ? btnRank : tab === "games" ? btnGames : btnHist;
        if (activeBtn) {
          activeBtn.classList.add("border-yellow-500", "text-yellow-500");
          activeBtn.classList.remove("border-transparent", "text-slate-500");
        }

        if (tab === "history") loadBettingHistory();
        if (tab === "games") initCasinoGames();
      }

      function loadBettingHistory() {
        const summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) return;

        const container = document.getElementById("casino-history-container");
        container.innerHTML =
          '<tr><td colspan="6" class="text-center py-10 animate-pulse text-yellow-500/50 uppercase tracking-widest font-black">🔍 Analizando tu cartera de inversiones...</td></tr>';

        google.script.run
          .withSuccessHandler(renderBettingHistory)
          .withFailureHandler(function (err) {
            document.getElementById("casino-history-container").innerHTML =
              '<tr><td colspan="6" class="text-center py-10 text-red-400 uppercase text-xs font-bold">❌ Error al cargar historial: ' +
              err.message +
              "</td></tr>";
          })
          .getBettingHistory(summoner);
      }

      function renderBettingHistory(history) {
        const container = document.getElementById("casino-history-container");
        if (!history || history.length === 0) {
          container.innerHTML =
            '<tr><td colspan="6" class="text-center py-10 text-slate-500 uppercase text-xs font-bold">No se han encontrado operaciones en tu registro.</td></tr>';
          return;
        }

        let html = "";
        history.forEach((bet) => {
          const match = tournamentDataCache
            ? tournamentDataCache.matches.find(
                (m) => String(m.id) === String(bet.matchId),
              )
            : null;
          const matchName = match ? match.names : "Partido Desconocido";
          const names = matchName.split(" vs ");
          const teamName = names[bet.teamIndex] || "Equipo ?";

          let statusColor = "text-slate-400";
          let statusText = bet.status;

          if (bet.status === "WON") {
            statusColor = "text-emerald-400 font-bold";
            statusText = "✅ GANADA";
          } else if (bet.status === "LOST") {
            statusColor = "text-red-400 font-bold";
            statusText = "❌ PERDIDA";
          } else if (bet.status === "PENDING") {
            statusColor = "text-yellow-400 animate-pulse";
            statusText = "⏳ PENDIENTE";
          }

          const dateStr = new Date(bet.date).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });

          html += '<tr class="border-b border-slate-700/50 hover:bg-slate-700/30 transition"> <td class="p-4 text-[10px] text-slate-500 font-mono">' +
            (dateStr) +
            '</td> <td class="p-4"> <div class="text-[10px] text-slate-500 uppercase font-bold mb-1">' +
            (match ? match.round : "") + '</div> <div class="text-xs font-bold text-white">' +
            (escHtml(matchName)) +
            '</div> </td> <td class="p-4 text-center"> <span class="bg-slate-900 px-2 py-1 rounded text-[10px] border border-slate-700 text-blue-300 font-black uppercase">' +
            (escHtml(teamName)) +
            '</span> </td> <td class="p-4 text-right font-mono text-yellow-500 font-bold">' + (bet.amount) +
            ' WG</td> <td class="p-4 text-center font-mono text-slate-400">x' + (bet.odds) +
            '</td> <td class="p-4 text-center text-[10px] ' + (statusColor) + '">' + (statusText) +
            '</td> </tr>';
        });
        container.innerHTML = html;
      }

      function submitCasinoBet() {
        let matchId = document.getElementById("casino-match-id").value;
        let teamIndex = document.getElementById("casino-team-index").value;
        let odds = parseFloat(document.getElementById("casino-odds").value);
        let amount = parseInt(
          document.getElementById("casino-bet-amount").value,
        );

        if (isNaN(amount) || amount <= 0)
          return alert("Introduce una cantidad válida a apostar.");
        if (amount > window.myLigaWalletBalance)
          return alert("No tienes suficientes WG Coins.");

        let summoner = localStorage.getItem("my_summoner_name");
        let btn = document.getElementById("btn-place-bet");
        btn.innerText = "⏳ PROCESANDO...";
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            btn.innerText = "Confirmar Apuesta";
            btn.disabled = false;
            if (res.success) {
              alert("✅ " + res.msg);
              window.myLigaWalletBalance = res.newBalance;
              document.getElementById("header-wallet-balance").innerText =
                parseInt(res.newBalance).toLocaleString() + " WG";
              closeModal("casino-modal");
            } else {
              alert("❌ Error: " + res.error);
            }
          })
          .placeLeagueBet(summoner, matchId, teamIndex, amount, odds);
      }
      // Records renderizado arriba (duplicado eliminado)

      // ==========================================
      // 🤑 LÓGICA DEL RANKING DE MAGNATES
      // ==========================================
      window.casinoRankingData = [];

      function sortCasinoRanking(criteria) {
        if (!window.casinoRankingData || window.casinoRankingData.length === 0)
          return;

        // Resetear estilos de botones
        document.getElementById("btn-sort-balance").className =
          "bg-slate-700 text-white hover:bg-slate-600 font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition border border-slate-600";
        document.getElementById("btn-sort-winrate").className =
          "bg-slate-700 text-white hover:bg-slate-600 font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition border border-slate-600";
        document.getElementById("btn-sort-totalWon").className =
          "bg-slate-700 text-white hover:bg-slate-600 font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition border border-slate-600";

        // Ordenar y resaltar el botón activo
        if (criteria === "balance") {
          window.casinoRankingData.sort((a, b) => b.balance - a.balance);
          document.getElementById("btn-sort-balance").className =
            "bg-yellow-600 text-black font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition shadow-[0_0_10px_rgba(251,191,36,0.4)]";
        } else if (criteria === "winrate") {
          window.casinoRankingData.sort(
            (a, b) => b.winRate - a.winRate || b.betsResolved - a.betsResolved,
          );
          document.getElementById("btn-sort-winrate").className =
            "bg-blue-600 text-white font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition shadow-[0_0_10px_rgba(56,189,248,0.4)]";
        } else if (criteria === "totalWon") {
          window.casinoRankingData.sort((a, b) => b.totalWon - a.totalWon);
          document.getElementById("btn-sort-totalWon").className =
            "bg-emerald-600 text-white font-bold px-4 py-2 rounded uppercase tracking-widest text-xs transition shadow-[0_0_10px_rgba(16,185,129,0.4)]";
        }

        renderCasinoRankingUI();
      }

      function renderCasinoRankingUI() {
        const container = document.getElementById("casino-ranking-container");
        if (!container) return;

        let html = "";
        window.casinoRankingData.forEach((u, idx) => {
          let medal =
            idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1;

          // Resaltar al usuario si es él mismo
          let isMe =
            localStorage.getItem("my_summoner_name") &&
            u.name.toLowerCase() ===
              localStorage.getItem("my_summoner_name").toLowerCase();
          let rowBg = isMe
            ? "bg-yellow-500/10 border-l-4 border-yellow-500"
            : "hover:bg-slate-800 transition border-l-4 border-transparent";
          let meTag = isMe
            ? '<span class="bg-yellow-500 text-black text-[9px] px-2 py-0.5 rounded font-black ml-2 uppercase">Tú</span>'
            : "";

          let titleStr = u.title
            ? ' <span class="text-[10px] text-slate-400 font-normal uppercase tracking-widest">[' +
              (escHtml(u.title)) + ']</span>'
            : "";
          let colorStyle = u.color ? 'style="color: ' + (u.color) + ';"' : "";

          html += ' <tr class="border-b border-slate-700/50 ' + (rowBg) +
            '"> <td class="p-4 text-center font-oswald text-lg text-slate-500">' + (medal) +
            '</td> <td class="p-4 font-bold text-base whitespace-nowrap" ' + (colorStyle) + '>' +
            (escHtml(u.name)) + (titleStr) + (meTag) +
            '</td> <td class="p-4 text-right font-mono text-yellow-400 font-bold text-lg">' +
            (parseInt(u.balance).toLocaleString()) +
            ' WG</td> <td class="p-4 text-center font-mono text-emerald-400">' +
            (parseInt(u.totalWon).toLocaleString()) +
            ' 🪙</td> <td class="p-4 text-center font-oswald text-blue-400 text-xl">' + (u.winRate.toFixed(1)) +
            '% <span class="text-[10px] text-slate-500 font-inter font-normal ml-1">(' + (u.betsWon) + '/' +
            (u.betsResolved) + ')</span></td> </tr> ';
        });

        container.innerHTML = html;
      }

      /* 🏅 ACHIEVEMENT MANAGER */
      const AchievementManager = {
        list: {
          ojeador: { name: "🔍 Ojeador", desc: "Vio una previa.", icon: "👁️" },
          analista_ia: { name: "🤖 Analista", desc: "Usó IA.", icon: "🧠" },
        },
        getUnlocked() {
          return JSON.parse(localStorage.getItem("ach") || "{}");
        },
        unlock(id) {
          let u = this.getUnlocked();
          if (u[id]) return;
          u[id] = new Date().toISOString();
          localStorage.setItem("ach", JSON.stringify(u));
          this.notify(id);
        },
        notify(id) {
          console.log("Logro: " + id);
        },
        showGallery() {
          alert("Abriendo galería de trofeos...");
        },
      };

      // ============================================================
      // 🔔 CENTRO DE NOTIFICACIONES
      // ============================================================
      function toggleNotifications() {
        let panel = document.getElementById("notif-panel");
        if (
          panel.style.display === "none" ||
          panel.classList.contains("hidden")
        ) {
          panel.classList.remove("hidden");
          panel.style.display = "block";
          loadNotifications();
        } else {
          panel.classList.add("hidden");
          panel.style.display = "none";
        }
      }

      let cachedNotifications = [];

      function loadNotifications() {
        // Cargar notificaciones descartadas del localStorage
        let dismissed = JSON.parse(
          localStorage.getItem("dismissed_notifs") || "[]",
        );
        let read = JSON.parse(localStorage.getItem("read_notifs") || "[]");

        google.script.run
          .withSuccessHandler(function (notifs) {
            let container = document.getElementById("notif-list");
            let badge = document.getElementById("notif-badge");
            if (!notifs || notifs.length === 0) {
              container.innerHTML =
                '<div class="text-center py-6 text-slate-500 text-xs">Todo tranquilo por aquí 😴</div>';
              badge.classList.add("hidden");
              cachedNotifications = [];
              return;
            }

            // Filtrar las descartadas
            notifs = notifs.filter((n) => !dismissed.includes(n.text));
            cachedNotifications = notifs;

            let unread = notifs.filter((n) => !read.includes(n.text)).length;
            if (unread > 0) {
              badge.innerText = unread;
              badge.classList.remove("hidden");
            } else {
              badge.classList.add("hidden");
            }

            let html = "";
            notifs.forEach((n, idx) => {
              let isRead = read.includes(n.text);
              let bgClass =
                n.type === "match"
                  ? "border-l-2 border-yellow-500"
                  : n.type === "result"
                    ? "border-l-2 border-emerald-500"
                    : "border-l-2 border-slate-600";
              let opacity = isRead ? "opacity-50" : "";
              html += '<div class="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/50 transition ' + (bgClass) +
                ' ' + (opacity) + ' group" onclick="markNotifRead(' + (idx) +
                ')"> <span class="text-lg flex-shrink-0">' + (n.icon) +
                '</span> <div class="min-w-0 flex-1"> <p class="text-white text-xs font-medium leading-tight">' +
                (escHtml(n.text)) + '</p> ' +
                (n.time ? '<p class="text-slate-500 text-[9px] mt-0.5">' + n.time + "</p>" : "") +
                ' </div> <button onclick="event.stopPropagation(); dismissNotif(' + (idx) +
                ')" class="text-slate-600 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition flex-shrink-0" title="Descartar">✕</button> </div>';
            });
            container.innerHTML = html;
          })
          .getNotificationsData();
      }

      function markNotifRead(idx) {
        if (!cachedNotifications[idx]) return;
        let read = JSON.parse(localStorage.getItem("read_notifs") || "[]");
        let key = cachedNotifications[idx].text;
        if (!read.includes(key)) {
          read.push(key);
          localStorage.setItem("read_notifs", JSON.stringify(read.slice(-50))); // Mantener solo los últimos 50
        }
        loadNotifications(); // Refrescar UI
      }

      function dismissNotif(idx) {
        if (!cachedNotifications[idx]) return;
        let dismissed = JSON.parse(
          localStorage.getItem("dismissed_notifs") || "[]",
        );
        dismissed.push(cachedNotifications[idx].text);
        localStorage.setItem(
          "dismissed_notifs",
          JSON.stringify(dismissed.slice(-50)),
        );
        cachedNotifications.splice(idx, 1);
        loadNotifications();
      }

      function clearAllNotifications() {
        let dismissed = JSON.parse(
          localStorage.getItem("dismissed_notifs") || "[]",
        );
        cachedNotifications.forEach((n) => dismissed.push(n.text));
        localStorage.setItem(
          "dismissed_notifs",
          JSON.stringify(dismissed.slice(-100)),
        );
        cachedNotifications = [];
        document.getElementById("notif-list").innerHTML =
          '<div class="text-center py-6 text-slate-500 text-xs">Todo tranquilo por aquí 😴</div>';
        document.getElementById("notif-badge").classList.add("hidden");
      }

      // Auto-load notifications on page load
      setTimeout(() => {
        try {
          loadNotifications();
        } catch (e) {}
      }, 3000);

      // ============================================================
      // 🎰 RULETA DIARIA
      // ============================================================
      let rouletteChecked = false;

      function autoOpenRoulette() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner || rouletteChecked) return;
        rouletteChecked = true;

        let lastSpin = localStorage.getItem("last_spin_date");
        let today = new Date().toISOString().split("T")[0];
        if (lastSpin === today) return;

        openDailyRoulette();
      }

      function openDailyRoulette() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión primero para acceder al login diario.");
          return;
        }

        let modal = document.getElementById("roulette-modal");
        let streakDiv = document.getElementById("roulette-streak");
        let btn = document.getElementById("btn-spin");

        modal.style.display = "flex";
        streakDiv.innerHTML =
          '<span class="text-xs text-slate-500 animate-pulse">Cargando racha...</span>';

        google.script.run
          .withSuccessHandler(function (data) {
            if (!data) return;
            let streakHtml = "";
            for (let i = 1; i <= 7; i++) {
              let filled = i <= data.streak;
              streakHtml += '<div class="w-6 h-6 rounded-full border-2 ' +
                (filled ? "bg-yellow-500 border-yellow-400" : "bg-slate-800 border-slate-600") +
                ' flex items-center justify-center text-[8px] font-bold ' +
                (filled ? "text-black" : "text-slate-500") + '">' + (i) + '</div>';
            }
            streakDiv.innerHTML = streakHtml;

            let today = new Date().toISOString().split("T")[0];
            if (data.lastLogin && data.lastLogin.includes(today)) {
              btn.innerHTML = "✅ Ya has girado hoy";
              btn.disabled = true;
            } else {
              btn.innerHTML = "🎲 ¡GIRAR LA RULETA!";
              btn.disabled = false;
              document
                .getElementById("roulette-result")
                .classList.add("hidden");
            }
          })
          .getDailyLoginData(summoner);
      }

      function spinRoulette() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión primero.");
          return;
        }

        let btn = document.getElementById("btn-spin");
        btn.disabled = true;
        btn.innerHTML =
          '<span class="animate-spin inline-block">🌀</span> GIRANDO...';

        google.script.run
          .withSuccessHandler(function (res) {
            if (res.alreadySpun) {
              btn.innerHTML = "✅ Ya has girado hoy";
              localStorage.setItem(
                "last_spin_date",
                new Date().toISOString().split("T")[0],
              );
              return;
            }
            if (!res.success) {
              alert(res.msg);
              btn.disabled = false;
              btn.innerHTML = "🎲 ¡GIRAR LA RULETA!";
              return;
            }

            localStorage.setItem(
              "last_spin_date",
              new Date().toISOString().split("T")[0],
            );

            // Mostrar resultado con animación
            document
              .getElementById("roulette-result")
              .classList.remove("hidden");
            document.getElementById("roulette-prize").innerText =
              "+" + res.totalPrize + " WG 🪙";

            let bonusText = "Racha: " + res.streak + " días seguidos";
            if (res.streakBonus > 0)
              bonusText +=
                " | 🎉 ¡BONUS RACHA x7: +" + res.streakBonus + " WG!";
            if (res.firstTime) bonusText = "🎉 ¡Bonus de bienvenida!";
            document.getElementById("roulette-bonus").innerText = bonusText;

            // Streak dots
            let streakHtml = "";
            for (let i = 1; i <= 7; i++) {
              let filled = i <= (res.streak % 7 || (res.streak >= 7 ? 7 : 0));
              streakHtml += '<div class="w-6 h-6 rounded-full border-2 ' +
                (filled ? "bg-yellow-500 border-yellow-400" : "bg-slate-800 border-slate-600") +
                ' flex items-center justify-center text-[8px] font-bold ' +
                (filled ? "text-black" : "text-slate-500") + '">' + (i) + '</div>';
            }
            document.getElementById("roulette-streak").innerHTML = streakHtml;

            btn.innerHTML = "🎉 ¡PREMIO RECLAMADO!";

            // XP para Battle Pass
            try {
              google.script.run.addBattlePassXP(summoner, 25, "login_diario");
            } catch (e) {}
          })
          .spinDailyRoulette(summoner);
      }

      // Ruleta diaria desactivada (eliminada de la cabecera)
      // setTimeout(() => { try { autoOpenRoulette(); } catch (e) {} }, 2000);

      // ============================================================
      // 🗞️ CHIRINGUITO PREMIER
      // ============================================================
      let gazetteHistory = [];
      let currentGazetteIndex = 0;

      function openGazette() {
        document.getElementById("gazette-modal").style.display = "flex";
        document.getElementById("gazette-content").innerHTML =
          '<div class="text-center py-8 text-[#8b7355]">📰 Cargando archivo histórico...</div>';

        google.script.run
          .withSuccessHandler(function (allEditions) {
            if (!allEditions || allEditions.length === 0) {
              document.getElementById("gazette-content").innerHTML =
                '<div class="text-center py-8 text-[#8b7355]">No hay ediciones publicadas aún. El admin puede generar una.</div>';
              return;
            }
            gazetteHistory = allEditions.reverse(); // De más reciente a más antigua
            currentGazetteIndex = 0;
            renderGazetteEdition(currentGazetteIndex);
          })
          .getAllGazettes();
      }

      function renderGazetteEdition(index) {
        const data = gazetteHistory[index];
        if (!data) return;

        document.getElementById("gazette-date").innerText = data.date
          ? new Date(data.date).toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";
        document.getElementById("gazette-content").innerHTML = String(
          data.content,
        )
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br>");

        // Hacer scroll al principio del modal (sin querySelector frágil)
        const gazetteInner = document.getElementById("gazette-modal");
        if (gazetteInner) gazetteInner.scrollTop = 0;
        const gazetteBody = document.getElementById("gazette-content");
        if (gazetteBody && gazetteBody.closest(".overflow-y-auto"))
          gazetteBody.closest(".overflow-y-auto").scrollTop = 0;
      }

      function changeGazetteEdition(delta) {
        let newIndex = currentGazetteIndex + delta;
        if (newIndex >= 0 && newIndex < gazetteHistory.length) {
          currentGazetteIndex = newIndex;
          renderGazetteEdition(currentGazetteIndex);
        }
      }

      function copyGazetteToClipboard() {
        const content = document.getElementById("gazette-content").innerText;
        const date = document.getElementById("gazette-date").innerText;
        const text = '📰 CHIRINGUITO PREMIER - ' + (date) + '\\n\\n' + (content) +
          '\\n\\nLéela completa en la web oficial.';

        navigator.clipboard.writeText(text).then(() => {
          alert("📋 ¡Edición copiada al portapapeles!");
        });
      }

      function generateGazette() {
        if (
          !confirm("¿Generar una nueva edición de Chiringuito Premier con IA?")
        )
          return;
        document.getElementById("gazette-content").innerHTML =
          '<div class="text-center py-8 text-red-500 animate-pulse font-bold">🤖 JOSEP-BOT ESTÁ REDACTANDO EL PROGRAMA... TIC TAC...</div>';

        google.script.run
          .withSuccessHandler(function (res) {
            if (res.success) {
              openGazette(); // Recargar todo el historial
            } else {
              alert(res.msg || "Error generando el resumen.");
            }
          })
          .generateWeeklyGazette();
      }

      // ============================================================
      // 🎯 PICK'EM SEMANAL
      // ============================================================
      function loadPickemData() {
        let summoner = localStorage.getItem("my_summoner_name") || "";
        // El Pick'em muestra SIEMPRE los partidos de TODAS las divisiones.
        google.script.run
          .withSuccessHandler(function (data) {
            renderPickemMatches(data.matches);
            renderPickemLeaderboard(data.leaderboard);
          })
          .getWeeklyPickemData(summoner, 'all');
      }

      function renderPickemMatches(matches) {
        let container = document.getElementById("pickem-matches");
        if (!matches || matches.length === 0) {
          container.innerHTML =
            '<div class="text-center py-12 text-slate-500"><div class="text-5xl mb-3 opacity-30">🎯</div><div class="font-bold uppercase tracking-widest text-sm">No hay partidos pendientes para predecir</div></div>';
          return;
        }
        let html = '<div class="space-y-4">';
        matches.forEach((m) => {
          let names = m.names ? m.names.split(" vs ") : ["?", "?"];
          let tA = names[0] ? names[0].trim() : "?";
          let tB = names[1] ? names[1].trim() : "?";
          let vA = parseInt(m.votesA) || 0;
          let vB = parseInt(m.votesB) || 0;
          let totalV = vA + vB;
          let pctA = totalV > 0 ? Math.round((vA / totalV) * 100) : 50;
          let pctB = totalV > 0 ? 100 - pctA : 50;

          // Buscar logos de los equipos
          let teamObjA = (tournamentDataCache && tournamentDataCache.teams) ? tournamentDataCache.teams.find(t => t.name === tA) : null;
          let teamObjB = (tournamentDataCache && tournamentDataCache.teams) ? tournamentDataCache.teams.find(t => t.name === tB) : null;
          let logoA = teamObjA ? getLogo(teamObjA.logo) : "";
          let logoB = teamObjB ? getLogo(teamObjB.logo) : "";

          let pickedA = m.userPick === 0;
          let pickedB = m.userPick === 1;
          let leadA = pctA >= pctB;

          html += '<div class="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-700 rounded-2xl p-4 shadow-lg">' +
            // Cabecera: jornada + votos totales
            '<div class="flex items-center justify-between mb-3">' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-[10px] text-pink-400 font-black uppercase tracking-widest bg-pink-500/10 px-2 py-1 rounded-md border border-pink-500/20">' + escHtml(m.round || "Jornada") + '</span>' +
                (m.div ? '<span class="text-[10px] text-cyan-300 font-black uppercase tracking-widest bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20">' + escHtml(m.div) + '</span>' : '') +
              '</div>' +
              '<span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">' + totalV + ' voto' + (totalV === 1 ? "" : "s") + '</span>' +
            '</div>' +
            // Botones de equipos
            '<div class="flex items-stretch gap-3">' +
              // Team A
              '<button onclick="submitPickem(\'' + m.id + '\', 0)" class="group flex-1 relative overflow-hidden rounded-xl border-2 transition-all ' +
                (pickedA ? "border-pink-500 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.3)]" : "border-slate-700 hover:border-blue-500/60 bg-slate-800/50") + '">' +
                '<div class="absolute left-0 top-0 bottom-0 bg-blue-500/15 transition-all duration-700 z-0" style="width:' + pctA + '%"></div>' +
                '<div class="relative z-10 p-3 flex flex-col items-center gap-1">' +
                  (logoA ? '<img src="' + logoA + '" class="w-10 h-10 object-contain" onerror="this.style.display=\'none\'">' : '<div class="w-10 h-10 rounded-full bg-slate-700"></div>') +
                  '<div class="font-bold text-white text-xs text-center truncate w-full">' + escHtml(tA) + '</div>' +
                  '<div class="font-oswald text-2xl font-black ' + (leadA ? "text-blue-300" : "text-slate-500") + '">' + pctA + '%</div>' +
                  (pickedA ? '<div class="text-pink-400 text-[9px] font-black uppercase tracking-widest">✓ Tu pick</div>' : '<div class="text-[9px] text-slate-600 font-bold uppercase tracking-widest">' + vA + ' votos</div>') +
                '</div>' +
              '</button>' +
              // VS central
              '<div class="flex items-center"><span class="font-oswald text-slate-600 text-sm font-black">VS</span></div>' +
              // Team B
              '<button onclick="submitPickem(\'' + m.id + '\', 1)" class="group flex-1 relative overflow-hidden rounded-xl border-2 transition-all ' +
                (pickedB ? "border-pink-500 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.3)]" : "border-slate-700 hover:border-red-500/60 bg-slate-800/50") + '">' +
                '<div class="absolute right-0 top-0 bottom-0 bg-red-500/15 transition-all duration-700 z-0" style="width:' + pctB + '%"></div>' +
                '<div class="relative z-10 p-3 flex flex-col items-center gap-1">' +
                  (logoB ? '<img src="' + logoB + '" class="w-10 h-10 object-contain" onerror="this.style.display=\'none\'">' : '<div class="w-10 h-10 rounded-full bg-slate-700"></div>') +
                  '<div class="font-bold text-white text-xs text-center truncate w-full">' + escHtml(tB) + '</div>' +
                  '<div class="font-oswald text-2xl font-black ' + (!leadA ? "text-red-300" : "text-slate-500") + '">' + pctB + '%</div>' +
                  (pickedB ? '<div class="text-pink-400 text-[9px] font-black uppercase tracking-widest">✓ Tu pick</div>' : '<div class="text-[9px] text-slate-600 font-bold uppercase tracking-widest">' + vB + ' votos</div>') +
                '</div>' +
              '</button>' +
            '</div>' +
            // Barra de consenso global
            '<div class="mt-3 flex h-1.5 rounded-full overflow-hidden bg-slate-800">' +
              '<div class="bg-blue-500 transition-all duration-700" style="width:' + pctA + '%"></div>' +
              '<div class="bg-red-500 transition-all duration-700" style="width:' + pctB + '%"></div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
      }

      function renderPickemLeaderboard(lb) {
        let container = document.getElementById("pickem-leaderboard");
        if (!lb || lb.length === 0) {
          container.innerHTML =
            '<div class="text-slate-500 text-center py-4 text-sm">Aún no hay datos suficientes.</div>';
          return;
        }
        let html = "";
        lb.forEach((u, idx) => {
          let medal =
            idx === 0
              ? "🥇"
              : idx === 1
                ? "🥈"
                : idx === 2
                  ? "🥉"
                  : "#" + (idx + 1);
          let titleStr = u.title
            ? '<span class="text-[10px] text-slate-400 font-normal uppercase tracking-widest block leading-none mt-1">' +
              (escHtml(u.title)) + '</span>'
            : "";
          let colorStyle = u.color ? 'style="color: ' + (u.color) + ';"' : "";

          html += '<div class="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700"> <div class="flex items-center gap-3"> <span class="font-oswald text-lg w-8 text-center">' +
            (medal) +
            '</span> <div class="flex flex-col"> <span class="font-bold text-sm text-white leading-none" ' +
            (colorStyle) + '>' + (escHtml(u.name)) + '</span> ' + (titleStr) +
            ' </div> </div> <div class="flex gap-4 text-xs"> <span class="text-emerald-400 font-bold">' +
            (u.correct) + ' ✓</span> <span class="text-slate-400">' + (u.accuracy) + '%</span> </div> </div>';
        });
        container.innerHTML = html;
      }

      function submitPickem(matchId, teamIdx) {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión para participar en los Pick'em.");
          return;
        }

        // UI Optimista: actualizar visualmente de inmediato sin esperar al servidor
        let allBtns = document.querySelectorAll(
          '#pickem-matches button[onclick*="submitPickem"]',
        );
        allBtns.forEach((btn) => {
          let onc = btn.getAttribute("onclick") || "";
          if (onc.includes("'" + matchId + "'")) {
            // Es un botón de este partido
            let isThisTeam = onc.includes(", " + teamIdx + ")");
            btn.classList.remove("ring-2", "ring-pink-500", "bg-pink-500/20");
            if (isThisTeam) {
              btn.classList.add("ring-2", "ring-pink-500", "bg-pink-500/20");
              // Añadir checkmark si no existe
              if (!btn.querySelector(".pick-check")) {
                let check = document.createElement("div");
                check.className = "text-pink-400 text-[10px] mt-1 pick-check";
                check.innerText = "✓ Tu pick";
                btn.appendChild(check);
              }
            } else {
              // Quitar checkmark del otro equipo
              let check = btn.querySelector(".pick-check");
              if (check) check.remove();
            }
          }
        });

        // Enviar al servidor en segundo plano (sin recargar todo)
        google.script.run
          .withSuccessHandler(function (res) {
            if (!res.success) alert(res.msg);
          })
          .submitWeeklyPickem(summoner, matchId, teamIdx);

        // XP para Battle Pass (en background)
        try {
          google.script.run.addBattlePassXP(summoner, 50, "pickem");
        } catch (e) {}
      }

      // (1v1 Stats eliminado)

      // ============================================================
      // 💬 EL VESTUARIO (TRASH TALK)
      // ============================================================
      function loadTrashTalk() {
        google.script.run
          .withSuccessHandler(function (messages) {
            let container = document.getElementById("trash-talk-feed");
            if (!messages || messages.length === 0) {
              container.innerHTML =
                '<div class="text-center py-8 text-slate-500 text-sm">El tablón está vacío. ¡Sé el primero en hablar! 🎤</div>';
              return;
            }
            let html = "";
            messages.forEach((m) => {
              html += '<div class="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-amber-500/30 transition"> <div class="flex justify-between items-start mb-1"> <span class="text-amber-400 font-bold text-sm">' +
                (escHtml(m.author)) + '</span> <span class="text-slate-500 text-[10px]">' + (m.time) +
                '</span> </div> <p class="text-white text-sm">' + (escHtml(m.text)) + '</p> </div>';
            });
            container.innerHTML = html;
          })
          .getTrashTalkMessages();
      }

      function sendTrashTalk() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión para escribir en El Tablón de Notas.");
          return;
        }
        let input = document.getElementById("trash-talk-input");
        let msg = input.value.trim();
        if (!msg) return;

        google.script.run
          .withSuccessHandler(function (res) {
            if (res.success) {
              input.value = "";
              loadTrashTalk();
            } else alert(res.msg);
          })
          .postTrashTalkMessage(summoner, msg);

        // XP para Battle Pass
        try {
          google.script.run.addBattlePassXP(summoner, 10, "trash_talk");
        } catch (e) {}
      }

      // ============================================================
      // 🏅 BATTLE PASS
      // ============================================================
      function openBattlePass() {
        document.getElementById("battlepass-modal").style.display = "flex";
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) return;

        google.script.run
          .withSuccessHandler(function (data) {
            if (!data) return;
            document.getElementById("bp-level").innerText = data.level;
            document.getElementById("bp-xp").innerText = data.progress;
            document.getElementById("bp-bar").style.width = data.progress + "%";
            document.getElementById("bp-mini-level").innerText = data.level;
            document.getElementById("bp-mini-bar").style.width =
              data.progress + "%";

            let html = "";
            if (data.rewards) {
              data.rewards.forEach((r) => {
                let borderClass = r.unlocked
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-slate-700";
                let lockIcon = r.unlocked ? "✅" : "🔒";
                html += '<div class="flex items-center justify-between p-3 rounded-lg border ' + (borderClass) +
                  ' transition"> <div class="flex items-center gap-3"> <span class="text-lg">' + (lockIcon) +
                  '</span> <div> <div class="text-white font-bold text-sm">' + (r.name) +
                  '</div> <div class="text-slate-400 text-[10px]">Nivel ' + (r.level) +
                  '</div> </div> </div> <div class="text-right text-xs ' +
                  (r.unlocked ? "text-emerald-400" : "text-slate-500") + '">' + (r.desc) + '</div> </div>';
              });
            }
            document.getElementById("bp-rewards").innerHTML = html;
          })
          .getBattlePassData(summoner);
      }

      function loadBattlePassMini() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) return;
        document.getElementById("bp-mini").classList.remove("hidden");
        document.getElementById("bp-mini").style.display = "flex";

        google.script.run
          .withSuccessHandler(function (data) {
            if (!data) return;
            document.getElementById("bp-mini-level").innerText = data.level;
            document.getElementById("bp-mini-bar").style.width =
              data.progress + "%";
          })
          .getBattlePassData(summoner);
      }

      // Load battle pass mini on startup
      setTimeout(() => {
        try {
          loadBattlePassMini();
        } catch (e) {}
      }, 4000);

      // ============================================================
      // TAB SWITCHING HOOKS (load data when tabs are opened)
      // ============================================================
      let _origSwitchTab = typeof switchTab === "function" ? switchTab : null;

      // Override switchTab to hook into new tabs
      let _tabHooksSetup = false;
      function setupTabHooks() {
        if (_tabHooksSetup) return;
        _tabHooksSetup = true;

        let origFn = window.switchTab;
        window.switchTab = function (tabName, btn) {
          origFn(tabName, btn);
          // Load data for new tabs
          if (tabName === "pickem") loadPickemData();
          if (tabName === "vestuario") loadTrashTalk();
        };
      }
      setTimeout(setupTabHooks, 1000);

      // ============================================================
      // 🗞️ GAZETTE BUTTON IN NEWS SIDEBAR
      // ============================================================
      // Add gazette + highlights buttons to the home sidebar after load
      setTimeout(function () {
        let sidebar = document.querySelector("#tab-news .lg\\:col-span-4");
        if (sidebar) {
          let gazetteCard = document.createElement("div");
          gazetteCard.className =
            "bg-gradient-to-br from-slate-900 to-black border-l-4 border-l-red-600 border-r border-y border-slate-700 p-5 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform shadow-lg relative overflow-hidden";
          gazetteCard.onclick = openGazette;
          gazetteCard.innerHTML = ' <div class="flex items-center gap-2 mb-2"> <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> <span class="text-red-500 text-[10px] font-black uppercase tracking-widest">En directo</span> </div> <h3 class="text-white font-black text-xl mb-1 italic tracking-tight uppercase">📺 Chiringuito Premier</h3> <p class="text-slate-400 text-xs font-bold uppercase">Salseo, exclusivas y resumen IA</p> <div class="absolute -right-4 -bottom-4 opacity-10 text-red-600 text-6xl font-black italic">!</div> ';
          sidebar.insertBefore(gazetteCard, sidebar.firstChild);
        }
      }, 2000);

      // ============================================================
      // 🎲 JUEGOS DE CASINO (Blackjack & Poker)
      // ============================================================
      let bjState = {
        deck: [],
        playerHand: [],
        dealerHand: [],
        active: false,
        bet: 0,
      };

      function initCasinoGames() {
        bjState = {
          deck: [],
          playerHand: [],
          dealerHand: [],
          active: false,
          bet: 0,
        };
        document.getElementById("bj-action-controls").classList.add("hidden");
        document.getElementById("bj-bet-controls").classList.remove("hidden");
        document.getElementById("bj-result").classList.add("hidden");
        document.getElementById("bj-player-cards").innerHTML = "";
        document.getElementById("bj-dealer-cards").innerHTML = "";
        document.getElementById("bj-player-score").innerText = "";
        document.getElementById("bj-dealer-score").innerText = "";
      }

      function bjCreateDeck() {
        const suits = ["♠️", "♥️", "♦️", "♣️"];
        const values = [
          "A",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "J",
          "Q",
          "K",
        ];
        let deck = [];
        for (let s of suits) {
          for (let v of values) {
            deck.push({ suit: s, value: v });
          }
        }
        return deck.sort(() => Math.random() - 0.5);
      }

      function bjGetScore(hand) {
        let score = 0;
        let aces = 0;
        hand.forEach((c) => {
          if (["J", "Q", "K"].includes(c.value)) score += 10;
          else if (c.value === "A") {
            score += 11;
            aces++;
          } else score += parseInt(c.value);
        });
        while (score > 21 && aces > 0) {
          score -= 10;
          aces--;
        }
        return score;
      }

      function bjStartGame() {
        let bet = parseInt(document.getElementById("bj-bet-amount").value);
        if (isNaN(bet) || bet <= 0) {
          alert("Introduce una apuesta válida.");
          return;
        }
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión para jugar.");
          return;
        }

        google.script.run
          .withSuccessHandler(function (res) {
            if (!res.success) {
              alert(res.msg);
              return;
            }
            bjState.active = true;
            bjState.bet = bet;
            bjState.deck = bjCreateDeck();
            bjState.playerHand = [bjState.deck.pop(), bjState.deck.pop()];
            bjState.dealerHand = [bjState.deck.pop(), bjState.deck.pop()];
            document.getElementById("bj-bet-controls").classList.add("hidden");
            document
              .getElementById("bj-action-controls")
              .classList.remove("hidden");
            bjRender();
            if (bjGetScore(bjState.playerHand) === 21) bjStand();
          })
          .checkAndDeductBalance(summoner, bet, "Blackjack Bet");
      }

      function bjRender() {
        const pCards = document.getElementById("bj-player-cards");
        const dCards = document.getElementById("bj-dealer-cards");
        pCards.innerHTML = bjState.playerHand
          .map(
            (c) =>
              '<div class="bg-white text-black font-bold w-12 h-16 rounded flex flex-col items-center justify-center shadow-md"><div class="text-xs">' +
                (c.value) + '</div><div class="text-lg">' + (c.suit) + '</div></div>',
          )
          .join("");
        if (bjState.active) {
          dCards.innerHTML =
            '<div class="bg-white text-black font-bold w-12 h-16 rounded flex flex-col items-center justify-center shadow-md"><div class="text-xs">' +
              (bjState.dealerHand[0].value) + '</div><div class="text-lg">' + (bjState.dealerHand[0].suit) +
              '</div></div>' +
            '<div class="bg-slate-700 w-12 h-16 rounded border-2 border-slate-600"></div>';
          document.getElementById("bj-player-score").innerText = bjGetScore(
            bjState.playerHand,
          );
          document.getElementById("bj-dealer-score").innerText = "?";
        } else {
          dCards.innerHTML = bjState.dealerHand
            .map(
              (c) =>
                '<div class="bg-white text-black font-bold w-12 h-16 rounded flex flex-col items-center justify-center shadow-md"><div class="text-xs">' +
                  (c.value) + '</div><div class="text-lg">' + (c.suit) + '</div></div>',
            )
            .join("");
          document.getElementById("bj-player-score").innerText = bjGetScore(
            bjState.playerHand,
          );
          document.getElementById("bj-dealer-score").innerText = bjGetScore(
            bjState.dealerHand,
          );
        }
      }

    