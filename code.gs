/************************************************************
* SoloQ Pro - Sistema de PuntuaciÃƒÂ³n PRO completo
*
* v12.0 - Ã‚Â¡Bonos de Juego Avanzado y Misiones Secretas!
************************************************************/

let GLOBAL_MATCH_CACHE = {}; // Memoria para premades

/* ----------------- GEMINI AI CONFIG ----------------- */
const GEMINI_API_KEY = "AIzaSyA" + "..." // (Key parcial para evitar lints o robos accidentales, la pondrÃƒÂ© completa)
// Nota: En producciÃƒÂ³n usar PropertiesService.getScriptProperties().getProperty("GEMINI_KEY")
const GEMINI_MODEL = "gemini-1.5-flash";

function getGeminiApiKey() {
  return PropertiesService.getScriptProperties().getProperty("GEMINI_KEY") || "AIzaSyA" + "..." // Fallback
}

/* ----------------- API KEY HELPERS ----------------- */
// FORMA CORRECTA, SEGURA Y OPTIMIZADA DE OBTENER LA KEY
function getApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty("RIOT_API_KEY");
  
  if (!key) {
    throw new Error("API Key no encontrada en la configuraciÃƒÂ³n del script. AÃƒÂ±ÃƒÂ¡dela en ConfiguraciÃƒÂ³n > Propiedades del script.");
  }
  
  return key;
}

/* ----------------- TRADUCTOR DE CAMPEONES (BANS) ----------------- */
let DDragonChampMap = null;

function getChampionNameFromId(champId) {
    if (!champId || String(champId) === "-1") return null; // -1 significa "No baneÃƒÂ³ nada"
    
    if (!DDragonChampMap) {
        try {
            // 1. Obtenemos la ÃƒÂºltima versiÃƒÂ³n del juego
            let vRes = UrlFetchApp.fetch("https://ddragon.leagueoflegends.com/api/versions.json", {muteHttpExceptions: true});
            let version = JSON.parse(vRes.getContentText())[0];
            
            // 2. Descargamos el diccionario de campeones de esa versiÃƒÂ³n
            let res = UrlFetchApp.fetch("https://ddragon.leagueoflegends.com/cdn/" + version + "/data/es_ES/champion.json", {muteHttpExceptions: true});
            let json = JSON.parse(res.getContentText()).data;
            
            // 3. Construimos nuestro mapa interno { "54": "Malphite" }
            DDragonChampMap = {};
            for (let key in json) {
                DDragonChampMap[json[key].key] = json[key].id; 
            }
        } catch(e) { 
            Logger.log("Error cargando DDragon: " + e.message);
            return "Champ_" + champId; 
        }
    }
    return DDragonChampMap[String(champId)] || "Champ_" + champId;
}
/* ----------------------------------------------------------------- */

/* ----------------- INITIAL SETUP ----------------- */
// v12.0: SetupOrUpdate, ahora 100% idempotente
function SetupInicial() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const ui = SpreadsheetApp.getUi();

Ã‚Â  const response = ui.alert(
Ã‚Â  Ã‚Â  'Confirmar Setup/ActualizaciÃƒÂ³n v12.0 (FINAL)',
Ã‚Â  Ã‚Â  'Esto aÃƒÂ±adirÃƒÂ¡ las nuevas hojas (si faltan) y todas las configuraciones finales. No borrarÃƒÂ¡ datos existentes. Ã‚Â¿Continuar?',
Ã‚Â  Ã‚Â  ui.ButtonSet.YES_NO
Ã‚Â  );
Ã‚Â  if (response !== ui.Button.YES) {
Ã‚Â  Ã‚Â  ui.alert('ActualizaciÃƒÂ³n cancelada.');
Ã‚Â  Ã‚Â  return;
Ã‚Â  }



Ã‚Â  const sheets = ['CONFIG','PLAYERS','MATCHES','KNOWN_CHAMPS','LOGS','DASHBOARD','SCORES','RANKING','WEEKLY','MONTHLY', 'MANUAL_POINTS', 'CHAMPION_DATA'];
Ã‚Â  sheets.forEach(name => {Ã‚Â 
Ã‚Â  Ã‚Â  if (!ss.getSheetByName(name)) {
Ã‚Â  Ã‚Â  Ã‚Â  ss.insertSheet(name);
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Hoja '${name}' creada.`);
Ã‚Â  Ã‚Â  }
Ã‚Â  });

Ã‚Â  // --- Configurar Hojas Nuevas (si no existen) ---
Ã‚Â  const manualSheet = ss.getSheetByName('MANUAL_POINTS');
Ã‚Â  if (manualSheet.getRange('A1').getValue() === "") {
Ã‚Â  Ã‚Â  manualSheet.getRange('A1:D1').setValues([['Date', 'SummonerName', 'Points', 'Reason']]).setFontWeight('bold');
Ã‚Â  Ã‚Â  manualSheet.setColumnWidths(1, 4, 150);
Ã‚Â  }

Ã‚Â  const champSheet = ss.getSheetByName('CHAMPION_DATA');
Ã‚Â  if (!champSheet.getRange('A1').getValue()) {

Ã‚Â  Ã‚Â  champSheet.clearContents();
    champSheet.getRange('A1:C1').setValues([['ChampionName', 'Region1', 'Region2']]).setFontWeight('bold');

    const champData = getChampionDataList();  
    champSheet.getRange(2, 1, champData.length, champData[0].length).setValues(champData);
    logToSheet('Datos de campeones rellenados.');

Ã‚Â  }
Ã‚Â Ã‚Â 
Ã‚Â  // --- AÃƒÂ±adir/Actualizar Claves en CONFIG (v12.0) ---
Ã‚Â  const cfgSheet = ss.getSheetByName('CONFIG');
Ã‚Â  const cfgData = cfgSheet.getDataRange().getValues();
Ã‚Â  const cfgMap = {};
Ã‚Â  cfgData.forEach(row => { cfgMap[row[0]] = row[1]; });

Ã‚Â  // v11.0: Renombrar claves antiguas (v9) si existen
Ã‚Â  let keysToRename = [
Ã‚Â  Ã‚Â  { old: 'new_champ_points', new: 'learning_bonus', value: '0.1' }, // old v8 key
Ã‚Â  Ã‚Â  { old: 'freestyle_penalty_threshold', new: 'freestyle_threshold', value: '20' }, // old v9 key
Ã‚Â  Ã‚Â  { old: 'freestyle_penalty_points', new: 'freestyle_penalty', value: '-1.5' } // old v9 key
Ã‚Â  ];

Ã‚Â  for (let i = 0; i < cfgData.length; i++) {
Ã‚Â  Ã‚Â  for (const key of keysToRename) {
Ã‚Â  Ã‚Â  Ã‚Â  if (cfgData[i][0] === key.old) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  cfgSheet.getRange(i + 1, 1).setValue(key.new);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  cfgSheet.getRange(i + 1, 2).setValue(key.value);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Config: "${key.old}" renombrado a "${key.new}"`);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  cfgMap[key.new] = key.value;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  delete cfgMap[key.old];
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  // v11.0: Arreglar win_points si sigue siendo una fecha
Ã‚Â  Ã‚Â  if (cfgData[i][0] === 'win_points' && (cfgData[i][1] instanceof Date || cfgData[i][1] > 1000)) {
Ã‚Â  Ã‚Â  Ã‚Â  cfgSheet.getRange(i + 1, 2).setValue("'1.5"); // AÃƒÂ±adir apÃƒÂ³strofo
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet('Config: "win_points" (fecha) corregido a "\'1.5"');
Ã‚Â  Ã‚Â  }
Ã‚Â  }

Ã‚Â  // v12.0: Lista COMPLETA de claves a aÃƒÂ±adir (v7-v12)
Ã‚Â // v13.0: CONFIGURACIÃƒâ€œN MAESTRA (Incluye correcciones de EconomÃƒÂ­a y Scaling)
  const allNewKeys = [
    // --- 1. GENERAL ---
    ['season_start_date', '2024-01-10T00:00:00Z', 'Fecha de inicio (Filtro partidas)'],
    ['match_mode', 'recentN', 'Modo de bÃƒÂºsqueda'],
    ['match_fetch_count', '3', 'Partidas a buscar por ciclo'],
    ['queue_filter', '420,440', 'Colas: SoloQ (420) y Flex (440)'],
    ['riot_region', 'europe', 'RegiÃƒÂ³n API'],

    // --- 2. ECONOMÃƒÂA BASE (Balanceada) ---
    ['win_points', '3.0', 'Puntos Base Victoria'],
    ['loss_points', '-6.0', 'Puntos Base Derrota (Ajustado)'],
    ['mvp_points', '1.0', 'Bonus MVP (OP.GG)'],
    ['afk_points', '-3.0', 'Castigo AFK Detectado'],
    
    // --- 3. KDA & RENDIMIENTO ---
    ['kda_high_threshold', '5.0', 'Umbral KDA Alto'],
    ['kda_high_points', '2.0', 'Puntos KDA Alto'],
    ['kda_good_threshold', '3.5', 'Umbral KDA Bueno'],
    ['kda_good_points', '1.0', 'Puntos KDA Bueno'],
    ['kda_low_threshold', '1.5', 'Umbral KDA Bajo'],
    ['kda_low_points', '-3.5', 'Castigo KDA Bajo'],
    ['perfect_game_points', '5.0', 'Bonus Inmortal (Win + 0 deaths)'],
    ['penta_points', '10.0', 'Bonus Pentakill'],

    // --- 4. PENALIZACIONES (Justicia v2) ---
    ['inting_deaths_threshold', '10', 'Muertes mÃƒÂ­nimas para analizar Inting'],
    ['inting_kda_threshold', '0.5', 'KDA mÃƒÂ¡ximo para considerar Inting'],
    ['inting_penalty', '-3.0', 'Castigo por Inting'],
    ['tilt_loss_threshold', '4', 'Derrotas seguidas para Tilt'],
    ['tilt_penalty', '-3.0', 'Castigo por Tilt'],
    ['solo_death_min', '30', 'Minuto inicio castigo muerte solitaria'],
    ['solo_death_penalty', '-1.5', 'Castigo muerte solitaria late game'],
    ['no_pinks_penalty', '-1.0', 'Castigo por no comprar control wards'],

    // --- 5. OBJETIVOS & MACRO (Escalado por Minuto) ---
    ['obj_damage_high', '2000', 'DaÃƒÂ±o Obj/Min ALTO (Antes 60k)'],
    ['obj_damage_mid', '1300', 'DaÃƒÂ±o Obj/Min MEDIO (Antes 45k)'],
    ['obj_damage_low', '400',  'DaÃƒÂ±o Obj/Min BAJO (Antes 16k)'],
    ['obj_damage_high_points', '2.5', 'Puntos Obj Alto'],
    ['obj_damage_mid_points', '1.5', 'Puntos Obj Medio'],
    ['obj_damage_low_points', '-1.5', 'Castigo Obj Bajo'],
    
    ['plates_bonus_points', '0.5', 'Puntos por Placa'],
    ['plate_bonus_threshold', '3', 'MÃƒÂ­nimo placas para bono'],
    ['split_king_points', '2.5', 'Puntos Rey del Splitpush (Estructuras)'],
    ['laner_steal_points', '5.0', 'Bonus Laner roba Baron/Dragon'],

    // --- 6. ROLES & COMBATE ---
    ['tank_bonus_points', '1.0', 'Bono Tanque (% daÃƒÂ±o recibido)'],
    ['tank_damage_share_threshold', '0.3', '% DaÃƒÂ±o recibido para bono'],
    ['role_supp_protector_points', '1.0', 'Bono Support Protector'],
    ['role_jng_steal_points', '1.5', 'Bono Jungla Robo'],
    ['jungle_diff_mitigation', '2.0', 'MitigaciÃƒÂ³n si tu jungla es inÃƒÂºtil'],
    
    ['dpm_points', '1.0', 'Bono Alto DPM'],
    ['burst_high_threshold', '1300', 'CrÃƒÂ­tico para One Shot (Bajado de 1600)'],
    ['burst_high_points', '2.0', 'Puntos One Shot'],
    ['trade_eff_excellent', '2.5', 'Ratio daÃƒÂ±o hecho/recibido (God)'],
    ['trade_eff_excellent_points', '2.5', 'Puntos Trade God'],
    
    // --- 7. EARLY GAME & HABILIDAD ---
    ['laning_gold_xp_points', '0.5', 'Puntos ventaja lÃƒÂ­nea Oro/XP'],
    ['laning_gold_xp_threshold', '500', 'Umbral ventaja lÃƒÂ­nea'],
    ['laning_cs_points', '0.5', 'Puntos ventaja CS @10'],
    ['laning_cs_threshold', '20', 'Umbral ventaja CS'],
    ['invader_bonus_points', '1.0', 'Bono Invasor'],
    ['roaming_bonus_points', '1.5', 'Bono Roaming'],
    ['quick_cleanse_bonus', '1.0', 'Bono Limpieza RÃƒÂ¡pida'],
    ['clutch_play_points', '0.5', 'Puntos por jugada Clutch (1v2)'],
    ['dive_master_points', '1.5', 'Puntos por Dive exitoso'],

    // --- 8. MISIONES SECRETAS & EXTRAS ---
    ['perfect_kda_888_points', '8.0', 'MisiÃƒÂ³n Secreta 888'],
    ['perfect_kda_777_points', '7.0', 'MisiÃƒÂ³n Secreta 777'],
    ['perfect_kda_666_points', '6.0', 'MisiÃƒÂ³n Secreta 666'],
    //['secret_duration_points', '3.0', 'Bono DuraciÃƒÂ³n 33:xx'],
    ['comeback_gold_threshold', '7000', 'Oro desventaja para Remontada'],
    ['comeback_points', '3.0', 'Puntos Remontada'],
    ['throw_gold_advantage', '5000', 'Ventaja tirada para Throw'],
    ['throw_penalty', '-3.0', 'Castigo Throw'],
    ['bounty_collected_points', '1.0', 'Puntos por Shutdown'],

    // --- 9. RIVALES & CHAMP POOL ---
    ['duel_win_points', '1.0', 'Ganar Duelo LÃƒÂ­nea'],
    ['duel_king_points', '2.5', 'Stomp Duelo LÃƒÂ­nea'],
    ['duel_loss_penalty', '-2.0', 'Perder Duelo LÃƒÂ­nea'],
    ['specialist_threshold', '8', 'Umbral Especialista'],
    ['specialist_bonus', '0.1', 'Bonus Especialista'],
    ['freestyle_threshold', '20', 'Umbral Freestyle'],
    ['freestyle_penalty', '-1.5', 'Castigo Freestyle'],
    
    // --- 10. MISIONES SEMANALES ---
    ['mission_week_type', 'Region', 'Tipo MisiÃƒÂ³n Semanal'],
    ['mission_week_target', 'Freljord', 'Objetivo MisiÃƒÂ³n'],
    ['mission_week_points', '3', 'Puntos MisiÃƒÂ³n'],
    ['mission_week_desc', 'MisiÃƒÂ³n Semanal Activa', 'DescripciÃƒÂ³n']
  ];

Ã‚Â  allNewKeys.forEach(keyRow => {
Ã‚Â  Ã‚Â  if (cfgMap[keyRow[0]] === undefined) {
Ã‚Â  Ã‚Â  Ã‚Â  cfgSheet.appendRow([keyRow[0], keyRow[1], keyRow[2]]);
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Clave de CONFIG aÃƒÂ±adida: ${keyRow[0]}`);
Ã‚Â  Ã‚Â  }
Ã‚Â  });

const players = ss.getSheetByName('PLAYERS');
Ã‚Â  if (players && players.getRange('A1:A1').getValue() === 'SummonerName') {
Ã‚Â  Ã‚Â  // Actualizamos encabezados para incluir G (TotalGames) y H (OP.GG)
Ã‚Â  Ã‚Â  // AHORA AÃƒâ€˜ADIMOS STOCK DISPLAY NAME (COLUMNA I)
Ã‚Â  Ã‚Â  players.getRange('A1:I1').setValues([['SummonerName','TagLine','PUUID','LastMatchID','Active (SÃƒÂ­/No)', 'CurrentStreak', 'TotalGames', 'OP.GG', 'StockDisplayName']]);
Ã‚Â  Ã‚Â  players.setColumnWidths(1,9,140); // Ajustar ancho para 9 columnas (A hasta I)
Ã‚Â  }

  SetupMisiones();
Ã‚Â  formatSheets(); // Re-formatear todo
Ã‚Â  logToSheet('Setup/ActualizaciÃƒÂ³n v12.0 completado.');
Ã‚Â  ui.alert('ActualizaciÃƒÂ³n v12.0 completada. Las nuevas hojas y configuraciones estÃƒÂ¡n listas.');
}


/* Adds sample players (Name,Tag) into PLAYERS if empty */
function populatePlayersExample() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const sheet = ss.getSheetByName('PLAYERS');
Ã‚Â  const sample = [
Ã‚Â  Ã‚Â  ['elzorro1','FOX'],
Ã‚Â  Ã‚Â  ['BlueDraki','EUW'],
Ã‚Â  Ã‚Â  ['Zakil Potolo','EUW'],
Ã‚Â  Ã‚Â  ['Delicheesee','Deli8'],
Ã‚Â  Ã‚Â  ['ElSÃƒÂ¡muel','2405'],
Ã‚Â  Ã‚Â  ['Mistweaver','4018'],
Ã‚Â  Ã‚Â  ['Atomic','SHH'],
Ã‚Â  Ã‚Â  ['Amumiana Grande','UWU'],
Ã‚Â  Ã‚Â  ['HÃ„Â±mÃ„Â±','EUW'],
Ã‚Â  Ã‚Â  ['EVUNA','GNE'],
Ã‚Â  Ã‚Â  ['Arisu','Senku'],
Ã‚Â  Ã‚Â  ['RyÃƒÂ» Zacker','RyÃƒÂ»96'],
Ã‚Â  Ã‚Â  ['MRezok','EUW']
Ã‚Â  ];
Ã‚Â  const rows = sheet.getDataRange().getValues();
Ã‚Â  if (rows.length <= 1) {
Ã‚Â  Ã‚Â  sheet.getRange(2,1, sample.length, 2).setValues(sample);
Ã‚Â  Ã‚Â  sheet.getRange(2,5,sample.length,1).setValue('SÃƒÂ­');
Ã‚Â  Ã‚Â  SpreadsheetApp.getUi().alert('Players sample added to PLAYERS.');
Ã‚Â  } else {
Ã‚Â  Ã‚Â  SpreadsheetApp.getUi().alert('PLAYERS ya contiene datos Ã¢â‚¬â€ populatePlayersExample no aÃƒÂ±adirÃƒÂ¡ duplicados.');
Ã‚Â  }
}

/* ----------------- HELPERS ----------------- */
let CHAMPION_DATA_CACHE = null;

function getChampionDataMap() {
Ã‚Â  if (CHAMPION_DATA_CACHE) {
Ã‚Â  Ã‚Â  return CHAMPION_DATA_CACHE;
Ã‚Â  }
Ã‚Â Ã‚Â 
Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const champSheet = ss.getSheetByName('CHAMPION_DATA');
Ã‚Â  Ã‚Â  if (!champSheet) {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet('ERROR: Hoja CHAMPION_DATA no encontrada. Ejecuta SetupInicial.');
Ã‚Â  Ã‚Â  Ã‚Â  return {};
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const data = champSheet.getRange(2, 1, champSheet.getLastRow() - 1, 3).getValues();
Ã‚Â  Ã‚Â  const map = {};
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  data.forEach(row => {
Ã‚Â  Ã‚Â  Ã‚Â  const champName = row[0];
Ã‚Â  Ã‚Â  Ã‚Â  if (champName) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  map[champName] = [row[1], row[2]].filter(Boolean); // [Region1, Region2]
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  });
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  CHAMPION_DATA_CACHE = map;
Ã‚Â  Ã‚Â  return map;
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet('Error cacheando CHAMPION_DATA: ' + e.message);
Ã‚Â  Ã‚Â  return {};
Ã‚Â  }
}

// --- Ã‚Â¡NUEVO! CACHE PARA EL SISTEMA DE MISIONES ---
let MISSIONS_CACHE = null;
let MISSION_STATE_CACHE = null;
let CACHE_TIMESTAMP = 0;

/**
 * Ã‚Â¡NUEVO! Lee todas las misiones desde la hoja "MISSIONS".
 * Usa un cache de 5 minutos para evitar leer la hoja en cada partida.
 */
function getMissions(forceReload = false) {
  const now = new Date().getTime();
  if (!MISSIONS_CACHE || (now - CACHE_TIMESTAMP > 300000) || forceReload) {
    try {
      const ss = SpreadsheetApp.getActive();
      const missionSheet = ss.getSheetByName('MISSIONS');
      const data = missionSheet.getRange(2, 1, missionSheet.getLastRow() - 1, 8).getValues();
      
      MISSIONS_CACHE = data.map(row => ({
        MissionID: row[0],
        Descripcion: row[1],
        Tipo: row[2],
        Objetivo: row[3],
        ValorRequerido: Number(row[4]),
        RecompensaPts: Number(row[5]),
        Dificultad: row[6],
        Tracking: row[7]
      })).filter(m => m.MissionID && m.Tracking);
      
      CACHE_TIMESTAMP = now;
      logToSheet(`Cache de Misiones (re)cargado. ${MISSIONS_CACHE.length} misiones encontradas.`);
    } catch (e) {
      logToSheet('ERROR CRÃƒÂTICO al cargar misiones: ' + e.message);
      return [];
    }
  }
  return MISSIONS_CACHE;
}

function getMissionStateCache(forceReload = false) {
    const now = new Date().getTime();
    if (!MISSION_STATE_CACHE || (now - CACHE_TIMESTAMP > 300000) || forceReload) {
        try {
            const ss = SpreadsheetApp.getActive();
            const stateSheet = ss.getSheetByName('MISSION_STATE');
            const lastRow = stateSheet.getLastRow(); // Obtenemos la ÃƒÂºltima fila

            MISSION_STATE_CACHE = {};

            // SOLUCIÃƒâ€œN AL ERROR DE RANGO:
            // Si lastRow es menor que 2 (solo hay encabezados o estÃƒÂ¡ vacÃƒÂ­a), no leemos nada.
            if (lastRow < 2) {
                console.log("Cache de misiones vacÃƒÂ­o (Hoja limpia).");
                CACHE_TIMESTAMP = now;
                return MISSION_STATE_CACHE;
            }

            // Ahora es seguro leer
            const data = stateSheet.getRange(2, 1, lastRow - 1, 5).getValues();
            
            data.forEach(row => {
                const player = row[1];
                const missionID = row[2];
                if (!MISSION_STATE_CACHE[player]) {
                    MISSION_STATE_CACHE[player] = {};
                }
                MISSION_STATE_CACHE[player][missionID] = {
                    key: row[0], // PlayerName_MissionID
                    Status: row[3],
                    CurrentValue: row[4]
                };
            });
            CACHE_TIMESTAMP = now;
            logToSheet('Cache de ESTADO de misiones (re)cargado.');
        } catch (e) {
            logToSheet('ERROR CRÃƒÂTICO al cargar estado de misiones: ' + e.message);
            MISSION_STATE_CACHE = {};
        }
    }
    return MISSION_STATE_CACHE;
}

function updateMissionStateBatch(updates) {
  if (updates.length === 0) return;
  
  try {
    const ss = SpreadsheetApp.getActive();
    const stateSheet = ss.getSheetByName('MISSION_STATE'); // AquÃƒÂ­ definimos stateSheet

    // CORRECCIÃƒâ€œN DEL ERROR "sheet is not defined":
    // Antes tenÃƒÂ­as: const lastRow = sheet.getLastRow();
    const lastRow = stateSheet.getLastRow(); // Usamos la variable correcta

    let rowMap = {};

    // Solo intentamos leer el mapa de filas si hay datos
    if (lastRow >= 1) {
        const data = stateSheet.getRange(1, 1, lastRow, 1).getValues(); // Leemos solo la columna Key para ir rÃƒÂ¡pido
        data.forEach((row, index) => {
            rowMap[row[0]] = index + 1; 
        });
    }
    
    updates.forEach(update => {
      const { PlayerName, MissionID, Status, CurrentValue } = update;
      const key = `${PlayerName}_${MissionID}`;
      
      if (rowMap[key]) {
        // La fila existe, actualizar
        const rowIndex = rowMap[key];
        stateSheet.getRange(rowIndex, 4, 1, 2).setValues([[Status, CurrentValue]]);
      } else {
        // La fila es nueva, aÃƒÂ±adir
        stateSheet.appendRow([key, PlayerName, MissionID, Status, CurrentValue]);
        // AÃƒÂ±adir al mapa temporalmente por si hay duplicados en el mismo batch
        rowMap[key] = stateSheet.getLastRow(); 
      }
      
      // Actualizar el cache en memoria inmediatamente
      if (!MISSION_STATE_CACHE) MISSION_STATE_CACHE = {};
      if (!MISSION_STATE_CACHE[PlayerName]) MISSION_STATE_CACHE[PlayerName] = {};
      MISSION_STATE_CACHE[PlayerName][MissionID] = { key, Status, CurrentValue };
    });

    logToSheet(`Estado de misiones actualizado para ${updates.length} entradas.`);
  } catch (e) {
    logToSheet('ERROR CRÃƒÂTICO al actualizar estado de misiones: ' + e.message);
  }
}

function readConfigMap() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const cfg = ss.getSheetByName('CONFIG');
Ã‚Â  if (!cfg) return {};
Ã‚Â Ã‚Â 
Ã‚Â  const rows = cfg.getRange(2,1, Math.max(1, cfg.getLastRow()-1), 2).getValues();
Ã‚Â  const map = {};
Ã‚Â  for (let i=0;i<rows.length;i++){
Ã‚Â  Ã‚Â  if (rows[i][0]) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â // v11.0: Limpiar apÃƒÂ³strofo si existe (para el '1.5)
Ã‚Â  Ã‚Â  Ã‚Â  if (typeof rows[i][1] === 'string' && rows[i][1].startsWith("'")) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  map[rows[i][0]] = rows[i][1].substring(1);
Ã‚Â  Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  map[rows[i][0]] = rows[i][1];
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  }

Ã‚Â  function safeParseFloat(value, defaultValue) {
Ã‚Â  Ã‚Â  if (value instanceof Date) {
Ã‚Â  Ã‚Â  Ã‚Â  Logger.log(`WARN: safeParseFloat: El valor era una Fecha (${value}), usando default (${defaultValue})`);
Ã‚Â  Ã‚Â  Ã‚Â  return defaultValue;
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  const num = parseFloat(value);
Ã‚Â  Ã‚Â  return isFinite(num) ? num : defaultValue;
Ã‚Â  }
Ã‚Â  function safeParseInt(value, defaultValue) {
Ã‚Â  Ã‚Â  if (value instanceof Date) {
Ã‚Â  Ã‚Â  Ã‚Â  Logger.log(`WARN: safeParseInt: El valor era una Fecha (${value}), usando default (${defaultValue})`);
Ã‚Â  Ã‚Â  Ã‚Â  return defaultValue;
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  const num = parseInt(value, 10);
Ã‚Â  Ã‚Â  return isFinite(num) ? num : defaultValue;
Ã‚Â  }

Ã‚Â  // --- NORMALIZACIÃƒâ€œN Y CORRECCIÃƒâ€œN ---
Ã‚Â Ã‚Â 
Ã‚Â  if (!map.match_mode) map.match_mode = 'recentN';
Ã‚Â  map.riot_region = map.riot_region || 'europe';
Ã‚Â  map.queue_filter = (map.queue_filter !== undefined) ? String(map.queue_filter) : '';
Ã‚Â Ã‚Â 
Ã‚Â  map.season_start_date = map.season_start_date || '2000-01-01T00:00:00Z';
Ã‚Â  try {
Ã‚Â  Ã‚Â  map.seasonStartDateObj = new Date(map.season_start_date);
Ã‚Â  Ã‚Â  if (isNaN(map.seasonStartDateObj.getTime())) throw new Error("Invalid Date Object");
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet(`ERROR: La fecha 'season_start_date' ("${map.season_start_date}") es invÃƒÂ¡lida. Usando default. Error: ${e.message}`);
Ã‚Â  Ã‚Â  map.seasonStartDateObj = new Date('2000-01-01T00:00:00Z');
Ã‚Â  }

Ã‚Â  // --- 2. ECONOMÃƒÂA BASE (Balanceada) ---
  map.win_points = safeParseFloat(map.win_points, 3.0);
  map.loss_points = safeParseFloat(map.loss_points, -6.0);
  map.mvp_points = safeParseFloat(map.mvp_points, 1.0);
  
  // AJUSTE: Castigo AFK mÃƒÂ¡s severo (antes -3)
  map.afk_points = safeParseFloat(map.afk_points, -5.0); 

  // --- 3. KDA & RENDIMIENTO ---
  map.kda_high_threshold = safeParseFloat(map.kda_high_threshold, 5.0);
  map.kda_high_points = safeParseFloat(map.kda_high_points, 2.5); // Tier 5 (Dios) usa esto +2.0
  map.kda_good_threshold = safeParseFloat(map.kda_good_threshold, 3.5);
  map.kda_good_points = safeParseFloat(map.kda_good_points, 1.5); 
  map.kda_low_threshold = safeParseFloat(map.kda_low_threshold, 1.5);
  map.kda_low_points = safeParseFloat(map.kda_low_points, -2.0);
  map.perfect_game_points = safeParseFloat(map.perfect_game_points, 5.0);
  map.penta_points = safeParseFloat(map.penta_points, 10.0);

  // --- 4. PENALIZACIONES (Justicia v2) ---
  map.inting_deaths_threshold = safeParseInt(map.inting_deaths_threshold, 10);
  map.inting_kda_threshold = safeParseFloat(map.inting_kda_threshold, 0.5);
  map.inting_penalty = safeParseFloat(map.inting_penalty, -3.0); // Subido de -2 a -3
  map.tilt_loss_threshold = safeParseInt(map.tilt_loss_threshold, 4);
  map.tilt_penalty = safeParseFloat(map.tilt_penalty, -3.0);
  map.solo_death_min = safeParseInt(map.solo_death_min, 30);
  map.solo_death_penalty = safeParseFloat(map.solo_death_penalty, -1.0);
  map.no_pinks_penalty = safeParseFloat(map.no_pinks_penalty, -1.0);

  // --- 5. OBJETIVOS & MACRO ---
  map.obj_damage_high = safeParseFloat(map.obj_damage_high, 2000);
  map.obj_damage_mid = safeParseFloat(map.obj_damage_mid, 1300);
  map.obj_damage_low = safeParseFloat(map.obj_damage_low, 400);
  map.obj_damage_high_points = safeParseFloat(map.obj_damage_high_points, 2.5);
  map.obj_damage_mid_points = safeParseFloat(map.obj_damage_mid_points, 1.5);
  map.obj_damage_low_points = safeParseFloat(map.obj_damage_low_points, -1.5); // Fugitivo

  map.plates_bonus_points = safeParseFloat(map.plates_bonus_points, 0.5);
  map.plate_bonus_threshold = safeParseInt(map.plate_bonus_threshold, 3);
  map.split_king_points = safeParseFloat(map.split_king_points, 2.5);
  map.laner_steal_points = safeParseFloat(map.laner_steal_points, 5.0);

  // --- 6. ROLES & COMBATE ---
  map.tank_bonus_points = safeParseFloat(map.tank_bonus_points, 1.0);
  map.tank_damage_share_threshold = safeParseFloat(map.tank_damage_share_threshold, 0.3);
  map.role_supp_protector_points = safeParseFloat(map.role_supp_protector_points, 1.0);
  map.role_supp_protector_saves = safeParseInt(map.role_supp_protector_saves, 5);
  map.role_supp_protector_healing = safeParseInt(map.role_supp_protector_healing, 15000);
  map.role_jng_steal_points = safeParseFloat(map.role_jng_steal_points, 1.5);
  map.role_all_firstbrick_points = safeParseFloat(map.role_all_firstbrick_points, 0.5);
  map.jungle_diff_mitigation = safeParseFloat(map.jungle_diff_mitigation, 2.0);

  map.dpm_points = safeParseFloat(map.dpm_points, 1.0);
  map.burst_high_threshold = safeParseFloat(map.burst_high_threshold, 1300);
  map.burst_high_points = safeParseFloat(map.burst_high_points, 2.0);
  map.trade_eff_excellent = safeParseFloat(map.trade_eff_excellent, 2.5);
  map.trade_eff_excellent_points = safeParseFloat(map.trade_eff_excellent_points, 2.5);

  // --- 7. EARLY GAME ---
  map.laning_gold_xp_points = safeParseFloat(map.laning_gold_xp_points, 0.5);
  map.laning_gold_xp_threshold = safeParseFloat(map.laning_gold_xp_threshold, 500);
  map.laning_cs_points = safeParseFloat(map.laning_cs_points, 0.5);
  map.laning_cs_threshold = safeParseFloat(map.laning_cs_threshold, 20);
  map.invader_bonus_points = safeParseFloat(map.invader_bonus_points, 1.0);
  map.roaming_bonus_points = safeParseFloat(map.roaming_bonus_points, 1.5);
  map.quick_cleanse_bonus = safeParseFloat(map.quick_cleanse_bonus, 1.0);
  map.clutch_play_points = safeParseFloat(map.clutch_play_points, 0.5);
  map.dive_master_points = safeParseFloat(map.dive_master_points, 1.5);

  // --- 8. MISIONES SECRETAS ---
  map.perfect_kda_888_points = safeParseFloat(map.perfect_kda_888_points, 8.0);
  map.perfect_kda_777_points = safeParseFloat(map.perfect_kda_777_points, 7.0);
  map.perfect_kda_666_points = safeParseFloat(map.perfect_kda_666_points, 6.0);
  map.comeback_gold_threshold = safeParseFloat(map.comeback_gold_threshold, 7000);
  map.comeback_points = safeParseFloat(map.comeback_points, 3.0);
  map.throw_gold_advantage = safeParseFloat(map.throw_gold_advantage, 5000);
  map.throw_penalty = safeParseFloat(map.throw_penalty, -3.0);
  map.bounty_collected_points = safeParseFloat(map.bounty_collected_points, 1.0);

  // --- 9. DUELOS & POOL ---
  map.duel_win_points = safeParseFloat(map.duel_win_points, 2.0);
  map.duel_king_points = safeParseFloat(map.duel_king_points, 4.0);
  
  // AJUSTE: Duelo perdido bajado a -1.5 (era -2.5, muy alto)
  map.duel_loss_penalty = safeParseFloat(map.duel_loss_penalty, -2.5); 
  
  map.duel_kda_multiplier = safeParseFloat(map.duel_kda_multiplier, 1.5);
  map.duel_dpm_multiplier = safeParseFloat(map.duel_dpm_multiplier, 1.2);
  map.duel_gpm_multiplier = safeParseFloat(map.duel_gpm_multiplier, 1.1);
  map.duel_vision_multiplier = safeParseFloat(map.duel_vision_multiplier, 1.5);
  
  map.specialist_threshold = safeParseInt(map.specialist_threshold, 8);
  map.specialist_bonus = safeParseFloat(map.specialist_bonus, 0.1);
  map.freestyle_threshold = safeParseInt(map.freestyle_threshold, 20);
  map.freestyle_penalty = safeParseFloat(map.freestyle_penalty, -2.5);

  // --- 10. MISIONES SEMANALES ---
  map.mission_week_type = map.mission_week_type || '';
  map.mission_week_target = map.mission_week_target || '';
  map.mission_week_desc = map.mission_week_desc || 'MisiÃƒÂ³n Semanal';
  map.mission_week_points = safeParseFloat(map.mission_week_points, 0);

  // --- 11. NUEVAS MECÃƒÂNICAS (V13 - AÃƒâ€˜ADIDO) ---
  // Estas faltaban y son importantes para los cambios que hicimos
  map.baus_special_points = safeParseFloat(map.baus_special_points, 2.0); // Bono morir por torres
  map.baus_efficiency_points = safeParseFloat(map.baus_efficiency_points, 2.0); // Bono Sion Prime
  map.raid_boss_points = safeParseFloat(map.raid_boss_points, 1.5); // Aguantar focus
  map.vision_amnesty_kp = safeParseFloat(map.vision_amnesty_kp, 0.70); // KP% para perdonar visiÃƒÂ³n

Ã‚Â  return map;
}

function logToSheet(msg) {
Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const log = ss.getSheetByName('LOGS');
Ã‚Â  Ã‚Â  if (log) {
Ã‚Â  Ã‚Â  Ã‚Â  log.appendRow([new Date(), msg]);
Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  console.log('LOG ERROR: Log sheet not found.');
Ã‚Â  Ã‚Â  }
Ã‚Â  } catch(e) {
Ã‚Â  Ã‚Â  console.log('LOG ERROR: ' + e.message);
Ã‚Â  }
}

function riotFetchJson(url) {
  const key = getApiKey();
  if (!key) throw new Error('No RIOT API key set.');
  
  const opts = { method: 'get', headers: {'X-Riot-Token': key}, muteHttpExceptions: true };
  let maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const res = UrlFetchApp.fetch(url, opts);
      const code = res.getResponseCode();
      
      if (code >= 200 && code < 300) {
        const text = res.getContentText();
        try { return JSON.parse(text); } catch(e) { return text; }
      }
      
      // Manejo inteligente del Rate Limit (429)
      if (code === 429) {
        attempt++;
        const headers = res.getHeaders();
        // Riot suele enviar 'Retry-After' en segundos
        let waitTime = 2; // Default 2 segundos
        if (headers['Retry-After']) {
             waitTime = parseInt(headers['Retry-After'], 10);
        }
        console.warn(`Riot 429. Esperando ${waitTime}s...`);
        Utilities.sleep((waitTime * 1000) + 100); // Esperar lo que dicen + un poco de margen
        continue;
      }

      if (code >= 500) {
        attempt++;
        Utilities.sleep(2000 * attempt);
        continue;
      }
      
      logToSheet(`API Error ${code}: ${url}`);
      return { __error: true, code: code };

    } catch (e) {
      attempt++;
      Utilities.sleep(2000 * attempt);
    }
  }
  return { __error: true, code: 500, body: "Max retries reached" };
}

function getPuuidByRiotId_api(name, tag) {
Ã‚Â  const cfg = readConfigMap();
Ã‚Â  const region = cfg.riot_region || 'europe';
Ã‚Â  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
Ã‚Â  const res = riotFetchJson(url);
Ã‚Â  if (res && !res.__error && res.puuid) return res.puuid;
Ã‚Â  throw new Error('Error getting PUUID for ' + name + '#' + tag + ' -> ' + JSON.stringify(res));
}

function tierForPoints(points) {
  // LÃƒÂMITE INFERIOR: Nueva liga para puntos negativos
  if (points < 0) return "El Pozo"; 

  const tiers = [
    // --- TIER 1: Materiales Pobres (0 - 160) ---
    "Madera", "Piedra", "Cuarzo", "MÃƒÂ¡rmol",
    
    // --- TIER 2: Minerales Comunes (160 - 320) ---
    "Obsidiana", "Granito", "Bronce", "Plata Pura",
    
    // --- TIER 3: Gemas Preciosas (320 - 480) ---
    "JadeÃƒÂ­ta", "Topacio", "Amatista", "Zafiro",
    
    // --- TIER 4: Metales Raros (480 - 640) ---
    "Oro Blanco", "RubÃƒÂ­", "Esmeralda", "Adamantium",
    
    // --- TIER 5: Materiales MÃƒÂ­ticos (640 - 760) ---
    "Diamante", "Oricalco", "Vibranium", 
    
    // --- TIER 6: Leyendas de Runaterra (760 - 1000) ---
    "Mithril", "Ãƒâ€°ter", "Mineral Negro", 
    "Acero Valyrio", "Hielo Puro", "Cristal Hextech",
    
    // --- TIER 7: La CorrupciÃƒÂ³n del VacÃƒÂ­o (1000 - 1240) ---
    "Piedra de VacÃƒÂ­o", "Materia Oscura", "Antimateria", 
    "Plasma", "Magma Vivo", "Kriptonita",

    // --- TIER 8: Escala CÃƒÂ³smica (1240 - 1500+) ---
    "Polvo Estelar", "Nebulosa", "Supernova", 
    "Singularidad", "Horizonte de Sucesos", "Omnipotencia" 
];
  
  // Aseguramos que si points es 0 o positivo, use la lÃƒÂ³gica normal
  // La divisiÃƒÂ³n sigue siendo / 60 puntos por nivel (60 * 15 = 900)
  const p = Math.max(0, points);
  const idx = Math.min(Math.floor(p / 60), tiers.length - 1);
  return tiers[idx];
}

function tierColor(tier) {
  const map = {
    // 1. BÃƒÂ¡sicos
    "Madera": "#a0522d",    // MarrÃƒÂ³n
    "Piedra": "#b0c4de",    // Azul grisÃƒÂ¡ceo
    "Cuarzo": "#d8bfd8",    // Rosa pÃƒÂ¡lido
    "MÃƒÂ¡rmol": "#f0fff0",    // Blanco verdoso
    
    // 2. Comunes
    "Obsidiana": "#4a4a4a", // Gris oscuro
    "Granito": "#7f8c8d",   // Gris medio
    "Bronce": "#cd7f32",    // Bronce
    "Plata Pura": "#c0c0c0", // Plata

    // 3. Gemas
    "JadeÃƒÂ­ta": "#00a86b",   // Verde Jade
    "Topacio": "#ffc300",   // Amarillo intenso
    "Amatista": "#9966cc",  // Violeta
    "Zafiro": "#0f52ba",    // Azul Rey

    // 4. Raros
    "Oro Blanco": "#f3f4f6", // Gris muy claro
    "RubÃƒÂ­": "#e0115f",       // Rojo RubÃƒÂ­
    "Esmeralda": "#50c878",  // Verde Esmeralda
    "Adamantium": "#696969", // Gris Acero

    // 5. MÃƒÂ­ticos
    "Diamante": "#b9f2ff",  // Azul diamante
    "Oricalco": "#ff9966",  // Naranja cobre
    "Vibranium": "#32cd32", // Verde Lima neÃƒÂ³n
    
    // 6. Leyendas (NUEVOS)
    "Mithril": "#add8e6",      // Azul claro ÃƒÂ©lfico
    "Ãƒâ€°ter": "#d783ff",         // PÃƒÂºrpura mÃƒÂ¡gico
    "Mineral Negro": "#2c3e50",// Azul muy oscuro
    "Acero Valyrio": "#bdc3c7",// Gris plateado
    "Hielo Puro": "#a2d9ff",   // Azul hielo (Freljord)
    "Cristal Hextech": "#0ac8b9", // Cian Hextech (Piltover)

    // 7. VacÃƒÂ­o (NUEVOS)
    "Piedra de VacÃƒÂ­o": "#663399", // PÃƒÂºrpura oscuro
    "Materia Oscura": "#1a1a1d",  // Negro casi total
    "Antimateria": "#800080",     // Magenta oscuro
    "Plasma": "#ff00ff",          // Fuchsia elÃƒÂ©ctrico
    "Magma Vivo": "#ff4500",      // Naranja lava
    "Kriptonita": "#00ff00",      // Verde radioactivo

    // 8. CÃƒÂ³smico (NUEVOS)
    "Polvo Estelar": "#fffacd",   // Amarillo limÃƒÂ³n claro
    "Nebulosa": "#ff69b4",        // Rosa fuerte
    "Supernova": "#ffD700",       // Dorado brillante
    "Singularidad": "#000080",    // Azul marino profundo
    "Horizonte de Sucesos": "#000000", // Negro absoluto (texto blanco idealmente)
    "Omnipotencia": "#ffffff"     // Blanco puro (Divino)
  };
  
  return map[tier] || '#ffffff'; // Fallback blanco
}
function getQueueParamString(queue) {
Ã‚Â  if (!queue) return '';
Ã‚Â  return `&queue=${encodeURIComponent(queue)}`;
}

function fetchMatchIdsForPuuid(puuid, cfg) {
  const region = cfg.riot_region || 'europe';
  const count = 5; // LÃƒÂ­mite de seguridad
  
  // Leemos el filtro y quitamos espacios
  const rawFilter = String(cfg.queue_filter || '420,440,0').replace(/\s/g, '');
  let targetQueues = rawFilter.includes(',') ? rawFilter.split(',') : [rawFilter];

  let combinedIds = new Set();

  for (const qId of targetQueues) {
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX: Aseguramos que el "0" (Customs) pasa el filtro
    if (qId === "" || qId === null || qId === undefined) continue; 

    const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&queue=${qId}`;
    
    try {
      Utilities.sleep(200); 
      const res = riotFetchJson(url);
      
      if (Array.isArray(res)) {
        res.forEach(id => combinedIds.add(id));
      }
    } catch (e) {
      Logger.log(`Ã¢ÂÅ’ Error API buscando cola ${qId}: ${e.message}`);
    }
  }

  // Ordenar cronolÃƒÂ³gicamente (De mÃƒÂ¡s nueva a mÃƒÂ¡s vieja)
  let finalArray = Array.from(combinedIds);
  finalArray.sort((a, b) => {
      let numA = parseInt(a.split('_')[1]);
      let numB = parseInt(b.split('_')[1]);
      return numB - numA; 
  });

  return finalArray;
}

/* ----------------- RECOLECTOR TOTAL (GRIETA) ----------------- */
function syncAllRiftModes() {
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName("PLAYERS");
  const cfg = readConfigMap(); 
  
  // Ã°Å¸â€ºÂ¡Ã¯Â¸Â AÃƒâ€˜ADIDO EL 0 PARA PARTIDAS PERSONALIZADAS (CUSTOMS)
  const targetQueues = [420, 440, 400, 490, 0]; 

  const playersData = playersSheet.getDataRange().getValues();
  const champDataMap = getChampionDataMap();
  const region = cfg.riot_region || 'europe';
  
  const FETCH_COUNT = 5; 

  logToSheet(`Ã°Å¸Å¡â‚¬ Iniciando Escaneo Masivo de la Grieta (Incluyendo Personalizadas)...`);

  for (let i = 1; i < playersData.length; i++) {
    const name = playersData[i][0];
    const tag = playersData[i][1];
    let puuid = playersData[i][2];
    const active = String(playersData[i][4] || 'SÃƒÂ­').toLowerCase();
    
    if (!name || active === 'no' || active === 'false') continue;

    logToSheet(`Ã°Å¸â€˜ÂÃ¯Â¸Â Check: ${name}`);

    if (!puuid) {
       try { puuid = getPuuidByRiotId_api(name, tag); } catch(e) { continue; }
    }

    logToSheet(`Ã°Å¸â€Å½ Escaneando a: ${name}...`);

    for (const qId of targetQueues) {
      try {
        Utilities.sleep(1200); 

        const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${FETCH_COUNT}&queue=${qId}`;
        const ids = riotFetchJson(url);
        
        if (Array.isArray(ids) && ids.length > 0) {
          for (const matchId of ids) {
             processMatch(matchId, puuid, name, 0, cfg, champDataMap);
          }
        }
      } catch (e) {
        logToSheet(`Ã¢ÂÅ’ Error buscando cola ${qId} para ${name}: ${e.message}`);
      }
    }
  }
  
  updateScores();
  SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Escaneo completo de Rankeds, Normales y Personalizadas finalizado.');
}

/* ----------------- SINCRONIZACIÃƒâ€œN HÃƒÂBRIDA V5.0 (CATCH-UP + MANTENIMIENTO) ----------------- */
function syncMatchesToQueue() {
  const START_TIME = new Date().getTime();
  const TIME_LIMIT = 250000; // 5 minutes limit to be safe
  
  const ss = SpreadsheetApp.getActive();
  const queueSheet = ss.getSheetByName("MATCH_QUEUE");
  const playersSheet = ss.getSheetByName("PLAYERS");
  
  if (!queueSheet || !playersSheet) return;
  
  const cfg = readConfigMap();
  const props = PropertiesService.getScriptProperties();
  const region = cfg.riot_region || 'europe';

  const seasonStartObj = cfg.seasonStartDateObj || new Date('2026-01-08T00:00:00Z');
  const seasonStartEpoch = Math.floor(seasonStartObj.getTime() / 1000);

  const rawFilter = String(cfg.queue_filter || '420').replace(/\s/g, '');
  const targetQueues = rawFilter.split(',').filter(Boolean);
  
  const standardCount = Number(cfg.match_fetch_count) || 15; // Set to a reasonable number

  const lastRow = playersSheet.getLastRow();
  if (lastRow < 2) return;
  const playersRange = playersSheet.getRange(2, 1, lastRow - 1, 5);
  const playersData = playersRange.getValues(); 

  let startIndex = parseInt(props.getProperty('SYNC_PLAYER_INDEX') || '0');
  if (startIndex >= playersData.length) startIndex = 0;

  logToSheet(`Ã°Å¸Å¡â‚¬ Iniciando Sync HÃƒÂ­brido V5.0...`);

  // Optimize: Read queue sheet once
  let queueData = [];
  if (queueSheet.getLastRow() > 1) {
      queueData = queueSheet.getDataRange().getValues();
  }
  const existingQueueIds = new Set(queueData.map(r => String(r[0]).trim() + "_" + String(r[2]).trim()));

  // Array to hold all new rows to write to the queue sheet at once
  let newRowsForQueue = []; 

  for (let i = startIndex; i < playersData.length; i++) {
    // Ã¢ÂÂ³ TIME CHECK
    if (new Date().getTime() - START_TIME > TIME_LIMIT) {
      props.setProperty('SYNC_PLAYER_INDEX', i.toString());
      
      // Write any pending rows before pausing
      if (newRowsForQueue.length > 0) {
          queueSheet.getRange(queueSheet.getLastRow() + 1, 1, newRowsForQueue.length, 5).setValues(newRowsForQueue);
      }
      logToSheet("Ã¢ÂÂ³ Tiempo lÃƒÂ­mite. Pausando escaneo.");
      return; 
    }

    const name = playersData[i][0];
    const puuid = playersData[i][2];
    const lastSavedMatch = String(playersData[i][3]).trim(); 
    const active = String(playersData[i][4]).toLowerCase();

    if (!name || !puuid || active === 'no' || active === 'false') continue;

    let fetchCount = standardCount;
    let isCatchUp = false;

    if (lastSavedMatch === "" || lastSavedMatch === "undefined") {
        fetchCount = 20; // Catchup count
        isCatchUp = true;
        logToSheet(`Ã°Å¸â€â€ž CATCH-UP activado para ${name}`);
    }

    let newestMatchForPlayer = lastSavedMatch;

    for (const qId of targetQueues) {
        try {
          let url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${fetchCount}&queue=${qId}`;
          if (isCatchUp) url += `&startTime=${seasonStartEpoch}`;

          const ids = riotFetchJson(url); 
          
          if (Array.isArray(ids) && ids.length > 0) {
            const matchesToQueue = [];
            
            for (const matchId of ids) {
                const cleanId = String(matchId).trim();
                
                if (!isCatchUp && cleanId === lastSavedMatch) break;

                const uniqueKey = cleanId + "_" + name;
                if (!existingQueueIds.has(uniqueKey)) {
                    matchesToQueue.push(cleanId);
                    existingQueueIds.add(uniqueKey); 
                }
            }

            matchesToQueue.reverse(); 

            if (matchesToQueue.length > 0) {
                 logToSheet(`Ã°Å¸â€œÂ¥ ${name}: Encolando ${matchesToQueue.length} partidas nuevas (${qId}).`);
                 
                 // Push to array instead of appending immediately
                 matchesToQueue.forEach(mid => newRowsForQueue.push([mid, puuid, name, region, 'PENDING']));
                 
                 newestMatchForPlayer = matchesToQueue[matchesToQueue.length - 1];
            }
          }
          Utilities.sleep(100); 

        } catch (e) {
          logToSheet(`Ã¢ÂÅ’ Error escaneando ${name}: ${e.message}`);
        }
    }
    
    // Update the player's last match ID in the sheet if it changed
    if (newestMatchForPlayer !== lastSavedMatch) {
        playersSheet.getRange(i + 2, 4).setValue(newestMatchForPlayer);
    }
  }

  // Write all collected new rows to the queue sheet efficiently in one batch
  if (newRowsForQueue.length > 0) {
      queueSheet.getRange(queueSheet.getLastRow() + 1, 1, newRowsForQueue.length, 5).setValues(newRowsForQueue);
  }

  // Reset index when finished
  props.setProperty('SYNC_PLAYER_INDEX', '0');
  logToSheet("Ã¢Å“â€¦ Escaneo HÃƒÂ­brido completado.");
  
  // REMOVED: processQueue();  <-- This must be run by a separate trigger!
}


/* ----------------- PROCESS QUEUE (EL CEREBRO DEL SISTEMA) V5.0 ----------------- */
function processQueue() {
  const START_TIME = new Date().getTime();
  const TIME_LIMIT = 240000; // 4 minutos para evitar timeout de Google
  
  const ss = SpreadsheetApp.getActive();
  const queueSheet = ss.getSheetByName("MATCH_QUEUE");
  const playersSheet = ss.getSheetByName("PLAYERS");
  
  if (!queueSheet || !playersSheet) return;

  // Ã¢Å¡Â¡ OPTIMIZACIÃƒâ€œN: Leemos PLAYERS UNA SOLA VEZ antes de empezar el bucle
  // Creamos un "Mapa" (Diccionario) para acceder a las filas y rachas al instante
  const pData = playersSheet.getDataRange().getValues();
  const playerMap = {};
  for(let i = 1; i < pData.length; i++) {
      const nameKey = String(pData[i][0]).toLowerCase().trim();
      playerMap[nameKey] = {
          row: i + 1, // Fila real en el Excel (Base 1 + Header)
          streak: Number(pData[i][5] || 0), // Columna F
          totalGames: Number(pData[i][6] || 0) // Columna G
      };
  }

  try {
      while (true) {
        // 1. VerificaciÃƒÂ³n de tiempo de seguridad
        if (new Date().getTime() - START_TIME > TIME_LIMIT) {
          console.log("Ã¢ÂÂ³ Tiempo agotado en processQueue. Pausando para siguiente ciclo...");
          break; 
        }

        // ======================================================
        // Ã°Å¸â€â€™ FASE 1: EXTRAER DE LA COLA (BLOQUEO CORTO)
        // ======================================================
        let rowData = null;
        const lockQueue = LockService.getScriptLock();
        
        try {
            lockQueue.waitLock(10000); // Esperar turno de escritura en la cola
            
            const lastRow = queueSheet.getLastRow();
            if (lastRow < 2) {
               // Si llegamos aquÃƒÂ­, la cola estÃƒÂ¡ vacÃƒÂ­a. Ã‚Â¡Hemos terminado!
               if (typeof updateScores === "function") updateScores();    
               if (typeof checkWeeklyLimits === "function") checkWeeklyLimits(); 
               break; 
            }
            
            // Leemos la primera partida en espera (Fila 2) y la borramos de la cola
            const range = queueSheet.getRange(2, 1, 1, 5);
            rowData = range.getValues()[0];
            queueSheet.deleteRow(2); 
            SpreadsheetApp.flush(); 
            
        } catch (e) {
            Utilities.sleep(1000); 
            continue; 
        } finally {
            lockQueue.releaseLock(); // Ã°Å¸â€â€œ Soltamos la cola rÃƒÂ¡pido
        }
        
        // ======================================================
        // Ã°Å¸Â§Â  FASE 2: PROCESAR DATOS (SIN BLOQUEO - API RIOT)
        // ======================================================
        if (!rowData || !rowData[0]) continue;

        const matchId = rowData[0];
        const puuid = rowData[1];
        const name = rowData[2];
        const region = rowData[3];
        
        const cfg = readConfigMap();
        const champData = getChampionDataMap(); 

        const nameKey = String(name).toLowerCase().trim();
        const playerData = playerMap[nameKey];

        if (!playerData) {
            logToSheet(`Ã¢Å¡Â Ã¯Â¸Â Error: No se encontrÃƒÂ³ al jugador ${name} en PLAYERS. Saltando...`);
            continue;
        }

        logToSheet(`Ã¢Å¡â„¢Ã¯Â¸Â Procesando ${matchId} para ${name}...`);
        
        // LLAMADA A RIOT (Esto tarda 1-3 segs, la cola no estÃƒÂ¡ bloqueada aquÃƒÂ­)
        const newStreakResult = processMatch(matchId, puuid, name, playerData.streak, cfg, champData); 

        // ======================================================
        // Ã°Å¸â€™Â¾ FASE 3: ACTUALIZAR FICHA DEL JUGADOR (BLOQUEO CORTO)
        // ======================================================
        if (newStreakResult !== null) { 
             const lockPlayer = LockService.getScriptLock();
             try {
                 lockPlayer.waitLock(10000); 

                 // 1. Actualizamos nuestra memoria local para la siguiente vuelta del bucle
                 playerData.streak = newStreakResult;
                 playerData.totalGames += 1;

                 // 2. Escribimos los datos en el Excel
                 playersSheet.getRange(playerData.row, 6).setValue(playerData.streak);
                 playersSheet.getRange(playerData.row, 7).setValue(playerData.totalGames);
                 
                 // Ã°Å¸Å¡Â¨ CRÃƒÂTICO: NO tocamos la columna 4 (Last Match ID). 
                 // syncMatchesToQueue ya se encargÃƒÂ³ de marcarla.
                 
                 SpreadsheetApp.flush(); // Guardar cambios YA
                 console.log(`Ã¢Å“â€¦ ${name}: Racha ${playerData.streak} | Total ${playerData.totalGames}`);

             } catch(e) {
                 console.log("Error escribiendo en PLAYERS: " + e.message);
             } finally {
                 lockPlayer.releaseLock(); 
             }
        }
        
        // Pausa de cortesÃƒÂ­a para no saturar la API de Riot
        Utilities.sleep(2000); 

      } // Fin While
  } catch(e) {
      logToSheet("Error fatal en ProcessQueue: " + e.message);
  }
}


function forceResetSync() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('SYNC_PLAYER_INDEX');
  logToSheet("Ã¢â„¢Â»Ã¯Â¸Â Memoria de sincronizaciÃƒÂ³n borrada. EmpezarÃƒÂ¡ desde cero.");
  SpreadsheetApp.getUi().alert("Sistema reseteado.");
}

/* ----------------- MAIN SYNC ----------------- */
function syncMatches() {
Ã‚Â 
Ã‚Â  normalSyncMatches();
}

function normalSyncMatches() {
  const cfg = readConfigMap();
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName("PLAYERS");
  const matchesSheet = ss.getSheetByName("MATCHES"); 
  if (!playersSheet) { logToSheet('normalSyncMatches: PLAYERS sheet missing'); return; }

  const allMatchesData = matchesSheet.getDataRange().getValues();  
  const playersData = playersSheet.getDataRange().getValues();
  const champDataMap = getChampionDataMap();
  
  if (Object.keys(champDataMap).length === 0) {
    logToSheet('WARN: CHAMPION_DATA no estÃƒÂ¡ cargada.');
  }

  // --- 1. CÃƒÂLCULO DE FECHA Y MAPA DE CONTEO SEMANAL ---
  const ahora = new Date();
  const lunesEstaSemana = new Date(ahora);
  const dia = ahora.getDay(); 
  const diff = ahora.getDate() - dia + (dia === 0 ? -6 : 1); 
  lunesEstaSemana.setDate(diff);
  lunesEstaSemana.setHours(0,0,0,0);

  // Mapa de conteo rÃƒÂ¡pido
  const weeklyCountMap = {};
  for (let m = 1; m < allMatchesData.length; m++) {
    const matchDate = new Date(allMatchesData[m][1]); 
    if (matchDate >= lunesEstaSemana) {
      const pName = allMatchesData[m][2]; 
      weeklyCountMap[pName] = (weeklyCountMap[pName] || 0) + 1;
    }
  }

  // --- 2. SISTEMA DE TURNOS ALEATORIOS ---
  let playerIndices = [];
  for (let idx = 1; idx < playersData.length; idx++) playerIndices.push(idx);
  playerIndices = playerIndices.sort(() => Math.random() - 0.5);

  logToSheet(`Ã°Å¸Å¡â‚¬ Sync: Revisando ${playerIndices.length} jugadores...`);

  // --- 3. BUCLE PRINCIPAL ---
  for (let n = 0; n < playerIndices.length; n++) {
    const i = playerIndices[n];
    
    const name = (playersData[i][0] || '').toString().trim();
    const tag = (playersData[i][1] || '').toString().trim();
    let puuid = (playersData[i][2] || '').toString().trim();
    let lastMatch = (playersData[i][3] || '').toString().trim();
    const active = ((playersData[i][4] || 'SÃƒÂ­').toString().toLowerCase());
    let currentStreak = Number(playersData[i][5] || 0); 

    // Solo saltamos si el usuario ya estÃƒÂ¡ marcado como "no" manualmente
    if (!name || active === 'no' || active === 'n' || active === 'false') continue;

    if (!puuid) {
      try {
        puuid = getPuuidByRiotId_api(name, tag);
        playersSheet.getRange(i+1,3).setValue(puuid);
        Utilities.sleep(500);
      } catch(e) { continue; }
    }

    // Buscamos partidas (Recuerda que fetchMatchIdsForPuuid debe tener count = 20)
    const ids = fetchMatchIdsForPuuid(puuid, cfg);
    if (!Array.isArray(ids) || ids.length === 0) continue;

    const newIds = [];
    for (const id of ids) {
      if (id === lastMatch) break;
      newIds.push(id);
    }
    newIds.reverse(); 

    // Procesar partidas nuevas
    for (const id of newIds) {
      try {
        Utilities.sleep(200); 
        const newStreak = processMatch(id, puuid, name, currentStreak, cfg, champDataMap);
        if (newStreak !== null) {
            currentStreak = newStreak;
            playersSheet.getRange(i+1,4).setValue(id); 
        }
      } catch(e) {
        logToSheet('Error processing ' + id + ': ' + e.message);
      }
    }
    

    // --- 4. ACTUALIZACIÃƒâ€œN INTELIGENTE DE DATOS ---
    
    // A. Actualizar Racha (Columna F -> 6)
    playersSheet.getRange(i+1, 6).setValue(currentStreak);

    // B. Actualizar Total HistÃƒÂ³rico DE TEMPORADA (Columna G -> 7)
    // Leemos el valor que ya habÃƒÂ­a en la celda y le sumamos las NUEVAS de hoy
    const previousSeasonTotal = Number(playersSheet.getRange(i+1, 7).getValue() || 0);
    const newSeasonTotal = previousSeasonTotal + newIds.length;
    playersSheet.getRange(i+1, 7).setValue(newSeasonTotal);

    // C. CÃƒÂLCULO SEMANAL (Solo para el lÃƒÂ­mite)
    // weeklyCountMap ya tiene contadas las partidas de la hoja MATCHES desde el lunes.
    // Le sumamos las 'newIds' que acabamos de encontrar ahora mismo.
    const gamesThisWeek = (weeklyCountMap[name] || 0) + newIds.length;

    // =========================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â CENTINELA: LÃƒÂMITE SEMANAL DE 15 PARTIDAS
    // =========================================================
    const LIMIT_ACTIVE = true; 
    const SEMANA_LIMITE = 15;

    // Comprobamos si con las nuevas partidas se pasa del lÃƒÂ­mite semanal
    if (LIMIT_ACTIVE && gamesThisWeek >= SEMANA_LIMITE) {
        
        // Desactivamos al jugador poniendo "No" o un mensaje explicativo
        playersSheet.getRange(i + 1, 5).setValue("Cupo (15)"); 
        
        logToSheet(`Ã°Å¸Å¡Â« LÃƒÂMITE ALCANZADO: ${name} lleva ${gamesThisWeek} partidas esta semana (Total Season: ${newSeasonTotal}). Desactivado.`);
        
        // Opcional: Avisar en noticias
        if (newIds.length > 0) { // Solo avisar si acaba de terminar la partida que le bloquea
             registerNews('INFO', `Ã°Å¸â€â€™ ${name} ha completado sus 15 partidas semanales. Descansa, guerrero.`);
        }
    }
    // =========================================================

    // Actualizar OP.GG
    const regionSlug = (cfg.riot_region === 'europe') ? 'euw' : 'na'; 
    const riotIdSlug = `${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
    const opggUrl = `https://www.op.gg/summoners/${regionSlug}/${riotIdSlug}`;
    playersSheet.getRange(i+1, 8).setFormula(`=HYPERLINK("${opggUrl}"; "OP.GG")`);
  }

  recordNetWorthSnapshot(); 
  updateScores(); 
  logToSheet('Sync completado.');
}

// --- [NUEVO] SISTEMA DE HISTORIAL DE PATRIMONIO ---
function SetupHistorySheet() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName('NET_WORTH_HISTORY')) {
    const sheet = ss.insertSheet('NET_WORTH_HISTORY');
    sheet.getRange('A1:C1').setValues([['Date', 'Player', 'Total_Net_Worth']]).setFontWeight('bold');
    Logger.log("Hoja NET_WORTH_HISTORY creada.");
  }
}

// 2. FunciÃƒÂ³n para guardar el estado actual de todos (El "FotÃƒÂ³grafo")
// IMPORTANTE: Esta funciÃƒÂ³n debe ejecutarse al final de syncMatches()
function recordNetWorthSnapshot() {
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const portSheet = ss.getSheetByName('PORTFOLIO');
  const historySheet = ss.getSheetByName('NET_WORTH_HISTORY');

  if (!marketSheet || !historySheet) return;

  // Obtener precios actuales
  const marketData = marketSheet.getDataRange().getValues();
  const prices = {};
  const wallets = {}; // { "Player": {balance: 1000, stockVal: 0} }

  // 1. Leer Saldo y Precios
  for (let i = 1; i < marketData.length; i++) {
    const name = marketData[i][0];
    const price = Number(marketData[i][1]);
    const balance = Number(marketData[i][2]);
    
    prices[name] = price;
    wallets[name] = { balance: balance, stockVal: 0 };
  }

  // 2. Sumar valor de acciones
  if (portSheet && portSheet.getLastRow() > 1) {
    const portData = portSheet.getRange(2, 1, portSheet.getLastRow()-1, 4).getValues();
    portData.forEach(row => {
      const investor = row[0];
      const target = row[1];
      const amount = Number(row[2]);
      
      if (wallets[investor] && prices[target]) {
        wallets[investor].stockVal += (amount * prices[target]);
      }
    });
  }

  // 3. Guardar en el Historial
  const timestamp = new Date();
  const newRows = [];
  
  for (const player in wallets) {
    const total = wallets[player].balance + wallets[player].stockVal;
    newRows.push([timestamp, player, total]);
  }

  if (newRows.length > 0) {
    historySheet.getRange(historySheet.getLastRow() + 1, 1, newRows.length, 3).setValues(newRows);
  }
}

// 3. FunciÃƒÂ³n para enviar los datos a la web
function getMyNetWorthHistory(player) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('NET_WORTH_HISTORY');
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  // Filtramos solo las filas de ESTE jugador
  // Devolvemos solo fecha y valor
  const history = data.slice(1)
    .filter(r => r[1] === player)
    .map(r => ({
      date: new Date(r[0]).toLocaleDateString() + " " + new Date(r[0]).getHours() + ":00",
      value: Number(r[2])
    }));
    
  // Si hay demasiados datos, cogemos los ÃƒÂºltimos 30 puntos para que el grÃƒÂ¡fico no explote
  return history.slice(-30); 
}

/**
Ã‚Â * v10.0: Mueve la lÃƒÂ³gica de champion pool aquÃƒÂ­.
Ã‚Â */
function updateChampionPool(puuid, summonerName, champion) {
Ã‚Â  const knownChampsSheet = SpreadsheetApp.getActive().getSheetByName("KNOWN_CHAMPS");
Ã‚Â  let isNewChamp = false;
Ã‚Â  let totalUniqueChamps = 0;Ã‚Â 

Ã‚Â  try {
Ã‚Â  Ã‚Â  const knownData = knownChampsSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â  let rowIndex = knownData.findIndex(r => String(r[0]) === String(puuid));

Ã‚Â  Ã‚Â  if (rowIndex === -1) {
Ã‚Â  Ã‚Â  Ã‚Â  knownChampsSheet.appendRow([puuid, summonerName, champion]);
Ã‚Â  Ã‚Â  Ã‚Â  isNewChamp = true;
Ã‚Â  Ã‚Â  Ã‚Â  totalUniqueChamps = 1;
Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  const list = (knownData[rowIndex][2] || "").split(",").map(c => c.trim()).filter(Boolean);
Ã‚Â  Ã‚Â  Ã‚Â  totalUniqueChamps = list.length;
Ã‚Â  Ã‚Â  Ã‚Â  if (!list.includes(champion)) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  list.push(champion);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  knownChampsSheet.getRange(rowIndex + 1, 3).setValue(list.join(","));
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  isNewChamp = true;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  totalUniqueChamps++;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet("KNOWN_CHAMPS error: " + e.message);
Ã‚Â  }
Ã‚Â Ã‚Â 
Ã‚Â  return { isNewChamp, totalUniqueChamps };
}

/* --- HELPER GLOBAL --- */
function safeAdd(currentTotal, pointsToAdd) {
  const num = Number(pointsToAdd);
  if (isFinite(num) && Math.abs(num) < 10000) {
    return currentTotal + num;
  }
  return currentTotal;
}

/* ----------------- PROCESS SINGLE MATCH  ----------------- */
function processMatch(matchId, puuid, summonerName, currentStreak, cfg, champDataMap) {
  try {
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â PROTECCIÃƒâ€œN 1: Si no hay ID, salir inmediatamente
    if (!matchId) return null;

    if (!cfg) cfg = readConfigMap();

    const ss = SpreadsheetApp.getActive();
    const matchesSheet = ss.getSheetByName("MATCHES");
    const allMatchesData = matchesSheet.getDataRange().getValues();
    const region = cfg.riot_region || 'europe';
    const invSheet = ss.getSheetByName("INVENTORY");

    // 1. LEER QUÃƒâ€° SEASON ES AHORA
    const configSheet = ss.getSheetByName('CONFIG');
    let currentSeason = 'S1'; // Valor por defecto si falla
    if (configSheet) {
        currentSeason = configSheet.getRange('B2').getValue();
    }
    
    // Ã°Å¸â€Â¥ OPTIMIZACIÃƒâ€œN TURBO: MIRAR EL EXCEL *ANTES* DE PREGUNTAR A RIOT (Evita bloqueos de Google)
    const lastRow = matchesSheet.getLastRow();
    if (lastRow > 1) {
        const checkData = matchesSheet.getRange(2, 1, lastRow - 1, 3).getValues();
        const exists = checkData.some(row => {
            return String(row[0]).trim() === String(matchId).trim() && 
                   String(row[2]).trim().toLowerCase() === String(summonerName).trim().toLowerCase();
        });

        if (exists) {
            // Ya la tenemos, salimos sin gastar cuota
            return currentStreak; 
        }
    }


    // Ã¢Å¡Â Ã¯Â¸Â AHORA SÃƒÂ: LLAMAMOS A RIOT (Con Memoria para Premades)
    let matchData;
    if (GLOBAL_MATCH_CACHE[matchId]) {
        // Ã‚Â¡Si alguien de la premade ya la descargÃƒÂ³ hoy, la cogemos de la memoria!
        matchData = GLOBAL_MATCH_CACHE[matchId];
        Logger.log("Ã¢â„¢Â»Ã¯Â¸Â Usando datos en cachÃƒÂ© para la premade: " + matchId);
    } else {
        // Si es el primero, vamos a Riot y la guardamos
        const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        matchData = riotFetchJson(url);
        if (matchData && !matchData.__error) {
            GLOBAL_MATCH_CACHE[matchId] = matchData;
        }
    }

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX PARTIDAS FANTASMAS (Evita bucles infinitos)
    if (!matchData || matchData.__error) {
      logToSheet('processMatch: Partida corrupta ignorada ' + matchId);
      return currentStreak; 
    }

    const info = matchData.info;

Ã‚Â  Ã‚Â  const matchStartTime = new Date(info.gameStartTimestamp || 0);
Ã‚Â  Ã‚Â  if (isNaN(cfg.seasonStartDateObj.getTime())) {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`ERROR CRÃƒÂTICO: 'season_start_date' es invÃƒÂ¡lida. Saltando filtro de fecha.`);
Ã‚Â  Ã‚Â  } else if (matchStartTime < cfg.seasonStartDateObj) {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Ignoring match ${matchId} for ${summonerName}. (Match date ${matchStartTime.toISOString()} is before season start ${cfg.season_start_date})`);
Ã‚Â  Ã‚Â  Ã‚Â  return null;
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  const participants = info.participants || [];
Ã‚Â  Ã‚Â  const p = participants.find(x => x.puuid === puuid);

Ã‚Â  Ã‚Â  if (!p) {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`processMatch: participant not found in ${matchId} for ${summonerName}`);
Ã‚Â  Ã‚Â  Ã‚Â  return null;
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  // --- v13.7: Lectura mejorada de objetivos (MOVIDO ARRIBA PARA EVITAR ERRORES) ---
Ã‚Â  Ã‚Â  const myTeamId = p.teamId;
Ã‚Â  Ã‚Â  const teamObj = info.teams.find(t => t.teamId === myTeamId) || {};
Ã‚Â  Ã‚Â  const enemyTeamObj = info.teams.find(t => t.teamId !== myTeamId) || {};

Ã‚Â  Ã‚Â  const myObjs = teamObj.objectives || {};
Ã‚Â  Ã‚Â  const enemyObjs = enemyTeamObj.objectives || {};

    
    const myFirstDrag = myObjs.dragon && myObjs.dragon.first ? true : false;
    const enemyFirstDrag = enemyObjs.dragon && enemyObjs.dragon.first ? true : false;

Ã‚Â  Ã‚Â  // Tus objetivos (DEFINIDOS ANTES DE USARLOS)
Ã‚Â  Ã‚Â  const dragonsCount = myObjs.dragon?.kills || 0;
Ã‚Â  Ã‚Â  const baronCount = myObjs.baron?.kills || 0;
Ã‚Â  Ã‚Â  const heraldCount = myObjs.riftHerald?.kills || 0;
Ã‚Â  Ã‚Â  const hordeCount = myObjs.horde?.kills || 0; // Kevins (Larvas)
Ã‚Â  Ã‚Â  const towerCount = myObjs.tower?.kills || 0;
Ã‚Â  Ã‚Â  const inhibitorCount = myObjs.inhibitor?.kills || 0;

Ã‚Â  Ã‚Â  // Objetivos enemigos
Ã‚Â  Ã‚Â  const enemyDragons = enemyObjs.dragon?.kills || 0;
Ã‚Â  Ã‚Â  const enemyBarons = enemyObjs.baron?.kills || 0;
Ã‚Â  Ã‚Â  const enemyHeralds = enemyObjs.riftHerald?.kills || 0;
Ã‚Â  Ã‚Â  const enemyHorde = enemyObjs.horde?.kills || 0;

Ã‚Â  Ã‚Â  let elderPresent = participants.some(x =>
Ã‚Â  Ã‚Â  Ã‚Â  x.challenges?.elderDragonKills > 0 ||
Ã‚Â  Ã‚Â  Ã‚Â  x.challenges?.elderDragonKillsWithParticipants > 0
Ã‚Â  Ã‚Â  );
Ã‚Â  Ã‚Â  if (!elderPresent && dragonsCount >= 5) elderPresent = true;

Ã‚Â  Ã‚Â  Logger.log("=== MATCH DEBUG START ===");
Ã‚Â  Ã‚Â  Logger.log("MatchID: " + matchId);
Ã‚Â  Ã‚Â  Logger.log("gameDuration raw: " + info.gameDuration);
Ã‚Â  Ã‚Â  Logger.log("=== MATCH DEBUG END ===");

Ã‚Â  Ã‚Â  const champion = p.championName || '';
Ã‚Â  Ã‚Â  const lane = p.teamPosition || p.lane || '';
    const role = (p.teamPosition || p.lane || 'UNKNOWN').toUpperCase();
Ã‚Â  Ã‚Â  const k = Number(p.kills || 0);
Ã‚Â  Ã‚Â  const d_stats = Number(p.deaths || 0); // Renombrado para evitar confusiÃƒÂ³n con dragones
Ã‚Â  Ã‚Â  const a = Number(p.assists || 0);

    const dpm = p.challenges?.damagePerMinute || 0; 
    const structuresDestroyed = (p.turretKills || 0) + (p.inhibitorKills || 0);
Ã‚Â  Ã‚Â  const dmg = Number(p.totalDamageDealtToChampions || 0);

Ã‚Â  Ã‚Â  const rawDur = info.gameDuration || 0;
Ã‚Â  Ã‚Â  const duration_min = Math.round((rawDur > 10000 ? rawDur / 1000 : rawDur) / 60);
Ã‚Â  Ã‚Â  const result = p.win ? "Win" : "Loss";

    // 1. Empaquetamos los datos en una variable llamada teamInfo
    const teamInfo = {
        dragonsCount, baronCount, heraldCount, hordeCount,
        towerCount, inhibitorCount, elderPresent,
        enemyDragons, enemyBarons, enemyHeralds, enemyHorde,
        myFirstDrag, enemyFirstDrag
    };

    // 2. Ahora usamos esa "caja" en la primera funciÃƒÂ³n
    let pointsObj = computePointsDetailed(
      p, participants, duration_min,
      teamInfo,
      cfg,
      summonerName,
      invSheet,
      allMatchesData,
      matchId
    );

    // 3. Ã‚Â¡Y ahora tambiÃƒÂ©n podemos usarla en la Forja sin que explote!
    const dropID = rollForgeDrop(pointsObj.total, p, teamInfo, pointsObj.notes);

    // 5. QUINTO: Ã‚Â¡USAMOS dropID! (AquÃƒÂ­ dejarÃƒÂ¡ de estar gris)
    if (dropID) {
        // Esto escribe el material en tu hoja de inventario
        invSheet.appendRow([summonerName, dropID, 'ACTIVE', new Date()]);
        pointsObj.notes.push(`Ã°Å¸Å½Â BotÃƒÂ­n: ${dropID}`);
    }
    

    let kp = 0;
    if (p.challenges && typeof p.challenges.killParticipation === "number") {
        kp = Number(p.challenges.killParticipation);
    } else {
        // Fallback: Calcularlo a mano si la API falla
        const myTeamParts = participants.filter(pt => pt.teamId === p.teamId);
        const teamKills = myTeamParts.reduce((acc, curr) => acc + (curr.kills || 0), 0);
        if (teamKills > 0) {
            kp = (k + a) / teamKills;
        }
    }

     // Asegurar rango 0.0 - 1.0 (evita errores de API raros)
    if (kp > 1.0) kp = 1.0; 
    if (kp < 0) kp = 0;
Ã‚Â  Ã‚Â  
    if (duration_min <= 6 || (p && p.gameEndedInEarlySurrender)) {
        matchesSheet.appendRow([
            matchId, matchStartTime, summonerName, p.championName || '', p.teamPosition || '', "Remake",
            k, d_stats, a, dmg, 0, duration_min,
            0, "Remake (No cuenta)"
        ]);
        logToSheet(`Ã°Å¸Å¡Â« Remake detectado para ${summonerName} (${matchId}). No suma puntos ni afecta racha.`);
        return currentStreak; 
    }

    // === Ã°Å¸â€ºÂ Ã¯Â¸Â FIX: CORRECCIÃƒâ€œN DE REMONTADA (TIMELINE) ===
    // Si ganamos, pero Riot dice que el dÃƒÂ©ficit fue 0 (Bug), calculamos el real.
    if (p.win) {
        // Valor actual (posiblemente bugueado)
        let currentDeficit = p.challenges?.maxGoldDeficit || 0;
        
        // Si es 0 o muy bajo, activamos el escÃƒÂ¡ner de Timeline
        if (currentDeficit < 500) {
            const realDeficit = fetchRealGoldDeficit(matchId, p.teamId, region, getApiKey());
            
            if (realDeficit > 0) {
                // INYECTAMOS EL VALOR REAL en los datos del jugador
                if (!p.challenges) p.challenges = {};
                p.challenges.maxGoldDeficit = realDeficit;
                Logger.log(`Ã°Å¸â€Â§ Deficit corregido vÃƒÂ­a Timeline: ${realDeficit} (Antes: ${currentDeficit})`);
            }
        }
    }

Ã‚Â  Ã‚Â  const { isNewChamp, totalUniqueChamps } = updateChampionPool(puuid, summonerName, champion);

    // =================================================================
    // Ã°Å¸â€â€™ EVENTO TEAM BATTLE: CANDADO DE ROL (ROLE LOCK)
    // =================================================================
    /*
    const props = PropertiesService.getScriptProperties();
    const isTeamEvent = props.getProperty('EVENT_TEAM_BATTLE_ACTIVE') === 'TRUE';
    const eventPhase = props.getProperty('TEAM_BATTLE_PHASE');

    // Si el evento estÃƒÂ¡ activo y los roles ya se decidieron (Fase LOCKED)
    if (isTeamEvent && eventPhase === 'LOCKED') {
        const battleSheet = ss.getSheetByName('TEAM_BATTLE');
        
        if (battleSheet) { // Check de seguridad por si no existe la hoja
            const data = battleSheet.getDataRange().getValues();
            
            // Buscamos al jugador en la hoja de batalla
            // Asumimos Col B = Player (Index 1), Col C = AssignedRole (Index 2)
            const playerRow = data.find(r => String(r[1]).toLowerCase().trim() === String(summonerName).toLowerCase().trim());
            
            if (playerRow) {
                let assignedRole = String(playerRow[2]).toUpperCase().trim(); // Ej: "TOP"
                let currentRole = role; // "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"

                // Normalizar nombres para que coincidan
                if (assignedRole === 'SUPPORT') assignedRole = 'UTILITY';
                if (currentRole === 'SUPPORT') currentRole = 'UTILITY';
                if (assignedRole === 'MID') assignedRole = 'MIDDLE';
                if (currentRole === 'MID') currentRole = 'MIDDLE';
                if (assignedRole === 'BOT') assignedRole = 'BOTTOM';
                if (currentRole === 'BOT') currentRole = 'BOTTOM';

                // Ã°Å¸â€â€™ EL CANDADO: Si tiene rol asignado y no coincide -> 0 PUNTOS.
                if (assignedRole && assignedRole !== "" && assignedRole !== currentRole) {
                    logToSheet(`Ã¢â€ºâ€ ROLE LOCK: ${summonerName} jugÃƒÂ³ ${currentRole} pero debe jugar ${assignedRole}. Puntos anulados.`);
                    
                    // Guardamos el match pero con 0 puntos y nota explicativa
                    matchesSheet.appendRow([
                        matchId, matchStartTime, summonerName, champion, role, result,
                        k, d_stats, a, dmg, 0, duration_min,
                        0, `Ã¢â€ºâ€ ROLE LOCK (DebÃƒÂ­a ser ${assignedRole})` // 0 Puntos
                    ]);
                    return currentStreak; // Salimos de la funciÃƒÂ³n inmediatamente
                }
            }
        }
    }
    */
    // =========================================================
    // Ã°Å¸â€˜â€˜ BONUS: PRESTIGIO (Winrate Global) - FIXED
    // =========================================================
    
    const globalWrStats = getGlobalWinrateBonus(summonerName, allMatchesData);
    
    if (globalWrStats.bonus > 0) {
        pointsObj.total = safeAdd(pointsObj.total, globalWrStats.bonus);
        
        // Diferenciamos visualmente si es un premio por ganar o un salvavidas por perder
        const prefix = p.win ? "Ã°Å¸Å¡â‚¬ Win Boost" : "Ã°Å¸â€ºÂ¡Ã¯Â¸Â MitigaciÃƒÂ³n";
        
        // Usamos el label que ya trae emojis (Ã°Å¸â€˜â€˜, Ã°Å¸Å¡â‚¬, Ã°Å¸â€œË†) desde la funciÃƒÂ³n getGlobalWinrateBonus
        pointsObj.notes.push(`${prefix}: ${globalWrStats.label} (${globalWrStats.wr} WR)`);
    }
    

Ã‚Â  Ã‚Â  if (!pointsObj || typeof pointsObj.total !== "number") {
Ã‚Â  Ã‚Â  Ã‚Â  pointsObj = { total: 0, notes: ["ERROR: computePointsDetailed missing data"] };
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  if (!Array.isArray(pointsObj.notes)) {
Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes = [];
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  // v12.0: PenalizaciÃƒÂ³n por "Hard Int"
Ã‚Â  Ã‚Â  const kda_val = (k + a) / Math.max(1, d_stats);
Ã‚Â  Ã‚Â  if (d_stats >= cfg.inting_deaths_threshold && kda_val < cfg.inting_kda_threshold) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.inting_penalty;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`Partida desastrosa (${k}/${d_stats}/${a}, ${cfg.inting_penalty}pts)`);
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  // v12.0: PenalizaciÃƒÂ³n por "Muerte Solitaria"
Ã‚Â  Ã‚Â  const soloDeathsPost30 = (p.deathsWithoutEnemyAssists || 0) - (p.challenges?.deathsWithoutEnemyAssistsBeforeMinionsSpawn || 0);
Ã‚Â  Ã‚Â  if (soloDeathsPost30 > 0 && duration_min >= cfg.solo_death_min) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.solo_death_penalty * soloDeathsPost30;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`Muerte Solitaria (x${soloDeathsPost30} post ${cfg.solo_death_min}min, ${cfg.solo_death_penalty * soloDeathsPost30}pts)`);
Ã‚Â  Ã‚Â  }

// v12.6: LÃƒâ€œGICA DE MAESTRÃƒÂA Y CONSISTENCIA (V4.1 - CON KDA HISTÃƒâ€œRICO)
    // ============================================================

    // 1. Calcular estadÃƒÂ­sticas HISTÃƒâ€œRICAS (Incluyendo la actual)
    let champWins = 0;
    let champGames = 0;
    let currentChampStreak = 0; 
    
    // Variables para KDA HistÃƒÂ³rico
    let h_Kills = 0;
    let h_Deaths = 0;
    let h_Assists = 0;

    // A. Historial previo (Iteramos MATCHES para sumar stats)
    for (let r = 1; r < allMatchesData.length; r++) {
       // Col 2 = Summoner, Col 3 = Champion
       if (allMatchesData[r][2] === summonerName && allMatchesData[r][3] === champion) {
          champGames++;
          
          // Sumar KDA histÃƒÂ³rico (Cols: 6=K, 7=D, 8=A)
          h_Kills += Number(allMatchesData[r][6] || 0);
          h_Deaths += Number(allMatchesData[r][7] || 0);
          h_Assists += Number(allMatchesData[r][8] || 0);

          if (allMatchesData[r][5] === "Win") {
             champWins++;
             currentChampStreak++;
          } else {
             currentChampStreak = 0; 
          }
       }
    }

    // B. Sumar la partida ACTUAL a la media
    champGames++;
    h_Kills += k;
    h_Deaths += d_stats;
    h_Assists += a;

    if (result === "Win") {
        champWins++;
        currentChampStreak++;
    } else {
        currentChampStreak = 0;
    }

    // C. Calcular MÃƒÂ©tricas Finales
    const realWR = champGames > 0 ? (champWins / champGames) : 0;
    const realWRText = (realWR * 100).toFixed(0) + "%";
    
    // KDA Promedio con el Champ (ProtecciÃƒÂ³n contra div/0)
    const champTotalKDA = (h_Kills + h_Assists) / Math.max(1, h_Deaths); 

    // --- DEFINIR "BUENA PARTIDA" (PERFORMANCE) ---
    // (Este bloque se mantiene, es bueno para filtrar partidas malas)
    const isTank = ["TOP", "JUNGLE", "SUPPORT"].includes(role) && (p.challenges?.damageTakenOnTeamPercentage > 0.25);
    const hasDecentStats = (kda_val >= 2.8); 
    const hasHighImpact = (kp >= 0.65); 
    const hasDamage = (dpm > 700); 
    const hasGoldLead = (p.challenges?.earlyLaningPhaseGoldExpAdvantage > 500); 
    const hasObjectives = (structuresDestroyed >= 3); 

    const isGoodPerformance = hasDecentStats || hasHighImpact || hasDamage || hasGoldLead || hasObjectives || (isTank && kda_val >= 1.5);

    // =========================================================
    // Ã°Å¸Å½Â­ MÃƒâ€œDULO DE IDENTIDAD Y MAESTRÃƒÂA (V5.0)
    // =========================================================

    const THRESHOLD_LEARNING = 5;
    const THRESHOLD_FREESTYLE = cfg.freestyle_threshold || 20;

    // DEFINICIÃƒâ€œN DE TIERS DE MAESTRÃƒÂA (Base)
    // AÃƒâ€˜ADIDO: Tier "Gran Maestro" para 50+ games
    const MASTERY_TIERS = [
        { games: 50, wr: 0.60, pts: 2.5, label: "Ã°Å¸â€˜â€˜ GRAN MAESTRO" }, // Nuevo Top Tier
        { games: 25, wr: 0.65, pts: 1.5, label: "Ã°Å¸ÂÂ OTP" },
        { games: 15, wr: 0.80, pts: 2.0, label: "Ã¢Å¡Â¡ EL DESTINO (GOD)" },
        { games: 11, wr: 0.70, pts: 1.0, label: "Ã°Å¸â€Â¥ Main" },
        { games: 13, wr: 0.60, pts: 0.5, label: "Ã°Å¸â€™Å½ SÃƒÂ³lido" } // Bajado WR a 55% para ser mÃƒÂ¡s permisivo en "SÃƒÂ³lido"
    ];

    if (isNewChamp) {
        // ... (LÃƒÂ³gica de Aprendizaje/Freestyle se mantiene igual) ...
         if (totalUniqueChamps <= THRESHOLD_LEARNING) {
            pointsObj.total = safeAdd(pointsObj.total, cfg.learning_bonus || 0.1);
            pointsObj.notes.push(`Ã°Å¸Å½â€œ Aprendizaje (Champ #${totalUniqueChamps})`);
        }
        else if (totalUniqueChamps > THRESHOLD_FREESTYLE) {
            const excessChamps = totalUniqueChamps - THRESHOLD_FREESTYLE;
            let penaltyMultiplier = Math.min(3.0, 1 + (excessChamps * 0.1)); 
            let basePenalty = (!isGoodPerformance) ? (cfg.freestyle_penalty || -2.5) * 1.5 : (cfg.freestyle_penalty || -1.5);
            let noteLabel = (!isGoodPerformance) ? "Ã°Å¸Å½Â² Freestyle Irresponsable" : "Ã°Å¸Å½Â² Freestyle";

            pointsObj.total = safeAdd(pointsObj.total, basePenalty * penaltyMultiplier);
            pointsObj.notes.push(`${noteLabel} (Champ #${totalUniqueChamps}, Pen x${penaltyMultiplier.toFixed(1)})`);
        }
    } 
    else {
        // === B. CAMPEÃƒâ€œN DE LA POOL ===

        // 1. Bono Especialista (Pool pequeÃƒÂ±a)
        if (totalUniqueChamps <= (cfg.specialist_threshold || 8)) {
            // ... (LÃƒÂ³gica de Especialista se mantiene) ...
             if (result === "Win" && isGoodPerformance && champGames >= 5) {
                pointsObj.total = safeAdd(pointsObj.total, 0.25);
                pointsObj.notes.push(`Ã¢Â­Â Especialista`);
            } 
            else if (result !== "Win" && !isGoodPerformance && champGames >= 10) {
                 pointsObj.total = safeAdd(pointsObj.total, -1.0); 
                 pointsObj.notes.push(`Ã¢Å¡Â Ã¯Â¸Â OTP Gap (Especialista fallido)`);
            }
        }

        // 2. CÃƒÂ¡lculo de MaestrÃƒÂ­a PRO (Solo Victorias)
        if (result === "Win") {
            if (typeof champGames !== 'undefined' && typeof realWR !== 'undefined') {
                
                if (!isGoodPerformance) {
                    pointsObj.notes.push(`Ã°Å¸Å½â€™ Carried (WR ${realWRText} pero invisible hoy)`);
                } 
                else {
                    // A. BUSCAR TIER BASE
                    // Usamos .find() para coger el primer tier que coincida (ordenados por prioridad arriba)
                    const tier = MASTERY_TIERS.find(t => champGames >= t.games && realWR >= t.wr);
                    
                    if (tier) {
                        let rankLabel = tier.label; 
                        let mPts = tier.pts;
                        
                        // Escalado por WR excesivo (Premium WR)
                        if (realWR > 0.60) mPts += (realWR - 0.60) * 4.0;
                        
                        // --- Ã°Å¸â€Â¥ BONUS POR KDA HISTÃƒâ€œRICO (Refinado) ---
                        let kdaMult = 1.0;
                        
                        // TIER 3: LEVIATÃƒÂN (KDA 7.0+ y mÃƒÂ­n 10 partidas) -> Aumentado requisito juegos
                        if (champTotalKDA >= 7.0 && champGames >= 10) {
                            kdaMult = 1.35; 
                            rankLabel += " Ã°Å¸ÂÂ²LeviatÃƒÂ¡n"; // Icono dragÃƒÂ³n
                        }
                        // TIER 2: GOD (KDA 5.0+ y mÃƒÂ­n 8 partidas)
                        else if (champTotalKDA >= 5.0 && champGames >= 8) {
                            kdaMult = 1.25; 
                            rankLabel += " Ã¢Â­ÂGod";
                        } 
                        // TIER 1: SÃƒâ€œLIDO (KDA 3.5+)
                        else if (champTotalKDA >= 3.5) {
                            kdaMult = 1.10; 
                        }

                        // --- 3. Multiplicador de Rendimiento ACTUAL (El "Gatekeeper") ---
                        // Si hoy has jugado "normal" (no carry), el bonus histÃƒÂ³rico se aplica menos.
                        // Si hoy has jugado "increÃƒÂ­ble", el bonus histÃƒÂ³rico se potencia.
                        
                        let pMult = 1.0;
                        let kda_val_local = (k + a) / Math.max(1, d_stats); 
                        
                        // Rendimiento EXCELENTE hoy
                        if (kda_val_local >= 4.0 || (p.challenges?.killParticipation || 0) >= 0.70) {
                            pMult = 1.0 + (Math.min(kda_val_local, 10) * 0.02); // PequeÃƒÂ±o extra
                            rankLabel += " Ã°Å¸â€Â¥Prime"; 
                        }
                        // Rendimiento MEDIOCRE hoy (pero ganaste) -> Nerf al multiplicador de historia
                        // Si tu media es de Dios (7.0) pero hoy hiciste un 2.0 KDA, no mereces todo el bonus.
                        else if (kda_val_local < 2.5 && kdaMult > 1.0) {
                             kdaMult = 1.0 + ((kdaMult - 1.0) / 2); // Reduce el bonus a la mitad
                             rankLabel += " (Rusty)";
                        }
                        
                        // --- 4. CÃƒÂLCULO FINAL ---
                        let fPts = mPts * kdaMult * pMult;
                        
                        // 5. Bono Racha (Consistencia inmediata)
                        if (currentChampStreak >= 3) {
                            fPts += 0.5;
                            rankLabel += ` Ã°Å¸â€Â¥${currentChampStreak}`;
                        }
                        
                        // 6. Guardar
                        pointsObj.total = safeAdd(pointsObj.total, fPts);
                        
                        let detailNote = `WR ${realWRText} | AvgKDA ${champTotalKDA.toFixed(1)}`;
                        pointsObj.notes.push(`${rankLabel} (${detailNote}, +${fPts.toFixed(2)} pts)`);
                    }
                }
            }
        }
    }
/**
    // v12.0: Misiones Secretas
Ã‚Â  Ã‚Â  if (k === 8 && d_stats === 8 && a === 8) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.perfect_kda_777_points;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`MisiÃƒÂ³n Secreta: 888PÃƒÂ³ker`);
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  if (k === 7 && d_stats === 7 && a === 7) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.perfect_kda_777_points;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`MisiÃƒÂ³n Secreta: 7/7/7`);
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  if (k === 0 && d_stats === 0 && a === 7) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.perfect_kda_777_points;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`MisiÃƒÂ³n Secreta: 0/0/7`);
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  if (k === 6 && d_stats === 6 && a === 6) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.perfect_kda_666_points;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`MisiÃƒÂ³n Secreta: 6/6/6 `);
Ã‚Â  Ã‚Â  }
/**
Ã‚Â  Ã‚Â  const rawDurationSeconds = (rawDur > 10000 ? rawDur / 1000 : rawDur);
Ã‚Â  Ã‚Â  if (rawDurationSeconds >= 1980 && rawDurationSeconds < 2040) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.total += cfg.secret_duration_points;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  pointsObj.notes.push(`MisiÃƒÂ³n Secreta: 33`);
Ã‚Â  Ã‚Â  }
*/
    // --- Ã‚Â¡NUEVO! LÃƒâ€œGICA DE MISIONES DINÃƒÂMICAS ---
    const missions = getMissions();
    const missionStateCache = getMissionStateCache();
    const playerState = missionStateCache[summonerName] || {};
    const updatesToBatch = [];
    const champRegions = champDataMap[champion] || [];
    const gpm = (p.goldEarned || 0) / Math.max(1, duration_min);
    const vs = p.visionScore || 0;
    const csMin = (p.totalMinionsKilled||0 + p.neutralMinionsKilled||0) / Math.max(1, duration_min);

    for (const m of missions) {
      const state = playerState[m.MissionID] || { Status: 'InProgress', CurrentValue: '' };

      // Si ya estÃƒÂ¡ completada (y no es 'Single' para re-contar), saltar
      if (state.Status === 'Completed' ) continue;

      let missionCompleted = false;
      let newValue = state.CurrentValue;

      // --- A. Misiones Acumulativas ---
      if (m.Tracking === 'Cumulative') {
        
        // A.1. Tipos que usan un Set (Listas ÃƒÂºnicas)
        if (m.Tipo === 'CHAMPION_REGION' || m.Tipo === 'UNIQUE_LANES') {
          let progressSet = new Set(state.CurrentValue ? state.CurrentValue.split(',') : []);
          
          if (m.Tipo === 'CHAMPION_REGION' && champRegions.includes(m.Objetivo)) {
            progressSet.add(champion);
          } else if (m.Tipo === 'UNIQUE_LANES' && lane !== 'UNKNOWN' && lane !== '') {
            progressSet.add(lane);
          }
          
          newValue = Array.from(progressSet).join(',');
          if (progressSet.size >= m.ValorRequerido) {
            missionCompleted = true;
          }
        }
        
        // A.2. Ã‚Â¡NUEVO TIPO! (Un campeÃƒÂ³n en X lÃƒÂ­neas)
        else if (m.Tipo === 'CHAMPION_IN_UNIQUE_LANES') {
          if (champion === m.Objetivo) {
            let progressSet = new Set(state.CurrentValue ? state.CurrentValue.split(',') : []);
            if (lane !== 'UNKNOWN' && lane !== '') {
              progressSet.add(lane);
            }
            newValue = Array.from(progressSet).join(',');
            if (progressSet.size >= m.ValorRequerido) {
              missionCompleted = true;
            }
          }
        }
        
        // A.3. Ã‚Â¡NUEVO TIPO! (Polivalente: CUALQUIER campeÃƒÂ³n en 5 lÃƒÂ­neas)
        else if (m.Tipo === 'ONE_CHAMP_ALL_LANES') {
          if (state.Status === 'Completed') continue; 
          let champMap = {};
          try { champMap = JSON.parse(state.CurrentValue || '{}'); } catch(e) {}
          
          if (!champMap[champion]) champMap[champion] = [];
          let lanesForChamp = new Set(champMap[champion]);
          
          if (lane !== 'UNKNOWN' && lane !== '') {
            lanesForChamp.add(lane);
          }
          
          champMap[champion] = Array.from(lanesForChamp);
          newValue = JSON.stringify(champMap);
          
          if (lanesForChamp.size >= m.ValorRequerido) {
            missionCompleted = true;
          }
        }

        
        
       // A.4. Tipos que usan un Contador (Sumas: Kills, Assists, Games as Role...)
        else if (m.Tipo === 'GAMES_AS_ROLE' || m.Tipo === 'GAMES_AS_CHAMPION' || m.Tipo === 'CUMULATIVE_STAT' || m.Tipo === 'CUMULATIVE_CHALLENGE') {
          let currentCount = parseInt(state.CurrentValue) || 0;
          
          if (state.Status === 'Completed') continue;

          // --- FIX: NORMALIZACIÃƒâ€œN DE ROL ---
          // Creamos una variable temporal para la comparaciÃƒÂ³n
          let laneToCheck = lane;
          if (laneToCheck === 'UTILITY') laneToCheck = 'SUPPORT'; 
          // --------------------------------

          // Ahora comparamos usando 'laneToCheck' en lugar de 'lane'
          if (m.Tipo === 'GAMES_AS_ROLE' && laneToCheck === m.Objetivo) {
            currentCount++;
          } else if (m.Tipo === 'GAMES_AS_CHAMPION' && champion === m.Objetivo) {
            currentCount++;
          } else if (m.Tipo === 'CUMULATIVE_STAT') {
            if (m.Objetivo === 'KILLS') currentCount += k;
            else if (m.Objetivo === 'DEATHS') currentCount += d_stats;
            else if (m.Objetivo === 'ASSISTS') currentCount += a;
          } else if (m.Tipo === 'CUMULATIVE_CHALLENGE') {
            let challengeValue = 0;
            if (m.Objetivo === 'STOLEN_OBJ') challengeValue = p.challenges?.epicMonstersStolen || 0;
            else if (m.Objetivo === 'SOLOKILLS') challengeValue = p.challenges?.soloKills || 0;
            currentCount += challengeValue;
          }
          
          newValue = currentCount.toString();
          if (currentCount >= m.ValorRequerido) {
            missionCompleted = true;
          }
        }

        // A.5. NUEVO: Listas de Campeones (Hook, Arcane)
        else if (m.Tipo === 'CHAMPION_LIST' || m.Tipo === 'CHAMPION_TAG') {
            let targetList = [];
            
            if (m.Objetivo === 'HOOK_MECHANIC') {
                targetList = ["Blitzcrank", "Thresh", "Pyke", "Nautilus"];
            } 
            else if (m.Objetivo === 'ARCANE_CAST') {
                targetList = [
                    "Jinx", "Vi", "Caitlyn", "Jayce", "Viktor", "Ekko", 
                    "Heimerdinger", "Singed", "Warwick", "Ambessa", "Teemo", "Orianna"
                ];
            }

            // Solo contamos si el campeÃƒÂ³n estÃƒÂ¡ en la lista
            if (targetList.includes(champion)) {
                let val = parseInt(state.CurrentValue) || 0;
                if (state.Status !== 'Completed') {
                    val++;
                    newValue = val.toString();
                    if (val >= m.ValorRequerido) {
                        missionCompleted = true;
                    }
                }
            }
        }

        // A.6. NUEVO: Objetos Acumulativos y Eventos (Dragons, FB)
        else if (m.Tipo === 'CUMULATIVE_OBJ' || m.Tipo === 'IN_GAME_EVENT') {
            let val = parseInt(state.CurrentValue) || 0;
            let increment = 0;

            if (m.Objetivo === 'DRAGONS_KILLED') {
                increment = Number(p.challenges?.dragonKills || 0);
            }
            else if (m.Objetivo === 'FIRST_BLOOD') {
                increment = p.firstBloodKill ? 1 : 0;
            }
            else if (m.Objetivo === 'PENTAKILL') { // Ejemplo si quisieras acumular pentas
                increment = p.largestMultiKill === 5 ? 1 : 0;
            }

            // Solo sumar si hemos hecho algo esta partida Y la misiÃƒÂ³n no estÃƒÂ¡ completa
            if (increment > 0 && state.Status !== 'Completed') {
                val += increment;
                newValue = val.toString();
                if (val >= m.ValorRequerido) {
                    missionCompleted = true;
                }
            }
        }
      } // <-- FIN DEL BLOQUE 'Cumulative'
      
      // --- B. Misiones de Partida ÃƒÅ¡nica ---
      else if (m.Tracking === 'Single') {
        let completedThisGame = false;

        if (m.Tipo === 'KDA_SINGLE_GAME' && kda_val >= m.ValorRequerido) {
          completedThisGame = true;
        } 
        else if (m.Tipo === 'PERFECT_GAME' && d_stats === 0 && result === 'Win') {
          completedThisGame = true;
        } 
        else if (m.Tipo === 'DEATHS_LESS_THAN' && d_stats <= m.ValorRequerido && result === 'Win') {
          completedThisGame = true; 
        }
        
        // 1. SUPP_DIFF
        else if (m.Tipo === 'STAT_COMPARISON' && m.Objetivo === 'KILLS_GT_ADC') {
            if ((lane === 'UTILITY' || lane === 'SUPPORT') && result === 'Win') {
                const myADC = participants.find(mate => mate.teamId === p.teamId && mate.teamPosition === 'BOTTOM');
                if (myADC && k > (Number(myADC.kills) || 0)) {
                    completedThisGame = true;
                }
            }
        }

        // 2. BROKEN_META (APC)
        else if (m.Tipo === 'ROLE_CHAMP_TYPE' && m.Objetivo === 'MAGE_BOTTOM') {
            const apcWhitelist = [
                "Ziggs", "Swain", "Karthus", "Veigar", "Seraphine", "Syndra", 
                "Hwei", "Cassiopeia", "Viktor", "Brand", "Velkoz", "Xerath", 
                "Heimerdinger", "Taliyah", "Aurelion Sol", "Vladimir", "Zoe",
                "Ahri", "Mel"
            ];
            if (lane === 'BOTTOM' && apcWhitelist.includes(champion)) {
                completedThisGame = true;
            }
        }

        // 3. TEAM_SHARE (Thanos y Omnipresent)
        else if (m.Tipo === 'TEAM_SHARE') {
            const myTeam = participants.filter(pt => pt.teamId === p.teamId);
            const teamTotalKills = myTeam.reduce((acc, val) => acc + (val.kills || 0), 0);

            if (teamTotalKills > 0) {
                if (m.Objetivo === 'KILL_SHARE') {
                    const myShare = k / teamTotalKills;
                    // Opcional: TambiÃƒÂ©n puedes pedir 20 min aquÃƒÂ­ si quieres evitar abusos con pocos kills
                    if (myShare >= m.ValorRequerido && duration_min >= 16) {
                         completedThisGame = true;
                    }
                }
                else if (m.Objetivo === 'KP') {
                    // FIX: AÃƒÂ±adido requisito de 20 minutos mÃƒÂ­nimo
                    if (kp >= m.ValorRequerido && duration_min >= 16) {
                        completedThisGame = true;
                    }
                }
            }
        }
        
        // 4. STAT_GREATER_THAN
        else if (m.Tipo === 'STAT_GREATER_THAN') {
          let statValue = 0;
          if (m.Objetivo === 'DPM') statValue = dpm;
          else if (m.Objetivo === 'GPM') statValue = gpm;
          else if (m.Objetivo === 'VS') statValue = vs;
          else if (m.Objetivo === 'CS_MIN') statValue = csMin;
          else if (m.Objetivo === 'CC_SCORE') statValue = p.challenges?.timeCCingOthers || 0;
          if (statValue >= m.ValorRequerido) {
            completedThisGame = true;
          }
        } 
        
        // 5. CHALLENGE_GREATER_THAN
        else if (m.Tipo === 'CHALLENGE_GREATER_THAN') {
          let challengeValue = 0;
          if (m.Objetivo === 'SOLOKILLS') challengeValue = p.challenges?.soloKills || 0;
          else if (m.Objetivo === 'SAVES') challengeValue = p.challenges?.saveAllyFromDeath || 0;
          else if (m.Objetivo === 'STOLEN_OBJ') challengeValue = p.challenges?.epicMonstersStolen || 0;
          else if (m.Objetivo === 'PLATES') challengeValue = p.challenges?.turretPlatesTaken || 0;
          else if (m.Objetivo === 'DIVE_KILLS') challengeValue = p.challenges?.killsUnderEnemyTurret || 0;
          else if (m.Objetivo === 'PENTAKILL') challengeValue = (p.largestMultiKill >= 5) ? 1 : 0;
          else if (m.Objetivo === 'COMEBACK') challengeValue = (p.challenges?.maxGoldDeficit || 0);
          else if (m.Objetivo === 'KILLS_ON_EVERYONE') {
            const didKillEveryone = p.challenges?.killsOnEveryPlayer || 0;
            const didGetPenta = (p.largestMultiKill >= 5);
            if (didKillEveryone > 0 && !didGetPenta) challengeValue = 1;
            else challengeValue = 0;
          }
          if (challengeValue >= m.ValorRequerido) {
            completedThisGame = true;
          }
        }

        // Actualizar estado si se completÃƒÂ³ (Single)
        if (completedThisGame) {
          missionCompleted = true; // Se completÃƒÂ³ en esta partida
          newValue = (parseInt(state.CurrentValue) || 0) + 1;
        }
      } // --- FIN DEL BLOQUE 'Single' ---

      // Si la misiÃƒÂ³n se acaba de completar O si es acumulativa y cambiÃƒÂ³ su valor
      if (missionCompleted || (m.Tracking === 'Cumulative' && newValue !== state.CurrentValue)) {
        updatesToBatch.push({
          PlayerName: summonerName,
          MissionID: m.MissionID,
          Status: missionCompleted ? 'Completed' : 'InProgress',
          CurrentValue: newValue
        });
        
        if (missionCompleted) {
          const rewardPts = Number(m.RecompensaPts || 0);
          pointsObj.total = (pointsObj.total || 0) + rewardPts;

          // Ã°Å¸â€ºÂ¡Ã¯Â¸Â LÃƒâ€œGICA DE CONTRABANDO (NO WAR):
          // Si la misiÃƒÂ³n da 50 puntos o mÃƒÂ¡s, aÃƒÂ±adimos la etiqueta oculta [NW:Pts]
          // Esto le dice a la funciÃƒÂ³n de Guerra que NO sume estos puntos al equipo.
          if (rewardPts >= 20) {
              pointsObj.notes.push(`MisiÃƒÂ³n Ãƒâ€°pica: ${m.Descripcion} (+${rewardPts}pts) [NW:${rewardPts}]`);
          } else {
              pointsObj.notes.push(`MisiÃƒÂ³n: ${m.Descripcion} (+${rewardPts}pts)`);
          }
        }
      }
    } // --- FIN DEL BUCLE FOR DE MISIONES ---

    if (updatesToBatch.length > 0) {
      updateMissionStateBatch(updatesToBatch);
    }
    // --- FIN LÃƒâ€œGICA DE MISIONES DINÃƒÂMICAS ---

Ã‚Â  Ã‚Â  /// CÃƒÂLCULO DE RACHA (CORREGIDO)
    let newStreak = currentStreak;
    if (result === "Win") {
      newStreak = (currentStreak > 0) ? currentStreak + 1 : 1;
      
      // CORRECCIÃƒâ€œN 2: Usar safeAdd y valores por defecto si falta la config
      if (newStreak === 3) { 
          const bonus = Number(cfg.streak_3_wins_points || 1.0); 
          pointsObj.total = safeAdd(pointsObj.total, bonus); 
          pointsObj.notes.push(`Racha 3W (+${bonus})`); 
      }
      if (newStreak === 5) { 
          const bonus = Number(cfg.streak_5_wins_points || 3.0);
          pointsObj.total = safeAdd(pointsObj.total, bonus); 
          pointsObj.notes.push(`Racha 5W (+${bonus})`); 
      }
      if (newStreak === 7) { 
          const bonus = Number(cfg.streak_7_wins_points || 5.0);
          pointsObj.total = safeAdd(pointsObj.total, bonus); 
          pointsObj.notes.push(`Racha 7W (+${bonus})`); 
      }

    } else {
      newStreak = (currentStreak < 0) ? currentStreak - 1 : -1;
    }
    
    updateVoidHordeProgress(k); // k es la variable que tiene las kills del jugador
Ã‚Â  Ã‚Â  pointsObj.total = Math.round(pointsObj.total * 100) / 100;

    // =================================================================================
    // Ã°Å¸â€â€™ ZONA CRÃƒÂTICA BLINDADA: ESCRITURA SEGURA (CORREGIDA)
    // =================================================================================
    
    // 1. PREPARAR EL CANDADO
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000); // Esperar turno
    } catch (e) {
        logToSheet(`Ã¢Å¡Â Ã¯Â¸Â Timeout esperando candado. Reintentando luego.`);
        return currentStreak;
    }

    try {
        // 2. VERIFICACIÃƒâ€œN FINAL (DENTRO DEL CANDADO)
        const lastRow = matchesSheet.getLastRow();
        let alreadyExists = false;

        // --- FIX CRÃƒÂTICO AQUÃƒÂ ---
        // Solo intentamos leer si hay mÃƒÂ¡s de 1 fila (es decir, si hay datos aparte de la cabecera)
        if (lastRow > 1) {
            // getRange(fila_inicio, col_inicio, num_filas, num_cols)
            // Esto leÃƒÂ­a 0 filas si lastRow era 1, causando el error "Out of bounds"
            const checkData = matchesSheet.getRange(2, 1, lastRow - 1, 3).getValues();
            
            alreadyExists = checkData.some(row => 
                String(row[0]).trim() === String(matchId).trim() && 
                String(row[2]).trim().toLowerCase() === String(summonerName).trim().toLowerCase()
            );
        }
        // ------------------------

        if (alreadyExists) {
            console.warn(`Ã°Å¸â€ºâ€˜ DUPLICADO EVITADO: ${matchId} ya estaba escrita.`);
        } else {
            // --- NO EXISTE: PROCEDEMOS A ESCRIBIR ---
                        // B. Actualizar Precio
            let priceDelta = 0; // 1. Declarar aquÃƒÂ­ fuera para evitar el error

            // A. Aplicar DaÃƒÂ±o al Boss
            try { damageRaidBoss(pointsObj.total); } catch(e) {}

            // B. Actualizar Precio
            priceDelta = updateStockPrice(summonerName, pointsObj.total); // 2. Asignar valor
            
            // C. Escribir datos
            const kpClean = Math.round(kp * 100) / 100;
            const finalNotes = pointsObj.notes.join("; ");
            
            // Convertimos el super-paquete de estadÃƒÂ­sticas en un texto para guardarlo en una sola celda
            const jsonStats = JSON.stringify(pointsObj.statsPayload || {});
          
            matchesSheet.appendRow([
                matchId, matchStartTime, summonerName, p.championName, (p.teamPosition || ''), result,
                k, d_stats, a, Number(p.totalDamageDealtToChampions), kpClean, duration_min,
                Number(pointsObj.total), finalNotes, currentSeason, jsonStats // <--- Columna P aÃƒÂ±adida
            ]);


            SpreadsheetApp.flush(); // Guardar cambios YA

            checkSponsorships(summonerName, result);

            // D. Notificaciones y Extras
            sendMatchNotification(summonerName, p.championName, `${k}/${d_stats}/${a}`, pointsObj.total, result, finalNotes, priceDelta);
            
            // ============================================================
            // Ã°Å¸â€™Â¸ DIVIDENDOS 3.0: ESCALA LEGENDARIA
            // ============================================================
            
            // Solo entramos si supera el corte mÃƒÂ­nimo de calidad (20 pts)
            if (pointsObj.total >= 20) {
                 let reason = "";

                 // 1. Determinar el TÃƒÂ­tulo del Dividendo (De mayor a menor)
                 if (pointsObj.total >= 60) {
                     reason = "Ã°Å¸â€˜â€˜ LEYENDA VIVIENTE";
                 } 
                 else if (pointsObj.total >= 50) {
                     reason = "Ã¢Å¡Â¡ NIVEL DIOS";
                 }
                 else if (pointsObj.total >= 40) {
                     reason = "Ã°Å¸Å½â€œ CLASE MAESTRA";
                 }
                 else if (pointsObj.total >= 30) {
                     reason = "Ã°Å¸Â¦Â DOMINIO TOTAL";
                 }
                 else {
                     reason = "Ã°Å¸â€œË† ALTO RENDIMIENTO";
                 }

                 // 2. AÃƒÂ±adir condecoraciÃƒÂ³n si hubo Pentakill
                 if (pointsObj.notes.some(n => n.includes("Penta") || n.includes("PENTAKILL"))) {
                     reason += " + PENTAKILL Ã¢Å¡â€Ã¯Â¸Â";
                 }

                 // 3. Ejecutar el pago (El cÃƒÂ¡lculo matemÃƒÂ¡tico se hace dentro de distributeDividends)
                 distributeDividends(summonerName, pointsObj.total, reason);
            }

            // Eventos
            handleHotPotato(summonerName, result, matchId);
            updateRivalryProgress(summonerName, pointsObj.total);
            
            logToSheet(`Ã¢Å“â€¦ MATCH GUARDADO: ${matchId} (${summonerName}) -> ${pointsObj.total} pts`);
        }

    } catch (e) {
        logToSheet(`Ã¢ÂÅ’ ERROR CRÃƒÂTICO ESCRIBIENDO: ${e.message}`);
    } finally {
        lock.releaseLock(); // Soltar candado siempre
    }
Ã‚Â  }
Ã‚Â  catch (e) {
Ã‚Â  Ã‚Â  logToSheet(`processMatch crashed for ${matchId} Ã¢â€ â€™ ${e.message}`);
Ã‚Â  Ã‚Â  return null;
Ã‚Â  }
}

/* ----------------- SCORING: computePointsDetailed (VERSIÃƒâ€œN FINAL BALANCEADA) ----------------- */
function computePointsDetailed(p, participants, durationMin, teamInfo, cfg, targetName, invSheet, allMatchesData, matchId) {
Ã‚Â  try {
Ã‚Â  Ã‚Â  if (!cfg) cfg = readConfigMap();

    const ss = SpreadsheetApp.getActive();
   

    // 1. INICIALIZACIÃƒâ€œN DE TODAS LAS VARIABLES
    // (Se calculan aquÃƒÂ­ para estar disponibles en todo el cÃƒÂ³digo)
    // =====================================
    // A. Definimos si ganÃƒÂ³
    const isWin = p.win;

    // B. Creamos la libreta de notas (ANTES de cualquier lÃƒÂ³gica)
    const notes = []; 

    // C. Calculamos puntos base (ANTES de cualquier lÃƒÂ³gica)
    let total = isWin ? Number(cfg.win_points) : Number(cfg.loss_points);
    if (!isFinite(total)) total = 0;

    // FunciÃƒÂ³n applyBonus aÃƒÂ±adida
    function applyBonus(label, pointsToAdd) {
        total = safeAdd(total, pointsToAdd);
        notes.push(label);
    }

    const k = Number(p.kills || 0);
    const d = Number(p.deaths || 0);
    const a = Number(p.assists || 0);
    // KDA seguro (evita divisiÃƒÂ³n por cero)
    const kda = (k + a) / Math.max(1, d);

    const role = (p.teamPosition || "").toUpperCase();
    const isJungle = role === "JUNGLE";
    const isSupport = ["SUPPORT", "UTILITY"].includes(role);
    const isLaner = ["TOP", "MIDDLE", "BOTTOM"].includes(role);

    // --- VARIABLES CRÃƒÂTICAS (MOVIDAS AL INICIO PARA EVITAR EL ERROR DE DPM) ---
    const dpm = Number(p.challenges?.damagePerMinute || 0);
    const gpm = (p.goldEarned || 0) / Math.max(1, durationMin);
    const vs = Number(p.visionScore || 0);
    const dmgTakenShare = p.challenges?.damageTakenOnTeamPercentage || 0;
    
    // --- VARIABLES CRÃƒÂTICAS (MOVIDAS AQUÃƒÂ) ---
    const myTowerDmg = Number(p.damageDealtToTurrets || 0); // <--- ESTA ES LA CLAVE
    const mostTowerDmg = Math.max(...participants.map(pt => pt.damageDealtToTurrets || 0));
    const damage = Number(p.totalDamageDealtToChampions || 0);

    const cs = (p.totalMinionsKilled||0) + (p.neutralMinionsKilled||0);
    const csMin = durationMin > 0 ? cs / durationMin : 0;

    // 2. MÃƒÂ©tricas de Eficiencia Baus
    const tdpm = durationMin > 0 ? myTowerDmg / durationMin : 0; // DaÃƒÂ±o a torres por minuto
    const dmgPerDeath = myTowerDmg / Math.max(1, d); // DaÃƒÂ±o a torres por cada muerte
    
    // Detectar si es un Tanque Real (no un Teemo Top)
    // Criterio: Rol de Tanque Y ha recibido al menos el 20% del daÃƒÂ±o total del equipo
    const isTankRole = ["TOP", "JUNGLE", "SUPPORT", "UTILITY"].includes(role);

    const isRealTank = isTankRole && dmgTakenShare > 0.30;

    // 1. HARD CC (Inmovilizaciones) -> Mide "Momentos de Impacto"
    // Variable: enemyChampionImmobilizations (Cuenta 1, 2, 3...)
    const hardCCCount = Number(p.challenges?.enemyChampionImmobilizations || 0);
    const hardCCPerMin = durationMin > 0 ? hardCCCount / durationMin : 0;

    // 2. TOTAL CC (PuntuaciÃƒÂ³n de Tiempo) -> Mide "PresiÃƒÂ³n Constante"
    // Variable: timeCCingOthers (Incluye Slows de Ashe, Nasus, etc.)
    const totalCCScore = Number(p.timeCCingOthers || 0);
    const totalCCPerMin = durationMin > 0 ? totalCCScore / durationMin : 0;

    // =====================================================
    // 1.b DEFINICIÃƒâ€œN DE VARIABLES FALTANTES
    // =====================================================
    
    // Supervivencia
    const longestLife = Number(p.longestTimeSpentLiving || 0); 

    // Desempaquetamos teamInfo para evitar el error "elderPresent is not defined"
    const {
        dragonsCount, baronCount, heraldCount, hordeCount,
        towerCount, inhibitorCount, elderPresent, 
        enemyDragons, enemyBarons, enemyHeralds, enemyHorde, 
        myFirstDrag, enemyFirstDrag
    } = teamInfo;
    // =====================================================

    // ==============================================================================
    // Ã°Å¸Å¡Â¨ CORRECCIÃƒâ€œN APLICADA AQUÃƒÂ (LÃƒÂ­neas movidas arriba)
    // ==============================================================================
    
    let punishmentPoints = 0;
    let punishmentNotes = [];

    // 1. Definimos la curaciÃƒÂ³n ANTES de usarla
    let effectiveHeal = Number(p.totalHeal || 0);
    const selfHealers = ["Dr. Mundo", "Zac", "Vladimir", "Warwick", "Trundle", "Swain", "Briar", "Aatrox", "Volibear", "Maokai", "XinZhao", "Hecarim", "Kayn", "Mordekaiser"];
    
    if (selfHealers.includes(p.championName)) {
        effectiveHeal = effectiveHeal * 0.1; 
    }

    // 2. Ahora ya podemos calcular la utilidad total sin error
    const totalShielding = Number(p.totalDamageShieldedOnTeammates || 0);
    const utilityScore = effectiveHeal + totalShielding;
    const utilityPerMin = durationMin > 0 ? utilityScore / durationMin : 0;
    
    
    // --- 1.b DEFINICIÃƒâ€œN DE VARIABLES ---

    // DaÃƒÂ±o Explosivo (Burst)
    const maxCrit = Number(p.largestCriticalStrike || 0);

    // Objetivos EspecÃƒÂ­ficos
    const exactTowers = Number(p.turretKills || 0); 
    
    // Nivel y XP
    const myLevel = Number(p.champLevel || 1);
    // Calculamos el nivel medio de la partida
    const allLevels = participants.map(pt => pt.champLevel || 1);
    const avgGameLevel = allLevels.reduce((a, b) => a + b, 0) / Math.max(1, allLevels.length);

    // CC y VisiÃƒÂ³n (CorrecciÃƒÂ³n crÃƒÂ­tica para que no fallen los bonos finales)
    const ccScore = Number(p.timeCCingOthers || 0); 
    const wardsDestroyed = Number(p.wardsKilled || 0);

    // Variables de equipo (para comparativas)
    const myTeam = participants.filter(pt => pt.teamId === p.teamId);
    const myTeamGold = myTeam.reduce((sum, pt) => sum + (pt.goldEarned || 0), 0);
    const enemyTeam = participants.filter(pt => pt.teamId !== p.teamId);
    const enemyTeamGold = enemyTeam.reduce((sum, pt) => sum + (pt.goldEarned || 0), 0);
    const goldDiff = Math.abs(myTeamGold - enemyTeamGold);
    const teamDeaths = myTeam.reduce((sum, pt) => sum + (pt.deaths || 0), 0);
    const teamAvgDeaths = teamDeaths / Math.max(1, myTeam.length);
    const dmgShare = p.challenges?.teamDamagePercentage || 0;
    const vsPerMin = vs / Math.max(1, durationMin);

    // --- 1. Obtener EstadÃƒÂ­sticas del Oponente ---
    // Definir oponente directo
    const opponent = participants.find(o => o.teamId !== p.teamId && o.teamPosition === p.teamPosition);
    
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX: Escudo Anti-Crashes por si Riot no asignÃƒÂ³ rol al enemigo
    const o_vs = opponent ? (opponent.visionScore || 0) : 0;
    const o_k = opponent ? Number(opponent.kills || 0) : 0;
    const o_d = opponent ? Number(opponent.deaths || 0) : 0;
    const o_a = opponent ? Number(opponent.assists || 0) : 0;
    const o_kda = (o_k + o_a) / Math.max(1, o_d); // KDA oponente
    const o_dpm = opponent ? (opponent.challenges?.damagePerMinute || 0) : 0; // DPM oponente
    const o_gpm = opponent ? ((opponent.goldEarned || 0) / Math.max(1, durationMin)) : 0; // GPM oponente


    // --- Ã°Å¸Â§Âª TEST DE EARLY GAME (INYECTOR) ---
    if (opponent) {
        const earlyTest = testEarlyLaneGap(p, opponent, role);
        if (earlyTest.debugLog !== "N/A" && earlyTest.debugLog !== "") {
             Logger.log(`=== TEST EARLY GAME PARA ${p.summonerName} ===`);
             Logger.log(`Puntos sugeridos: ${earlyTest.finalScore}`);
             Logger.log(`Detalles: ${earlyTest.debugLog}`);
        }
    }
    
    // --- Ã°Å¸â€¢ÂµÃ¯Â¸Â RADAR DE MISIONES DE ROL (NUEVA MECÃƒÂNICA S15) ---
    try {
        const hiddenKeys = Object.keys(p.challenges || {}).filter(k => 
            k.toLowerCase().includes('quest') || 
            k.toLowerCase().includes('mission') ||
            k.toLowerCase().includes('bounty')
        );
        if (hiddenKeys.length > 0) {
            Logger.log(`Ã°Å¸â€Â Ã‚Â¡PISTAS DE MISIÃƒâ€œN PARA ${p.summonerName}!`);
            hiddenKeys.forEach(k => {
                Logger.log(`   - ${k}: ${p.challenges[k]}`);
            });
        }
        
        // Ã°Å¸Å¡Â¨ RADAR EXTRA: Buscar en la raÃƒÂ­z del participante (por si Riot no lo mete en 'challenges')
        const rootKeys = Object.keys(p).filter(k => 
            k.toLowerCase().includes('quest') || 
            k.toLowerCase().includes('mission') ||
            (k.toLowerCase().includes('role') && !k.includes('teamPosition'))
        );
        if (rootKeys.length > 0) {
            Logger.log(`Ã¢Å¡Â Ã¯Â¸Â PISTA EN RAÃƒÂZ PARA ${p.summonerName}:`);
            rootKeys.forEach(k => {
                // Solo logueamos si es un nÃƒÂºmero o string para no romper el log con objetos gigantes
                if (typeof p[k] !== 'object') Logger.log(`   - ${k}: ${p[k]}`);
            });
        }
    } catch(e) {
        Logger.log("Error en el radar de misiones: " + e.message);
    }
    // ----------------------------------------
  
   // --- FIX: Definir KP tambiÃƒÂ©n aquÃƒÂ­ para que no falle el cÃƒÂ¡lculo de puntos ---
    let kp = 0;
    if (p.challenges && typeof p.challenges.killParticipation === "number") {
        kp = Number(p.challenges.killParticipation);
    } else {
        // Fallback manual
        const myTeamParts = participants.filter(pt => pt.teamId === p.teamId);
        const teamKills = myTeamParts.reduce((acc, curr) => acc + (curr.kills || 0), 0);
        if (teamKills > 0) {
            kp = (k + a) / teamKills;
        }
    }
    // Asegurar rango 0.0 - 1.0
    if (kp > 1.0) kp = 1.0;
    if (kp < 0) kp = 0;

   
    // =========================================================
    // 1. PUNTOS BASE & CONTEXTO DE PARTIDA (V2.0 - ESCALABLE)
    // =========================================================    

    if (!isWin) {

        // Calculamos la diferencia de oro por minuto (GDPM)
        const goldDiffPerMin = durationMin > 0 ? goldDiff / durationMin : 0;

        // --- A. Ã°Å¸â€™â€ CORAZÃƒâ€œN PARTIDO (Derrota Ajustada) ---
        if (goldDiffPerMin < 130 ) {
             total = total * 0.75; 
             notes.push(`Ã°Å¸â€™â€ CorazÃƒÂ³n Partido (Final muy ajustado)`);
        }
        
        // --- B. Ã°Å¸ÂÂ³Ã¯Â¸Â STOMPEADA (Derrota Aplastante) ---
        else if (durationMin < 26 && goldDiffPerMin > 400) {
             // Verificamos si ya existe la nota de AFK para no castigar doble
             const isAfkMitigated = notes.some(n => n.includes("AFK"));
             
             if (!isAfkMitigated) {
                 total -= 1.5; 
                 notes.push(`Ã°Å¸ÂÂ³Ã¯Â¸Â Stompeada en Contra (Gap de -${(goldDiff/1000).toFixed(1)}k oro)`);
             }
        }
    }

    // =========================================================
    // 2. MITIGACIONES DE DERROTA (V13.5 - SMART DEFENSE)
    // =========================================================
    if (!isWin) {
        
        // --- A. Ã°Å¸â€ºÂ¡Ã¯Â¸Â EL PILAR (Resistencia KDA/Farm) ---
        // LÃƒÂ³gica mejorada: Diferencia entre Carries y Supports.
        // Requisito comÃƒÂºn: Morir menos que la media del equipo (-1.5 de margen).
        // Requisito Anti-AFK: Tener un KP decente (>30%) para demostrar que intentaste ayudar.
        
        const deathLimit = Math.max(0, teamAvgDeaths - 1.5);
        let isPillar = false;

        if (d <= deathLimit) {
            // CASO 1: LANERS/JUNGLE (Requiere Farm y Presencia)
            if (!isSupport) {
                // Bajamos CS a 7.0 porque en derrota es difÃƒÂ­cil farmear si te asedian
                if (csMin >= 8.0 && kp >= 0.50) isPillar = true; 
            } 
            // CASO 2: SUPPORT (Requiere mucha Presencia y VisiÃƒÂ³n)
            else {
                const vspm = durationMin > 0 ? (p.visionScore || 0) / durationMin : 0;
                if (kp >= 0.50 && vspm >= 1.5) isPillar = true;
            }
        }

        if (isPillar) {
            total = safeAdd(total, 1.0, "El Pilar", notes);
            notes.push("Ã°Å¸ÂÂ¯ El Pilar (KDA sÃƒÂ³lido en derrota)");
        }

        // --- ESTRUCTURAS DE EQUIPO (Torres e Inhibidores) ---
        const teamtowers = teamInfo?.towerCount || 0;
        const teamInhibs = teamInfo?.inhibitorCount || 0; // <-- 1. Renombrado a teamInhibs

        // CÃƒÂ¡lculo: 0.1 por Torre / 0.25 por Inhibidor
        let teamstructurePoints = (teamtowers * 0.1) + (teamInhibs * 0.25); // <-- 2. Actualizado aquÃƒÂ­

        if (teamstructurePoints > 0) {
            // 1. PUNTOS SILENCIOSOS: Se suman siempre al total
            total = safeAdd(total, teamstructurePoints);

            // 2. ETIQUETA SOLO EN STOMP:
            // Solo imprimimos si tirasteis 9+ Torres (casi todas) O 2+ Inhibidores
            if (teamtowers >= 9 || teamInhibs >= 2) { // <-- 3. Actualizado aquÃƒÂ­
                notes.push(`Ã°Å¸Ââ€”Ã¯Â¸Â DemoliciÃƒÂ³n Total (${teamtowers}T / ${teamInhibs}I)`); // <-- 4. Actualizado aquÃƒÂ­
            }
        }

        // =========================================================
        // Ã°Å¸Å½â€“Ã¯Â¸Â SISTEMA DE MVP / SVP V5.0 (Rendimiento Relativo de Equipo)
        // Funciona tanto para Victorias como para Derrotas
        // =========================================================
      } // <--- Esta llave cierra el bloque if(!isWin) anterior de mitigaciones. NO LA BORRES.

      // 1. PREPARACIÃƒâ€œN DE DATOS DE EQUIPO
      const myTeamStats = participants.filter(pt => pt.teamId === p.teamId);
      
      // FIX: CÃƒÂ¡lculo real y seguro de las stats globales de tu equipo
      const teamTotalKillsLocal = myTeamStats.reduce((acc, pt) => acc + (Number(pt.kills) || 0), 0) || 1;
      const teamTotalDmgLocal = myTeamStats.reduce((acc, pt) => acc + (Number(pt.totalDamageDealtToChampions) || 0), 0) || 1;

      // 2. FUNCIÃƒâ€œN DE PUNTUACIÃƒâ€œN DE IMPACTO (El Algoritmo MultilÃƒÂ­nea)
      const calculateAdaptiveScore = (pt) => {
          const pRole = String(pt.teamPosition || "").toUpperCase();
          
          // Stats Base
          const pK = Number(pt.kills || 0);
          const pD = Number(pt.deaths || 0);
          const pA = Number(pt.assists || 0);
          const pDmg = Number(pt.totalDamageDealtToChampions || 0);
          const pGold = Number(pt.goldEarned || 0);
          const pVis = Number(pt.visionScore || 0);
          
          // Stats Avanzadas (El secreto para balancear los roles)
          const pObjDmg = Number(pt.damageDealtToObjectives || 0);
          const pTurretDmg = Number(pt.damageDealtToBuildings || 0);
          const pMitigated = Number(pt.damageSelfMitigated || 0);
          const pHealShield = Number(pt.totalHeal || 0) + Number(pt.totalDamageShieldedOnTeammates || 0);
          const pCC = Number(pt.timeCCingOthers || 0);
          
          // Ratios
          const pKDA = (pK + pA) / Math.max(1, pD);
          const pKP = (pK + pA) / Math.max(1, teamTotalKillsLocal);
          const pDmgShare = pDmg / teamTotalDmgLocal;
          
          // Base Universal: El KDA y la participaciÃƒÂ³n siempre importan, morir siempre resta.
          let finalScore = (pKDA * 10) + (pKP * 100) - (pD * 5);

          // Escalado EspecÃƒÂ­fico por Rol (Equilibrado para un mÃƒÂ¡ximo teÃƒÂ³rico de ~400-450 pts)
          if (pRole === "UTILITY" || pRole === "SUPPORT") {
              finalScore += (pVis * 2.5) + (pHealShield / 150) + (pCC * 1.5);
          } 
          else if (pRole === "JUNGLE") {
              finalScore += (pObjDmg / 80) + (pVis * 1.0) + (pDmgShare * 100) + (pCC * 1.0);
          }
          else if (pRole === "TOP") {
              finalScore += (pMitigated / 300) + (pTurretDmg / 50) + (pDmgShare * 120) + (pCC * 1.0);
          } 
          else {
              // MIDDLE y BOTTOM (Carries puros)
              finalScore += (pDmg / 150) + (pGold / 120) + (pDmgShare * 150);
          }

          return finalScore;
      };

      // 3. ENCONTRAR AL LÃƒÂDER Y AL SEGUNDO
      let myScore = 0;
      let allScores = [];

      myTeamStats.forEach(mate => {
          const score = calculateAdaptiveScore(mate);
          allScores.push(score);
          if (mate.puuid === p.puuid) {
              myScore = score;
          }
      });

      // Ordenamos los scores de mayor a menor para encontrar la diferencia
      allScores.sort((a, b) => b - a);
      const maxTeamScore = allScores[0];
      const secondBestScore = allScores.length > 1 ? allScores[1] : 0;

      // 4. VERIFICACIÃƒâ€œN: Ã‚Â¿SOY EL MEJOR?
      const amITtheBest = myScore >= maxTeamScore;

      // 5. FILTROS DE DIGNIDAD (No puedes ser MVP si fedeaste o te escondiste)
      const maxDeathsAllowed = Math.max(7, durationMin / 4); 
      const disqualified = (kda < 2.0) || (d > maxDeathsAllowed) || (kp < 0.50);

      // 6. CÃƒÂLCULO PROGRESIVO Y APLICACIÃƒâ€œN
      if (amITtheBest && !disqualified) {
          
          // FÃƒâ€œRMULA PROGRESIVA: Diferencia entre tÃƒÂº y el 2Ã‚Âº mejor jugador de tu equipo.
          const scoreGap = myScore - secondBestScore;
          
          // Generamos una etiqueta dinÃƒÂ¡mica segÃƒÂºn el rol para el log
          let mvpReason = "";
          if (isSupport) {
              mvpReason = `(VisiÃƒÂ³n ${vs} | KP ${(kp*100).toFixed(0)}%)`;
          } else if (isJungle) {
              const objK = (Number(p.damageDealtToObjectives || 0) / 1000).toFixed(1);
              mvpReason = `(Objs ${objK}k | KP ${(kp*100).toFixed(0)}%)`;
          } else if (role === 'TOP') {
              const tankK = (Number(p.damageSelfMitigated || 0) / 1000).toFixed(1);
              mvpReason = `(DaÃƒÂ±o ${(damage/1000).toFixed(1)}k | Tanqueo ${tankK}k)`;
          } else {
              const dmgPct = (damage / Math.max(1, teamTotalDmgLocal)) * 100;
              mvpReason = `(DaÃƒÂ±o ${dmgPct.toFixed(0)}% | KDA ${kda.toFixed(1)})`;
          }

          if (isWin) {
              // Ã°Å¸Å’Å¸ MVP DE LA VICTORIA (Premio por Carrilear)
              // Baseline: +1.0 pts por ser el mejor. Sube +0.035 pts por cada punto de gap con el segundo.
              let mvpPts = 1.0 + (scoreGap * 0.035);
              mvpPts = Math.max(1.0, Math.min(2.0, mvpPts)); // Cap mÃƒÂ¡ximo de +4.0
              mvpPts = parseFloat(mvpPts.toFixed(2));
              
              total = safeAdd(total, mvpPts, "MVP Bonus", notes);
              notes.push(`Ã°Å¸Å’Å¸ MVP de la Partida ${mvpReason} (+${mvpPts} pts)`);
              
          } else {
              // Ã°Å¸Å½â€“Ã¯Â¸Â MVP DEL PERDEDOR (Consuelo)
              // Baseline: +1.0 pts. Sube +0.025 pts por gap.
              let svpPts = 1.0 + (scoreGap * 0.025);
              svpPts = Math.max(0.5, Math.min(3.5, svpPts)); // Cap de +3.5
              svpPts = parseFloat(svpPts.toFixed(2));

              total = safeAdd(total, svpPts, "SVP Bonus", notes);
              notes.push(`Ã°Å¸Å½â€“Ã¯Â¸Â MVP del Perdedor ${mvpReason} (+${svpPts} pts)`);
          }
      }

    // =====================================================
    // BONUS: LANER HERO (El Roba-Objetivos: Nashor y Dragones)
    // =====================================================
    if (!isJungle) { // Solo aplica a TOP, MID, BOTTOM, SUPPORT

        // Variables de conteo
        const stolenCount = Number(p.challenges?.epicMonstersStolen || 0);
        const baronKills = Number(p.baronKills || 0);
        const dragonKills = Number(p.dragonKills || 0); // Ã‚Â¡NUEVO!

        // 1. ROBO Ãƒâ€°PICO CERTIFICADO (La mÃƒÂ©trica oficial de "Robo")
        // Ocurre cuando el enemigo hizo la mayor parte del daÃƒÂ±o y tÃƒÂº lo rematas.
        if (stolenCount > 0) {
             // Ã‚Â¡Premio gordo! Por defecto 5.0 puntos por cada robo.
             const stealPts = (cfg.laner_steal_points || 5.0) * stolenCount;
             total = safeAdd(total, stealPts, "Laner Steal", notes);
             notes.push(`Ã¢Å“â€¹Ã°Å¸Â¥Â¶ Ã‚Â¡LANER STEAL! (x${stolenCount} robos ÃƒÂ©picos)`);
        }

        // 2. ASEGURAR NASHOR (Clutch)
        // Si mataste al BarÃƒÂ³n y NO contÃƒÂ³ como robo (stolenCount < baronKills),
        // significa que lo aseguraste tÃƒÂº (tu jungla fallÃƒÂ³ o no estaba).
        if (baronKills > 0) {
             // Si tenemos mÃƒÂ¡s kills de barÃƒÂ³n que robos registrados, premiamos la diferencia
             const securedBarons = Math.max(0, baronKills - stolenCount);
             
             if (securedBarons > 0) {
                 const baronPts = securedBarons * 2.0; 
                 total = safeAdd(total, baronPts, "Laner Nashor", notes);
                 notes.push(`Ã°Å¸Å½Â¯ Laner asegurÃƒÂ³ Nashor (x${securedBarons})`);
             }
        }

        // 3. ASEGURAR DRAGÃƒâ€œN (Nuevo)
        // Igual que el BarÃƒÂ³n, pero con Dragones.
        if (dragonKills > 0) {
             // Calculamos cuÃƒÂ¡ntos dragones aseguraste que NO fueron robos oficiales
             // (Asumimos que los robos de 'stolenCount' priorizan Barones, es una estimaciÃƒÂ³n segura)
             const securedDragons = Math.max(0, dragonKills - Math.max(0, stolenCount - baronKills));

             if (securedDragons > 0) {
                 const dragPts = securedDragons * 0.5; // 1 punto por dragÃƒÂ³n asegurado siendo Laner
                 total = safeAdd(total, dragPts, "Laner Dragon", notes);
                 notes.push(`Ã°Å¸Â¦Å½ Laner asegurÃƒÂ³ DragÃƒÂ³n (x${securedDragons})`);
             }
        }
    }

    // --- Ã‚Â¡NUEVO! CÃƒÂLCULO PREVIO DE MITIGACIÃƒâ€œN JG DIFF ---
    // (Se calcula aquÃƒÂ­ para poder usarlo en la penalizaciÃƒÂ³n de "Fugitivo de Objetivos")
    let willReceiveJgMitigation = false; // Variable de control
    if (!p.win && durationMin >= 15 && !isJungle) {
        
        const myObjScore = (teamInfo.dragonsCount || 0) + 
                           (teamInfo.baronCount || 0) + 
                           (teamInfo.heraldCount || 0) + 
                           ((teamInfo.hordeCount || 0) / 3); 

        if (myObjScore < 1) {
            const enObjScore = (teamInfo.enemyDragons || 0) + 
                               (teamInfo.enemyBarons || 0) + 
                               (teamInfo.enemyHeralds || 0) + 
                               ((teamInfo.enemyHorde || 0) / 3);
            
            if (enObjScore - myObjScore >= 2) {
                willReceiveJgMitigation = true; // Ã‚Â¡Se cumple la condiciÃƒÂ³n!
            }
        }
    }

    // =====================================================
    // --- PENALIZACIÃƒâ€œN: STOMPEADO V4.0 (Lane Gap Progresivo) ---
    // =====================================================
    // Solo Laners (Top, Mid, Bot). 
    if (isLaner) {
        const laneDeficit = Number(p.challenges?.earlyLaningPhaseGoldExpAdvantage || 0);
        
        // 1. BASELINE: Empezamos a considerar desventaja grave a partir de -1000 de Oro/XP.
        if (laneDeficit < -1000) {
            
            // 2. FÃƒâ€œRMULA PROGRESIVA: Por cada 1 de dÃƒÂ©ficit extra, restamos -0.0015 puntos.
            // Ej: -1500 -> (1500 - 1000) * -0.0015 = -0.75 pts (Muy similar a tu antiguo -1.0)
            // Ej: -2500 -> (2500 - 1000) * -0.0015 = -2.25 pts (Muy similar a tu antiguo -2.0)
            // Ej: -3500 -> (3500 - 1000) * -0.0015 = -3.75 pts (Castiga mÃƒÂ¡s si el feed fue brutal)
            const deficitAmount = Math.abs(laneDeficit);
            let gapPenalty = -((deficitAmount - 1000) * 0.0015);
            
            // Cap de seguridad mÃƒÂ¡ximo (-4.0)
            gapPenalty = Math.max(-4.0, gapPenalty);

            // Solo aplicamos y etiquetamos si el castigo es notable (<= -0.75)
            if (gapPenalty <= -0.75) {
                // 3. ETIQUETAS ORIGINALES
                let label = "Ã°Å¸Â¤â€¢ Gap en LÃƒÂ­nea";
                if (laneDeficit <= -2500) {
                    label = "Ã°Å¸ÂÂ³Ã¯Â¸Â Stompeado en LÃƒÂ­nea";
                }
                
                gapPenalty = parseFloat(gapPenalty.toFixed(2));
                total = safeAdd(total, gapPenalty);
                notes.push(`${label} (${laneDeficit.toFixed(0)} desventaja, ${gapPenalty} pts)`);
            }
        }
    }

    // =====================================================
    // --- PENALIZACIÃƒâ€œN: CARRY DE ADORNO V4.1 (Bajo Impacto Progresivo) ---
    // =====================================================
    if (["MIDDLE", "BOTTOM", "JUNGLE", "TOP"].includes(role) && durationMin > 20) {
        
        const dmgShare = p.challenges?.teamDamagePercentage || 0;
        
        // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX: Lista oficial de tanques que no tienen por quÃƒÂ© hacer daÃƒÂ±o
        const pureTanks = ["Shen", "Ornn", "Sion", "Maokai", "Malphite", "Dr. Mundo", "Cho'Gath", "Tahm Kench", "Rammus", "Zac", "Sejuani", "Nautilus", "Leona", "Braum", "Alistar", "Taric", "Rell", "Galio", "Amumu", "Nunu", "Poppy", "Skarner"];

        // EXCEPCIÃƒâ€œN: Es un tanque de la lista, o mitigÃƒÂ³ una barbaridad (>35k), o es un rol de tanque que absorbiÃƒÂ³ mucho daÃƒÂ±o.
        const isTankyStats = isRealTank || (p.damageSelfMitigated > 35000) || pureTanks.includes(p.championName);

        if (!isTankyStats) { 
            // 1. BASELINE: Siendo Carry/Bruiser, hacer menos del 17% (0.17) del daÃƒÂ±o empieza a ser deficiente.
            const baseDmgShare = 0.17;
            
            if (dmgShare < baseDmgShare) {
                // 2. FÃƒâ€œRMULA PROGRESIVA: Restas -0.35 pts por cada 1% que te falte
                let carryPenalty = -((baseDmgShare - dmgShare) * 35.0);
                
                // Cap de seguridad (Max -5.0 pts por no pegar nada)
                carryPenalty = Math.max(-5.0, carryPenalty);

                // Aplicar solo si es relevante
                if (carryPenalty <= -0.5) {
                    let label = "Ã°Å¸â€œâ€° Bajo Impacto";
                    if (dmgShare < 0.11) { // Menos del 11% ya es Fantasma
                        label = "Ã°Å¸â€˜Â» Carry Fantasma";
                    }

                    carryPenalty = parseFloat(carryPenalty.toFixed(2));
                    total = safeAdd(total, carryPenalty);
                    notes.push(`${label} (${(dmgShare*100).toFixed(1)}% daÃƒÂ±o, ${carryPenalty} pts)`);
                }
            }
        }
    }

    // =====================================================
    // Ã¢Å¡â€Ã¯Â¸Â BONO DE DUELO v5.2 (EL ALGORITMO DEFINITIVO + EARLY GAME)
    // EvaluaciÃƒÂ³n Integral y AsimÃƒÂ©trica por Rol
    // =====================================================
    if (opponent && durationMin >= 15) { 
        let duelScore = 0; 
        let duelNotes = []; 
        let dominanceCount = 0; 
        let keyRoleDominance = false; 

        const o_k = Number(opponent.kills || 0);
        const o_d = Number(opponent.deaths || 0);
        const o_a = Number(opponent.assists || 0);
        const o_kda = (o_k + o_a) / Math.max(1, o_d);
        
        // --- 1. SOLO KILLS (La humillaciÃƒÂ³n mÃƒÂ¡xima) ---
        const mySolo = p.challenges?.soloKills || 0;
        const oppSolo = opponent.challenges?.soloKills || 0;
        const soloDiff = mySolo - oppSolo;
        
        if (soloDiff > 0) { 
            duelScore += Math.min(2.5, soloDiff * 1.25); 
            duelNotes.push(`SoloKill (+${soloDiff})`); 
            dominanceCount++;
            if(isLaner || isJungle) keyRoleDominance = true; 
        } else if (soloDiff < 0) {
            duelScore -= Math.min(2.5, Math.abs(soloDiff * 1.25));
            if (!duelNotes.includes("SoloKill")) duelNotes.push("SoloKill");
        }

        // --- 2. IMPACTO EN EL MAPA LATE GAME (Roam Kills) ---
        const myRoam = p.challenges?.roamKills || 0;
        const oppRoam = opponent.challenges?.roamKills || 0;
        const roamDiff = myRoam - oppRoam;

        if (roamDiff > 0) {
            duelScore += Math.min(1.5, roamDiff * 0.75);
            duelNotes.push(`Roam`);
            dominanceCount++;
            if (role === 'MIDDLE' || isSupport) keyRoleDominance = true;
        } else if (roamDiff < 0) {
            duelScore -= Math.min(1.5, Math.abs(roamDiff * 0.75));
            if (!duelNotes.includes("Roam")) duelNotes.push("Roam");
        }

        // --- 3. DOMINIO ECONÃƒâ€œMICO FINAL (Oro Total) ---
        const laneGoldDiff = (p.goldEarned||0) - (opponent.goldEarned||0);
        const goldThresh = isSupport ? 400 : 700; 
        
        if (laneGoldDiff > goldThresh) { 
            duelScore += Math.min(1.5, laneGoldDiff / 1000); 
            duelNotes.push("Oro Fin"); 
            dominanceCount++; 
            if (role === 'BOTTOM') keyRoleDominance = true; 
        } else if (laneGoldDiff < -goldThresh) { 
            duelScore -= Math.min(1.5, Math.abs(laneGoldDiff / 1000)); 
            if (!duelNotes.includes("Oro")) duelNotes.push("Oro");
        }

        // --- 4. TRADE GAP (Eficacia de Combate) ---
        const isEnchanter = ["Lulu", "Nami", "Janna", "Soraka", "Milio", "Yuumi", "Sona", "Karma", "Seraphine"].includes(p.championName);
        
        if (!isSupport || (isSupport && !isEnchanter)) {
            const myRatio = Number(p.totalDamageDealtToChampions || 0) / Math.max(1, Number(p.totalDamageTaken || 1));
            const oppRatio = Number(opponent.totalDamageDealtToChampions || 0) / Math.max(1, Number(opponent.totalDamageTaken || 1));
            const tradeDiff = myRatio - oppRatio;
            if (tradeDiff > 0.4) { 
                duelScore += Math.min(1.5, tradeDiff * 1.5); 
                duelNotes.push("Trades"); 
                dominanceCount++; 
            } else if (tradeDiff < -0.4) { 
                duelScore -= Math.min(1.5, Math.abs(tradeDiff * 1.5)); 
                if (!duelNotes.includes("Trades")) duelNotes.push("Trades");
            }
        } 
        else {
             const myUtil = Number(p.totalHeal || 0) + Number(p.totalDamageShieldedOnTeammates || 0);
             const oppUtil = Number(opponent.totalHeal || 0) + Number(opponent.totalDamageShieldedOnTeammates || 0);
             const utilDiff = myUtil - oppUtil;
             if (utilDiff > 3000) {
                 duelScore += Math.min(1.5, utilDiff / 3000);
                 duelNotes.push("Soporte");
                 dominanceCount++;
             } else if (utilDiff < -3000) {
                 duelScore -= Math.min(1.5, Math.abs(utilDiff / 3000));
                 if (!duelNotes.includes("Soporte")) duelNotes.push("Soporte");
             }
        }

        // --- 5. ESPECÃƒÂFICO DE LANERS (EARLY GAME + PLACAS + CS) ---
        if (isLaner) {
            
            // A. Ventaja Neta de LÃƒÂ­nea (Min 14)
            const earlyAdvantage = Number(p.challenges?.earlyLaningPhaseGoldExpAdvantage || 0);
            if (earlyAdvantage > 300) {
                let pts = (earlyAdvantage / 500) * 0.8; 
                duelScore += Math.min(2.5, pts); 
                duelNotes.push(`+${earlyAdvantage.toFixed(0)} Oro/XP Lead`);
                dominanceCount++;
                keyRoleDominance = true;
            } else if (earlyAdvantage < -300) {
                let pts = (Math.abs(earlyAdvantage) / 500) * 0.8;
                duelScore -= Math.min(2.5, pts);
                if (!duelNotes.includes("Oro Early")) duelNotes.push("Oro Early");
            }

            // B. DenegaciÃƒÂ³n de Nivel (Min 14)
            const myLvlLead = Number(p.challenges?.maxLevelLeadLaneOpponent || 0);
            const oppLvlLead = Number(opponent.challenges?.maxLevelLeadLaneOpponent || 0);
            if (myLvlLead >= 1) {
                duelScore += Math.min(1.5, myLvlLead * 0.75);
                duelNotes.push(`+${myLvlLead} Lvl Lead`);
                dominanceCount++;
                if (role === 'TOP') keyRoleDominance = true;
            } else if (oppLvlLead >= 1) {
                duelScore -= Math.min(1.5, oppLvlLead * 0.75);
                if (!duelNotes.includes("Nivel")) duelNotes.push("Nivel");
            }

            // C. Roaming Temprano (Ayudas pre-minuto 14)
            const myEarlyRoam = Number(p.challenges?.killsOnOtherLanesEarlyJungleAsLaner || 0);
            const oppEarlyRoam = Number(opponent.challenges?.killsOnOtherLanesEarlyJungleAsLaner || 0);
            const earlyRoamDiff = myEarlyRoam - oppEarlyRoam;
            if (earlyRoamDiff > 0) {
                duelScore += Math.min(1.5, earlyRoamDiff * 0.6);
                duelNotes.push(`Early Roam`);
                dominanceCount++;
                if (role === 'MIDDLE') keyRoleDominance = true;
            } else if (earlyRoamDiff < 0) {
                duelScore -= Math.min(1.5, Math.abs(earlyRoamDiff) * 0.6);
                if (!duelNotes.includes("Early Roam")) duelNotes.push("Early Roam");
            }

            // D. Placas de Torre
            const plateDiff = (p.challenges?.turretPlatesTaken || 0) - (opponent.challenges?.turretPlatesTaken || 0);
            if (plateDiff >= 2) { 
                duelScore += Math.min(1.0, plateDiff * 0.4); 
                duelNotes.push("Placas"); 
                dominanceCount++; 
            } else if (plateDiff <= -2) { 
                duelScore -= Math.min(1.0, Math.abs(plateDiff * 0.4)); 
                if (!duelNotes.includes("Placas")) duelNotes.push("Placas");
            }

            // E. CS Gap Temprano
            const myMaxCsLead = Number(p.challenges?.maxCsAdvantageOnLaneOpponent || 0);
            const oppMaxCsLead = Number(opponent.challenges?.maxCsAdvantageOnLaneOpponent || 0);
            if (myMaxCsLead > 15) {
                duelScore += Math.min(1.5, myMaxCsLead * 0.04);
                duelNotes.push(`+${myMaxCsLead.toFixed(0)} CS Lead`); 
                dominanceCount++;
            } else if (oppMaxCsLead > 15) {
                duelScore -= Math.min(1.5, oppMaxCsLead * 0.04);
                if (!duelNotes.includes("CS")) duelNotes.push("CS");
            }
        }

        // --- 6. ESPECÃƒÂFICO DE JUNGLA (El Rey del Bosque) ---
        if (isJungle) {
            // A. Presencia en Mapa (Ganks / KP)
            const myKP = (p.challenges?.killParticipation || 0);
            const oppKP = (opponent.challenges?.killParticipation || 0);
            const kpDiff = myKP - oppKP;
            if (kpDiff > 0.15) { 
                duelScore += Math.min(2.0, kpDiff * 6.0); 
                duelNotes.push("Ganks"); 
                dominanceCount++; 
                keyRoleDominance = true; 
            } else if (kpDiff < -0.15) { 
                duelScore -= Math.min(2.0, Math.abs(kpDiff * 6.0)); 
                if (!duelNotes.includes("Ganks")) duelNotes.push("Ganks");
            }

            // B. Control de Objetivos Ãƒâ€°picos y Robos (Smite Gap)
            const myObjs = (p.dragonKills||0) + (p.baronKills||0) + (p.riftHeraldKills||0);
            const oppObjs = (opponent.dragonKills||0) + (opponent.baronKills||0) + (opponent.riftHeraldKills||0);
            const mySteals = p.challenges?.epicMonstersStolen || 0;
            const oppSteals = opponent.challenges?.epicMonstersStolen || 0;
            const objDiff = myObjs - oppObjs; 
            
            const myObjDmg = Number(p.damageDealtToObjectives || 0);
            const oppObjDmg = Number(opponent.damageDealtToObjectives || 0);
            const objDmgDiff = myObjDmg - oppObjDmg;

            if (objDiff > 0 || objDmgDiff > 8000) { 
                duelScore += Math.min(2.5, Math.max(objDiff * 1.25, objDmgDiff / 8000)); 
                if(!duelNotes.includes("Objs")) duelNotes.push("Objs"); 
                dominanceCount++; 
                keyRoleDominance = true;
            } else if (objDiff < 0 || objDmgDiff < -8000) { 
                duelScore -= Math.min(2.5, Math.max(Math.abs(objDiff * 1.25), Math.abs(objDmgDiff / 8000))); 
                if(!duelNotes.includes("Objs")) duelNotes.push("Objs");
            }

            // Si le robaste monstruos ÃƒÂ©picos directamente
            if (mySteals > oppSteals) {
                duelScore += 1.5 * (mySteals - oppSteals);
                duelNotes.push("Smite Gap");
                dominanceCount++;
            } else if (oppSteals > mySteals) {
                duelScore -= 1.5 * (oppSteals - mySteals);
                if (!duelNotes.includes("Smite Gap")) duelNotes.push("Smite Gap");
            }

            // C. Pathing y Farm (CS Neutral)
            const myJgCS = p.neutralMinionsKilled || 0;
            const oppJgCS = opponent.neutralMinionsKilled || 0;
            const jgCsDiff = myJgCS - oppJgCS;
            
            if (jgCsDiff > 30) {
                duelScore += Math.min(1.5, jgCsDiff / 40);
                duelNotes.push("Farm");
                dominanceCount++;
            } else if (jgCsDiff < -30) {
                duelScore -= Math.min(1.5, Math.abs(jgCsDiff / 40));
                if (!duelNotes.includes("Farm")) duelNotes.push("Farm");
            }

            // D. Dominio Territorial (Counter Jungling)
            const myInvade = p.challenges?.enemyJungleMonsterKills || 0;
            const oppInvade = opponent.challenges?.enemyJungleMonsterKills || 0;
            const invadeDiff = myInvade - oppInvade;
            
            if (invadeDiff > 12) { 
                duelScore += Math.min(1.5, invadeDiff / 15);
                duelNotes.push("Invades");
                dominanceCount++;
            } else if (invadeDiff < -12) {
                duelScore -= Math.min(1.5, Math.abs(invadeDiff / 15));
                if (!duelNotes.includes("Invades")) duelNotes.push("Invades");
            }

            // E. VisiÃƒÂ³n en Jungla
            const myVis = p.visionScore || 0;
            const oppVis = opponent.visionScore || 0;
            const visDiff = myVis - oppVis;
            if (visDiff > 20) {
                duelScore += Math.min(1.0, visDiff / 25);
                if(!duelNotes.includes("VisiÃƒÂ³n")) duelNotes.push("VisiÃƒÂ³n");
            } else if (visDiff < -20) {
                duelScore -= Math.min(1.0, Math.abs(visDiff / 25));
                if (!duelNotes.includes("VisiÃƒÂ³n")) duelNotes.push("VisiÃƒÂ³n");
            }
        }

        // --- 7. ESPECÃƒÂFICO DE SUPPORTS (Guerra de VisiÃƒÂ³n) ---
        if (isSupport) {
            const myVis = (p.visionScore || 0) + (p.wardsKilled || 0);
            const oppVis = (opponent.visionScore || 0) + (opponent.wardsKilled || 0);
            const visDiff = myVis - oppVis;
            if (visDiff > 15) { 
                duelScore += Math.min(2.0, visDiff / 10); 
                duelNotes.push("VisiÃƒÂ³n"); 
                dominanceCount++; 
                keyRoleDominance = true;
            } else if (visDiff < -15) { 
                duelScore -= Math.min(2.0, Math.abs(visDiff / 10)); 
                if (!duelNotes.includes("VisiÃƒÂ³n")) duelNotes.push("VisiÃƒÂ³n");
            }
        }

        // --- 8. DESEMPATE FINAL (KDA GLOBAL) ---
        if (kda > (o_kda * 1.5) && kda > 2.5) { 
            duelScore += 1.5; 
            if(!duelNotes.includes("KDA")) duelNotes.push("KDA"); 
            dominanceCount++;
        } else if (o_kda > (kda * 1.5) && o_kda > 2.5) { 
            duelScore -= 1.5; 
            if (!duelNotes.includes("KDA")) duelNotes.push("KDA");
        }

        // --- 9. EVALUACIÃƒâ€œN Y APLICACIÃƒâ€œN FINAL ---
        const reason = duelNotes.length > 0 ? `(${duelNotes.join(", ")})` : "";
        duelScore = Math.min(8.0, Math.max(-8.0, duelScore)); 
        
        const kingThreshold = (isSupport || isJungle) ? 5.0 : 5.0; 
        const isKing = (duelScore >= kingThreshold) || (duelScore >= 3.5 && dominanceCount >= 4 && keyRoleDominance);

        if (isKing) {
            let finalScore = parseFloat((duelScore + 1.0).toFixed(2));
            applyBonus(`Ã°Å¸â€˜â€˜ REY DE LA LÃƒÂNEA ${reason}`, Math.min(8.0, finalScore));
        } else if (duelScore >= 1.5) {
            applyBonus(`Ã¢Å¡â€Ã¯Â¸Â Duelo Ganado ${reason}`, parseFloat(duelScore.toFixed(2)));
        } else if (duelScore <= -1.5) {
            const isProtected = willReceiveJgMitigation || notes.some(n => n.includes("MitigaciÃƒÂ³n") || n.includes("AFK") || n.includes("Camp"));
            if (!isProtected) {
                 let penaltyScore = duelScore < -4.0 ? (duelScore - 1.0) : duelScore;
                 // Mantenemos el applyBonus para que la lÃƒÂ³gica lo guarde y reste los puntos
                 applyBonus(`Ã°Å¸Â¤â€¢ Duelo Perdido ${reason}`, parseFloat(Math.max(-8.0, penaltyScore).toFixed(2)));
            } else {
                 notes.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â Duelo Protegido (MitigaciÃƒÂ³n Activa)`);
            }
        }
    }

// ==========================================================
// Ã°Å¸â€ºÂ¡Ã¯Â¸Â PROTECCIONES CONTRA EQUIPO (ATLAS & ELO HELL V4.1 - ANTI TROLL)
// ==========================================================
if (!isWin && durationMin >= 15) {

    // 1. PREPARACIÃƒâ€œN DE DATOS
    const teamMates = myTeam.filter(m => m.puuid !== p.puuid);
    const teamTotalDmg = myTeam.reduce((acc, m) => acc + (m.totalDamageDealtToChampions || 0), 0);
    const teamTotalKills = teamInfo.totalKills || 1; // Evitar divisiÃƒÂ³n por cero

    let heavyTeammates = 0;   // Feeders o Trolls (Carga completa = 1.0)
    let uselessTeammates = 0; // Fantasmas inofensivos (Media carga = 0.5)
    let decentTeammates = 0;  // Jugadores funcionales

    teamMates.forEach(mate => {
        const mD = Number(mate.deaths || 0);
        const mK = Number(mate.kills || 0);
        const mA = Number(mate.assists || 0);
        const mDmg = Number(mate.totalDamageDealtToChampions || 0);
        const mTurretDmg = Number(mate.damageDealtToTurrets || 0);
        
        const mKDA = (mK + mA) / Math.max(1, mD);
        const mDPM = durationMin > 0 ? mD / durationMin : 0; 
        const mKP = teamTotalKills > 0 ? (mK + mA) / teamTotalKills : 0;
        const mDmgShare = teamTotalDmg > 0 ? mDmg / teamTotalDmg : 0;

        // --- A. CRITERIO DE "ANCLA" (Feeder / Troll) ---
        // 1. Feeder RÃƒÂ¡pido: Muere mucho (>0.27/min) y KDA bajo (<1.2). [Ajustado para Ryze]
        const isFastFeeder = (mDPM >= 0.25 && mKDA < 1.2);
        
        // 2. Feeder Absoluto: Muere 9+ veces y KDA bajo (<1.3).
        const isHardFeeder = (mD >= 9 && mKDA < 1.3);
        
        // 3. El "0 impacto" (K'Sante 0/4/0): 
        //    - Pocas kills (<=1)
        //    - Muertes significativas (>=4)
        //    - Casi nula asistencia (<=1) o KP muy bajo (<15%)
        const isUselessFeeder = (mK <= 1 && mD >= 4 && (mA <= 1 || mKP < 0.15));

        if (isFastFeeder || isHardFeeder || isUselessFeeder) {
            heavyTeammates++;
        }
        
        // --- B. CRITERIO DE "FANTASMA" (InÃƒÂºtil / AFK Farm) ---
        // Baja participaciÃƒÂ³n (<30%) Y Bajo daÃƒÂ±o (<14%)
        else if (mKP < 0.30 && mDmgShare < 0.14) {
            
            // EXCEPCIÃƒâ€œN: Splitpusher Real
            if (mTurretDmg > 8000) {
                decentTeammates++; 
            } 
            // NUEVO: Si eres Fantasma pero has muerto 5+ veces, eres un Lastre
            else if (mD >= 5) {
                heavyTeammates++; 
            }
            else {
                uselessTeammates++; 
            }
        }
        
        // --- C. JUGADOR FUNCIONAL ---
        else {
            decentTeammates++;
        }
    });

    // Calculamos la "Carga" del equipo
    const teamLoad = heavyTeammates + (uselessTeammates * 0.5);

    // =========================================================
    // Ã°Å¸Ââ€¦ ASIGNACIÃƒâ€œN DE PUNTOS
    // =========================================================

    // --- REQUISITO BASE: TÃƒÂº no fuiste el problema ---
    const myDmgShare = teamTotalDmg > 0 ? (p.totalDamageDealtToChampions || 0) / teamTotalDmg : 0;
    const amINotTheProblem = (kda >= 1.5) || (myDmgShare > 0.25 && kda > 1.2);

    if (teamLoad >= 1.0 && amINotTheProblem) {
        
        // TIER 3: ESPÃƒÂRITU ESPARTANO (Carga >= 3.0)
        if (teamLoad >= 3.0) {
             total = safeAdd(total, 3.5, "Spartan Spirit", notes);
             notes.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â EspÃƒÂ­ritu Espartano (Team Gap Extremo: Carga ${teamLoad})`);
        } 
        // TIER 2: ELO HELL (Carga >= 2.0)
        else if (teamLoad >= 2.0) {
             total = safeAdd(total, 2.5, "Elo Hell", notes);
             notes.push(`Ã°Å¸â€Â¥ Elo Hell (Team Gap Alto: Carga ${teamLoad})`);
        }
        // TIER 1: EL ANCLA (Carga >= 1.0)
        else {
             total = safeAdd(total, 1.5, "Heavy Anchor", notes);
             notes.push(`Ã¢Å¡â€œ El Ancla (MitigaciÃƒÂ³n: ${heavyTeammates} lastres detectados)`);
        }
    }

    // --- NIVEL 2: TITÃƒÂN ATLAS (Solo Carry) ---
    const isWorthyCarry = (kda >= 2.5) || (myDmgShare >= 0.28 && kda >= 2.0);

    if (decentTeammates === 0 && isWorthyCarry) {
         total = safeAdd(total, 5.0, "Titan Atlas", notes);
         notes.push("Ã°Å¸Å’Â TITÃƒÂN ATLAS (1v9 Absoluto)");
    }}

    
    // =====================================================
    // Ã°Å¸â€Âª JUSTICIERO V4.0 (Cortar Rachas Progresivo)
    // =====================================================
    // Variable: challenges.shutdownsCollected
    // Premia cortar la diversiÃƒÂ³n del rival (Bounties).
    
    const shutdowns = Number(p.challenges?.shutdownsCollected || 0);
    
    if (shutdowns >= 1) {
        // FÃƒâ€œRMULA PROGRESIVA: Cada shutdown otorga +0.45 puntos constantes.
        // 1 = +0.45 pts | 2 = +0.90 pts | 3 = +1.35 pts | 5 = +2.25 pts
        let shutdownPts = shutdowns * 0.45;
        
        let label = "Ã°Å¸â€Âª Justiciero";
        if (shutdowns >= 3) {
            label = "Ã°Å¸â€˜Â® POLICÃƒÂA DE LA DIVERSIÃƒâ€œN";
        }

        // Redondeo limpio
        shutdownPts = parseFloat(shutdownPts.toFixed(2));
        
        // Sumamos los puntos y aÃƒÂ±adimos la nota
        total = safeAdd(total, shutdownPts);
        notes.push(`${label} (${shutdowns} rachas cortadas, +${shutdownPts} pts)`);
    }

    // =========================================================
    // Ã¢Å¡â€Ã¯Â¸Â DUELISTA V4.0 (Solo Kills Progresivo)
    // =========================================================
    const soloKills = Number(p.challenges?.soloKills || 0);

    // Umbral mÃƒÂ­nimo para empezar a puntuar
    if (soloKills >= 3) {
        
        // FÃƒâ€œRMULA PROGRESIVA MÃƒÂGICA: (soloKills - 2) * 0.55
        // Con esto logramos exactamente tus antiguos escalones pero sin saltos bruscos:
        // 3 kills -> (3 - 2) * 0.55 = +0.55 pts
        // 5 kills -> (5 - 2) * 0.55 = +1.65 pts  (Tu antiguo tier daba 1.75)
        // 7 kills -> (7 - 2) * 0.55 = +2.75 pts  (Tu antiguo tier daba 2.75 Ã‚Â¡Exacto!)
        // 10 kills -> (10 - 2) * 0.55 = +4.40 pts (Tu antiguo tier daba 4.50)
        let duelPoints = (soloKills - 2) * 0.55;
        
        // Cap de seguridad por si alguien hace 25 solo kills
        duelPoints = Math.max(0, Math.min(6.0, duelPoints));

        // MANTENEMOS TODAS TUS ETIQUETAS ORIGINALES
        let duelLabel = "Ã¢Å¡â€Ã¯Â¸Â Duelista";
        if (soloKills >= 10) {
            duelLabel = "Ã°Å¸â€™â‚¬ 1v9 MACHINE";
        } 
        else if (soloKills >= 7) {
            duelLabel = "Ã°Å¸ÂÅ¸Ã¯Â¸Â Rey de la Arena";
        } 
        else if (soloKills >= 5) {
            duelLabel = "Ã°Å¸Â¤Âº Maestro del 1v1";
        }

        duelPoints = parseFloat(duelPoints.toFixed(2));
        applyBonus(`${duelLabel} (${soloKills} kills)`, duelPoints);
    }


Ã‚Â  Ã‚Â  // =====================================================
    // 2. RENDIMIENTO INDIVIDUAL (KDA Proporcional) - ANTI KDA PLAYER
    // =====================================================
    const kdaText = kda.toFixed(2);
    let kdaBonus = 0;
    let kdaLabel = "";

    // Ajuste por Rol: A los Supports se les exige un poco mÃƒÂ¡s de KDA base
    const baseKDA = isSupport ? 3.0 : 2.2; 
    const lowKDA = isSupport ? 1.8 : 1.5;

    // A. KDA POSITIVO (Premios)
    if (kda > baseKDA) {
        
        // 1. CÃƒÂLCULO BASE (Curva de Rendimientos Decrecientes)
        // Usamos Math.sqrt (raÃƒÂ­z cuadrada) para que los primeros puntos sean valiosos, 
        // pero evite que KDAs inflados (ej. 25.0) rompan el mercado.
        // Ej: KDA 6.2 (Diff 4.0) -> sqrt(4.0) = 2.0 * 1.25 = +2.50 pts
        // Ej: KDA 11.2 (Diff 9.0) -> sqrt(9.0) = 3.0 * 1.25 = +3.75 pts
        let rawBonus = Math.sqrt(kda - baseKDA) * 1.25;

        // 2. Ã°Å¸â€ºÂ¡Ã¯Â¸Â FILTRO ANTI "KDA PLAYER" (Multiplicador de Impacto)
        // Tu KDA solo es valioso si te manchaste las manos.
        let impactMult = 1.0;
        const expectedKP = (role === "TOP") ? 0.35 : 0.45; // Al Top se le permite estar mÃƒÂ¡s aislado

        if (kp < expectedKP) {
            impactMult = Math.max(0.3, kp / expectedKP); 
        }

        // Ã°Å¸â€ºÂ Ã¯Â¸Â FIX: AÃƒÂ±adimos "!isRealTank" para no castigar a Shen, Sejuani, Zac...
        if (["MIDDLE", "BOTTOM", "JUNGLE"].includes(role) && dmgShare < 0.15 && !isRealTank) {
            impactMult *= 0.5; // Reducimos el premio a la mitad
        }

        // Aplicamos el filtro al bono real
        kdaBonus = rawBonus * impactMult;

        // Cap mÃƒÂ¡ximo de seguridad absoluto
        kdaBonus = Math.min(5.0, kdaBonus); 

        // 3. ETIQUETAS (LORE)
        if (kdaBonus >= 3.5) kdaLabel = `Ã°Å¸Â¦â€ž KDA DE DIOS`;
        else if (kdaBonus >= 2.0) kdaLabel = `Ã°Å¸â€™Å½ KDA Ãƒâ€°LITE`;
        else if (kdaBonus >= 1.0) kdaLabel = `Ã°Å¸Å’Å¸ KDA Excelente`;
        else kdaLabel = `Ã°Å¸â€˜Å’ KDA SÃƒÂ³lido`;
        
        // Ã°Å¸Å¡Â¨ SHAME TAG: Si el filtro de cobardÃƒÂ­a actuÃƒÂ³ duramente y tenÃƒÂ­as buen KDA...
        if (impactMult <= 0.65 && kda >= 4.5) {
             kdaLabel = `Ã°Å¸â€ºÂ¡Ã¯Â¸Â KDA Player (JugÃƒÂ³ a no morir)`; 
        }
    }
    
    // B. KDA NEGATIVO (Castigos)
    else if (kda < lowKDA) {
        // FÃƒÂ³rmula progresiva inversa: MÃƒÂ¡s te alejas del mÃƒÂ­nimo, mÃƒÂ¡s te quita.
        // Ej: KDA 0.5 (Se espera 1.5) -> (1.5 - 0.5) * 2.5 = -2.5 pts
        kdaBonus = -((lowKDA - kda) * 2.5);
        
        // Si eres un Feeder que encima NO ayuda en nada (KP < 20%), el castigo aumenta un 25%
        if (kp < 0.20 && durationMin > 15) kdaBonus *= 1.25;

        kdaBonus = Math.max(-4.0, kdaBonus); // Cap mÃƒÂ¡ximo de -4.0
        kdaLabel = `Ã°Å¸â€œâ€° KDA Deficiente`;
    }

    // APLICACIÃƒâ€œN FINAL
    if (kdaBonus !== 0) {
        kdaBonus = parseFloat(kdaBonus.toFixed(2));
        total = safeAdd(total, kdaBonus, "KDA Scaling", notes);
        notes.push(`${kdaLabel} (${kdaText}, ${kdaBonus > 0 ? '+' : ''}${kdaBonus} pts)`);
    }

    // =====================================================
    // Ã°Å¸Ââ€ºÃ¯Â¸Â DEFENSA NUMANTINA (Nexo al descubierto)
    // =====================================================
    const openNexus = Number(p.challenges?.hadOpenNexus || 0);
    
    if (p.win && openNexus >= 1) {
        // Ganar con el nexo al descubierto es el climax de League of Legends.
        // Multiplicamos esto si encima hiciste un daÃƒÂ±o bestial (Carry de Base)
        let numanciaPts = 3.5;
        
        if (dmgShare >= 0.30) numanciaPts += 1.5; // Fuiste tÃƒÂº quien defendiÃƒÂ³ la base
        
        total = safeAdd(total, numanciaPts, "Base Defense", notes);
        notes.push(`Ã°Å¸Ââ€ºÃ¯Â¸Â DEFENSA NUMANTINA (GanÃƒÂ³ con el Nexo a 1 HP, +${numanciaPts} pts)`);
    }

    // =====================================================
    // Ã°Å¸Â¦Â IMPACTO DE EARLY GAME (Heraldo / Grubs Perfectos)
    // =====================================================
    // Torres destruidas por completo ANTES de que caigan las placas (Min 14)
    const earlyTurrets = Number(p.challenges?.kTurretsDestroyedBeforePlatesFall || 0);

    if (earlyTurrets > 0) {
        // FÃƒâ€œRMULA PROGRESIVA: Tirar la primera torre da +1.5. Si tiran 2 antes del 14, es un stomp abusivo.
        // 1 Torre -> +1.5 pts | 2 Torres -> +3.0 pts | 3 Torres -> +4.5 pts
        let earlyPts = earlyTurrets * 1.5;
        earlyPts = Math.min(4.5, parseFloat(earlyPts.toFixed(2)));

        let label = earlyTurrets >= 2 ? "Ã¢Ëœâ€žÃ¯Â¸Â APISONADORA (Early Stomp)" : "Ã°Å¸Â¦Â PresiÃƒÂ³n Temprana";
        
        total = safeAdd(total, earlyPts, "Early Demolition", notes);
        notes.push(`${label} (${earlyTurrets} torres enteras pre-min 14, +${earlyPts} pts)`);
    }

    // =====================================================
    // Ã°Å¸Â§Â² EL SEÃƒâ€˜UELO PERFECTO (Baiter / Camped)
    // =====================================================
    // Si moriste mucho (Feeder), pero ganaste y resulta que te comiste todo el daÃƒÂ±o del mundo 
    // sin ser un tanque (Ej: Eres un ADC o Mid InmÃƒÂ³vil).
    const isSquishy = ["BOTTOM", "MIDDLE"].includes(role) && !isRealTank;
    const survivedBursts = Number(p.challenges?.tookLargeDamageSurvived || 0);
    const selfMitigatedDmg = Number(p.damageSelfMitigated || 0);

    if (isSquishy && p.win && d >= 6 && survivedBursts >= 2) {
        
        // FÃƒâ€œRMULA: Te damos puntos por cada vez que te hicieron un 'Full Focus' y tu equipo lo aprovechÃƒÂ³.
        let baitPts = survivedBursts * 0.75;
        baitPts = Math.min(3.0, parseFloat(baitPts.toFixed(2)));

        total = safeAdd(total, baitPts, "Camped Mitigation", notes);
        notes.push(`Ã°Å¸Â§Â² El SeÃƒÂ±uelo (Campeado pero aguantÃƒÂ³ ${survivedBursts} focus, +${baitPts} pts)`);
    }

    // =====================================================
    // Ã¢Å¡â€Ã¯Â¸Â TENSIÃƒâ€œN DE LIGA (LEAGUE API) - PROGRESIVO
    // =====================================================
    const leagueData = fetchLeaguePressure(p.puuid, cfg.riot_region);
    const currentLP = leagueData.lp;

    // --- A. PRESIÃƒâ€œN DE ASCENSO (80 - 100 LP) ---
    if (currentLP >= 80) {
        // PROGRESIVO: A los 80 LP te da +0.5 pts, a los 99 LP te da +2.4 pts
        let promoPts = (currentLP - 75) * 0.1;
        promoPts = Math.min(2.5, parseFloat(promoPts.toFixed(2)));

        if (p.win) {
            total = safeAdd(total, promoPts, "High Stakes Win", notes);
            notes.push(`Ã°Å¸â€œË† Partida de Ascenso Superada (${currentLP} LP, +${promoPts} pts)`);
        } else {
            // Si pierde a 99 LP, el tilt es masivo, se le consuela un poco (+1.0 fijo)
            total = safeAdd(total, 1.0, "Promo Tilt Mitigation", notes);
            notes.push(`Ã°Å¸â€™â€ Se ahogÃƒÂ³ en la orilla (PerdiÃƒÂ³ a ${currentLP} LP)`);
        }
    }
    
    // --- B. AL BORDE DEL ABISMO (0 LP) ---
    else if (currentLP === 0) {
        if (p.win) {
            // Ganar a 0 LP salva tu rango, tiene muchÃƒÂ­simo valor psicolÃƒÂ³gico
            total = safeAdd(total, 2.5, "Demotion Saved", notes);
            notes.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â Salvada Milagrosa (GanÃƒÂ³ a 0 LP, +2.5 pts)`);
        } else {
            // Perder a 0 LP implica descender o estar a punto. Castigo anÃƒÂ­mico.
            total = safeAdd(total, -2.0, "Demotion Loss", notes);
            notes.push(`Ã°Å¸â€œâ€° CaÃƒÂ­da al Abismo (PerdiÃƒÂ³ a 0 LP, -2.0 pts)`);
        }
    }

    // --- C. RACHA CALIENTE (API OFICIAL) ---
    // Riot marca "hotStreak: true" cuando ganas 3 o mÃƒÂ¡s seguidas.
    if (leagueData.hotStreak && p.win) {
        total = safeAdd(total, 1.5, "Official Hot Streak", notes);
        notes.push(`Ã°Å¸â€Â¥ Racha Oficial de Riot (HotStreak, +1.5 pts)`);
    }

Ã‚Â  Ã‚Â  // =====================================================
    // Ã°Å¸Å’Â¾ MÃƒâ€œDULO DE FARMEO (CS/MIN) V4.1 - ETIQUETAS CORREGIDAS
    // =====================================================
    if (!isSupport) { 
        
        // 1. Establecer el "Baseline" (Punto Neutro)
        const baseCS = isJungle ? 6.0 : 6.5; 
        
        // 2. Calcular la diferencia exacta con la media
        const csDiff = csMin - baseCS;
        
        // 3. Aplicar multiplicador (ProgresiÃƒÂ³n Continua y Buffada)
        let csPts = csDiff * 1.80;
        
        // 4. Limitar los puntos mÃƒÂ¡ximos y mÃƒÂ­nimos (Caps de Seguridad)
        csPts = Math.max(-6.0, Math.min(6.0, csPts));
        
        // Perdonar el mal farm si hubo Remake o Surrender al 15
        if (csPts < 0 && durationMin <= 15) {
            csPts = 0;
        }

        // 5. Aplicar los puntos y asignar la etiqueta visual ampliada
        if (csPts !== 0) {
            let label = "Farm Rating";
            
            // Ã°Å¸â€Â¥ FIX: Separamos estrictamente entre premios (positivos) y castigos (negativos)
            if (csPts > 0) {
                // TIERS POSITIVOS (Solo si ganaste puntos)
                if (isJungle) {
                    if (csMin >= 8.5) label = "Ã°Å¸â€˜Â½ TARZAN MODE (Perfect Pathing)";
                    else if (csMin >= 8.0) label = "Ã°Å¸Å¡Å“ ASPIRADORA DE JUNGLA";
                    else if (csMin >= 7.0) label = "Ã°Å¸Å’Â¾ Pathing Excelente";
                    else label = "Ã°Å¸â€™Â° Buen Farm";
                } else { // Laners
                    if (csMin >= 10.0) label = "Ã°Å¸â€˜â€˜ DIOS DEL FARM (Chovy Mode)";
                    else if (csMin >= 9.0) label = "Ã°Å¸Å¡Å“ ASPIRADORA HUMANA";
                    else if (csMin >= 8.0) label = "Ã°Å¸Å’Â¾ Farm de Pro";
                    else label = "Ã°Å¸â€™Â° Buen Farm";
                }
            } else {
                // TIERS NEGATIVOS (Solo si perdiste puntos)
                if (isJungle) {
                    if (csMin < 4.0) label = "Ã°Å¸Ââ€¢Ã¯Â¸Â Perdido en el Bosque";
                    else if (csMin < 5.0) label = "Ã°Å¸Â¤Â¡ Alergia a los Campamentos";
                    else label = "Ã°Å¸â€œâ€° Jungla Hambriento"; 
                } else { // Laners
                    if (csMin < 4.5) label = "Ã°Å¸Â¤Â¡ Alergia a los Minions";
                    else if (csMin < 5.5) label = "Ã°Å¸â€œâ€° DÃƒÂ©ficit de Farm Severo";
                    else label = "Ã°Å¸â€œâ€° DÃƒÂ©ficit de Farm"; 
                }
            }

            // Redondeamos a 2 decimales para la limpieza visual
            const finalPts = parseFloat(csPts.toFixed(2));
            
            // Sumar al total general
            total = safeAdd(total, finalPts);
            
            // Construir la nota (Ej: "Ã°Å¸â€˜â€˜ DIOS DEL FARM (Chovy Mode) (10.8/m, +6.48 pts)")
            const sign = finalPts > 0 ? '+' : '';
            notes.push(`${label} (${csMin.toFixed(1)}/m, ${sign}${finalPts} pts)`);
        }
    }

  // =====================================================
    // Ã°Å¸Å½Â£ EL PESCADOR V4.0 (Cazadas por Minuto Progresivo)
    // =====================================================
    // Variable: challenges.pickKillWithAlly
    // Mide cuÃƒÂ¡ntas veces cazaste a un enemigo aislado.
    
    let pickKills = Number(p.challenges?.pickKillWithAlly || 0);

    // Calculamos el ritmo: Picks por minuto
    const pickPerMin = durationMin > 0 ? pickKills / durationMin : 0;

    // REQUISITO MÃƒÂNIMO: 4 cazadas totales para empezar a evaluar
    if (pickKills >= 4) {
        
        // 1. BASELINE: 0.50 cazadas por minuto.
        const basePick = 0.50;
        
        if (pickPerMin > basePick) {
            // 2. FÃƒâ€œRMULA PROGRESIVA: Multiplicador de 6.25
            let pickPts = (pickPerMin - basePick) * 6.25;
            
            // Cap de seguridad
            pickPts = Math.max(0, Math.min(4.0, pickPts));

            // Solo aplicamos si la cantidad es relevante (>= 0.75)
            if (pickPts >= 0.75) {
                // 3. ETIQUETAS ORIGINALES
                let label = "Ã°Å¸â€¢Â¸Ã¯Â¸Â Oportunista";
                if (pickPerMin >= 1.10) label = "Ã°Å¸â€ºÂ¸ ABDUCTOR ALIENÃƒÂGENA";
                else if (pickPerMin >= 0.82) label = "Ã°Å¸Å½Â£ EL PESCADOR";

                pickPts = parseFloat(pickPts.toFixed(2));
                total = safeAdd(total, pickPts);
                notes.push(`${label} (${pickKills} cazadas, ${pickPerMin.toFixed(2)}/min, +${pickPts} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸â€â€™ EL CANDADO V4.0 (Setup de Kills Progresivo)
    // =====================================================
    // Variable: challenges.immobilizeAndKillWithAlly
    // TÃƒÂº lo agarras, tu equipo lo mata. La definiciÃƒÂ³n de Support/Tanque Carry.
    const setupKills = Number(p.challenges?.immobilizeAndKillWithAlly || 0);
    
    // Calculamos Setup por Minuto (SPM)
    const setupPerMin = durationMin > 0 ? setupKills / durationMin : 0;
    
    let gotSetupReward = false; // Flag para bloquear el bono de "Oportunista" si hace falta

    // Solo aplicable si tienes al menos 3 setups
    if (setupKills >= 3) {
        
        // 1. BASELINE: 0.20 setups por minuto.
        const baseSetup = 0.20;
        
        if (setupPerMin > baseSetup) {
            // 2. FÃƒâ€œRMULA PROGRESIVA: Multiplicador de 5.0
            let setupPts = (setupPerMin - baseSetup) * 5.0;
            
            // Cap de seguridad (Max 3.5 puntos)
            setupPts = Math.max(0, Math.min(3.5, setupPts));

            // Solo aplicamos si la cantidad es relevante (>= 0.5)
            if (setupPts >= 0.5) {
                gotSetupReward = true;
                
                // 3. ETIQUETAS ORIGINALES
                let label = "Ã°Å¸ÂÂ½Ã¯Â¸Â En Bandeja";
                if (setupPerMin >= 0.65) label = "Ã¢â€ºâ€œÃ¯Â¸Â MAESTRO DE TÃƒÂTERES";
                else if (setupPerMin >= 0.50) label = "Ã°Å¸â€â€™ EL CANDADO";

                setupPts = parseFloat(setupPts.toFixed(2));
                total = safeAdd(total, setupPts);
                notes.push(`${label} (${setupKills} setups, ${setupPerMin.toFixed(2)}/min, +${setupPts} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸â€Â« JOHN WICK V3.0 (Outplays Progresivo)
    // =====================================================
    // Variable: challenges.outnumberedKills
    // Mide veces que matas estando en inferioridad numÃƒÂ©rica (1v2, 2v3, etc).
    
    const johnWickKills = Number(p.challenges?.outnumberedKills || 0);
    const wickPerMin = durationMin > 0 ? johnWickKills / durationMin : 0;

    // REQUISITO MÃƒÂNIMO: Al menos 2 jugadas totales.
    if (johnWickKills >= 2) {
        
        // 1. BASELINE: 0.05 outplays por minuto (algo muy bÃƒÂ¡sico).
        const baseWick = 0.05;

        if (wickPerMin > baseWick) {
            // 2. FÃƒâ€œRMULA PROGRESIVA: Multiplicador de 15.0
            // Ej: a 0.28 (Baba Yaga) -> (0.28 - 0.05) * 15 = 3.45 pts (Casi los 3.5 que dabas)
            // Ej: a 0.17 (Hitman) -> (0.17 - 0.05) * 15 = 1.80 pts (Casi los 1.5 que dabas)
            // Ej: a 0.10 (Outplays) -> (0.10 - 0.05) * 15 = 0.75 pts (Exacto a lo que dabas)
            let wickPts = (wickPerMin - baseWick) * 15.0;

            // Cap mÃƒÂ¡ximo de seguridad
            wickPts = Math.max(0, Math.min(4.0, wickPts));

            if (wickPts >= 0.5) {
                // 3. ETIQUETAS ORIGINALES INTACTAS
                let rankLabel = "";
                if (wickPerMin >= 0.28) rankLabel = `Ã¢Å“ÂÃ¯Â¸Â BABA YAGA`;
                else if (wickPerMin >= 0.17) rankLabel = `Ã°Å¸â€¢Â´Ã¯Â¸Â Hitman`;
                else rankLabel = `Ã¢Å“Å’Ã°Å¸ÂÂ» Outplays`;

                wickPts = parseFloat(wickPts.toFixed(2));
                total = safeAdd(total, wickPts);
                notes.push(`${rankLabel} (${johnWickKills} plays, ${wickPerMin.toFixed(2)}/min, +${wickPts} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸Â¥Â· EL NINJA V2.0 (Emboscadas por Minuto)
    // =====================================================
    // Variable: challenges.killAfterHiddenWithAlly
    // Mide eficiencia de uso de la Niebla de Guerra.
    
    const ambushKills = Number(p.challenges?.killAfterHiddenWithAlly || 0);
    const ambushPerMin = durationMin > 0 ? ambushKills / durationMin : 0;

    // REQUISITO: MÃƒÂ­nimo 2 para evitar sesgos en partidas muy cortas o suerte puntual
    if (ambushKills >= 3) {
        
        // TIER 3: SOMBRA LETAL (> 0.20/min) 
        // Ritmo absurdo. Ej: 6 emboscadas en 30 min (1 cada 5 min).
        if (ambushPerMin >= 0.25) {
            total = safeAdd(total, 3.0, "Ninja God", notes);
            notes.push(`Ã°Å¸Â¥Â· SOMBRA LETAL (${ambushKills} emboscadas, ${ambushPerMin.toFixed(2)}/min)`);
        }
        
        // TIER 2: ASSASSIN'S CREED (> 0.12/min)
        // Ritmo alto. Ej: 4 emboscadas en 30 min (1 cada 7-8 min).
        else if (ambushPerMin >= 0.18) {
            total = safeAdd(total, 2.0, "Assassin", notes);
            notes.push(`Ã°Å¸â€”Â¡Ã¯Â¸Â Assassin's Creed (${ambushKills} emboscadas)`);
        }
        
        // TIER 1: CAMPERO TÃƒÂCTICO (> 0.06/min)
        // Ritmo constante. Ej: 2 emboscadas en 30 min.
        else if (ambushPerMin >= 0.12) {
            total = safeAdd(total, 1.0, "Camper", notes);
            notes.push(`Ã¢â€ºÂº Campero TÃƒÂ¡ctico (${ambushKills} emboscadas)`);
        }
    }

    // =====================================================
    // Ã°Å¸Å½Â¯ EL FRANCOTIRADOR (Distancia MÃƒÂ¡xima de Kill)
    // =====================================================
    // Variable: challenges.maxKillDistance
    // Un ataque bÃƒÂ¡sico de Caitlyn son 650 unidades. La pantalla son ~1500-2000.
    const maxDist = Number(p.challenges?.maxKillDistance || 0);

    if (maxDist > 0) {
        // TIER 3: MISIL INTERCONTINENTAL (> 10,000 unidades)
        // Kills desde base o medio mapa (Ezreal, Jinx, Ashe, Karthus, Gangplank)
        if (maxDist >= 10000) {
            total = safeAdd(total, 1.0, "ICBM Kill", notes);
            notes.push(`Ã°Å¸Å¡â‚¬ MISIL INTERCONTINENTAL (Kill a ${(maxDist/100).toFixed(0)}m de distancia)`);
        }
        // TIER 2: SNIPER ELITE (> 3,000 unidades)
        // Kills fuera de pantalla (Xerath, Jhin, Caitlyn R, Nidalee Q max range)
        else if (maxDist >= 3000) {
            total = safeAdd(total, 0.5, "Sniper", notes);
            notes.push(`Ã°Å¸â€Â­ Sniper Elite (Kill fuera de pantalla)`);
        }
    }

    // --- NUEVO: EL ASEDIADOR (Tower Dives) ---
    // Variable: challenges.killsUnderEnemyTurret
    const diveKills = Number(p.challenges?.killsUnderEnemyTurret || 0);

    if (diveKills > 0) {
        const divePts = diveKills * 0.75; // 0.75 pts por cada dive exitoso
        total = safeAdd(total, divePts, "Dive Master", notes);
        notes.push(`Ã°Å¸ÂÂ¯ Dive Master (${diveKills} kills bajo torre)`);
    }

    // --- NUEVO: COORDINACIÃƒâ€œN PERFECTA (Flawless Ace) ---
    // Variable: challenges.flawlessAces
    const cleanAces = Number(p.challenges?.flawlessAces || 0);

    if (cleanAces > 0) {
        const acePts = cleanAces * 0.5; // 2 puntos por cada Exterminio limpio (es raro que pase)
        total = safeAdd(total, acePts, "Clean Ace", notes);
        notes.push(`Ã¢Å“Â¨ Exterminio Perfecto (x${cleanAces})`);
    }


    // =====================================================
    // Ã¢Å¡â€Ã¯Â¸Â HITOS DE KILLS (KPM - Kills Por Minuto) - PROGRESIVO
    // =====================================================
    const kpm = durationMin > 0 ? k / durationMin : 0;
    
    // Empezamos a premiar el ritmo de asesinatos a partir de 0.40 KPM
    if (kpm >= 0.40) { 
        
        // 1. FÃƒâ€œRMULA PROGRESIVA: Base en 0.28 KPM, multiplicador de 8.33
        // Ej: 0.40 KPM -> (0.40 - 0.28) * 8.33 = +1.00 pts
        // Ej: 0.55 KPM -> (0.55 - 0.28) * 8.33 = +2.25 pts
        // Ej: 0.70 KPM -> (0.70 - 0.28) * 8.33 = +3.50 pts
        let kpmPts = (kpm - 0.28) * 8.33;
        
        // Cap de seguridad mÃƒÂ¡ximo (+4.5 puntos, para evitar que stomps de 15 minutos rompan el sistema)
        kpmPts = Math.min(4.5, parseFloat(kpmPts.toFixed(2)));

        // 2. ASIGNACIÃƒâ€œN DE ETIQUETAS (LORE)
        let label = "Ã°Å¸â€Â« Sicario";
        if (kpm >= 0.70) {
            label = "Ã¢Å¡Â°Ã¯Â¸Â La Parca";
        } else if (kpm >= 0.55) {
            label = "Ã°Å¸â€™â‚¬ Terminator";
        }

        // 3. APLICACIÃƒâ€œN
        applyBonus(`${label} (${kpm.toFixed(2)} kills/min)`, kpmPts);
    }

    // =====================================================
    // Ã°Å¸Â¤Â HITOS DE ASISTENCIAS (APM) - MATRIZ INTELIGENTE V4.0
    // =====================================================
    const apm = durationMin > 0 ? a / durationMin : 0;
    
    // 1. EXPECTATIVAS POR ROL (El "Punto 0")
    // Ã‚Â¿CuÃƒÂ¡ntas asistencias por minuto se consideran "lo normal" para tu rol?
    let baseAPM = 0.20; // Laners (Top, Mid, Bot) no asisten tanto
    if (isSupport) baseAPM = 0.30; // El Support DEBE asistir
    else if (isJungle) baseAPM = 0.25; // El Jungla estÃƒÂ¡ en medio

    // 2. CÃƒÂLCULO DE DIFERENCIA
    const apmDiff = apm - baseAPM;
    let apmPts = 0;
    let label = "";

    // --- A. RECOMPENSAS (Mercado Altruista) ---
    if (apmDiff > 0.10) { 
        // FÃƒâ€œRMULA PROGRESIVA: +4.0 pts por cada 1.0 APM por encima de lo esperado
        // Ej Supp: 1.15 APM (base 0.65) -> +0.50 extra * 4.0 = +2.0 pts
        // Ej Top: 0.75 APM (base 0.25) -> +0.50 extra * 4.0 = +2.0 pts
        apmPts = apmDiff * 5.0;
        apmPts = Math.min(4.5, parseFloat(apmPts.toFixed(2))); // Cap mÃƒÂ¡ximo de +4.5

        // SISTEMA DE 5 TIERS (DinÃƒÂ¡mico segÃƒÂºn la diferencia)
        if (apmDiff >= 0.65) label = "Ã°Å¸â€˜Â¼Ã°Å¸ÂÂ» MESÃƒÂAS DE LA GRIETA";       // Nivel S++
        else if (apmDiff >= 0.45) label = "Ã°Å¸â€˜Â¼Ã°Å¸ÂÂ» Heroes Never die!";    // Nivel S
        else if (apmDiff >= 0.30) label = "Ã°Å¸Å¡â€˜ Hospital Ambulante";   // Nivel A
        else if (apmDiff >= 0.15) label = "Ã°Å¸â€™â€° Enfermero";            // Nivel B
        else label = "Ã°Å¸Â©Â¹ Primeros Auxilios";                         // Nivel C
    }
    
    // --- B. PENALIZACIONES (Solo para Supports y Junglas) ---
    // Si eres el responsable de ayudar y no tienes asistencias, eres un lastre.
    else if (apmDiff < -0.20 && (isSupport || isJungle)) {
        // Castigo progresivo
        apmPts = (apmDiff + 0.20) * 5.0; 
        apmPts = Math.max(-3.5, parseFloat(apmPts.toFixed(2)));

        if (apm < 0.15) label = "Ã°Å¸â€”Â¿ CompaÃƒÂ±ero de CartÃƒÂ³n"; // Literalmente no ha tocado a nadie
        else label = "Ã°Å¸Å¡Â¶Ã¢â‚¬ÂÃ¢â„¢â€šÃ¯Â¸Â Jugador Solitario";
    }

    // 3. APLICACIÃƒâ€œN
    if (apmPts !== 0 && label !== "") {
        total = safeAdd(total, apmPts, "APM Scaling", notes);
        notes.push(`${label} (${apm.toFixed(2)} ast/min, ${apmPts > 0 ? '+' : ''}${apmPts} pts)`);
    }

    // =====================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â PREMIO A LA SUPERVIVENCIA 2.0 (Contextual)
    // =====================================================
    if (durationMin >= 20) {
        
        // Calcular si el jugador participÃƒÂ³ activamente o solo se escondiÃƒÂ³
        // Si KP es bajo (< 25%) y no eres Splitpusher, eres un "KDA Player"
        const isPassivePlayer = (kp < 0.35) && !notes.some(n => n.includes("Split"));
        const isLongGame = durationMin >= 35; // Mantener el 0 en late game es muy difÃƒÂ­cil

        if (d === 0) {
            if (isPassivePlayer) {
                // Castigo por jugar demasiado seguro sin ayudar
                applyBonus("Ã°Å¸â€ºÂ¡Ã¯Â¸Â KDA Player (0 muertes, bajo impacto)", 1.0);
            } 
            else {
                // PREMIO REAL: Inmortalidad con impacto
                // Si la partida fue muy larga (>35 min), vale mÃƒÂ¡s (+4.0)
                // Si el KDA ya es absurdo (>15), bajamos un poco la base para no inflar (+2.0 + bonus)
                let basePoints = (kda > 15) ? 1.5 : 3.0;
                
                if (isLongGame) {
                    basePoints += 1.0; // Bonus por dificultad de tiempo
                    applyBonus("Ã°Å¸â€˜â€˜ INMORTAL LEGENDARIO (>35 min sin morir)", basePoints);
                } else {
                    applyBonus("Ã°Å¸â€˜â€˜ Inmortal", basePoints);
                }
            }
        } 
        else if (d === 1) {
            // Casi perfecto: Se mantiene igual, es un buen premio
            applyBonus("Ã°Å¸â€ºÂ¡Ã¯Â¸Â Casi Perfecto", 2.0);
        } 
        else if (d <= 3) {
            // Si moriste poco, pero la partida fue ETERNA (>40 min), tiene mÃƒÂ©rito extra
            if (durationMin >= 40) {
                 applyBonus("Ã°Å¸Â§Ëœ Superviviente de MaratÃƒÂ³n", 1.5);
            } else {
                 applyBonus("Ã°Å¸Â§Ëœ Superviviente", 1.0);
            }
        }
    }

Ã‚Â  Ã‚Â  // =====================================================
    // Ã°Å¸â€˜ÂÃ¯Â¸Â EL OJO DE SAURON 2.0: CONTROL DE VISIÃƒâ€œN PROGRESIVO
    // =====================================================
    
    // 1. Obtener la mÃƒÂ©trica exacta (VisiÃƒÂ³n por Minuto)
    const vspm = Number(p.challenges?.visionScorePerMinute || (durationMin > 0 ? vs / durationMin : 0));

    // --- A. BONUS POR ROL (Escalado MatemÃƒÂ¡tico) ---
    
    // 1. SUPPORTS (La funciÃƒÂ³n principal: Exigencia MÃƒÂ¡xima)
    if (isSupport) {
        // FÃƒÂ³rmula Progresiva:
        // Baseline = 1.5 vspm (0 puntos). 
        // Si tienes mÃƒÂ¡s, sumas x1.8 por cada punto. Si tienes menos, restas x2.0.
        let vspmPts = vspm > 1.5 ? (vspm - 1.5) * 1.8 : (vspm - 1.5) * 2.0;
        
        // Cap de seguridad: Max +4.5 pts | Min -3.0 pts
        vspmPts = Math.max(-3.0, Math.min(4.5, vspmPts));
        
        // Perdonar partidas demasiado cortas (remakes o surrenders al 15)
        if (vspmPts < 0 && durationMin <= 15) vspmPts = 0; 

        // AsignaciÃƒÂ³n de Etiquetas (Lore)
        let label = "";
        if (vspmPts >= 3.8) label = "Ã°Å¸â€˜ÂÃ¯Â¸Â OJO DE SAURON";
        else if (vspmPts >= 2.5) label = "Ã°Å¸â€Â¦ Mapa Iluminado";
        else if (vspmPts >= 1.5) label = "Ã°Å¸â€¢Â¯Ã¯Â¸Â Control de Zona";
        else if (vspmPts >= 0.5) label = "Ã°Å¸â€˜â‚¬ VisiÃƒÂ³n Decente";
        else if (vspmPts <= -1.0) label = "Ã°Å¸â„¢Ë† Support Ciego";
        
        if (vspmPts !== 0 && label !== "") {
            vspmPts = parseFloat(vspmPts.toFixed(2));
            total = safeAdd(total, vspmPts);
            notes.push(`${label} (${vspm.toFixed(1)}/m, ${vspmPts > 0 ? '+' : ''}${vspmPts} pts)`);
        }
    } 
    
    // =====================================================
    // 2. JUNGLAS (Exigencia media-alta: VisiÃƒÂ³n y Control)
    // =====================================================
    else if (isJungle) {
        // Baseline = 1.0 vspm (0 puntos). 
        // Multiplicador: x2.5 hacia arriba, x2.0 hacia abajo.
        let vspmPts = vspm > 1.0 ? (vspm - 1.0) * 2.5 : (vspm - 1.0) * 2.0;
        
        // Cap de seguridad ampliado: Max +3.5 pts | Min -2.0 pts
        vspmPts = Math.max(-2.0, Math.min(3.5, parseFloat(vspmPts.toFixed(2))));

        // PerdÃƒÂ³n en remakes o stomps rÃƒÂ¡pidos
        if (vspmPts < 0 && durationMin <= 15) vspmPts = 0;

        let label = "";
        // Premios
        if (vspmPts >= 3.0) label = "Ã°Å¸â€˜ÂÃ¯Â¸ÂÃ¢â‚¬ÂÃ°Å¸â€”Â¨Ã¯Â¸Â EL OJO QUE TODO LO VE";
        else if (vspmPts >= 2.0) label = "Ã°Å¸Å’Â² Radar Humano";
        else if (vspmPts >= 1.0) label = "Ã°Å¸â€Â­ VigÃƒÂ­a de Jungla";
        // Castigos
        else if (vspmPts <= -1.5) label = "Ã°Å¸â„¢Ë† CIEGO LEGAL";
        else if (vspmPts <= -0.8) label = "Ã°Å¸â€¢Â¶Ã¯Â¸Â Lee Sin Cosplay";

        if (vspmPts !== 0 && label !== "") {
            total = safeAdd(total, vspmPts, "Jungle VSPM", notes);
            notes.push(`${label} (${vspm.toFixed(2)}/m, ${vspmPts > 0 ? '+' : ''}${vspmPts} pts)`);
        }
    }
    
    // =====================================================
    // 3. LANERS (Top/Mid/Adc - Exigencia baja, solo premios)
    // =====================================================
    else {
        // Empezamos a premiar notablemente a partir de 0.6 vspm
        if (vspm >= 0.60) {
            // FÃƒÂ³rmula: Base 0.5 vspm, multiplicador de 2.0
            // Ej: 1.0 vspm -> (1.0 - 0.5) * 2 = +1.0 pts
            // Ej: 1.5 vspm -> (1.5 - 0.5) * 2 = +2.0 pts
            let vspmPts = (vspm - 0.5) * 2.0;
            vspmPts = Math.min(2.5, parseFloat(vspmPts.toFixed(2))); // Cap mÃƒÂ¡ximo en +2.5

            let label = "Ã°Å¸â€Â¦ Ayudante de VisiÃƒÂ³n";
            if (vspmPts >= 2.0) label = "Ã°Å¸Â¦â€¦ Ojo de HalcÃƒÂ³n Supremo";
            else if (vspmPts >= 1.2) label = "Ã°Å¸Â¦â€° Laner Visionario";
            
            total = safeAdd(total, vspmPts, "Laner VSPM", notes);
            notes.push(`${label} (${vspm.toFixed(2)}/m, +${vspmPts} pts)`);
        }
    }

    // =====================================================
    // --- B. DOMINANCIA DE VISIÃƒâ€œN (Support vs Oponente) ---
    // =====================================================
    if (isSupport && opponent) {
        const vsDiff = (p.visionScore || 0) - (opponent.visionScore || 0);
        
        // Empezamos a premiar si le sacas al menos +10 de visiÃƒÂ³n al rival
        if (vsDiff >= 10) { 
            // FÃƒÂ³rmula progresiva: +0.12 pts por cada punto de visiÃƒÂ³n de diferencia
            // +20 diff = +1.20 pts | +35 diff = +3.0 pts | +45 diff = +4.2 pts
            let gapPts = (vsDiff - 10) * 0.12;
            gapPts = Math.min(4.0, parseFloat(gapPts.toFixed(2))); // Cap ampliado a +4.0
            
            let label = "Ã°Å¸â€™Â¡ Vision Gap";
            if (gapPts >= 3.0) label = "Ã°Å¸â€˜ÂÃ¯Â¸Â OMNISCIENCIA ABSOLUTA";
            else if (gapPts >= 1.5) label = "Ã°Å¸â€Â¦ Dominio del Mapa";

            total = safeAdd(total, gapPts, "Vision Gap", notes);
            notes.push(`${label} (+${vsDiff} vs rival, +${gapPts} pts)`);
        }
    }

    // =====================================================
    // Ã°Å¸â€œÅ  PARTICIPACIÃƒâ€œN DE KILLS (KP) - PROGRESIVO V4.0
    // =====================================================
    if (durationMin > 12) { 

        // 1. DEFINIR EXPECTATIVA BASE (El "MÃƒÂ­nimo para no restar")
        // Mid/Adc empiezan en 35%
        let baseKP = 0.40; 

        // AJUSTE POR ROL:
        // Top: Vive en una isla -> Se le exige menos (25%)
        // Jgl/Supp: Roamers -> Se les exige mÃƒÂ¡s (40%)
        if (isJungle || isSupport) {
            baseKP += 0.05;
        }

        // 2. FÃƒâ€œRMULA MATEMÃƒÂTICA PROGRESIVA
        // Por cada 10% (0.10) por encima de tu base, ganas +1.0 punto.
        // Ej Mid: 75% KP -> (0.75 - 0.35) * 10 = +4.0 pts
        // Ej Jgl: 50% KP -> (0.50 - 0.40) * 10 = +1.0 pts
        let kpPts = (kp - baseKP) * 10.0;
        
        // Cap de seguridad: MÃƒÂ¡ximo +4.5 pts | MÃƒÂ­nimo -3.0 pts
        kpPts = Math.max(-3.0, Math.min(4.5, kpPts));

        // 3. EXCEPCIONES PARA NO CASTIGAR (Solo si los puntos son negativos)
        if (kpPts < 0) {
            const turretDmg = Number(p.damageDealtToTurrets || 0);
            const tdpm = turretDmg / durationMin;
            const isSplitpusher = (role === "TOP" || role === "MIDDLE" || isJungle) && tdpm > 250;
            const isFastStomp = p.win && durationMin < 23;
            const isTopIsland = role === "TOP" && p.win;

            if (isSplitpusher) {
                kpPts = 0;
                notes.push(`Ã°Å¸Å¡Å“ Splitpusher Solitario (Baja KP justificada)`);
            } 
            else if (isFastStomp) {
                kpPts = 0;
                notes.push(`Ã¢Å¡Â¡ Stomp RÃƒÂ¡pido (Baja KP perdonada)`);
            }
            else if (isTopIsland) {
                kpPts = 0;
                // Perdonado silenciosamente
            }
        }

        // 4. ASIGNACIÃƒâ€œN DE ETIQUETAS (LORE) Y APLICACIÃƒâ€œN
        let label = "";
        
        // Etiquetas para rendimientos positivos
        if (kpPts >= 3.5) label = "Ã°Å¸â€˜ÂÃ¯Â¸Â Omnipresente";        // Aprox > 75% KP
        else if (kpPts >= 2.5) label = "Ã¢Å¡â„¢Ã¯Â¸Â Motor del Equipo"; // Aprox > 65% KP
        else if (kpPts >= 1.5) label = "Ã°Å¸Â¤Â Socio Clave";      // Aprox > 55% KP
        else if (kpPts >= 0.5) label = "Ã°Å¸ÂªÂ² Trabajador";       // Aprox > 45% KP
        // (Entre 0.0 y 0.5 es "Decente", no ponemos nota para no spamear)
        
        // Etiqueta para castigos (Si los puntos siguen siendo negativos tras las excepciones)
        else if (kpPts <= -0.5) {
            label = "Ã°Å¸â€˜Â» Fantasma";
        }

        // 5. SUMAR PUNTOS Y AÃƒâ€˜ADIR AL REGISTRO
        if (kpPts !== 0 && label !== "") {
            kpPts = parseFloat(kpPts.toFixed(2));
            total = safeAdd(total, kpPts);
            
            // Genera la nota: "Ã°Å¸â€˜ÂÃ¯Â¸Â Omnipresente (78% KP, +4.3 pts)" o "Ã°Å¸â€˜Â» Fantasma (22% KP, -1.3 pts)"
            notes.push(`${label} (${(kp * 100).toFixed(0)}% KP, ${kpPts > 0 ? '+' : ''}${kpPts} pts)`);
        }
    }


    // =========================================================
    // Ã°Å¸â€œÅ  MÃƒâ€œDULO ROI V5.0: EL LOBO DE WALL STREET (PROGRESIVO)
    // =========================================================
    // Solo aplica a Laners y Junglas (Supports tienen su propia lÃƒÂ³gica de utilidad)
    if (durationMin > 15 && !isSupport) {
        
        const myGold = Math.max(1, Number(p.goldEarned || 0));
        const myDmg = Number(p.totalDamageDealtToChampions || 0);
        
        // 1. Calcular TU eficiencia (DaÃƒÂ±o por cada 1 de Oro)
        const myROI = myDmg / myGold;

        // 2. Calcular la media del equipo (Excluyendo Supports para no distorsionar)
        const teamCarries = participants.filter(pt => 
            pt.teamId === p.teamId && 
            pt.teamPosition !== 'UTILITY' && 
            pt.teamPosition !== 'SUPPORT'
        );
        
        const teamTotalDmg = teamCarries.reduce((acc, pt) => acc + (pt.totalDamageDealtToChampions || 0), 0);
        const teamTotalGold = teamCarries.reduce((acc, pt) => acc + (pt.goldEarned || 0), 0);
        const teamAvgROI = teamTotalDmg / Math.max(1, teamTotalGold);

        // 3. Rankings internos (Para el bono de "Liderazgo")
        const myTeamLocal = participants.filter(pt => pt.teamId === p.teamId);
        const sortedGold = [...myTeamLocal].sort((a,b) => b.goldEarned - a.goldEarned);
        const sortedDmg = [...myTeamLocal].sort((a,b) => b.totalDamageDealtToChampions - a.totalDamageDealtToChampions);
        
        const goldRank = sortedGold.findIndex(x => x.puuid === p.puuid) + 1;
        const dmgRank = sortedDmg.findIndex(x => x.puuid === p.puuid) + 1;

        // --- NIVEL 1: CÃƒÂLCULO DE EFICIENCIA PURA (PROGRESIVO) ---
        // Requisito: Haber hecho daÃƒÂ±o relevante (>15% del total)
        if (dmgShare > 0.15 && teamAvgROI > 0) {
            
            // Calculamos cuÃƒÂ¡ntas veces mejor eres que la media (Ej: 1.30 = 30% mejor)
            const roiRatio = myROI / teamAvgROI;
            
            // FÃƒâ€œRMULA PROGRESIVA:
            // Empezamos a premiar si igualas a la media (1.0).
            // Por cada 10% por encima de la media, ganas +0.5 pts. (Multiplicador: 5.0)
            let roiPts = (roiRatio - 1.0) * 5.0;
            
            // Cap de seguridad: MÃƒÂ¡ximo +4.5 pts
            roiPts = Math.max(0, Math.min(4.5, roiPts));

            // Filtro para no dar premios residuales (mÃƒÂ­nimo +0.5 pts para aparecer)
            if (roiPts >= 0.5) { 
                let label = "Ã°Å¸â€™Å½ InversiÃƒÂ³n Rentable";
                if (roiRatio >= 1.55) label = "Ã°Å¸ÂÂº LOBO DE WALL STREET";
                else if (roiRatio >= 1.25) label = "Ã°Å¸â€œË† STONKS!";
                
                roiPts = parseFloat(roiPts.toFixed(2));
                total = safeAdd(total, roiPts);
                notes.push(`${label} (ROI ${(myROI).toFixed(2)} vs media ${(teamAvgROI).toFixed(2)}, +${roiPts} pts)`);
            }
        }

        // --- NIVEL 2: LA PARADOJA (Rankings) ---
        // Este es el sistema antiguo. Sigue siendo un bono extra.
        if (goldRank >= 3 && dmgRank <= 2) {
            const gapBonus = (goldRank - dmgRank) * 0.5; // +0.5 por cada puesto de diferencia
            total = safeAdd(total, gapBonus);
            notes.push(`Ã¢Å¡â€“Ã¯Â¸Â EconomÃƒÂ­a de Guerra (Top ${dmgRank} Dmg con Top ${goldRank} Oro, +${gapBonus} pts)`);
        }

        // --- NIVEL 3: LIDERAZGO TOTAL (El 1/1) PROGRESIVO ---
        // Eres el nÃ‚Âº1 en Oro y el nÃ‚Âº1 en DaÃƒÂ±o.
        if (goldRank === 1 && dmgRank === 1 && p.win) {
            
            // Ã°Å¸â€â€™ FILTRO: Solo aplicamos si el KDA es sÃƒÂ³lido (> 3.0)
            if (kda >= 3.0) {
                let leaderBonus = 1.5; // Bono base por ser el lÃƒÂ­der
                const dmg2nd = sortedDmg[1]?.totalDamageDealtToChampions || 1;
                
                // EXTRA PROGRESIVO: Si le sacaste mucho daÃƒÂ±o al segundo de tu equipo
                const dmgGapRatio = myDmg / dmg2nd;
                if (dmgGapRatio > 1.1) {
                    // Por cada 10% de daÃƒÂ±o extra sobre el segundo, te llevas +0.4 pts
                    let stompExtra = (dmgGapRatio - 1.0) * 4.0; 
                    stompExtra = Math.min(2.5, stompExtra); // Cap del extra en +2.5
                    
                    // Multiplicador de "Seguridad": Si tienes un KDA de Dios (>=4.0) cobras el extra entero
                    const kdaMultiplier = Math.min(1.0, kda / 4.0); 
                    leaderBonus += (stompExtra * kdaMultiplier);
                }

                leaderBonus = parseFloat(leaderBonus.toFixed(2));
                let label = leaderBonus >= 3.0 ? "Ã°Å¸â€˜â€˜ REY SOL" : "Ã°Å¸â€˜â€˜ LÃƒÂ­der del Proyecto";

                total = safeAdd(total, leaderBonus);
                notes.push(`${label} (1Ã‚Âº Oro, 1Ã‚Âº DaÃƒÂ±o, KDA ${kda.toFixed(1)}, +${leaderBonus} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸ÂÂ¦ ROI DE UTILIDAD v3.0 (SUPER BUFFED & PROGRESIVO)
    // =====================================================
    // Mide cuÃƒÂ¡nta utilidad generas por cada moneda de oro que ganas.
    if (isSupport && durationMin > 15) {
        const totalHeal = Number(p.totalHealsOnTeammates || 0);
        const totalShield = Number(p.totalDamageShieldedOnTeammates || 0);
        const ccSeconds = Number(p.timeCCingOthers || 0);
        const selfMitigated = Number(p.damageSelfMitigated || 0); 
        const gold = Math.max(1, Number(p.goldEarned || 0));

        // FÃƒÂ³rmula base de peso de utilidad
        const utilityScore = totalHeal + totalShield + (ccSeconds * 125) + (selfMitigated * 0.40);
        const roi = utilityScore / gold;

        // FÃƒâ€œRMULA PROGRESIVA:
        // Baseline = 1.2 de ROI (Menos de esto es 0 puntos).
        // Multiplicador de 1.25 pts por cada punto de ROI por encima de la base.
        // Ej: ROI 2.0 -> (2.0 - 1.2) * 1.25 = +1.0 pts
        // Ej: ROI 3.6 -> (3.6 - 1.2) * 1.25 = +3.0 pts
        let utilPts = (roi - 1.2) * 1.25;
        
        // Cap de seguridad: MÃƒÂ¡ximo +4.5 pts
        utilPts = Math.max(0, Math.min(4.5, utilPts));

        if (utilPts >= 0.5) { // Filtro mÃƒÂ­nimo para reportar
            let label = "Ã°Å¸â€™Â¼ Utilidad Rentable";
            if (utilPts >= 3.5) label = "Ã°Å¸ÂÂ¦ ORÃƒÂCULO DE WALL STREET";
            else if (utilPts >= 2.0) label = "Ã°Å¸â€™Â¸ Inversor Maestro";
            else if (utilPts >= 1.2) label = "Ã¢Å¡â€“Ã¯Â¸Â Support Eficiente";

            utilPts = parseFloat(utilPts.toFixed(2));
            total = safeAdd(total, utilPts);
            notes.push(`${label} (ROI ${roi.toFixed(1)}, +${utilPts} pts)`);
        }
    }

    // =====================================================
    // Ã°Å¸Ââ€Ã¯Â¸Â XP KINGDOM (Dominio de Nivel en Top)
    // =====================================================
    // Si le sacas niveles a tu rival directo, lo has dejado fuera del juego.
    
    if (role === "TOP" && opponent && durationMin > 15) {
        const myLvl = Number(p.champLevel || 1);
        const oppLvl = Number(opponent.champLevel || 1);
        const levelDiff = myLvl - oppLvl;

        // TIER 3: ABUSO TOTAL (+3 Niveles o mÃƒÂ¡s)
        // Esto es un stomp de manual. El rival no puede ni acercarse.
        if (levelDiff >= 3) {
            total = safeAdd(total, 3.0, "XP Stomp", notes);
            notes.push(`Ã°Å¸Ââ€Ã¯Â¸Â LA CIMA (+${levelDiff} niveles sobre su Top)`);
        }
        // TIER 2: DOMINIO (+2 Niveles)
        else if (levelDiff >= 2) {
            total = safeAdd(total, 2.0, "XP Gap", notes);
            notes.push(`Ã¢ÂÂ« Gap de Nivel (+${levelDiff} lvls)`);
        }
        // TIER 1: VENTAJA (+1 Nivel y ganando)
        else if (levelDiff >= 1 && p.win) {
            total = safeAdd(total, 0.5, "XP Lead", notes);
            notes.push(`Ã°Å¸â€œË† Ventaja de XP`);
        }
        
        // CASTIGO: Si te sacan 2 niveles o mÃƒÂ¡s
        else if (levelDiff <= -2) {
            total = safeAdd(total, -1.5, "XP Deficit", notes);
            notes.push(`Ã°Å¸â€œâ€° Outleveled (${levelDiff} lvls)`);
        }
    }

    // --- Ã°Å¸â€ºÂ¡Ã¯Â¸Â PREMIO: PROTECTOR DEL SHUTDOWN (S26) ---
    // Si tenÃƒÂ­as una racha de asesinatos alta (Bounty activo) y terminaste la partida SIN morir (o muriendo 1 vez),
    // negaste mucho oro al enemigo. Eso vale puntos.
    
    const largestSpree = Number(p.largestKillingSpree || 0);
    
    if (largestSpree >= 5 && d <= 1) {
        // Si ganaste y protegiste tu bounty
        if (p.win) {
            total = safeAdd(total, 2.0, "Bounty Keeper", notes);
            notes.push(`Ã°Å¸â€™Â° Bounty Keeper (Racha de ${largestSpree} protegida)`);
        }
    }

    // =====================================================
    // Ã°Å¸â€Â¥ IMPARABLE (Racha de Asesinatos - Progresivo)
    // =====================================================
    const spree = Number(p.largestKillingSpree || 0);

    // Empezamos a premiar desde la racha de 8 (como antes)
    if (spree >= 8) {
        // FÃƒâ€œRMULA PROGRESIVA: Por cada kill por encima de 5, ganas +0.25 pts.
        // Ej: Racha 8 -> (8 - 5) * 0.25 = +0.75 pts (Ã‚Â¡Coincide exacto con tu versiÃƒÂ³n anterior!)
        // Ej: Racha 13 -> (13 - 5) * 0.25 = +2.00 pts (Un poco mejor que tu 1.5 anterior)
        // Ej: Racha 18 -> (18 - 5) * 0.25 = +3.25 pts
        let spreePts = (spree - 5) * 0.25;
        
        // Cap de seguridad: Nadie puede sacar mÃƒÂ¡s de 4.5 puntos por racha
        spreePts = Math.min(4.5, spreePts);

        let label = "Ã°Å¸â€Â¥ Imparable";
        if (spree >= 23) label = "Ã°Å¸â€˜Â½ Ã‚Â¡ALIEN!";
        else if (spree >= 18) label = "Ã¢Å¡Â¡ DIVINO";
        else if (spree >= 13) label = "Ã°Å¸â€˜Â¹ LEGENDARIO";

        spreePts = parseFloat(spreePts.toFixed(2));
        total = safeAdd(total, spreePts, "Killing Spree", notes);
        notes.push(`${label} (Racha de ${spree} sin morir, +${spreePts} pts)`);
    }

    // =====================================================
    // Ã°Å¸â€™â‚¬ ESPIRAL DE MUERTE (Death Streak Math - Progresivo)
    // =====================================================
    // Detecta si mueres sin llevarte a nadie por delante.
    const redemptionScore = k + (a / 3); 
    const deathGap = d - redemptionScore;

    // CONDICIÃƒâ€œN: Solo activo si la partida dura > 15 min y el Gap es alto
    if (durationMin > 15 && deathGap >= 3.5) {
        
        const isAlreadyPunished = notes.some(n => n.includes("Feeder") || n.includes("INTING") || n.includes("Pantalla Gris"));
        
        // FÃƒâ€œRMULA PROGRESIVA: Por cada punto de Gap extra, el castigo aumenta -0.40 pts.
        // Gap 3.5 -> (3.5 - 1.0) * -0.40 = -1.0 pts (Coincide exacto con tu versiÃƒÂ³n)
        // Gap 6.0 -> (6.0 - 1.0) * -0.40 = -2.0 pts (Coincide exacto)
        // Gap 10.0 -> (10.0 - 1.0) * -0.40 = -3.6 pts
        let spiralPenalty = (deathGap - 1.0) * -0.40;
        
        // Cap de seguridad mÃƒÂ¡ximo
        spiralPenalty = Math.max(-4.0, spiralPenalty);

        let spiralLabel = "Ã°Å¸Â¥Â´ Tilteado";
        if (spiralPenalty <= -3.0) spiralLabel = "Ã¢Å¡Â« Agujero Negro";
        else if (spiralPenalty <= -2.0) spiralLabel = "Ã°Å¸â€œâ€° CaÃƒÂ­da Libre";

        // FACTOR DE PIEDAD: Si ya fue castigado por Feeder, reducimos el impacto a la mitad
        if (isAlreadyPunished) {
            spiralPenalty = spiralPenalty * 0.5;
        }

        // Aplicar solo si el castigo es notable (>= -0.5 pts) para no ensuciar las notas
        if (spiralPenalty <= -0.5) {
            spiralPenalty = parseFloat(spiralPenalty.toFixed(2));
            total = safeAdd(total, spiralPenalty, "Death Spiral", notes);
            
            if (!isAlreadyPunished || spiralPenalty <= -1.0) {
                notes.push(`${spiralLabel} (Gap negativo: ${deathGap.toFixed(1)}, ${spiralPenalty} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸Ââ€° EL SEÃƒâ€˜OR DE LAS BESTIAS (Solo Objectives - Multiplicativo)
    // =====================================================
    const soloBaron = Number(p.challenges?.soloBaronKills || 0);

    if (soloBaron > 0) {
        // Al ser un evento casi imposible, si alguien se hace 2 Nashors solo en una partida ÃƒÂ©pica,
        // le multiplicamos el premio (x4.5 puntos cada uno)
        let baronPts = soloBaron * 4.5;
        total = safeAdd(total, baronPts, "Solo Nashor", notes);
        notes.push(`Ã°Å¸Ââ€° SeÃƒÂ±or de las Bestias (Se hizo el Nashor SOLO x${soloBaron}, +${baronPts} pts)`);
    }

    // =========================================================
    // Ã°Å¸Å’Â³ EL RECAUDADOR (GestiÃƒÂ³n de Recursos de Jungla - Progresivo)
    // =========================================================
    if (isLaner && durationMin > 15) {
        const alliedJungle = Number(p.challenges?.alliedJungleMonsterKills || 0);
        const alliedJungleMPM = alliedJungle / durationMin; // Monstruos robados por minuto

        // Umbral de activaciÃƒÂ³n: 0.6 MPM
        if (alliedJungleMPM >= 0.6) {
            
            const dmgShareForTax = p.challenges?.teamDamagePercentage || 0;
            const isHardCarry = (dmgShareForTax >= 0.28 || kda >= 4.0);
            const isValidAdcFarming = (role === 'BOTTOM' && dmgShareForTax > 0.20);

            // CASO 1: EL "FUNNELING" (InversiÃƒÂ³n con Retorno)
            if (isHardCarry) {
                // PROGRESIVO: Ganas +3.0 pts por cada MPM por encima de 0.4.
                // 0.6 MPM -> +0.6 pts | 1.0 MPM -> +1.8 pts
                let taxReward = (alliedJungleMPM - 0.4) * 3.0;
                taxReward = parseFloat(Math.min(2.5, taxReward).toFixed(2)); // Cap en +2.5 pts
                
                total = safeAdd(total, taxReward, "Hyper-Carry Intake", notes); 
                notes.push(`Ã°Å¸Â¦Â Rey de la Selva (${alliedJungleMPM.toFixed(1)} MPM extraÃƒÂ­dos, +${taxReward} pts)`);
            } 
            
            // CASO 2: EL "PARÃƒÂSITO" (Robo SIN Impacto)
            // Empieza a castigar suavemente a partir de 0.7 MPM si el daÃƒÂ±o es bajÃƒÂ­simo (<15%)
            else if (alliedJungleMPM >= 0.7 && dmgShareForTax < 0.15) {
                // PROGRESIVO: 0.8 MPM -> -1.5 pts | 1.1 MPM -> -3.0 pts
                let taxPenalty = (alliedJungleMPM - 0.5) * -5.0;
                taxPenalty = parseFloat(Math.max(-4.0, taxPenalty).toFixed(2));

                total = safeAdd(total, taxPenalty, "Parasite", notes);
                notes.push(`Ã°Å¸Â¦Â  ParÃƒÂ¡sito de Recursos (Farm sin DaÃƒÂ±o, ${taxPenalty} pts)`);
            }
            
            // CASO 3: TAXING MOLESTO (Solo para No-Carries)
            else if (!p.win && !isValidAdcFarming && role !== 'BOTTOM') {
                if (durationMin < 35) {
                    // PROGRESIVO: 0.6 MPM -> -0.6 pts | 1.0 MPM -> -1.8 pts
                    let taxPenalty = (alliedJungleMPM - 0.4) * -3.0;
                    taxPenalty = parseFloat(Math.max(-2.5, taxPenalty).toFixed(2));

                    total = safeAdd(total, taxPenalty, "Bad Taxing", notes);
                    notes.push(`Ã°Å¸Å¡Å“ Granjero EgoÃƒÂ­sta (Le quitÃƒÂ³ jungla al JG y perdiÃƒÂ³, ${taxPenalty} pts)`);
                }
            }
        }
    }


    // --- NUEVO: INVADE MORTAL (AcciÃƒÂ³n Nivel 1 - CON FIX ANTI-BUG) ---
    // Variable: challenges.takedownsBeforeJungleMinionSpawn
    let lvl1Action = Number(p.challenges?.takedownsBeforeJungleMinionSpawn || 0);

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â SANITY CHECK: Es imposible matar a mÃƒÂ¡s de 5 personas antes de los minions.
    // Si la API devuelve mÃƒÂ¡s de 5, seguramente estÃƒÂ¡ dando "puntos de desafÃƒÂ­o" y no "cantidad".
    // Lo corregimos asumiendo que si es > 5, probablemente fue 1 o 2 kills reales, 
    // pero para no inflar, lo limitamos a mÃƒÂ¡ximo 2 si detectamos el bug.
    if (lvl1Action > 5) {
        lvl1Action = 1; // Asumimos 1 acciÃƒÂ³n real si el dato viene corrupto (ej: 18)
    }

    if (lvl1Action > 0) {
        const invadePts = lvl1Action * 0.3; // Subimos un poco el valor (0.5 por acciÃƒÂ³n real)
        total = safeAdd(total, invadePts, "Invade God", notes);
        notes.push(`Ã¢Å¡â€Ã¯Â¸Â Invade Mortal (x${lvl1Action} acciÃƒÂ³n pre-minions)`);
    }


Ã‚Â  Ã‚Â  // =========================================================
    // Ã°Å¸Å’Â² 4. JUNGLE KINGDOM (v3.0 - PROGRESSIVE ANALYTICS)
    // =========================================================
    if (isJungle) {
        
        // --- A. BONUS: SMITE GOD (Robos) ---
        const jgStolen = p.challenges?.epicMonstersStolen || 0;
        if (jgStolen > 0) {
             const stealPts = (cfg.role_jng_steal_points || 1.5) * jgStolen; // Buffado base a 1.5
             total = safeAdd(total, stealPts, "Jg Steal", notes);
             notes.push(`Ã¢Å¡Â¡ Smite God (Robaste ${jgStolen} objetivos, +${stealPts} pts)`);
        }

        // --- B. BONUS: EL INVASOR (Counter Jungle Progresivo) ---
        const enemyCamps = Number(p.challenges?.enemyJungleMonsterKills || p.enemyJungleMonsterKills || 0);
        // Empezamos a premiar a partir de 8 CS robados (aprox 2 campamentos)
        if (enemyCamps >= 8) { 
            // Progresivo: +0.15 pts por cada monstruo extra robado.
            // 16 CS -> +1.2 pts | 24 CS -> +2.4 pts
            let invadePts = (enemyCamps - 8) * 0.15;
            invadePts = Math.min(3.5, invadePts); // Cap de seguridad
            
            if (invadePts >= 0.5) {
                let label = enemyCamps >= 24 ? "Ã°Å¸Â¥Â· TERROR DEL BOSQUE" : "Ã°Å¸Â¥Â· El Invasor";
                invadePts = parseFloat(invadePts.toFixed(2));
                total = safeAdd(total, invadePts, "Invader", notes);
                notes.push(`${label} (RobÃƒÂ³ ~${Math.floor(enemyCamps / 4)} camps, +${invadePts} pts)`);
            }
        }

        // --- C. BONUS: REY DEL RÃƒÂO (Scuttles Progresivo) ---
        const scuttles = Number(p.challenges?.scuttleCrabKills || 0);
        const scuttlesPerMin = durationMin > 0 ? scuttles / durationMin : 0;

        // Baseline: 0.10 scuttles por minuto (MÃƒÂ­nimo exigible)
        if (scuttlesPerMin > 0.10) {
            // Multiplicador de 12.5 para igualar tus antiguos tiers
            // Ej: 0.22/min -> (0.22 - 0.10) * 12.5 = 1.5 pts
            let riverPts = (scuttlesPerMin - 0.10) * 12.5;
            riverPts = Math.min(2.5, riverPts); // Cap

            if (riverPts >= 0.5) {
                let label = scuttlesPerMin >= 0.22 ? "Ã°Å¸Â¦â‚¬ Rey del RÃƒÂ­o" : "Ã°Å¸Å’Å  Control de RÃƒÂ­o";
                riverPts = parseFloat(riverPts.toFixed(2));
                total = safeAdd(total, riverPts, "River King", notes);
                notes.push(`${label} (${scuttles} scuttles, +${riverPts} pts)`);
            }
        }

        // --- D. COMPARATIVA DIRECTA (Jungle Gap Progresivo) ---
        if (opponent) {

            const earlyTest = testEarlyLaneGap(p, opponent, role);
            Logger.log(`=== TEST EARLY GAME PARA ${p.summonerName} ===`);
            Logger.log(`Puntos: ${earlyTest.finalScore}`);
            Logger.log(`Detalles: ${earlyTest.debugLog}`);
            
            // 1. GAP DE FARM (CS)
            const myJgCS = p.neutralMinionsKilled || 0;
            const oppJgCS = opponent.neutralMinionsKilled || 0;
            const jgDiff = myJgCS - oppJgCS;

            // Premiamos a partir de +20 CS de diferencia
            if (jgDiff >= 20) {
                // Multiplicador: 0.05 pts por CS extra. (70 CS diff -> 50 * 0.05 = 2.5 pts)
                let csGapPts = (jgDiff - 20) * 0.05;
                csGapPts = Math.min(3.5, parseFloat(csGapPts.toFixed(2)));
                
                let label = jgDiff >= 100 ? "Ã°Å¸Å’â€¹ JUNGLE CANYON" : "Ã°Å¸Å’Â³ Control de Jungla";
                total = safeAdd(total, csGapPts, "Jg CS Gap", notes);
                notes.push(`${label} (+${jgDiff} CS, +${csGapPts} pts)`);
            } 
            // Castigamos a partir de -20 CS de diferencia
            else if (jgDiff <= -20 && durationMin >= 15) {
                // Multiplicador: 0.06 pts por CS perdido. (-70 CS diff -> -50 * 0.06 = -3.0 pts)
                let csGapPen = (jgDiff + 20) * 0.06; 
                csGapPen = Math.max(-4.0, parseFloat(csGapPen.toFixed(2)));
                
                let label = jgDiff <= -60 ? "Ã°Å¸Å¡Â« Sin Jungla" : "Ã°Å¸â€œâ€° Outjungled";
                total = safeAdd(total, csGapPen, "Jg Diff", notes);
                notes.push(`${label} (${jgDiff} CS, ${csGapPen} pts)`);
            }

            // 2. GAP DE PRESENCIA (Ganks / KP)
            const myKP = (p.challenges?.killParticipation || 0);
            const oppKP = (opponent.challenges?.killParticipation || 0);
            const kpDiff = myKP - oppKP;
            
            // Premiamos/Castigamos si la diferencia de KP es mayor al 15%
            if (kpDiff >= 0.15) { 
                let gankPts = (kpDiff - 0.10) * 6.66; // 30% diff -> +1.3 pts
                gankPts = Math.min(2.5, parseFloat(gankPts.toFixed(2)));
                total = safeAdd(total, gankPts, "Gank Gap", notes);
                notes.push(`Ã°Å¸ÂÆ’ Gank Gap (+${(kpDiff*100).toFixed(0)}% KP, +${gankPts} pts)`);
            } 
            else if (kpDiff <= -0.15 && durationMin >= 15) {
                let gankPen = (kpDiff + 0.10) * 6.66;
                gankPen = Math.max(-2.5, parseFloat(gankPen.toFixed(2)));
                // Evitar doble castigo brutal si ya sacÃƒÂ³ "Fantasma"
                if (!notes.some(n => n.includes("Fantasma"))) {
                    total = safeAdd(total, gankPen, "Gank Gap Deficit", notes);
                    notes.push(`Ã°Å¸Å¡Â¶Ã¢â‚¬ÂÃ¢â„¢â€šÃ¯Â¸Â Ausente del Mapa (${(kpDiff*100).toFixed(0)}% KP vs rival, ${gankPen} pts)`);
                }
            }
        }

        // --- E. PENALIZACIÃƒâ€œN: SMITE GAP (Te robaron) ---
        let enemyStoleSomething = 0;
        participants.forEach(enemy => {
            if (enemy.teamId !== p.teamId) {
                enemyStoleSomething += (enemy.challenges?.epicMonstersStolen || 0);
            }
        });

        if (enemyStoleSomething > 0) {
             // Aumentamos el castigo: -3.0 puntos directos por cada robo (Cap en -6.0)
             let smitePenalty = -3.0 * enemyStoleSomething;
             smitePenalty = Math.max(-6.0, smitePenalty); 
             
             total = safeAdd(total, smitePenalty, "Smite Fail", notes);
             notes.push(`Ã°Å¸Â¤Â¡ Smite Gap (Te robaron ${enemyStoleSomething} obj ÃƒÂ©pico/s, ${smitePenalty} pts)`);
        }

        // --- F. GAP DE OBJETIVOS (Macro Game Directo y Severo) ---
        // Ahora usamos la diferencia neta, no dividida por minuto. Un dragÃƒÂ³n vale oro siempre.
        const myGrubs = (teamInfo.hordeCount || 0);
        const enGrubs = (teamInfo.enemyHorde || 0);
        
        const myObjScore = (teamInfo.dragonsCount||0) + (teamInfo.baronCount||0)*1.5 + (teamInfo.heraldCount||0) + (myGrubs/3);
        const enObjScore = (teamInfo.enemyDragons||0) + (teamInfo.enemyBarons||0)*1.5 + (teamInfo.enemyHeralds||0) + (enGrubs/3);
        
        const objDiff = myObjScore - enObjScore;

        // A. PREMIO: Tu equipo dominÃƒÂ³ los objetivos (Dif >= +1.5)
        if (objDiff >= 1.5) {
            // Multiplicador: +0.8 pts por cada objetivo de ventaja
            let objPts = (objDiff - 0.5) * 0.8;
            objPts = Math.min(4.5, parseFloat(objPts.toFixed(2))); // Cap subido a +4.5

            let label = "Ã°Å¸â€œË† Ventaja Macro";
            if (objDiff >= 4.0) label = "Ã°Å¸â€˜â€˜ Rey del Mapa";
            else if (objDiff >= 2.5) label = "Ã°Å¸ÂÂ° Control SÃƒÂ³lido";

            total = safeAdd(total, objPts, "Map Stomp", notes);
            notes.push(`${label} (+${objDiff.toFixed(1)} Obj, +${objPts} pts)`);
        } 
        // B. CASTIGO: El enemigo te barriÃƒÂ³ del mapa (Dif <= -1.5)
        else if (objDiff <= -1.5 && durationMin > 15) {
            // El castigo es mÃƒÂ¡s agresivo que el premio (x1.2 pts por cada objetivo por debajo)
            let objPen = (objDiff + 0.5) * 1.2;
            objPen = Math.max(-6.0, parseFloat(objPen.toFixed(2))); // Cap hundido hasta -6.0

            let label = "Ã°Å¸â€œâ€° DÃƒÂ©ficit de Objetivos";
            if (objDiff <= -4.0) label = "Ã°Å¸Å¡Â« JUNGLE DIFF ABSOLUTO";
            else if (objDiff <= -2.5) label = "Ã°Å¸Ââ€” Out-Macroed";

            total = safeAdd(total, objPen, "Map Gap", notes);
            notes.push(`${label} (${objDiff.toFixed(1)} Obj, ${objPen} pts)`);
        }

        // --- G. PENALIZACIÃƒâ€œN: JUNGLA HERBÃƒÂVORO (AFK Farming UNIFICADO) ---
        if (durationMin >= 20) {
            const objectivesTaken = (p.dragonKills || 0) + (p.baronKills || 0) + (p.riftHeraldKills || 0) + (p.hordeKills || 0);
            const myKP = (p.challenges?.killParticipation || 0);

            // Si tiene 0 objetivos asegurados
            if (objectivesTaken === 0) {
                // Castigo base por 0 objetivos
                let herbivorePen = -1.5;
                
                // Si ademÃƒÂ¡s no gankeÃƒÂ³ (KP bajo), el castigo escala hasta -3.5
                if (myKP < 0.50) {
                    herbivorePen -= ((0.50 - myKP) * 4.0);
                }
                
                herbivorePen = Math.max(-3.5, parseFloat(herbivorePen.toFixed(2)));
                total = safeAdd(total, herbivorePen, "Jungla Pasivo", notes);
                
                const extraTxt = myKP < 0.40 ? " y Ausente" : "";
                notes.push(`Ã°Å¸Â¦Å’ Jungla HerbÃƒÂ­voro (0 Objetivos${extraTxt}, ${herbivorePen} pts)`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸Ââ€° IMPACTO EN MONSTRUOS (V15.0 - NEUTRALES PROGRESIVOS)
    // =====================================================
    // OBJETIVO: Medir control de Dragones/Baron/Heraldo.
    // EXCLUIMOS: Las Torres (ya tienen su propia secciÃƒÂ³n de puntos).
    
    // 1. LIMPIEZA DE DATOS (Restar Torres)
    const rawObjDmg = Number(p.damageDealtToObjectives || 0);
    const turretDmg = Number(p.damageDealtToTurrets || 0);
    const monsterDpm = durationMin > 0 ? Math.max(0, rawObjDmg - turretDmg) / durationMin : 0;

    // 2. CONFIGURACIÃƒâ€œN DINÃƒÂMICA POR ROL
    let baseDpm = 0; // El punto donde empiezas a ganar puntos
    let mult = 0;    // CuÃƒÂ¡nto vale cada punto de DPM
    let tGod = 0, tLeg = 0, tEpic = 0, minReq = 0;

    if (isJungle) {
        baseDpm = 500; mult = 0.00135; 
        tGod = 2000; tLeg = 1500; tEpic = 1000; minReq = 500;
    } 
    else if (isSupport) {
        baseDpm = 100; mult = 0.0022; 
        tGod = 1000; tLeg = 700; tEpic = 400; minReq = 0;
    } 
    else {
        baseDpm = 150; mult = 0.0019; 
        tGod = 1200; tLeg = 850; tEpic = 500; minReq = 100;
    }

    // 3. APLICAR RECOMPENSAS PROGRESIVAS
    // Solo empezamos a premiar si supera el umbral "Ãƒâ€°pico" de su rol
    if (monsterDpm >= tEpic) {
        
        // FÃƒâ€œRMULA: Lo que supere la base * multiplicador del rol
        // Ej JGL: 1500 DPM -> (1500 - 500) * 0.00135 = +1.35 pts
        // Ej LANER: 1200 DPM -> (1200 - 150) * 0.0019 = +2.00 pts
        let monsterPts = (monsterDpm - baseDpm) * mult;
        monsterPts = Math.min(3.5, parseFloat(monsterPts.toFixed(2))); // Cap mÃƒÂ¡ximo de seguridad

        let label = "Ã°Å¸â€”Â¡Ã¯Â¸Â Apoyo en Objetivos";
        if (monsterDpm >= tGod) label = "Ã°Å¸Ââ€° CAZADOR APEX";
        else if (monsterDpm >= tLeg) label = "Ã°Å¸Â¦â€¢ Domador de Bestias";

        if (monsterPts >= 0.5) {
            total = safeAdd(total, monsterPts, "Monster Impact", notes);
            // Evitamos spamear a los laners con la nota menor, solo mostramos las grandes
            if (label !== "Ã°Å¸â€”Â¡Ã¯Â¸Â Apoyo en Objetivos" || !isJungle) {
                notes.push(`${label} (${(monsterDpm).toFixed(0)} dpm a monstruos, +${monsterPts} pts)`);
            }
        }
    }

    // 4. PENALIZACIÃƒâ€œN PROGRESIVA: JUNGLA ALÃƒâ€°RGICO AL DRAGÃƒâ€œN
    else if (isJungle && monsterDpm < minReq && durationMin >= 20) {
        const objectivesStolen = Number(p.challenges?.epicMonstersStolen || 0);
        
        if (objectivesStolen === 0 && !willReceiveJgMitigation) {
            // FÃƒâ€œRMULA DE CASTIGO: Cuanto mÃƒÂ¡s cerca del 0, peor.
            // 250 DPM -> (250 - 500) * 0.005 = -1.25 pts
            // 0 DPM -> (0 - 500) * 0.005 = -2.50 pts
            let afkPen = (monsterDpm - minReq) * 0.005;
            afkPen = Math.max(-3.5, parseFloat(afkPen.toFixed(2)));

            total = safeAdd(total, afkPen, "Jungle AFK Obj", notes); 
            notes.push(`Ã°Å¸Â¦â€¹ Jungla AlÃƒÂ©rgico (0 Control y <${minReq} dpm, ${afkPen} pts)`);
        }
    }

    // =================================================================
    // Ã°Å¸Â¥Å  TRADING EFFICIENCY (Eficiencia de Intercambios - Progresivo)
    // =================================================================
    const totalDmgDealt = Number(p.totalDamageDealtToChampions || 0);
    const totalDmgTaken = Number(p.totalDamageTaken || 1);
    const tradeEff = totalDmgDealt / Math.max(1, totalDmgTaken);

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX: Lista oficial de tanques que no tienen por quÃƒÂ© hacer daÃƒÂ±o
    const pureTanks = ["Shen", "Ornn", "Sion", "Maokai", "Malphite", "Dr. Mundo", "Cho'Gath", "Tahm Kench", "Rammus", "Zac", "Sejuani", "Nautilus", "Leona", "Braum", "Alistar", "Taric", "Rell", "Galio", "Amumu", "Nunu", "Poppy", "Skarner"];

    // 1. Filtro de evaluaciÃƒÂ³n
    const isDamageSupport = isSupport && (p.challenges?.teamDamagePercentage > 0.15);
    const shouldEvaluate = !pureTanks.includes(p.championName) && (!isSupport || isDamageSupport);

    if (shouldEvaluate && durationMin > 15) {
        
        // --- A. PREMIOS (Mercado Alcista de Trades) ---
        // Empieza a premiar a partir de 1.1x de eficiencia
        if (tradeEff >= 1.3) {
            // FÃƒâ€œRMULA PROGRESIVA: Por cada 0.1 de ratio extra, ganas +0.15 pts
            // 1.80 ratio -> (1.8 - 1.1) * 1.5 = +1.05 pts
            // 2.70 ratio -> (2.7 - 1.1) * 1.5 = +2.40 pts (Casi clavado a tu +2.5 antiguo)
            let tradePts = (tradeEff - 1.1) * 1.5; 
            tradePts = Math.min(3.5, parseFloat(tradePts.toFixed(2))); // Cap

            let label = "Ã°Å¸â€œË† Intercambio Rentable";
            if (tradeEff >= (cfg.trade_eff_excellent || 2.7)) label = "Ã°Å¸Â¥Å  Trade GOD";
            else if (tradeEff >= 1.8) label = "Ã¢Å“Â¨ Dominio de Trades";

            total = safeAdd(total, tradePts, "Trade God", notes);
            notes.push(`${label} (x${tradeEff.toFixed(2)} eficiencia, +${tradePts} pts)`);
        }

        // --- B. CASTIGOS GENERALES (Solo Laners y Junglas de DaÃƒÂ±o) ---
        else if (!isSupport && tradeEff <= 0.85) { 
            // FÃƒâ€œRMULA PROGRESIVA INVERSA
            // 0.75 ratio -> (0.75 - 0.85) * 6.0 = -0.60 pts
            // 0.50 ratio -> (0.50 - 0.85) * 6.0 = -2.10 pts
            // 0.35 ratio -> (0.35 - 0.85) * 6.0 = -3.00 pts
            let tradePen = (tradeEff - 0.85) * 6.0;
            tradePen = Math.max(-4.0, parseFloat(tradePen.toFixed(2))); 

            // Aplicamos si el castigo es relevante
            if (tradePen <= -0.75) {
                let label = "Ã¢Å¡Â Ã¯Â¸Â Trade Ineficiente";
                if (tradeEff <= 0.35) label = "Ã°Å¸Â¤â€¢ Saco de Boxeo";
                else if (tradeEff <= 0.50) label = "Ã°Å¸â€œâ€° Malos Trades";

                total = safeAdd(total, tradePen, "Trade Fail", notes);
                notes.push(`${label} (x${tradeEff.toFixed(2)} eficiencia, ${tradePen} pts)`);
            }
        }
        
        // --- C. CASTIGOS EXCLUSIVOS (Supports de DaÃƒÂ±o que Fedean) ---
        else if (isDamageSupport && tradeEff < 0.65) {
            // Un support de daÃƒÂ±o que recibe el doble de daÃƒÂ±o del que hace es un estorbo
            let glassPen = (tradeEff - 0.65) * 4.0;
            glassPen = Math.max(-2.5, parseFloat(glassPen.toFixed(2)));

            if (glassPen <= -0.5) {
                total = safeAdd(total, glassPen, "Glass Cannon Fail", notes);
                notes.push(`Ã°Å¸â€œâ€° CaÃƒÂ±ÃƒÂ³n de Cristal Roto (x${tradeEff.toFixed(2)}, ${glassPen} pts)`);
            }
        }
    }

    // =====================================================
    // POSICIONAMIENTO PERFECTO (MID/ADC + SUPPORTS) Ã°Å¸Å½Â¯
    // =====================================================
    // Recompensa por sobrevivir (morir menos que la media) Y tener alto impacto.
    
    // 1. Requisito de Supervivencia: Morir al menos 1 vez menos que el promedio del equipo.
    if (d <= (teamAvgDeaths - 2)) {
        
        // A. Para Carries (Top/Mid/Bot): Se exige DAÃƒâ€˜O (>28%)
        if (["TOP", "MIDDLE", "BOTTOM", "JUNGLE"].includes(role) && dmgShare >= 0.28) {
             applyBonus("Ã°Å¸â€™Â¯ Posicionamiento Perfecto", 3.0); 
        }
        
        // B. Para Supports: Se exige KP ALTO (>60%) o DAÃƒâ€˜O DE MAGO (>25%)
        // (Adaptamos la exigencia porque un support de utilidad impacta con asistencias, no con daÃƒÂ±o)
        else if (["SUPPORT", "UTILITY"].includes(role)) {
             if (kp >= 0.65 || dmgShare >= 0.25) {
                 applyBonus("Ã°Å¸â€™Â¯ Posicionamiento Perfecto", 3.0); 
             }
        }
    }

    // =====================================================
    // Ã°Å¸â€Â¥ EL SOPORTE CARRY (DaÃƒÂ±o y Kills) - PROGRESIVO
    // =====================================================
    if (isSupport) {
        const dmgShare = p.challenges?.teamDamagePercentage || 0;
        
        // --- A. DAÃƒâ€˜O MASIVO (Escalado progresivo desde el 15%) ---
        if (dmgShare >= 0.15) {
            // FÃƒÂ³rmula: (Tu % DaÃƒÂ±o - 15%) * 25
            // Ej 20%: (0.20 - 0.15) * 25 = +1.25 pts
            // Ej 28%: (0.28 - 0.15) * 25 = +3.25 pts
            let dmgPts = (dmgShare - 0.15) * 25.0;
            dmgPts = Math.min(4.5, parseFloat(dmgPts.toFixed(2))); // Cap en +4.5

            let label = "Ã¢Å¡Â¡ Soporte Agresivo";
            if (dmgShare >= 0.25) {
                label = "Ã°Å¸â€Â¥ CARRY OCULTO";
            }

            total = safeAdd(total, dmgPts, "Mage Support", notes);
            notes.push(`${label} (${(dmgShare * 100).toFixed(1)}% del daÃƒÂ±o total, +${dmgPts} pts)`);
        }

        // --- B. ASESINO / SUPPORT SLAYER (Escalado progresivo desde 4 kills) ---
        // Requiere no ser un suicida (KDA >= 2.0)
        if (k >= 4 && kda >= 2.0) {
            // FÃƒÂ³rmula: +0.4 pts por cada kill a partir de la 4Ã‚Âª (La 4Ã‚Âª te da +0.4)
            // Ej 6 kills: (6 - 3) * 0.4 = +1.20 pts
            // Ej 10 kills: (10 - 3) * 0.4 = +2.80 pts
            let killerPts = (k - 3) * 0.4;
            killerPts = Math.min(3.0, parseFloat(killerPts.toFixed(2))); // Cap en +3.5

            total = safeAdd(total, killerPts, "Killer Supp", notes);
            notes.push(`Ã°Å¸â€”Â¡Ã¯Â¸Â Support Slayer (${k} Kills, +${killerPts} pts)`);
        }
    }

    // ------------------------------------------------------------
    // D. EL "SUPP KILLER" (Castigo Progresivo por KS sin impacto)
    // ------------------------------------------------------------
    // EvalÃƒÂºa si te llevas kills (K >= 4) pero tu daÃƒÂ±o es pobre (< 15%).
    if (isSupport && k >= 4) {
        const dmgPercentage = p.challenges?.teamDamagePercentage || 0;

        if (dmgPercentage < 0.15) {
            // Calculamos el dÃƒÂ©ficit de daÃƒÂ±o (Lo que te falta para llegar al 15% mÃƒÂ­nimo digno)
            const dmgDeficit = 0.15 - dmgPercentage; // Ej: 0.15 - 0.08 = 0.07 deficit
            
            // FÃƒÂ³rmula: (Tus Kills extra) * (Tu dÃƒÂ©ficit de daÃƒÂ±o * 20)
            // Si robas 6 kills y haces solo 8% de daÃƒÂ±o: (6 - 3) * (0.07 * 20) = 3 * 1.4 = -4.2 pts teÃƒÂ³ricos
            let ksPenalty = (k - 3) * (dmgDeficit * 20);

            // Agravante: Si encima mueres mucho (D >= 8), la penalizaciÃƒÂ³n duele un 50% mÃƒÂ¡s
            if (d >= 8) ksPenalty *= 1.5;

            // Atenuante: Si el equipo GANÃƒâ€œ a pesar de los KS, reducimos la multa a la mitad
            if (p.win) ksPenalty *= 0.5;

            // Aplicamos un lÃƒÂ­mite para que no rompa la escala matemÃƒÂ¡tica (MÃƒÂ­nimo -0.5, MÃƒÂ¡ximo -4.0)
            ksPenalty = Math.max(0.5, Math.min(3.0, parseFloat(ksPenalty.toFixed(2)))); 

            punishmentPoints -= ksPenalty;
            punishmentNotes.push(`Ã°Å¸â€œâ€° KDA InÃƒÂºtil (Robaste ${k} kills pero hiciste solo ${(dmgPercentage * 100).toFixed(0)}% daÃƒÂ±o, -${ksPenalty} pts)`);
        }
    }

Ã‚Â  Ã‚Â  // --- 3. OBJETIVOS (LÃƒÂ³gica de Roles: El Smite con PropÃƒÂ³sito) ---
    if (isJungle) {
        const dragons = teamInfo?.dragonsCount || 0;
        const barons = teamInfo?.baronCount || 0;
        const heralds = teamInfo?.heraldCount || 0;
        const grubs = teamInfo?.hordeCount || 0;

        let objPotentialPoints = 0;
        let objNotes = [];

        // A. CÃƒÂ¡lculo de Puntos Brutos (MEJORADO CON ALMA)
        if (dragons >= 4) { 
            // ALMA OBTENIDA
            // Base: 2.0 puntos por el Alma
            let soulPoints = 2.0;
            let soulLabel = "Alma de DragÃƒÂ³n";

            // BONUS: ALMA PERFECTA (4-0)
            // Si el enemigo tiene 0 dragones, es un STOMP de objetivos
            if (teamInfo.enemyDragons === 0) {
                soulPoints += 1.0; // Total 3.0
                soulLabel = "Ã°Å¸â€Â¥ ALMA PERFECTA (4-0)";
            }

            objPotentialPoints += soulPoints;
            objNotes.push(soulLabel);
        }
        else if (dragons >= 2) { 
             objPotentialPoints += 1.0; 
             objNotes.push(`${dragons} Drags`); 
        }

        if (barons > 0) { 
            const baronScore = 1.5 + ((barons - 1) * 0.5);
            objPotentialPoints += baronScore;
            objNotes.push(`${barons} BarÃƒÂ³n(es)`);
        }

        if (heralds > 0) { objPotentialPoints += 0.75; objNotes.push("Heraldo"); }
        
        if (grubs >= 3) { objPotentialPoints += 0.5; objNotes.push("Kevins"); }
        else if (grubs >= 2) { objPotentialPoints += 0.3; }

        // B. Ã°Å¸â€ºÂ¡Ã¯Â¸Â FILTRO DE ACTIVIDAD (Justo para Tanques y Utilidad)
        // Definimos si el Jungla ha participado realmente en la partida:
        const hasGoodDamage = dpm >= 500;                 // Ã‚Â¿Ha pegado?
        const hasGoodCC = totalCCPerMin >= 2.0;          // Ã‚Â¿Ha stuneado? (Sejuani/Malphite)
        const hasGoodUtility = utilityPerMin >= 400;     // Ã‚Â¿Ha puesto escudos/curas? (Ivern)

        // Si NO cumple ninguna de las 3, es un "Jungla Pasivo"
        let finalObjPoints = objPotentialPoints;
        
        if (durationMin > 18 && !hasGoodDamage && !hasGoodCC && !hasGoodUtility) {
            finalObjPoints = objPotentialPoints * 0.4;
            notes.push(`Ã°Å¸Å¡Å“ Jungla Pasivo (Bono objetivos reducido 60% por falta de presencia)`);
        }

        // C. CAP DE SEGURIDAD Y APLICACIÃƒâ€œN
        finalObjPoints = Math.min(finalObjPoints, 5.0);

        if (finalObjPoints > 0) {
            total = safeAdd(total, finalObjPoints, "Jg Objectives", notes);
            notes.push(`Ã°Å¸Ââ€° Impacto Macro (+${finalObjPoints.toFixed(1)} pts)`);
            if (objNotes.length > 0) notes.push(`[${objNotes.join(", ")}]`);
        }
    }

    // --- BONUS DE EQUIPO: ALMA ---
    if (teamInfo.dragonsCount >= 4) {
        // Un pequeÃƒÂ±o extra para todos por conseguir la condiciÃƒÂ³n de victoria
        total = safeAdd(total, 1.0, "Soul Team", notes);
        notes.push("Ã°Å¸Ââ€° Bonus Alma");
    }

    // --- ESTRUCTURAS DE EQUIPO (Torres e Inhibidores) ---
    const towers = teamInfo?.towerCount || 0;
    const inhibs = teamInfo?.inhibitorCount || 0;
    
    // CÃƒÂ¡lculo: 0.1 por Torre / 0.25 por Inhibidor
    let structurePoints = (towers * 0.1) + (inhibs * 0.25);

    if (structurePoints > 0) {
        // 1. PUNTOS SILENCIOSOS: Se suman siempre al total
        total = safeAdd(total, structurePoints);

        // 2. ETIQUETA SOLO EN STOMP:
        // Solo imprimimos si tirasteis 9+ Torres (casi todas) O 2+ Inhibidores
        if (towers >= 9 || inhibs >= 2) {
            notes.push(`Ã°Å¸Ââ€”Ã¯Â¸Â DemoliciÃƒÂ³n Total (${towers}T / ${inhibs}I)`);
        }
    }

    // --- 4. BIG PLAYS & MOMENTOS Ãƒâ€°PICOS ---
    const multi = p.largestMultiKill || 0;
    if (multi >= 5) { total = safeAdd(total, cfg.penta_points || 10, "Penta", notes); notes.push("Ã‚Â¡PENTAKILL!"); }
    else if (multi === 4) { total = safeAdd(total, 3.0, "Quadra", notes); notes.push("Quadrakill"); }

    if (p.firstBloodKill) { total = safeAdd(total, 0.5, "First Blood", notes); notes.push("Ã°Å¸Â©Â¸ Primera Sangre"); }

    // --- PENALIZACIÃƒâ€œN: PRIMERA VÃƒÂCTIMA ---
    if (p.firstBloodVictim) {
        total = safeAdd(total, -1.0, "FB Victim", notes);
        notes.push(`Ã°Å¸Â©Â¸ Primera VÃƒÂ­ctima (RegalÃƒÂ³ la FB)`);
    }

    // --- NUEVO: CAZARRECOMPENSAS (Shutdowns) ---
    // Variable: challenges.shutdowns
    const bountiesCollected = Number(p.challenges?.shutdowns || 0);

    if (bountiesCollected >= 1) {
        // 1 punto por cada shutdown, son muy valiosos
        total = safeAdd(total, bountiesCollected * 1.0, "Bounty Hunter", notes);
        notes.push(`Ã°Å¸â€™Â° Cazarrecompensas (CobrÃƒÂ³ ${bountiesCollected} shutdowns)`);
    }

    const clutchKills = p.challenges?.killsOnPlayersWithinKills || 0;
    if (clutchKills > 0) {
        const clutchPts = clutchKills * cfg.clutch_play_points;
        applyBonus(`Ã°Å¸Â¦Â¾ El Clutch (x${clutchKills})`, clutchPts);
    }

    // =====================================================
    // Ã°Å¸Â¥â€¹ EL SECUESTRADOR V3.0 (Insec Plays Progresivo)
    // =====================================================
    // Variable: knockEnemyIntoTeamAndKill
    // Mide cuÃƒÂ¡ntas veces desplazaste a un enemigo hacia tu equipo y muriÃƒÂ³.
    
    const insecPlays = Number(p.challenges?.knockEnemyIntoTeamAndKill || 0);
    const insecPerMin = durationMin > 0 ? insecPlays / durationMin : 0;

    // REQUISITO MÃƒÂNIMO: 4 jugadas totales para considerar que fue intencional y no suerte.
    if (insecPlays >= 4) {
        
        // 1. BASELINE: 0.10 jugadas por minuto como el "mÃƒÂ­nimo para empezar a puntuar".
        const baseInsec = 0.10;
        
        if (insecPerMin > baseInsec) {
            // 2. FÃƒâ€œRMULA PROGRESIVA: Por cada 0.1 jugadas/min extra, damos +0.5 pts.
            let insecPts = (insecPerMin - baseInsec) * 5.0;
            
            // Cap mÃƒÂ¡ximo de seguridad
            insecPts = Math.max(0, Math.min(3.5, insecPts));

            if (insecPts >= 0.5) {
                // 3. ETIQUETAS ORIGINALES INTACTAS (Basadas en tus umbrales)
                let rankLabel = "";
                if (insecPerMin >= 0.50) rankLabel = `Ã°Å¸Å’ÂªÃ¯Â¸Â Sensei Coral`;
                else if (insecPerMin >= 0.38) rankLabel = `Ã°Å¸Â¥â€¹ CinturÃƒÂ³n Negro`;
                else rankLabel = `Ã°Å¸Â¤Â¼ Judoka`;

                insecPts = parseFloat(insecPts.toFixed(2));
                total = safeAdd(total, insecPts);
                notes.push(`${rankLabel} (${insecPlays} plays, ${insecPerMin.toFixed(2)}/min, +${insecPts} pts)`);
            }
        }
    }

    // --- NUEVO: WOMBO COMBO (Multikill InstantÃƒÂ¡nea) ---
    // Variable: challenges.multiKillOneSpell
    // Detecta ultimates devastadoras (MF, Fiddle, Kennen, GP...)
    const womboCount = Number(p.challenges?.multiKillOneSpell || 0);

    if (womboCount > 0) {
        total = safeAdd(total, 1.5, "Wombo Combo", notes);
        notes.push(`Ã°Å¸â€™Â¥ Colateral`);
    }
   
    // =================================================================
    // Ã°Å¸Ââ€”Ã¯Â¸Â DEMOLICIÃƒâ€œN Y ESTRUCTURAS (Ajustado por Rol v3.1)
    // =================================================================
    
    // --- 1. PLACAS (Early Game) ---
    const plates = (p.challenges?.turretPlatesTaken) || (p.turretPlatesTaken) || 0;
   
    if (plates > 0) {
        // Dinero silencioso: Se mantiene para todos (es oro ganado)
        const platePoints = plates * 0.05;
        total = safeAdd(total, platePoints);

        // Etiqueta: Solo para Laners (evita que un Jungla que pasa por ahÃƒÂ­ se la lleve)
        if (plates >= 6 && isLaner) {
            notes.push(`Ã°Å¸Ââ€”Ã¯Â¸Â El Destructor (${plates} placas)`);
        }
    }

    // --- 2. PRIMER LADRILLO ---
    const gotFirstBrick = p.firstTowerKill || p.firstTowerAssist || (p.challenges?.firstTurretKilled);
    if (gotFirstBrick) {
         applyBonus("Ã°Å¸Â§Â± Primer Ladrillo", 1.25);
    }

   // =================================================================
    // Ã°Å¸Å¡Å“ DAÃƒâ€˜O A ESTRUCTURAS V4.0 (Progresivo Escalado por Rol)
    // =================================================================
    const towerDmg = Number(p.damageDealtToTurrets || 0);
    const towerDpm = durationMin > 0 ? towerDmg / durationMin : 0;
    
    // --- FACTOR DE EXIGENCIA POR ROL ---
    // Cuanto mÃƒÂ¡s alto es el factor, mÃƒÂ¡s DPM a torres necesitas para empezar a ganar puntos.
    let roleFactor = 1.0;
    if (role === 'TOP') roleFactor = 1.0;
    else if (role === 'MIDDLE' || role === 'JUNGLE') roleFactor = 1.25;
    else if (role === 'BOTTOM') roleFactor = 1.35; 
    else roleFactor = 3.0; // Los supports lo tienen muy difÃƒÂ­cil

    // 1. BASELINE: Lo mÃƒÂ­nimo para que se considere un "Buen Asedio"
    // Para un Toplaner son 200 DPM a torres. Para un Supp son 600 DPM.
    const baseTowerDpm = 200 * roleFactor;

    // Solo calculamos si superas la exigencia mÃƒÂ­nima de tu rol
    if (towerDpm > baseTowerDpm) {
        
        // 2. FÃƒâ€œRMULA PROGRESIVA: Por cada 100 de DPM extra sobre la base, damos +0.5 pts. (Multiplicador: 0.005)
        let structPts = (towerDpm - baseTowerDpm) * 0.004;
        
        // Cap mÃƒÂ¡ximo de seguridad (Nadie puede ganar mÃƒÂ¡s de 3.0 pts solo por pegar a torres)
        structPts = Math.max(0, Math.min(3.0, structPts)); 

        // Solo aplicamos si la cantidad es relevante (>= 0.5) para no ensuciar el log con "+0.1 pts"
        if (structPts >= 0.5) {
            let label = "Ã°Å¸ÂªÂ Buen asedio";
            if (structPts >= 3.0) label = "Ã°Å¸â€™Â£ Ã‚Â¡Demoledor Pro!";
            else if (structPts >= 2.0) label = "Ã°Å¸Å¡Â§ Asedio Pesado";

            structPts = parseFloat(structPts.toFixed(2));
            total = safeAdd(total, structPts);
            notes.push(`${label} (${towerDpm.toFixed(0)} dmg/min, +${structPts} pts)`);
        }
    }

    // =================================================================
    // Ã°Å¸Â§Â± EL ASEDIO V4.0 (% DaÃƒÂ±o del Equipo - Progresivo)
    // =================================================================
    const teamTowerDmgStruct = participants
        .filter(pt => pt.teamId === p.teamId)
        .reduce((acc, pt) => acc + (Number(pt.damageDealtToTurrets) || 0), 0);
            
    if (teamTowerDmgStruct > 0) {
        const towerShare = towerDmg / teamTowerDmgStruct;
        
        // Requisito extra: Si NO eres Top, necesitas haber dado el last hit a 2 estructuras
        const structuresLocal = Number(p.turretKills || 0) + Number(p.inhibitorKills || 0);
        const isValidSiege = (role === 'TOP') || (structuresLocal >= 2);

        // AdemÃƒÂ¡s, exigimos un daÃƒÂ±o bruto mÃƒÂ­nimo de 5000 para que nadie gane puntos
        // teniendo el 100% de share en un equipo que solo hizo 100 de daÃƒÂ±o a una torre.
        if (isValidSiege && towerDmg > 5000) {
            
            // 1. BASELINE: Asumimos que hacer el 25% (0.25) del daÃƒÂ±o ya es tu responsabilidad base.
            const baseShare = 0.25;
            
            if (towerShare > baseShare) {
                // 2. FÃƒâ€œRMULA PROGRESIVA: Por cada 10% (0.10) extra sobre el 25%, damos +1.0 pt. (Multiplicador: 10)
                let siegePts = (towerShare - baseShare) * 10.0;
                
                // Cap mÃƒÂ¡ximo de seguridad (3.5 pts si haces el 70% del daÃƒÂ±o o mÃƒÂ¡s)
                siegePts = Math.max(0, Math.min(3.5, siegePts));
                
                // Solo registramos si es un puntaje destacable
                if (siegePts >= 0.8) {
                    let label = "Ã°Å¸â€Â¨ AlbaÃƒÂ±il";
                    if (siegePts >= 3.0) label = "Ã°Å¸Ââ€”Ã¯Â¸Â EL ASEDIO";
                    else if (siegePts >= 2.0) label = "Ã°Å¸ÂªÂµ Ariete";

                    siegePts = parseFloat(siegePts.toFixed(2));
                    total = safeAdd(total, siegePts);
                    notes.push(`${label} (${(towerShare*100).toFixed(0)}% del daÃƒÂ±o, +${siegePts} pts)`);
                }
            }
        }
    }

    // =====================================================
    // Ã°Å¸ÂÂº EL LOBO ESTEPARIO (Torres en Solitario Late Game)
    // =====================================================
    // Variable: challenges.soloTurretsLategame
    // Destruir torres completamente solo despuÃƒÂ©s del early game.
    const soloTurrets = Number(p.challenges?.soloTurretsLategame || 0);

    if (soloTurrets > 1) {
        // TIER 2: REY DEL BACKDOOR (2+ Torres Solitarias)
        // Abrir la base tÃƒÂº solo mientras tu equipo distrae.
        if (soloTurrets >= 3) {
            total = safeAdd(total, 2.5, "Split God", notes);
            notes.push(`Ã°Å¸ÂÂº LOBO ESTEPARIO (TirÃƒÂ³ ${soloTurrets} torres completamente solo)`);
        }
        // TIER 1: PRESIÃƒâ€œN DIVIDIDA (1 Torre Solitaria)
        else {
            total = safeAdd(total, 1.0, "Solo Split", notes);
            notes.push(`Ã°Å¸ÂÅ¡Ã¯Â¸Â PresiÃƒÂ³n Dividida (1 torre solo)`);
        }
    }

   

      // --- Saco de Boxeo (Eficiencia de Tanqueo) ---
      const dmgTaken = Number(p.totalDamageTaken || 0);
      const deathsForTank = Math.max(1, d);
      const tankEfficiency = dmgTaken / deathsForTank;
      if (["TOP", "JUNGLE", "SUPPORT"].includes(role) && tankEfficiency >= (cfg.tank_efficiency_threshold || 40000)) {
          total = safeAdd(total, cfg.tank_efficiency_points || 1.5, "Saco Boxeo", notes);
          notes.push(`Ã°Å¸Â¥Å  Saco de Boxeo (${(tankEfficiency/1000).toFixed(0)}k dmg/muerte)`);
      }

    

      // --- Lobo Solitario (Splitpush) ---
      // Usamos 'hullbreaker' (daÃƒÂ±o a torres sin aliados cerca) si estÃƒÂ¡ disponible, o una aproximaciÃƒÂ³n
      const splitDmg = p.challenges?.hullbreakerDamage || 0;
      if (role === "TOP" && splitDmg >= (cfg.hullbreaker_threshold || 4000)) {
          total = safeAdd(total, cfg.hullbreaker_points || 1.0, "Lobo Solitario", notes);
          notes.push(`Lobo Solitario (${(splitDmg/1000).toFixed(1)}k split dmg)`);
      }

      // --- Moneda al Aire (Real Gamble 50/50) ---
      // Si tienes Kills >= 10 Y Muertes >= 10, eres inestable. El sistema decide tu suerte.
      if (k >= 11 && d >= 11) {
          // Math.random() genera un nÃƒÂºmero entre 0.0 y 1.0
          const isHeads = Math.random() >= 0.5; // 50% Probabilidad

          if (isHeads) {
              total = safeAdd(total, 1.0, "Coinflip Win", notes);
              notes.push(`Ã°Å¸Âªâ„¢ Coinflip: CARA (+1.0)`);
          } else {
              total = safeAdd(total, -1.0, "Coinflip Loss", notes);
              notes.push(`Ã°Å¸Âªâ„¢ Coinflip: CRUZ (-1.0)`);
          }
      }

      // --- Maratoniano ---
      if (p.win && durationMin >= (cfg.marathon_min || 47)) {
          total = safeAdd(total, cfg.marathon_points || -3.5, "Maratoniano", notes);
          notes.push(`Ã°Å¸ÂªÂ  Desatascador (+${durationMin} min)`);
      }

      // --- La Mochila (Carried) ---
      if (p.win && !isSupport && kda < 1.6 && dmgShare < 0.14) {
          // Restamos puntos para equilibrar los puntos de victoria base
          total = safeAdd(total, -2.0, "Carried", notes); 
          notes.push(`Ã°Å¸â€ºâ€™ GET CARRIED (Ganaste pero... KDA ${kda.toFixed(1)})`);
      }

    // =========================================================
    // Ã°Å¸â€œÂº MÃƒâ€œDULO: EL CRONÃƒâ€œMETRO DE LA PARCA V4.0 (Progresivo + Etiquetas ClÃƒÂ¡sicas)
    // =========================================================
    const timeDeadSeconds = Number(p.totalTimeSpentDead || 0);
    const gameDurationSeconds = durationMin * 60;
    
    // Solo analizamos partidas de >15 min para evitar sesgos en stomps rÃƒÂ¡pidos
    if (gameDurationSeconds > 0 && durationMin > 15) {
        
        const deadRatio = timeDeadSeconds / gameDurationSeconds;
        const deadPercent = (deadRatio * 100).toFixed(1);
        
        // --- 1. DETECCIÃƒâ€œN DE CONTEXTO ---
        const teamTowerDmgTotal = participants.filter(pt => pt.teamId === p.teamId).reduce((ac, c) => ac + (c.damageDealtToTurrets||0), 0);
        const isSplitStrategy = (myTowerDmg > 7500) || 
                                (teamTowerDmgTotal > 0 && (myTowerDmg/teamTowerDmgTotal) > 0.65 && myTowerDmg > 3500);

        const isMartyr = kp >= 0.65;

        // --- 2. ASIGNACIÃƒâ€œN DE ETIQUETA (LORE) ---
        let baseNote = "";
        
        if (deadRatio >= 0.30) {
            baseNote = `Ã°Å¸Å½Â¬ Netflix & Chill`;
        } else if (deadRatio >= 0.25) {
            baseNote = `Ã°Å¸â€˜Â» Espectador VIP`;
        } else if (deadRatio >= 0.20) {
            baseNote = `Ã°Å¸â€œÂº Simulador de Pantalla Gris`;
        } else if (deadRatio >= 0.15 && kp < 0.40) {
            // A los descuidados solo se les castiga si ademÃƒÂ¡s ayudan poco
            baseNote = `Ã¢Å¡Â Ã¯Â¸Â Descuidado`;
        }

        // --- 3. CÃƒÂLCULO PROGRESIVO DE PUNTOS ---
        if (baseNote !== "") {
            // Empezamos a restar desde el 12% (0.12) de tiempo muerto base aceptable.
            // FÃƒÂ³rmula: -(Exceso * 35). Da un escalado muy parecido a tus puntos originales, pero con decimales.
            let rawPenalty = -((deadRatio - 0.12) * 35); 

            let modifier = 1.0;
            let suffix = "";

            // --- 4. APLICACIÃƒâ€œN DE MODIFICADORES (Intactos) ---
            if (isSplitStrategy) {
                modifier = 0.85; 
                suffix = " (Mitigado: Splitpush)";
            } else if (isMartyr) {
                modifier = 0.70; 
                suffix = " (Mitigado: Sacrificio ÃƒÅ¡til)";
            } else if (kp < 0.30) {
                modifier = 1.50; 
                suffix = " + Ã°Å¸â€™â‚¬ Cero Impacto";
            }

            let finalTimerPenalty = rawPenalty * modifier;

            // Cap mÃƒÂ¡ximo de seguridad (Para que nadie pierda mÃƒÂ¡s de 12 puntos por esto)
            finalTimerPenalty = Math.max(-12.0, finalTimerPenalty);

            // Redondeamos para el historial
            finalTimerPenalty = parseFloat(finalTimerPenalty.toFixed(2));
            
            total = safeAdd(total, finalTimerPenalty);
            // El mensaje quedarÃƒÂ¡ igual que antes, pero con el valor progresivo:
            // Ej: "Ã°Å¸â€œÂº Simulador de Pantalla Gris (22.4% muerto, -3.64 pts)"
            notes.push(`${baseNote} (${deadPercent}% muerto${suffix}, ${finalTimerPenalty} pts)`);
        }
    }

    // --- NUEVO: EL SHOTCALLER (Liderazgo) ---
    // Sumamos pings ÃƒÂºtiles (Peligro, SS, AtrÃƒÂ¡s)
    const comms = (p.enemyMissingPings || 0) + (p.dangerPings || 0) + (p.getBackPings || 0);
    
    // Filtro Anti-Spam: Si haces mÃƒÂ¡s de 80 pings de estos, probablemente estÃƒÂ¡s tilteado spameando
    if (comms >= 30 && comms <= 80) {
        total = safeAdd(total, 1.0, "LÃƒÂ­der", notes);
        notes.push(`Ã°Å¸â€”Â£Ã¯Â¸Â Shotcaller (${comms} pings tÃƒÂ¡cticos)`);
    } else if (comms > 80) {
        // Opcional: PenalizaciÃƒÂ³n por spammer tÃƒÂ³xico
        total = safeAdd(total, -0.5, "Toxic", notes);
         notes.push(`Ã°Å¸â€â€¡ Spammer (${comms} pings)`);
    }

    // --- NUEVO: CONTROL DE MAPA (VisiÃƒÂ³n Ofensiva - NERF S26) ---
    const aggressiveVision = Number(p.challenges?.controlWardTimeCoverageInRiverOrEnemyHalf || 0);
    
    // Subimos la exigencia: 
    // Tier 1: De 0.65 -> 0.72 (72%)
    // Tier 2: De 0.85 -> 0.88 (88%)
    if (aggressiveVision >= 0.85) {
        total = safeAdd(total, 1.5, "Gran Hermano", notes);
        notes.push(`Ã°Å¸â€˜ÂÃ¯Â¸Â Gran Hermano (${(aggressiveVision*100).toFixed(0)}% mapa controlado)`);
    } else if (aggressiveVision >= 0.72) {
        total = safeAdd(total, 0.5, "VigÃƒÂ­a", notes);
        notes.push(`Ã°Å¸â€Â¦ VigÃƒÂ­a de RÃƒÂ­o (${(aggressiveVision*100).toFixed(0)}% mapa controlado)`);
    }


    // --- RESILIENCIA V2 (Sobrevivir a Focus Masivo por Minuto) ---
    // Variable: challenges.survivedThreeImmobilizesInFight
    // Veces que te comes 3+ CCs en una pelea y sales vivo.
    
    const raidBossMoments = Number(p.challenges?.survivedThreeImmobilizesInFight || 0);
    const bossPerMin = durationMin > 0 ? raidBossMoments / durationMin : 0;

    // MÃƒÂ­nimo 2 momentos para puntuar
    if (raidBossMoments >= 2) {
        let bossPts = 0;
        let label = "";
        
        // Distinguir nombre segÃƒÂºn el rol (Sabor)
        const isTanky = ["TOP", "JUNGLE", "SUPPORT"].includes(role);

        // TIER 2: INDESTRUCTIBLE (> 0.25/min)
        // Significa que cada 4 minutos sobrevives a un focus bestial.
        // Ej: 5 veces en 20 min || 8 veces en 30 min.
        if (bossPerMin >= 0.31) {
            bossPts = 2.0;
            label = isTanky ? `Ã°Å¸Â¦â€“ RAID BOSS` : `Ã°Å¸â€™Â¨ INATRAPABLE`;
            notes.push(`${label} (Focus resistido ${raidBossMoments} veces)`);
        } 
        // TIER 1: DURO DE MATAR (> 0.12/min)
        // Ej: 3 veces en 20 min || 4 veces en 30 min.
        else if (bossPerMin >= 0.20) {
            bossPts = 1.0;
            label = isTanky ? `Ã°Å¸â€ºÂ¡Ã¯Â¸Â Coloso` : `Ã°Å¸Â§Ëœ Mente FrÃƒÂ­a`;
            notes.push(`${label} (Focus resistido ${raidBossMoments} veces)`);
        }

        if (bossPts > 0) {
            total = safeAdd(total, bossPts, "Tenacidad", notes);
        }
    }

      // =====================================================
    // Ã°Å¸Âªâ€ž EL ESCAPISTA V3 (Sobrevivir a <10% HP) - PROGRESIVO
    // =====================================================
    const escapes = Number(p.challenges?.survivedSingleDigitHpCount || 0);
    
    if (escapes >= 1) {
        // FÃƒÂ³rmula progresiva: +0.8 pts por cada escape al lÃƒÂ­mite
        // 1 escape = +0.80 | 2 escapes = +1.60 | 3 escapes = +2.40 | 4 = +3.20
        let escapePts = escapes * 0.8;
        escapePts = Math.min(4.0, parseFloat(escapePts.toFixed(2))); // Cap mÃƒÂ¡ximo de +4.0

        let label = "Ã°Å¸Ââ‚¬ Supervivencia Extrema";
        if (escapes >= 4) {
            label = "Ã°Å¸Âªâ€ž GRAN ESCAPISTA";
        } else if (escapes >= 2) {
            label = "Ã°Å¸Å½Â© HOUDINI";
        }

        total = safeAdd(total, escapePts, "Escapista", notes);
        notes.push(`${label} (x${escapes} al lÃƒÂ­mite, +${escapePts} pts)`);
    }

    // =====================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â LA MURALLA (DaÃƒÂ±o Mitigado) - PROGRESIVO
    // =====================================================
    const selfMitigated = Number(p.damageSelfMitigated || 0);
    const mitigatedPerMin = durationMin > 0 ? selfMitigated / durationMin : 0;

    // Permitimos entrar a los roles tanque, O a cualquiera que haya mitigado una absoluta locura (Ej: Mid Galio)
    if (isTankRole || mitigatedPerMin > 2000) { 
        
        // Empezamos a premiar de forma notable a partir de los 1200/min
        if (mitigatedPerMin >= 1200) {
            
            // FÃƒÂ³rmula: Base 1000. Ganas +1.0 pts por cada 500 de daÃƒÂ±o mitigado extra.
            // Ej 1500/min: (1500 - 1000) * 0.002 = +1.00 pts (Exacto a tu Tier 1 antiguo)
            // Ej 2500/min: (2500 - 1000) * 0.002 = +3.00 pts (Buffado respecto a tu Tier 2)
            // Ej 3500/min: (3500 - 1000) * 0.002 = +5.00 pts
            let tankPts = (mitigatedPerMin - 1000) * 0.002;
            tankPts = Math.min(5.0, parseFloat(tankPts.toFixed(2))); // Cap mÃƒÂ¡ximo

            let label = "Ã°Å¸â€ºÂ¡Ã¯Â¸Â Escudo Humano";
            if (mitigatedPerMin >= 3000) {
                label = "Ã°Å¸Ââ€Ã¯Â¸Â COLOSO INAMOVIBLE";
            } else if (mitigatedPerMin >= 2200) {
                label = "Ã°Å¸â€ºÂ¡Ã¯Â¸Â Muralla de Titanio";
            } else if (mitigatedPerMin >= 1500) {
                label = "Ã°Å¸â€ºÂ¡Ã¯Â¸Â Duro de Pelar";
            }

            total = safeAdd(total, tankPts, "Tank Mitigado", notes);
            notes.push(`${label} (${mitigatedPerMin.toFixed(0)}/min, +${tankPts} pts)`);
        }
    }

    // --- NUEVO: SPAWN CAMPER (HumillaciÃƒÂ³n) ---
    // Variable: challenges.takedownsInEnemyFountain
    // Mide si mataste a alguien buceando en SU fuente.
    const fountainKills = Number(p.challenges?.takedownsInEnemyFountain || 0);

    if (fountainKills > 0) {
        // Es una jugada de riesgo y bm (bad manners), pero indica stomp.
        total = safeAdd(total, 1.0 * fountainKills, "Spawn Camper", notes);
        notes.push(`Ã°Å¸â€™â‚¬ Spawn Camper (MatÃƒÂ³ a ${fountainKills} en la fuente)`);
    }

    // =========================================================
    // 3. MATRIX & REFLEJOS (Movilidad) - BALANCEADO v2.0
    // =========================================================
    
    // FILTRO DE DIGNIDAD:
    // No recibes premios de movilidad si:
    // A. Mueres demasiado (>7) y tienes mal KDA (eres un feeder).
    // B. No participas en la partida (KP < 35%). Esquivar huyendo no cuenta.
    const isInting = (d >= 8 && kda < 1.5);
    const isCoward = kp < 0.35; // <--- NUEVO: Si no ayudas, no hay premio Matrix

    // --- A. MATRIX (Skillshots Esquivados) ---
    const dodged = Number(p.challenges?.skillshotsDodged || 0);
    const dodgedPerMin = durationMin > 0 ? dodged / durationMin : 0;

    // Solo entramos si juegas dignamente (Ni fedeas, ni te escondes)
    if (!isInting && !isCoward) {
        
        // TIER 3: NEO (> 5.2/min) - Subido de 5.0
        if (dodgedPerMin >= 5.2 && dodged > 180) {
            total = safeAdd(total, 2.5, "Neo Mode", notes);
            notes.push(`Ã°Å¸â€¢Â¶Ã¯Â¸Â NEO: El Elegido (${dodged} esquives, ${dodgedPerMin.toFixed(1)}/min)`);
        } 
        // TIER 2: MATRIX MODE (> 4.0/min) - Subido de 3.8
        else if (dodgedPerMin >= 4.0 && dodged > 120) {
            total = safeAdd(total, 1.25, "Matrix Mode", notes);
            notes.push(`Ã°Å¸â€™Å  Matrix Mode (${dodgedPerMin.toFixed(1)} esquives/min)`);
        } 
        // TIER 1: PIES LIGEROS (> 3.0/min) - Subido de 2.7
        else if (dodgedPerMin >= 3.0 && dodged > 60) {
            total = safeAdd(total, 0.75, "Pies Ligeros", notes);
            notes.push(`Ã°Å¸â€˜Å¸ Pies Ligeros (${dodgedPerMin.toFixed(1)} esquives/min)`);
        }
    }

    // --- B. REFLEJOS DE DIOS (Esquives CrÃƒÂ­ticos) ---
    const clutchDodges = Number(p.challenges?.dodgeSkillShotsSmallWindow || 0);
    const clutchPerMin = durationMin > 0 ? clutchDodges / durationMin : 0;

    if (clutchDodges >= 3 && !isInting) { // AÃƒÂ±adido !isInting
        // TIER 3: Ã‚Â¿SCRIPTER?
        if (clutchPerMin >= 1.5) {
            total = safeAdd(total, 2.5, "Human Script", notes);
            notes.push(`Ã°Å¸Â¤â€“ Ã‚Â¿SCRIPTER? (${clutchDodges} dodges, ${clutchPerMin.toFixed(2)}/min)`);
        } 
        // TIER 2: ULTRA INSTINTO
        else if (clutchPerMin >= 0.9) {
            total = safeAdd(total, 1.5, "Ultra Instinto", notes);
            notes.push(`Ã¢Å¡Â¡ Ultra Instinto (${clutchPerMin.toFixed(2)}/min)`);
        } 
        // TIER 1: BUENOS REFLEJOS
        else if (clutchPerMin >= 0.6) {
            total = safeAdd(total, 0.75, "Reflejos", notes);
            notes.push(`Ã°Å¸â€™Â¨ Buenos Reflejos (${clutchPerMin.toFixed(2)}/min)`);
        }
    }

    // =====================================================
    // Ã°Å¸Å½Â¹ EL PIANISTA (Casteos por Minuto - CPM)
    // =====================================================
    // Suma cuÃƒÂ¡ntas veces pulsÃƒÂ³ Q, W, E, R
    const casts = (p.spell1Casts || 0) + (p.spell2Casts || 0) + (p.spell3Casts || 0) + (p.spell4Casts || 0);
    const cpm = durationMin > 0 ? casts / durationMin : 0;

    // Lista de Spammers conocidos (Exigencia alta)
    const buttonMashers = ["Zeri", "Cassiopeia", "Ryze", "Ezreal", "Karthus", "Hecarim", "Evelynn", "Yasuo", "Yone"];
    const isMasher = buttonMashers.includes(p.championName);

    // TIER 3: DEDOS DE FUEGO (> 45 casts/min) - Nivel Zeri/Cassio Scripting
    // (Unas 1350 habilidades en 30 min)
    if (cpm >= 35) {
        total = safeAdd(total, 2.5, "Pianista God", notes);
        notes.push(`Ã°Å¸Å½Â¹ DEDOS DE FUEGO (${cpm.toFixed(0)} casts/min)`);
    }
    // TIER 2: MECÃƒÂNICO (> 30 casts/min)
    else if (cpm >= 20) {
        total = safeAdd(total, 1.5, "Mechanics", notes);
        notes.push(`Ã¢Å¡â„¢Ã¯Â¸Â MecÃƒÂ¡nico (${cpm.toFixed(0)} casts/min)`);
    }
    
    // PENALIZACIÃƒâ€œN: EL DORMILÃƒâ€œN (Solo para Spammers)
    // Si usas a Zeri o Ryze y tiras menos de 15 habilidades por minuto, algo va mal.
    else if (isMasher && cpm < 10 && durationMin > 15) {
        total = safeAdd(total, -1.0, "Low APM", notes);
        notes.push(`Ã°Å¸â€™Â¤ DormilÃƒÂ³n con ${p.championName} (${cpm.toFixed(0)} casts/min)`);
    }

    // =====================================================
    // Ã°Å¸â€˜Â¹ EL CLEPTÃƒâ€œMANO (Robo de Red/Blue)
    // =====================================================
    // Variable: challenges.buffsStolen
    const stolenBuffs = Number(p.challenges?.buffsStolen || 0);

    if (stolenBuffs > 1) {
        // TIER 2: PESADILLA DEL JUNGLA (3+ Buffs robados)
        if (stolenBuffs >= 4) {
            total = safeAdd(total, 1.0, "Buff Thief God", notes);
            notes.push(`Ã°Å¸â€˜Â¹ CLEPTÃƒâ€œMANO (RobÃƒÂ³ ${stolenBuffs} Buffs Rojos/Azules)`);
        }
        // TIER 1: LADRONZUELO (1-2 Buffs)
        else {
            total = safeAdd(total, 0.2, "Buff Thief", notes);
            notes.push(`Ã°Å¸â€˜Âº LadrÃƒÂ³n de Buffs (x${stolenBuffs})`);
        }
    }    

    // =========================================================
    // 4. EL LADRÃƒâ€œN (Counter Jungle) - CORREGIDO
    // =========================================================
    // FIX: La variable estÃƒÂ¡ dentro de 'challenges', no en la raÃƒÂ­z.
    const enemyJungleCS = Number(p.challenges?.enemyJungleMonsterKills || 0);
    
    // Calculamos ritmo (CS robado por minuto)
    const invadesPerMin = durationMin > 0 ? enemyJungleCS / durationMin : 0;

    // Solo aplica si NO eres Support y has robado algo significativo (>15 CS)
    if (role !== "SUPPORT" && enemyJungleCS >= 15) {
        
        // TIER 2: TU JUNGLA ES MÃƒÂA (> 1.2 CS robados/min)
        // Ej: Robar ~36 CS en 30 min (Aprox 6-7 campamentos enteros)
        if (invadesPerMin >= 1.0) {
            total = safeAdd(total, 1.5, "Jungle Gap", notes);
            notes.push(`Ã°Å¸Ââ€¢Ã¯Â¸Â Tu Jungla es MÃƒÂ­a (${enemyJungleCS} CS robados)`);
        } 
        // TIER 1: INVASOR (> 0.6 CS robados/min)
        // Ej: Robar ~18 CS en 30 min (Aprox 3-4 campamentos)
        else if (invadesPerMin >= 0.5) {
            total = safeAdd(total, 0.5, "Invasor", notes);
            notes.push(`Ã°Å¸Â¥Â· Invasor (${enemyJungleCS} CS robados)`);
        }
    }

    // --- Ã°Å¸Å½Â¯ FRANCOTIRADOR (Reajustado para Spammers) ---
    const skillshotsLanded = Number(p.challenges?.skillshotsHit || 0);
    const shotsPerMin = durationMin > 0 ? skillshotsLanded / durationMin : 0;
    
    // Si es Zeri, Ezreal o Smolder, duplicamos la exigencia
    const spammers = ["Zeri", "Mel"];
    const spammerFactor = spammers.includes(p.championName) ? 2.5 : 1.0;

    if (shotsPerMin >= (8 * spammerFactor) && skillshotsLanded > (200 * spammerFactor)) { 
        total = safeAdd(total, 2.0, "Scripting", notes);
        notes.push(`Ã°Å¸Â¤â€“ Aimbot.exe (${skillshotsLanded} hits)`);

    } else if (shotsPerMin >= (5.0 * spammerFactor)) {
        total = safeAdd(total, 1.0, "Sniper", notes);
        notes.push(`Ã°Å¸Å½Â¯ Francotirador`);
    }
    // TIER 1: OJO DE HALCÃƒâ€œN (Decente)
    // Subido a 3.0/min
    else if (shotsPerMin >= (3.0 * spammerFactor)) {
        total = safeAdd(total, 0.5, "Hawkeye", notes);
        notes.push(`Ã°Å¸ÂÂ¹ Ojo de HalcÃƒÂ³n)`);
    }

    // =========================================================
    // 2. PESADILLA EN LA JUNGLA (PresiÃƒÂ³n Profunda) - RECALIBRADO
    // =========================================================
    // Variable: challenges.takedownsInEnemyJungle
    // Mide Kills + Asistencias ocurridos DENTRO de los cuadrantes de jungla rival.
    // NOTA: Es muy estricto con la posiciÃƒÂ³n. El RÃƒÂ­o NO cuenta.

    const deepKills = Number(p.challenges?.takedownsInEnemyJungle || 0);
    
    // TIER 2: TERROR ABSOLUTO (4+ cazadas)
    // Invadir y matar 4 veces en su propia casa es un Stomp.
    if (deepKills >= 4) {
         total = safeAdd(total, 2.0, "Deep Terror", notes);
         notes.push(`Ã°Å¸Ââ€¢Ã¯Â¸Â TERROR EN LA JUNGLA (x${deepKills} cazadas internas)`);
    }
    // TIER 1: CAZADOR FURTIVO (2+ cazadas)
    // Matar al jungla rival en su Red y luego volver a matarlo en Lobos.
    else if (deepKills >= 2) {
         total = safeAdd(total, 0.75, "Invade Kills", notes);
         notes.push(`Ã°Å¸Â¥Â· Cazador Furtivo (x${deepKills} cazadas internas)`);
    }

    // =========================================================
    // Ã°Å¸Â§Â  CONTROL DE MASAS (CC) - SISTEMA DUAL
    // =========================================================
    // --- FUNCIÃƒâ€œN A: HARD CC (El Carcelero) ---
    
    // Premia a Leona, Nautilus, Morgana, Amumu.
    if (hardCCPerMin >= 4.6 && hardCCCount > 70) {
        total = safeAdd(total, 3.0, "Hard CC God", notes);
        notes.push(`Ã°Å¸Ââ„¢ KRAKEN (${hardCCCount} stuns, ${hardCCPerMin.toFixed(1)}/min)`);
    } 
    else if (hardCCPerMin >= 3.0 && hardCCCount > 55) {
        total = safeAdd(total, 1.5, "Hard CC", notes);
        notes.push(`Ã¢â€ºâ€œÃ¯Â¸Â Cadena Perpetua (${hardCCCount} inmovilizaciones)`);
    }
    // PARALIZADOR (Hard CC)
    else if (hardCCPerMin >= 1.5 && hardCCCount > 35) {
        total = safeAdd(total, 0.75, "Ã¢Å¡Â¡El Paralizador", notes);
        notes.push(`Ã¢Å¡Â¡ El Paralizador (${hardCCCount} stuns)`);
    } 

    // --- FUNCIÃƒâ€œN B: TOTAL CC (La Reina del Hielo) ---
    // Premia a Ashe, Singed, Trundle, Nasus (y suma extra a los de Hard CC).
    
    // TIER 1: GOD (2.5s/min + 65s total) -> +1.7 pts
    if (totalCCPerMin >= 3.0 && totalCCScore > 85) {
        // Si ya cobrÃƒÂ³ por Kraken, damos un poco menos aquÃƒÂ­ para no inflar demasiado
        // Pero si es Ashe (que no tiene Hard CC), esto es su premio gordo.
        total = safeAdd(total, 2.5, "Total CC God", notes);
        notes.push(`Ã¢Ââ€žÃ¯Â¸Â REINA DEL HIELO (${totalCCScore}s de control)`);
    } 
    // TIER 2: HIGH (1.6s/min + 40s total) -> +0.85 pts
    else if (totalCCPerMin >= 2.4 && totalCCScore > 50) {
        total = safeAdd(total, 1.75, "Total CC", notes);
        notes.push(`Ã°Å¸ÂÅ’ Pegamento (${totalCCScore}s de control)`);
    }
    // TIER 3: MID (1.0s/min + 25s total) -> +0.5 pts [NUEVO]
    else if (totalCCPerMin >= 1.9 && totalCCScore > 25) {
        total = safeAdd(total, 1.0, "Soft CC", notes);
        notes.push(`Ã°Å¸Â§Å  Ralentizador (${totalCCScore}s de control)`);
    }

    else {
        // --- PROTECCIÃƒâ€œN ANTI-MUEBLE V2 (ASSASSIN FRIENDLY) ---
        
        // 1. EXCEPCIONES DE ROL
        // Los ADCs no suelen tener CC.
        const isAdc = (role === "BOTTOM");
        
        // 2. EXCEPCIONES DE RENDIMIENTO (Si vas fed, no eres un mueble)
        // El Kha'Zix del ejemplo tenÃƒÂ­a KDA 8.0 -> Se salva automÃƒÂ¡ticamente aquÃƒÂ­.
        const isPerforming = (kda >= 5.0) || (kp >= 0.5) ;

        // 3. EXCEPCIONES DE DAÃƒâ€˜O/UTILIDAD
        // Bajamos la exigencia de DPM para Junglas/Assassins (que burstean, no dps-ean constante)
        // Antes pedÃƒÂ­as 650 a todos. Ahora al Jungla le pedimos 450.
        const dpmThreshold = (role === "JUNGLE") ? 450 : 650; 
        const hasNumbers = (dpm > dpmThreshold) || (utilityScore > 12000);

        // COMBINACIÃƒâ€œN: Si cumples CUALQUIERA de estas condiciones, te libras.
        const isSafe = isAdc || isPerforming || hasNumbers;

        if (!isSafe) {
            // Solo entramos aquÃƒÂ­ si:
            // 1. No eres ADC.
            // 2. Jugaste MAL (KDA bajo, KP bajo, Perdiste).
            // 3. No hiciste DaÃƒÂ±o ni curaste.
            // 4. Y ENCIMA no metiste CC.
            // ENTONCES SÃƒÂ ERES UN MUEBLE.

            if (totalCCPerMin < 0.20) {
                total = safeAdd(total, -1.5, "Sin Utilidad", notes);
                notes.push(`Ã°Å¸â€”Â¿ Mueble (0 Impacto: Sin CC, DaÃƒÂ±o ni KDA)`);
            } 
            else if (totalCCPerMin < 0.6) {
                // PenalizaciÃƒÂ³n leve
                total = safeAdd(total, -1.0, "Poca Utilidad", notes);
            }
        }
    }

    // =====================================================
    // Ã°Å¸â€Â¨ ARTILLERÃƒÂA PESADA (DaÃƒÂ±o Alto, Kills Bajas)
    // =====================================================
    // Detecta al que baja las vidas para que el ADC remate (Brand, Karthus, Ziggs, Zyra).
    
    const dmgShareClean = p.challenges?.teamDamagePercentage || 0;
    
    // CondiciÃƒÂ³n: Hacer mÃƒÂ¡s del 25% del daÃƒÂ±o del equipo
    if (dmgShareClean >= 0.25) {
        
        // Ratio: Debes tener al menos 3 Asistencias por cada Kill para demostrar que "cedes" las muertes.
        // Ejemplo: 4/5/15 (15 >= 12) -> CUMPLE. 
        // Ejemplo: 2/2/10 (10 >= 6) -> CUMPLE.
        // TambiÃƒÂ©n exigimos un mÃƒÂ­nimo de 8 asistencias totales.
        if (a >= (k * 3) && a >= 8) {
            
            // TIER 2: EL ARQUITECTO DEL CAOS (> 30% DaÃƒÂ±o)
            if (dmgShareClean >= 0.30) {
                total = safeAdd(total, 2.0, "Chaos Architect", notes);
                notes.push(`Ã°Å¸Â§Â¨ Arquitecto del Caos (${(dmgShareClean*100).toFixed(0)}% dmg, Ratio K/A Altruista)`);
            }
            // TIER 1: ABLANDADOR (> 25% DaÃƒÂ±o)
            else {
                total = safeAdd(total, 1.0, "Softener", notes);
                notes.push(`Ã°Å¸ÂÂ½Ã¯Â¸Â La Mesa Puesta (${(dmgShareClean*100).toFixed(0)}% dmg, trabajo sucio)`);
            }
        }
    }

      // =====================================================
    // Ã°Å¸â€Â¥ PROTOCOLO 1v9 (DaÃƒÂ±o Masivo Absoluto)
    // =====================================================
    
    // Requisito Base: Tener un DPM decente (>650) para evitar bonos en partidas muy malas
    // Y no haber muerto excesivamente (Max 9 muertes), salvo que sea una partida muy larga.
    if (dmgShare >= 0.33 && dpm > 850 && (d < 9 || durationMin > 40)) {

        // TIER 3: EXODIA (> 50% DaÃƒÂ±o)
        // Literalmente has hecho mÃƒÂ¡s daÃƒÂ±o que tus 4 compaÃƒÂ±eros juntos.
        if (dmgShare >= 0.50) {
            total = safeAdd(total, 4.0, "EXODIA", notes); // +4 Puntos, es histÃƒÂ³rico
            notes.push(`Ã°Å¸â€˜â€˜ EXODIA: EL PROHIBIDO (${(dmgShare*100).toFixed(0)}% del daÃƒÂ±o total)`);
        }
        
        // TIER 2: THANOS (> 40% DaÃƒÂ±o)
        // "Lo harÃƒÂ© yo mismo".
        else if (dmgShare >= 0.40) {
            total = safeAdd(total, 3.0, "Thanos Mode", notes);
            notes.push(`Ã°Å¸Å¸Â£ THANOS: 1v9 (${(dmgShare*100).toFixed(0)}% del daÃƒÂ±o)`);
        }
        
        // TIER 1: HARD CARRY (> 30% DaÃƒÂ±o)
        // Carrileada estÃƒÂ¡ndar sÃƒÂ³lida.
        else {
            total = safeAdd(total, 2.0, "Hard Carry", notes);
            notes.push(`Ã°Å¸â€Â¥ Hard Carry (${(dmgShare*100).toFixed(0)}% del daÃƒÂ±o)`);
        }
    }

    // =========================================================
    // Ã°Å¸Å¡Å“ THE BAUSFFS SPECIAL V3.0 (Progresivo y Preciso)
    // =========================================================
    // Requisito: Ganar, Morir mucho (8+), ser el que mÃƒÂ¡s tira, KDA pobre y buen farm.
    if (p.win && d >= 8 && myTowerDmg === mostTowerDmg && myTowerDmg > 0 && kda < 2.2) {

        // Validamos que no sea un "Int" sin sentido: Debe tener buen farm
        if (csMin >= 6.0) {
            
            // 1. FÃƒâ€œRMULA TDPM (DaÃƒÂ±o a torres por minuto)
            // Base en 100. Ej: 300 -> 1.5 pts | 500 -> 3.0 pts
            let ptsFromTdpm = (tdpm - 100) * 0.0075;
            
            // 2. FÃƒâ€œRMULA DPD (DaÃƒÂ±o a torres por muerte)
            // Base en 500. Ej: 1000 -> 1.5 pts | 1500 -> 3.0 pts
            let ptsFromDpd = (dmgPerDeath - 500) * 0.003;

            // Tomamos la mÃƒÂ©trica donde el jugador haya sido mÃƒÂ¡s bestia
            let bausBonus = Math.max(ptsFromTdpm, ptsFromDpd);

            // Filtro de entrada (Solo premiamos si supera el equivalente al antiguo Tier 1)
            if (bausBonus >= 1.5) {
                
                // Cap mÃƒÂ¡ximo de seguridad para que no rompa la escala (+4.5 pts)
                bausBonus = Math.min(4.5, parseFloat(bausBonus.toFixed(2)));
                
                let bausLabel = "Ã°Å¸Å¡Â§ Good Death (PresiÃƒÂ³n constante a pesar de morir)";
                
                // Si llega al equivalente del antiguo Tier 2, le damos el tÃƒÂ­tulo de Dios
                if (bausBonus >= 3.0) {
                    bausLabel = `Ã°Å¸Å¡Å“ THE BAUS SPECIAL (Mueres ${d} veces pero abres la base)`;
                }

                total = safeAdd(total, bausBonus, "Baus Logic", notes);
                
                // Mostramos la etiqueta con los puntos progresivos y el contexto extra
                notes.push(`${bausLabel} (+${bausBonus} pts)`);
                notes.push(`(Eficiencia: ${(dmgPerDeath/1000).toFixed(1)}k dmg torre/muerte)`);
            }
        }
    }

Ã‚Â  Ã‚Â  // 6. Bono "Limpieza RÃƒÂ¡pida" (No requiere Win)
Ã‚Â  Ã‚Â  const quickCleanses = p.challenges?.quickCleanse || 0;
Ã‚Â  Ã‚Â  if (quickCleanses > 0) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  total = safeAdd(total, cfg.quick_cleanse_bonus * quickCleanses, "Limpieza RÃƒÂ¡pida", notes);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  notes.push(`Ã°Å¸Â§Â£ Limpieza RÃƒÂ¡pida (x${quickCleanses}, +${cfg.quick_cleanse_bonus * quickCleanses})`);
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  // 7. Bono "Maestro del Dive" (No requiere Win)
Ã‚Â  Ã‚Â  //const survivedLargeDamage = p.challenges?.tookLargeDamageSurvived || 0;
    const diveBonus = cfg.dive_master_points || 1.0; // Usa una nueva variable o 1.0 por defecto
    if (diveKills > 0) {
        total = safeAdd(total, diveBonus, "Maestro del Dive", notes);
        notes.push(`Maestro del Dive (+${diveBonus})`);
    }
    

Ã‚Â  Ã‚Â  // =====================================================
    // REMONTADA / THROW (SISTEMA DE 2 NIVELES)
    // =====================================================
    
    // --- CONFIGURACIÃƒâ€œN INTERNA (O puedes aÃƒÂ±adirlas a la hoja CONFIG) ---
    const comeback_little_gold = Number(cfg.comeback_gold_threshold || 4500); // Umbral normal
    const comeback_std_gold = Number(cfg.comeback_gold_threshold || 7500); // Umbral normal
    const comeback_ext_gold = Number(cfg.comeback_extreme_threshold || 11500); // Umbral MILAGRO

    const throw_little_gold = Number(cfg.throw_gold_advantage || 4500); // Umbral normal
    const throw_std_gold = Number(cfg.throw_gold_advantage || 7500); // Umbral normal
    const throw_ext_gold = Number(cfg.throw_extreme_advantage || 11500); // Umbral DESASTRE

    if (p.win) {
        const maxDeficit = Math.abs(Number(p.challenges?.maxGoldDeficit || 0));

        if (maxDeficit >= comeback_ext_gold) {
             // NIVEL 2: EL MILAGRO (Ej: +5 puntos)
             const miraclePts = Number(cfg.comeback_extreme_points || 5.0);
             total = safeAdd(total, miraclePts, "Milagro", notes);
             notes.push(`Ã¢â€ºÂª MILAGRO (${(maxDeficit/1000).toFixed(1)}k remontados)`); 
        } 
        else if (maxDeficit >= comeback_std_gold) { 
             // NIVEL 1: REMONTADA (Ej: +3 puntos)
             const comebackPts = Number(cfg.comeback_points || 3.0);
             total = safeAdd(total, comebackPts, "Remontada", notes); 
             notes.push(`Ã°Å¸â€Â¥ Remontada (${(maxDeficit/1000).toFixed(1)}k de desventaja)`); 
        }
        else if (maxDeficit >= comeback_little_gold) { 
             // NIVEL 1: REMONTADA (Ej: +3 puntos)
             const comebackPts = Number(cfg.comeback_points || 1.5);
             total = safeAdd(total, comebackPts, "Remontada", notes); 
             notes.push(`Ã°Å¸â€Â¥ Remontada (${(maxDeficit/1000).toFixed(1)}k de desventaja)`); 
        }

    } else {
        // Throw logic
        const maxAdv = Math.abs(Number(p.challenges?.maxGoldAdvantage || 0));

        if (maxAdv >= throw_ext_gold) { 
             // NIVEL 2: CÃƒÂRCEL (Ej: -5 puntos)
             const disasterPts = Number(cfg.throw_extreme_penalty || -5.0);
             total = safeAdd(total, disasterPts, "Disaster", notes); 
             notes.push(`Ã°Å¸Å¡â€ CRIMINAL (${(maxAdv/1000).toFixed(1)}k tirados a la basura)`); 
        }
        else if (maxAdv >= throw_std_gold) { 
             // NIVEL 1: THROW (Ej: -3 puntos)
             const throwPts = Number(cfg.throw_penalty || -3.0);
             total = safeAdd(total, throwPts, "Throw", notes); 
             notes.push(`Ã°Å¸Â¤Â¡ THROW (${(maxAdv/1000).toFixed(1)}k de ventaja perdida)`); 
        }
        else if (maxAdv >= throw_little_gold) { 
             // NIVEL 1: THROW (Ej: -3 puntos)
             const throwPts = Number(cfg.throw_penalty || 1.5);
             total = safeAdd(total, throwPts, "Throw", notes); 
             notes.push(`Ã°Å¸Â¥Â² Mini THROW (${(maxAdv/1000).toFixed(1)}k de ventaja perdida)`); 
        }
    }

Ã‚Â  Ã‚Â  // --- 5. BONOS ESPECÃƒÂFICOS DE ROL (v12.0) ---
    if (p.win) {
        // A. TANQUES (Top/Jng/Supp que han tanqueado de verdad)
        if (["TOP", "JUNGLE", "SUPPORT"].includes(role)) {
            if (dmgTakenShare >= (cfg.tank_damage_share_threshold || 0.3)) {
                total = safeAdd(total, cfg.tank_bonus_points || 1.0, "El Muro", notes); 
                notes.push(`El Muro (${(dmgTakenShare*100).toFixed(0)}% dmg)`);
            }
        }

        // =====================================================
        // Ã°Å¸Å¡Â¶Ã°Å¸ÂÂ»Ã¢â‚¬ÂÃ¢â„¢â€šÃ¯Â¸Â TROTAMUNDOS V2 (Roaming Escalable)
        // =====================================================
        // Cuenta kills obtenidas fuera de tu lÃƒÂ­nea en el juego temprano.
        const roamKills = Number(p.challenges?.killsOnOtherLanesEarlyJungleAsLaner || 0);

        // Solo aplicamos a TOP, MID y SUPP (Excluimos ADC para evitar ruido)
        if (["MIDDLE", "SUPPORT", "TOP"].includes(role) && roamKills > 0) {

            // TIER 3: OMNIPRESENTE (4+ Kills fuera de lÃƒÂ­nea)
            if (roamKills >= 4) {
                total = safeAdd(total, 3.0, "Map God", notes);
                notes.push(`Ã°Å¸â€”ÂºÃ¯Â¸Â INTERAIL (x${roamKills} kills en otras lÃƒÂ­neas)`);
            }
            
            // TIER 2: TROTAMUNDOS (2-3 Kills fuera de lÃƒÂ­nea)
            else if (roamKills >= 2) {
                const bonus = cfg.roaming_bonus_points || 2.0;
                total = safeAdd(total, bonus, "Trotamundos", notes);
                notes.push(`Ã°Å¸Å¡Â¶Ã°Å¸ÂÂ»Ã¢â‚¬ÂÃ¢â„¢â€šÃ¯Â¸Â Trotamundos (x${roamKills} kills)`);
            }
            
            // TIER 1: VISITA DE CORTESÃƒÂA (1 Kill)
            // Solo para TOP y MID. Al Support se le exige mÃƒÂ¡s.
            else if (role !== 'SUPPORT' && role !== 'UTILITY') {
                total = safeAdd(total, 1.0, "Roam BÃƒÂ¡sico", notes);
                notes.push(`Ã°Å¸â€˜â€¹ Visita de CortesÃƒÂ­a`);
            }
        }

        // --- BONUS: LANE KINGDOM (Dominio de LÃƒÂ­nea) ---
        // Solo para Laners (Top, Mid, Bot). Mide ventaja de Oro+XP al min 14.
        if (isLaner) {
            const laneDiff = Number(p.challenges?.earlyLaningPhaseGoldExpAdvantage || 0);
            
            if (laneDiff > 2000) {
                total = safeAdd(total, 2.0, "Stomp de LÃƒÂ­nea", notes);
                notes.push(`Ã°Å¸â€˜â€˜ REY DE LÃƒÂNEA (+${laneDiff.toFixed(0)} ventaja)`);
            } else if (laneDiff > 1000) {
                total = safeAdd(total, 1.0, "Ventaja SÃƒÂ³lida", notes);
                notes.push(`Ã°Å¸ÂÂ° Ventaja de LÃƒÂ­nea (+${laneDiff.toFixed(0)})`);
            }
        }
    }

    // =====================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â SUPERVIVENCIA REAL (Longest Time Living) - PROGRESIVO
    // =====================================================
    if (longestLife >= 1200) { // Empezamos a premiar a partir de 20 minutos vivo
        // FÃƒÂ³rmula: +1.0 pts cada 5 minutos (300s) extra a partir de los 15 min (900s)
        let survPts = (longestLife - 900) / 300;
        survPts = Math.min(3.5, parseFloat(survPts.toFixed(2))); // Cap mÃƒÂ¡ximo de seguridad

        let label = "Ã¢â€ºÂ·Ã¯Â¸Â vando a la muerte";
        if (longestLife >= 1800) {
            label = "Ã°Å¸â€˜Â» El Intocable";
        }

        // Convertimos segundos a minutos para que quede espectacular en la nota
        const minsVivo = (longestLife / 60).toFixed(1);
        total = safeAdd(total, survPts, "Survival", notes);
        notes.push(`${label} (${minsVivo} min vivo, +${survPts} pts)`);
    }



    // =====================================================
    // Ã°Å¸â€™â€“ FILTRO DE ROL: UTILIDAD PURA (Enchanters) - PROGRESIVO
    // =====================================================
    if (isSupport && utilityPerMin > 400) { 
        
        // FÃƒÂ³rmula: Base 400, +0.5 pts por cada 100 de utilidad extra
        let utilPts = (utilityPerMin - 400) * 0.005;
        utilPts = Math.min(5.0, parseFloat(utilPts.toFixed(2))); // Cap mÃƒÂ¡ximo en +5.0

        let label = "";
        if (utilityPerMin >= 1300) {
            label = "Ã°Å¸â€™â€“ Cirujano Jefe";
        } else if (utilityPerMin >= 850) {
            label = "Ã°Å¸Å¡â€˜ MÃƒÂ©dico de Campo";
        } else if (utilityPerMin >= 600) {
            label = "Ã°Å¸â€™Å  Enfermero";
        } else {
            label = "Ã°Å¸Â©Â¹ BotiquÃƒÂ­n"; // Para los que superan 400 pero no llegan al Tier 1
        }

        total = safeAdd(total, utilPts, "Utility", notes);
        notes.push(`${label} (${utilityPerMin.toFixed(0)} util/min, +${utilPts} pts)`);
    }

    // =====================================================
    // Ã°Å¸â€™Â¥ BURST IMPACT (CrÃƒÂ­ticos) - PROGRESIVO
    // =====================================================
    if (maxCrit >= 1300) {
        
        // FÃƒÂ³rmula: Base 1000, +0.5 pts por cada 100 de daÃƒÂ±o crÃƒÂ­tico extra
        let critPts = (maxCrit - 1000) * 0.005;
        critPts = Math.min(4.5, parseFloat(critPts.toFixed(2))); // Cap de seguridad

        let label = "Ã°Å¸â€Â¨ Golpe Devastador";
        if (maxCrit >= 1600) {
            label = "Ã°Å¸â€™Â¥ Ã‚Â¡One Shot!";
        }

        total = safeAdd(total, critPts, "Max Crit", notes);
        notes.push(`${label} (CrÃƒÂ­tico de ${maxCrit}, +${critPts} pts)`);
    }

    // =================================================================
    // Ã°Å¸Å¡Å“ REY DEL SPLIT & ASEDIO (Estructuras v5.0 - AJUSTE S26)
    // =================================================================
    const structuresDestroyed = (p.turretKills || 0) + (p.inhibitorKills || 0);
    const inhibsDestroyed = Number(p.inhibitorKills || 0);
    
    // DaÃƒÂ±o total del equipo a torres
    const teamTotalTowerDmg = participants
        .filter(pt => pt.teamId === p.teamId)
        .reduce((acc, pt) => acc + (pt.damageDealtToTurrets || 0), 0);
    
    // Porcentaje de contribuciÃƒÂ³n personal
    const myTowerShare = teamTotalTowerDmg > 0 ? (myTowerDmg / teamTotalTowerDmg) : 0;

    // --- TIER 3: EL FIN DE LOS MUNDOS (God Tier) ---
    // Requisitos S26: 
    // 1. Estructuras: 7+ (antes 8, ajustado por realismo) O 3+ Inhibidores.
    // 2. Share: > 60% del daÃƒÂ±o del equipo (eres la ÃƒÂºnica amenaza real).
    // 3. DaÃƒÂ±o: > 20k (InflaciÃƒÂ³n S26).
    if ((structuresDestroyed >= 7 || inhibsDestroyed >= 3) && myTowerShare >= 0.60 && myTowerDmg > 20000) {
        total = safeAdd(total, 3.5, "World Ender", notes);
        notes.push(`Ã°Å¸Å’â€¹ EL FIN DE LOS MUNDOS (${structuresDestroyed} estructuras, ${(myTowerShare*100).toFixed(0)}% del daÃƒÂ±o)`);
    }

    // --- TIER 2: TRIBUTO A XPEKE (Backdoor/Hard Split) ---
    // Requisitos S26: 
    // 1. Estructuras: 5+ (Abrir una lÃƒÂ­nea entera + Nexo).
    // 2. Share: > 40%.
    // 3. DaÃƒÂ±o: > 14k.
    else if (structuresDestroyed >= 5 && myTowerShare >= 0.40 && myTowerDmg > 14000) {
        total = safeAdd(total, 2.0, "xPeke Tribute", notes);
        notes.push(`Ã°Å¸Å¡Å“ Rey del Split (${structuresDestroyed} estructuras, ${(myTowerShare*100).toFixed(0)}% del daÃƒÂ±o)`);
    } 
    
    // --- TIER 1: MAESTRO DEL SPLIT (PresiÃƒÂ³n lateral estÃƒÂ¡ndar) ---
    // Requisitos S26: 
    // 1. Estructuras: 3+ (Tirar tu lÃƒÂ­nea completa).
    // 2. Share: > 25% (Hiciste mÃƒÂ¡s que tu parte justa de 20%).
    // 3. DaÃƒÂ±o: > 8k.
    else if (structuresDestroyed >= 3 && myTowerShare >= 0.25 && myTowerDmg > 8000) {
        total = safeAdd(total, 1.0, "Splitpusher", notes); 
        notes.push(`Ã°Å¸Ââ€”Ã¯Â¸Â Demoledor de Torres (${structuresDestroyed} estructuras)`);
    }

    // --- TIER ESPECIAL: ASEDIO INVISIBLE (Trabajo Sucio / Ziggs Mode) ---
    // Has hecho mucho daÃƒÂ±o a torres pero no te has llevado los last hits (<3 estructuras).
    // Progresivo: De 8k a 15k de daÃƒÂ±o.
    if (myTowerDmg >= 8000 && structuresDestroyed < 4) {
        // Base de 0.5 pts, escalando hasta +2.5 pts mÃƒÂ¡ximo a los 15k de daÃƒÂ±o
        let siegePts = 0.5 + ((myTowerDmg - 8000) / 7000) * 2.0;
        siegePts = Math.min(2.5, parseFloat(siegePts.toFixed(2))); // Cap mÃƒÂ¡ximo

        total = safeAdd(total, siegePts, "Siege Master", notes);
        notes.push(`Ã°Å¸â€™Â£ DemoliciÃƒÂ³n TÃƒÂ¡ctica (${(myTowerDmg/1000).toFixed(1)}k daÃƒÂ±o a torres sin last hit)`);
    }


    // --- BONUS: JEFE FINAL (Ventaja de Nivel - AJUSTADO POR ROL) ---
    // Progresivo: Premia cada nivel extra por encima del umbral.
    let levelThreshold = 2.0; // Umbral base para Jungla, ADC y Support

    if (role === "TOP") {
        levelThreshold = 3.0; // Rebajado ligeramente para el escalado
    } else if (role === "MIDDLE") {
        levelThreshold = 2.5; 
    }

    const levelAdvantage = myLevel - avgGameLevel;

    if (levelAdvantage >= levelThreshold) {
        // Base de 1.5 pts + 1.0 pts extra por cada nivel completo por encima del umbral.
        let levelPts = 1.0 + ((levelAdvantage - levelThreshold) * 1.0);
        levelPts = Math.min(4.0, parseFloat(levelPts.toFixed(2))); // Cap mÃƒÂ¡ximo de +4.0

        let label = "Ã°Å¸â€˜Â¹ Jefe Final";
        if (levelPts >= 3.0) label = "Ã°Å¸â€˜â€˜ EL TITÃƒÂN"; // Nueva etiqueta para stomps absurdos

        total = safeAdd(total, levelPts, "Boss Level", notes);
        notes.push(`${label} (+${levelAdvantage.toFixed(1)} lvls vs media)`);
    }


    // --- v13.6: DPM DINÃƒÂMICO (Inteligente con DetecciÃƒÂ³n de Etiquetas) ---
    if (durationMin >= 25) { 
        // He aÃƒÂ±adido un par de palabras clave extra por si acaso para asegurar que ningÃƒÂºn tanque sea penalizado
        const isCertifiedTank = notes.some(n => 
            n.includes("El Muro") || 
            n.includes("Duro de Pelar") || 
            n.includes("Muralla") ||
            n.includes("Tanque") ||
            n.includes("Escudo Humano") ||
            n.includes("COLOSO")
        );

        let d_penalty = 0, d_min = 0, d_max = 0;
        let checkDPM = false;

        // A. CARRIES (Mid / Bot) - Exigencia Alta
        if (["MIDDLE", "BOTTOM"].includes(role)) {
            d_penalty = 600; d_min = 725; d_max = 1800;
            checkDPM = true;
        } 
        // B. BRUISERS / FIGHTERS / TANKS (Top / Jungle) - Exigencia Media
        else if (["TOP", "JUNGLE"].includes(role)) {
            d_penalty = 450; d_min = 650; d_max = 1200;
            checkDPM = true;
        }

        if (checkDPM) {
            let dpmPts = 0;

            // --- CASO 1: TIENES BUEN DAÃƒâ€˜O (BonificaciÃƒÂ³n Progresiva) ---
            if (dpm >= d_min) {
                 const progress = (dpm - d_min) / (d_max - d_min);
                 // Reducimos los puntos: Base 0.5 + escalado hasta 2.0 (Tope bajado a +2.5 pts)
                 dpmPts = 0.5 + (progress * 2.0); 
                 dpmPts = Math.min(2.5, parseFloat(dpmPts.toFixed(2))); 
                 
                 let label = "Ã¢Å¡â€Ã¯Â¸Â Buen DaÃƒÂ±o";
                 if (dpmPts >= 2.2) label = "Ã¢ËœÂ¢Ã¯Â¸Â Asedio Nuclear"; 
                 else if (dpmPts >= 1.6) label = "Ã°Å¸Å’â€¹ MÃƒÂ¡quina de DaÃƒÂ±o";
                 else if (dpmPts >= 1.0) label = "Ã°Å¸â€Â¥ DPM Carry";

                 notes.push(`${label} (${dpm.toFixed(0)}, +${dpmPts})`);
                 total = safeAdd(total, dpmPts, "DPM Dynamic", notes);
            } 
            
            // --- CASO 2: TIENES MAL DAÃƒâ€˜O (PenalizaciÃƒÂ³n Progresiva) ---
            else if (dpm < d_penalty) {
                 if (!isCertifiedTank) {
                     // Castigo progresivo suavizado: bajamos el multiplicador a 0.008
                     const diffUnderPenalty = d_penalty - dpm;
                     dpmPts = -(diffUnderPenalty * 0.008); 
                     dpmPts = Math.max(-3.0, parseFloat(dpmPts.toFixed(2))); // Suelo bajado a -3.0

                     let label = "Ã°Å¸â€œâ€° DPM Bajo";
                     if (dpmPts <= -2.5) label = "Ã°Å¸Â©Â¹ Curando al Enemigo"; 
                     else if (dpmPts <= -1.8) label = "Ã°Å¸Â¦â€¹ DPS de Mariposa";
                     else if (dpmPts <= -1.0) label = "Ã°Å¸â€™Â¤ DaÃƒÂ±o Inexistente";
                     
                     notes.push(`${label} (${dpm.toFixed(0)} < ${d_penalty}, ${dpmPts})`);
                     total = safeAdd(total, dpmPts, "DPM Dynamic", notes);
                 } 
            }
        }
    }

    // =====================================================
    // Ã°Å¸Å’Ë† TEORÃƒÂA DEL CAOS (DaÃƒÂ±o HÃƒÂ­brido / Mixto) - PROGRESIVO
    // =====================================================
    const physDmg = Number(p.physicalDamageDealtToChampions || 0);
    const magicDmg = Number(p.magicDamageDealtToChampions || 0);
    const trueDmg = Number(p.trueDamageDealtToChampions || 0);
    const totalDmgCalculted = physDmg + magicDmg + trueDmg;

    // Filtro base de calidad
    if (totalDmgCalculted > 18000 && !isSupport) { 
        
        const physShare = physDmg / totalDmgCalculted;
        const magicShare = magicDmg / totalDmgCalculted;
        const trueShare = trueDmg / totalDmgCalculted;

        // CASO A: EL HÃƒÂBRIDO PERFECTO
        // Requiere > 30% en ambos. Escala hasta +2.5 pts si llegas a un perfecto 50/50.
        if (physShare >= 0.30 && magicShare >= 0.30) {
            // El componente menor marca el equilibrio. Ej: 60/40 -> el 40% es el menor.
            const lowestShare = Math.min(physShare, magicShare);
            // ProgresiÃƒÂ³n: De 30% (base 1.0) hasta 50% (base 2.5)
            let hybridPts = 0.5 + ((lowestShare - 0.30) / 0.20) * 1.5;
            hybridPts = parseFloat(hybridPts.toFixed(2));

            total = safeAdd(total, hybridPts, "Hybrid Damage", notes); 
            notes.push(`Ã°Å¸Å’Ë† Teoria del Caos (${(physShare*100).toFixed(0)}% AD / ${(magicShare*100).toFixed(0)}% AP)`);
        }
        
        // CASO B: EL EJECUTOR (DaÃƒÂ±o Verdadero)
        // Requiere > 25% True Dmg. Escala hasta +2.5 pts si superas el 40% True Dmg.
        else if (trueShare >= 0.25 && k >= 5) {
            let truePts = 1.0 + ((trueShare - 0.25) / 0.15) * 1.5;
            truePts = Math.min(2.5, parseFloat(truePts.toFixed(2))); // Cap mÃƒÂ¡ximo

            total = safeAdd(total, truePts, "True Damage", notes);
            notes.push(`Ã¢Å¡Âª Ejecutor Puro (${(trueShare*100).toFixed(0)}% DaÃƒÂ±o Verdadero)`);
        }
    }

    // =====================================================
    // Ã°Å¸â€™Â° MÃƒâ€œDULO FINANCIERO: RITMO DE ORO (GPM) - V6.0 (High Stakes)
    // =====================================================
    if (durationMin >= 15) {
        
        // 1. MATRIZ DE EXPECTATIVAS (Ajustada al Meta Actual)
        const expectedGPM = {
            'BOTTOM': { win: 480, loss: 400 }, 
            'MIDDLE': { win: 450, loss: 380 }, 
            'JUNGLE': { win: 420, loss: 350 }, 
            'TOP':    { win: 430, loss: 360 }, 
            'UTILITY':{ win: 260, loss: 190 }  
        };

        // Asignamos el rol seguro
        let myRole = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].includes(role) ? role : 'TOP';
        let baseGPM = p.win ? expectedGPM[myRole].win : expectedGPM[myRole].loss;

        // 2. IDENTIFICAR SUPPORTS DE DINERO (Carries encubiertos)
        const moneySupports = ["Pyke", "Senna", "Brand", "Lux", "Zyra", "Xerath", "Vel'Koz", "Swain", "Pantheon", "Teemo", "Ashe", "Camille"];
        const isMoneySupport = myRole === 'UTILITY' && moneySupports.includes(p.championName);

        if (isMoneySupport) {
            baseGPM += 50; // Les exigimos mÃƒÂ¡s GPM porque su kit genera oro
        }

        // 3. CÃƒÂLCULO DE DIFERENCIA
        const gpmDiff = gpm - baseGPM;
        let gpmPts = 0;
        let label = "";

        // --- A. MERCADO ALCISTA (Premios Agresivos) ---
        if (gpmDiff > 0 && (!isSupport || isMoneySupport)) { 
            
            // Multiplicadores subidos: +0.035 pts por cada GPM extra
            let multiplier = (myRole === 'BOTTOM' && p.win) ? 0.030 : 0.035;
            
            gpmPts = gpmDiff * multiplier;
            // Aumentamos el Cap: Ã‚Â¡Ahora puedes ganar hasta +8.0 puntos si destrozas la economÃƒÂ­a!
            gpmPts = Math.min(5.0, parseFloat(gpmPts.toFixed(2))); 

            if (gpmPts >= 6.0) label = "Ã°Å¸Å¡â‚¬ ELON MUSK (Monopolio Absoluto)";
            else if (gpmPts >= 4.0) label = "Ã°Å¸Â¤â€˜ Magnate";
            else if (gpmPts >= 2.0) label = "Ã°Å¸â€™Å½ Manos de Diamante";
            else label = "Ã°Å¸â€œË† Economista";
        }
        
        // --- B. MERCADO BAJISTA (Castigos Severos) ---
        // Reducimos el margen de gracia de 25 a 15. Si tienes mal farmeo, se nota rÃƒÂ¡pido.
        else if (gpmDiff < -15) { 
            const isPardonedTank = isRealTank && d >= 6; 
            const isPureSupport = myRole === 'UTILITY' && !isMoneySupport; 
            
            if (isPardonedTank) {
                notes.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â EconomÃƒÂ­a de Guerra (Tanque Pobre perdonado)`);
            } 
            else if (isPureSupport) {
                // Castigo para supports puros (mÃƒÂ¡s suave)
                gpmPts = (gpmDiff + 15) * 0.015; 
                gpmPts = Math.max(-2.5, parseFloat(gpmPts.toFixed(2))); 
                
                if (gpmPts <= -1.5) label = "Ã°Å¸ÂÅ¡Ã¯Â¸Â Presupuesto Recortado";
            } 
            else {
                // Castigo BRUTAL para carries que no generan oro (x0.04)
                gpmPts = (gpmDiff + 15) * 0.040; 
                gpmPts = Math.max(-5.0, parseFloat(gpmPts.toFixed(2))); 
                
                if (gpmPts <= -4.0) label = "Ã°Å¸â€™Â¸ BANCARROTA TOTAL";
                else if (gpmPts <= -2.0) label = "Ã°Å¸â€œâ€° DÃƒÂ©ficit CrÃƒÂ­tico";
                else label = "Ã°Å¸ÂÅ¡Ã¯Â¸Â VÃƒÂ­ctima de la InflaciÃƒÂ³n";
            }
        }

        // 4. APLICACIÃƒâ€œN
        if (gpmPts !== 0 && label !== "") {
            total = safeAdd(total, gpmPts, "GPM Progress", notes);
            notes.push(`${label} (${gpm.toFixed(0)} GPM vs ${baseGPM} esperado, ${gpmPts > 0 ? '+' : ''}${gpmPts} pts)`);
        }
    }


    // =====================================================
    // Ã°Å¸Â§Â¹ EL BARRENDERO 2.0: CONTROL DE VISIÃƒâ€œN PROGRESIVO
    // =====================================================
    const wardsPerMin = durationMin > 0 ? wardsDestroyed / durationMin : 0;

    // Definimos el mÃƒÂ­nimo esperado segÃƒÂºn el rol
    const minWardsJglSupp = 0.15; // 1 ward roto cada ~6-7 mins
    
    // --- A. RECOMPENSAS (Escalado MatemÃƒÂ¡tico) ---
    // Empezamos a premiar a partir de 0.25/min (Supports/Jgl) o 0.10/min (Laners)
    const baseWardsToReward = (isSupport || isJungle) ? 0.25 : 0.10;

    if (wardsPerMin > baseWardsToReward) {
        // Multiplicador: +6.0 pts por cada 1.0 WPM extra
        // Ej Supp: 0.55/min -> (0.55 - 0.25) * 6.0 = +1.8 pts
        let sweepPts = (wardsPerMin - baseWardsToReward) * 6.0;
        
        // Los Laners tienen un multiplicador un poco mayor porque les cuesta mÃƒÂ¡s romper (no compran Lente pronto)
        if (!isSupport && !isJungle) sweepPts *= 1.5; 
        
        sweepPts = Math.min(4.0, sweepPts); // Cap

        if (sweepPts >= 0.4) { // Filtro visual para no spamear "+0.1"
            let label = "Ã°Å¸â€Â¦ Buen Despeje";
            if (sweepPts >= 2.8) label = "Ã°Å¸Å’â€˜ APAGÃƒâ€œN TOTAL";
            else if (sweepPts >= 1.8) label = "Ã°Å¸â€˜ÂÃ¯Â¸ÂÃ¢â‚¬ÂÃ°Å¸â€”Â¨Ã¯Â¸Â OrÃƒÂ¡culo Supremo";
            else if (sweepPts >= 1.0) label = "Ã°Å¸Â§Â¹ Limpieza Profunda";

            sweepPts = parseFloat(sweepPts.toFixed(2));
            total = safeAdd(total, sweepPts, "Vision Clear", notes);
            notes.push(`${label} (${wardsPerMin.toFixed(2)}/min, +${sweepPts} pts)`);
        }
    }
    
    // --- B. CASTIGOS (Solo Jungla y Support) ---
    else if (durationMin > 20 && (isJungle || isSupport) && wardsPerMin < minWardsJglSupp) {
        // Castigo progresivo si no limpias. 
        // Ej: 0.0 WPM -> (0 - 0.15) * 20.0 = -3.0 pts
        let blindPen = (wardsPerMin - minWardsJglSupp) * 20.0;
        blindPen = Math.max(-3.0, blindPen); // Tope de castigo

        let label = blindPen <= -2.0 ? "Ã°Å¸â„¢Ë† CIEGO LEGAL" : "Ã°Å¸â€˜â€œ Miope (Poco despeje)";
        
        blindPen = parseFloat(blindPen.toFixed(2));
        total = safeAdd(total, blindPen, "Blind Penalty", notes);
        notes.push(`${label} (${wardsPerMin.toFixed(2)}/min, ${blindPen} pts)`);
    }


Ã‚Â  Ã‚Â  // =====================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â EL PROTECTOR: SALVADAS DE MUERTE PROGRESIVO
    // =====================================================
    const saves = Number(p.challenges?.saveAllyFromDeath || 0);
    const savesPerMin = durationMin > 0 ? saves / durationMin : 0;

    // REQUISITO MÃƒÂNIMO: Al menos 3 salvadas totales para evitar ruido
    if (isSupport && saves >= 3) {
        
        // BASELINE: 0.10 salvadas por minuto (Empiezas a puntuar a partir de aquÃƒÂ­)
        const baseSaves = 0.10;
        
        if (savesPerMin > baseSaves) {
            // FÃƒâ€œRMULA PROGRESIVA: Multiplicador de +4.5 pts por cada 1.0 SPM extra
            // Ej: 0.50/min -> (0.50 - 0.10) * 4.5 = +1.8 pts
            // Ej: 1.00/min -> (1.00 - 0.10) * 4.5 = +4.05 pts
            let savePts = (savesPerMin - baseSaves) * 4.5;
            savePts = Math.min(4.5, savePts); // Cap de seguridad
            
            if (savePts >= 0.5) { // Filtro anti-spam visual
                let label = "Ã°Å¸â€ºÅ¸ Salvavidas";
                if (savePts >= 3.5) label = "Ã°Å¸â„¢Å’ EL MESÃƒÂAS";
                else if (savePts >= 2.5) label = "Ã¢Å“Â¨ Milagro Viviente";
                else if (savePts >= 1.5) label = "Ã°Å¸â€ºÂ IntervenciÃƒÂ³n Divina";
                else if (savePts >= 0.8) label = "Ã°Å¸â€¢Å Ã¯Â¸Â ÃƒÂngel GuardiÃƒÂ¡n";

                savePts = parseFloat(savePts.toFixed(2));
                total = safeAdd(total, savePts, "Saves", notes);
                notes.push(`${label} (${saves} salvadas, +${savePts} pts)`);
            }
        }
    }

    // --- 5.5. MITIGACIÃƒâ€œN POR AFK (ProtecciÃƒÂ³n contra 4v5) ---
if (!p.win && durationMin >= 15) { 
    let teammateAFK = false;
    
    // --- NUEVO: Calcular Nivel Medio del Equipo ---
    let teamLevels = [];
    participants.forEach(part => {
        if (part.teamId === p.teamId && part.puuid !== p.puuid) { // CompaÃƒÂ±eros
            teamLevels.push(part.champLevel || p.champLevel); // AÃƒÂ±adir su nivel
        }
    });
    // Si no hay compaÃƒÂ±eros (error raro), usar tu nivel
    const avgTeamLevel = teamLevels.length > 0 ? (teamLevels.reduce((a, b) => a + b, 0) / teamLevels.length) : p.champLevel;


    participants.forEach(part => {
        if (part.teamId === p.teamId && part.puuid !== p.puuid) {
            
            // CRITERIOS DE AFK:
            const noDamage = (part.totalDamageDealtToChampions || 0) < 3500;
            
            // --- MODIFICADO: Usar Nivel Medio ---
            // Si el jugador estÃƒÂ¡ 3+ niveles por debajo del PROMEDIO del equipo
            const levelsBehindAvg = (avgTeamLevel - (part.champLevel || 0));

            if ((levelsBehindAvg >= 4) || (noDamage && durationMin >= 25) || part.wasAfk || part.leaver) {
                teammateAFK = true;
            }
        }
    });

    if (teammateAFK) {
        const mitigationBonus = cfg.afk_mitigation_bonus || 3.0; 
        total = safeAdd(total, mitigationBonus, "MitigaciÃƒÂ³n AFK", notes);
        notes.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â MitigaciÃƒÂ³n por AFK`);
    }
}

    // =========================================================
    // Ã°Å¸Ââ€¢Ã¯Â¸Â MITIGACIÃƒâ€œN "JG DIFF" (OBJETIVOS) - REWORK V3 (Anti-Auto-Buff)
    // =========================================================
    // Requisitos:
    // 1. NO ser Jungla (No puedes recibir consuelo por tu propia culpa).
    // 2. Perder la partida.
    // 3. Tu KDA debe ser > 1.5 (Demostrar que tÃƒÂº no fedeaste).
    
    // Calculamos tu KDA actual
    const myKDA = (k + a) / Math.max(1, d);

    // CAMBIO IMPORTANTE: AÃƒÂ±adido "&& role !== 'JUNGLE'"
    if (!isWin && role !== 'JUNGLE' && myKDA > 1.5) {

        // Buscamos a TU jungla en la lista de participantes (asumiendo que 'myTeam' estÃƒÂ¡ definido)
        // Si no tienes 'myTeam' definido arriba, usa: participants.find(p => p.teamPosition === 'JUNGLE' && p.teamId === p.teamId);
        const myJungle = myTeam.find(m => m.teamPosition === "JUNGLE");
        
        if (myJungle) {
            // Contamos solo OBJETIVOS DE VERDAD (Ignoramos Larvas/HordeKills)
            // Nota: dragonKills es un stat individual. Si el midlaner hizo el dragÃƒÂ³n, aquÃƒÂ­ saldrÃƒÂ¡ 0 para el jungla.
            const dragons = Number(myJungle.dragonKills || 0);
            const heralds = Number(myJungle.riftHeraldKills || 0);
            const barons  = Number(myJungle.baronKills || 0);
            
            // Suma total de objetivos mayores asegurados por el Jungla
            const majorObjectives = dragons + heralds + barons;
            
            let jgDiffBonus = 0;
            let jgDiffNote = "";

            // CASO A: NULIDAD ABSOLUTA (0 Objetivos) -> +3.0 Pts (Subido segÃƒÂºn tu snippet)
            if (majorObjectives === 0) {
                jgDiffBonus = 3.0;
                jgDiffNote = `Ã°Å¸Ââ€¢Ã¯Â¸Â MitigaciÃƒÂ³n (Jgl: 0 Objetivos)`;
            }
            // CASO B: INSUFICIENTE (Solo 1 Objetivo) -> +2.0 Pts
            else if (majorObjectives === 1) {
                jgDiffBonus = 2.0;
                jgDiffNote = `Ã¢â€ºÂº MitigaciÃƒÂ³n Leve (Jgl: Solo 1 Objetivo)`;
            }

            // Aplicar puntos si corresponde
            if (jgDiffBonus > 0) {
                total = safeAdd(total, jgDiffBonus, "Jungle Diff Mitigation", notes);
                notes.push(jgDiffNote);
            }
        }
    }
    
    // =========================================================
    // Ã°Å¸ÂÂ¼ MITIGACIÃƒâ€œN: "NIÃƒâ€˜ERA FRUSTRADA V3" (Support vs ADC Gap)
    // =========================================================
    // Detecta si tu ADC fedeÃƒÂ³ o fue inÃƒÂºtil, mientras tÃƒÂº jugaste decente.
    
    if (isSupport && !isWin && durationMin >= 15) {

        const myADC = myTeam.find(m => m.teamPosition === 'BOTTOM');

        if (myADC) {
            const adcDeaths = Number(myADC.deaths || 0);
            const adcKills = Number(myADC.kills || 0);
            const adcAssists = Number(myADC.assists || 0);
            const adcDmgShare = myADC.challenges?.teamDamagePercentage || 0;
            
            const adcKDA = (adcKills + adcAssists) / Math.max(1, adcDeaths);
            const myDeaths = d; 
            
            // --- RITMOS DE MUERTE ---
            const adcDPM = adcDeaths / durationMin;
            const myDPM = myDeaths / durationMin;
            const dpmGap = adcDPM - myDPM; // CuÃƒÂ¡nto mÃƒÂ¡s muere ÃƒÂ©l que tÃƒÂº

            // --- CONDICIONES DEL ADC ---
            // 1. Feeder: Muere mucho (>0.27/min) y KDA bajo.
            const isAdcFeeder = (adcDPM >= 0.27 && adcKDA < 1.3);
            // 2. Fantasma: No muere tanto, pero no pega NADA (<12% daÃƒÂ±o team).
            const isAdcUseless = (adcDmgShare < 0.13 && durationMin > 20);

            // --- CONDICIONES TUYAS (Check de Dignidad) ---
            // TÃƒÂº jugaste safe (<0.18 muertes/min) Y tuviste presencia (KP > 30% o VisiÃƒÂ³n > 1.5/min)
            // Esto evita que un Supp AFK reclame puntos solo porque su ADC muriÃƒÂ³.
            const myKP = (p.challenges?.killParticipation || 0);
            const myVision = (p.visionScore || 0) / durationMin;
            const amISolid = (myDPM <= 0.18) && (myKP > 0.30 || myVision > 1.5);

            if ((isAdcFeeder || isAdcUseless) && amISolid) {
                
                let mitPoints = 1.0;
                let mitLabel = "Ã°Å¸ÂÂ¼ NiÃƒÂ±era Frustrada";

                // NIVEL 2: PESADILLA (ADC Feeder extremo o daÃƒÂ±o nulo absoluto)
                if (adcDPM >= 0.30 || (isAdcUseless && adcKDA < 1.1)) {
                    mitPoints = 2.5;
                    mitLabel = "Ã°Å¸â€™â‚¬ ADC Pesadilla (Lastre absoluto)";
                }
                // NIVEL 1: ADC GAP (Gap claro de muertes > 0.15/min)
                else if (dpmGap >= 0.15) {
                    mitPoints = 1.5;
                    mitLabel = "Ã°Å¸ÂÂ¼ NiÃƒÂ±era Frustrada (ADC Gap)";
                }

                total = safeAdd(total, mitPoints, "ADC Gap Mitigation", notes);
                notes.push(`${mitLabel} (ADC: ${adcDeaths} muertes, ${(adcDmgShare*100).toFixed(0)}% daÃƒÂ±o)`);
            }
        }
    }

    // =========================================================
    // Ã°Å¸ÂÂ¹ MITIGACIÃƒâ€œN: "HUÃƒâ€°RFANO DE LÃƒÂNEA" (ADC vs Supp Gap)
    // =========================================================
    // Protege al ADC cuando el Support es un lastre (Feeder o InÃƒÂºtil).
    
    if (role === 'BOTTOM' && !isWin && durationMin >= 15) {

        const mySupp = myTeam.find(m => (m.teamPosition === 'UTILITY' || m.teamPosition === 'SUPPORT'));

        if (mySupp) {
            const suppDeaths = Number(mySupp.deaths || 0);
            const suppKills = Number(mySupp.kills || 0);
            const suppAssists = Number(mySupp.assists || 0);
            const suppVis = (mySupp.visionScore || 0) / durationMin;
            const suppKDA = (suppKills + suppAssists) / Math.max(1, suppDeaths);

            // --- TU RENDIMIENTO (Requisito para reclamar) ---
            // Debes haber intentado ganar: Farm decente (>6.0) O DaÃƒÂ±o decente (>20%)
            const myCSMin = ((p.totalMinionsKilled||0) + (p.neutralMinionsKilled||0)) / durationMin;
            const myDmgShare = p.challenges?.teamDamagePercentage || 0;
            const iTriedMyBest = (myCSMin >= 6.0 || myDmgShare >= 0.20);

            if (iTriedMyBest) {
                let orphanPoints = 0;
                let orphanNote = "";

                // CASO A: SUPPORT FEEDER (Inting Sion style pero en Supp)
                // Muere mucho (>0.33/min) y KDA horrible (<1.0)
                const suppDPM = suppDeaths / durationMin;
                
                if (suppDPM >= 0.30 && suppKDA < 1.0) {
                    orphanPoints = 2.0;
                    orphanNote = `Ã°Å¸Â¤â€¢ HuÃƒÂ©rfano (Support Feeder: ${suppDeaths} muertes)`;
                }
                
                // CASO B: SUPPORT AUTOLLENADO / INÃƒÅ¡TIL
                // VisiÃƒÂ³n ridÃƒÂ­cula (<1.0/min) Y baja participaciÃƒÂ³n (<25% KP)
                // OJO: Si es Yuumi la visiÃƒÂ³n puede ser baja, pero deberÃƒÂ­a tener KP alto.
                const suppKP = (suppKills + suppAssists) / Math.max(1, teamInfo.totalKills || 1); // Asumiendo teamInfo disponible
                
                if (orphanPoints === 0 && suppVis < 1.0 && suppKP < 0.25) {
                    orphanPoints = 1.5;
                    orphanNote = `Ã°Å¸â€¢Â¯Ã¯Â¸Â A Ciegas (Support sin visiÃƒÂ³n ni presencia)`;
                }

                // CASO C: ATRAPADO 1v2 (El support te abandonÃƒÂ³ o muriÃƒÂ³ el doble que tÃƒÂº)
                // Si el supp muriÃƒÂ³ el DOBLE que tÃƒÂº y tÃƒÂº moriste poco (<4).
                if (orphanPoints === 0 && suppDeaths >= (d * 2) && d <= 4) {
                    orphanPoints = 1.0;
                    orphanNote = `Ã°Å¸â€ºÂ¡Ã¯Â¸Â 1v2 Lane (Sobreviviste al Supp)`;
                }

                // Aplicar
                if (orphanPoints > 0) {
                    total = safeAdd(total, orphanPoints, "Supp Gap Mitigation", notes);
                    notes.push(orphanNote);
                }
            }
        }
    }
    

Ã‚Â  Ã‚Â  // =========================================================
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â LÃƒâ€œGICA DE TANQUES Y CC (REWORK V2.0 - TANQUE DE PAPEL INTELIGENTE)
    // =========================================================

    // Solo analizamos si el sistema detectÃƒÂ³ que estÃƒÂ¡ jugando rol de Tanque
    if (isRealTank && d >= 6) {

        // 1. CÃƒÂLCULO DE DUREZA
        const mitigated = Number(p.damageSelfMitigated || 0);
        const taken = Number(p.totalDamageTaken || 0);
        // CuÃƒÂ¡nto daÃƒÂ±o "comiÃƒÂ³" en total (lo que le entrÃƒÂ³ + lo que parÃƒÂ³ la armadura/escudos)
        const totalSoaked = mitigated + taken; 
        
        // Ratio: CuÃƒÂ¡nto daÃƒÂ±o aguanta de media antes de irse a base (morir)
        const soakPerDeath = totalSoaked / Math.max(1, d);

        // 2. UMBRALES DE DIGNIDAD (Ajustados por economÃƒÂ­a)
        // Un Toplaner/Jungla tiene mÃƒÂ¡s oro/items que un Support, debe aguantar mÃƒÂ¡s.
        let paperThreshold = 5000; // Top/Jungle debe aguantar 5k por vida
        if (isSupport) paperThreshold = 3000; // Support con 3k es aceptable

        // --- CASO A: EL FLAN (Tanque de Papel Real) ---
        // Mueres mucho, tienes mal KDA y encima aguantas poco daÃƒÂ±o por vida.
        if (soakPerDeath < paperThreshold && kda < 1.5) {
             // Castigo escalable: Si aguantas poquÃƒÂ­simo, duele mÃƒÂ¡s
             let severity = -2.0;
             if (soakPerDeath < (paperThreshold * 0.6)) severity = -3.0; // Muy blando

             total = safeAdd(total, severity, "Paper Tank", notes);
             notes.push(`Ã°Å¸Â§Â» Tanque de Papel (Solo ${(soakPerDeath/1000).toFixed(1)}k dmg aguantado/muerte)`);
        }

        // --- CASO B: EL SACO DE BOXEO INÃƒÅ¡TIL (Aguanta pero no hace nada) ---
        // Si aguantas daÃƒÂ±o pero no metes CC y mueres mucho, eres una piÃƒÂ±ata de oro para el rival.
        // Requisito: Mueres 8+, Aguantes bien, pero tu CC es ridÃƒÂ­culo (< 0.5s/min).
        else if (d >= 8 && totalCCPerMin < 0.5 && kda < 1.5) {
             total = safeAdd(total, -1.5, "Useless Sponge", notes);
             notes.push(`Ã°Å¸Â§Â± Ladrillo InmÃƒÂ³vil (Mueres mucho y 0 utilidad/CC)`);
        }
    }

    // =========================================================
    // 6. SISTEMA DE PENALIZACIONES v4.1 (RITMO DE MUERTE AJUSTADO)
    // =========================================================
    
    // Calcular ritmo (Muertes por minuto)
    const deathsPerMin = durationMin > 0 ? d / durationMin : 0;
    
    // --- Definiciones Previas ---
    // Recalculamos si es splitpusher aquÃƒÂ­ para evitar errores de referencia
    const towerDmgLocal = Number(p.damageDealtToTurrets || 0);
    // Es splitpusher si hizo > 4000 daÃƒÂ±o a torres (aprox 1.5 torres)
    const isSplitpusherLocal = (role === "TOP" || role === "MIDDLE") && towerDmgLocal > 5500;

    // --- A. FACTOR DE PIEDAD (Con Filtro Anti-Fake) ---
    let deathMitigation = 1.0; 
    
    // 1. Definimos si el KP es alto
    const hasHighKP = kp >= 0.75;
    
    // 2. Definimos si el jugador fue realmente ÃƒÂºtil (ValidaciÃƒÂ³n)
    // Para mitigar las muertes, no basta con tocar a la gente (asistencias basura).
    // Tienes que haber tanqueado, curado, metido CC o hecho daÃƒÂ±o de verdad.
        
    // Criterios de "Sacrificio VÃƒÂ¡lido":
    // A. Eres Tanque (Has mitigado daÃƒÂ±o)
    // B. Eres Healer/CC (Utility alta)
    // C. Eres Carry (Has hecho al menos el 15% del daÃƒÂ±o del equipo)
    const isValidSacrifice = isRealTank || 
                             (utilityPerMin > 500) || 
                             (totalCCPerMin > 1.5) || 
                             (dmgShare > 0.15);

    // 3. Aplicamos la mitigaciÃƒÂ³n SOLO si el sacrificio fue vÃƒÂ¡lido
    if (hasHighKP && isValidSacrifice) {
        deathMitigation = 0.75; // Reduce la multa un 25%
    } 

    // ------------------------------------------------------------
    // B. CLASIFICACIÃƒâ€œN DEL FEDEO (Umbrales MÃƒÂ¡s Estrictos)
    // ------------------------------------------------------------
    // MÃƒÂ­nimo 5 muertes para empezar a evaluar (antes era mucho ruido en partidas cortas)
    if (d >= 5) {
        let basePenalty = 0;
        let label = "";

        // TIER 3: INTING (> 0.48/min) -> Ej: 10 muertes en 20 min
        if (deathsPerMin >= 0.48) { 
            basePenalty = -6.0;
            label = `Ã°Å¸Â¤Â¬ INTING`;
        } 
        // TIER 2: FEEDER (> 0.36/min) -> Ej: 11 muertes en 30 min
        else if (deathsPerMin >= 0.36) {
            basePenalty = -4.0;
            label = `Ã°Å¸Â¤Â¡ Feeder`;
        } 
        // TIER 1: PANTALLA GRIS (> 0.26/min) -> Ej: 8 muertes en 30 min
        else if (deathsPerMin >= 0.25) {
            basePenalty = -3.0; 
            label = `Ã°Å¸â€œÂº Pantalla Gris`;
        }

        // --- C. AGRAVANTE: EL "WARD MÃƒâ€œVIL" ---
        // Si mueres ritmo Feeder/Inting Y ADEMÃƒÂS eres inÃƒÂºtil (KP < 25% y no eres splitpusher)
        const isUseless = kp < 0.27 && !isSplitpusherLocal;
        
        if (basePenalty <= -4.0 && isUseless) { // Solo aplicamos agravante si ya es Feeder o Inting
            basePenalty *= 1.2;
            label += " (Agravado: 0 Impacto)";
        }

        // Aplicamos la mitigaciÃƒÂ³n o el castigo final
        if (basePenalty < 0) {
            const finalPenalty = basePenalty * deathMitigation;
            punishmentPoints += finalPenalty;
            
            // Nota inteligente para el usuario
            if (deathMitigation < 1.0) {
                punishmentNotes.push(`${label} (Mitigado por sacrificio: ${d} muertes)`);
            } else {
                punishmentNotes.push(`${label} (${deathsPerMin.toFixed(2)} m/min)`);
            }
        }
    }

    // =========================================================
    // Ã°Å¸Å¡â€˜ CONTROL DE CALIDAD DE SUPPORTS (SOPORTE NOCIVO) - V3.2
    // =========================================================
    
    // 1. Calculamos Ritmos
    const deathsPerMinSupport = durationMin > 0 ? d / durationMin : 0;
    const killsPerMinSupport = durationMin > 0 ? k / durationMin : 0;
    
    // 2. DETECCIÃƒâ€œN DE "PICK DE DAÃƒâ€˜O FALLIDO"
    // - Es Support.
    // - NO es un Tanque Real (no ha mitigado daÃƒÂ±o significativo).
    // - Su DaÃƒÂ±o es BAJO (< 15% del equipo).
    // - EXTRA: Su CC es BAJO (< 1s/min). Si tuviera mucho CC, serÃƒÂ­a un support de utilidad ÃƒÂºtil.
    // Si cumples todo esto: Eres un Brand/Lux/Senna que no ha hecho nada.
    const isFailedDamagePick = isSupport && !isRealTank && dmgShare < 0.15 && totalCCPerMin < 1.0;

    if (isFailedDamagePick) {
        
        // --- CASO A: EL "ATENTADO" (Prioridad 1: Feeder InÃƒÂºtil) ---
        // Pick de daÃƒÂ±o que muere muchÃƒÂ­simo (>0.30/min) y no aporta daÃƒÂ±o.
        // Ej: Brand 0/10/2 en 30 min.
        if (deathsPerMinSupport >= 0.30) {
            
            deathMitigation = 1.0;   // ANULA cualquier piedad de muerte por sacrificio
            punishmentPoints -= 2.5; // Castigo severo
            
            punishmentNotes.push(`Ã°Å¸â€”â€˜Ã¯Â¸Â Pick InÃƒÂºtil (Mago/Carry fallido: ${d} muertes y sin daÃƒÂ±o)`);
        }
        
        // --- CASO B: EL "SUPP KILLER" (Prioridad 2: KS sin DaÃƒÂ±o) ---
        // Solo entramos aquÃƒÂ­ si NO se cumpliÃƒÂ³ el caso A (Castigo ÃƒÂºnico).
        // Se lleva las kills (>0.2/min) pero su daÃƒÂ±o es irrelevante (<15%).
        else if (killsPerMinSupport >= 0.20) {
            
            punishmentPoints -= 2.0; // Castigo directo
            
            // Etiqueta informativa
            let ksLabel = (k > a) ? "KS Descarado" : "KDA VacÃƒÂ­o";
            
            punishmentNotes.push(`Ã°Å¸â€œâ€° ${ksLabel} (Robaste ${k} kills sin aportar daÃƒÂ±o)`);
        }
    }

    // ------------------------------------------------------------
    // E. APLICACIÃƒâ€œN FINAL
    // ------------------------------------------------------------
    if (punishmentPoints < 0) {
        // Redondeo limpio
        punishmentPoints = Math.round(punishmentPoints * 100) / 100;
        
        total = safeAdd(total, punishmentPoints, "Death Penalty", notes);
        if (punishmentNotes.length > 0) {
             notes.push(...punishmentNotes);
        }
    }

    // =====================================================
    // Ã°Å¸â€™Å½ EL INVERSOR 4.2: PINKS (EconomÃƒÂ­a Inteligente por Rol)
    // =====================================================
    const pinksBought = Number(p.visionWardsBoughtInGame || 0);
    const pinksPlaced = Number(p.challenges?.controlWardsPlaced || 0);
    const pinks = Math.max(pinksBought, pinksPlaced);

    // 1. CÃƒÂLCULO DE ORO INTELIGENTE
    let goldSpentOnVision = 0;
    
    if (isSupport) {
        const pinksNormales = Math.min(pinksBought, 2);
        const pinksRebajados = Math.max(0, pinksBought - 2);
        goldSpentOnVision = (pinksNormales * 75) + (pinksRebajados * 40);
    } else {
        goldSpentOnVision = pinksBought * 75;
    }

    // 2. DEFINIR EXPECTATIVAS (CuÃƒÂ¡ntos pinks deberÃƒÂ­as comprar segÃƒÂºn el minuto)
    let pinkRate = 15; // Laners (1 cada 15 min)
    if (isSupport) pinkRate = 8; // Supports (1 cada 8 min)
    else if (isJungle) pinkRate = 12; // Junglas (1 cada 12 min)

    const expectedPinks = Math.floor(durationMin / pinkRate);
    const excessPinks = pinks - expectedPinks;

    if (durationMin > 20) {

        // --- Ã°Å¸ÂÂ¹ REGLA ABSOLUTA PARA EL ADC (BOTTOM) ---
        // El ADC NO recibe premios ni castigos por Pinks. Debe guardar su oro para daÃƒÂ±o.
        if (role === 'BOTTOM') {
            if (pinksBought >= 4) {
                // Aviso visual si gasta 300+ de oro en visiÃƒÂ³n, pero SIN tocar los puntos
                notes.push(`Ã°Å¸â€™Â¸ Aviso: Compraste ${pinksBought} Pinks. Deja la visiÃƒÂ³n al Support.`);
            }
        } 
        
        // --- Ã¢Å¡â€Ã¯Â¸Â LÃƒâ€œGICA PARA EL RESTO DE ROLES (SUPP, JGL, MID, TOP) ---
        else {
            const isSoloLaner = (role === 'MIDDLE' || role === 'TOP');

            // A. PENALIZACIÃƒâ€œN POR DERROCHE (Solo para Mid y Top)
            // Si un Midlaner compra 4 pinks, estÃƒÂ¡ gastando 300 de oro (una kill entera).
            if (isSoloLaner && pinksBought >= 4) {
                let wastePenalty = -(pinksBought - 4) * 0.25; 
                wastePenalty = Math.max(-2.5, parseFloat(wastePenalty.toFixed(2))); // Cap de -2.5
                
                total = safeAdd(total, wastePenalty, "Vision Waste", notes);
                notes.push(`Ã°Å¸â€™Â¸ Derroche de Oro (ComprÃƒÂ³ ${pinksBought} pinks siendo Laner, ${wastePenalty} pts)`);
            }
            
            // B. BONUS PROGRESIVO: EL MAGNATE DE LA VISIÃƒâ€œN
            // Solo premiamos a los Solo Laners si no han llegado al umbral de derroche
            else if (excessPinks > 0) {
                let pinkPts = excessPinks * 0.25;
                pinkPts = Math.min(2.0, parseFloat(pinkPts.toFixed(2))); 

                let label = "Ã°Å¸â€œÅ’ Usando los Pinks";
                if (excessPinks >= 7) label = "Ã°Å¸â€˜ÂÃ¯Â¸ÂÃ¢â‚¬ÂÃ°Å¸â€”Â¨Ã¯Â¸Â ILLUMINATI";
                else if (excessPinks >= 4) label = "Ã°Å¸â€Â® Vidente";

                total = safeAdd(total, pinkPts, "Vision Excess", notes);
                notes.push(`${label} (+${pinks} Pinks, +${pinkPts} pts)`);
            } 

            // C. BONUS EXTRA: SACRIFICIO ECONÃƒâ€œMICO (Solo JGL y SUPP)
            const spenderThreshold = isSupport ? 310 : 525;
            if ((isSupport || isJungle) && goldSpentOnVision > spenderThreshold) { 
                let invPts = ((goldSpentOnVision - spenderThreshold) / 100) * 0.15;
                invPts = Math.min(1.5, parseFloat(invPts.toFixed(2))); 
                invPts = Math.max(0.25, invPts); 

                total = safeAdd(total, invPts, "Big Spender", notes);
                notes.push(`Ã°Å¸â€™Â¸ Inversor de VisiÃƒÂ³n (-${goldSpentOnVision}g en visiÃƒÂ³n, +${invPts} pts)`);
            }

            // D. PENALIZACIONES: LISTA DE MOROSOS (No compran lo mÃƒÂ­nimo)
            if (excessPinks < 0) {
                if (pinks === 0) {
                    // El castigo base es peor para Supp/Jgl (-4) que para Laners (-2)
                    let penaltyBase = (isSupport || isJungle) ? -4.0 : -2.0; 
                    if (durationMin > 35) penaltyBase -= 1.0; 

                    total = safeAdd(total, penaltyBase, "No Vision", notes);
                    notes.push(`Ã°Å¸â„¢Ë† TacaÃƒÂ±o Supremo (0 Pinks en ${durationMin} min)`);
                }
                else {
                    const deficit = Math.abs(excessPinks);
                    const penaltyMult = (isSupport || isJungle) ? 0.8 : 0.4;
                    let penalty = -(deficit * penaltyMult); 
                    penalty = Math.max(-3.5, parseFloat(penalty.toFixed(2))); 
                    
                    total = safeAdd(total, penalty, "Low Pinks", notes);
                    notes.push(`Ã°Å¸â€˜â€º Ahorrador (Faltaron ${deficit} pinks)`);
                }
            }
        }
    }


    

Ã‚Â  Ã‚Â  // ==============================================================================
    // Ã°Å¸â€™Â¸ SISTEMA DE BOUNTY THROW V3.0 (JUSTICIA DIVINA)
    // ==============================================================================
    if (d > 0) { // Solo si has muerto alguna vez
        const spree = Number(p.largestKillingSpree || 0);
        
        // UMBRAL: Solo analizamos si perdiste una racha de 3 o mÃƒÂ¡s
        if (spree >= 3) {
            
            // 1. CÃƒÂLCULO BASE (Severidad del Throw)
            let penalty = 0;
            let label = "";

            if (spree >= 8) { 
                penalty = -3.5; 
                label = "MASSIVE SHUTDOWN"; 
            } else if (spree >= 6) { 
                penalty = -2.5; 
                label = "Shutdown Gordo"; 
            } else if (spree >= 4) { 
                penalty = -1.5; 
                label = "Bounty"; 
            } else { 
                penalty = -0.5; 
                label = "Racha Cortada"; 
            }

            // 2. Ã°Å¸â€ºÂ¡Ã¯Â¸Â FACTORES DE MITIGACIÃƒâ€œN (AQUÃƒÂ ESTÃƒÂ EL FIX) Ã°Å¸â€ºÂ¡Ã¯Â¸Â

            // A. AMNISTÃƒÂA TOTAL ("WORTH IT")
            // Si ganaste la partida Y tu KDA es sÃƒÂ³lido (> 3.5), tu muerte valiÃƒÂ³ la pena.
            // Ejemplo TuMorenito17: 17/7/8 (KDA 3.57) + Win = 0 Castigo.
            if (p.win && kda >= 3.5) {
                penalty = 0; 
            }
            
            // B. VICTORIA TÃƒÂCTICA
            // Si ganaste pero tu KDA no es estelar, reducimos el castigo un 60% (antes 30%).
            // Morir para tirar nexo duele menos.
            else if (p.win) {
                penalty = penalty * 0.4; 
            }

            // C. SUPPORTS (Sacrificio)
            // A los supports se les perdona un 50% extra (acumulable con lo anterior).
            if (isSupport || isTankRole) {
                penalty = penalty * 0.5;
            }

            // D. INOCENCIA MATEMÃƒÂTICA (Fix Chromosome Z)
            // Si tienes racha alta pero solo moriste 1 vez en toda la partida, se perdona.
            if (d === 1 && spree >= 5) {
                penalty = 0;
            }

            // 3. APLICACIÃƒâ€œN FINAL
            // Si el castigo quedÃƒÂ³ en algo ridÃƒÂ­culo (menos de -0.2), lo quitamos para no ensuciar.
            if (Math.abs(penalty) < 0.2) penalty = 0;

            if (penalty < 0) {
                // Redondeamos a 2 decimales
                penalty = Math.round(penalty * 100) / 100;
                
                total = safeAdd(total, penalty, "Bounty Throw", notes);
                
                // Solo mostramos la nota si el castigo es relevante (> 0.5)
                if (penalty <= -0.5) {
                    notes.push(`Ã°Å¸â€™Â¸ ${label} (Racha de ${spree} entregada, ${penalty} pts)`);
                }
            }
        }
    }

    // =====================================================
    // Ã°Å¸ÂÂª TIENDA E INVENTARIO: APLICAR OBJETOS (UNIFICADO V3)
    // =====================================================
    
    if (invSheet && targetName) { // Usamos targetName (que es summonerName)
       const invData = invSheet.getDataRange().getValues();
       
       // 1. RECOPILAR: Buscar quÃƒÂ© objetos TIENE el jugador disponibles
       let availableItems = {}; 
       
       for (let i = 1; i < invData.length; i++) {
          if (String(invData[i][0]).trim().toLowerCase() === String(targetName).trim().toLowerCase() && 
             (invData[i][2] === 'ACTIVE' || String(invData[i][2]).startsWith('PROGRESS'))) {
             
             const itemID = invData[i][1];
             const status = invData[i][2];
             
             if (!availableItems[itemID] || status.startsWith('PROGRESS')) {
                 availableItems[itemID] = { row: i + 1, status: status };
             }
          }
       }

       let itemToConsumeRow = -1; 
       let itemNewStatus = 'USED'; 

       // --- Ã°Å¸Å’Å¸ A. OBJETOS DE LA FORJA DE ORNN ---
       if (availableItems['ORNN_ANVIL']) {
           total += 8;
           notes.push("Ã°Å¸â€Â¨ BendiciÃƒÂ³n de Ornn (+8 Pts)");
           itemToConsumeRow = availableItems['ORNN_ANVIL'].row;
       }
       else if (availableItems['ELIXIR_SORCERY']) {
           total += 15;
           notes.push("Ã°Å¸Â§Âª Elixir de BrujerÃƒÂ­a (+15 Pts & +200G)");
           itemToConsumeRow = availableItems['ELIXIR_SORCERY'].row;
           
           // Ingresar Oro directamente
           const mSheet = ss.getSheetByName('MARKET_STATUS');
           if (mSheet) {
               const mData = mSheet.getDataRange().getValues();
               for(let j = 1; j < mData.length; j++) {
                   if(String(mData[j][0]).trim().toLowerCase() === String(targetName).trim().toLowerCase()) {
                       const curWallet = Number(mData[j][2]);
                       mSheet.getRange(j + 1, 3).setValue(curWallet + 200);
                       break;
                   }
               }
           }
       }
       else if (availableItems['INFINITY_PRIME'] && isWin && total > 0) {
           total = total * 2.0;
           notes.push("Ã¢Å¡â€Ã¯Â¸Â Filo Infinito (Puntos x2.0)");
           itemToConsumeRow = availableItems['INFINITY_PRIME'].row;
       }
       else if (availableItems['GAUNTLET_GOD'] && isWin && total > 0) {
           total = total * 3.5;
           notes.push("Ã°Å¸Â¥Å  Guantelete Divino (Puntos x3.5)");
           itemToConsumeRow = availableItems['GAUNTLET_GOD'].row;
       }
       // Ã°Å¸â€ºÂ¡Ã¯Â¸Â Objetos Defensivos (Zhonya tiene prioridad sobre el ÃƒÂngel normal)
       else if (availableItems['ZHONYA_HOURGLASS'] && total < 0 && !isWin) {
           total = 0; 
           notes.push("Ã¢ÂÂ³ Estasis Temporal (PÃƒÂ©rdida evitada)");
           itemToConsumeRow = availableItems['ZHONYA_HOURGLASS'].row;
       }
       else if (availableItems['ANGEL_GUARD'] && total < 0 && !isWin) {
           total = 0; 
           notes.push("Ã°Å¸â€˜Â¼Ã°Å¸ÂÂ» ÃƒÂngel de la Guarda");
           itemToConsumeRow = availableItems['ANGEL_GUARD'].row;
       }
       else if (availableItems['FATE_SIPHON']) {
          // 1. Calculamos los puntos a transferir (Base 4 + 10% de tu rendimiento)
          const pointsToTransfer = 4 + Math.max(0, Math.floor(currentMatchPoints * 0.10));
          
          // 2. Obtenemos el ranking actual completo
          const ranking = getFullLeaderboard(); // Esta funciÃƒÂ³n debe devolver la lista de nombres ordenada
          const myIndex = ranking.findIndex(p => p.name === summonerName);

          // 3. Identificamos los dos grupos
          const playersAbove = ranking.slice(0, myIndex); // Todos los que estÃƒÂ¡n por encima
          const playersBelow = ranking.slice(myIndex + 1); // Todos los que estÃƒÂ¡n por debajo

          if (playersAbove.length > 0 && playersBelow.length > 0) {
              // 4. SelecciÃƒÂ³n aleatoria mediante el "Dado de Zaun"
              const victim = playersAbove[Math.floor(Math.random() * playersAbove.length)].name;
              const beneficiary = playersBelow[Math.floor(Math.random() * playersBelow.length)].name;

              // 5. Ejecutamos la transferencia en el Excel
              applyScorePenalty(victim, -pointsToTransfer);
              applyScoreBonus(beneficiary, pointsToTransfer);

              notes.push(`Ã¢Å¡â€“Ã¯Â¸Â SifÃƒÂ³n: Robados ${pointsToTransfer} pts a ${victim} y entregados a ${beneficiary}`);
              
              // Consumimos el objeto
              consumeItem(summonerName, 'FATE_SIPHON');
          } else {
              notes.push("Ã¢Å¡â€“Ã¯Â¸Â El SifÃƒÂ³n fallÃƒÂ³: Necesitas tener gente por encima y por debajo de ti.");
          }
        }
       
       // --- Ã°Å¸Å½Å¸Ã¯Â¸Â B. APUESTAS Y EVENTOS CLÃƒÂSICOS ---
       

       // 2. Apuesta Primera Sangre
       else if (availableItems['BET_FIRST_BLOOD']) {
           const rowInfo = availableItems['BET_FIRST_BLOOD'];
           if (p.firstBloodKill) {
               total = safeAdd(total, 3.0, "FB Bet Win", notes);
               notes.push("Ã°Å¸Â©Â¸ Apuesta Sangre GANADA (+3)");
           } else {
               total = safeAdd(total, -1.0, "FB Bet Loss", notes);
               notes.push("Ã°Å¸Â©Â¸ Apuesta Sangre PERDIDA (-1)");
           }
           itemToConsumeRow = rowInfo.row;
       }

       // 3. Pacto de Win Streak
       else if (availableItems['PACT_STREAK']) {
           const rowInfo = availableItems['PACT_STREAK'];
           const currentStatus = rowInfo.status;

           if (isWin) {
               if (currentStatus === 'ACTIVE') {
                   itemToConsumeRow = rowInfo.row;
                   itemNewStatus = 'PROGRESS_1'; 
                   notes.push("Ã°Å¸â€Â¥ Pacto Racha: 1/2 Victorias. Ã‚Â¡Falta una!");
               } 
               else if (currentStatus === 'PROGRESS_1') {
                   total = safeAdd(total, 6.0, "Streak Pact Completed", notes);
                   notes.push("Ã°Å¸â€Â¥Ã°Å¸â€Â¥ Pacto Racha COMPLETADO (+6)");
                   itemToConsumeRow = rowInfo.row;
                   itemNewStatus = 'USED'; 
               }
           } else {
               total = safeAdd(total, -3.0, "Streak Pact Failed", notes);
               notes.push("Ã°Å¸Â¥â‚¬ Pacto Racha FALLIDO (-3)");
               itemToConsumeRow = rowInfo.row;
               itemNewStatus = 'USED'; 
           }
       }

       // --- Ã°Å¸Â§Âª C. CONSUMIBLES BÃƒÂSICOS ---
       else if (availableItems['POTION_ELO'] && isWin && total > 0) {
           total = total * 1.25;
           notes.push("Ã°Å¸Â§Âª PociÃƒÂ³n de Elo");
           itemToConsumeRow = availableItems['POTION_ELO'].row;
       }
       else if (availableItems['SOBORNO']) {
           total = total + 2;
           notes.push("Ã°Å¸â€™Â° Soborno");
           itemToConsumeRow = availableItems['SOBORNO'].row;
       }

       // 3. EJECUTAR: Actualizar estado en Inventario
       if (itemToConsumeRow !== -1) {
          invSheet.getRange(itemToConsumeRow, 3).setValue(itemNewStatus);
       }
    }

    // =====================================================
    // Ã°Å¸Å¡â‚¬ BONUS: STOMP (LÃƒâ€œGICA EXCLUSIVA - OPCIÃƒâ€œN B)
    // "O multiplicas o sumas, no las dos"
    // =====================================================
    
    if (p.win && durationMin <= 21) {
        
        // 1. Ã‚Â¿Mereces la PROYECCIÃƒâ€œN? (Alto Rendimiento)
        // Requisito: KDA >= 4.0 y KP >= 45% (Bajado un poco para ser justo)
        if (kda >= 4.0 && kp >= 0.50) {
            
            // Calculamos un 15% extra del total acumulado hasta ahora
            const projectionBonus = total * 0.15; 
            
            // Sumamos directamente (no usamos safeAdd porque es un % del total, no un fijo)
            total += projectionBonus;
            
            // Corregimos la sintaxis de las comillas invertidas ` `
            notes.push(`Ã°Å¸â€œË† ProyecciÃƒÂ³n de Stomp (+${projectionBonus.toFixed(2)} pts por acabar rÃƒÂ¡pido)`);
        } 
        
        // 2. Si NO proyectas (ej: ganaste porque se fueron AFK o te carrilearon), bono fijo pequeÃƒÂ±o
        else {
            total = safeAdd(total, 1.5, "FF Bonus", notes);
            notes.push(`Ã°Å¸ÂÂ³Ã¯Â¸Â Terror PsicolÃƒÂ³gico (Stomp <21min)`);
        }
    }



    // =====================================================
    // Ã°Å¸â€œÅ  DATA COLLECTOR (ExtracciÃƒÂ³n de stats para grÃƒÂ¡ficos e Inspector)
    // =====================================================
    const csDiffTarget = opponent ? ((p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0)) - ((opponent.totalMinionsKilled || 0) + (opponent.neutralMinionsKilled || 0)) : 0;
    const goldDiffTarget = opponent ? (p.goldEarned || 0) - (opponent.goldEarned || 0) : 0;
    const visionDiffTarget = opponent ? (p.visionScore || 0) - (opponent.visionScore || 0) : 0;
    const xpDiffTarget = opponent ? (p.challenges?.earlyLaningPhaseGoldExpAdvantage || 0) - (opponent.challenges?.earlyLaningPhaseGoldExpAdvantage || 0) : 0;

    const cachedMatch = GLOBAL_MATCH_CACHE[matchId] || {};
    
    // Ã°Å¸Å¸Â¢ EXTRAEMOS EL CS AL MINUTO 15 DESDE LA CACHÃƒâ€°
    const partId = p.participantId;
    const myCs15 = cachedMatch.customCsAt15 ? (cachedMatch.customCsAt15[partId] || 0) : 0;

    const statsPayload = {
        // 1. GLOBAL & COMBAT
        csMin: Number(csMin.toFixed(2)),
        gpm: Number(gpm.toFixed(1)),
        dpm: Number(dpm.toFixed(1)),
        vspm: Number(vspm.toFixed(2)),
        fb: p.firstBloodKill ? 1 : 0,
        ccScore: Number(p.timeCCingOthers || 0),
        
        // 2. VS OPPONENT
        xpDiff: Number(xpDiffTarget.toFixed(0)),
        goldDiff: Number(goldDiffTarget.toFixed(0)),
        csDiff: Number(csDiffTarget.toFixed(0)),
        visionDiff: Number(visionDiffTarget.toFixed(0)),

        // Ã°Å¸Å¡â‚¬ 3. EARLY GAME PURO (Pre-Minuto 14)
        earlyGoldXp: Number(p.challenges?.earlyLaningPhaseGoldExpAdvantage || 0), 
        maxCsLead: Number(p.challenges?.maxCsAdvantageOnLaneOpponent || 0),       
        maxLvlLead: Number(p.challenges?.maxLevelLeadLaneOpponent || 0),          
        
        plates: Number(p.challenges?.turretPlatesTaken || p.turretPlatesTaken || 0), // Ã°Å¸Å¸Â¢ PLACAS AÃƒâ€˜ADIDAS
        cs15: myCs15, // Ã°Å¸Å¸Â¢ CS AL MINUTO 15 AÃƒâ€˜ADIDO
        
        earlyRoams: Number(p.challenges?.killsOnOtherLanesEarlyJungleAsLaner || 0),

        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
        spells: [p.summoner1Id, p.summoner2Id],

        // Ã°Å¸Ââ€° 4. OBJETIVOS
        dmgObj: p.damageDealtToObjectives || 0,
        dmgTurrets: p.damageDealtToTurrets || 0,
        dragons: p.challenges?.dragonTakedowns || p.dragonKills || 0,
        barons: p.challenges?.baronTakedowns || p.baronKills || 0,
        heralds: p.challenges?.riftHeraldTakedowns || p.riftHeraldKills || 0,
        grubs: p.challenges?.hordeKills || 0, 
        steals: p.challenges?.epicMonsterSteals || 0,
        
        // 5. TEAM SHARE (Impacto en el equipo)
        kp: Number((kp * 100).toFixed(1)),
        dmgTakenPct: Number((dmgTakenShare * 100).toFixed(1)),
        dmgDealtPct: Number((dmgShare * 100).toFixed(1)),
        
        // 6. SUPPORT & UTILITY
        controlWards: p.visionWardsBoughtInGame || 0,
        wardsKilled: wardsDestroyed,
        wardsPlaced: p.wardsPlaced || 0,
        pickKills: Number(p.challenges?.pickKillWithAlly || 0),
        saves: Number(p.challenges?.saveAllyFromDeath || 0),
        healShield: Number((p.totalHeal || 0) + (p.totalDamageShieldedOnTeammates || 0)),

        winStats: cachedMatch.customWinStats || null,
        losStats: cachedMatch.customLosStats || null,
        goldTimeline: cachedMatch.customGoldTimeline || null,
        eventsList: cachedMatch.customEventsList || null // Ã°Å¸Å¸Â¢ Ã‚Â¡ESTA LÃƒÂNEA FALTABA!
    };

    return { total, notes, statsPayload };
    
  } catch (e) {
    return { total: 0, notes: ["Error cÃƒÂ¡lculo: " + e.message], statsPayload: {} };
  }
}

 
// computePointsDetailed
 
/* =========================================================================
   Ã°Å¸Ââ€  SISTEMA DE RANKING Y SALÃƒâ€œN DE LA FAMA V6.0 (Dashboard Profesional)
   ========================================================================= */
function updateScores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rankingSheet = ss.getSheetByName("RANKING");
  const matchesSheet = ss.getSheetByName("MATCHES");
  const playersSheet = ss.getSheetByName("PLAYERS");

  if (!rankingSheet || !matchesSheet || !playersSheet) {
    console.log("Error: Falta alguna pestaÃƒÂ±a clave.");
    return;
  }

  // 1. Limpiar la hoja por completo para que el script construya el diseÃƒÂ±o
  rankingSheet.clear();

  // 2. Jugadores activos
  const playersData = playersSheet.getDataRange().getValues();
  const activePlayers = new Set();
  for (let i = 1; i < playersData.length; i++) {
    if (String(playersData[i][4]).toLowerCase() === 'sÃƒÂ­') {
      activePlayers.add(String(playersData[i][0]).toLowerCase().trim());
    }
  }

  // 3. Buscar columnas
  const matchesData = matchesSheet.getDataRange().getValues();
  if (matchesData.length < 2) return;

  const headers = matchesData[0].map(h => String(h).toLowerCase().trim());
  const idxPlayer = headers.findIndex(h => h === "summoner" || h.includes("player") || h.includes("jugador") || h === "name");
  const idxPoints = headers.findIndex(h => h === "points" || h.includes("point") || h === "score");
  const idxResult = headers.findIndex(h => h === "result" || h.includes("resultado") || h === "win");
  const idxKills = headers.findIndex(h => h === "k" || h === "kills");
  const idxDeaths = headers.findIndex(h => h === "d" || h === "deaths");
  const idxAssists = headers.findIndex(h => h === "a" || h === "assists");
  const idxDamage = headers.findIndex(h => h === "damage" || h.includes("daÃƒÂ±o"));
  const idxChamp = headers.findIndex(h => h === "champion" || h.includes("campeÃƒÂ³n") || h === "champ");

  if (idxPlayer === -1 || idxPoints === -1) return;

  // 4. Variables para las nuevas mÃƒÂ©tricas
  const stats = {};
  const allMatchesList = []; // Para el Top 3 partidas
  let totalSeasonMatches = matchesData.length - 1;

  activePlayers.forEach(p => {
    stats[p] = { 
      name: "", points: 0, wins: 0, games: 0, kills: 0, deaths: 0, assists: 0, damage: 0,
      matchHistory: [] // Para calcular las rachas cronolÃƒÂ³gicas
    };
  });

  // Procesar partidas (Asumimos que de la fila 1 hacia abajo es orden cronolÃƒÂ³gico)
  for (let i = 1; i < matchesData.length; i++) {
    const row = matchesData[i];
    const rawName = String(row[idxPlayer]).trim();
    const pName = rawName.toLowerCase();

    if (activePlayers.has(pName)) {
      if (!stats[pName].name) stats[pName].name = rawName;

      const pts = Number(row[idxPoints]) || 0;
      stats[pName].points += pts;
      stats[pName].games += 1;

      let isWin = false;
      if (idxResult !== -1) {
        const res = String(row[idxResult]).toLowerCase();
        if (res.includes("win") || res === "victoria" || res === "v") {
          stats[pName].wins += 1;
          isWin = true;
        }
      }
      
      // AÃƒÂ±adir al historial del jugador (para rachas)
      stats[pName].matchHistory.push(isWin);

      // AÃƒÂ±adir a la lista global de partidas (para el Top 3)
      const champ = idxChamp !== -1 ? String(row[idxChamp]) : "Unknown";
      allMatchesList.push({ name: rawName, points: pts, champ: champ });

      if (idxKills !== -1) stats[pName].kills += Number(row[idxKills]) || 0;
      if (idxDeaths !== -1) stats[pName].deaths += Number(row[idxDeaths]) || 0;
      if (idxAssists !== -1) stats[pName].assists += Number(row[idxAssists]) || 0;
      if (idxDamage !== -1) stats[pName].damage += Number(row[idxDamage]) || 0;
    }
  }

  // 5. Calcular Rachas (Max Win / Max Loss) por jugador
  let longestWinStreak = { name: "-", val: 0 };
  let longestLossStreak = { name: "-", val: 0 };

  const playersList = Object.values(stats).filter(p => p.games > 0);
  
  playersList.forEach(p => {
    let curWin = 0, maxWin = 0;
    let curLoss = 0, maxLoss = 0;

    p.matchHistory.forEach(win => {
      if (win) { curWin++; curLoss = 0; if (curWin > maxWin) maxWin = curWin; } 
      else { curLoss++; curWin = 0; if (curLoss > maxLoss) maxLoss = curLoss; }
    });

    if (maxWin > longestWinStreak.val) { longestWinStreak.val = maxWin; longestWinStreak.name = p.name; }
    if (maxLoss > longestLossStreak.val) { longestLossStreak.val = maxLoss; longestLossStreak.name = p.name; }
  });

  // Ordenar Leaderboard Principal
  playersList.sort((a, b) => b.points - a.points);
  
  // Ordenar Top 3 Partidas Globales
  allMatchesList.sort((a, b) => b.points - a.points);

  // =========================================================================
  // Ã°Å¸Å½Â¨ CONSTRUCCIÃƒâ€œN VISUAL DEL DASHBOARD (EL "GLOW UP")
  // =========================================================================
  
  // Configurar anchos de columna para que quede bonito
  rankingSheet.setColumnWidth(1, 160); // Summoner
  rankingSheet.setColumnWidth(2, 100); // Puntos
  rankingSheet.setColumnWidth(3, 160); // Tier
  rankingSheet.setColumnWidth(4, 50);  // Espacio
  rankingSheet.setColumnWidth(5, 230); // EstadÃƒÂ­stica
  rankingSheet.setColumnWidth(6, 100); // Valor
  rankingSheet.setColumnWidth(7, 160); // Jugador

  // Estilos Base
  const colorBgDark = "#0a1428"; // Azul LoL
  const colorGold = "#c8aa6e";   // Dorado Hextech
  const colorGray = "#1e2328";   // Gris oscuro
  const colorTextWhite = "#ffffff";

  // --- BLOQUE IZQUIERDO: LEADERBOARD ---
  rankingSheet.getRange("A1:C1").setValues([["SUMMONER", "PUNTOS", "LIGA / TIER"]])
    .setBackground(colorBgDark).setFontColor(colorGold).setFontWeight("bold").setHorizontalAlignment("center");

  const leaderboardData = [];
  playersList.forEach((p, index) => {
    let tier = "Bronce Ã°Å¸Â¥â€°";
    if (index === 0) tier = "Challenger Ã°Å¸â€˜â€˜";
    else if (index <= 2) tier = "Grandmaster Ã°Å¸â€™Å½";
    else if (index <= 5) tier = "Master Ã°Å¸â€Â®";
    else if (p.points >= 150) tier = "Diamante Ã°Å¸â€™Â ";
    else if (p.points >= 80) tier = "Esmeralda Ã¢Ââ€¡Ã¯Â¸Â";
    else if (p.points >= 40) tier = "Platino Ã°Å¸â€ºÂ¡Ã¯Â¸Â";
    else if (p.points >= 10) tier = "Oro Ã°Å¸Â¥â€¡";
    else if (p.points >= 0) tier = "Plata Ã°Å¸Â¥Ë†";

    leaderboardData.push([p.name, p.points.toFixed(2), tier]);
  });

  if (leaderboardData.length > 0) {
    const lbRange = rankingSheet.getRange(2, 1, leaderboardData.length, 3);
    lbRange.setValues(leaderboardData);
    lbRange.setHorizontalAlignment("center");
    lbRange.setBorder(true, true, true, true, false, true, "gray", SpreadsheetApp.BorderStyle.SOLID);
    
    // Pintar los 3 primeros de dorado
    if (leaderboardData.length >= 1) rankingSheet.getRange(2, 1, 1, 3).setBackground("#fff3cd"); // Top 1
    if (leaderboardData.length >= 2) rankingSheet.getRange(3, 1, 2, 3).setBackground("#f8f9fa"); // Top 2 y 3
  }

  // --- BLOQUE DERECHO: SALÃƒâ€œN DE LA FAMA ---
  let topKills = { name: "-", val: 0 };
  let topDeaths = { name: "-", val: 0 };
  let topDamage = { name: "-", val: 0 };
  let topGames = { name: "-", val: 0 };
  let topKDA = { name: "-", val: 0 };

  playersList.forEach(p => {
    if (p.kills > topKills.val) { topKills.name = p.name; topKills.val = p.kills; }
    if (p.deaths > topDeaths.val) { topDeaths.name = p.name; topDeaths.val = p.deaths; }
    if (p.damage > topDamage.val) { topDamage.name = p.name; topDamage.val = p.damage; }
    if (p.games > topGames.val) { topGames.name = p.name; topGames.val = p.games; }
    if (p.games >= 3) {
      const kda = (p.kills + p.assists) / Math.max(1, p.deaths);
      if (kda > topKDA.val) { topKDA.name = p.name; topKDA.val = kda; }
    }
  });

  // FunciÃƒÂ³n de ayuda para crear cabeceras de secciÃƒÂ³n
  const createSectionHeader = (row, text) => {
    const range = rankingSheet.getRange(row, 5, 1, 3);
    range.merge().setValue(text)
      .setBackground(colorGray).setFontColor(colorTextWhite).setFontWeight("bold")
      .setHorizontalAlignment("center").setBorder(true, true, true, true, false, false, "black", SpreadsheetApp.BorderStyle.SOLID_THICK);
  };

  // SECCIÃƒâ€œN 1: Superlativos ClÃƒÂ¡sicos
  let startRow = 1;
  createSectionHeader(startRow, "Ã°Å¸Ââ€  SALÃƒâ€œN DE LA FAMA (HistÃƒÂ³rico)");
  
  const superData = [
    ["Ã¢Å¡â€Ã¯Â¸Â Asesino Implacable (Kills)", topKills.val, topKills.name],
    ["Ã°Å¸â€™â‚¬ El Comedor de Suelo (Muertes)", topDeaths.val, topDeaths.name],
    ["Ã°Å¸â€™Â¥ MÃƒÂ¡quina de Asedio (DaÃƒÂ±o)", (topDamage.val / 1000).toFixed(1) + "k", topDamage.name],
    ["Ã°Å¸â€ºÂ¡Ã¯Â¸Â KDA Perfecto (Media)", topKDA.val.toFixed(2), topKDA.name],
    ["Ã°Å¸Å½Â® Tryhard Sin Vida (Partidas)", topGames.val, topGames.name]
  ];
  
  let range = rankingSheet.getRange(startRow + 1, 5, superData.length, 3);
  range.setValues(superData).setHorizontalAlignment("center").setBorder(true, true, true, true, false, true, "silver", SpreadsheetApp.BorderStyle.SOLID);
  rankingSheet.getRange(startRow + 1, 5, superData.length, 1).setHorizontalAlignment("left"); // Alineamos los nombres de mÃƒÂ©tricas a la izquierda

  // SECCIÃƒâ€œN 2: Rachas y Temporada
  startRow = startRow + superData.length + 2;
  createSectionHeader(startRow, "Ã°Å¸â€Â¥ RACHAS Y RÃƒâ€°CORDS GLOBALES");

  const recordsData = [
    ["Ã°Å¸â€Â¥ Mayor Racha de Victorias", longestWinStreak.val + " Victorias", longestWinStreak.name],
    ["Ã°Å¸Å’Â§Ã¯Â¸Â Peor Racha de Derrotas", longestLossStreak.val + " Derrotas", longestLossStreak.name],
    ["Ã°Å¸Å’Â Partidas Totales Season 2", totalSeasonMatches + " Jugadas", "Todo el Servidor"]
  ];

  range = rankingSheet.getRange(startRow + 1, 5, recordsData.length, 3);
  range.setValues(recordsData).setHorizontalAlignment("center").setBorder(true, true, true, true, false, true, "silver", SpreadsheetApp.BorderStyle.SOLID);
  rankingSheet.getRange(startRow + 1, 5, recordsData.length, 1).setHorizontalAlignment("left");
  // Destacar en verde y rojo las rachas
  rankingSheet.getRange(startRow + 1, 6).setFontColor("#28a745").setFontWeight("bold");
  rankingSheet.getRange(startRow + 2, 6).setFontColor("#dc3545").setFontWeight("bold");

  // SECCIÃƒâ€œN 3: Top Mejores Partidas Individuales
  startRow = startRow + recordsData.length + 2;
  createSectionHeader(startRow, "Ã¢Â­Â TOP 3: CARRILES HISTÃƒâ€œRICOS");
  
  // Cabecera secundaria del top 3
  rankingSheet.getRange(startRow + 1, 5, 1, 3).setValues([["Jugador (CampeÃƒÂ³n)", "Puntos de Liga", "PosiciÃƒÂ³n"]])
    .setBackground("#f1f3f4").setFontWeight("bold").setHorizontalAlignment("center");

  const topMatchesData = [];
  for (let i = 0; i < Math.min(3, allMatchesList.length); i++) {
    const m = allMatchesList[i];
    const medal = i === 0 ? "Ã°Å¸Â¥â€¡ 1Ã‚Âº" : i === 1 ? "Ã°Å¸Â¥Ë† 2Ã‚Âº" : "Ã°Å¸Â¥â€° 3Ã‚Âº";
    topMatchesData.push([`${m.name} (${m.champ})`, `+${m.points.toFixed(2)} pts`, medal]);
  }

  if (topMatchesData.length > 0) {
    range = rankingSheet.getRange(startRow + 2, 5, topMatchesData.length, 3);
    range.setValues(topMatchesData).setHorizontalAlignment("center").setBorder(true, true, true, true, false, true, "silver", SpreadsheetApp.BorderStyle.SOLID);
    
    // Pintar el TOP 1 con estilo
    rankingSheet.getRange(startRow + 2, 5, 1, 3).setBackground("#fff3cd").setFontWeight("bold");
  }

  SpreadsheetApp.flush();
}

function applyScoreColors() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const scores = ss.getSheetByName('SCORES');
Ã‚Â  if (!scores) return;
Ã‚Â  const rows = scores.getDataRange().getValues();
Ã‚Â  if (rows.length <= 1) return;
Ã‚Â  for (let i=1;i<rows.length;i++){
Ã‚Â  Ã‚Â  const tier = rows[i][2];
Ã‚Â  Ã‚Â  const color = tierColor(tier);
Ã‚Â  Ã‚Â  scores.getRange(i+1,1,1,4).setBackground(color);
Ã‚Â  }
}

/* ==========================================================
   Ã°Å¸Ââ€  ACTUALIZAR RANKING (VERSIÃƒâ€œN S2 - CON FILTRO DE SEASON)
   ========================================================== */
function updateRanking() {
  const ss = SpreadsheetApp.getActive();
  
  // 1. Definimos las hojas con nombres CLAROS
  // CORRECCIÃƒâ€œN: Usar el nombre 'matchesSheet' aquÃƒÂ­
  const matchesSheet = ss.getSheetByName('MATCHES'); 
  const rankingSheet = ss.getSheetByName('RANKING');
  const configSheet = ss.getSheetByName('CONFIG');

  

  if (!rankingSheet || !matchesSheet) {
    Logger.log('updateRanking: Faltan hojas');
    return;
  }

  // 2. OBTENER SEASON ACTUAL
  let currentSeason = 'S1';
  if (configSheet) {
      // Usamos B2 como confirmamos antes
      currentSeason = configSheet.getRange('B2').getValue(); 
  }

  // 3. LEER DATOS
  // AHORA SÃƒÂ USAMOS LA VARIABLE CORRECTA 'matchesSheet'
  const mData = matchesSheet.getDataRange().getValues(); 
  const seasonColIdx = mData[0].length - 1; 

  let playerPoints = {}; 
  let playerStats = {}; 
  let totalMatches = 0;

  // 4. PROCESAR
  for (let i = 1; i < mData.length; i++) {
    const row = mData[i];
    const pName = row[2]; 
    const result = row[5]; 
    const points = Number(row[12]); // AsegÃƒÂºrate que Puntos es Columna 12 (M)
    const matchSeason = String(row[seasonColIdx]); 

    // FILTRO
    if (matchSeason !== currentSeason) continue;

    if (!playerPoints[pName]) {
        playerPoints[pName] = 0;
        playerStats[pName] = { matches: 0, wins: 0, currentStreak: 0, bestWin: 0, worstLoss: 0 };
    }

    playerPoints[pName] += points;

    const stats = playerStats[pName];
    stats.matches++;
    totalMatches++;

    if (result === 'Win') {
        stats.wins++;
        if (stats.currentStreak >= 0) stats.currentStreak++;
        else stats.currentStreak = 1;
        if (stats.currentStreak > stats.bestWin) stats.bestWin = stats.currentStreak;
    } else {
        if (stats.currentStreak <= 0) stats.currentStreak--;
        else stats.currentStreak = -1;
        if (stats.currentStreak < stats.worstLoss) stats.worstLoss = stats.currentStreak;
    }
  }

  // 5. PREPARAR ARRAY
  const rankArray = [];
  Object.keys(playerPoints).forEach(player => {
      let pts = playerPoints[player];
      let tier = 'IRON'; 
      // (Tu lÃƒÂ³gica de tiers aquÃƒÂ­, simplificada para el ejemplo)
      if (typeof tierForPoints === 'function') tier = tierForPoints(pts);
      else if (pts > 100) tier = 'GOLD'; // Fallback
      
      rankArray.push([player, pts, tier]);
  });

  rankArray.sort((a, b) => b[1] - a[1]);

  // 6. ESCRIBIR
  rankingSheet.clear();
  rankingSheet.getRange('A1:C1').setValues([['Summoner', 'Points', 'Tier']]).setFontWeight('bold');
  rankingSheet.getRange('F1:H1').setValues([['EstadÃƒÂ­sticas (' + currentSeason + ')', 'Valor', 'Jugador']]).setFontWeight('bold');
  
  if (rankArray.length > 0) {
    rankingSheet.getRange(2, 1, rankArray.length, 3).setValues(rankArray);
    // Colorear
    const rows = rankingSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
        const t = rows[i][2]; 
        if (t && typeof tierColor === 'function') {
            rankingSheet.getRange(i + 1, 1, 1, 3).setBackground(tierColor(t));
        }
    }
  } else {
      rankingSheet.getRange(2,1).setValue("Sin datos en " + currentSeason);
  }
}

/* ----------------- DASHBOARD & CHARTS ----------------- */
function createDashboard() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const dash = ss.getSheetByName('DASHBOARD');
Ã‚Â  const ranking = ss.getSheetByName('RANKING');
Ã‚Â  const matches = ss.getSheetByName('MATCHES');
Ã‚Â  const scores = ss.getSheetByName('SCORES');

Ã‚Â  if (!dash || !ranking || !matches || !scores) {Ã‚Â 
Ã‚Â  Ã‚Â  SpreadsheetApp.getUi().alert('Crea las hojas requeridas o ejecuta SetupInicial()');Ã‚Â 
Ã‚Â  Ã‚Â  return;Ã‚Â 
Ã‚Â  }

Ã‚Â  dash.clear();
Ã‚Â  dash.setColumnWidths(1,6,180);
Ã‚Â  dash.appendRow(['SoloQ Dashboard']);
Ã‚Â  dash.appendRow(['Top 5 Ã¢â‚¬â€ Ranking']);

Ã‚Â  const rLastRow = Math.max(2, ranking.getLastRow());
Ã‚Â  const rdata = ranking.getRange(1, 1, rLastRow, 3).getValues();Ã‚Â 
Ã‚Â Ã‚Â 
Ã‚Â  const topData = rdata.slice(1, 6);Ã‚Â 
Ã‚Â  const topMapped = topData.map(row => [row[0], row[1], row[2]]);Ã‚Â 
Ã‚Â Ã‚Â 
Ã‚Â  if (topMapped.length > 0) {
Ã‚Â  Ã‚Â  dash.getRange(3,1,1,3).setValues([['Summoner','Points','Tier']]);
Ã‚Â  Ã‚Â  dash.getRange(4,1,topMapped.length,3).setValues(topMapped);
Ã‚Â  }

Ã‚Â  dash.appendRow(['']);
Ã‚Â  dash.appendRow(['ÃƒÅ¡ltimas partidas (global):']);
Ã‚Â Ã‚Â 
Ã‚Â  const mdataAll = matches.getDataRange().getValues();
Ã‚Â  if (mdataAll.length > 1) {
Ã‚Â  Ã‚Â  const mdata = mdataAll.slice(1).reverse().slice(0,10);
Ã‚Â  Ã‚Â  if (mdata.length>0) {
Ã‚Â  Ã‚Â  Ã‚Â  dash.getRange(dash.getLastRow() + 1, 1, 1, 6).setValues([['Date','Player','MatchID','Champion','Points','Notes']]);
Ã‚Â  Ã‚Â  Ã‚Â  const rows = mdata.map(r => [r[1], r[2], r[0], r[3], r[12], r[13]]);
Ã‚Â  Ã‚Â  Ã‚Â  dash.getRange(dash.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
Ã‚Â  Ã‚Â  }
Ã‚Â  }

Ã‚Â  // Leaderboard chart
Ã‚Â  const charts = dash.getCharts();
Ã‚Â  charts.forEach(c => dash.removeChart(c));
Ã‚Â  const sLastRow = Math.max(2, scores.getLastRow());
Ã‚Â  const sr = scores.getRange(1,1, sLastRow, 2); // summoner, points
Ã‚Â  try {
Ã‚Â  Ã‚Â  const chart = dash.newChart().asColumnChart().addRange(sr).setPosition(2,8,0,0).setOption('title','Leaderboard - Total Points').setOption('legend',{position:'none'}).build();
Ã‚Â  Ã‚Â  dash.insertChart(chart);
Ã‚Â  } catch(e){ /* ignore chart errors */ }

Ã‚Â  SpreadsheetApp.getUi().alert('Dashboard creado. Revisa DASHBOARD.');
}

/* ----------------- FORMATTING / MENU / TRIGGERS ----------------- */
function formatSheets() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â Ã‚Â 
Ã‚Â  const sheetsToFormat = [
Ã‚Â  Ã‚Â  { name: 'PLAYERS', range: 'A1:F1', widths: [{col: 1, count: 6, width: 140}] },
Ã‚Â  Ã‚Â  { name: 'MATCHES', range: 'A1:N1', widths: [{col: 1, count: 14, width: 110}] },
Ã‚Â  Ã‚Â  { name: 'SCORES', range: 'A1:D1', widths: [{col: 1, count: 4, width: 160}] },
Ã‚Â  Ã‚Â  { name: 'RANKING', range: 'A1:H1', widths: [{col: 1, count: 3, width: 160}, {col: 6, count: 3, width: 160}] },
Ã‚Â  Ã‚Â  { name: 'CONFIG', range: 'A1:C1', widths: [{col: 1, count: 3, width: 220}] },
Ã‚Â  Ã‚Â  { name: 'WEEKLY', range: 'A1:D1', widths: [{col: 1, count: 4, width: 150}] },
Ã‚Â  Ã‚Â  { name: 'MONTHLY', range: 'A1:D1', widths: [{col: 1, count: 4, width: 150}] },
Ã‚Â  Ã‚Â  { name: 'MANUAL_POINTS', range: 'A1:D1', widths: [{col: 1, count: 4, width: 150}] },
Ã‚Â  Ã‚Â  { name: 'CHAMPION_DATA', range: 'A1:C1', widths: [{col: 1, count: 3, width: 150}] },
Ã‚Â  Ã‚Â  { name: 'KNOWN_CHAMPS', range: 'A1:C1', widths: [{col: 1, count: 3, width: 200}] },
Ã‚Â  Ã‚Â  { name: 'LOGS', range: 'A1:B1', widths: [{col: 1, count: 2, width: 200}] }
Ã‚Â  ];

Ã‚Â  sheetsToFormat.forEach(s => {
Ã‚Â  Ã‚Â  const sheet = ss.getSheetByName(s.name);
Ã‚Â  Ã‚Â  if (sheet) {
Ã‚Â  Ã‚Â  Ã‚Â  sheet.setFrozenRows(1);
Ã‚Â  Ã‚Â  Ã‚Â  if (s.range) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  sheet.getRange(s.range).setFontWeight('bold');
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  Ã‚Â  s.widths.forEach(w => {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  sheet.setColumnWidths(w.col, w.count, w.width);
Ã‚Â  Ã‚Â  Ã‚Â  });
Ã‚Â  Ã‚Â  }
Ã‚Â  });
}

function createHourlyTrigger() {
Ã‚Â  deleteTriggers(); // Borra todos los triggers para evitar duplicados
Ã‚Â  ScriptApp.newTrigger('syncMatches').timeBased().everyHours(1).create();
Ã‚Â  logToSheet('Trigger horario (syncMatches) creado (cada 1 hora).');
Ã‚Â  SpreadsheetApp.getUi().alert('Trigger de syncMatches (1h) creado.');
}

function createHalfHourTrigger() {
  // 1. Borrar anteriores (silenciosamente)
  deleteTriggers(); 
  
  // 2. Crear nuevo trigger de 30 minutos
  ScriptApp.newTrigger('syncMatches')
      .timeBased()
      .everyMinutes(30)
      .create();
      
  logToSheet('Trigger de sincronizaciÃƒÂ³n actualizado (cada 30 min).');
  
  // 3. Mostrar alerta de ÃƒÂ©xito (Protegido con try-catch por seguridad)
  try {
    SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Sistema actualizado: Las partidas se buscarÃƒÂ¡n cada 30 minutos.');
  } catch(e) {
    console.log("Trigger creado, pero no se pudo mostrar la alerta visual.");
  }
}

function createQuarterHourTrigger() {
  // 1. Borrar anteriores (silenciosamente)
  deleteTriggers(); 
  
  // 2. Crear nuevo trigger de 30 minutos
  ScriptApp.newTrigger('syncMatches')
      .timeBased()
      .everyMinutes(15)
      .create();
      
  logToSheet('Trigger de sincronizaciÃƒÂ³n actualizado (cada 15 min).');
  
  // 3. Mostrar alerta de ÃƒÂ©xito (Protegido con try-catch por seguridad)
  try {
    SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Sistema actualizado: Las partidas se buscarÃƒÂ¡n cada 30 minutos.');
  } catch(e) {
    console.log("Trigger creado, pero no se pudo mostrar la alerta visual.");
  }
}

function createQuarterHourTriggerALL() {
  // 1. Borrar anteriores (silenciosamente)
  deleteTriggers(); 
  
  // 2. Crear nuevo trigger de 30 minutos
  ScriptApp.newTrigger('syncAllRiftModes')
      .timeBased()
      .everyMinutes(15)
      .create();
      
  logToSheet('Trigger de sincronizaciÃƒÂ³n actualizado (cada 15 min).');
  
  // 3. Mostrar alerta de ÃƒÂ©xito (Protegido con try-catch por seguridad)
  try {
    SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Sistema actualizado: Las partidas se buscarÃƒÂ¡n cada 30 minutos.');
  } catch(e) {
    console.log("Trigger creado, pero no se pudo mostrar la alerta visual.");
  }
}

function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  logToSheet('Todos los Triggers eliminados (Limpieza interna).');
}

function applyTiltPenalties() {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const cfg = readConfigMap();Ã‚Â 
Ã‚Â  const threshold = cfg.tilt_loss_threshold;Ã‚Â 
Ã‚Â  const penalty = cfg.tilt_penalty;Ã‚Â 
Ã‚Â  const matches = ss.getSheetByName('MATCHES');
Ã‚Â  if (!matches) { SpreadsheetApp.getUi().alert('MATCHES no existe'); return; }
Ã‚Â  const data = matches.getDataRange().getValues();
Ã‚Â  const byPlayer = {};
Ã‚Â  for (let i=1;i<data.length;i++){
Ã‚Â  Ã‚Â  const r = data[i];
Ã‚Â  Ã‚Â  const summ = r[2];
Ã‚Â  Ã‚Â  const res = r[5];
Ã‚Â  Ã‚Â  if (!byPlayer[summ]) byPlayer[summ] = [];
Ã‚Â  Ã‚Â  byPlayer[summ].push({index:i+1, result:res});
Ã‚Â  }
Ã‚Â  for (let p in byPlayer) {
Ã‚Â  Ã‚Â  const arr = byPlayer[p];
Ã‚Â  Ã‚Â  let losses = 0;
Ã‚Â  Ã‚Â  for (let j=arr.length-1; j>=0; j--) {
Ã‚Â  Ã‚Â  Ã‚Â  if (arr[j].result === 'Loss') {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  losses++;
Ã‚Â  Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  break;Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  if (losses >= threshold) {
Ã‚Â  Ã‚Â  Ã‚Â  const lastLossRowIndex = arr[arr.length-1].index;
Ã‚Â  Ã‚Â  Ã‚Â  const notesCell = matches.getRange(lastLossRowIndex, 14); // Col N (Notas)
Ã‚Â  Ã‚Â  Ã‚Â  const currentNotes = notesCell.getValue();
Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  if (!currentNotes.includes('Tilt penalty')) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  // v10.0: AÃƒÂ±adir a MANUAL_POINTS en lugar de MATCHES
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const manualSheet = ss.getSheetByName('MANUAL_POINTS');
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  manualSheet.appendRow([new Date(), p, penalty, `Tilt penalty for ${losses} losses`]);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  notesCell.setValue(currentNotes + '; Tilt penalty applied');
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`PenalizaciÃƒÂ³n por Tilt aplicada a ${p} por ${losses} derrotas.`);
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  }
Ã‚Â  updateScores();Ã‚Â 
Ã‚Â  SpreadsheetApp.getUi().alert('Penalizaciones aplicadas (si las hubo).');
}


/* ----------------- MENU onOpen ----------------- */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // 1. CREAR EL MENÃƒÅ¡ PRINCIPAL
  const menuPrincipal = ui.createMenu('SoloQ Challenge');

  // 2. SUBMENÃƒÅ¡ HERRAMIENTAS (Web Apps)
  const toolsMenu = ui.createMenu('Ã°Å¸â€œÅ  Dashboards y GrÃƒÂ¡ficos');
  
  // -- Lo bÃƒÂ¡sico --
  toolsMenu.addItem('Ã°Å¸ÂÂ  Dashboard Global', 'showGlobalDashboard'); 
  toolsMenu.addItem('Ã°Å¸â€ºâ€¹Ã¯Â¸Â SalÃƒÂ³n de la fama', 'showDashboardV12'); 
  toolsMenu.addItem('Ã°Å¸Ââ€  Ranking Ãƒâ€°pico', 'showEpicRanking');

  toolsMenu.addSeparator();

  // -- AnalÃƒÂ­ticas EspecÃƒÂ­ficas --
  toolsMenu.addItem('Ã°Å¸Å’Â Centro de AnalÃƒÂ­ticas', 'showAnalyticsDashboard');
  toolsMenu.addItem('Ã°Å¸â€œÅ“ Historial Completo', 'showGlobalHistory'); 
  toolsMenu.addItem('Ã°Å¸Å½Â¨ MenÃƒÂº GrÃƒÂ¡fico', 'showGraphicsMenu'); 
  
  toolsMenu.addSeparator();
  
  // -- GrÃƒÂ¡ficos EspecÃƒÂ­ficos --
  toolsMenu.addItem('Ã°Å¸â€™Å¾ Analizador de Sinergias (DÃƒÂºos)', 'showSynergyDashboard');
  toolsMenu.addItem('Ã°Å¸Â§Â  PsicologÃƒÂ­a & Tilt (Cronotipos)', 'showBehaviorDashboard');
  toolsMenu.addSeparator();
  
  // -- Herramientas de AnÃƒÂ¡lisis --
  toolsMenu.addItem('Ã°Å¸â€Å½ Inspector de Partidas (ClÃƒÂ¡sico)', 'showMatchInspector');

  // 3. SUBMENÃƒÅ¡ ADMIN (Mantenimiento TÃƒÂ©cnico)
  const adminMenu = ui.createMenu('Ã¢Å¡â„¢Ã¯Â¸Â Admin y Datos');
  adminMenu.addItem('Ã°Å¸â€â€ž Actualizar Todo (Sync)', 'syncMatches');
  adminMenu.addItem('Ã°Å¸â€ºÂ Ã¯Â¸Â Setup Inicial / Update', 'SetupInicial');
  adminMenu.addSeparator();
  adminMenu.addItem('Ã°Å¸â€™Â° Sincronizar Jugadores Bolsa', 'refreshMarketPlayers');
  adminMenu.addItem('Ã°Å¸â€˜Â¾ Configurar Vida Boss', 'adminSetBossLife');
  adminMenu.addItem('Ã°Å¸â€™Â¼ AÃƒÂ±adir Inversor (Broker)', 'addPureInvestor');
  adminMenu.addSeparator();

  // 4. SUBMENÃƒÅ¡ EVENTOS (Ã‚Â¡AQUÃƒÂ ESTÃƒÂ LO NUEVO!)
  const eventosMenu = ui.createMenu('Ã¢Å¡Â¡ GESTIÃƒâ€œN DE EVENTOS');
  
  // -- TORNEO 5vs5 (NUEVO) --
  eventosMenu.addItem('Ã°Å¸Å¸Â¢ INICIAR Torneo (Draft)', 'startTeamBattleEvent');
  eventosMenu.addItem('Ã°Å¸â€â€™ BLOQUEAR Roles (Guerra)', 'lockTeamBattlePhase');
  eventosMenu.addItem('Ã°Å¸Ââ€  RESOLVER Ronda (Domingo)', 'resolveTeamBattleRound');
  eventosMenu.addItem('Ã°Å¸â€Â´ APAGAR Torneo', 'stopTeamBattleEvent');
  eventosMenu.addSeparator();

  // -- RIVALES --
  eventosMenu.addItem('Ã¢Å¡â€Ã¯Â¸Â Generar Rivales (Lunes)', 'generarRivales');
  eventosMenu.addItem('Ã°Å¸Ââ€  Resolver Rivales (Domingo)', 'resolverRivales');
  eventosMenu.addSeparator();

  // -- FACCIONES --
  eventosMenu.addItem('Ã¢Å¡â€Ã¯Â¸Â INICIAR Guerra Facciones', 'startFactionWar');
  eventosMenu.addItem('Ã°Å¸â€”Â³Ã¯Â¸Â Abrir Urna de VotaciÃƒÂ³n', 'abrirUrnaVotacion'); 
  eventosMenu.addItem('Ã°Å¸ÂÂ FINALIZAR Guerra Facciones', 'endFactionWar');
  eventosMenu.addSeparator();

  // -- PATATA CALIENTE --
  eventosMenu.addItem('Ã°Å¸â€™Â£ Lanzar Patata Caliente', 'startHotPotato');
  eventosMenu.addItem('Ã°Å¸Â§Â¯ DETENER Patata Caliente', 'stopHotPotato');
  eventosMenu.addSeparator();

  // -- LA PURGA --
  eventosMenu.addItem('Ã°Å¸Å¸Â¢ ACTIVAR La Purga', 'startPurgeEvent');
  eventosMenu.addItem('Ã°Å¸â€Â´ DETENER La Purga', 'stopPurgeEvent');
  eventosMenu.addItem('Ã¢Å¡Â¡ Forzar Purga de Hoy (Test)', 'runThePurge');
  eventosMenu.addSeparator();
  
  // -- LA HORDA --
  eventosMenu.addItem('Ã°Å¸Å¸Â¢ INICIAR Horda del VacÃƒÂ­o', 'startVoidHorde');
  eventosMenu.addItem('Ã°Å¸â€Â´ FINALIZAR Horda (Check)', 'endVoidHorde');
  eventosMenu.addSeparator();

  // -- RAID BOSS (DRAGÃƒâ€œN) --
  eventosMenu.addItem('Ã°Å¸ÂÂ² Configurar Vida Boss', 'configureBossCustom'); 
  eventosMenu.addItem('Ã°Å¸â€™â‚¬ Eliminar/Quitar Boss', 'removeBoss');         
  eventosMenu.addSeparator();
  
  // -- MERCADO --
  eventosMenu.addItem('Ã°Å¸Å’Â Evento Aleatorio (Banca Rota)', 'triggerEventoMercado');

  // 5. CONSTRUIR EL MENÃƒÅ¡
  menuPrincipal.addSubMenu(toolsMenu);
  menuPrincipal.addSubMenu(eventosMenu);
  menuPrincipal.addSubMenu(adminMenu);
  
  menuPrincipal.addToUi();
}

/* ----------------- Utilities ----------------- */
function getWeekNumber(d) {
Ã‚Â  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
Ã‚Â  const dayNum = date.getUTCDay() || 7;
Ã‚Â  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
Ã‚Â  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
Ã‚Â  return Math.ceil((((date - yearStart) / 86400000) + 1)/7);
}


function createMaintenanceTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const handler = t.getHandlerFunction();
    if (['generateWeeklyReport', 'generateMonthlyReport', 'cleanupOldLogs', 'checkBossWeeklyReset', 'weeklyResetPlayers'].includes(handler)) {
      ScriptApp.deleteTrigger(t);
    }
  }

  // 1. Reporte Semanal (Lunes 02:00 AM)
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();

  // 2. Reporte Mensual (DÃƒÂ­a 1 del mes)
  ScriptApp.newTrigger('generateMonthlyReport')
    .timeBased().onMonthDay(1).atHour(3).create();

  // 3. Limpieza de Logs (Domingo 04:00 AM)
  ScriptApp.newTrigger('cleanupOldLogs')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();

  // 4. Chequeo del Boss (Domingo 23:00 PM - Fin de semana)
  ScriptApp.newTrigger('checkBossWeeklyReset')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).create();

  // Ã°Å¸Å¡Â¨ 5. RESET DE JUGADORES (LUNES 00:00 AM) - Ã‚Â¡ESTO FALTABA!
  ScriptApp.newTrigger('weeklyResetPlayers')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(0).create();

  logToSheet('Todos los triggers de mantenimiento (incluido Reset Semanal) creados.');
  SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Triggers Configurados. El Reset Semanal ocurrirÃƒÂ¡ los lunes a las 00:00.');
}


function generateWeeklyReport() {
Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const matchesSheet = ss.getSheetByName("MATCHES");
Ã‚Â  Ã‚Â  const weeklySheet = ss.getSheetByName("WEEKLY");
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const matchesData = matchesSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const now = new Date();
Ã‚Â  Ã‚Â  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const playerPoints = {};

Ã‚Â  Ã‚Â  for (let i = 1; i < matchesData.length; i++) {
Ã‚Â  Ã‚Â  Ã‚Â  const matchDate = new Date(matchesData[i][1]);
Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  if (matchDate >= oneWeekAgo) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const summ = matchesData[i][2];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const pts = Number(matchesData[i][12] || 0);

Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (summ === 'PENALTY' || !isFinite(pts) || Math.abs(pts) > 10000) continue;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (!playerPoints[summ]) playerPoints[summ] = 0;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  playerPoints[summ] += pts;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  // v10.0: Incluir puntos manuales en el reporte semanal
Ã‚Â  Ã‚Â  const manualSheet = ss.getSheetByName("MANUAL_POINTS");
Ã‚Â  Ã‚Â  const pdata = manualSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â  for (let i=1; i<pdata.length; i++){
Ã‚Â  Ã‚Â  Ã‚Â  const date = new Date(pdata[i][0]);
Ã‚Â  Ã‚Â  Ã‚Â  if (date >= oneWeekAgo) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const summ = pdata[i][1];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const pts = Number(pdata[i][2] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (summ && isFinite(pts)) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (!playerPoints[summ]) playerPoints[summ] = 0;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  playerPoints[summ] += pts;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  let bestPlayer = 'N/A';
Ã‚Â  Ã‚Â  let maxPoints = -Infinity;
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  for (const player in playerPoints) {
Ã‚Â  Ã‚Â  Ã‚Â  if (playerPoints[player] > maxPoints) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  maxPoints = playerPoints[player];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  bestPlayer = player;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  if (bestPlayer !== 'N/A') {
Ã‚Â  Ã‚Â  Ã‚Â  const weekLabel = `${now.getFullYear()}-W${getWeekNumber(now)}`;
Ã‚Â  Ã‚Â  Ã‚Â  weeklySheet.appendRow([now, `Jugador de la Semana (${weekLabel})`, bestPlayer, maxPoints.toFixed(2)]);
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Reporte Semanal: ${bestPlayer} ganÃƒÂ³ ${maxPoints} puntos.`);
Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet('Reporte Semanal: No se encontraron partidas esta semana.');
Ã‚Â  Ã‚Â  }
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet('Error en generateWeeklyReport: ' + e.message);
Ã‚Â  }
}

function generateMonthlyReport() {
Ã‚Â  Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const matchesSheet = ss.getSheetByName("MATCHES");
Ã‚Â  Ã‚Â  const monthlySheet = ss.getSheetByName("MONTHLY");
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const matchesData = matchesSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const now = new Date();
Ã‚Â  Ã‚Â  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const playerPoints = {};

Ã‚Â  Ã‚Â  for (let i = 1; i < matchesData.length; i++) {
Ã‚Â  Ã‚Â  Ã‚Â  const matchDate = new Date(matchesData[i][1]);
Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  if (matchDate >= oneMonthAgo) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const summ = matchesData[i][2];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const pts = Number(matchesData[i][12] || 0);

Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (summ === 'PENALTY' || !isFinite(pts) || Math.abs(pts) > 10000) continue;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (!playerPoints[summ]) playerPoints[summ] = 0;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  playerPoints[summ] += pts;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  // v10.0: Incluir puntos manuales en el reporte mensual
Ã‚Â  Ã‚Â  const manualSheet = ss.getSheetByName("MANUAL_POINTS");
Ã‚Â  Ã‚Â  const pdata = manualSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â  for (let i=1; i<pdata.length; i++){
Ã‚Â  Ã‚Â  Ã‚Â  const date = new Date(pdata[i][0]);
Ã‚Â  Ã‚Â  Ã‚Â  if (date >= oneMonthAgo) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const summ = pdata[i][1];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const pts = Number(pdata[i][2] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (summ && isFinite(pts)) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (!playerPoints[summ]) playerPoints[summ] = 0;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  playerPoints[summ] += pts;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  let bestPlayer = 'N/A';
Ã‚Â  Ã‚Â  let maxPoints = -Infinity;
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  for (const player in playerPoints) {
Ã‚Â  Ã‚Â  Ã‚Â  if (playerPoints[player] > maxPoints) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  maxPoints = playerPoints[player];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  bestPlayer = player;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  if (bestPlayer !== 'N/A') {
Ã‚Â  Ã‚Â  Ã‚Â  const monthLabel = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
Ã‚Â  Ã‚Â  Ã‚Â  monthlySheet.appendRow([now, `Jugador del Mes (${monthLabel})`, bestPlayer, maxPoints.toFixed(2)]);
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet(`Reporte Mensual: ${bestPlayer} ganÃƒÂ³ ${maxPoints} puntos.`);
Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  logToSheet('Reporte Mensual: No se encontraron partidas este mes.');
Ã‚Â  Ã‚Â  }
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet('Error en generateMonthlyReport: ' + e.message);
Ã‚Â  }
}

function cleanupOldLogs() {
Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const logSheet = ss.getSheetByName("LOGS");
Ã‚Â  Ã‚Â  const data = logSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  for (let i = data.length - 1; i >= 1; i--) {
Ã‚Â  Ã‚Â  Ã‚Â  const timestamp = new Date(data[i][0]);
Ã‚Â  Ã‚Â  Ã‚Â  if (timestamp < twoWeeksAgo) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  logSheet.deleteRow(i + 1);
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  logToSheet('Limpieza de logs antiguos completada.');
Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  logToSheet('Error en cleanupOldLogs: ' + e.message);
Ã‚Â  }
}

/* ----------------- MULTI-PLAYER ANALYTICS V2 ----------------- */

// Obtiene datos resumidos para comparar mÃƒÂºltiples jugadores rÃƒÂ¡pidamente
function getComparisonData(playerNames) {
Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  const matchesData = ss.getSheetByName("MATCHES").getDataRange().getValues();
Ã‚Â  const scoresData = ss.getSheetByName("SCORES").getDataRange().getValues();

Ã‚Â  // 1. Mapa rÃƒÂ¡pido de Tiers actuales
Ã‚Â  const playerTiers = {};
Ã‚Â  for (let i = 1; i < scoresData.length; i++) {
Ã‚Â  Ã‚Â  playerTiers[scoresData[i][0]] = { points: scoresData[i][1], tier: scoresData[i][2] };
Ã‚Â  }

Ã‚Â  const comparison = {};

Ã‚Â  // Inicializar objetos para cada jugador solicitado
Ã‚Â  playerNames.forEach(name => {
Ã‚Â  Ã‚Â  comparison[name] = {
Ã‚Â  Ã‚Â  Ã‚Â  name: name,
Ã‚Â  Ã‚Â  Ã‚Â  currentPoints: playerTiers[name]?.points || 0,
Ã‚Â  Ã‚Â  Ã‚Â  tier: playerTiers[name]?.tier || "N/A",
Ã‚Â  Ã‚Â  Ã‚Â  wins: 0, losses: 0,
Ã‚Â  Ã‚Â  Ã‚Â  kills: 0, deaths: 0, assists: 0,
Ã‚Â  Ã‚Â  Ã‚Â  totalCs: 0, totalVision: 0, totalDurationMinutes: 0,
Ã‚Â  Ã‚Â  Ã‚Â  pointsHistory: [] // {x: date, y: cumulativePoints}
Ã‚Â  Ã‚Â  };
Ã‚Â  });

Ã‚Â  // 2. Procesar TODAS las partidas una sola vez
Ã‚Â  // Ordenamos por fecha antigua -> nueva para el historial de puntos
Ã‚Â  const sortedMatches = matchesData.slice(1).sort((a, b) => new Date(a[1]) - new Date(b[1]));

Ã‚Â  const runningPoints = {}; // Puntos acumulados temporales
Ã‚Â  playerNames.forEach(n => runningPoints[n] = 0);

Ã‚Â  sortedMatches.forEach(row => {
Ã‚Â  Ã‚Â  const summ = row[2];
Ã‚Â  Ã‚Â  if (comparison[summ]) { // Si es uno de los jugadores a comparar
Ã‚Â  Ã‚Â  Ã‚Â  const stats = comparison[summ];
Ã‚Â  Ã‚Â  Ã‚Â  const result = row[5];
Ã‚Â  Ã‚Â  Ã‚Â  const dur = Number(row[11] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  const pts = Number(row[12] || 0);

Ã‚Â  Ã‚Â  Ã‚Â  // Acumuladores bÃƒÂ¡sicos
Ã‚Â  Ã‚Â  Ã‚Â  if (result === 'Win') stats.wins++; else stats.losses++;
Ã‚Â  Ã‚Â  Ã‚Â  stats.kills += Number(row[6] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  stats.deaths += Number(row[7] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  stats.assists += Number(row[8] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  // EstimaciÃƒÂ³n de CS y Vision si no los guardamos explÃƒÂ­citamente en MATCHES,
Ã‚Â  Ã‚Â  Ã‚Â  // Si quieres precisiÃƒÂ³n 100% en radar, deberÃƒÂ­amos guardar CS y VisiÃƒÂ³n en MATCHES en el futuro.
Ã‚Â  Ã‚Â  Ã‚Â  // Por ahora usaremos KDA y Winrate que sÃƒÂ­ tenemos seguro.

Ã‚Â  Ã‚Â  Ã‚Â  // Historial de puntos
Ã‚Â  Ã‚Â  Ã‚Â  runningPoints[summ] += pts;
Ã‚Â  Ã‚Â  Ã‚Â  stats.pointsHistory.push({
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  x: new Date(row[1]).toISOString(),
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  y: Number(runningPoints[summ].toFixed(2))
Ã‚Â  Ã‚Â  Ã‚Â  });
Ã‚Â  Ã‚Â  }
Ã‚Â  });

Ã‚Â  // 3. Calcular medias finales
Ã‚Â  Object.values(comparison).forEach(stats => {
Ã‚Â  Ã‚Â  const games = stats.wins + stats.losses;
Ã‚Â  Ã‚Â  stats.gamesPlayed = games;
Ã‚Â  Ã‚Â  stats.winRate = games > 0 ? ((stats.wins / games) * 100).toFixed(1) : 0;
Ã‚Â  Ã‚Â  stats.kdaRatio = stats.deaths > 0 ? ((stats.kills + stats.assists) / stats.deaths).toFixed(2) : (stats.kills + stats.assists);
Ã‚Â  Ã‚Â  stats.avgPoints = games > 0 ? (stats.currentPoints / games).toFixed(2) : 0; // Aproximado
Ã‚Â  });

Ã‚Â  return comparison;
}



/* =========================================
   INSPECTOR DE PARTIDAS (AUDITORÃƒÂA)
   ========================================= */

function showMatchInspector() {
  const html = HtmlService.createTemplateFromFile('Match_Inspector')
      .evaluate()
      .setWidth(1000)
      .setHeight(800)
      .setTitle('Ã°Å¸â€Å½ Inspector de Partidas');
  SpreadsheetApp.getUi().showModalDialog(html, 'Inspector de Partidas');
}

/* --- BUSCAR LISTA DE JUGADORES (CorrecciÃƒÂ³n de error de rango vacÃƒÂ­o) --- */
function getInspectorPlayerList() {
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName("PLAYERS");
  if (!playersSheet) return ["Error: Hoja PLAYERS no existe"];
  
  const lastRow = playersSheet.getLastRow();
  if (lastRow < 2) return []; // Si no hay datos, devolver array vacÃƒÂ­o

  // Leer columna A (Nombres)
  const rawList = playersSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  
  // Filtrar vacÃƒÂ­os y eliminar duplicados
  const cleanList = [...new Set(rawList.filter(name => name && name !== ""))].sort();
  
  return cleanList;
}

/* --- OBTENER HISTORIAL DETALLADO (Mejora en el desglose de puntos) --- */
function getInspectorHistory(summonerName) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName("MATCHES");
  if (!matchesSheet) return [];

  const data = matchesSheet.getDataRange().getValues();
  const history = [];

  // Recorrer de abajo a arriba (mÃƒÂ¡s reciente primero)
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    // Columna C (ÃƒÂ­ndice 2) es Summoner
    if (row[2] === summonerName) {
      
      const notesString = String(row[13] || ''); // Columna N (Notas)
      
      // --- PARSEO INTELIGENTE DE PUNTOS ---
      const breakdown = notesString.split(';').map(note => {
          let cleanNote = note.trim();
          if (!cleanNote) return null;

          let val = 0;
          let desc = cleanNote;

          // 1. Buscar nÃƒÂºmero explÃƒÂ­cito con signo (ej: +2.43, -0.5)
          // Regex busca: signo opcional, nÃƒÂºmero, decimal opcional, al final o antes de cierre de parÃƒÂ©ntesis
          const matchVal = cleanNote.match(/([+\-]\d+(\.\d+)?)/);
          
          if (matchVal) {
             val = parseFloat(matchVal[0]);
             // Limpiamos la descripciÃƒÂ³n quitando el nÃƒÂºmero y parÃƒÂ©ntesis vacÃƒÂ­os
             desc = cleanNote.replace(matchVal[0], '').replace('pts', '').replace('()', '').replace('  ', ' ').trim();
             // Quitar parÃƒÂ©ntesis finales si quedaron colgados ej: "DPM Carry ("
             if (desc.endsWith('(')) desc = desc.slice(0, -1).trim();
             if (desc.endsWith(',')) desc = desc.slice(0, -1).trim();
          } 
          // 2. Si no hay nÃƒÂºmero, asignar valor por defecto segÃƒÂºn palabras clave (Fallback)
          else {
             if (cleanNote.includes("KDA Alto") || cleanNote.includes("Victoria")) val = 3.0;
             else if (cleanNote.includes("KDA Bueno")) val = 1.5;
             else if (cleanNote.includes("KDA Bajo") || cleanNote.includes("Derrota")) val = -2.5;
             else if (cleanNote.includes("Penta")) val = 10.0;
          }

          return { desc: desc, val: val };
      }).filter(n => n !== null);

      history.push({
        matchId: row[0],
        date: new Date(row[1]).toLocaleDateString() + ' ' + new Date(row[1]).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        champion: row[3],
        lane: row[4],
        result: row[5], 
        duration: Math.round(Number(row[11] || 0)),
        kda: `${row[6]}/${row[7]}/${row[8]}`,
        points: Number(row[12]).toFixed(2),
        // Columnas O, P, Q (Farm, VisiÃƒÂ³n, Oro) - AsegÃƒÂºrate que existen en tu Excel
        cs: row[14] || '-',
        vision: row[15] || '-',
        gold: row[16] || '-',
        
        breakdown: breakdown 
      });
    }
  }
  return history;
}

/**
 * Convierte el string de notas (ej: "Victoria:15;KDA:5.5") en un array de objetos.
 * Esta es la funciÃƒÂ³n que te faltaba.
 */
function processNotesForBreakdown(notesString) {
  if (!notesString) return [];
  
  return notesString.split(';').map(note => {
    const parts = note.trim().split(':');
    
    // Aseguramos que haya descripciÃƒÂ³n y valor
    if (parts.length === 2) {
      let desc = parts[0].trim();
      let val = parseFloat(parts[1].trim());

      // Opcional: Limpieza o redondeo
      if (!isNaN(val)) {
        val = parseFloat(val.toFixed(2));
      } else {
        // Fallback si el valor no es un nÃƒÂºmero (ej: solo texto)
        val = 0; 
      }
      
      return {
        desc: desc,
        val: val
      };
    }
    return null; // Ignorar formatos no vÃƒÂ¡lidos
  }).filter(n => n !== null);
}


/* ----------------- WEB APP ENTRY POINT ----------------- */

function doGet(e) {
  const params = e.parameter;
  
  // Si llega ?player=NombreJugador, servir vista pÃƒÂºblica
  if (params && params.player) {
    const playerName = decodeURIComponent(params.player);
    const template = HtmlService.createTemplateFromFile('PlayerProfile');
    template.playerName = playerName;
    return template.evaluate()
      .setTitle('Perfil Ã‚Â· ' + playerName + ' Ã‚Â· Wargods Premier')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Si llega ?team=NombreEquipo, servir vista pÃƒÂºblica de equipo
  if (params && params.team) {
    const teamName = decodeURIComponent(params.team);
    const template = HtmlService.createTemplateFromFile('TeamProfile');
    template.teamName = teamName;
    return template.evaluate()
      .setTitle(teamName + ' Ã‚Â· Wargods Premier')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Sin parÃƒÂ¡metros: tu app normal (LeagueMenu.html)
  return HtmlService.createTemplateFromFile('LeagueMenu')
      .evaluate() // ESTA ES LA PALABRA MÃƒÂGICA
      .setTitle('Wargods Premier')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/*
function doGet(e) {

  // --- VERIFICACIÃƒâ€œN DE RIOT GAMES ---
  if (e.queryString && e.queryString.indexOf('riot.txt') !== -1) {
    return ContentService.createTextOutput("15623f0e-d2a6-4925-b2bb-6a55c3b35aaa");
  }
  // ----------------------------------
  
  // 1. Capturar parÃƒÂ¡metros de la URL
  var route = e.parameter.p || 'home';
  var season = e.parameter.season || 'CURRENT'; // <--- NUEVO: Captura la season (S1, ALL, CURRENT)

  var templateName = 'index'; // Por defecto carga el inicio

  // --- ENRUTAMIENTO ---
  if (route === 'ranking') {
    templateName = 'EpicRanking';
  }  else if (route === 'tournaments') { 
    templateName = 'LeagueMenu';
  } else if (route === 'graphics_menu') {
    templateName = 'GraphicsMenu'; 
  } else if (route === 'match_details') { 
    templateName = 'MatchDetails'; 
  } else if (route === 'history_global') { 
    templateName = 'GlobalHistory'; 
  } else if (route === 'dashboard') { 
    templateName = 'dashboard'; 
  } else if (route === 'analytics') {
    templateName = 'analytics'; 
  } else if (route === 'synergy') {
    templateName = 'SynergyDashboard'; 
  } else if (route === 'behavior') {
    templateName = 'BehaviorDashboard'; 
  } else if (route === 'inspector') {
    templateName = 'Match_Inspector'; 
  } else if (route === 'global') {
    templateName = 'GlobalDashboard'; 
  } else if (route === 'general') {
    templateName = 'Grafico_General'; 
  } else if (route === 'votar') { 
    templateName = 'VotingBooth'; 
  } else if (route === 'forja') {  
    templateName = 'ForgeDashboard'; 
  }

  // 2. Crear la plantilla
  var template = HtmlService.createTemplateFromFile(templateName);

  // 3. PASAR DATOS A LA PLANTILLA (Ã‚Â¡IMPORTANTE!)
  // Esto permite que el HTML sepa en quÃƒÂ© pÃƒÂ¡gina y season estÃƒÂ¡
  template.page = route;
  template.seasonFilter = season; 

  // 4. Renderizar
  return template.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('SoloQ Challenge');
}*/

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/* --- FUNCIONES QUE LA WEB LLAMARÃƒÂ (DATA) --- */

// A. Datos del Ranking para la Web
function getRankingDataForWeb(seasonFilter) { 
  return getEpicRankingData(seasonFilter);    
}

// B. Datos del Historial (ÃƒÅ¡ltimas 50 partidas)
function getHistoryDataForWeb() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MATCHES');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  // Cogemos las ÃƒÂºltimas 50 para que cargue rÃƒÂ¡pido
  const startRow = Math.max(2, lastRow - 50);
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();
  
  // Invertimos (mÃƒÂ¡s nuevas arriba) y formateamos
  return data.reverse().map(r => ({
    date: r[1], 
    player: r[2], 
    champ: r[3], 
    result: r[5], 
    kda: `${r[6]}/${r[7]}/${r[8]}`, 
    points: Number(r[12]).toFixed(2), 
    notes: r[13]
  }));
}

// ==========================================
// Ã°Å¸â€œÅ  C. DATOS PARA GRÃƒÂFICOS (CON FILTRO DE SEASON)
// ==========================================
function getStatsDataForWeb(seasonFilter) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const configSheet = ss.getSheetByName('CONFIG');
  
  // 1. ConfiguraciÃƒÂ³n de Filtros
  // Si no llega filtro, asumimos CURRENT (Actual)
  let target = seasonFilter || 'CURRENT'; 
  let currentSeason = 'S1';
  
  if (configSheet) {
      currentSeason = configSheet.getRange('B2').getValue();
  }

  // 2. Obtener Datos
  const data = matchesSheet.getDataRange().getValues();
  if (data.length <= 1) return null; // No hay datos

  // Asumimos que la columna Season es la ÃƒÅ¡LTIMA (Ajustar si no lo es)
  const seasonColIdx = data[0].length - 1; 
  
  let filteredRows = [];

  // 3. Filtrar Filas
  for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowSeason = row[seasonColIdx]; // Leemos la season de la fila

      if (target === 'ALL') {
          // Si es "HistÃƒÂ³rico Global", entran TODAS las partidas
          filteredRows.push(row);
      } 
      else if (target === 'CURRENT') {
          // Si es "Actual", solo las que coincidan con la configuraciÃƒÂ³n (ej: S2)
          if (rowSeason === currentSeason) filteredRows.push(row);
      } 
      else {
          // Si es especÃƒÂ­fica (ej: "S1"), solo esas
          if (rowSeason === target) filteredRows.push(row);
      }
  }

  // 4. Calcular EstadÃƒÂ­sticas sobre los datos filtrados
  return calculateStatsFromRows(filteredRows);
}

// --- FUNCIÃƒâ€œN AUXILIAR DE CÃƒÂLCULO ---
// Esta funciÃƒÂ³n toma una lista de partidas y saca los nÃƒÂºmeros para las grÃƒÂ¡ficas
function calculateStatsFromRows(rows) {
    let stats = {
        totalGames: 0,
        blueWins: 0,
        redWins: 0,
        totalKills: 0,
        avgDuration: 0,
        roles: { TOP:0, JUNGLE:0, MID:0, ADC:0, SUPPORT:0 }
    };

    if (!rows || rows.length === 0) return stats;

    let totalDuration = 0;

    rows.forEach(row => {
        stats.totalGames++;
        
        // ÃƒÂndices basados en tu estructura tÃƒÂ­pica:
        // Ajusta estos nÃƒÂºmeros si tus columnas son diferentes
        // [0]ID, [1]Date, [2]Player, [3]Champ, [4]Role, [5]Result, [6]KDA... [11]Duration
        
        const role = String(row[4]).toUpperCase(); // Columna E (Rol)
        const result = row[5]; // Columna F (Win/Loss)
        // Nota: En SoloQ individual no suele haber "Blue/Red side" guardado explÃƒÂ­citamente 
        // a menos que lo tengas. AquÃƒÂ­ contaremos Victorias/Derrotas globales.
        if (result === 'Win') stats.blueWins++; // Usamos blueWins como contador de Victorias totales
        else stats.redWins++; // Usamos redWins como contador de Derrotas totales

        // Sumar Roles
        if (stats.roles[role] !== undefined) stats.roles[role]++;
        
        // DuraciÃƒÂ³n (Columna L / ÃƒÂ­ndice 11 aprox)
        if (row[11]) totalDuration += Number(row[11]);
    });

    stats.avgDuration = (totalDuration / stats.totalGames).toFixed(1);
    
    return stats;
}



// Helper necesario
function outputJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- FUNCIONES DE DATOS PARA LA WEB (AÃƒÂ±ÃƒÂ¡delas si no las tienes) ---
function getMatchesForWeb() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MATCHES');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const startRow = Math.max(2, lastRow - 50); 
  const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();
  
  return data.reverse().map(r => ({
    id: r[0], date: r[1], player: r[2], champ: r[3], lane: r[4], 
    result: r[5], k: r[6], d: r[7], a: r[8], 
    points: Number(r[12]).toFixed(2), notes: r[13]
  }));
}

function getGlobalStatsForWeb() {
  return getGlobalChallengeStats(); 
}

function showDashboard() {
Ã‚Â  const html = HtmlService.createHtmlOutputFromFile('dashboard')
Ã‚Â  Ã‚Â  Ã‚Â  .setWidth(1200)
Ã‚Â  Ã‚Â  Ã‚Â  .setHeight(800);
Ã‚Â  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard Historial de Partidas');
}

function showDashboardPro() {
  const html = HtmlService
    .createHtmlOutputFromFile('DashboardPro_KPI')
    .setTitle('Dashboard Profesional')
    .setWidth(1400)
    .setHeight(850);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Ã°Å¸â€œË† Dashboard Profesional');
}

function showInspectorNuevo() {
  const html = HtmlService
    .createHtmlOutputFromFile('InspectorNuevo')
    .setTitle('Inspector de Partidas Avanzado')
    .setWidth(1300)
    .setHeight(820);

  SpreadsheetApp.getUi().showModalDialog(html, 'Ã°Å¸â€¢ÂµÃ¯Â¸Â Inspector de Partidas');
}

function showRadarStats() {
  const html = HtmlService
    .createHtmlOutputFromFile('RadarStats')
    .setTitle('Radar de Jugador')
    .setWidth(1100)
    .setHeight(800);

  SpreadsheetApp.getUi().showModalDialog(html, 'Ã°Å¸Â§Â­ Radar de Jugador');
}

function showSynergyGraph() {
  const html = HtmlService
    .createHtmlOutputFromFile('SynergyGraph')
    .setTitle('Grafo de Sinergias')
    .setWidth(1400)
    .setHeight(900);

  SpreadsheetApp.getUi().showModalDialog(html, 'Ã°Å¸Â§Â¬ Grafo de Sinergias 2.0');
}

function showHeatmapHoras() {
  const html = HtmlService
    .createHtmlOutputFromFile('HeatmapHoras')
    .setTitle('Heatmap Horario de Rendimiento')
    .setWidth(1300)
    .setHeight(900);

  SpreadsheetApp.getUi().showModalDialog(html, 'Ã°Å¸â€œâ€¦ Heatmap Horario');
}


function getPlayerList() {
  try {
    const ss = SpreadsheetApp.getActive();
    // Cambiamos a la hoja PLAYERS para asegurar que salgan todos (incluso los que no han puntuado aÃƒÂºn)
    const sheet = ss.getSheetByName("PLAYERS"); 
    if (!sheet) return ['Error: Hoja PLAYERS no encontrada'];
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return []; 

    // Leemos solo la columna A (Nombres)
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    
    // 1. Aplanamos el array (de [[Nombre], [Nombre]] a [Nombre, Nombre])
    // 2. Filtramos vacÃƒÂ­os
    // 3. Ordenamos alfabÃƒÂ©ticamente (.sort())
    const players = data
      .flat()
      .filter(name => name && name !== "")
      .sort((a, b) => a.localeCompare(b)); // Orden alfabÃƒÂ©tico A-Z seguro

    return players;
  } catch (e) {
    return [`Error: ${e.message}`];
  }
}

function getPlayerData(summonerName) {
Ã‚Â  try {
Ã‚Â  Ã‚Â  const ss = SpreadsheetApp.getActive();
Ã‚Â  Ã‚Â  const scoresSheet = ss.getSheetByName("SCORES");
Ã‚Â  Ã‚Â  const matchesSheet = ss.getSheetByName("MATCHES");

Ã‚Â  Ã‚Â  // 1. Obtener Resumen (Summary)
Ã‚Â  Ã‚Â  let summary = {Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  name: summonerName,Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  points: 0,Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  tier: 'N/A',
Ã‚Â  Ã‚Â  Ã‚Â  totalWins: 0,
Ã‚Â  Ã‚Â  Ã‚Â  totalLosses: 0,
Ã‚Â  Ã‚Â  Ã‚Â  uniqueChamps: 0
Ã‚Â  Ã‚Â  };
Ã‚Â  Ã‚Â  const scoresData = scoresSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â  for (let i = 1; i < scoresData.length; i++) {
Ã‚Â  Ã‚Â  Ã‚Â  if (scoresData[i][0] === summonerName) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  summary.points = scoresData[i][1];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  summary.tier = scoresData[i][2];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  break;
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }

Ã‚Â  Ã‚Â  // 2. Obtener Partidas y EstadÃƒÂ­sticas
Ã‚Â  Ã‚Â  let playerMatches = [];
Ã‚Â  Ã‚Â  const champMap = new Map();
Ã‚Â  Ã‚Â  const champSet = new Set();
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  const matchesData = matchesSheet.getDataRange().getValues();
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  for (let i = matchesData.length - 1; i >= 1; i--) { // De mÃƒÂ¡s nueva a mÃƒÂ¡s vieja
Ã‚Â  Ã‚Â  Ã‚Â  if (matchesData[i][2] === summonerName) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const champ = matchesData[i][3];
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const result = matchesData[i][5];

Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  // 2a. Llenar historial de partidas
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  playerMatches.push({
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  date: new Date(matchesData[i][1]).toLocaleString('es-ES'),
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  champion: champ,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  result: result,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  kda: `${matchesData[i][6]}/${matchesData[i][7]}/${matchesData[i][8]}`,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  points: matchesData[i][12],
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  notes: matchesData[i][13] // Ã‚Â¡NUEVO!
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  });
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  // 2b. Calcular stats de campeones (se hace en el mismo bucle)
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (!champMap.has(champ)) {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  champMap.set(champ, { played: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0 });
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  champSet.add(champ); // Para el recuento ÃƒÂºnico
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  const stats = champMap.get(champ);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.played++;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  if (result === 'Win') {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.wins++;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  summary.totalWins++;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  } else {
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.losses++;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  summary.totalLosses++;
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.kills += Number(matchesData[i][6] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.deaths += Number(matchesData[i][7] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  stats.assists += Number(matchesData[i][8] || 0);
Ã‚Â  Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â  }
Ã‚Â  Ã‚Â Ã‚Â 
Ã‚Â  Ã‚Â  summary.uniqueChamps = champSet.size;

Ã‚Â  Ã‚Â  // 3. Formatear EstadÃƒÂ­sticas de Campeones
Ã‚Â  Ã‚Â  let championStats = [];
Ã‚Â  Ã‚Â  champMap.forEach((stats, champion) => {
Ã‚Â  Ã‚Â  Ã‚Â  const avgK = (stats.kills / stats.played).toFixed(1);
Ã‚Â  Ã‚Â  Ã‚Â  const avgD = (stats.deaths / stats.played).toFixed(1);
Ã‚Â  Ã‚Â  Ã‚Â  const avgA = (stats.assists / stats.played).toFixed(1);
Ã‚Â  Ã‚Â  Ã‚Â  const winRate = ((stats.wins / stats.played) * 100).toFixed(0);

Ã‚Â  Ã‚Â  Ã‚Â  championStats.push({
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  champion: champion,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  played: stats.played,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  winRate: `${winRate}%`,
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  winLoss: `${stats.wins}V / ${stats.losses}D`, // Ã‚Â¡NUEVO!
Ã‚Â  Ã‚Â  Ã‚Â  Ã‚Â  avgKda: `${avgK} / ${avgD} / ${avgA}`
Ã‚Â  Ã‚Â  Ã‚Â  });
Ã‚Â  Ã‚Â  });

Ã‚Â  Ã‚Â  championStats.sort((a, b) => b.played - a.played);

Ã‚Â  Ã‚Â  return {
Ã‚Â  Ã‚Â  Ã‚Â  summary: summary,
Ã‚Â  Ã‚Â  Ã‚Â  matches: playerMatches,Ã‚Â 
Ã‚Â  Ã‚Â  Ã‚Â  championStats: championStats
Ã‚Â  Ã‚Â  };

Ã‚Â  } catch (e) {
Ã‚Â  Ã‚Â  return { error: e.message };
Ã‚Â  }
}


/************************************************************
Ã‚Â * --- DASHBOARD DE GRÃƒÂFICOS ---
Ã‚Â * (v8.0: Funciones actualizadas para mÃƒÂ¡s estadÃƒÂ­sticas)
Ã‚Â ************************************************************/
/* =========================================
   NUEVO DASHBOARD V12 (MODERNO)
   ========================================= */

// 1. FunciÃƒÂ³n para abrir el dashboard
function showDashboardV12() {
  const html = HtmlService.createTemplateFromFile('Grafico_General')
      .evaluate()
      .setWidth(1250)
      .setHeight(900)
      .setTitle('SoloQ Pro Analytics v12');
  SpreadsheetApp.getUi().showModalDialog(html, 'SoloQ Pro Dashboard');
}

// 2. FunciÃƒÂ³n que lee los datos REALES de la hoja MATCHES
function getDataForDashboardV12() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  if (!matchesSheet) throw new Error('Hoja MATCHES no encontrada');

  const data = matchesSheet.getDataRange().getValues();
  // Headers esperados: MatchID(0), Date(1), Summoner(2), Champion(3), Lane(4), Result(5), ..., Points(12)

  const roleStats = {
    'TOP': { games: 0, wins: 0, totalPoints: 0, pointsHistory: [] },
    'JUNGLE': { games: 0, wins: 0, totalPoints: 0, pointsHistory: [] },
    'MIDDLE': { games: 0, wins: 0, totalPoints: 0, pointsHistory: [] },
    'BOTTOM': { games: 0, wins: 0, totalPoints: 0, pointsHistory: [] },
    'UTILITY': { games: 0, wins: 0, totalPoints: 0, pointsHistory: [] }
  };

  let totalGames = 0;

  // Empezamos en i=1 para saltar el encabezado
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let lane = (row[4] || '').toString().toUpperCase();
    const result = row[5];
    const points = Number(row[12]);

    // Normalizar nombres de linea si es necesario
    if (lane === 'SUPPORT') lane = 'UTILITY';
    if (lane === 'MID') lane = 'MIDDLE';
    if (lane === 'BOT') lane = 'BOTTOM';

    if (roleStats[lane] && !isNaN(points)) {
      roleStats[lane].games++;
      if (result === 'Win') roleStats[lane].wins++;
      roleStats[lane].totalPoints += points;
      roleStats[lane].pointsHistory.push(points);
      totalGames++;
    }
  }

  // Preparar datos finales para los grÃƒÂ¡ficos
  const processedData = {
    roles: [],
    playRate: [],
    gamesPlayed: [], // 
    winRate: [],
    avgPoints: [],
    boxPlotData: {}
  };

  // Orden definidio para consistencia visual
  
  const roleOrder = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  roleOrder.forEach(role => {
    const stats = roleStats[role];
    processedData.roles.push(role);
    // Play Rate %
    processedData.playRate.push(totalGames > 0 ? ((stats.games / totalGames) * 100).toFixed(1) : 0);
    // Games Played (Raw Count)
    processedData.gamesPlayed.push(stats.games);
    // Win Rate % (0-1 para que luego lo multipliquemos por 100 en JS)
    processedData.winRate.push(stats.games > 0 ? (stats.wins / stats.games).toFixed(2) : 0);
    // Avg Points
    processedData.avgPoints.push(stats.games > 0 ? (stats.totalPoints / stats.games).toFixed(2) : 0);
    // Data for Box Plot
    processedData.boxPlotData[role] = stats.pointsHistory;
  });

  return processedData;
}
/* ----------------- RECALCULAR RACHAS (DESDE CERO) ----------------- */
function recalculateAllStreaks() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName("MATCHES");
  const playersSheet = ss.getSheetByName("PLAYERS");
  const cfg = readConfigMap();

  // Usamos la fecha de inicio de temporada de CONFIG.
  // Si hoy empezÃƒÂ³ la season, asegÃƒÂºrate de que en CONFIG 'season_start_date' sea la fecha de hoy (ej. 2025-11-10)
  const seasonStart = cfg.seasonStartDateObj || new Date(0);

  if (!matchesSheet || !playersSheet) {
      logToSheet("ERROR: Faltan hojas para recalcular rachas.");
      return;
  }

  // 1. Leer todas las partidas y ordenarlas por fecha (mÃƒÂ¡s antigua a mÃƒÂ¡s nueva)
  const mData = matchesSheet.getDataRange().getValues();
  // Headers de mData: MatchID(0), Date(1), Summoner(2), ..., Result(5)
  const sortedMatches = mData.slice(1).sort((a,b) => new Date(a[1]) - new Date(b[1]));

  const streakMap = {};

  // 2. Calcular racha recorriendo cronolÃƒÂ³gicamente
  sortedMatches.forEach(row => {
      const matchDate = new Date(row[1]);
      // SOLO contamos partidas desde la fecha de inicio de temporada
      if (matchDate < seasonStart) return;

      const summ = row[2];
      const result = row[5]; // "Win" o "Loss"

      if (!streakMap[summ]) streakMap[summ] = 0;

      if (result === 'Win') {
          // Si ya estaba en racha positiva, suma 1. Si venÃƒÂ­a de derrota, empieza en 1.
          streakMap[summ] = (streakMap[summ] >= 0) ? streakMap[summ] + 1 : 1;
      } else if (result === 'Loss') {
          // Si ya estaba en racha negativa, resta 1. Si venÃƒÂ­a de victoria, empieza en -1.
          streakMap[summ] = (streakMap[summ] <= 0) ? streakMap[summ] - 1 : -1;
      }
      // Remakes u otros resultados no afectan la racha
  });

  // 3. Actualizar la hoja PLAYERS con los valores reales
  const pData = playersSheet.getDataRange().getValues();
  // Asumimos que la columna F (ÃƒÂ­ndice 6 en hoja, 5 en array) es 'CurrentStreak'
  for (let i = 1; i < pData.length; i++) {
      const summ = pData[i][0];
      // Si tiene racha calculada la ponemos, si no (no ha jugado esta season), ponemos 0
      const realStreak = streakMap[summ] || 0;
      playersSheet.getRange(i + 1, 6).setValue(realStreak);
  }

  logToSheet("Ã¢Å“â€¦ Rachas recalculadas correctamente desde el inicio de la temporada.");
  SpreadsheetApp.getUi().alert("Rachas recalculadas basÃƒÂ¡ndose en las partidas de esta temporada.");
}

function getBestPlayersByRoleV12() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  if (!matchesSheet) return {};

  const data = matchesSheet.getDataRange().getValues();
  const rolePlayers = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const summ = row[2];
    let lane = (row[4] || 'UNKNOWN').toString().toUpperCase();
    const points = Number(row[12]);
    const notes = (row[13] || '').toString();

    if (lane === 'SUPPORT') lane = 'UTILITY';
    if (lane === 'MID') lane = 'MIDDLE';
    if (lane === 'BOT') lane = 'BOTTOM';

    if (!['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].includes(lane)) continue;

    if (!rolePlayers[lane]) rolePlayers[lane] = {};
    if (!rolePlayers[lane][summ]) {
      rolePlayers[lane][summ] = {
        totalPoints: 0,
        games: 0,
        notesCount: {}
      };
    }

    rolePlayers[lane][summ].totalPoints += points;
    rolePlayers[lane][summ].games++;

    notes.split(';').map(n => n.trim()).filter(n => n).forEach(note => {
      let baseNote = note.split('(')[0].trim();
      if (!rolePlayers[lane][summ].notesCount[baseNote]) {
        rolePlayers[lane][summ].notesCount[baseNote] = 0;
      }
      rolePlayers[lane][summ].notesCount[baseNote]++;
    });
  }

  const bestByRole = {};
  ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'].forEach(role => {
    let bestPlayer = null;
    let maxScore = -Infinity; // Usamos Score ponderado, no media simple

    if (rolePlayers[role]) {
      for (const summ in rolePlayers[role]) {
        const stats = rolePlayers[role][summ];
        
        // --- Ã¢Å¡â€“Ã¯Â¸Â NUEVA FÃƒâ€œRMULA DE VETERANÃƒÂA ---
        // 1. MÃƒÂ­nimo 5 partidas para optar al tÃƒÂ­tulo.
        if (stats.games >= 5) {
             const avg = stats.totalPoints / stats.games;
             
             // FACTOR DE CONFIANZA:
             // - Si tienes < 10 partidas: Se reduce tu media (Castigo por muestra pequeÃƒÂ±a)
             // - Si tienes > 10 partidas: Se bonifica tu media un 1.5% por cada partida extra.
             // Ejemplo: 30 partidas = Media * 1.30 (+30% bonus por constancia)
             let confidenceMult = 1.0 + ((stats.games - 10) * 0.015);
             
             // Topes de seguridad
             if (confidenceMult < 0.8) confidenceMult = 0.8; // MÃƒÂ­nimo 80% del valor real
             if (confidenceMult > 1.5) confidenceMult = 1.5; // MÃƒÂ¡ximo 150% del valor real

             const weightedScore = avg * confidenceMult;

             if (weightedScore > maxScore) {
               maxScore = weightedScore;
               bestPlayer = summ;
             }
        }
      }
    }

    if (bestPlayer) {
      const notes = rolePlayers[role][bestPlayer].notesCount;
      let topNote = 'Consistente';
      let maxCount = 0;
      for (const note in notes) {
        if (notes[note] > maxCount && !['Win', 'Loss'].includes(note)) {
           maxCount = notes[note];
           topNote = note;
        }
      }
      // CÃƒÂ¡lculo de media real para mostrar (sin el truco matemÃƒÂ¡tico)
      const realAvg = (rolePlayers[role][bestPlayer].totalPoints / rolePlayers[role][bestPlayer].games).toFixed(1);

      bestByRole[role] = {
        summoner: bestPlayer,
        avgPoints: realAvg,
        superpower: topNote,
        games: rolePlayers[role][bestPlayer].games
      };
    } else {
      bestByRole[role] = null;
    }
  });

  return bestByRole;
}

function showAnalyticsDashboard() {
  const html = HtmlService.createHtmlOutputFromFile('analytics')
      .setWidth(1200)
      .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard de AnalÃƒÂ­ticas');
}




function showGlobalDashboard() {
  const html = HtmlService.createTemplateFromFile('GlobalDashboard')
    .evaluate()
    .setWidth(1200)
    .setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard de EstadÃƒÂ­sticas Globales');
}

/**
 * RECOGE Y PROCESA TODAS LAS ESTADÃƒÂSTICAS GLOBALES DEL CHALLENGE
 * Esta es la funciÃƒÂ³n principal que alimenta el nuevo dashboard.
 * Lee las hojas MATCHES y PLAYERS.
 *
 * @returns {Object} Un objeto gigante con todas las estadÃƒÂ­sticas.
 */
function getGlobalChallengeStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const playersSheet = ss.getSheetByName('PLAYERS');

  const lastMatchRow = matchesSheet.getLastRow();
  const lastPlayerRow = playersSheet.getLastRow();

  if (lastMatchRow < 2 || lastPlayerRow < 2) {
    return { globalStats: {}, streaks: {}, chartData: {}, statsByPlayer: {}, roleDistribution: {}, tagStats: [], championStats: [] };
  }

  const matchesData = matchesSheet.getRange(2, 1, lastMatchRow - 1, matchesSheet.getLastColumn()).getValues();
  const playersData = playersSheet.getRange(2, 1, lastPlayerRow - 1, playersSheet.getLastColumn()).getValues();

  const H = { 
    SUMMONER: 2, CHAMP: 3, LANE: 4, RESULT: 5, K: 6, D: 7, A: 8, 
    DAMAGE: 9, DURATION: 11, POINTS: 12, NOTES: 13 
  };

  function safeParse(val) {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
      return 0;
  }

  let statsByPlayer = {};
  
  let globalStats = {
    totalGames: 0, totalKills: 0,
    recordKills: { player: 'N/A', value: 0, champ: '' },
    recordDamage: { player: 'N/A', value: 0, champ: '' },
    bestKDA: { player: 'N/A', value: 0, champ: '' },
    maxPoints: { player: 'N/A', value: -9999, champ: '' },
    minPoints: { player: 'N/A', value: 9999, champ: '' },
    longestGame: { player: 'N/A', value: 0, champ: '' },
    roleDistribution: {}
  };
  
  let tagWinRateStats = {};       
  let championGlobalStats = {};  

  // --- PROCESAR PARTIDAS ---
  for (const row of matchesData) {
    const player = row[H.SUMMONER];
    if (!player) continue;

    if (!statsByPlayer[player]) {
      statsByPlayer[player] = {
        games: 0, wins: 0, kills: 0, deaths: 0, assists: 0,
        totalDamage: 0, maxKills: 0, maxDamage: 0, bestKDA: 0,
        champions: new Set(), roles: {}
      };
    }

    const kills = Number(row[H.K] || 0);
    const deaths = Number(row[H.D] || 0);
    const assists = Number(row[H.A] || 0);
    const damage = Number(row[H.DAMAGE] || 0);
    const duration = Number(row[H.DURATION] || 0); 
    const points = safeParse(row[H.POINTS]); 
    const role = row[H.LANE] || 'UNKNOWN';
    const isWin = row[H.RESULT] === 'Win';
    const gameKDA = (kills + assists) / (deaths === 0 ? 1 : deaths);
    const champName = row[H.CHAMP];

    const s = statsByPlayer[player];
    s.games++; s.kills += kills; s.deaths += deaths; s.assists += assists;
    s.totalDamage += damage;
    if (isWin) s.wins++;
    s.champions.add(champName);
    
    s.roles[role] = (s.roles[role] || 0) + 1;
    globalStats.roleDistribution[role] = (globalStats.roleDistribution[role] || 0) + 1;

    if (kills > s.maxKills) s.maxKills = kills;
    if (damage > s.maxDamage) s.maxDamage = damage;
    if (gameKDA > s.bestKDA) s.bestKDA = gameKDA;

    globalStats.totalGames++;
    globalStats.totalKills += kills;

    if (kills > globalStats.recordKills.value) globalStats.recordKills = { player: player, value: kills, champ: champName };
    if (points > globalStats.maxPoints.value) globalStats.maxPoints = { player: player, value: points, champ: champName };
    if (points < globalStats.minPoints.value) globalStats.minPoints = { player: player, value: points, champ: champName };
    if (damage > globalStats.recordDamage.value) globalStats.recordDamage = { player: player, value: damage, champ: champName };
    if (gameKDA > globalStats.bestKDA.value) globalStats.bestKDA = { player: player, value: gameKDA, champ: champName };
    if (duration > globalStats.longestGame.value) globalStats.longestGame = { player: player, value: duration, champ: champName };

    // --- PROCESAR CAMPEONES (MODIFICADO PARA PUNTOS) ---
    if (!championGlobalStats[champName]) {
      // Ã¢Â¬â€¡Ã¯Â¸Â AÃƒâ€˜ADIDO totalPoints: 0
      championGlobalStats[champName] = { games: 0, wins: 0, k: 0, d: 0, a: 0, totalPoints: 0, players: {} };
    }
    const c = championGlobalStats[champName];
    c.games++; c.k += kills; c.d += deaths; c.a += assists;
    c.totalPoints += points; // Ã¢Â¬â€¡Ã¯Â¸Â SUMAMOS PUNTOS GLOBALES
    if (isWin) c.wins++;

    if (!c.players[player]) c.players[player] = { games: 0, wins: 0, k: 0, d: 0, a: 0, totalPoints: 0 };
    const cp = c.players[player];
    cp.games++; cp.k += kills; cp.d += deaths; cp.a += assists;
    cp.totalPoints += points; // Ã¢Â¬â€¡Ã¯Â¸Â SUMAMOS PUNTOS DEL JUGADOR
    if (isWin) cp.wins++;

    const notesString = row[H.NOTES] || ''; 
    const tags = notesString.split(';').map(n => n.trim());
    tags.forEach(tag => {
      let baseTag = tag.split('(')[0].trim();
      if (!baseTag) return;
      if (!tagWinRateStats[baseTag]) tagWinRateStats[baseTag] = { wins: 0, losses: 0, total: 0 };
      const t = tagWinRateStats[baseTag];
      t.total++;
      if (isWin) t.wins++; else t.losses++;
    });
  }

  const H_PLAYER = { NAME: 0, STREAK: 5 };
  let streaks = { hot: { player: 'N/A', value: 0 }, cold: { player: 'N/A', value: 0 } };
  for (const row of playersData) {
    const player = row[H_PLAYER.NAME];
    const streak = Number(row[H_PLAYER.STREAK] || 0);
    if (streak > streaks.hot.value) streaks.hot = { player: player, value: streak };
    if (streak < streaks.cold.value) streaks.cold = { player: player, value: streak };
  }

  const chartData = {
    players: [], gamesPerPlayer: [], winRatePerPlayer: [], uniqueChampsPerPlayer: [],
    avgKdaPerPlayer: [], maxKillsPerPlayer: [], maxDamagePerPlayer: []
  };
  const sortedPlayerNames = Object.keys(statsByPlayer).sort();
  for (const player of sortedPlayerNames) {
    const s = statsByPlayer[player];
    s.uniqueChamps = s.champions.size; 
    delete s.champions; 
    s.winRate = s.games > 0 ? (s.wins / s.games) * 100 : 0;
    s.avgKDA = s.deaths > 0 ? (s.kills + s.assists) / s.deaths : (s.kills + s.assists);
    chartData.players.push(player);
    chartData.gamesPerPlayer.push(s.games);
    chartData.winRatePerPlayer.push(s.winRate.toFixed(1));
    chartData.uniqueChampsPerPlayer.push(s.uniqueChamps);
    chartData.avgKdaPerPlayer.push(s.avgKDA.toFixed(2));
    chartData.maxKillsPerPlayer.push(s.maxKills);
    chartData.maxDamagePerPlayer.push(s.maxDamage);
    s.bestKDA = s.bestKDA.toFixed(2);
  }
  globalStats.bestKDA.value = globalStats.bestKDA.value.toFixed(2);

  let tagStats = [];
  for (const tag in tagWinRateStats) {
    const stats = tagWinRateStats[tag];
    if (stats.total < 5) continue; 
    tagStats.push({ tag: tag, wins: stats.wins, losses: stats.losses, total: stats.total, winRate: (stats.wins / stats.total) * 100 });
  }
  tagStats.sort((a, b) => b.total - a.total);

  let championStats = [];
  for (const champName in championGlobalStats) {
    const c = championGlobalStats[champName];
    if (c.games < 3) continue; 
    
    // Calcular Media Global de Puntos
    const globalAvgPoints = (c.totalPoints / c.games).toFixed(2);

    const playersList = [];
    for (const playerName in c.players) {
      const p = c.players[playerName];
      // Calcular Media Jugador
      const pAvgPoints = (p.totalPoints / p.games).toFixed(2);

      playersList.push({ 
          name: playerName, 
          games: p.games, 
          winRate: p.games > 0 ? (p.wins / p.games) * 100 : 0, 
          kda: p.d > 0 ? ((p.k + p.a) / p.d) : (p.k + p.a),
          avgPoints: pAvgPoints // Ã¢Â¬â€¡Ã¯Â¸Â ENVIAR DATO
      });
    }
    
    championStats.push({ 
        champion: champName, 
        games: c.games, 
        winRate: (c.wins / c.games) * 100, 
        kda: c.d > 0 ? ((c.k + c.a) / c.d) : (c.k + c.a), 
        avgPoints: globalAvgPoints, // Ã¢Â¬â€¡Ã¯Â¸Â ENVIAR DATO
        players: playersList.sort((a, b) => b.games - a.games) 
    });
  }
  championStats.sort((a, b) => b.games - a.games);

  return { globalStats, streaks, chartData, statsByPlayer, roleDistribution: globalStats.roleDistribution, tagStats, championStats };
}


/**
 * SETUP DE MISIONES (VERSIÃƒâ€œN SILENCIOSA - SIN ERRORES DE UI)
 * Crea las hojas necesarias sin preguntar.
 */
function SetupMisiones() {
  const ss = SpreadsheetApp.getActive();
  console.log("Ã¢ÂÂ³ Iniciando Setup de Misiones...");

  // 1. Crear Hoja de DefiniciÃƒÂ³n de Misiones (MISSIONS)
  if (!ss.getSheetByName('MISSIONS')) {
    const missionSheet = ss.insertSheet('MISSIONS');
    missionSheet.getRange('A1:H1').setValues([
      ['MissionID', 'Descripcion', 'Tipo', 'Objetivo (Sub-Tipo)', 'ValorRequerido', 'RecompensaPts', 'Dificultad', 'Tracking (Single/Cumulative)']
    ]).setFontWeight('bold');
    
    // --- MISIONES DE EJEMPLO ---
    const exampleMissions = [
      ['FREJORD_3', 'Juega 3 campeones de Freljord', 'CHAMPION_REGION', 'Freljord', 3, 3.0, 'Media', 'Cumulative'],
      ['LANES_3', 'Juega 3 lÃƒÂ­neas distintas', 'UNIQUE_LANES', 'ANY', 3, 3.0, 'FÃƒÂ¡cil', 'Cumulative'],
      ['KDA_15', 'Consigue un KDA de 15+ en una partida', 'KDA_SINGLE_GAME', 'ANY', 15, 5.0, 'DifÃƒÂ­cil', 'Single'],
      ['PERFECT_GAME', 'Gana una partida con 0 muertes', 'PERFECT_GAME', 'ANY', 0, 10.0, 'Extrema', 'Single']
    ];
    missionSheet.getRange(2, 1, exampleMissions.length, exampleMissions[0].length).setValues(exampleMissions);
    missionSheet.setColumnWidths(1, 8, 180);
    console.log('Ã¢Å“â€¦ Hoja "MISSIONS" creada con ejemplos.');
  } else {
    console.log('Ã¢â€žÂ¹Ã¯Â¸Â La hoja "MISSIONS" ya existÃƒÂ­a.');
  }

  // 2. Crear Hoja de Estado de Progreso (MISSION_STATE)
  if (!ss.getSheetByName('MISSION_STATE')) {
    const stateSheet = ss.insertSheet('MISSION_STATE');
    stateSheet.getRange('A1:E1').setValues([
      ['PlayerName_MissionID', 'PlayerName', 'MissionID', 'Status (InProgress/Completed)', 'CurrentValue']
    ]).setFontWeight('bold');
    stateSheet.setColumnWidths(1, 5, 200);
    console.log('Ã¢Å“â€¦ Hoja "MISSION_STATE" creada.');
  } else {
    console.log('Ã¢â€žÂ¹Ã¯Â¸Â La hoja "MISSION_STATE" ya existÃƒÂ­a.');
  }

  // 3. Borrar la antigua hoja de Reporte (se volverÃƒÂ¡ a generar sola luego)
  const oldReport = ss.getSheetByName('MISSION_PROGRESS');
  if (oldReport) {
    ss.deleteSheet(oldReport);
    console.log('Ã°Å¸â€”â€˜Ã¯Â¸Â Antigua hoja "MISSION_PROGRESS" eliminada.');
  }
  
  console.log("Ã¢Å“Â¨ Setup de Misiones FINALIZADO.");
}


/**
 * Ã°Å¸â€œÅ“ SINCRONIZADOR DE HISTORIAL DE MISIONES (v8 - Soporte Champion Ocean)
 * Escanea TODAS las partidas y rellena 'MISSION_STATE'.
 * Soporta: UNIQUE_CHAMPIONS, Regiones, Roles y Contadores.
 */
function SincronizarProgresoMisiones() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Confirmar SincronizaciÃƒÂ³n Masiva',
    'Esto escanearÃƒÂ¡ TODAS las partidas de TODOS los jugadores para reconstruir el estado de las misiones. SobrescribirÃƒÂ¡ la hoja "MISSION_STATE". Ã‚Â¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  logToSheet('Iniciando SincronizaciÃƒÂ³n Masiva de Misiones...');
  
  const cfg = readConfigMap();
  const seasonStart = cfg.seasonStartDateObj || new Date(0);

  const playersSheet = ss.getSheetByName('PLAYERS');
  const matchesSheet = ss.getSheetByName('MATCHES');
  const stateSheet = ss.getSheetByName('MISSION_STATE');

  if (!playersSheet || !matchesSheet || !stateSheet) {
      ui.alert("Error: Faltan hojas necesarias.");
      return;
  }

  const players = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 1).getValues().flat().filter(String);
  const matches = matchesSheet.getDataRange().getValues();
  const missions = getMissions(true); // Forzar recarga de misiones
  const champDataMap = getChampionDataMap();
  
  let newStates = [];

  // Bucle principal por jugador
  for (const player of players) {
    let playerProgress = {}; 
    let singleMissionCompleted = {}; 
    
    // 1. Inicializar memorias
    missions.forEach(m => {
      if (m.Tracking === 'Cumulative') {
        // AÃƒâ€˜ADIDO: UNIQUE_CHAMPIONS se inicializa como un Set (Lista sin duplicados)
        if (['CHAMPION_REGION', 'UNIQUE_LANES', 'CHAMPION_IN_UNIQUE_LANES', 'UNIQUE_CHAMPIONS'].includes(m.Tipo)) {
           playerProgress[m.MissionID] = new Set();
        } else if (m.Tipo === 'ONE_CHAMP_ALL_LANES') {
           playerProgress[m.MissionID] = {}; 
        } else {
           playerProgress[m.MissionID] = 0; 
        }
      } else {
        singleMissionCompleted[m.MissionID] = 0; 
      }
    });

    // 2. Filtrar partidas del jugador (Temporada actual)
    const playerMatches = matches.slice(1).filter(m => {
        return m[2] === player && new Date(m[1]) >= seasonStart;
    });

    // 3. Procesar cada partida
    for (const match of playerMatches) {
      const matchChampion = match[3];
      const matchLane = (match[4] || 'UNKNOWN').toUpperCase().replace('UTILITY', 'SUPPORT').replace('BOT', 'BOTTOM');
      const result = match[5]; 
      const k = Number(match[6]);
      const d = Number(match[7]);
      const a = Number(match[8]);
      const kda = (k + a) / Math.max(1, d);
      
      for (const m of missions) {
        
        // --- TIPO A: Misiones Acumulativas ---
        if (m.Tracking === 'Cumulative') {
          
          // A1. Misiones de ColecciÃƒÂ³n (Sets)
          if (['CHAMPION_REGION', 'UNIQUE_LANES', 'CHAMPION_IN_UNIQUE_LANES', 'UNIQUE_CHAMPIONS'].includes(m.Tipo)) {
             let progressSet = playerProgress[m.MissionID];
             if (progressSet.size >= m.ValorRequerido) continue; 

             // LÃƒâ€œGICA NUEVA: UNIQUE_CHAMPIONS
             if (m.Tipo === 'UNIQUE_CHAMPIONS') {
                progressSet.add(matchChampion);
             }
             else if (m.Tipo === 'CHAMPION_REGION') {
                const regions = champDataMap[matchChampion] || [];
                if (regions.includes(m.Objetivo)) progressSet.add(matchChampion);
             } 
             else if (m.Tipo === 'UNIQUE_LANES' && matchLane !== 'UNKNOWN') {
                progressSet.add(matchLane);
             }
             else if (m.Tipo === 'CHAMPION_IN_UNIQUE_LANES' && matchChampion === m.Objetivo && matchLane !== 'UNKNOWN') {
                progressSet.add(matchLane);
             }
             playerProgress[m.MissionID] = progressSet;
          }
          // A2. Misiones de Mapa (Polivalente)
          else if (m.Tipo === 'ONE_CHAMP_ALL_LANES') {
             let champMap = playerProgress[m.MissionID];
             if (!champMap[matchChampion]) champMap[matchChampion] = new Set();
             if (matchLane !== 'UNKNOWN') champMap[matchChampion].add(matchLane);
             playerProgress[m.MissionID] = champMap;
          }
          // A3. Contadores
          else if (['GAMES_AS_ROLE', 'GAMES_AS_CHAMPION', 'CUMULATIVE_STAT', 'CUMULATIVE_CHALLENGE', 'CHAMPION_LIST', 'IN_GAME_EVENT', 'CUMULATIVE_OBJ'].includes(m.Tipo)) {
             if (playerProgress[m.MissionID] >= m.ValorRequerido) continue;

             if (m.Tipo === 'GAMES_AS_ROLE' && matchLane === m.Objetivo) playerProgress[m.MissionID]++;
             else if (m.Tipo === 'GAMES_AS_CHAMPION' && matchChampion === m.Objetivo) playerProgress[m.MissionID]++;
             else if (m.Tipo === 'CUMULATIVE_STAT') {
                if (m.Objetivo === 'KILLS') playerProgress[m.MissionID] += k;
                else if (m.Objetivo === 'DEATHS') playerProgress[m.MissionID] += d;
                else if (m.Objetivo === 'ASSISTS') playerProgress[m.MissionID] += a;
             }
          }
        } 
        // --- TIPO B: Misiones de Partida ÃƒÅ¡nica ---
        else if (m.Tracking === 'Single') {
           if (singleMissionCompleted[m.MissionID] > 0) continue;

           let completed = false;
           if (m.Tipo === 'KDA_SINGLE_GAME' && kda >= m.ValorRequerido) completed = true;
           else if (m.Tipo === 'PERFECT_GAME' && d === 0 && result === 'Win') completed = true;
           else if (m.Tipo === 'DEATHS_LESS_THAN' && d <= m.ValorRequerido && result === 'Win') completed = true;
           
           if (completed) singleMissionCompleted[m.MissionID] = 1;
        }
      }
    }

    // 4. Guardar resultados
    missions.forEach(m => {
      let status = 'InProgress';
      let value = '';
      
      if (m.Tracking === 'Cumulative') {
        if (['CHAMPION_REGION', 'UNIQUE_LANES', 'CHAMPION_IN_UNIQUE_LANES', 'UNIQUE_CHAMPIONS'].includes(m.Tipo)) {
           const set = playerProgress[m.MissionID];
           value = Array.from(set).join(',');
           if (set.size >= m.ValorRequerido) status = 'Completed';
        }
        else if (m.Tipo === 'ONE_CHAMP_ALL_LANES') {
           let champMap = playerProgress[m.MissionID];
           let isDone = false;
           let jsonMap = {};
           for (let c in champMap) {
               let lanes = Array.from(champMap[c]);
               jsonMap[c] = lanes;
               if (lanes.length >= m.ValorRequerido) isDone = true;
           }
           value = JSON.stringify(jsonMap);
           if (isDone) status = 'Completed';
        }
        else {
           value = playerProgress[m.MissionID].toString();
           if (Number(value) >= m.ValorRequerido) status = 'Completed';
        }
      } else {
        value = singleMissionCompleted[m.MissionID].toString();
        if (singleMissionCompleted[m.MissionID] > 0) {
           status = 'Completed';
           value = '1';
        }
      }
      
      const key = `${player}_${m.MissionID}`;
      newStates.push([key, player, m.MissionID, status, value]);
    });
    
  } 

  // 5. Escribir en Excel
  stateSheet.getRange(2, 1, stateSheet.getMaxRows(), stateSheet.getMaxColumns()).clearContent();
  if (newStates.length > 0) {
    stateSheet.getRange(2, 1, newStates.length, 5).setValues(newStates);
  }
  
  logToSheet('Ã‚Â¡SincronizaciÃƒÂ³n Masiva de Misiones COMPLETADA!');
  ui.alert('Ã‚Â¡SincronizaciÃƒÂ³n Masiva de Misiones COMPLETADA!');
}


/* =========================================
   RANKING Ãƒâ€°PICO (VISUAL) - ACTUALIZADO CON ELO, GAMES, WR
   ========================================= */

// FunciÃƒÂ³n para abrir la ventana (NO CAMBIA)
function showEpicRanking() {
  const html = HtmlService.createTemplateFromFile('EpicRanking')
      .evaluate()
      .setWidth(1100)
      .setHeight(850)
      .setTitle('Ã°Å¸Ââ€  CLASIFICACIÃƒâ€œN GENERAL Ã°Å¸Ââ€ ');
  SpreadsheetApp.getUi().showModalDialog(html, 'SoloQ Pro Ranking');
}

/* ----------------- RANKING Ãƒâ€°PICO (BACKEND CORREGIDO) ----------------- */
function getEpicRankingData(seasonFilter) { 
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName('PLAYERS');
  const matchesSheet = ss.getSheetByName('MATCHES');
  const configSheet = ss.getSheetByName('CONFIG');
  const manualSheet = ss.getSheetByName('MANUAL_POINTS');
  
  if (!playersSheet || !matchesSheet) return [];

  // --- 1. CONFIGURACIÃƒâ€œN DEL FILTRO ---
  let targetSeason = seasonFilter || 'CURRENT'; 
  let currentConfigSeason = 'S3'; // Valor por defecto ultra-seguro

  if (configSheet) {
      let valB2 = String(configSheet.getRange('B2').getValue()).trim(); 
      let valB1 = String(configSheet.getRange('B1').getValue()).trim(); 
      
      if (valB2.startsWith('S')) currentConfigSeason = valB2;
      else if (valB1.startsWith('S')) currentConfigSeason = valB1;
  }

  if (targetSeason === 'CURRENT') {
      targetSeason = currentConfigSeason;
  }

  // --- 2. OBTENER JUGADORES ---
  const playersLastRow = playersSheet.getLastRow();
  if (playersLastRow < 2) return [];
  const pData = playersSheet.getRange(2, 1, playersLastRow - 1, 10).getValues();
  
  const rankingMap = {};
  pData.forEach(row => {
    const name = row[0];
    if (name) {
        rankingMap[name] = {
            name: name, points: 0, w: 0, t: 0, 
            streak: Number(row[5] || 0), 
            rank: row[8], lp: row[9],
            badges: []
        };
    }
  });

  // --- 3. PROCESAR PARTIDAS (CON FILTRO DE SEASON) ---
  const matchesLastRow = matchesSheet.getLastRow();
  if (matchesLastRow > 1) {
      const mData = matchesSheet.getRange(2, 1, matchesLastRow - 1, 15).getValues();
      const seasonIdx = 14; // ÃƒÂndice 14 = Columna 15 (O)

      for (let i = 0; i < mData.length; i++) {
        const row = mData[i];
        const summ = row[2];
        const res = row[5];
        const points = Number(row[12]);
        const matchSeason = String(row[seasonIdx] || "").trim();

        if (targetSeason !== 'ALL' && matchSeason !== targetSeason) {
            continue; 
        }

        if (rankingMap[summ] && !isNaN(points)) {
            rankingMap[summ].points += points;
            rankingMap[summ].t++;
            if (res === 'Win') rankingMap[summ].w++;
        }
      }
  }

  // --- 3.5. PROCESAR PUNTOS MANUALES (Castigos, Duelos, Tienda) ---
  if (manualSheet && manualSheet.getLastRow() > 1) {
      const manData = manualSheet.getRange(2, 1, manualSheet.getLastRow() - 1, 3).getValues();
      
      let seasonStart = new Date('2024-01-01T00:00:00Z'); 
      if (configSheet) {
          const cfgData = configSheet.getDataRange().getValues();
          const startRow = cfgData.find(r => r[0] === 'season_start_date');
          if (startRow && startRow[1]) seasonStart = new Date(startRow[1]);
      }

      manData.forEach(row => {
          const mDate = new Date(row[0]);
          const summ = row[1];
          const pts = Number(row[2]);

          const isValidDate = targetSeason === 'ALL' || mDate >= seasonStart;

          if (isValidDate && rankingMap[summ] && !isNaN(pts)) {
              rankingMap[summ].points += pts;
          }
      });
  }

  // --- 4. CALCULAR FORMATO FINAL ---
  let maxGames = 0;
  Object.values(rankingMap).forEach(p => { if (p.t > maxGames) maxGames = p.t; });

  let ranking = Object.values(rankingMap).map(p => {
    const wr = p.t > 0 ? ((p.w / p.t) * 100).toFixed(0) : 0;
    
    if (p.t > 0 && p.t === maxGames && p.t > 3) p.badges.push("Ã°Å¸Å¡Å“"); 
    if (Number(wr) >= 60 && p.t >= 5) p.badges.push("Ã°Å¸Å¡â‚¬");
    if (Number(wr) <= 40 && p.t >= 5) p.badges.push("Ã°Å¸â€™â‚¬"); 
    
    return {
      name: p.name,
      points: p.points.toFixed(2), 
      realRank: p.rank || "Unranked",
      lp: p.lp || 0,
      totalGames: p.t,
      winrate: wr + "%",
      streak: p.streak, 
      badges: p.badges
    };
  });

  ranking.sort((a, b) => Number(b.points) - Number(a.points));
  if (ranking.length > 0 && ranking[0].totalGames > 0) ranking[0].badges.unshift("Ã°Å¸â€˜â€˜"); 
  ranking.forEach((r, i) => r.rank = i + 1);

  return ranking;
}


/* ----------------- ANUNCIO DE ROLES A DISCORD ----------------- */
function sendDiscordRolesAnnouncement(winnersData) {
  // Ã°Å¸â€˜â€¡ TU WEBHOOK Ã°Å¸â€˜â€¡
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1441052410402570360/FRdkGyD-gdtgadnofato00bxOizHgXf7KV6Yjulu3mnKRAtT3owNaBlEJS7J8QIjFQo1"; 

  if (!WEBHOOK_URL) return;

  // Formatear HEXTECH
  const hGen = winnersData.HEXTECH.GENERAL.playerName;
  const hEst = winnersData.HEXTECH.ESTRATEGA.playerName;
  const hTank = winnersData.HEXTECH.TANQUE.playerName;

  const hexText = `Ã¢Â­Â **GENERAL:** ${hGen}\nÃ°Å¸Â§Â  **ESTRATEGA:** ${hEst}\nÃ°Å¸â€ºÂ¡Ã¯Â¸Â **TANQUE:** ${hTank}`;

  // Formatear CHEMTECH
  const cGen = winnersData.CHEMTECH.GENERAL.playerName;
  const cEst = winnersData.CHEMTECH.ESTRATEGA.playerName;
  const cTank = winnersData.CHEMTECH.TANQUE.playerName;

  const chemText = `Ã¢Â­Â **GENERAL:** ${cGen}\nÃ°Å¸Â§Â  **ESTRATEGA:** ${cEst}\nÃ°Å¸â€ºÂ¡Ã¯Â¸Â **TANQUE:** ${cTank}`;

  const payload = {
    username: "SoloQ Referee",
    avatar_url: "https://i.imgur.com/M0k3y3N.png",
    content: " Ã°Å¸â€”Â³Ã¯Â¸Â **Ã‚Â¡HABEMUS IMPERATOR!** Las urnas se han cerrado.",
    embeds: [
      {
        title: "Ã°Å¸â€œÅ“ RESULTADOS DE LAS ELECCIONES",
        description: "Los nuevos oficiales han sido asignados para liderar la guerra esta semana.",
        color: 16766720, // Dorado
        fields: [
          {
            name: "Ã°Å¸â€™Å½ HEXTECH (Fuerza Azul)",
            value: hexText,
            inline: true
          },
          {
            name: "Ã°Å¸Â§Âª CHEMTECH (Fuerza Verde)",
            value: chemText,
            inline: true
          },
          {
            name: "Ã°Å¸â€œâ€¹ Deberes",
            value: "Ã¢â‚¬Â¢ **General:** +50% Puntos (Win/Loss)\nÃ¢â‚¬Â¢ **Estratega:** Bonus en Misiones Diarias\nÃ¢â‚¬Â¢ **Tanque:** Escudo anti-derrota (50% mitigaciÃƒÂ³n)",
            inline: false
          }
        ],
        footer: { text: "SoloQ Challenge Ã¢â‚¬Â¢ Sistema de Facciones" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    Logger.log("Anuncio de roles enviado a Discord.");
  } catch(e) {
    Logger.log("Error enviando roles a Discord: " + e.message);
  }
}


/* ----------------- NOTIFICACIONES EN VIVO (DISCORD V3.0 - EXTREME) ----------------- */
function sendMatchNotification(player, champ, kda, points, result, notes, priceDelta) {
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1441052410402570360/FRdkGyD-gdtgadnofato00bxOizHgXf7KV6Yjulu3mnKRAtT3owNaBlEJS7J8QIjFQo1"; 

  if (!WEBHOOK_URL || WEBHOOK_URL.includes("TU_URL")) return;

  const isWin = result === "Win";
  const pts = Number(points);
  
  // --- 1. GESTIÃƒâ€œN DE COLORES (Escala Ampliada) ---
  let color = isWin ? 5763719 : 15548997; // Verde o Rojo base
  
  if (!isWin && pts >= 15) color = 16766720;      // Dorado (SVP)
  if (pts >= 40) color = 7419530;                 // Morado
  if (pts >= 60) color = 3066993;                 // Azul NeÃƒÂ³n (Extremo)
  if (pts >= 80) color = 16777215;                // Blanco Brillante (Deidad)
  if (pts <= -40) color = 2303786;                // Negro (Desastre)
  if (pts <= -60) color = 0;                      // Negro Absoluto (Apocalipsis)

  let champClean = champ.replace(/[^a-zA-Z0-9]/g, '');
  if (champClean.toLowerCase() === "fiddlesticks") champClean = "Fiddlesticks"; 
  if (champClean === "RenataGlasc") champClean = "Renata"; 
  
  let latestVersion = "16.4.1"; 
  try {
      const vRes = UrlFetchApp.fetch("https://ddragon.leagueoflegends.com/api/versions.json", {muteHttpExceptions: true});
      if (vRes.getResponseCode() === 200) {
          latestVersion = JSON.parse(vRes.getContentText())[0];
      }
  } catch(e) {}

  const thumbUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${champClean}.png`;

  // --- 2. JERARQUÃƒÂA DE ALERTAS (Escala +80 a -60) ---
  let contentMsg = ""; 

  // COMBOS Ãƒâ€°PICOS
  if (notes.includes("Penta") && notes.includes("Solo Nashor")) {
    contentMsg = "@everyone Ã°Å¸Â¦Â **Ã‚Â¡DEPREDADOR APEX!** (Penta + Nashor Solo)";
  }
  else if (notes.includes("Penta") || notes.includes("PENTAKILL")) {
    contentMsg = "@everyone Ã°Å¸Å¡Â¨ **Ã‚Â¡PENTAKILL DETECTADA!** Ã°Å¸Å¡Â¨";
  } 
  
  // ESCALA POSITIVA (+80)
  else if (pts >= 80) {
    contentMsg = " Ã°Å¸Å’Å’ **Ã‚Â¡Ã‚Â¡DEIDAD ABSOLUTA!! (+80 PTS)** Ã°Å¸Å’Å’ Ã‚Â¡Este jugador ha roto el tejido de la realidad!";
  }
  else if (pts >= 70) {
    contentMsg = " Ã¢Å“Â¨ **Ã‚Â¡NIVEL CÃƒâ€œSMICO! (+70 PTS)** Ã¢Å“Â¨ La Grieta se queda pequeÃƒÂ±a para este nivel.";
  }
  else if (pts >= 60) {
    contentMsg = " Ã°Å¸Å¡â‚¬ **Ã‚Â¡COLAPSO DEL BOT! (+60 PTS)** Ã°Å¸Å¡â‚¬ Ã‚Â¡Alguien llame a los desarrolladores!";
  }
  else if (pts >= 50) {
    contentMsg = " Ã°Å¸â€˜â€˜ **Ã‚Â¡DIOS HA BAJADO A LA GRIETA! (+50 PTS)** Ã°Å¸â€˜â€˜";
  }
  else if (pts >= 40) {
    contentMsg = " Ã¢Å¡â€ºÃ¯Â¸Â **Ã‚Â¡NIVEL SCRIPT! (+40 PTS)** Ã¢Å¡â€ºÃ¯Â¸Â";
  }
  else if (pts >= 30) {
    contentMsg = "Ã°Å¸Â¦Â **Ã‚Â¡ACTUACIÃƒâ€œN DE SMURF! (+30 PTS)**";
  }
  else if (pts >= 20) {
    contentMsg = "Ã°Å¸â€Â¥ **Ã‚Â¡La Grieta estÃƒÂ¡ ardiendo!** (+20 PTS)";
  }

  // ESCALA NEGATIVA (-60)
  else if (pts <= -60) {
    contentMsg = " Ã¢ËœÂ¢Ã¯Â¸Â **Ã‚Â¡AMENAZA NACIONAL! (-60 PTS)** Ã¢ËœÂ¢Ã¯Â¸Â Este jugador ha sido baneado de la existencia.";
  }
  else if (pts <= -50) {
    contentMsg = " Ã°Å¸Å¡Â¨ **Ã‚Â¡CRIMINAL DE GUERRA! (-50 PTS)** Ã°Å¸Å¡Â¨ Elo terrorism detected.";
  }
  else if (pts <= -40) {
    contentMsg = " Ã°Å¸â€˜Â® **Ã‚Â¡REPORTADO A LA POLICÃƒÂA! (-40 PTS)** Ã°Å¸â€˜Â® Cadena perpetua.";
  }
  else if (pts <= -30) {
    contentMsg = "Ã°Å¸Â¤Â¡ **Ã‚Â¡ALERTA DE TROLL! (-30 PTS)** Ã‚Â¿QuÃƒÂ© ha sido eso?";
  }
  else if (pts <= -20) {
    contentMsg = "Ã°Å¸â€œâ€° **Ã‚Â¡DESASTRE TOTAL! (-20 PTS)**";
  }
  else if (pts <= -10) {
    contentMsg = "Ã°Å¸Å’Â§Ã¯Â¸Â **Ã‚Â¡DÃƒÂA GRIS! (-10 PTS)**";
  }

  // EVENTOS ESPECIALES
  if (contentMsg === "" && (notes.includes("MILAGRO") || notes.includes("Comeback"))) {
      contentMsg = "Ã°Å¸â€œâ€°Ã°Å¸â€œË† **Ã‚Â¡COMEBACK IS REAL!**";
  }

  // --- 3. LÃƒâ€œGICA DE MERCADO ---
  let marketText = "";
  if (priceDelta !== undefined && priceDelta !== null) {
      const deltaVal = Number(priceDelta);
      const trendIcon = deltaVal >= 0 ? "Ã°Å¸â€œË†" : "Ã°Å¸â€œâ€°";
      const sign = deltaVal > 0 ? "+" : ""; 
      const highlight = Math.abs(deltaVal) > 5 ? "**" : ""; 
      marketText = `\n${trendIcon} AcciÃƒÂ³n: ${highlight}${sign}${deltaVal.toFixed(1)} G${highlight}`;
  }

  const payload = {
    username: "SoloQ Referee",
    avatar_url: "https://i.imgur.com/M0k3y3N.png",
    content: contentMsg, 
    embeds: [{
      title: `${isWin ? "VICTORIA" : "DERROTA"} - ${player}`,
      description: `**${player}** acaba de terminar con **${champ}**.`,
      color: color,
      thumbnail: { url: thumbUrl },
      fields: [
        { name: "Ã¢Å¡â€Ã¯Â¸Â KDA", value: `\`${kda}\``, inline: true },
        { name: "Ã°Å¸â€™Å½ Score", value: pts >= 25 ? `**Ã°Å¸Å¡â‚¬ ${pts > 0 ? '+' : ''}${pts} Pts**${marketText}` : `**${pts > 0 ? '+' : ''}${pts}** Pts${marketText}`, inline: true },
        { name: "Ã°Å¸â€œâ€¹ Notas del ÃƒÂrbitro", value: (notes.length > 1024) ? notes.substring(0, 1021) + "..." : (notes || "Sin incidencias."), inline: false }
      ],
      footer: { text: `SoloQ Pro v14 Ã¢â‚¬Â¢ ${new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}` }
    }]
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch(e) {
    Logger.log("Error enviando a Discord: " + e.message);
  }
}

// HELPER: Generar URL de grÃƒÂ¡fico para Discord (Usa QuickChart.io)
function getDiscordChartUrl(ranking) {
  const labels = ranking.map(p => p.name);
  const data = ranking.map(p => p.points);
  
  const chartConfig = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Puntos',
        data: data,
        backgroundColor: 'rgba(10, 200, 185, 0.6)', // Color Hextech
        borderColor: '#0AC8B9',
        borderWidth: 1
      }]
    },
    options: {
      title: { display: true, text: 'TOP 5 - PUNTUACIÃƒâ€œN', fontColor: '#C8AA6E' },
      legend: { display: false },
      scales: {
        yAxes: [{ ticks: { fontColor: '#fff' }, gridLines: { color: 'rgba(255,255,255,0.1)' } }],
        xAxes: [{ ticks: { fontColor: '#fff' } }]
      }
    }
  };

  const baseUrl = 'https://quickchart.io/chart?c=';
  return baseUrl + encodeURIComponent(JSON.stringify(chartConfig));
}

// 2. PREPARAR DATOS PARA GRÃƒÂFICO DE EVOLUCIÃƒâ€œN
function getEvolutionDataForWeb() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const data = matchesSheet.getDataRange().getValues();
  // data: [MatchID, Date, Summoner, ..., Points(12)]
  
  // Obtener los Top 5 actuales para no saturar el grÃƒÂ¡fico
  const topPlayers = getEpicRankingData().slice(0, 5).map(p => p.name);
  
  // Estructura: { "Nombre": [{x: fecha, y: puntosAcumulados}] }
  const series = {};
  topPlayers.forEach(p => series[p] = []);
  
  const runningScore = {}; // Puntos acumulados temporales
  topPlayers.forEach(p => runningScore[p] = 0);

  // Recorremos las partidas cronolÃƒÂ³gicamente (asumiendo que MATCHES estÃƒÂ¡ ordenado o lo ordenamos)
  // Saltamos header (i=1). Ordenamos por fecha (col 1)
  const sortedMatches = data.slice(1).sort((a, b) => new Date(a[1]) - new Date(b[1]));

  sortedMatches.forEach(row => {
    const name = row[2];
    const date = new Date(row[1]).toLocaleDateString();
    const points = Number(row[12] || 0);

    if (topPlayers.includes(name)) {
      runningScore[name] += points;
      // Guardamos el punto en el tiempo
      series[name].push({ x: date, y: Number(runningScore[name].toFixed(2)) });
    }
  });

  return {
    players: topPlayers,
    series: series
  };
}
/* ----------------- RANKED DATA FETCHER (COMPLEJO) ----------------- */

/**
 * Obtiene el Rango, DivisiÃƒÂ³n y LP actual de SoloQ.
 * Requiere 2 llamadas API: PUUID -> SummonerID -> LeagueEntry
 */
function getPlayerRankFromAPI(puuid, summonerName, apiKey) {
  const cfg = readConfigMap();
  const region = cfg.riot_region || 'europe';
  
  // 1. Obtener SummonerID (Encriptado) usando PUUID
  const urlSummoner = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  const resSum = riotFetchJson(urlSummoner);
  
  if (!resSum || !resSum.id) {
    logToSheet(`Ã¢ÂÅ’ Error buscando SummonerID para ${summonerName}`);
    return null;
  }
  
  const summonerId = resSum.id;
  
  // 2. Obtener Ligas usando SummonerID
  const urlLeague = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
  const resLeague = riotFetchJson(urlLeague);
  
  if (Array.isArray(resLeague)) {
    // Buscamos solo la cola de Solo/Duo (RANKED_SOLO_5x5)
    const soloQ = resLeague.find(q => q.queueType === 'RANKED_SOLO_5x5');
    
    if (soloQ) {
      return {
        rank: `${soloQ.tier} ${soloQ.rank}`, // Ej: EMERALD IV
        lp: soloQ.leaguePoints,
        wins: soloQ.wins,
        losses: soloQ.losses,
        summonerId: summonerId // Guardamos esto para futuras llamadas rÃƒÂ¡pidas
      };
    }
  }
  
  return { rank: "UNRANKED", lp: 0, wins: 0, losses: 0, summonerId: summonerId };
}

/**
 * FunciÃƒÂ³n para ejecutar manualmente y actualizar los rangos en la hoja PLAYERS
 */
// =========================================================================
// Ã°Å¸Ââ€  ACTUALIZADOR DE ELOS (RANKED SOLO/DUO)
// =========================================================================
function updateAllPlayerRanks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PLAYERS");
  if (!sheet) return "No se encontrÃƒÂ³ la hoja PLAYERS";

  const data = sheet.getDataRange().getValues();
  const apiKey = getRiotApiKey(); // AsegÃƒÂºrate de que esta funciÃƒÂ³n existe o pon tu API key aquÃƒÂ­ directamente
  const region = "euw1"; // Cambia si tus jugadores estÃƒÂ¡n en otra regiÃƒÂ³n

  let updatedCount = 0;

  // Empezamos desde la fila 1 (ignorando la fila 0 que son los encabezados)
  for (let i = 1; i < data.length; i++) {
    const summonerName = data[i][0]; // Columna A (Nombre)
    const puuid = data[i][2];        // Columna C (PUUID)
    const isActive = data[i][4];     // Columna E (Active SÃƒÂ­/No)

    // Solo actualizamos jugadores que tengan PUUID y estÃƒÂ©n activos
    if (!puuid || isActive !== "SÃƒÂ­") continue;

    try {
      // 1. Obtener el Summoner ID a partir del PUUID
      const summonerUrl = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${apiKey}`;
      const summonerRes = UrlFetchApp.fetch(summonerUrl, { muteHttpExceptions: true });
      
      if (summonerRes.getResponseCode() !== 200) {
        Logger.log(`Error obteniendo Summoner ID para ${summonerName}`);
        continue;
      }
      
      const summonerData = JSON.parse(summonerRes.getContentText());
      const summonerId = summonerData.id;

      // 2. Obtener los datos de Ligas (Ranked) a partir del Summoner ID
      const leagueUrl = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}?api_key=${apiKey}`;
      const leagueRes = UrlFetchApp.fetch(leagueUrl, { muteHttpExceptions: true });
      
      if (leagueRes.getResponseCode() !== 200) {
        Logger.log(`Error obteniendo Liga para ${summonerName}`);
        continue;
      }

      const leagueData = JSON.parse(leagueRes.getContentText());
      
      let rankString = "Unranked";
      let lp = 0;

      // 3. Buscar especÃƒÂ­ficamente la cola de Solo/Duo
      for (let j = 0; j < leagueData.length; j++) {
        if (leagueData[j].queueType === "RANKED_SOLO_5x5") {
          // Formatear el tier (Ej: "EMERALD" -> "Emerald")
          let tier = leagueData[j].tier;
          tier = tier.charAt(0).toUpperCase() + tier.toLowerCase().slice(1);
          
          let division = leagueData[j].rank;
          lp = leagueData[j].leaguePoints;
          
          // Si es Master, Grandmaster o Challenger, no tienen divisiÃƒÂ³n (I, II, III, IV)
          if (["Master", "Grandmaster", "Challenger"].includes(tier)) {
            rankString = `${tier} (${lp} LP)`;
          } else {
            rankString = `${tier} ${division}`; // Ej: "Emerald 1"
          }
          break; // Ya encontramos Solo/Duo, salimos del bucle
        }
      }

      // 4. Guardar en el Google Sheet
      // Fila = i + 1. Columna Rank = 9 (I). Columna LastRankUpdate = 12 (L)
      sheet.getRange(i + 1, 9).setValue(rankString); 
      sheet.getRange(i + 1, 12).setValue(new Date()); // Pone la fecha y hora actual
      
      updatedCount++;

      // Ã°Å¸â€ºÂ¡Ã¯Â¸Â PROTECCIÃƒâ€œN DE RATE LIMIT (Riot permite 100 peticiones cada 2 minutos)
      // Como hacemos 2 peticiones por jugador, pausamos 1.5 segundos entre jugadores.
      Utilities.sleep(1500); 

    } catch (e) {
      Logger.log(`Fallo crÃƒÂ­tico con ${summonerName}: ${e.message}`);
    }
  }
  
  return `Ã‚Â¡Se han actualizado los rangos de ${updatedCount} jugadores activos!`;
}


/* ----------------- HELPER: CÃƒÂLCULO DE ORO REAL (TIMELINE) BLINDADO ----------------- */
function fetchRealGoldDeficit(matchId, myTeamId, region, apiKey) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
  
  // Usamos tu funciÃƒÂ³n segura que ya gestiona errores 429 y 500
  const data = riotFetchJson(url); 

  if (!data || data.__error || !data.info || !data.info.frames) {
      Logger.log(`Ã¢Å¡Â Ã¯Â¸Â Timeline no disponible o error para ${matchId}`);
      return 0; 
  }

  const frames = data.info.frames;
  let maxDeficit = 0;
  
  for (const frame of frames) {
    let gold100 = 0; 
    let gold200 = 0; 
    
    for (let i = 1; i <= 10; i++) {
      const pFrame = frame.participantFrames[i.toString()];
      if (pFrame) { // Check extra por si acaso
          if (i <= 5) gold100 += pFrame.totalGold;
          else        gold200 += pFrame.totalGold;
      }
    }
    
    let diff = (myTeamId === 100) ? (gold100 - gold200) : (gold200 - gold100);
    
    // Si diff es negativo (vamos perdiendo) y es el peor dÃƒÂ©ficit visto
    if (diff < 0 && Math.abs(diff) > maxDeficit) {
      maxDeficit = Math.abs(diff);
    }
  }
  
  return maxDeficit;
}

// --- HELPERS INTERNOS PARA QUE NO FALLE ---



function getPuuidFromRiot(name, tag, key) {
  const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const data = fetchSimple(url, key);
  return data ? data.puuid : null;
}

function romanToInt(s) {
  const m = {I:1, II:2, III:3, IV:4};
  return m[s] || s;
}

// --- HELPERS INTERNOS PARA QUE NO FALLE ---

function fetchSimple(url, key) {
  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { "X-Riot-Token": key },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
    return null;
  } catch (e) { return null; }
}

// --- HELPER SIMPLE PARA LLAMADAS API (Si ya tienes uno, usa el tuyo) ---
function fetchRiotData(url, key) {
  try {
    const params = {
      method: "GET",
      headers: { "X-Riot-Token": key },
      muteHttpExceptions: true
    };
    const res = UrlFetchApp.fetch(url, params);
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// --- HELPER PARA CONVERTIR ROMANOS (IV -> 4) ---
function romanToInt(roman) {
  const map = { I: 1, II: 2, III: 3, IV: 4 };
  return map[roman] || roman; // Si no estÃƒÂ¡ en la lista, devuelve el original
}

/* ----------------- SYNERGY / DUO ANALYZER ----------------- */

function showSynergyDashboard() {
  const html = HtmlService.createTemplateFromFile('SynergyDashboard')
      .evaluate()
      .setWidth(1000)
      .setHeight(800)
      .setTitle('Ã°Å¸â€™Å¾ Analizador de Sinergias (DÃƒÂºos)');
  SpreadsheetApp.getUi().showModalDialog(html, 'Reporte de Bromance');
}

function getSynergyData() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  if (!matchesSheet) return { error: "No matches found" };

  const data = matchesSheet.getDataRange().getValues();
  // Headers: MatchID(0), Date(1), Summoner(2), ..., Result(5), ..., Points(12)

  // 1. Agrupar partidas por MatchID
  const matchesById = {};
  
  // Empezamos en 1 para saltar header
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const matchId = row[0];
    const summoner = row[2];
    const result = row[5];
    const kda = `${row[6]}/${row[7]}/${row[8]}`;
    const points = Number(row[12]);

    if (!matchesById[matchId]) {
      matchesById[matchId] = {
        date: row[1],
        players: []
      };
    }

    matchesById[matchId].players.push({
      name: summoner,
      result: result,
      points: points,
      kda: kda
    });
  }

  // 2. Detectar DÃƒÂºos (Partidas con >1 jugador trackeado)
  const synergies = {}; // Key: "PlayerA + PlayerB"

  for (const id in matchesById) {
    const match = matchesById[id];
    if (match.players.length > 1) {
      // Es una partida con amigos (Duo, Trio, Flex...)
      // Generar pares ÃƒÂºnicos
      for (let i = 0; i < match.players.length; i++) {
        for (let j = i + 1; j < match.players.length; j++) {
          const p1 = match.players[i];
          const p2 = match.players[j];

          // Ordenar nombres alfabÃƒÂ©ticamente para consistencia en la key
          const names = [p1.name, p2.name].sort();
          const key = names.join(" & ");

          if (!synergies[key]) {
            synergies[key] = {
              p1: names[0],
              p2: names[1],
              games: 0,
              wins: 0,
              p1_totalPoints: 0,
              p2_totalPoints: 0
            };
          }

          const s = synergies[key];
          s.games++;
          if (p1.result === 'Win') s.wins++; // Si jugaron juntos, el resultado es el mismo
          
          // Asignar puntos a quien corresponda
          if (p1.name === s.p1) { s.p1_totalPoints += p1.points; s.p2_totalPoints += p2.points; }
          else { s.p1_totalPoints += p2.points; s.p2_totalPoints += p1.points; }
        }
      }
    }
  }

  // 3. Formatear resultados para el Front
  const report = [];
  
  for (const key in synergies) {
    const s = synergies[key];
    const winRate = ((s.wins / s.games) * 100).toFixed(1);
    const p1_avg = (s.p1_totalPoints / s.games).toFixed(1);
    const p2_avg = (s.p2_totalPoints / s.games).toFixed(1);

    // Determinar etiqueta de la relaciÃƒÂ³n
    let tag = "Ã°Å¸ËœÂ Normal";
    let tagColor = "#7f8c8d"; // Gris

    if (s.games < 3) {
       tag = "Ã°Å¸â€ â€¢ ReciÃƒÂ©n Conocidos";
    } else {
      if (winRate >= 65) { tag = "Ã°Å¸â€Â¥ Power Couple"; tagColor = "#2ecc71"; }
      else if (winRate <= 35) { tag = "Ã¢ËœÂ£Ã¯Â¸Â TÃƒÂ³xicos Juntos"; tagColor = "#e74c3c"; }
      
      // Detectar mochila (diferencia de puntos grande)
      const diff = Math.abs(p1_avg - p2_avg);
      if (diff > 3.0 && winRate > 45) {
         const carry = Number(p1_avg) > Number(p2_avg) ? s.p1 : s.p2;
         tag = `Ã°Å¸Å½â€™ ${carry} Carrilea`;
         tagColor = "#f1c40f";
      }
    }

    report.push({
      pair: key,
      games: s.games,
      winRate: winRate,
      p1: s.p1,
      p1_avg: p1_avg,
      p2: s.p2,
      p2_avg: p2_avg,
      tag: tag,
      color: tagColor
    });
  }

  // Ordenar por nÃƒÂºmero de partidas
  return report.sort((a, b) => b.games - a.games);
}
/**
 * Ã‚Â¡BONUS! Actualiza un solo jugador (ÃƒÂºtil para testing)
 */
function updateSinglePlayerRank() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Actualizar Rango Individual',
    'Introduce el nombre del jugador (tal como aparece en PLAYERS):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const playerName = response.getResponseText().trim();
  if (!playerName) {
    ui.alert('No introdujiste ningÃƒÂºn nombre.');
    return;
  }

  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName('PLAYERS');
  const data = playersSheet.getDataRange().getValues();

  // Buscar jugador
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === playerName) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    ui.alert('Error', `No se encontrÃƒÂ³ el jugador "${playerName}" en PLAYERS.`, ui.ButtonSet.OK);
    return;
  }

  const puuid = String(data[rowIndex][2]).trim();
  if (!puuid) {
    ui.alert('Error', `El jugador ${playerName} no tiene PUUID asignado.`, ui.ButtonSet.OK);
    return;
  }

  try {
    const apiKey = getApiKey();
    const rankData = getPlayerRankFromAPI(puuid, playerName, apiKey);

    if (rankData) {
      playersSheet.getRange(rowIndex + 1, 9).setValue(rankData.rank);
      playersSheet.getRange(rowIndex + 1, 10).setValue(rankData.lp);
      playersSheet.getRange(rowIndex + 1, 11).setValue(rankData.summonerId);
      
      ui.alert('Ãƒâ€°xito', `${playerName}: ${rankData.rank} (${rankData.lp} LP)`, ui.ButtonSet.OK);
      logToSheet(`Ã¢Å“â€¦ Rango actualizado manualmente: ${playerName} Ã¢â€ â€™ ${rankData.rank}`);
    } else {
      ui.alert('Info', `${playerName} no tiene clasificatoria este split.`, ui.ButtonSet.OK);
    }

  } catch (e) {
    ui.alert('Error', `No se pudo actualizar: ${e.message}`, ui.ButtonSet.OK);
  }
}


/**
 * AÃƒâ€˜ADIR AL MENÃƒÅ¡ (Pega esto en tu funciÃƒÂ³n onOpen)
 */
function onOpenRankingMenu() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('SoloQ Challenge')
    .addSubMenu(ui.createMenu('Ã°Å¸Ââ€  GestiÃƒÂ³n de Rangos')
      .addItem('Actualizar Rangos de Todos', 'updateAllPlayerRanks')
      .addItem('Actualizar Rango Individual', 'updateSinglePlayerRank')
      .addSeparator()
      .addItem('Ã°Å¸â€Â§ Test: Ver respuesta de API', 'testRankAPIResponse'))
    .addToUi();
}


/**
 * DIAGNÃƒâ€œSTICO: Ver quÃƒÂ© devuelve Riot para un jugador especÃƒÂ­fico
 */
function testRankAPIResponse() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Test de API', 'Nombre del jugador:', ui.ButtonSet.OK_CANCEL);
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const name = response.getResponseText().trim();
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName('PLAYERS');
  const data = playersSheet.getDataRange().getValues();
  
  const player = data.find(r => r[0] === name);
  if (!player) {
    ui.alert('Jugador no encontrado');
    return;
  }
  
  const puuid = player[2];
  const apiKey = getApiKey();
  
  try {
    Logger.log(`=== TEST PARA ${name} ===`);
    Logger.log(`PUUID: ${puuid}`);
    
    const sumUrl = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const sumRes = riotFetchJson(sumUrl);
    Logger.log(`Summoner Response: ${JSON.stringify(sumRes)}`);
    
    if (sumRes.id) {
      const leagueUrl = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${sumRes.id}`;
      const leagueRes = riotFetchJson(leagueUrl);
      Logger.log(`League Response: ${JSON.stringify(leagueRes)}`);
      
      ui.alert('Test Completado', 'Revisa los Logs (Ver > Registros) para ver la respuesta completa de Riot.', ui.ButtonSet.OK);
    }
  } catch (e) {
    Logger.log(`ERROR: ${e.message}`);
    ui.alert('Error en el test: ' + e.message);
  }
}


// MEJOR ENFOQUE: Modificar processMatch o syncMatches para actualizar el rango.
// Como Riot requiere el SummonerID (que es diferente al PUUID) para mirar las ligas,
// vamos a aÃƒÂ±adir una funciÃƒÂ³n especÃƒÂ­fica que actualice rangos.
/**
 * Ã‚Â¡NUEVO! REPORTE DE MISIONES DINÃƒÂMICO (v6 - Soporta Hitos Acumulativos)
 * Lee de "MISSIONS" y "MISSION_STATE" para generar un reporte.
 */
function showMissionProgressReport() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  ui.alert("Generando reporte de misiones dinÃƒÂ¡micas...", "Esto puede tardar un momento.", ui.ButtonSet.OK);

  // 1. Cargar datos
  const missions = getMissions(true); // Forzar recarga de misiones
  const playerStates = getMissionStateCache(true); // Forzar recarga de estado
  const players = ss.getSheetByName('PLAYERS').getRange(2, 1, ss.getSheetByName('PLAYERS').getLastRow() - 1, 1).getValues().flat().filter(String);

  if (!missions || missions.length === 0) {
    ui.alert("Error", "No se encontraron misiones en la hoja 'MISSIONS'.", ui.ButtonSet.OK);
    return;
  }

  // 2. Preparar Hoja de Reporte
  let reportSheet = ss.getSheetByName("MISSION_PROGRESS");
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet("MISSION_PROGRESS");
  }

  // 3. Crear Headers dinÃƒÂ¡micos
  const headers = ['Jugador'];
  missions.forEach(m => {
    headers.push(`${m.Descripcion}\n(${m.Dificultad} / ${m.RecompensaPts}pts)`);
  });
  headers.push('Misiones Completadas');
  
  reportSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground("#eeeeee");
  reportSheet.setRowHeight(1, 60); // MÃƒÂ¡s altura para headers
  reportSheet.setColumnWidth(1, 150); // Columna de Jugador
  if (headers.length > 1) {
      reportSheet.setColumnWidths(2, headers.length - 1, 200);
  }
  reportSheet.setFrozenRows(1);
  reportSheet.setFrozenColumns(1);

  // 4. Procesar cada jugador
  const results = [];
  for (const player of players) {
    const playerState = playerStates[player] || {};
    let missionsCompleted = 0;
    const row = [player]; // Columna A: Nombre

    for (const m of missions) {
      const state = playerState[m.MissionID] || { Status: 'InProgress', CurrentValue: '' };
      
      if (state.Status === 'Completed') {
        if (m.Tracking === 'Single') {
          row.push(`Ã¢Å“â€¦ Completado (x${state.CurrentValue || 1})`);
        } else {
          // Ã‚Â¡NUEVO! Mostrar el valor final de las misiones acumulativas
          let finalValue = '';
          if (m.Tipo === 'GAMES_AS_ROLE' || m.Tipo === 'GAMES_AS_CHAMPION' || m.Tipo === 'CUMULATIVE_STAT' || m.Tipo === 'CUMULATIVE_CHALLENGE') {
            finalValue = ` (${state.CurrentValue})`;
          }
          row.push(`Ã¢Å“â€¦ Completado${finalValue}`);
        }
        missionsCompleted++;
      } else {
        // Mostrar progreso
        if (m.Tracking === 'Cumulative') {
          let currentCount = 0;
          // --- LÃƒâ€œGICA ACTUALIZADA ---
          if (m.Tipo === 'GAMES_AS_ROLE' || m.Tipo === 'GAMES_AS_CHAMPION' || m.Tipo === 'CUMULATIVE_STAT' || m.Tipo === 'CUMULATIVE_CHALLENGE') {
            currentCount = parseInt(state.CurrentValue) || 0;
          } 
          // --- FIN LÃƒâ€œGICA ACTUALIZADA ---
          else if (m.Tipo === 'CHAMPION_REGION' || m.Tipo === 'UNIQUE_LANES' || m.Tipo === 'CHAMPION_IN_UNIQUE_LANES' || m.Tipo === 'ONE_CHAMP_ALL_LANES') {
            if (m.Tipo === 'ONE_CHAMP_ALL_LANES') {
                try {
                    let champMap = JSON.parse(state.CurrentValue || '{}');
                    for (const champ in champMap) {
                        if (champMap[champ].length > currentCount) currentCount = champMap[champ].length;
                    }
                } catch(e) { currentCount = 0; }
            } else {
                currentCount = state.CurrentValue ? state.CurrentValue.split(',').filter(Boolean).length : 0;
            }
            // --- FIN DEL REEMPLAZO ---
          }
          row.push(`${currentCount} / ${m.ValorRequerido}`);
        } else {
          row.push('Ã¢ÂÅ’ Pendiente');
        }
      }
    } // Fin bucle de misiones
    
    row.push(`${missionsCompleted} / ${missions.length}`);
    results.push(row);
  } // Fin bucle de jugadores

  // 5. Escribir en la Hoja
  if (results.length > 0) {
    results.sort((a, b) => b[headers.length - 1].localeCompare(a[headers.length - 1])); // Ordenar por "Misiones Completadas"
    reportSheet.getRange(2, 1, results.length, headers.length).setValues(results).setWrap(true);
  }
  
  reportSheet.activate();
  ui.alert("Ãƒâ€°xito", "Se ha generado el reporte 'MISSION_PROGRESS'.", ui.ButtonSet.OK);
}
/* =========================================
   Ã°Å¸Â§Â  ANÃƒÂLISIS DE COMPORTAMIENTO (V12.0)
   Cronotipo + ÃƒÂndice Coinflip
   ========================================= */

function showBehaviorDashboard() {
  const html = HtmlService.createTemplateFromFile('BehaviorDashboard')
      .evaluate()
      .setWidth(1150)
      .setHeight(850)
      .setTitle('Ã°Å¸Â§Â  PsicologÃƒÂ­a de la Grieta: Cronotipos & Coinflips');
  SpreadsheetApp.getUi().showModalDialog(html, 'AnÃƒÂ¡lisis de Comportamiento');
}

function getBehaviorData() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  
  if (!matchesSheet) return { error: "Falta la hoja MATCHES" };

  const data = matchesSheet.getDataRange().getValues();
  // Headers: Date(1), Summoner(2), Result(5), Points(12)
  
  const playersData = {};

  // 1. Procesar Datos
  // Empezamos en 1 para saltar headers
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const date = new Date(row[1]);
    const summ = row[2];
    const result = row[5];
    const points = Number(row[12]);

    if (!playersData[summ]) {
      playersData[summ] = {
        pointsHistory: [],
        timeSlots: {
          'Ã°Å¸Å’â€¦ MaÃƒÂ±ana (06-12)': { games: 0, wins: 0 },
          'Ã¢Ëœâ‚¬Ã¯Â¸Â Tarde (12-20)': { games: 0, wins: 0 },
          'Ã°Å¸Å’â„¢ Noche (20-02)': { games: 0, wins: 0 },
          'Ã°Å¸Â§Å¸ Zombie (02-06)': { games: 0, wins: 0 }
        }
      };
    }

    // A. Datos para Coinflip (Array de puntos)
    if (!isNaN(points)) {
      playersData[summ].pointsHistory.push(points);
    }

    // B. Datos para Cronotipo (Horas)
    const hour = date.getHours();
    let slot = '';
    
    if (hour >= 6 && hour < 12) slot = 'Ã°Å¸Å’â€¦ MaÃƒÂ±ana (06-12)';
    else if (hour >= 12 && hour < 20) slot = 'Ã¢Ëœâ‚¬Ã¯Â¸Â Tarde (12-20)';
    else if (hour >= 20 || hour < 2) slot = 'Ã°Å¸Å’â„¢ Noche (20-02)'; // Nota: hour < 2 cubre 00:00 y 01:00
    // Fix para javascript getHours() que va de 0 a 23:
    if (hour >= 0 && hour < 2) slot = 'Ã°Å¸Å’â„¢ Noche (20-02)'; 
    if (hour >= 2 && hour < 6) slot = 'Ã°Å¸Â§Å¸ Zombie (02-06)';

    if (playersData[summ].timeSlots[slot]) {
      playersData[summ].timeSlots[slot].games++;
      if (result === 'Win') playersData[summ].timeSlots[slot].wins++;
    }
  }

  // 2. Calcular EstadÃƒÂ­sticas Finales
  const coinflipRanking = [];
  const chronoRanking = [];

  for (const summ in playersData) {
    const d = playersData[summ];
    
    // --- CÃƒÂLCULO COINFLIP (DesviaciÃƒÂ³n EstÃƒÂ¡ndar) ---
    const n = d.pointsHistory.length;
    if (n >= 5) { // MÃƒÂ­nimo de partidas para ser estadÃƒÂ­sticamente relevante
      const mean = d.pointsHistory.reduce((a,b) => a+b, 0) / n;
      const variance = d.pointsHistory.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      let tag = "Ã°Å¸ËœÂ EstÃƒÂ¡ndar";
      let color = "#95a5a6";
      
      if (stdDev < 1.8) { tag = "Ã°Å¸â€”Â¿ La Roca"; color = "#27ae60"; } // Muy estable
      else if (stdDev > 5.0) { tag = "Ã°Å¸ÂÂ¥ PsiquiÃƒÂ¡trico"; color = "#8e44ad"; } // Extremo
      else if (stdDev > 3.5) { tag = "Ã°Å¸Å½Â° LudÃƒÂ³pata"; color = "#e74c3c"; } // Coinflip
      else if (stdDev > 2.5) { tag = "Ã°Å¸Å½Â² Arriesgado"; color = "#f39c12"; }

      coinflipRanking.push({
        name: summ,
        avg: mean.toFixed(1),
        volatility: stdDev.toFixed(2),
        tag: tag,
        color: color,
        games: n
      });
    }

    // --- CÃƒÂLCULO CRONOTIPO (Mejor y Peor Hora) ---
    let bestSlot = { name: 'N/A', wr: -1, games: 0 };
    let worstSlot = { name: 'N/A', wr: 101, games: 0 };
    let totalGamesChrono = 0;

    for (const slotName in d.timeSlots) {
      const s = d.timeSlots[slotName];
      totalGamesChrono += s.games;
      if (s.games >= 3) { // MÃƒÂ­nimo 3 partidas en ese horario para considerarlo
        const wr = (s.wins / s.games) * 100;
        
        if (wr > bestSlot.wr) { bestSlot = { name: slotName, wr: wr, games: s.games }; }
        if (wr < worstSlot.wr) { worstSlot = { name: slotName, wr: wr, games: s.games }; }
      }
    }

    if (totalGamesChrono >= 5 && bestSlot.wr !== -1) {
      chronoRanking.push({
        name: summ,
        primeTime: bestSlot.name.split(' ')[1], // Solo el nombre (MaÃƒÂ±ana/Tarde...)
        primeWR: bestSlot.wr.toFixed(0),
        kryptonite: worstSlot.name.split(' ')[1],
        kryptoniteWR: worstSlot.wr.toFixed(0),
        icon: bestSlot.name.split(' ')[0] // El emoji
      });
    }
  }

  // Ordenar: Coinflip por volatilidad (desc), Cronotipo alfabÃƒÂ©tico
  coinflipRanking.sort((a, b) => b.volatility - a.volatility);
  chronoRanking.sort((a, b) => a.name.localeCompare(b.name));

  return { coinflip: coinflipRanking, chrono: chronoRanking };
}


function getPlayerAnalytics(summonerName) {
  try {
    const ss = SpreadsheetApp.getActive();
    const matchesSheet = ss.getSheetByName("MATCHES");
    const manualSheet = ss.getSheetByName("MANUAL_POINTS"); 
    const scoresSheet = ss.getSheetByName("SCORES");
    
    // Puntos y Tier Globales
    let globalPoints = 0;
    let globalTier = 'N/A';
    const scoresData = scoresSheet.getDataRange().getValues();
    for (let i = 1; i < scoresData.length; i++) {
        if (scoresData[i][0] === summonerName) {
            globalPoints = Number(scoresData[i][1] || 0);
            globalTier = scoresData[i][2];
            break;
        }
    }

    // --- Ã°Å¸Å¸Â¢ ESTRUCTURA DE ROLES ---
    const createBaseStats = () => ({
        games: 0, advGames: 0, wins: 0, losses: 0,
        k: 0, d: 0, a: 0, pts: 0,
        gpm: 0, cs: 0, dpm: 0, vspm: 0, turrets: 0,
        champs: new Set(),
        history: [], // Para calcular la racha
        pointEvents: [] // Para el grÃƒÂ¡fico de lÃƒÂ­neas
    });

    const dataMap = {
        ALL: createBaseStats(),
        TOP: createBaseStats(),
        JUNGLE: createBaseStats(),
        MIDDLE: createBaseStats(),
        BOTTOM: createBaseStats(),
        SUPPORT: createBaseStats()
    };

    // --- PROCESAR PARTIDAS ---
    const matchesData = matchesSheet.getDataRange().getValues();
    for (let i = 1; i < matchesData.length; i++) {
      if (matchesData[i][2] === summonerName) {
        const champ = matchesData[i][3];
        const result = matchesData[i][5];
        let role = (matchesData[i][4] || 'UNKNOWN').toUpperCase();
        
        // NormalizaciÃƒÂ³n de roles
        if (role === "UTILITY") role = "SUPPORT";
        if (role === "BOT") role = "BOTTOM";
        if (role === "MID") role = "MIDDLE";
        
        const pts = Number(matchesData[i][12] || 0);
        const date = new Date(matchesData[i][1]);

        const keysToUpdate = ['ALL'];
        if (dataMap[role]) keysToUpdate.push(role);

        // Extraer JSON
        const rawJson = matchesData[i][15];
        let adv = null;
        if (rawJson) {
            try { adv = JSON.parse(rawJson); } catch(e) {}
        }

        keysToUpdate.forEach(k => {
            const s = dataMap[k];
            s.games++;
            if (result === 'Win') s.wins++; else s.losses++;
            s.k += Number(matchesData[i][6] || 0);
            s.d += Number(matchesData[i][7] || 0);
            s.a += Number(matchesData[i][8] || 0);
            s.pts += pts;
            s.champs.add(champ);
            s.history.push({ date: date, res: result });
            s.pointEvents.push({ date: date, pts: pts });

            if (adv) {
                s.advGames++;
                s.gpm += Number(adv.gpm || 0);
                s.cs += Number(adv.csMin || 0);
                s.dpm += Number(adv.dpm || 0);
                s.vspm += Number(adv.vspm || 0);
                s.turrets += Number(adv.dmgTurrets || 0);
            }
        });
      }
    }
    
    // --- PUNTOS MANUALES (Solo al global) ---
    const manualData = manualSheet.getDataRange().getValues();
    for (let i = 1; i < manualData.length; i++) {
        if (manualData[i][1] === summonerName) {
            dataMap['ALL'].pointEvents.push({
                date: new Date(manualData[i][0]),
                pts: Number(manualData[i][2] || 0)
            });
        }
    }

    // --- CÃƒÂLCULOS FINALES ---
    const finalPayload = {};
    const usedRoles = []; // Para pintar el rosco
    const roleColors = { 'TOP':'#10b981', 'JUNGLE':'#ef4444', 'MIDDLE':'#8b5cf6', 'BOTTOM':'#f59e0b', 'SUPPORT':'#3b82f6' };

    for (const k in dataMap) {
        const s = dataMap[k];
        if (k !== 'ALL' && s.games === 0) continue; // Ignorar roles no jugados

        if (k !== 'ALL') usedRoles.push(k);

        s.history.sort((a, b) => a.date - b.date);
        s.pointEvents.sort((a, b) => a.date - b.date);

        // Calcular Racha
        let streak = 0;
        if (s.history.length > 0) {
            const lastRes = s.history[s.history.length - 1].res;
            for (let i = s.history.length - 1; i >= 0; i--) {
                if (s.history[i].res === lastRes) streak++;
                else break;
            }
            if (lastRes === 'Loss') streak = -streak;
        }

        // GrÃƒÂ¡fico de Puntos
        let runPts = 0;
        const chartPoints = [];
        if (s.pointEvents.length > 0) {
            const d0 = new Date(s.pointEvents[0].date.getTime() - 3600000);
            chartPoints.push({ x: d0.toISOString(), y: 0 });
        } else {
            chartPoints.push({ x: new Date().toISOString(), y: 0 });
        }

        s.pointEvents.forEach(ev => {
            runPts += ev.pts;
            chartPoints.push({ x: ev.date.toISOString(), y: runPts.toFixed(2) });
        });

        const g = s.games;
        const ag = s.advGames;

        // Formateo
        finalPayload[k] = {
            points: (k === 'ALL') ? globalPoints.toFixed(1) : s.pts.toFixed(1),
            tier: (k === 'ALL') ? globalTier.toUpperCase() : k,
            winRate: g > 0 ? ((s.wins / g) * 100).toFixed(1) + '%' : '0%',
            record: `${s.wins}V - ${s.losses}D`,
            kdaRatio: s.d > 0 ? ((s.k + s.a) / s.d).toFixed(2) : (s.k + s.a).toFixed(2),
            avgKDA: g > 0 ? `${(s.k/g).toFixed(1)} / ${(s.d/g).toFixed(1)} / ${(s.a/g).toFixed(1)}` : '0 / 0 / 0',
            avgPts: g > 0 ? ((k === 'ALL' ? globalPoints : s.pts) / g).toFixed(2) : '0.00',
            uniqueChamps: s.champs.size,
            streak: streak,
            
            gpm: ag > 0 ? (s.gpm / ag).toFixed(0) : 0,
            cs: ag > 0 ? (s.cs / ag).toFixed(1) : "0.0",
            dpm: ag > 0 ? (s.dpm / ag).toFixed(0) : 0,
            vspm: ag > 0 ? (s.vspm / ag).toFixed(2) : "0.00",
            turrets: ag > 0 ? (s.turrets / ag) : 0,
            
            chartData: chartPoints
        };

        if (finalPayload[k].turrets >= 1000) {
            finalPayload[k].turrets = (finalPayload[k].turrets / 1000).toFixed(1) + "k";
        } else {
            finalPayload[k].turrets = finalPayload[k].turrets.toFixed(0);
        }
    }

    const roleChartData = {
      labels: usedRoles,
      datasets: [{
        data: usedRoles.map(r => dataMap[r].games),
        backgroundColor: usedRoles.map(r => roleColors[r]),
        borderWidth: 0,
        hoverOffset: 4
      }]
    };

    return {
      statsMap: finalPayload, // Ã°Å¸â€˜Ë† Enviamos TODO el mapa completo
      roleChartData: roleChartData
    };

  } catch (e) {
    return { error: e.message };
  }
}

/* =========================================
   Ã°Å¸â€™Â° MÃƒâ€œDULO DE BOLSA (FALTABA ESTO)
   ========================================= */

function SetupMarket() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();

  // 1. Crear Hoja MARKET_STATUS
  if (!ss.getSheetByName('MARKET_STATUS')) {
    const sheet = ss.insertSheet('MARKET_STATUS');
    sheet.getRange('A1:E1').setValues([['Summoner', 'StockPrice', 'Wallet_Gold', 'Trend_Emoji', 'Last_Change']]).setFontWeight('bold');
    // Inicializar con jugadores de PLAYERS
    const pSheet = ss.getSheetByName('PLAYERS');
    if(pSheet) {
      const players = pSheet.getRange(2, 1, pSheet.getLastRow()-1, 1).getValues().flat().filter(String);
      const initData = players.map(p => [p, 100, 1000, 'Ã¢Å¾Â¡Ã¯Â¸Â', 0]);
      if(initData.length > 0) sheet.getRange(2, 1, initData.length, 5).setValues(initData);
    }
  }

  // 2. Crear Hoja PORTFOLIO
  if (!ss.getSheetByName('PORTFOLIO')) {
    const sheet = ss.insertSheet('PORTFOLIO');
    sheet.getRange('A1:D1').setValues([['Investor', 'Target_Stock', 'Shares_Owned', 'Avg_Buy_Price']]).setFontWeight('bold');
  }

  // 3. Crear Hoja TRANSACTIONS
  if (!ss.getSheetByName('TRANSACTIONS')) {
    const sheet = ss.insertSheet('TRANSACTIONS');
    sheet.getRange('A1:F1').setValues([['Date', 'Type', 'Investor', 'Target', 'Amount', 'Price_At_Moment']]).setFontWeight('bold');
  }

  ui.alert('Ã¢Å“â€¦ Setup de Bolsa completado. Se han creado las hojas necesarias.');
}


/* =========================================
   Ã°Å¸â€™Â¸ EJECUCIÃƒâ€œN DE COMERCIO CON IMPACTO DE MERCADO
   ========================================= */

function executeTrade(action, investor, target, amount) {
  const lock = LockService.getScriptLock();
  
  // CAMBIO: Esperar hasta 30 segundos en lugar de fallar a los 5
  try {
      lock.waitLock(30000); 
  } catch (e) {
      return { success: false, msg: "El mercado estÃƒÂ¡ muy ocupado. Intenta en 1 minuto." };
  }
  try {
    // --- Ã¢Å¡â„¢Ã¯Â¸Â CONFIGURACIÃƒâ€œN DE LÃƒÂMITES ---
    const MAX_TOTAL_SUPPLY = 35;   // LÃƒÂ­mite Global
    const MAX_PER_PERSON = 15;     // LÃƒÂ­mite Personal
    
    // --- Ã°Å¸Â§Â¹ LIMPIEZA DE NOMBRES (CRÃƒÂTICO) ---
    // Esto evita el error de "Jugador no encontrado" por culpa de espacios
    const cleanInvestor = String(investor).trim().toLowerCase();
    const cleanTarget = String(target).trim().toLowerCase();

    // 1. Validaciones bÃƒÂ¡sicas (Partida en Vivo)
    // Usamos el nombre original 'target' para buscar PUUID porque esa funciÃƒÂ³n ya limpia dentro
    const targetPuuid = getPuuidFromSheet(target); 
    if (targetPuuid) {
        const liveCheck = getLiveStatus(targetPuuid); 
        if (liveCheck.isLive) {
            return { success: false, msg: `Ã¢â€ºâ€ MERCADO CERRADO: ${target} estÃƒÂ¡ en partida.` };
        }
    }
    if (cleanInvestor === cleanTarget) return { success: false, msg: "Ã¢â€ºâ€ No puedes comerciar contigo mismo." };

    const ss = SpreadsheetApp.getActive();
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const portSheet = ss.getSheetByName('PORTFOLIO');
    const txSheet = ss.getSheetByName('TRANSACTIONS');

    // ConfiguraciÃƒÂ³n EconÃƒÂ³mica
    const IMPACT_FACTOR_BASE = 0.006; 
    const MAX_MOVE_PER_TRADE = 0.1;  
    const MIN_PRICE = 15;             
    let TRADE_FEE = 0.05;             

    // Buscar filas de mercado (USANDO COMPARACIÃƒâ€œN LIMPIA)
    const marketData = marketSheet.getDataRange().getValues();
    let investorRow = -1, targetRow = -1;
    
    for(let i=1; i<marketData.length; i++) {
      const rowName = String(marketData[i][0]).trim().toLowerCase();
      if(rowName === cleanInvestor) investorRow = i + 1;
      if(rowName === cleanTarget) targetRow = i + 1;
    }

    if (investorRow == -1 || targetRow == -1) return { success: false, msg: "Error: Datos no encontrados (Revise espacios en nombres)." };

    let currentPrice = Number(marketSheet.getRange(targetRow, 2).getValue());
    const balance = Number(marketSheet.getRange(investorRow, 3).getValue());
    
    // LEEMOS EL ESTADO ACTUAL
    const currentTrend = String(marketSheet.getRange(targetRow, 4).getValue()); 

    // CÃƒÂ¡lculo de Comisiones (Fees)
    if (currentPrice < 25) TRADE_FEE = 0.30;
    else if (currentPrice < 50) TRADE_FEE = 0.20;

    // Suelo de precio
    if (currentPrice < MIN_PRICE && currentTrend !== 'Ã°Å¸â€â€™') {
        currentPrice = MIN_PRICE;
        marketSheet.getRange(targetRow, 2).setValue(MIN_PRICE);
    }

    // --- Ã°Å¸â€Â ANÃƒÂLISIS DE PORTAFOLIO (CORREGIDO CON TRIM) ---
    const pData = portSheet.getDataRange().getValues();
    let portRow = -1;
    let mySharesOwned = 0;
    let myAvgPrice = 0;
    let totalSharesInCirculation = 0; 

    for(let i=1; i<pData.length; i++) {
        const pTarget = String(pData[i][1]).trim().toLowerCase();
        const pInvestor = String(pData[i][0]).trim().toLowerCase();

        // 1. Calcular CirculaciÃƒÂ³n Total (Sumar todas las acciones de este Target)
        if (pTarget === cleanTarget) {
            totalSharesInCirculation += Number(pData[i][2]);
        }

        // 2. Buscar TU fila especÃƒÂ­fica (Inversor + Target)
        if(pInvestor === cleanInvestor && pTarget === cleanTarget) {
            portRow = i + 1; 
            mySharesOwned = Number(pData[i][2]);
            myAvgPrice = Number(pData[i][3] || 0);
        }
    }

    let rawImpact = amount * IMPACT_FACTOR_BASE;
    let actualImpact = Math.min(rawImpact, MAX_MOVE_PER_TRADE);


    // ==========================================
    // Ã°Å¸Å¸Â¢ COMPRA (BUY)
    // ==========================================
    if (action === 'BUY') {
      
      // 1. BLOQUEO POR BANCARROTA (NUEVO)
      if (currentTrend === 'Ã°Å¸â€â€™') {
          return { success: false, msg: `Ã¢â€ºâ€ MERCADO CERRADO: ${target} estÃƒÂ¡ en bancarrota (<30G). Solo se permiten ventas.` };
      }

      // 2. CHEQUEO DE STOCK GLOBAL
      const remainingSupply = MAX_TOTAL_SUPPLY - totalSharesInCirculation;
      if (amount > remainingSupply) {
          if (remainingSupply <= 0) return { success: false, msg: `Ã¢â€ºâ€ SOLD OUT! No quedan acciones de ${target}.` };
          return { success: false, msg: `Ã¢â€ºâ€ Stock insuficiente. Solo quedan ${remainingSupply} disponibles.` };
      }

      // 3. CHEQUEO DE LÃƒÂMITE PERSONAL
      if ((mySharesOwned + amount) > MAX_PER_PERSON) {
           return { success: false, msg: `Ã¢â€ºâ€ LÃƒÂ­mite personal. MÃƒÂ¡ximo ${MAX_PER_PERSON} acciones por jugador.` };
      }

      const baseCost = currentPrice * amount;
      const fee = baseCost * TRADE_FEE;
      const totalCost = baseCost + fee;

      if (balance < totalCost) return { success: false, msg: `Saldo insuficiente. Coste: ${totalCost.toFixed(0)} G.` };
      
      // Cobrar
      marketSheet.getRange(investorRow, 3).setValue(balance - totalCost);

      // Actualizar Portafolio
      if (portRow !== -1) {
          let totalValueOld = mySharesOwned * (myAvgPrice === 0 ? currentPrice : myAvgPrice);
          let totalValueNew = amount * currentPrice;
          let newAvgPrice = (totalValueOld + totalValueNew) / (mySharesOwned + amount);

          portSheet.getRange(portRow, 3).setValue(mySharesOwned + amount);
          portSheet.getRange(portRow, 4).setValue(newAvgPrice);
      } else {
          portSheet.appendRow([investor, target, amount, currentPrice]); 
      }

      // Impacto Subida
      let newPrice = currentPrice * (1 + actualImpact);
      marketSheet.getRange(targetRow, 2).setValue(newPrice);
      
      let percentChange = ((newPrice - currentPrice) / currentPrice) * 100;

      // --- CAMBIO AQUÃƒÂ: CondiciÃƒÂ³n por cantidad (>= 10 acciones) ---
      if (amount >= 10) {
        registerNews("WHALE", `Ã°Å¸Ââ€¹ Ã‚Â¡Ballena! Compra fuerte mueve a ${target} (+${percentChange.toFixed(1)}%)`);
      }
      // -------------------------------------------------------------

      if(txSheet) txSheet.appendRow([new Date(), 'BUY', investor, target, amount, -totalCost]);
      
      const stockLeft = remainingSupply - amount;
      return { success: true, msg: `Compraste ${amount} de ${target}. (Quedan ${stockLeft})` };
    }


    // ==========================================
    // Ã°Å¸â€Â´ VENTA (SELL)
    // ==========================================
    if (action === 'SELL') {
      if (mySharesOwned < amount) return { success: false, msg: "No tienes suficientes acciones." };

      const baseGain = currentPrice * amount;
      const fee = baseGain * TRADE_FEE;
      const totalGain = baseGain - fee; 

      // Pagar
      marketSheet.getRange(investorRow, 3).setValue(balance + totalGain);

      // Quitar acciones
      if (mySharesOwned - amount <= 0) {
        portSheet.deleteRow(portRow);
      } else {
        portSheet.getRange(portRow, 3).setValue(mySharesOwned - amount);
      }

      // Impacto Bajada
      let newPrice = currentPrice * (1 - actualImpact);
      
      // Respetar mÃƒÂ­nimos (si estÃƒÂ¡ en bancarrota puede bajar hasta 1, si no, mÃƒÂ­nimo 10)
      if (currentTrend !== 'Ã°Å¸â€â€™' && newPrice < MIN_PRICE) newPrice = MIN_PRICE;
      if (currentTrend === 'Ã°Å¸â€â€™' && newPrice < 1) newPrice = 1;
      
      marketSheet.getRange(targetRow, 2).setValue(newPrice);

      let percentDrop = ((currentPrice - newPrice) / currentPrice) * 100;
      if (percentDrop > 2.9) {
        registerNews("DUMP", `Ã°Å¸â€œâ€° Venta fuerte de ${target} (-${percentDrop.toFixed(1)}%)`);
      }

      if(txSheet) txSheet.appendRow([new Date(), 'SELL', investor, target, amount, totalGain]);
      
      return { success: true, msg: `Vendiste ${amount} de ${target}.` };
    }

  } catch(e) {
    return { success: false, msg: "Error crÃƒÂ­tico: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

/* --- NUEVA FUNCIÃƒâ€œN PARA HISTORIAL --- */
function getUserHistory(username) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('TRANSACTIONS');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  // Headers: Date, Type, Investor, Target, Amount, Price
  // Filtramos las filas donde Investor sea el usuario
  const history = data.slice(1).filter(r => r[2] === username).map(r => ({
    date: new Date(r[0]).toLocaleDateString() + ' ' + new Date(r[0]).toLocaleTimeString(),
    type: r[1],
    target: r[3],
    amount: r[4],
    price: r[5],
    total: (r[4] * r[5]).toFixed(0)
  }));
  
  // Devolver las mÃƒÂ¡s recientes primero
  return history.reverse();
}

// ==========================================
// 1. LEER DATOS DEL MERCADO (VERSIÃƒâ€œN PRO v3.0)
// ==========================================
function getMarketData() {
  const ss = SpreadsheetApp.getActive();
  
  // Referencias a las hojas (AsegÃƒÂºrate de que los nombres coincidan exactamente)
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const newsSheet = ss.getSheetByName('MARKET_NEWS');
  const portSheet = ss.getSheetByName('PORTFOLIO'); 
  const sponsorSheet = ss.getSheetByName('SPONSORSHIPS');
  const playersSheet = ss.getSheetByName('PLAYERS');
  const transSheet = ss.getSheetByName('TRANSACTIONS'); // Ã°Å¸â€ â€¢ Necesaria para dividendos
  
  // Si no existe la hoja principal, devolvemos estructura vacÃƒÂ­a para evitar crash
  if (!marketSheet) return { stocks: [], wallets: {}, news: [], forbes: [], shame: [], topStocks: [], flopStocks: [] };

  const MAX_SUPPLY = 30; 

  // --- HELPER: CONVERTIR A NÃƒÅ¡MERO SEGURO ---
  // Convierte cualquier basura (#NUM!, texto, vacio) en un nÃƒÂºmero o 0.
  const safeNum = (val, def = 0) => {
      if (val === "#NUM!" || val === "#DIV/0!" || val === "#VALUE!") return def;
      const n = Number(val);
      return (isNaN(n) || val === "") ? def : n;
  };

  // ----------------------------------------------------
  // 1. CALCULAR ACCIONES EN CIRCULACIÃƒâ€œN (Supply)
  // ----------------------------------------------------
  const circulationMap = {};
  if (portSheet && portSheet.getLastRow() > 1) {
     // Leemos columnas B (Target) y C (Amount)
     const pData = portSheet.getRange(2, 2, portSheet.getLastRow()-1, 2).getValues();
     pData.forEach(row => {
        const target = String(row[0]).trim(); 
        const amount = safeNum(row[1], 0);
        if (!circulationMap[target]) circulationMap[target] = 0;
        circulationMap[target] += amount;
     });
  }

  // ----------------------------------------------------
  // 2. MAPEO DE NOMBRES REALES (Display Names)
  // ----------------------------------------------------
  const playerNamesMap = {};
  if (playersSheet && playersSheet.getLastRow() > 1) {
       // Asumimos Col A = ID, Col M (indice 12) = DisplayName
       const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 13).getValues(); 
       pData.forEach(row => {
          const id = row[0];
          const display = (row[12] || '').toString().trim();
          playerNamesMap[id] = display || id; 
       });
  }

  // ----------------------------------------------------
  // 3. PROCESAR STOCKS Y CARTERAS INICIALES
  // ----------------------------------------------------
  const lastRow = marketSheet.getLastRow();
  const stocks = []; 
  const wallets = {};  
  const netWorthMap = [];

  if (lastRow > 1) {
      // Leemos hasta la columna I (9) por seguridad
      const data = marketSheet.getRange(2, 1, lastRow - 1, 9).getValues();
      
      data.forEach(r => {
        if (r[0]) { // Si hay nombre en columna A
            const name = String(r[0]).trim();
            const price = safeNum(r[1], 10);        // Col B: Precio
            const walletBalance = safeNum(r[2], 1000); // Col C: Saldo
            const trend = r[3] || 'Ã¢Å¾Â¡Ã¯Â¸Â';             // Col D: Emoji
            const change = safeNum(r[4], 0);        // Col E: Cambio ÃƒÅ¡ltima Partida

            // Inicializamos la cartera del usuario
            wallets[name] = { 
                balance: walletBalance, 
                portfolio: {}, 
                stockValue: 0, 
                activeSponsors: [],
                totalDividends: 0, // Ã°Å¸â€ â€¢ Acumulado de dividendos
                dailyPL: 0         // Ã°Å¸â€ â€¢ Ganancia/PÃƒÂ©rdida diaria teÃƒÂ³rica
            };

            // FILTRO: Si NO es Broker, es una acciÃƒÂ³n comprable
            if (trend !== 'Ã°Å¸â€™Â¼') {
                
                // Blindaje del Historial JSON (Col F)
                let history = [];
                try { 
                    history = JSON.parse(r[5]); 
                    if (!Array.isArray(history) || history.some(h => isNaN(Number(h)))) throw new Error("JSON Corrupto");
                } catch(e) { 
                    // Si falla, historial plano de emergencia
                    history = [price, price, price, price]; 
                }

                // CÃƒÂ¡lculo de Stock Disponible
                const used = circulationMap[name] || 0;
                let available = MAX_SUPPLY - used;
                if (available < 0) available = 0;

                // Disponibilidad Manual (Col G, opcional)
                const manualAvail = safeNum(r[6], -1);
                if (manualAvail >= 0) available = manualAvail;

                stocks.push({
                  name: name,
                  displayName: playerNamesMap[name] || name,
                  price: price,
                  wallet: walletBalance,
                  trend: trend,
                  lastChange: change,
                  history: history,
                  isLive: false,
                  liveTime: "",
                  available: available
                });
            }
        }
      });
  }
  
  // ----------------------------------------------------
  // 4. CALCULAR PORTFOLIO + TENDENCIA DIARIA (Daily P/L)
  // ----------------------------------------------------
  if (portSheet && portSheet.getLastRow() > 1) {
      const portData = portSheet.getRange(2, 1, portSheet.getLastRow()-1, 4).getValues();
      
      portData.forEach(row => {
        const investor = row[0];
        const target = row[1];
        const amount = safeNum(row[2], 0);
        const avgPrice = safeNum(row[3], 0);

        if (wallets[investor]) {
           // Inicializar slot en portfolio
           if (!wallets[investor].portfolio[target]) {
               wallets[investor].portfolio[target] = { amount: 0, avgPrice: 0 };
           }
           // Actualizar datos
           wallets[investor].portfolio[target].amount = amount; 
           wallets[investor].portfolio[target].avgPrice = avgPrice;

           // Valorar al precio actual
           const s = stocks.find(st => st.name === target);
           let currentVal = 0;
           
           if(s) {
               currentVal = amount * s.price;
               
               // Ã°Å¸â€ â€¢ CÃƒÂLCULO DE TENDENCIA (Daily P/L)
               // (Cantidad * Cambio de precio hoy)
               // Ejemplo: Tienes 10 acciones, subiÃƒÂ³ 5g -> Ganaste 50g hoy.
               wallets[investor].dailyPL += (amount * s.lastChange); 

           } else if (target === 'Broker') { 
               // Acciones especiales valen 1G
               currentVal = amount * 1; 
           }
           
           wallets[investor].stockValue += currentVal;
        }
      });
  }

  // ----------------------------------------------------
  // 5. CARGAR DIVIDENDOS HISTÃƒâ€œRICOS Ã°Å¸â€ â€¢
  // ----------------------------------------------------
  if (transSheet && transSheet.getLastRow() > 1) {
      // Asumimos: Col B=Usuario, Col C=Tipo, Col D=Monto
      const tData = transSheet.getRange(2, 1, transSheet.getLastRow()-1, 5).getValues();
      
      tData.forEach(row => {
          const user = row[1]; 
          const type = String(row[2]).toUpperCase(); 
          const amount = safeNum(row[3], 0);

          // Si es un dividendo o pago del sistema, lo sumamos al histÃƒÂ³rico
          if (wallets[user] && (type === 'DIVIDEND' || type === 'PAYOUT' || type.includes('PASSIVE'))) {
              wallets[user].totalDividends += amount;
          }
      });
  }

  // ----------------------------------------------------
  // 6. CARGAR APADRINAMIENTOS
  // ----------------------------------------------------
  if (sponsorSheet && sponsorSheet.getLastRow() > 1) {
       const sData = sponsorSheet.getRange(2, 1, sponsorSheet.getLastRow()-1, 4).getValues();
       sData.forEach(row => {
           if (row[3] === 'ACTIVE' && wallets[row[0]]) {
               wallets[row[0]].activeSponsors.push({ 
                   target: row[1], 
                   amount: safeNum(row[2], 0) 
               });
           }
       });
   }

  // ----------------------------------------------------
  // 7. GENERAR RANKINGS (Filtrados)
  // ----------------------------------------------------
  for (const investor in wallets) {
    // Solo mostramos en ranking a los que son Jugadores (estÃƒÂ¡n en stocks)
    // Esto oculta Brokers, Bancos, etc.
    const isPlayer = stocks.some(s => s.name === investor); 
    
    if (isPlayer) { 
       const w = wallets[investor];
       netWorthMap.push({ 
           name: investor, 
           netWorth: w.balance + w.stockValue,
           // Ã°Å¸â€ â€¢ Enviamos los datos nuevos al frontend
           dailyPL: w.dailyPL,
           totalDividends: w.totalDividends
       });
    }
  }

  // Ordenar Forbes (Mayor a Menor)
  netWorthMap.sort((a, b) => b.netWorth - a.netWorth);
  const forbes = netWorthMap.slice(0, 5);
  
  // Ordenar Shame (Menor a Mayor)
  const shameList = [...netWorthMap].sort((a, b) => a.netWorth - b.netWorth);
  const shame = shameList.slice(0, 3);

  // ----------------------------------------------------
  // 8. NOTICIAS
  // ----------------------------------------------------
  let news = [];
  if (newsSheet && newsSheet.getLastRow() > 1) {
    // ÃƒÅ¡ltimas 10 noticias
    const startRow = Math.max(2, newsSheet.getLastRow() - 9); 
    const numRows = newsSheet.getLastRow() - startRow + 1;
    const newsData = newsSheet.getRange(startRow, 1, numRows, 3).getValues();
    
    news = newsData.reverse().map(n => {
      let dateStr = "Hoy";
      try { dateStr = new Date(n[0]).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}); } catch(e) {}
      return { date: dateStr, type: String(n[1]), msg: String(n[2]) };
    });
  }

  // ----------------------------------------------------
  // 9. RANKING DE PRECIOS
  // ----------------------------------------------------
  let sortedStocks = [...stocks].sort((a, b) => b.price - a.price);
  const topStocks = sortedStocks.slice(0, 5);
  
  // Flop: Los mÃƒÂ¡s baratos (filtrando los que valen 0/quebrados)
  let cheapStocks = sortedStocks.filter(s => s.price > 1).sort((a,b) => a.price - b.price);
  const flopStocks = cheapStocks.slice(0, 5);

  return { 
      stocks: stocks, 
      wallets: wallets, 
      news: news, 
      forbes: forbes, 
      shame: shame, 
      topStocks: topStocks, 
      flopStocks: flopStocks 
  };
}

/* =========================================
   Ã°Å¸â€™Â¸ ALGORITMO DE PRECIOS V2.1 (STABLE MARKET)
   Ajustado para reducir volatilidad y evitar economÃƒÂ­a rota.
   ========================================= */
function updateStockPrice(summonerName, pointsEarned) {
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const portSheet = ss.getSheetByName('PORTFOLIO'); 
  const txSheet = ss.getSheetByName('TRANSACTIONS');

  if (!marketSheet) return 0;

  const data = marketSheet.getDataRange().getValues();
  let rowIndex = -1;
  const searchName = String(summonerName).trim().toLowerCase();

  // 1. BUSCAR JUGADOR
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === searchName) { 
        rowIndex = i + 1; 
        break; 
    }
  }

  if (rowIndex !== -1) {
    // --- LECTURA DE DATOS ACTUALES ---
    const currentPrice = Number(marketSheet.getRange(rowIndex, 2).getValue());
    const currentTrend = String(marketSheet.getRange(rowIndex, 4).getValue()); 
    const pName = data[rowIndex-1][0]; 

    // Ã¢â€ºâ€ BLOQUEO DE SEGURIDAD: Si es un Broker (Ã°Å¸â€™Â¼), no tocamos nada.
    if (currentTrend === 'Ã°Å¸â€™Â¼') return 0;

    // ============================================================
    // Ã°Å¸Â§Â® CÃƒÂLCULO FINANCIERO (AJUSTADO: BAJA VOLATILIDAD)
    // ============================================================
    
    // A. Expectativa del Mercado (Yield)
    // Subimos la exigencia un poco (del 4% al 5%). 
    // Cuanto mÃƒÂ¡s cara es la acciÃƒÂ³n, mÃƒÂ¡s cuesta mantenerla.
    const marketExpectation = currentPrice * 0.04; 
    
    // B. Diferencial de Rendimiento
    const performanceDiff = pointsEarned - marketExpectation;

    // C. CÃƒÂ¡lculo Base de Cambio (EL CAMBIO PRINCIPAL ESTÃƒÂ AQUÃƒÂ)
    // AHORA: performanceDiff * 0.8 (Movimiento lento y estable)
    let priceChange = performanceDiff * 0.8; 

    // --- AJUSTE 1: PENNY STOCKS (Acciones baratas) ---
    // Antes se multiplicaba x1.5. Lo bajamos a x1.2 para que no sea tan fÃƒÂ¡cil explotarlas.
    if (currentPrice < 50) {
        priceChange = priceChange * 1.2; 
    }

    // --- AJUSTE 2: MOMENTUM (INERCIA) ---
    // Mantenemos el hype/pÃƒÂ¡nico pero reducido (x1.1 en vez de x1.2)
    if (priceChange > 0 && (currentTrend === 'Ã°Å¸Å¡â‚¬' || currentTrend === 'Ã°Å¸â€œË†')) {
        priceChange = priceChange * 1.1; 
    } else if (priceChange < 0 && (currentTrend === 'Ã°Å¸â€œâ€°' || currentTrend === 'Ã°Å¸â€Â»')) {
        priceChange = priceChange * 1.1; 
    }

    // --- AJUSTE 3: CIRCUIT BREAKERS (TOPES DE SEGURIDAD) ---
    // AHORA: 15% (MÃƒÂ¡ximo movimiento permitido por partida)
    const maxSwing = currentPrice * 0.15; 
    if (priceChange > maxSwing) priceChange = maxSwing;
    if (priceChange < -maxSwing) priceChange = -maxSwing;

    // D. Precio Final
    let newPrice = currentPrice + priceChange;
    
    // Suelo tÃƒÂ©cnico de 1 Gold (Nunca puede valer 0 o negativo)
    if (newPrice < 1) newPrice = 1; 


    // ============================================================
    // Ã°Å¸â€œâ€° LÃƒâ€œGICA DE ESTADOS (BANCARROTA / CONGELACIÃƒâ€œN)
    // ============================================================
    let trend = 'Ã¢Å¾Â¡Ã¯Â¸Â';
    const IS_FROZEN = (currentTrend === 'Ã°Å¸â€â€™'); 

    // CASO A: NUEVA BANCARROTA (Cae a 15 o menos y NO estaba congelado)
    if (!IS_FROZEN && newPrice <= 20) {
        trend = 'Ã°Å¸â€â€™'; 
        
        // EXPROPIACIÃƒâ€œN (Wipe de inversores)
        if (portSheet) {
            const pData = portSheet.getDataRange().getValues();
            for (let i = pData.length - 1; i >= 1; i--) { // Loop inverso para borrar
                if (String(pData[i][1]) === pName) {
                    const investor = pData[i][0];
                    const shares = pData[i][2];
                    portSheet.deleteRow(i + 1); 
                    
                    if (txSheet) txSheet.appendRow([new Date(), 'BANKRUPTCY_LOSS', investor, pName, shares, 0]);
                }
            }
        }
        registerNews('CRASH', `Ã°Å¸â€™â‚¬ Ã‚Â¡QUIEBRA! ${pName} cae a ${newPrice.toFixed(1)}G. Acciones eliminadas. Mercado CERRADO hasta recuperar 30G.`);
    }
    
    // CASO B: INTENTO DE RECUPERACIÃƒâ€œN (EstÃƒÂ¡ congelado)
    else if (IS_FROZEN) {
        if (newPrice > 40) {
            trend = 'Ã°Å¸Å’Â±'; // Renacer
            registerNews('HYPE', `Ã°Å¸â€â€œ Ã‚Â¡RESURRECCIÃƒâ€œN! ${pName} supera los 30G. Se reabre la compra.`);
        } else {
            trend = 'Ã°Å¸â€â€™'; // Sigue congelado
            if (pointsEarned > 10) registerNews('INFO', `Ã¢â€ºâ€œÃ¯Â¸Â ${pName} lucha por salir de la quiebra (${newPrice.toFixed(1)}G / 30G).`);
        }
    }
    
    // CASO C: MERCADO NORMAL (AsignaciÃƒÂ³n de Iconos segÃƒÂºn % de cambio)
    else {
        const percentChange = (priceChange / currentPrice) * 100;

        if (percentChange >= 25) trend = 'Ã°Å¸Å¡â‚¬';        // Subida fuerte (ajustado al nuevo lÃƒÂ­mite)
        else if (percentChange >= 10) trend = 'Ã°Å¸â€œË†';    // Subida normal
        else if (percentChange <= -25) trend = 'Ã°Å¸â€œâ€°';  // CaÃƒÂ­da fuerte
        else if (percentChange <= -10) trend = 'Ã°Å¸â€Â»';   // CaÃƒÂ­da normal
        else trend = 'Ã¢Å¾Â¡Ã¯Â¸Â';                            // Estabilidad

        // Noticias de alto impacto
        if (percentChange >= 14) registerNews('HYPE', `Ã‚Â¡${pName} vuela alto! +${priceChange.toFixed(1)}G (${percentChange.toFixed(0)}%)`);
        else if (percentChange <= -14) registerNews('PANIC', `DESPLOME: ${pName} pierde -${Math.abs(priceChange).toFixed(1)}G (${percentChange.toFixed(0)}%).`);
    }

    
    // ============================================================
    // Ã°Å¸â€™Â¾ GUARDADO DE DATOS
    // ============================================================
    
    // Historial JSON (Para grÃƒÂ¡ficas)
    let history = [];
    let historyJSON = marketSheet.getRange(rowIndex, 6).getValue();
    try { history = JSON.parse(historyJSON); } catch(e) { history = []; }
    
    history.push(Number(newPrice.toFixed(1)));
    if (history.length > 30) history.shift(); // Guardamos ÃƒÂºltimos 30 puntos

    // Escribir en hoja
    marketSheet.getRange(rowIndex, 2).setValue(Number(newPrice.toFixed(2))); // Precio
    marketSheet.getRange(rowIndex, 4).setValue(trend); // Tendencia
    marketSheet.getRange(rowIndex, 5).setValue(Number(priceChange.toFixed(2))); // Cambio exacto
    marketSheet.getRange(rowIndex, 6).setValue(JSON.stringify(history)); // Historial

    return priceChange;
  } else {
      logToSheet(`ERROR: No se encontrÃƒÂ³ a ${summonerName} en el mercado.`);
      return 0;
  }
}

function generateAsciiTable(rankingData) {
  let table = "```prolog\n";
  table += "POS | JUGADOR         | PUNTOS | RACHA\n";
  table += "----|-----------------|--------|------\n";
  
  rankingData.slice(0, 10).forEach((p, i) => {
    const pos = (i + 1).toString().padEnd(3);
    const name = p.name.padEnd(15);
    const pts = p.points.toString().padEnd(6);
    const streak = p.streak > 0 ? `+${p.streak}Ã°Å¸â€Â¥` : `${p.streak}Ã¢Ââ€žÃ¯Â¸Â`;
    
    table += `${pos} | ${name} | ${pts} | ${streak}\n`;
  });
  
  table += "```";
  return table;
}

// Helper para obtener precio rÃƒÂ¡pido (VERSIÃƒâ€œN CORREGIDA)
function getStockPriceSimple(summonerName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MARKET_STATUS');
  if (!sheet) return 100;
  
  // Normalizamos para evitar errores de mayÃƒÂºsculas o espacios
  const searchName = String(summonerName).trim().toLowerCase();

  // Leemos los datos
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    // IMPORTANTE: data[i][0] es la celda del nombre. 
    // Antes comparabas data[i] (toda la fila) con el nombre, por eso fallaba.
    const rowName = String(data[i][0]).trim().toLowerCase();
    
    if (rowName === searchName) {
      return Number(data[i][1]); // Devolvemos el precio (Columna B)
    }
  }
  return 100; // Precio por defecto si no se encuentra
}

/* ==========================================================
   Ã°Å¸â€™Â¸ SISTEMA DE DIVIDENDOS V3.0 (YIELD DINÃƒÂMICO + JUNTA DIRECTIVA)
   ========================================================== */
function distributeDividends(player, pointsScored, label) {
  const ss = SpreadsheetApp.getActive();
  const portSheet = ss.getSheetByName('PORTFOLIO');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const txSheet = ss.getSheetByName('TRANSACTIONS');

  if (!portSheet || !marketSheet) return;

  const marketData = marketSheet.getDataRange().getValues();
  const investorMap = {}; 
  let playerRowIdx = -1;  

  // Mapear filas para escritura rÃƒÂ¡pida
  for(let i=1; i<marketData.length; i++) {
    investorMap[marketData[i][0]] = i + 1; 
    if (marketData[i][0] === player) playerRowIdx = i + 1;
  }

  if (playerRowIdx === -1) return;

  // --- 1. CÃƒÂLCULO DEL YIELD (RENTABILIDAD) ---
  // FÃƒÂ³rmula: 15% de los Puntos de la partida convertidos a Oro.
  // Ej: 60 Pts -> 9.0 G por acciÃƒÂ³n.
  let dividendPerShare = pointsScored * 0.25;
  
  // LÃƒÂ­mites de seguridad econÃƒÂ³mica
  if (dividendPerShare > 15) dividendPerShare = 15; // Cap mÃƒÂ¡ximo por acciÃƒÂ³n
  if (dividendPerShare < 1) dividendPerShare = 1;   // MÃƒÂ­nimo 1G

  const portData = portSheet.getDataRange().getValues();
  let totalPayout = 0; 

  // --- 2. REPARTO A LOS ACCIONISTAS ---
  for (let i = 1; i < portData.length; i++) {
    const investor = portData[i][0];
    const target = portData[i][1];
    const shares = Number(portData[i][2]);

    if (target === player && shares > 0) {
      
      // Ã°Å¸â€˜â€ BONUS JUNTA DIRECTIVA (INNOVACIÃƒâ€œN)
      // Si tienes 10+ acciones, eres "Socio Mayoritario" y cobras un 10% mÃƒÂ¡s.
      let bonusMult = 1.0;
      let isWhale = false;
      
      if (shares >= 10) {
          bonusMult = 1.10;
          isWhale = true;
      }

      // CÃƒÂ¡lculo final para este inversor
      const payout = Math.floor(shares * dividendPerShare * bonusMult);
      const rowIdx = investorMap[investor];
      
      if (rowIdx) {
        const currentBalance = Number(marketSheet.getRange(rowIdx, 3).getValue());
        marketSheet.getRange(rowIdx, 3).setValue(currentBalance + payout);
        
        // Registrar en Historial
        if (txSheet) {
            let txNote = label;
            if (isWhale) txNote += " (Bonus Directiva +10%)";
            txSheet.appendRow([new Date(), 'DIVIDEND', investor, player, shares, payout]); // Guardamos payout total
        }
        
        totalPayout += payout;
      }
    }
  }

  // --- 3. EFECTO EX-DIVIDEND (AJUSTE DE MERCADO) ---
  // Si se ha repartido dinero real, la acciÃƒÂ³n corrige su precio.
  // Baja la mitad de lo pagado por acciÃƒÂ³n (Soft Correction).
  if (totalPayout > 0) {
    const currentPrice = Number(marketSheet.getRange(playerRowIdx, 2).getValue());
    let drop = dividendPerShare * 1.0;
    let newPrice = Math.max(1, currentPrice - drop);
    
    marketSheet.getRange(playerRowIdx, 2).setValue(newPrice);
    
    // Noticia pÃƒÂºblica
    if (typeof registerNews === 'function') {
        registerNews('DIVIDEND', `Ã°Å¸â€™Â¸ ${player} reparte ${dividendPerShare.toFixed(2)} G/acciÃƒÂ³n. Motivo: ${label}.`);
    }
  }
}

// 4. NUEVA: REGISTRAR NOTICIAS
function registerNews(type, message) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MARKET_NEWS');
  if (sheet) {
    sheet.appendRow([new Date(), type, message]);
  }
}

/* =========================================
   Ã°Å¸ÂÂª SISTEMA DE TIENDA E INVENTARIO
   ========================================= */

// 1. Setup Inicial (Ejecutar una vez)
function SetupShop() {
  const ss = SpreadsheetApp.getActive();
  
  // Hoja de Inventario (QuiÃƒÂ©n tiene quÃƒÂ©)
  if (!ss.getSheetByName('INVENTORY')) {
    const sheet = ss.insertSheet('INVENTORY');
    sheet.getRange('A1:D1').setValues([['Player', 'ItemID', 'Status', 'DateBought']]).setFontWeight('bold');
  }
  
  // Hoja de CatÃƒÂ¡logo (QuÃƒÂ© se vende) - Lo creamos y rellenamos automÃƒÂ¡ticamente
  let shopSheet = ss.getSheetByName('SHOP_ITEMS');
  if (!shopSheet) {
    shopSheet = ss.insertSheet('SHOP_ITEMS');
    shopSheet.getRange('A1:E1').setValues([['ItemID', 'Name', 'Description', 'Price', 'Icon']]).setFontWeight('bold');
    
    const items = [
      ['POTION_ELO', 'PociÃƒÂ³n de Elo', 'Multiplica x1.25 los puntos de tu prÃƒÂ³xima victoria.', 1200, 'Ã°Å¸Â§Âª'],
      ['ANGEL_GUARD', 'ÃƒÂngel de la Guarda', 'Te protege de puntos negativos (convierte -X en 0).', 2000, 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â'],
      ['SOBORNO', 'El Soborno', 'AÃƒÂ±ade +2 puntos base a tu prÃƒÂ³xima partida.', 600, 'Ã°Å¸â€™Â°'],
      ['FIRST_DRAGON', 'ÃƒÅ¡ltimo DragÃƒÂ³n', 'Apuesta al Primer DragÃƒÂ³n: +4 si es tuyo, -4 si es del rival.', 900, 'Ã°Å¸Ââ€°'],
      ['PACT_STREAK', 'Pacto de Win Streak', 'Apuesta de Racha: 2 Wins seguidas = +6 pts. Perder = -3 pts.', 650, 'Ã°Å¸â€Â¥'],
      ['BET_FIRST_BLOOD', 'Apuesta de Sangre', 'Si TÃƒÅ¡ haces la Primera Sangre: +3 pts. Si no: -1 pt.', 550, 'Ã°Å¸Â©Â¸']
    ];
    shopSheet.getRange(2, 1, items.length, 5).setValues(items);
  }
  Logger.log("Ã¢Å“â€¦ Sistema de Tienda configurado.");
}
// -------------------------------------------------------
// NUEVA FUNCIÃƒâ€œN: DATOS PARA LA PESTAÃƒâ€˜A DE MISIONES (MEDALLERO)
// -------------------------------------------------------
function getMissionsForWeb(player) {
  // 1. Cargamos las definiciones y el estado guardado
  const allMissions = getMissions(); 
  const allStates = getMissionStateCache(); 
  const playerStates = allStates[player] || {};

  return allMissions.map(m => {
    // Variables base
    let state = playerStates[m.MissionID] || { Status: 'InProgress', CurrentValue: 0 };
    let isCompleted = state.Status === 'Completed';
    let progress = 0;
    let customDesc = m.Objetivo; // DescripciÃƒÂ³n por defecto

    // -----------------------------------------------------
    // Ã°Å¸Å’Å  BLOQUE ESPECIAL: CHAMPION OCEAN
    // Si la misiÃƒÂ³n es la de los campeones, ignoramos el cache y calculamos en vivo
    // -----------------------------------------------------
    if (String(m.MissionID).toUpperCase().includes('OCEAN')) {
      // Llamamos a tu funciÃƒÂ³n auxiliar que lee la hoja KNOWN_CHAMPS
      const oceanData = getChampOceanStatus(player);
      
      // Sobrescribimos los valores
      progress = oceanData.percent;
      isCompleted = progress >= 100;
      
      // Actualizamos la descripciÃƒÂ³n para que muestre la cuenta real (Ej: "Llevas: 33")
      customDesc = `${m.Objetivo} (Llevas: ${oceanData.count})`;
    } 
    // -----------------------------------------------------
    // Ã¢Å¡â„¢Ã¯Â¸Â BLOQUE ESTÃƒÂNDAR (Para el resto de misiones)
    // -----------------------------------------------------
    else {
      if (m.Tracking === 'Cumulative' && m.ValorRequerido > 0) {
         // Intentamos parsear el valor actual
         let val = 0;
         if (!isNaN(state.CurrentValue)) {
             val = Number(state.CurrentValue);
         } else if (typeof state.CurrentValue === 'string') {
             // Si es una lista (ej: regiones), contamos elementos
             val = state.CurrentValue.split(',').filter(Boolean).length;
         }
         progress = Math.min(100, (val / m.ValorRequerido) * 100);
      } else {
         progress = isCompleted ? 100 : 0;
      }
    }

    // -----------------------------------------------------
    // Ã°Å¸Ââ€¦ LÃƒâ€œGICA VISUAL (IMÃƒÂGENES Y TÃƒÂTULOS)
    // -----------------------------------------------------
    let medalImage = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/medals/theme-1-tier-1.png"; 
    let titleReward = "Recluta";

    if (m.Dificultad === 'Media') {
        medalImage = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/medals/theme-1-tier-2.png";
        titleReward = "Veterano";
    } else if (m.Dificultad === 'DifÃƒÂ­cil') {
        medalImage = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/medals/theme-1-tier-3.png";
        titleReward = "Elite";
    } else if (m.Dificultad === 'Extrema' || Number(m.RecompensaPts) >= 5) {
        medalImage = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/rewards/medals/theme-1-tier-4.png";
        titleReward = "Leyenda";
    }

    // Retorno de datos limpios para el HTML
    return {
      id: m.MissionID,
      name: m.Descripcion, // Nombre de la misiÃƒÂ³n
      desc: customDesc,    // Objetivo o descripciÃƒÂ³n dinÃƒÂ¡mica
      completed: isCompleted,
      img: medalImage,
      reward: `${m.RecompensaPts} pts`,
      progress: progress.toFixed(0)
    };
  });
}



/* =========================================
   Ã°Å¸ÂÂª SISTEMA DE TIENDA UNIFICADO (BACKEND)
   ========================================= */
function buyShopItem(player, itemID, extraData) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { success: false, msg: "Tienda ocupada, intenta de nuevo." };
  
  try {
    const ss = SpreadsheetApp.getActive();
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const invSheet = ss.getSheetByName('INVENTORY');
    const shopSheet = ss.getSheetByName('SHOP_ITEMS');
    const txSheet = ss.getSheetByName('TRANSACTIONS');
    const sabSheet = ss.getSheetByName('PURGE_SABOTAGES'); 
    const factionSheet = ss.getSheetByName('FACTIONS');
    const battleSheet = ss.getSheetByName('TEAM_BATTLE');
    const props = PropertiesService.getScriptProperties(); 

    // 1. LIMPIEZA DE NOMBRE
    const playerClean = String(player).trim().toLowerCase();

    // --- A. BUSCAR DATOS DEL JUGADOR ---
    const mData = marketSheet.getDataRange().getValues();
    let playerRow = -1;
    
    for(let i=1; i<mData.length; i++) {
      if(String(mData[i][0]).trim().toLowerCase() === playerClean) { 
        playerRow = i+1; 
        break; 
      }
    }
    
    if(playerRow === -1) return { success: false, msg: `Jugador '${player}' no encontrado.` };
    
    const currentBalance = Number(mData[playerRow-1][2]); 
    const currentStatus = mData[playerRow-1][6]; 

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â GESTIÃƒâ€œN DE MUERTOS
    let ghostTax = 0; 
    if (currentStatus === 'ELIMINATED') {
        if (itemID === 'TOXIC_INJECTOR') ghostTax = 100;
        else if (itemID === 'VOTE_BALLOT' || itemID === 'TEAM_ROLE_VOTE') ghostTax = 0;
        else return { success: false, msg: "Ã°Å¸â€™â‚¬ EstÃƒÂ¡s ELIMINADO. Solo puedes comprar Venganza o Votar." };
    }
    
    // --- B. BUSCAR PRECIO ---
    const sData = shopSheet.getDataRange().getValues();
    let itemData = null;
    for(let i=1; i<sData.length; i++) {
      if(String(sData[i][0]) === String(itemID)) { 
        itemData = { price: Number(sData[i][3]), name: sData[i][1] }; 
        break; 
      }
    }
    // Items especiales
    if(!itemData) {
        if (itemID === 'TEAM_ROLE_VOTE') itemData = { price: 50, name: "Contrato de Equipo" };
        else return { success: false, msg: "El objeto no existe." };
    }
    
    const finalPrice = itemData.price + ghostTax;
    
    if(currentBalance < finalPrice) {
        return { success: false, msg: `Saldo insuficiente. Tienes ${currentBalance} G.` };
    }

    // ==========================================
    // Ã°Å¸â€”Â³Ã¯Â¸Â 3. LÃƒâ€œGICA DE VOTACIÃƒâ€œN (FACCIÃƒâ€œN)
    // ==========================================
    if (itemID === 'VOTE_BALLOT') {

      if (props.getProperty('EVENT_WAR_ACTIVE') !== 'TRUE') {
             return { success: false, msg: "Ã¢â€ºâ€ La Guerra de Facciones no estÃƒÂ¡ activa." };
        }
        if (!extraData || !extraData.includes('|')) return { success: false, msg: "Faltan datos de votaciÃƒÂ³n." };
        const parts = extraData.split('|');
        const roleVoted = parts[0]; 
        const candidateInput = parts[1].trim().toLowerCase();

        if (candidateInput === playerClean) return { success: false, msg: "Ã°Å¸Å¡Â« No puedes votarte a ti mismo." };

        const roleColumns = { 'GENERAL': 5, 'ESTRATEGA': 6, 'TANQUE': 7 };
        const targetCol = roleColumns[roleVoted];
        
        // Escribir en FACTIONS...
        const fData = factionSheet.getDataRange().getValues();
        let voterTeam = null, candidateTeam = null, voterRow = -1, candidateRow = -1;
        let voteHistory = ""; 

        for(let i=1; i<fData.length; i++) {
            const rowName = String(fData[i][0]).trim().toLowerCase();
            if (rowName === playerClean) { voterRow = i + 1; voterTeam = fData[i][1]; voteHistory = String(fData[i][7] || ""); }
            if (rowName === candidateInput) { candidateRow = i + 1; candidateTeam = fData[i][1]; }
        }

        if (!voterTeam || !candidateTeam) return { success: false, msg: "Error de facciÃƒÂ³n." };
        if (voterTeam !== candidateTeam) return { success: false, msg: "Solo puedes votar a tu equipo." };
        if (voteHistory.includes(roleVoted + ",")) return { success: false, msg: `Ã¢â€ºâ€ Ya has votado para ${roleVoted}.` };

        // Registrar
        let currentVotes = Number(factionSheet.getRange(candidateRow, targetCol).getValue() || 0);
        factionSheet.getRange(candidateRow, targetCol).setValue(currentVotes + 1);
        factionSheet.getRange(voterRow, 8).setValue(voteHistory + roleVoted + ",");

        // Cobrar
        marketSheet.getRange(playerRow, 3).setValue(currentBalance - finalPrice);
        if(txSheet) txSheet.appendRow([new Date(), 'VOTE', player, `${roleVoted} -> ${parts[1]}`, 1, -finalPrice]);

        return { success: true, msg: `Ã°Å¸â€”Â³Ã¯Â¸Â Voto registrado para ${parts[1]}.` };
    }

    // ==========================================
    // Ã¢Å¡â€Ã¯Â¸Â 4. CONTRATO DE TORNEO (TEAM_ROLE_VOTE) [ACTUALIZADO FILL/SUB]
    // ==========================================
    if (itemID === 'TEAM_ROLE_VOTE') {

        if (props.getProperty('EVENT_TEAM_BATTLE_ACTIVE') !== 'TRUE') {
             return { success: false, msg: "Ã¢â€ºâ€ El Torneo no estÃƒÂ¡ activo actualmente." };
        }
        
        let roleVote = String(extraData).toUpperCase().trim();
        
        // 1. AÃƒâ€˜ADIMOS 'FILL' Y 'SUB' A LA LISTA DE PERMITIDOS
        const validRoles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT', 'FILL', 'SUB'];
        
        if (!validRoles.includes(roleVote)) return { success: false, msg: "Rol invÃƒÂ¡lido ("+roleVote+")." };
        if (!battleSheet) return { success: false, msg: "El torneo no estÃƒÂ¡ activo." };
        
        const bData = battleSheet.getDataRange().getValues();
        let myRow = -1;
        let myTeamID = -1;

        // Buscar al jugador
        for(let i=1; i<bData.length; i++) {
            if(String(bData[i][1]).trim().toLowerCase() === playerClean) { 
                myRow = i+1; 
                myTeamID = bData[i][0]; 
                break; 
            }
        }

        if (myRow === -1) return { success: false, msg: "No estÃƒÂ¡s inscrito en el torneo." };

        // --- LÃƒâ€œGICA INTELIGENTE DE FILL ---
        if (roleVote === 'FILL') {
            const standardRoles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];
            
            // Miramos quÃƒÂ© roles ya estÃƒÂ¡n ocupados en TU equipo
            const takenRoles = bData
                .filter(r => r[0] === myTeamID && r[2] && r[2] !== "") // Mismo equipo y rol no vacÃƒÂ­o
                .map(r => String(r[2]).toUpperCase());

            // Buscamos el primero que estÃƒÂ© libre
            const freeRole = standardRoles.find(r => !takenRoles.includes(r));

            if (freeRole) {
                roleVote = freeRole; // Ã‚Â¡Asignado!
            } else {
                // Si todo estÃƒÂ¡ lleno (5 titulares), te manda de Suplente
                roleVote = 'SUB';
            }
        }

        // --- VERIFICACIÃƒâ€œN FINAL ---
        // Verificar si el rol estÃƒÂ¡ ocupado (Excepto SUB, que admite infinitos)
        if (roleVote !== 'SUB') {
            const teamRows = bData.filter(r => r[0] === myTeamID);
            const roleTaken = teamRows.some(r => String(r[2]).toUpperCase() === roleVote);
            
            if (roleTaken) return { success: false, msg: `Ã¢ÂÅ’ ${roleVote} ya estÃƒÂ¡ ocupado. Elige otro o ve de Suplente.` };
        }

        // Asignar en la hoja
        battleSheet.getRange(myRow, 3).setValue(roleVote);
        battleSheet.getRange(myRow, 4).setValue('LOCKED'); 
        
        // Cobrar
        marketSheet.getRange(playerRow, 3).setValue(currentBalance - finalPrice);
        if(txSheet) txSheet.appendRow([new Date(), 'ROLE_ASSIGN', player, roleVote, 1, -finalPrice]);

        return { success: true, msg: `Ã¢Å“â€¦ Contrato firmado: JugarÃƒÂ¡s como ${roleVote}.` };
    }

    // --- E. RESTO DE OBJETOS ---
    let newBalance = currentBalance - finalPrice;
    
    // Gacha (Cofres)
    if (itemID === 'CHEST_HEXTECH' || itemID === 'ONE_PIECE') { 
       const rng = Math.random() * 100;
       let rewardMsg = "", visualWinner = "";
       let newBalance = Number(marketSheet.getRange(playerRow, 3).getValue());
       
       // FunciÃƒÂ³n segura para dar materiales a la mochila de La Forja
       const giveMaterial = (pName, mId) => {
           const mSheet = ss.getSheetByName('FORGE_MATERIALS');
           if (!mSheet) return;
           const d = mSheet.getDataRange().getValues();
           for (let i = 1; i < d.length; i++) {
               if (String(d[i][0]).toLowerCase().trim() === pName.toLowerCase().trim() && d[i][1] === mId) {
                   mSheet.getRange(i + 1, 3).setValue(Number(d[i][2] || 0) + 1);
                   return;
               }
           }
           mSheet.appendRow([pName, mId, 1]);
       };

       // Listas de Drops
       const class_items = ['POTION_ELO', 'SOBORNO', 'ANGEL_GUARD', 'PACT_STREAK', 'TOXIC_INJECTOR', 'GAS_MASK', 'BET_FIRST_BLOOD'];
       const t1 = ['SCRAP_METAL', 'BENT_NAIL', 'RUSTY_CHAIN', 'OLD_BOOT'];
       const t2 = ['BROKEN_RUNE', 'ARCANE_DUST', 'CRYSTAL_SHARD'];
       const t3 = ['LIQUID_FIRE', 'TRUE_ICE', 'VOID_ESSENCE'];
       const t4 = ['HEX_CORE', 'DRAGON_SCALE'];
       const blueprints = [
           'ORNN_ANVIL', 'ZHONYA_HOURGLASS', 'ELIXIR_SORCERY', 
           'INFINITY_PRIME', 'GAUNTLET_GOD', 'GOD_CALL',
           'MASTERWORK_RUNE', 'FATE_SIPHON', 'SHIMMER_OVERDOSE', 
           'ZAUN_PACT', 'LAST_GASP'
       ];

       // Ã°Å¸Å½â€™ 45% - OBJETOS CLÃƒÂSICOS (Pociones, Sobornos...)
       if (rng < 45) { 
           const drop = class_items[Math.floor(Math.random() * class_items.length)];
           invSheet.appendRow([player, drop, 'ACTIVE', new Date()]);
           rewardMsg = `Objeto de Tienda: ${drop.replace(/_/g, ' ')}`; 
           visualWinner = `Ã°Å¸Å½â€™ ${drop}`;
       } 
       // Ã°Å¸â€™Â° 15% - ORO PURO (200 - 600G)
       else if (rng < 60) { 
           const gold = Math.floor(Math.random() * 400) + 200; 
           newBalance += gold;
           rewardMsg = `Ã‚Â¡Oro! Encuentras ${gold} G.`; 
           visualWinner = `Ã°Å¸â€™Â° ${gold} G`;
       }
       // Ã°Å¸â€Â© 13% - TIER 1 (ComÃƒÂºn)
       else if (rng < 73) { 
           const drop = t1[Math.floor(Math.random() * t1.length)];
           giveMaterial(player, drop);
           rewardMsg = `Material ComÃƒÂºn: ${drop}`; visualWinner = `Ã°Å¸â€Â© ${drop}`;
       }
       // Ã°Å¸â€™Å½ 10% - TIER 2 (Poco ComÃƒÂºn)
       else if (rng < 83) { 
           const drop = t2[Math.floor(Math.random() * t2.length)];
           giveMaterial(player, drop);
           rewardMsg = `Material Poco ComÃƒÂºn: ${drop}`; visualWinner = `Ã°Å¸â€™Å½ ${drop}`;
       }
       // Ã°Å¸â€Â¥ 7% - TIER 3 (Raro)
       else if (rng < 90) { 
           const drop = t3[Math.floor(Math.random() * t3.length)];
           giveMaterial(player, drop);
           rewardMsg = `Ã‚Â¡RARO! Obtienes: ${drop}`; visualWinner = `Ã°Å¸â€Â¥ ${drop}`;
       }
       // Ã¢Å¡â„¢Ã¯Â¸Â 4% - TIER 4 (Ãƒâ€°pico)
       else if (rng < 94) { 
           const drop = t4[Math.floor(Math.random() * t4.length)];
           giveMaterial(player, drop);
           rewardMsg = `Ã‚Â¡Ãƒâ€°PICO! Artefacto: ${drop}`; visualWinner = `Ã¢Å¡â„¢Ã¯Â¸Â ${drop}`;
       }
       // Ã°Å¸â€œÅ“ 4% - PLANOS DE CRAFTEO
       else if (rng < 98) { 
           // Damos el plano como ÃƒÂ­tem de inventario
           const drop = blueprints[Math.floor(Math.random() * blueprints.length)];
           // Prefijo 'BP_' para saber que es el Plano y no el objeto final
           invSheet.appendRow([player, 'BP_' + drop, 'ACTIVE', new Date()]);
           rewardMsg = `Ã°Å¸â€œÅ“ Ã‚Â¡PLANO ENCONTRADO: ${drop}!`; 
           visualWinner = `Ã°Å¸â€œÅ“ PLANO FORJA`;
           if (typeof registerNews === 'function') registerNews('GACHA', `Ã°Å¸â€œÅ“ ${player} ha encontrado un Plano de Forja antiguo.`);
       }
       // Ã°Å¸Å’Â 1% - TIER 5 (Legendario - WORLD RUNE)
       else if (rng < 99) { 
           giveMaterial(player, 'WORLD_RUNE');
           rewardMsg = `Ã°Å¸Å’Â **Ã‚Â¡RELIQUIA LEGENDARIA: WORLD RUNE!**`; visualWinner = `Ã°Å¸Å’Â WORLD RUNE`;
           if (typeof registerNews === 'function') registerNews('GACHA', `Ã°Å¸Å’Â Ã‚Â¡El mundo tiembla! ${player} acaba de encontrar una Runa Global en un cofre.`);
       }
       // Ã°Å¸Å¡Â¨ 1% - JACKPOT (ONE PIECE)
       else { 
           newBalance += 5000;
           invSheet.appendRow([player, 'ONE_PIECE', 'ACTIVE', new Date()]);
           rewardMsg = `Ã°Å¸Å¡Â¨ **Ã‚Â¡EL ONE PIECE EXISTE!** 5000 G.`; 
           visualWinner = `Ã°Å¸ÂÂ´Ã¢â‚¬ÂÃ¢ËœÂ Ã¯Â¸Â ONE PIECE`;
           if (typeof registerNews === 'function') registerNews('GACHA', `Ã°Å¸Å¡Â¨ Ã‚Â¡ATRACO AL CASINO! ${player} ha encontrado el ONE PIECE.`);
       }

       marketSheet.getRange(playerRow, 3).setValue(newBalance);
       return { success: true, msg: rewardMsg, winnerItem: visualWinner };
    }

    // Guardar saldo normal
    marketSheet.getRange(playerRow, 3).setValue(newBalance);
    if(txSheet) txSheet.appendRow([new Date(), 'SHOP_BUY', player, itemData.name, 1, -finalPrice]);

    // Entregar Inyector
    if (itemID === 'TOXIC_INJECTOR') {
       if(sabSheet) sabSheet.appendRow([player, targetName, 'ACTIVE', new Date()]);
       return { success: true, msg: `Ã°Å¸â€™â€° Inyector aplicado a ${targetName}.` };
    }

    if (itemID === 'ADRENALINE_SHOT') {
        // Verificar si el jugador ya usÃƒÂ³ uno en esta fase (buscamos en el historial de consumo)
        const consumed = invSheet.getValues().some(r => r[0] === player && r[1] === 'ADRENALINE_SHOT' && r[2] === 'USED');
        if (consumed) return { success: false, msg: "Tu cuerpo no aguanta mÃƒÂ¡s adrenalina esta fase." };
    }
    
    // Entregar Item Inventario
    invSheet.appendRow([player, itemID, 'ACTIVE', new Date()]);
    return { success: true, msg: `Ã‚Â¡Has comprado ${itemData.name}!` };
    
  } catch(e) {
    return { success: false, msg: "Error Backend: " + e.message };
  } finally {
    lock.releaseLock();
  }
}


function SetupCosmetics() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName('COSMETICS')) {
    const sheet = ss.insertSheet('COSMETICS');
    // Player, Title_ID, Is_Equipped
    sheet.getRange('A1:C1').setValues([['Player', 'Title', 'Status']]).setFontWeight('bold');
    Logger.log("Hoja COSMETICS creada.");
  }
}

// Helper rÃƒÂ¡pido para buscar PUUID sin llamar a la API de Riot (ahorra recursos)
function getPuuidFromSheet(summonerName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('PLAYERS');
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  // Buscamos en la columna A (Nombre) y devolvemos la C (PUUID)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === String(summonerName).toLowerCase().trim()) {
      return data[i][2]; // Columna C es el PUUID
    }
  }
  return null;
}

/**
 * Sincroniza la hoja PLAYERS con MARKET_STATUS.
 * AÃƒÂ±ade a los jugadores nuevos con precio base 100 y cartera 1000.
 */
function refreshMarketPlayers() {
  const ss = SpreadsheetApp.getActive();
  const pSheet = ss.getSheetByName('PLAYERS');
  const mSheet = ss.getSheetByName('MARKET_STATUS');
  
  if (!pSheet || !mSheet) {
    SpreadsheetApp.getUi().alert('Faltan hojas (PLAYERS o MARKET_STATUS).');
    return;
  }

  // 1. Obtener lista de jugadores activos en PLAYERS
  const pData = pSheet.getDataRange().getValues();
  const activePlayers = [];
  // Empezamos en 1 para saltar el encabezado
  for (let i = 1; i < pData.length; i++) {
    const name = pData[i][0];
    const active = String(pData[i][4] || "SÃƒÂ­").toLowerCase(); // Columna E es "Active"
    
    // Si tiene nombre y no estÃƒÂ¡ desactivado
    if (name && active !== 'no' && active !== 'false') {
      activePlayers.push(name);
    }
  }

  // 2. Obtener lista de acciones ya existentes en el Mercado
  const mData = mSheet.getDataRange().getValues();
  const existingStocks = [];
  for (let i = 1; i < mData.length; i++) {
    existingStocks.push(mData[i][0]); // Columna A es el nombre
  }

  // 3. Detectar los que faltan
  const newRows = [];
  activePlayers.forEach(player => {
    if (!existingStocks.includes(player)) {
      // Estructura: [Name, Price, Wallet, Trend, Change, HistoryJSON]
      // Precio inicial: 100 | Cartera inicial: 1000
      newRows.push([player, 100, 1000, 'Ã¢Å¾Â¡Ã¯Â¸Â', 0, '[100]']);
    }
  });

  // 4. Escribir en la hoja
  if (newRows.length > 0) {
    mSheet.getRange(mSheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
    SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Se han aÃƒÂ±adido ${newRows.length} nuevos jugadores al mercado.`);
  } else {
    SpreadsheetApp.getUi().alert('El mercado ya estÃƒÂ¡ actualizado. No faltan jugadores.');
  }
}
function addMegaphoneToShop() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('SHOP_ITEMS');
  if(sheet) {
    // ID, Nombre, DescripciÃƒÂ³n, Precio, Icono
    sheet.appendRow(['MEGAPHONE', 'MegÃƒÂ¡fono de la Verdad', 'Publica un mensaje personalizado en la barra de noticias para todos.', 500, 'Ã°Å¸â€œÂ¢']);
    Logger.log("MegÃƒÂ¡fono aÃƒÂ±adido.");
  }
}
function addChestToShop() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('SHOP_ITEMS');
  if(sheet) {
    // ID, Nombre, DescripciÃƒÂ³n, Precio, Icono
    sheet.appendRow(['CHEST_HEXTECH', 'Cofre Hextech', 'Ã‚Â¿Te sientes con suerte? Contiene oro, objetos o basura.', 500, 'Ã°Å¸Å½Â']);
    Logger.log("Cofre aÃƒÂ±adido a la tienda.");
  }
}
function SetupSponsorships() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName('SPONSORSHIPS')) {
    const sheet = ss.insertSheet('SPONSORSHIPS');
    // Investor, TargetPlayer, Amount, Status (ACTIVE/COMPLETED), Date
    sheet.getRange('A1:E1').setValues([['Investor', 'Target', 'Amount', 'Status', 'Date']]).setFontWeight('bold');
    Logger.log("Hoja SPONSORSHIPS creada.");
  }
}
function sponsorPlayer(investor, target, amount) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return { success: false, msg: "Sistema ocupado." };

  try {
    // --- Ã°Å¸â€â€™ BLOQUEO: JUGADOR EN PARTIDA (NO SE PUEDE APADRINAR) ---
    const targetPuuid = getPuuidFromSheet(target);
    if (targetPuuid) {
        const liveCheck = getLiveStatus(targetPuuid);
        if (liveCheck.isLive) {
            return { success: false, msg: `Ã¢â€ºâ€ TARDES: ${target} ya estÃƒÂ¡ jugando (${liveCheck.time}). Debiste invertir antes.` };
        }
    }
    const ss = SpreadsheetApp.getActive();
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const sponsorSheet = ss.getSheetByName('SPONSORSHIPS');
    const txSheet = ss.getSheetByName('TRANSACTIONS'); // Ã¢Å“â€¦ Necesario
    
    if (investor === target) return { success: false, msg: "No puedes apadrinarte a ti mismo." };
    if (amount < 100) return { success: false, msg: "El patrocinio mÃƒÂ­nimo son 50 G." };

    const mData = marketSheet.getDataRange().getValues();
    let invRow = -1;
    for(let i=1; i<mData.length; i++) {
      if(mData[i][0] === investor) { invRow = i+1; break; }
    }
    
    if (invRow === -1) return { success: false, msg: "Error de cuenta." };
    const currentBalance = Number(mData[invRow-1][2]);

    if (currentBalance < amount) return { success: false, msg: "No tienes suficiente dinero." };

    // Cobrar y Registrar
    marketSheet.getRange(invRow, 3).setValue(currentBalance - amount);
    sponsorSheet.appendRow([investor, target, amount, 'ACTIVE', new Date()]);
    
    // Ã¢Å“â€¦ LOG: Gasto de patrocinio (Precio -1 para que salga negativo)
    if (txSheet) {
        txSheet.appendRow([new Date(), 'SPONSOR_PAY', investor, target, amount, -1]);
    }
    
    registerNews('DEAL', `Ã°Å¸Â¤Â ${investor} ha apadrinado a ${target} por ${amount} G. Ã‚Â¡PresiÃƒÂ³n mÃƒÂ¡xima!`);

    return { success: true, msg: `Has apadrinado a ${target}. Si gana su prÃƒÂ³xima partida, recibirÃƒÂ¡s ${amount * 2} G.` };

  } catch (e) {
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}


// FunciÃƒÂ³n auxiliar para ver si un jugador estÃƒÂ¡ en partida
function getLiveStatus(puuid) {
  const cfg = readConfigMap();
  const region = cfg.riot_region || 'europe';
  const apiKey = getApiKey();
  
  // Nota: La API de espectador usa la regiÃƒÂ³n de plataforma (ej: euw1) no la de ruta (europe)
  // Haremos un apaÃƒÂ±o rÃƒÂ¡pido asumiendo EUW1, si eres de LAN/LAS cÃƒÂ¡mbialo a 'la1' o 'la2'.
  const platform = 'euw1'; 
  const url = `https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  
  try {
    const opts = { method: 'get', headers: {'X-Riot-Token': apiKey}, muteHttpExceptions: true };
    const res = UrlFetchApp.fetch(url, opts);
    
    // Si devuelve 200, estÃƒÂ¡ jugando. Si devuelve 404, no estÃƒÂ¡ jugando.
    if (res.getResponseCode() === 200) {
       const data = JSON.parse(res.getContentText());
       // Devolvemos info bÃƒÂ¡sica: Modo de juego y tiempo
       const minutes = Math.floor(data.gameLength / 60);
       return { isLive: true, mode: data.gameMode, time: minutes + "'" };
    }
  } catch(e) {
    return { isLive: false };
  }
  return { isLive: false };
}

/* ----------------- ESCANER DE PARTIDAS EN VIVO ----------------- */
function getRealTimeLiveStatuses() {
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const playersSheet = ss.getSheetByName('PLAYERS');
  
  if (!marketSheet || !playersSheet) return {};

  // 1. Obtener lista de jugadores en el mercado
  const marketNames = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 1).getValues().flat();
  
  // 2. Obtener mapa de PUUIDs { "Nombre": "PUUID" }
  const pData = playersSheet.getDataRange().getValues();
  const puuidMap = {};
  for (let i = 1; i < pData.length; i++) {
    puuidMap[pData[i][0]] = pData[i][2]; // Col A: Nombre, Col C: PUUID
  }

  const liveResults = {};

  // 3. Escanear uno a uno (Solo los que tienen PUUID)
  // Nota: Esto tardarÃƒÂ¡ unos segundos, es normal.
  for (const player of marketNames) {
    const puuid = puuidMap[player];
    if (puuid) {
       const status = getLiveStatus(puuid); // Tu funciÃƒÂ³n auxiliar existente
       if (status.isLive) {
         liveResults[player] = { isLive: true, time: status.time, mode: status.mode };
       }
    }
  }

  return liveResults;
}


/* ==========================================================
   Ã°Å¸â€Â¥ SISTEMA DE RIVALES (NEMESIS SYSTEM)
   ========================================================== */

function SetupRivales() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName('RIVALS')) {
    const sheet = ss.insertSheet('RIVALS');
    // WeekID: Identificador de la semana (ej: 2025-W40)
    // Status: ACTIVE o RESOLVED
    sheet.getRange('A1:F1').setValues([['WeekID', 'Player1', 'Player2', 'StartPoints1', 'StartPoints2', 'Status']]).setFontWeight('bold');
    Logger.log("Hoja RIVALS creada.");
  }
}

function updateRivalryProgress(player, pointsEarned) {
  const ss = SpreadsheetApp.getActive();
  const rivalsSheet = ss.getSheetByName('RIVALS');
  if (!rivalsSheet) return;

  const data = rivalsSheet.getDataRange().getValues();
  
  // Buscamos un duelo ACTIVO donde participe el jugador
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[5] === 'ACTIVE') {
      let updated = false;
      
      // Datos Jugador 1
      const p1 = row[1];
      let score1 = Number(row[3]); 
      let games1 = Number(row[6]); 

      // Datos Jugador 2
      const p2 = row[2];
      let score2 = Number(row[4]); 
      let games2 = Number(row[7]); 

      // CASO: Eres el Jugador 1
      if (p1 === player) {
        if (games1 < 4) { // Ã°Å¸â€â€™ EL CANDADO: Solo suma si llevas menos de 4
           games1++;
           score1 += Number(pointsEarned); // Sumamos los puntos de ESTA partida
           
           rivalsSheet.getRange(i + 1, 4).setValue(score1); // Actualizar Puntos (Col D)
           rivalsSheet.getRange(i + 1, 7).setValue(games1); // Actualizar Games (Col G)
           updated = true;
           console.log(`Ã¢Å¡â€Ã¯Â¸Â Rivalry P1 (${player}): Game ${games1}/4. Puntos: ${pointsEarned}. Total: ${score1}`);
        }
      } 
      // CASO: Eres el Jugador 2
      else if (p2 === player) {
        if (games2 < 4) { // Ã°Å¸â€â€™ EL CANDADO
           games2++;
           score2 += Number(pointsEarned); 
           
           rivalsSheet.getRange(i + 1, 5).setValue(score2); // Actualizar Puntos (Col E)
           rivalsSheet.getRange(i + 1, 8).setValue(games2); // Actualizar Games (Col H)
           updated = true;
           console.log(`Ã¢Å¡â€Ã¯Â¸Â Rivalry P2 (${player}): Game ${games2}/4. Puntos: ${pointsEarned}. Total: ${score2}`);
        }
      }
      
      if (updated) break; // Ya actualizamos, salimos
    }
  }
}

/* ----------------- GENERAR RIVALES (LIMITED GAMES) ----------------- */
function generarRivales() {
  SetupRivales(); 
  const ss = SpreadsheetApp.getActive();
  const scoresSheet = ss.getSheetByName('SCORES');
  const rivalsSheet = ss.getSheetByName('RIVALS');
  
  if (!scoresSheet || !rivalsSheet) return;

  // 1. Obtener Ranking Actual
  const rawData = scoresSheet.getRange(2, 1, scoresSheet.getLastRow()-1, 2).getValues();
  const data = rawData.filter(r => r[0] !== "" && r[0] !== null);
  
  // Ordenar por puntos (Mejor vs Segundo Mejor, etc.)
  data.sort((a, b) => Number(b[1]) - Number(a[1]));

  const weekID = `W${getWeekNumber(new Date())}-${new Date().getFullYear()}`;
  
  // Verificar si ya existen rivales para esta semana
  const existing = rivalsSheet.getDataRange().getValues();
  const alreadyGenerated = existing.slice(1).some(r => r[0] === weekID);
  
  if (alreadyGenerated) {
    SpreadsheetApp.getUi().alert(`Ã¢Å¡Â Ã¯Â¸Â Ya existen rivales para ${weekID}.`);
    return;
  }

  const newRivals = [];
  
  // Si son impares, aÃƒÂ±adir un Bot para que nadie se quede sin rival
  if (data.length % 2 !== 0) {
      let totalPts = data.reduce((acc, curr) => acc + Number(curr[1]), 0);
      let avgPts = totalPts / data.length;
      data.push(["Ã°Å¸Â¤â€“ Training Bot", avgPts.toFixed(2)]); 
  }
  
  // Generar pares
  for (let i = 0; i < data.length; i += 2) {
    const p1 = data[i][0];
    const p2 = data[i+1][0];

    if (p1 && p2) {
      // CORRECCIÃƒâ€œN AQUÃƒÂ: Iniciamos los marcadores en 0 y 0.
      // Estructura: [WeekID, P1, P2, ScoreP1, ScoreP2, Status, GamesP1, GamesP2]
      newRivals.push([weekID, p1, p2, 0, 0, 'ACTIVE', 0, 0]);
    }
  }

  // Guardar en la hoja RIVALS
  if (newRivals.length > 0) {
    rivalsSheet.getRange(rivalsSheet.getLastRow() + 1, 1, newRivals.length, 8).setValues(newRivals);
    
    // Aviso en noticias (si tienes la funciÃƒÂ³n registerNews)
    if (typeof registerNews === 'function') {
        registerNews('RIVALRY', `Ã¢Å¡â€Ã¯Â¸Â Ã‚Â¡DUELOS ACTIVOS! TenÃƒÂ©is 4 partidas para superar a vuestro rival. Marcadores a 0. Ã‚Â¡Suerte!`);
    }
    
    SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Generados ${newRivals.length} duelos (4 partidas max).`);
  }
}

/**
 * 2. RESOLVER RIVALES (Llamar al final de la semana, antes de generar los nuevos)
 * Compara quiÃƒÂ©n ha ganado mÃƒÂ¡s puntos ESTA semana y aplica el robo de "Hype".
 */
/* ----------------- RESOLVER RIVALES (ACUMULADOR) ----------------- */
function resolverRivales(manual = true) { // AÃƒÂ±adido parÃƒÂ¡metro manual
  const ss = SpreadsheetApp.getActive();
  const rivalsSheet = ss.getSheetByName('RIVALS');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const manualSheet = ss.getSheetByName('MANUAL_POINTS');

  if (!rivalsSheet || !marketSheet) return;

  // 1. Mapear el mercado para encontrar filas rÃƒÂ¡pido
  const marketMap = {};
  const mData = marketSheet.getDataRange().getValues();
  for (let i = 1; i < mData.length; i++) marketMap[mData[i][0]] = i + 1;

  const rivalsData = rivalsSheet.getDataRange().getValues();
  let resolvedCount = 0; 

  for (let i = 1; i < rivalsData.length; i++) {
    const row = rivalsData[i];
    
    // Solo procesar si estÃƒÂ¡ ACTIVO
    if (row[5] === 'ACTIVE') {
      const p1 = row[1];
      const p2 = row[2];
      
      // --- CAMBIO CLAVE ---
      // Leemos directamente los puntos acumulados en el duelo (Columnas D y E)
      // Ya no hace falta restar nada, estos son los puntos netos ganados en las 4 partidas.
      const gain1 = Number(row[3]); 
      const gain2 = Number(row[4]); 
      
      let winner = null;
      let loser = null;
      
      if (gain1 > gain2) { winner = p1; loser = p2; }
      else if (gain2 > gain1) { winner = p2; loser = p1; }
      
      if (winner) {
        // A. Robo de Valor en Bolsa (15%)
        if (marketMap[loser]) {
          const lRow = marketMap[loser];
          const lPrice = Number(marketSheet.getRange(lRow, 2).getValue());
          const stealAmount = lPrice * 0.15;
          const newLPrice = Math.max(1, lPrice - stealAmount);
          
          // Bajar al Perdedor
          marketSheet.getRange(lRow, 2).setValue(newLPrice);
          marketSheet.getRange(lRow, 4).setValue('Ã°Å¸â€œâ€°');
          
          // Subir al Ganador
          if (marketMap[winner]) {
              const wRow = marketMap[winner];
              const wPrice = Number(marketSheet.getRange(wRow, 2).getValue());
              marketSheet.getRange(wRow, 2).setValue(wPrice + stealAmount);
              marketSheet.getRange(wRow, 4).setValue('Ã°Å¸Å¡â‚¬');
          }
        }

        // B. Puntos de Ranking (+10 / -5)
        if (manualSheet) {
             manualSheet.appendRow([new Date(), winner, 10, 'Ganador Duelo Semanal']);
             manualSheet.appendRow([new Date(), loser, -5, 'Perdedor Duelo Semanal']);
        }
        
        if (typeof registerNews === 'function') {
            registerNews('RIVAL_WIN', `Ã°Å¸Ââ€  ${winner} (${gain1.toFixed(1)}) vence a ${loser} (${gain2.toFixed(1)}). +10 Pts y Robo de Valor.`);
        }

      } else {
        // Empate
        if (typeof registerNews === 'function') {
            registerNews('RIVAL_DRAW', `Ã°Å¸Â¤Â Empate tÃƒÂ©cnico entre ${p1} y ${p2}. Marcador igualado.`);
        }
      }
      
      // C. Cerrar el duelo
      rivalsSheet.getRange(i + 1, 6).setValue('RESOLVED');
      resolvedCount++; 
    }
  }
  
  // --- FINALIZACIÃƒâ€œN ---
  if (resolvedCount > 0) {
      if (typeof updateScores === 'function') updateScores(); // Actualizar tabla general
      
      if (manual !== false) {
         SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Se han resuelto ${resolvedCount} duelos.`);
      } else {
         console.log(`Auto-resoluciÃƒÂ³n: ${resolvedCount} duelos procesados.`);
      }
  } else {
      if (manual === true) { 
         SpreadsheetApp.getUi().alert('No hay duelos activos pendientes de resolver.');
      }
  }
}


/* ==========================================================
   Ã°Å¸â€˜Â¾ RAID BOSS (BARON NASHOR) - LÃƒâ€œGICA BACKEND
   ========================================================== */

// Esta funciÃƒÂ³n la llama la web para pintar la barra roja
function getBossData() {
    const props = PropertiesService.getScriptProperties();
    // Si no existe vida, la creamos (10,000 HP)
    if (!props.getProperty('BOSS_HP')) {
        props.setProperties({
            'BOSS_HP': '2999',
            'BOSS_MAX_HP': '3000',
            'BOSS_STATUS': 'ALIVE'
        });
    }
    
    return {
        hp: Number(props.getProperty('BOSS_HP')),
        max: Number(props.getProperty('BOSS_MAX_HP')),
        status: props.getProperty('BOSS_STATUS')
    };
}

/* --- GESTIÃƒâ€œN MANUAL DEL RAID BOSS --- */

// 1. Configurar vida personalizada
function configureBossCustom() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Configurar Raid Boss', 
    'Introduce la VIDA MÃƒÂXIMA para el DragÃƒÂ³n (ej: 5000):', 
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() == ui.Button.OK) {
    const hpStr = response.getResponseText().trim();
    const hp = parseInt(hpStr);

    if (isNaN(hp) || hp <= 0) {
      ui.alert("Por favor, introduce un nÃƒÂºmero vÃƒÂ¡lido.");
      return;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperties({
      'BOSS_HP': String(hp),
      'BOSS_MAX_HP': String(hp),
      'BOSS_STATUS': 'ALIVE'
    });

    ui.alert(`Ã¢Å“â€¦ Raid Boss configurado.\nVida: ${hp} / ${hp}\nEstado: VIVO`);
  }
}

// 2. Eliminar al Boss (Ocultar barra)
function removeBoss() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Eliminar Boss', 'Ã‚Â¿Seguro que quieres quitar al Boss? La barra desaparecerÃƒÂ¡ de la web.', ui.ButtonSet.YES_NO);
  
  if (response == ui.Button.YES) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BOSS_STATUS', 'DEAD'); // Al ponerlo DEAD, la web deja de mostrarlo o pone 0
    props.setProperty('BOSS_HP', '0');
    ui.alert('Ã°Å¸â€™â‚¬ Boss eliminado. El evento ha terminado.');
  }
}

// Esta funciÃƒÂ³n resta vida al Boss
function damageRaidBoss(points) {
    const props = PropertiesService.getScriptProperties();
    
    // 1. Ver si estÃƒÂ¡ vivo
    if (props.getProperty('BOSS_STATUS') === 'DEAD') {
        Logger.log("Ã¢ÂÅ’ BOSS DEAD: No se aplica daÃƒÂ±o porque ya estÃƒÂ¡ muerto.");
        return;
    }

    let currentHP = Number(props.getProperty('BOSS_HP'));
    if (isNaN(currentHP)) currentHP = 3000;

    // 2. Calcular daÃƒÂ±o (Tu fÃƒÂ³rmula original)
    // Math.max(0, ...) hace que si los puntos son negativos, el daÃƒÂ±o sea 0.
    const dmg = Math.max(0, Math.ceil(points)); 
    
    // --- Ã°Å¸Å¡Â¨ AQUÃƒÂ ESTÃƒÂ EL CHIVATO ---
    Logger.log(`Ã°Å¸â€˜Â¾ INTENTO DE DAÃƒâ€˜O: Puntos Partida: ${points} => DaÃƒÂ±o Calculado: ${dmg}`);

    if (dmg <= 0) {
        Logger.log("Ã¢Å¡Â Ã¯Â¸Â DAÃƒâ€˜O NULO: El jugador no ganÃƒÂ³ suficientes puntos positivos para herir al Boss.");
        return; 
    }
    
    let newHP = currentHP - dmg;
    
    if (newHP <= 0) {
        newHP = 0;
        props.setProperty('BOSS_STATUS', 'DEAD');
        props.setProperty('BOSS_HP', '0');
        Logger.log("Ã°Å¸â€™â‚¬ Ã‚Â¡BOSS ELIMINADO!");
        
        if(typeof registerNews === 'function') {
            registerNews('EVENT', 'Ã°Å¸â€˜Â¾ Ã‚Â¡EL RAID BOSS HA CAÃƒÂDO! Baron Nashor ha sido derrotado.');
        }
        distributeBossRewards();
    } else {
        props.setProperty('BOSS_HP', String(newHP));
        Logger.log(`Ã¢Å“â€¦ DAÃƒâ€˜O APLICADO: ${dmg}. Vida baja de ${currentHP} a ${newHP}`);
    }
}

function distributeBossRewards() {
    const ss = SpreadsheetApp.getActive();
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    if (!marketSheet) return;
    
    const data = marketSheet.getDataRange().getValues();
    const GOLD_REWARD = 500; 
    
    // Recorremos a todos los jugadores del mercado
    for (let i=1; i<data.length; i++) {
        const currentPrice = Number(data[i][1]); // Columna B: Precio
        const currentWallet = Number(data[i][2]); // Columna C: Cartera
        
        // 1. Subida del 15% en el precio de la acciÃƒÂ³n
        const newPrice = currentPrice * 1.15;
        
        // 2. Ingreso de 500 G
        const newWallet = currentWallet + GOLD_REWARD;
        
        // Guardamos valores
        marketSheet.getRange(i+1, 2).setValue(newPrice);
        marketSheet.getRange(i+1, 3).setValue(newWallet);
        
        // Actualizamos tendencia visual a cohete
        marketSheet.getRange(i+1, 4).setValue('Ã°Å¸Å¡â‚¬');
    }
    
    // Noticia extra de euforia bursÃƒÂ¡til
    if(typeof registerNews === 'function') {
        registerNews('BULL', 'Ã°Å¸â€œË† Ã‚Â¡EUFORIA! La derrota del Baron dispara el mercado un 15% y reparte dividendos.');
    }
}


function checkBossWeeklyReset() {
    const props = PropertiesService.getScriptProperties();
    const status = props.getProperty('BOSS_STATUS');
    
    // Si el Boss sigue VIVO el domingo noche... CASTIGO
    if (status === 'ALIVE') {
        const ss = SpreadsheetApp.getActive();
        const marketSheet = ss.getSheetByName('MARKET_STATUS');
        const data = marketSheet.getDataRange().getValues();
        
        for (let i=1; i<data.length; i++) {
            const currentPrice = Number(data[i][1]); // Columna B: Precio
            
            // 1. Bajada del 20% en el precio de la acciÃƒÂ³n (CRASH)
            let newPrice = currentPrice * 0.80;
            if (newPrice < 1) newPrice = 1; // Suelo mÃƒÂ­nimo
            
            marketSheet.getRange(i+1, 2).setValue(newPrice);
            marketSheet.getRange(i+1, 4).setValue('Ã°Å¸â€œâ€°'); // Tendencia a la baja
        }
        
        if(typeof registerNews === 'function') {
            registerNews('CRASH', 'Ã°Å¸â€˜Â¾ La comunidad ha fallado. Baron Nashor arrasa la economÃƒÂ­a: El mercado cae un 20%.');
        }
    }
    
    // RESETEAR EL BOSS PARA LA SEMANA QUE VIENE
    // Puedes subirle la vida si quieres hacerlo mÃƒÂ¡s difÃƒÂ­cil cada semana
    props.setProperties({
      'BOSS_HP': '12000',    // Ej: 12k HP para la siguiente
      'BOSS_MAX_HP': '12000',
      'BOSS_STATUS': 'ALIVE'
    });
}

// FunciÃƒÂ³n para resetear al Boss manualmente si quieres
function adminSetBossLife() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({ 'BOSS_HP': '3000', 'BOSS_MAX_HP': '3000', 'BOSS_STATUS': 'ALIVE' });
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Boss reseteado a 3000 HP.");
}

/* =========================================
   Ã°Å¸â€™Â¼ GESTIÃƒâ€œN DE INVERSORES PUROS (BROKERS)
   ========================================= */

function addPureInvestor() {
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const ui = SpreadsheetApp.getUi();

  // 1. Pedir nombre
  const response = ui.prompt('Nuevo Inversor Puro', 'Escribe el nombre del Broker (ej: "La Banca", "Inversor X"):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const name = response.getResponseText().trim();
  if (!name) { ui.alert("El nombre no puede estar vacÃƒÂ­o."); return; }

  // 2. Verificar si ya existe
  const data = marketSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === name.toLowerCase()) {
      ui.alert("Ã¢ÂÅ’ Ese nombre ya existe en el mercado.");
      return;
    }
  }

  // 3. AÃƒÂ±adir al Mercado
  // Formato: [Summoner, StockPrice, Wallet, Trend, LastChange, History]
  // IMPORTANTE: Ponemos 'Ã°Å¸â€™Â¼' en la columna Trend (Col 4) para identificarlo como NO JUGADOR
  marketSheet.appendRow([name, 1, 1000, 'Ã°Å¸â€™Â¼', 0, '[]']);

  ui.alert(`Ã¢Å“â€¦ Ã‚Â¡Bienvenido a Wall Street!  \n${name} aÃƒÂ±adido como Inversor Puro.\nNo tendrÃƒÂ¡ acciÃƒÂ³n propia ni saldrÃƒÂ¡ en rankings, pero podrÃƒÂ¡ operar.`);
}


/* ==========================================================
   Ã°Å¸â€œâ€° LA BANCA ROTA (EVENTOS GLOBALES)
   ========================================================== */

function triggerEventoMercado() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  
  if (!marketSheet) return;

  // Lista de Eventos Posibles
  const events = [
    { id: 'CRASH', name: 'Ã°Å¸â€™Â¥ CRASH DEL SERVIDOR', desc: 'EUW ha caÃƒÂ­do. PÃƒÂ¡nico general.', effect: -0.10 }, // -10%
    { id: 'BULL', name: 'Ã°Å¸Å¡â‚¬ DOMINGO DE SOLOQ', desc: 'Optimismo en el mercado. Todos suben.', effect: 0.08 }, // +8%
    { id: 'PATCH', name: 'Ã¢Å¡â€“Ã¯Â¸Â PARCHE DE BALANCE', desc: 'Volatilidad extrema. Precios aleatorios.', effect: 'RANDOM' },
    { id: 'TAX', name: 'Ã°Å¸â€™Â¸ IMPUESTO REVOLUCIONARIO', desc: 'Hacienda ha llegado. Todos pierden valor fijo.', effect: -5 } // -5G flat
  ];

  // SelecciÃƒÂ³n aleatoria (o puedes hacer un menÃƒÂº para elegir)
  const event = events[Math.floor(Math.random() * events.length)];

  // Aplicar efectos
  const data = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 2).getValues();
  // data[i][0] = Name, data[i][1] = Price

  for (let i = 0; i < data.length; i++) {
    let currentPrice = Number(data[i][1]);
    let newPrice = currentPrice;
    
    if (event.effect === 'RANDOM') {
      // Entre -10% y +10%
      const change = (Math.random() * 0.20) - 0.10; 
      newPrice = currentPrice * (1 + change);
    } else if (typeof event.effect === 'number') {
        if (Math.abs(event.effect) < 1) {
            // Es porcentaje (ej: 0.08)
            newPrice = currentPrice * (1 + event.effect);
        } else {
            // Es valor fijo (ej: -5)
            newPrice = currentPrice + event.effect;
        }
    }
    
    // Suelo de seguridad
    if (newPrice < 1) newPrice = 1;
    
    // Guardar
    marketSheet.getRange(i + 2, 2).setValue(newPrice);
    
    // Actualizar tendencia visual
    const trend = newPrice > currentPrice ? 'Ã°Å¸â€œË†' : 'Ã°Å¸â€œâ€°';
    marketSheet.getRange(i + 2, 4).setValue(trend);
  }

  // Notificar
  registerNews('EVENT', `Ã°Å¸Å’Â EVENTO GLOBAL: ${event.name}. ${event.desc}`);
  ui.alert(`Ã¢Å¡Â¡ ${event.name} activado`, `El mercado ha reaccionado: ${event.desc}`, ui.ButtonSet.OK);
}


/* ==========================================================
   Ã°Å¸Å½Â° SISTEMA DE ANIMACIÃƒâ€œN DE RULETA
   ========================================================== */

/**
 * Lanza la animaciÃƒÂ³n de la ruleta.
 * @param {string} winnerItemName - El nombre exacto del objeto que HA GANADO el jugador.
 * @param {Array<string>} possibleLootArray - Una lista de strings con cosas que PODRÃƒÂAN haber tocado (para rellenar la ruleta).
 */
function showRouletteAnimation(winnerItemName, possibleLootArray) {
  // Verificar datos
  if (!winnerItemName || !possibleLootArray || possibleLootArray.length === 0) {
    SpreadsheetApp.getUi().alert("Error en la animaciÃƒÂ³n: Faltan datos del premio.");
    return;
  }

  // Convertir el array de posible loot a una cadena separada por comas para pasarla al HTML
  // (HTML templates tienen problemas con arrays directos a veces)
  const lootString = possibleLootArray.join(',');

  // Crear la plantilla HTML desde el archivo 'RouletteDialog.html'
  const htmlOutput = HtmlService.createTemplateFromFile('RouletteDialog');
  
  // Evaluar la plantilla (necesario aunque no usemos variables de servidor tipo <?= ?>)
  const html = htmlOutput.evaluate()
      .setWidth(450) // Ancho de la ventana modal
      .setHeight(350); // Alto de la ventana modal

  // Inyectar los datos en el HTML usando un script en el lado del cliente
  // Esto llama a la funciÃƒÂ³n 'initRoulette' dentro del HTML una vez cargado.
  const htmlWithData = html.getContent() + `
    <script>
      // Llamamos a la funciÃƒÂ³n de inicializaciÃƒÂ³n del HTML pasando los datos del servidor
      // Usamos comillas simples y escapamos por seguridad
      initRoulette('${lootString.replace(/'/g, "\\'")}', '${winnerItemName.replace(/'/g, "\\'")}');
    </script>
  `;
  
  // Mostrar el diÃƒÂ¡logo modal
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(htmlWithData).setWidth(450).setHeight(350), 'Abriendo Cofre...');
}


// --- Ã°Å¸Â§Âª FUNCIÃƒâ€œN DE PRUEBA (BORRAR LUEGO) ---
// Ejecuta esta funciÃƒÂ³n para ver cÃƒÂ³mo queda la animaciÃƒÂ³n sin gastar dinero real.
function TEST_Roulette() {
  const posibleLoot = [
      "Aspecto ComÃƒÂºn", "Aspecto Raro", "Gesto", 
      "Icono", "Esencia Naranja", "Fragmento de Llave", 
      "Aspecto Ãƒâ€°pico", "Aspecto Legendario (Ã‚Â¡Premio!)", 
      "Hype (+100G)", "Bolsa de Sorpresas"
  ];
  
  // Simulemos que ha ganado un Aspecto Legendario
  const ganador = "Aspecto Legendario (Ã‚Â¡Premio!)";

  showRouletteAnimation(ganador, posibleLoot);
}


function getRivalsDataForWeb() {
  const ss = SpreadsheetApp.getActive();
  const rivalsSheet = ss.getSheetByName('RIVALS');
  if (!rivalsSheet) return [];

  const rivalsData = rivalsSheet.getDataRange().getValues();
  const activeRivals = [];

  for (let i = 1; i < rivalsData.length; i++) {
    const row = rivalsData[i];
    if (row[5] === 'ACTIVE') {
      // Datos directos de las columnas acumuladas
      const gain1 = Number(row[3]).toFixed(1); // Puntos P1
      const gain2 = Number(row[4]).toFixed(1); // Puntos P2
      
      // Juegos jugados
      const games1 = row[6] || 0;
      const games2 = row[7] || 0;

      let winning = 'DRAW';
      if (Number(gain1) > Number(gain2)) winning = 'P1';
      if (Number(gain2) > Number(gain1)) winning = 'P2';

      activeRivals.push({
        p1: row[1],
        p2: row[2],
        gain1: gain1,
        gain2: gain2,
        games1: games1, // <--- Enviamos esto
        games2: games2, // <--- Y esto
        winning: winning
      });
    }
  }
  return activeRivals;
}

/* ----------------- HISTORIAL GLOBAL OPTIMIZADO ----------------- */
function getGlobalHistoryData() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('MATCHES');
    if (!sheet || sheet.getLastRow() < 2) return [];

    // OPTIMIZACIÃƒâ€œN: Leemos solo las ÃƒÂºltimas 100 partidas para velocidad
    const lastRow = sheet.getLastRow();
    const startRow = Math.max(2, lastRow - 99); 
    const numRows = lastRow - startRow + 1;
    
    // Leemos el rango (Asumiendo 14 columnas A-N)
    const data = sheet.getRange(startRow, 1, numRows, 14).getValues();
    
    // Procesamos en orden INVERSO (del mÃƒÂ¡s nuevo al mÃƒÂ¡s viejo)
    const history = data.reverse().map(row => {
      // ProtecciÃƒÂ³n de Fechas (Esto suele romper el script si no se hace asÃƒÂ­)
      let dateStr = "---";
      try {
        if (row[1]) {
          let d = new Date(row[1]);
          // Formato corto: DD/MM HH:MM
          let day = d.getDate().toString().padStart(2, '0');
          let month = (d.getMonth() + 1).toString().padStart(2, '0');
          let hours = d.getHours().toString().padStart(2, '0');
          let mins = d.getMinutes().toString().padStart(2, '0');
          dateStr = `${day}/${month} ${hours}:${mins}`;
        }
      } catch(e) { dateStr = "Error Fecha"; }

      // ProtecciÃƒÂ³n de notas (Tags)
      let rawNotes = String(row[13] || "");
      // Limpiamos notas tÃƒÂ©cnicas internas que ensucian el historial visual
      let cleanNotes = rawNotes
        .replace(/;? ?Mitigado por sacrificio/g, "")
        .replace(/;? ?Bounty Regalado!/g, "Ã°Å¸â€™Â¸ Bounty")
        .replace(/;? ?Partida desastrosa/g, "Ã¢ËœÂ Ã¯Â¸Â Disaster");

      return {
        id: String(row[0]),
        date: dateStr,
        summoner: String(row[2]),
        champion: String(row[3]),
        lane: String(row[4]),
        result: String(row[5]),     // "Win" o "Loss"
        kda: `${row[6]}/${row[7]}/${row[8]}`,
        damage: Number(row[9] || 0),
        kp: row[10], // Puede ser decimal
        duration: Math.round(Number(row[11] || 0)),
        points: (Number(row[12]) || 0).toFixed(2),
        notes: cleanNotes
      };
    });
    
    return history;

  } catch (e) {
    Logger.log("Error en getGlobalHistoryData: " + e.message);
    throw new Error("Backend Error: " + e.message); 
  }
}



/* ==========================================================
   Ã¢ËœÂ Ã¯Â¸Â LA PURGA 2.0: BATTLE ROYALE (CON CEMENTERIO)
   ========================================================== */

// 1. ACTIVAR PURGA (SETUP CON COLUMNAS NUEVAS)
function startPurgeEvent() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  
  if (!marketSheet) return;

  // A. Configurar Columnas de Estado (G, H, I) - SIN COLUMNA J
  marketSheet.getRange('G1:I1')
      .setValues([['PurgeStatus', 'DaysSurvived', 'BountyTarget']])
      .setFontWeight("bold")
      .setBackground("#ffcccc"); 
  
  const lastRow = marketSheet.getLastRow();
  if (lastRow > 1) {
      // Resetear valores: Todos VIVOS, 0 DÃƒÂ­as, Sin Objetivo
      const resetArray = new Array(lastRow - 1).fill(['ALIVE', 0, '']);
      marketSheet.getRange(2, 7, lastRow - 1, 3).setValues(resetArray);
      
      assignDailyBounties(marketSheet);
  }

  // B. Guardar ConfiguraciÃƒÂ³n Global
  props.setProperty('EVENT_PURGE_ACTIVE', 'TRUE');
  props.setProperty('EVENT_PURGE_START', new Date().toISOString());
  // Inicializamos la toxicidad acumulada en 0
  props.setProperty('PURGE_TOTAL_TOXICITY', '0'); 
  
  // C. Trigger
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'runThePurge') ScriptApp.deleteTrigger(t);
  }

  ScriptApp.newTrigger('runThePurge')
      .timeBased()
      .everyDays(1)
      .atHour(23)       // <--- AQUÃƒÂ: Hora (0 a 23)
      .nearMinute(50)   // <--- AQUÃƒÂ: Minuto aproximado
      .create();
      
  registerNews('EVENT', 'Ã¢ËœÂ Ã¯Â¸Â LA PURGA EXPONENCIAL: La presiÃƒÂ³n es global. Cada dÃƒÂ­a la atmÃƒÂ³sfera se vuelve mÃƒÂ¡s tÃƒÂ³xica para todos.');
  SpreadsheetApp.getUi().alert('Ã¢Å“â€¦ Purga Iniciada. Variable global configurada.');
}

function executeDailyPurge() {
  const data = getPurgeRankingData();
  const survivors = data.survivors; // Vienen ordenados de peor a mejor
  const invSheet = SpreadsheetApp.getActive().getSheetByName('INVENTORY');
  
  // 1. PROCESAR EL FOSO (LOS 3 ÃƒÅ¡LTIMOS)
  for (let i = 0; i < 3; i++) {
    let p = survivors[i];
    if (!p) continue;

    // Ã‚Â¿Tiene Adrenalina ACTIVA?
    const invData = invSheet.getDataRange().getValues();
    const adrenalineIdx = invData.findIndex(r => r[0] === p.name && r[1] === 'ADRENALINE_SHOT' && r[2] === 'ACTIVE');

    if (adrenalineIdx !== -1) {
      invSheet.getRange(adrenalineIdx + 1, 3).setValue('USED'); // Consumir
      registerNews('PURGE', `Ã°Å¸â€™â€° **${p.name}** sobrevive al foso gracias a una dosis de adrenalina.`);
      continue; // SE SALVA
    }

    // PENALIZACIÃƒâ€œN POR INACTIVIDAD
    if (p.gamesPlayed < 2) {
       // AquÃƒÂ­ llamarÃƒÂ­as a una funciÃƒÂ³n para restar puntos, ej:
       // applyInactivityPenalty(p.name, -15);
       registerNews('PURGE', `Ã°Å¸â€™â‚¬ **${p.name}** muere por inactividad. PenalizaciÃƒÂ³n de -15 pts aplicada.`);
    }

    // MENSAJE DE ÃƒÅ¡LTIMA VOLUNTAD
    const lastWill = p.lastWill || "No tuvo tiempo de decir nada...";
    registerNews('PURGE', `Ã°Å¸ÂªÂ¦ **${p.name}** ha sido purgado. Su ÃƒÂºltima voluntad: "_${lastWill}_"`);
    
    // FunciÃƒÂ³n que ya tienes para eliminarlo
    eliminatePlayer(p.name);
  }

  // 2. RACHAS Y SUMINISTROS
  survivors.forEach((p, index) => {
    if (index >= 3) { // EstÃƒÂ¡ a salvo
      // LÃƒÂ³gica para incrementar racha en MARKET_STATUS y dar cofre cada 2 noches
      // if (racha % 2 === 0) giveForgeLoot(p.name);
    }
  });
}

// --- HELPER: ASIGNAR OBJETIVOS (RULETA DE 1/3) ---
function assignDailyBounties(sheet) {
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX: Si ejecutamos manual, buscamos la hoja nosotros mismos
    if (!sheet) {
        const ss = SpreadsheetApp.getActive();
        sheet = ss.getSheetByName('MARKET_STATUS');
    }

    const data = sheet.getDataRange().getValues();
    const lastRow = sheet.getLastRow();

    // 1. PRIMERO: Limpiar TODA la columna de objetivos (Columna I / 9)
    if (lastRow > 1) {
        sheet.getRange(2, 9, lastRow - 1, 1).clearContent();
    }

    // 2. Filtrar supervivientes
    const survivors = [];
    for(let i=1; i<data.length; i++) {
        // data[i][6] es Columna G (Status)
        if(data[i][6] !== 'ELIMINATED') {
            survivors.push({ row: i+1, name: data[i][0] });
        }
    }

    if(survivors.length < 2) {
        console.log("No hay suficientes supervivientes para asignar objetivos.");
        return; 
    }

    // 3. Mezclar (Shuffle) aleatorio
    const shuffled = survivors.sort(() => 0.5 - Math.random());

    // 4. Calcular el 1/3 de los jugadores
    let hunterCount = Math.floor(survivors.length / 3);
    if (hunterCount < 1 && survivors.length >= 2) hunterCount = 1;

    console.log(`Ã°Å¸Å½Â¯ Generando ${hunterCount} contratos de caza para ${survivors.length} supervivientes.`);

    // 5. Asignar SOLO a los elegidos
    for(let i=0; i<hunterCount; i++) {
        const hunter = shuffled[i];
        
        // Elegir vÃƒÂ­ctima (un poco alejado en la lista para variedad)
        let targetIndex = (i + hunterCount) % shuffled.length;
        const target = shuffled[targetIndex];
        
        // Escribir en Columna I (9) SOLO en la fila del cazador
        sheet.getRange(hunter.row, 9).setValue(target.name);
    }
}

function getPurgeRankingData() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('EVENT_PURGE_ACTIVE') !== 'TRUE') return { active: false };

  // --- CONFIGURACIÃƒâ€œN AGRESIVA ---
  const BASE_PENALTY = 4.0; 
  const EXP_MULTIPLIER = 2.0;
  const MIN_GAMES_TOTAL = 2;    

  const startDateStr = props.getProperty('EVENT_PURGE_START');
  const startTime = startDateStr ? new Date(startDateStr).getTime() : new Date().getTime();
  const nowTime = new Date().getTime();

  let daysRunning = Math.ceil((nowTime - startTime) / (1000 * 60 * 60 * 24));
  if (daysRunning < 1) daysRunning = 1;

  const currentTotalToxicity = Number(props.getProperty('PURGE_TOTAL_TOXICITY') || 0);
  const nextDrop = BASE_PENALTY * Math.pow(EXP_MULTIPLIER, (daysRunning - 1));

  // --- INFO DEL CLIMA ---
  const weatherID = props.getProperty('PURGE_WEATHER') || 'NEUTRAL';
  let weatherInfo = { icon: 'Ã°Å¸Å’â€˜', name: 'Calma Tensa', desc: 'Sin bonificaciones especiales hoy.' };

  switch (weatherID) {
      case 'BLIND':  weatherInfo = { icon: 'Ã°Å¸â€˜ÂÃ¯Â¸Â', name: 'NOCHE CIEGA', desc: 'La VisiÃƒÂ³n cuenta DOBLE en la media. Ã‚Â¡Comprad Pinks!' }; break;
      case 'BLOOD':  weatherInfo = { icon: 'Ã°Å¸Â©Â¸', name: 'LUNA DE SANGRE', desc: 'Las Kills otorgan puntuaciÃƒÂ³n extra (+0.1 pts/kill).' }; break;
      case 'SIEGE':  weatherInfo = { icon: 'Ã°Å¸Å¡Å“', name: 'ASEDIO', desc: 'Derribar Torres otorga gran bonificaciÃƒÂ³n (+2.0 pts).' }; break;
      case 'ASSIST': weatherInfo = { icon: 'Ã°Å¸Â¤Â', name: 'SINERGIA', desc: 'Media de Asistencias > 12 otorga +3.0 Pts.' }; break;
      case 'HUNT':   weatherInfo = { icon: 'Ã°Å¸Â¦â€ž', name: 'CAZA MAYOR', desc: 'Pentakills, Solo Nashor o Inmortal dan +5.0 Pts.' }; break;
      case 'JUDGE':  weatherInfo = { icon: 'Ã¢Å¡â€“Ã¯Â¸Â', name: 'JUICIO FINAL', desc: 'PELIGRO: Cada Derrota resta -2.0 Pts extra.' }; break;
      case 'MINES':  weatherInfo = { icon: 'Ã°Å¸â€™Â£', name: 'CAMPO DE MINAS', desc: 'PELIGRO: Cada Muerte resta -0.5 Pts a la media.' }; break;
      case 'CALM':   weatherInfo = { icon: 'Ã°Å¸Å’ÂªÃ¯Â¸Â', name: 'OJO DE TORMENTA', desc: 'DÃƒÂ­a de suerte. La penalizaciÃƒÂ³n nocturna serÃƒÂ¡ la mitad.' }; break;
  }

  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const playersSheet = ss.getSheetByName('PLAYERS'); 
  const sabSheet = ss.getSheetByName('PURGE_SABOTAGES');

  const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow()-1, 1).getValues();
  const validPlayers = new Set(pData.map(r => String(r[0]).trim()));
  const marketData = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 10).getValues();
  
  const scoreMap = {};
  const statusMap = {}; 
  const gamesMap = {}; 
  const daysMap = {};    
  const targetMap = {}; 
  const statsMap = {}; 

  // 1. CARGAMOS SABOTAJES ACTIVOS
  const sabotageMap = {}; 
  if (sabSheet && sabSheet.getLastRow() > 1) {
      const sabData = sabSheet.getDataRange().getValues();
      for (let i = 1; i < sabData.length; i++) {
          if (sabData[i][2] === 'ACTIVE') {
              const victim = String(sabData[i][1]).trim(); 
              if (!sabotageMap[victim]) sabotageMap[victim] = 0;
              sabotageMap[victim] += 1.0; 
          }
      }
  }

  marketData.forEach(row => {
      const name = String(row[0]).trim();
      if (validPlayers.has(name)) {
          scoreMap[name] = 0;
          gamesMap[name] = 0; 
          statusMap[name] = row[6] || 'ALIVE';
          daysMap[name] = Number(row[7] || 0); 
          targetMap[name] = String(row[8] || ""); 
          statsMap[name] = { kills: 0, deaths: 0, assists: 0, vision: 0, losses: 0, siegeTagsCount: 0, rareTagsCount: 0 };
      }
  });

  const matches = matchesSheet.getDataRange().getValues();
  for (let i = 1; i < matches.length; i++) {
      const row = matches[i];
      let mDate = (row[1] instanceof Date) ? row[1] : new Date(row[1]);
      
      if (mDate.getTime() >= startTime && scoreMap.hasOwnProperty(row[2])) {
         const pName = row[2];
         scoreMap[pName] += Number(row[12]);
         gamesMap[pName]++;
         
         if (statsMap[pName]) {
             const k = Number(row[6]);
             const d = Number(row[7]);
             const a = Number(row[8]);
             const result = String(row[5]);
             const notes = String(row[13]);
             const kp = Number(row[10]);

             statsMap[pName].kills += k;
             statsMap[pName].deaths += d;
             statsMap[pName].assists += a;
             if (result === 'Loss') statsMap[pName].losses++;
             if (kp > 0.65) statsMap[pName].vision += 1;

             if (notes.includes("World Ender") || notes.includes("xPeke") || notes.includes("Siege Master") || notes.includes("Demoledor Pro")) {
                 statsMap[pName].siegeTagsCount += 1;
             }
             if (notes.includes("Penta") || notes.includes("Solo Nashor") || notes.includes("Inmortal") || notes.includes("Clean Ace")) {
                 statsMap[pName].rareTagsCount += 1;
             }
         }
      }
  }

  const survivors = [];
  const graveyard = [];

  for (const name in statusMap) {
      const status = statusMap[name];
      const totalPoints = scoreMap[name];
      const games = gamesMap[name];
      
      let bonusPoints = 0;
      let extraPenalty = 0;
      let weatherNote = "";

      if (games > 0 && statsMap[name]) {
          const s = statsMap[name];
          const avgKills = s.kills / games;
          const avgAssists = s.assists / games;
          const avgDeaths = s.deaths / games;
          
          if (weatherID === 'BLIND' && s.vision >= 1) { bonusPoints += 2.0; weatherNote = " (Ã°Å¸â€˜ÂÃ¯Â¸Â)"; }
          else if (weatherID === 'BLOOD' && avgKills >= 7) { bonusPoints += (avgKills * 0.3); weatherNote = " (Ã°Å¸Â©Â¸)"; }
          else if (weatherID === 'SIEGE' && s.siegeTagsCount >= 1) { bonusPoints += 4.0; weatherNote = " (Ã°Å¸Å¡Å“)"; }
          else if (weatherID === 'ASSIST' && avgAssists >= 12) { bonusPoints += 3.0; weatherNote = " (Ã°Å¸Â¤Â)"; }
          else if (weatherID === 'HUNT' && s.rareTagsCount >= 1) { bonusPoints += 5.0; weatherNote = " (Ã°Å¸Â¦â€ž)"; }
          
          if (weatherID === 'JUDGE' && s.losses > 0) { extraPenalty += (s.losses * 2.0); weatherNote = " (Ã¢Å¡â€“Ã¯Â¸Â)"; }
          if (weatherID === 'MINES') { extraPenalty += (avgDeaths * 0.5); weatherNote = " (Ã°Å¸â€™Â£)"; }
      }

      let averagePoints = -9999;
      let displayNote = ""; 
      let isPunished = false;

      if (games === 0) {
           averagePoints = -9999;
           displayNote = " (Ã°Å¸â€™â‚¬ AFK)";
           isPunished = true;
      } else {
           // RESTAMOS SABOTAJE Y TOXICIDAD GLOBAL (Sin error NaN)
           let sabotagePenalty = sabotageMap[name] || 0;
           let netPoints = totalPoints - (currentTotalToxicity + sabotagePenalty + extraPenalty);
           
           let realAvg = netPoints / Math.max(games, MIN_GAMES_TOTAL);
           averagePoints = realAvg + bonusPoints;
           
           if (weatherNote) displayNote = weatherNote;
           if (sabotagePenalty > 0) displayNote += " (Ã°Å¸â€™â€°)"; // Icono si te inyectaron veneno
           
           if (averagePoints < 0) isPunished = true; 
      }

      const entry = { 
          name: name, 
          points: averagePoints, 
          displayPoints: `${averagePoints.toFixed(1)}${displayNote}`, 
          games: games,
          isPunished: isPunished,
          days: daysMap[name],      
          target: targetMap[name]
      };

      if (status === 'ELIMINATED') graveyard.push(entry);
      else survivors.push(entry);
  }

  survivors.sort((a, b) => a.points - b.points); 

  return { 
      active: true, 
      survivors: survivors, 
      graveyard: graveyard,
      uiInfo: {
          dayText: `DÃƒÂA ${daysRunning}`,
          penaltyText: `ACUMULADO: -${currentTotalToxicity.toFixed(1)} (HOY CAEN -${nextDrop.toFixed(1)})`,
          weather: weatherInfo 
      }
  };
}

function runThePurge() {
  console.log("Ã¢ÂÂ° EJECUTANDO PURGA (FÃƒâ€œRMULA DILUIDA + AGRESIVA)..."); 
  
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('EVENT_PURGE_ACTIVE') !== 'TRUE') return;

  // --- Ã¢Å¡â„¢Ã¯Â¸Â CONFIGURACIÃƒâ€œN AGRESIVA ---
  const BASE_PENALTY = 4.0;      // SUBIDO A 4.0 (Antes 0.7)
  const EXP_MULTIPLIER = 2.0;    
  const MIN_GAMES_TOTAL = 2;     
  const TAX_RATE = 0.15;
  const BOUNTY_REWARD = 200; 
  // ------------------------

  // 1. CÃƒÂLCULO DE TIEMPO
  const startDateStr = props.getProperty('EVENT_PURGE_START');
  const startTime = startDateStr ? new Date(startDateStr).getTime() : new Date().getTime();
  const nowTime = new Date().getTime();
  
  let daysRunning = Math.ceil((nowTime - startTime) / (1000 * 60 * 60 * 24));
  if (daysRunning < 1) daysRunning = 1;

  const currentWeather = props.getProperty('PURGE_WEATHER') || 'NEUTRAL';
  let todayGlobalPenalty = BASE_PENALTY * Math.pow(EXP_MULTIPLIER, (daysRunning - 1));
  
  if (currentWeather === 'CALM') {
      todayGlobalPenalty = todayGlobalPenalty * 0.5;
  }

  let totalToxicity = Number(props.getProperty('PURGE_TOTAL_TOXICITY') || 0);
  totalToxicity += todayGlobalPenalty;
  props.setProperty('PURGE_TOTAL_TOXICITY', String(totalToxicity));

  if (typeof registerNews === 'function') {
      registerNews('INFO', `Ã¢ËœÂ Ã¯Â¸Â NOCHE ${daysRunning} (${currentWeather}): Toxicidad sube -${todayGlobalPenalty.toFixed(1)}. Total Acumulado: -${totalToxicity.toFixed(1)} pts.`);
  }

  // --- 2. CARGA DE DATOS ---
  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const matchesSheet = ss.getSheetByName('MATCHES');
  const playersSheet = ss.getSheetByName('PLAYERS'); 
  const portfolioSheet = ss.getSheetByName('PORTFOLIO'); 
  const invSheet = ss.getSheetByName('INVENTORY');
  const sabSheet = ss.getSheetByName('PURGE_SABOTAGES');

  let portfolioData = [];
  if (portfolioSheet && portfolioSheet.getLastRow() > 1) {
      portfolioData = portfolioSheet.getRange(2, 1, portfolioSheet.getLastRow()-1, 3).getValues();
  }
  
  const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow()-1, 1).getValues();
  const validPlayers = new Set(pData.map(r => String(r[0]).trim()));
  const marketData = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 9).getValues();

  // --- 3. SABOTAJES ---
  const sabotageMap = {}; 
  if (sabSheet && sabSheet.getLastRow() > 1) {
      const sabData = sabSheet.getDataRange().getValues();
      for (let i = 1; i < sabData.length; i++) {
          if (sabData[i][2] === 'ACTIVE') {
              const victim = String(sabData[i][1]).trim(); 
              if (!sabotageMap[victim]) sabotageMap[victim] = 0;
              sabotageMap[victim] += 1.0; 
              sabSheet.getRange(i + 1, 3).setValue('USED'); 
          }
      }
  }

  // --- 4. MÃƒÂSCARAS ---
  const maskMap = {}; 
  if (invSheet && invSheet.getLastRow() > 1) {
      const invData = invSheet.getDataRange().getValues();
      for (let i = 1; i < invData.length; i++) {
          if (invData[i][1] === 'GAS_MASK' && invData[i][2] === 'ACTIVE') {
              maskMap[String(invData[i][0]).trim()] = i + 1; 
          }
      }
  }

  // --- 5. CANDIDATOS ---
  const candidates = []; 
  const scoreMap = {};
  const gamesMap = {}; 
  const statsMap = {}; 
  const priceMap = {}; 
  const finalScoresByName = {}; 

  for(let i=0; i<marketData.length; i++) {
      const name = String(marketData[i][0]).trim();
      const price = Number(marketData[i][1]);
      const currentWallet = Number(marketData[i][2]);
      const status = marketData[i][6] || 'ALIVE';
      const daysSurvived = Number(marketData[i][7] || 0); 
      const bountyTarget = String(marketData[i][8] || "");
      
      priceMap[name] = price;

      if (validPlayers.has(name) && status !== 'ELIMINATED') {
          scoreMap[name] = 0;
          gamesMap[name] = 0;
          statsMap[name] = { kills: 0, deaths: 0, assists: 0, losses: 0, vision: 0, siegeTagsCount: 0, rareTagsCount: 0 };
          
          candidates.push({ 
              name: name, 
              row: i + 2, 
              price: price, 
              wallet: currentWallet,
              days: daysSurvived,
              target: bountyTarget,
              sortScore: -9999 
          });
      }
  }

  if (candidates.length === 0) return;

  // --- 6. PROCESAR PARTIDAS ---
  const matches = matchesSheet.getDataRange().getValues();
  for(let i=1; i<matches.length; i++) {
      const row = matches[i];
      let mDate = (row[1] instanceof Date) ? row[1] : new Date(row[1]);
      
      if (mDate.getTime() >= startTime && scoreMap.hasOwnProperty(row[2])) {
         const pName = row[2];
         scoreMap[pName] += Number(row[12]); 
         gamesMap[pName]++; 
         
         const k = Number(row[6]);
         const d = Number(row[7]);
         const a = Number(row[8]);
         const result = String(row[5]);
         const notes = String(row[13]);
         const kp = Number(row[10]);

         statsMap[pName].kills += k;
         statsMap[pName].deaths += d;
         statsMap[pName].assists += a;
         if (result === 'Loss') statsMap[pName].losses++;
         if (kp > 0.65) statsMap[pName].vision += 1;

         if (notes.includes("World Ender") || notes.includes("xPeke") || notes.includes("Siege Master") || notes.includes("Demoledor Pro")) {
             statsMap[pName].siegeTagsCount += 1;
         }
         if (notes.includes("Penta") || notes.includes("Solo Nashor") || notes.includes("Inmortal") || notes.includes("Clean Ace")) {
             statsMap[pName].rareTagsCount += 1;
         }
      }
  }

  // --- 7. CÃƒÂLCULO DE NOTA FINAL (FÃƒâ€œRMULA NUEVA) ---
  candidates.forEach(c => {
      const total = scoreMap[c.name];
      const games = gamesMap[c.name];
      let bonusPoints = 0;
      let extraPenalty = 0; 
      
      let weatherNote = "";
      let sabotageNote = "";

      if (games > 0) {
          const s = statsMap[c.name];
          const avgKills = s.kills / games;
          const avgAssists = s.assists / games;
          const avgDeaths = s.deaths / games;
          
          if (currentWeather === 'BLIND' && s.vision >= 1.5) { bonusPoints += 2.0; weatherNote = " (Ã°Å¸â€˜ÂÃ¯Â¸Â VisiÃƒÂ³n)"; }
          else if (currentWeather === 'BLOOD' && avgKills >= 11) { bonusPoints += (avgKills * 0.1); weatherNote = " (Ã°Å¸Â©Â¸ Sangre)"; }
          else if (currentWeather === 'SIEGE' && s.siegeTagsCount >= 1) { bonusPoints += 2.0; weatherNote = " (Ã°Å¸Å¡Å“ Asedio)"; }
          else if (currentWeather === 'ASSIST' && avgAssists >= 15) { bonusPoints += 2.0; weatherNote = " (Ã°Å¸Â¤Â Sinergia)"; }
          else if (currentWeather === 'HUNT' && s.rareTagsCount >= 1) { bonusPoints += 5.0; weatherNote = " (Ã°Å¸Â¦â€ž Legendario)"; }
          
          if (currentWeather === 'JUDGE' && s.losses > 0) { extraPenalty += (s.losses * 2.0); weatherNote = ` (Ã¢Å¡â€“Ã¯Â¸Â -${extraPenalty} Juicio)`; }
          if (currentWeather === 'MINES') { const deathPen = (avgDeaths * 0.1); extraPenalty += deathPen; weatherNote = ` (Ã°Å¸â€™Â£ -${deathPen.toFixed(1)} Minas)`; }
      }

      let sabotagePenalty = sabotageMap[c.name] || 0;
      if (sabotagePenalty > 0) {
          if (maskMap[c.name]) {
              sabotagePenalty = 0;
              sabotageNote = " Ã°Å¸â€ºÂ¡Ã¯Â¸Â BLOCK";
              invSheet.getRange(maskMap[c.name], 3).setValue('USED');
          } else {
              sabotageNote = ` Ã°Å¸â€™â€° -${sabotagePenalty}`;
          }
      }

      if (games === 0) {
          c.sortScore = -9999; 
          c.note = "(AFK)";
      } else {
          // --- FÃƒâ€œRMULA DILUIDA ---
          let netPoints = total - (totalToxicity + sabotagePenalty + extraPenalty);
          let realAvg = netPoints / Math.max(games, MIN_GAMES_TOTAL);
          let finalScore = realAvg + bonusPoints;
          
          c.sortScore = finalScore;
          c.note = `Diluida:${finalScore.toFixed(1)}${weatherNote} | Toxicidad:-${totalToxicity.toFixed(1)}${sabotageNote}`;
      }
      
      finalScoresByName[c.name] = c.sortScore;
  });

  // --- 8. FASE BOUNTIES 2.0: DEPREDADOR vs PRESA ---
  // (Mantengo tu cÃƒÂ³digo de Bounties 2.0 que ya tenÃƒÂ­as, funciona bien con c.sortScore)
  let bountyNews = [];
  const candidateMap = {};
  candidates.forEach((c, index) => { candidateMap[c.name] = index; });

  candidates.forEach(hunter => {
      if (hunter.target && candidateMap.hasOwnProperty(hunter.target)) {
          const preyIndex = candidateMap[hunter.target];
          const prey = candidates[preyIndex]; 
          const hunterScore = hunter.sortScore;
          const preyScore = prey.sortScore;

          if (hunterScore > -9000) {
              if (hunterScore > preyScore) {
                  let stealAmount = Math.floor(prey.wallet * 0.1);
                  stealAmount = Math.max(150, Math.min(stealAmount, 400));
                  hunter.wallet += stealAmount;
                  prey.wallet = Math.max(0, prey.wallet - stealAmount); 
                  marketSheet.getRange(hunter.row, 3).setValue(hunter.wallet);
                  marketSheet.getRange(prey.row, 3).setValue(prey.wallet);
                  bountyNews.push(`Ã°Å¸Â©Â¸ **${hunter.name}** cazÃƒÂ³ a ${prey.name}. Le robÃƒÂ³ **${stealAmount} G**.`);
              }
              else if (preyScore > hunterScore) {
                  let counterAmount = Math.floor(hunter.wallet * 0.10);
                  counterAmount = Math.max(100, Math.min(counterAmount, 300));
                  prey.wallet += counterAmount;
                  hunter.wallet = Math.max(0, hunter.wallet - counterAmount);
                  marketSheet.getRange(hunter.row, 3).setValue(hunter.wallet);
                  marketSheet.getRange(prey.row, 3).setValue(prey.wallet);
                  bountyNews.push(`Ã°Å¸â€ºÂ¡Ã¯Â¸Â **${prey.name}** se defendiÃƒÂ³ de ${hunter.name}. Le quitÃƒÂ³ **${counterAmount} G**.`);
              }
          }
      }
  });

  if (bountyNews.length > 0 && typeof registerNews === 'function') {
      const newsSlice = bountyNews.slice(0, 5).join('\n');
      registerNews('BOUNTY', `Ã¢Å¡â€Ã¯Â¸Â **REPORTE DE CACERÃƒÂA:**\n${newsSlice}`);
  }

  // --- 9. FASE ELIMINACIÃƒâ€œN INTELIGENTE ---
  candidates.sort((a, b) => {
      if (a.sortScore !== b.sortScore) return a.sortScore - b.sortScore;
      return a.price - b.price; 
  });

  let victims = [];
  let survivors = [];
  const totalAlive = candidates.length;

  if (totalAlive <= 1) {
      survivors = candidates;
  } 
  else if (totalAlive <= 4) {
      const numToKill = totalAlive - 1;
      victims = candidates.slice(0, numToKill);
      survivors = candidates.slice(numToKill);
  } 
  else {
      victims = candidates.slice(0, 3);
      survivors = candidates.slice(3);
  }

  let lootPool = 0;         

  victims.forEach(v => {
      let stockWealth = 0;
      portfolioData.forEach(row => {
          if (String(row[0]).trim() === v.name) {
              stockWealth += (Number(row[2]) * (priceMap[String(row[1]).trim()] || 0));
          }
      });
      const netWorth = v.wallet + stockWealth;
      let taxPaid = netWorth > 0 ? Math.floor(netWorth * TAX_RATE) : 0;
      const newWallet = v.wallet - taxPaid;
      let newPrice = Math.max(1, v.price * 0.80);

      lootPool += taxPaid;

      marketSheet.getRange(v.row, 2).setValue(newPrice);
      marketSheet.getRange(v.row, 3).setValue(newWallet);
      marketSheet.getRange(v.row, 4).setValue('Ã°Å¸â€œâ€°');
      marketSheet.getRange(v.row, 7).setValue('ELIMINATED');
      marketSheet.getRange(v.row, 9).setValue(''); 

      const msg = `Ã¢ËœÂ Ã¯Â¸Â ELIMINADO: ${v.name} [${v.note}]. Impuesto: -${taxPaid} G.`;
      console.log(msg);
      if (typeof registerNews === 'function') registerNews('PURGE', msg);
  });

  // --- 10. REPARTO DE BOTÃƒÂN ---
  if (survivors.length > 0 && lootPool > 0) {
      const reward = lootPool / survivors.length;
      survivors.forEach(s => {
          s.wallet += reward;
          marketSheet.getRange(s.row, 3).setValue(s.wallet);
      });
      if (typeof registerNews === 'function') {
          registerNews('DEAL', `Ã°Å¸â€ºÂ¡Ã¯Â¸Â BotÃƒÂ­n repartido: +${reward.toFixed(0)}G a cada superviviente.`);
      }
  }

  // --- 11. PREMIOS VETERANÃƒÂA ---
  let chestWinners = [];
  survivors.forEach(s => {
      const newDays = s.days + 1;
      marketSheet.getRange(s.row, 8).setValue(newDays); 
      if (newDays % 3 === 0) {
          if (invSheet) {
              invSheet.appendRow([s.name, 'CHEST_HEXTECH', 'ACTIVE', new Date()]);
              chestWinners.push(s.name);
          }
      }
  });
  if (chestWinners.length > 0 && typeof registerNews === 'function') {
      registerNews('REWARD', `Ã°Å¸Å½Â ${chestWinners.length} veteranos reciben un Cofre Hextech.`);
  }

  // --- 11.5 CHEQUEO DE VICTORIA ---
  if (survivors.length === 1 && victims.length > 0) {
      const winner = survivors[0];
      marketSheet.getRange(winner.row, 7).setValue('Ã°Å¸â€˜â€˜ WINNER');
      const jackpot = 3000; 
      const newBalance = winner.wallet + jackpot;
      marketSheet.getRange(winner.row, 3).setValue(newBalance);
      marketSheet.getRange(winner.row, 4).setValue('Ã°Å¸â€˜â€˜');

      const winMsg = `Ã°Å¸Ââ€ Ã°Å¸â€˜â€˜ Ã‚Â¡TENEMOS UN GANADOR! ${winner.name} es el ÃƒÂºltimo superviviente de La Purga. Se lleva el Bote de +${jackpot} G.`;
      if (typeof registerNews === 'function') registerNews('WIN', winMsg);
      
      props.setProperty('EVENT_PURGE_ACTIVE', 'FALSE');
      const triggers = ScriptApp.getProjectTriggers();
      for (const t of triggers) { 
          if (t.getHandlerFunction() === 'runThePurge') ScriptApp.deleteTrigger(t); 
      }
      SpreadsheetApp.getUi().alert(`Ã°Å¸Ââ€  LA PURGA HA TERMINADO.\nGanador: ${winner.name}`);
      return; 
  }

  // --- 12. SORTEO CLIMA MAÃƒâ€˜ANA ---
  const weathers = [
      {id: 'NEUTRAL', prob: 24, txt: 'Ã°Å¸Å’â€˜ Calma tensa. Sin efectos especiales.'},
      {id: 'BLIND',   prob: 12, txt: 'Ã°Å¸â€˜ÂÃ¯Â¸Â NOCHE CIEGA: La visiÃƒÂ³n cuenta DOBLE. Ã‚Â¡Comprad Pinks!'},
      {id: 'BLOOD',   prob: 13, txt: 'Ã°Å¸Â©Â¸ LUNA DE SANGRE: Kills > 11 dan puntos masivos.'},
      {id: 'SIEGE',   prob: 8, txt: 'Ã°Å¸Å¡Å“ ASEDIO: Solo cuentan hazaÃƒÂ±as de torres.'},
      {id: 'ASSIST',  prob: 12, txt: 'Ã°Å¸Â¤Â SINERGIA: Media de Asistencias > 15 otorga +2 Pts.'},
      {id: 'HUNT',    prob: 5,  txt: 'Ã°Å¸Â¦â€ž CAZA MAYOR: Solo cuentan Pentas, Solo Nashor o Inmortal.'},
      {id: 'JUDGE',   prob: 10, txt: 'Ã¢Å¡â€“Ã¯Â¸Â JUICIO FINAL: Las derrotas restan -2.0 Puntos EXTRA.'},
      {id: 'MINES',   prob: 8, txt: 'Ã°Å¸â€™Â£ CAMPO DE MINAS: Cada muerte resta -0.1 Puntos a la media.'},
      {id: 'CALM',    prob: 8,  txt: 'Ã°Å¸Å’ÂªÃ¯Â¸Â OJO DE LA TORMENTA: La penalizaciÃƒÂ³n global serÃƒÂ¡ la mitad.'}
  ];
  
  let roll = Math.random() * 100;
  let nextWeather = weathers[0];
  let accum = 0;
  
  for (let w of weathers) {
      accum += w.prob;
      if (roll <= accum) { nextWeather = w; break; }
  }
  
  props.setProperty('PURGE_WEATHER', nextWeather.id);
  if (typeof registerNews === 'function') registerNews('WEATHER', `Ã°Å¸Å’Â©Ã¯Â¸Â PRONÃƒâ€œSTICO MAÃƒâ€˜ANA: ${nextWeather.txt}`);

  if (typeof assignDailyBounties === 'function') assignDailyBounties(marketSheet);
  
  if (typeof logToSheet === 'function') logToSheet("Ã¢Å“â€¦ Purga Completa Ejecutada.");
}

function stopPurgeEvent() {
  PropertiesService.getScriptProperties().setProperty('EVENT_PURGE_ACTIVE', 'FALSE');
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) { if (t.getHandlerFunction() === 'runThePurge') ScriptApp.deleteTrigger(t); }
  SpreadsheetApp.getUi().alert('Evento detenido.');
}

function configurarFechaPurga() {
  const props = PropertiesService.getScriptProperties();
  
  // Ã°Å¸â€˜â€¡ ESCRIBE AQUÃƒÂ LA FECHA DEL LUNES (Formato: AÃƒÂ±o-Mes-DÃƒÂ­a)
  // Por ejemplo: Si el lunes fue dÃƒÂ­a 26, pon '2026-01-26'
  const fechaLunes = '2026-01-26'; 
  
  // Guardamos la configuraciÃƒÂ³n
  props.setProperty('EVENT_PURGE_START', fechaLunes);
  props.setProperty('EVENT_PURGE_ACTIVE', 'TRUE'); 
  
  console.log(`Ã¢Å“â€¦ CONFIGURACIÃƒâ€œN GUARDADA`);
  console.log(`La Purga ahora empieza a contar desde el: ${fechaLunes}`);
  console.log(`Si hoy es Jueves, el sistema calcularÃƒÂ¡ 3 o 4 dÃƒÂ­as de penalizaciÃƒÂ³n (-6 o -8 pts).`);
}

function deleteTriggerByName(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(t);
    }
  }
}

/* ==========================================================
   Ã°Å¸â€˜Â¾ EVENTO: LA HORDA DEL VACÃƒÂO (COOP GLOBAL)
   ========================================================== */

function startVoidHorde() {
  const props = PropertiesService.getScriptProperties();
  const ui = SpreadsheetApp.getUi();
  
  // ConfiguraciÃƒÂ³n
  const TARGET_KILLS = 500; 
  
  props.setProperties({
    'EVENT_VOID_ACTIVE': 'TRUE',
    'VOID_KILLS_CURRENT': '0',
    'VOID_KILLS_TARGET': String(TARGET_KILLS),
    'VOID_STATUS': 'IN_PROGRESS'
  });
  
  registerNews('EVENT', `Ã°Å¸â€˜Â¾ Ã‚Â¡PORTAL ABIERTO! La Horda del VacÃƒÂ­o invade la grieta. Objetivo global: ${TARGET_KILLS} Kills.`);
  ui.alert('Evento Horda del VacÃƒÂ­o INICIADO.');
}

function updateVoidHordeProgress(killsInMatch) {
   const props = PropertiesService.getScriptProperties();
   // Solo si el evento estÃƒÂ¡ activo
   if (props.getProperty('EVENT_VOID_ACTIVE') !== 'TRUE') return;
   if (props.getProperty('VOID_STATUS') !== 'IN_PROGRESS') return;

   let currentKills = Number(props.getProperty('VOID_KILLS_CURRENT') || 0);
   let targetKills = Number(props.getProperty('VOID_KILLS_TARGET') || 500);
   
   currentKills += killsInMatch;
   props.setProperty('VOID_KILLS_CURRENT', String(currentKills));

   // Check Hito (Solo notificar una vez al completar)
   if (currentKills >= targetKills) {
       props.setProperty('VOID_STATUS', 'VICTORY_PENDING'); // Espera a finalizar para dar premios
       registerNews('EVENT', `Ã°Å¸â€˜Â¾ Ã‚Â¡OBJETIVO ALCANZADO! La comunidad ha logrado ${currentKills}/${targetKills} kills. El portal se cerrarÃƒÂ¡ pronto.`);
   }
}

function endVoidHorde() {
  const props = PropertiesService.getScriptProperties();
  const ui = SpreadsheetApp.getUi();
  
  if (props.getProperty('EVENT_VOID_ACTIVE') !== 'TRUE') {
    ui.alert("El evento no estÃƒÂ¡ activo.");
    return;
  }

  const current = Number(props.getProperty('VOID_KILLS_CURRENT'));
  const target = Number(props.getProperty('VOID_KILLS_TARGET'));
  const ss = SpreadsheetApp.getActive();
  
  if (current >= target) {
    // --- VICTORIA: COFRE PARA TODOS ---
    registerNews('EVENT', `Ã¢Å“Â¨ Ã‚Â¡VICTORIA! La Horda ha sido rechazada (${current} kills). Todos reciben un Cofre Hextech.`);
    
    const invSheet = ss.getSheetByName('INVENTORY');
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const players = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 1).getValues().flat();
    
    players.forEach(p => {
       invSheet.appendRow([p, 'CHEST_HEXTECH', 'ACTIVE', new Date()]);
    });
    ui.alert("Ã‚Â¡Victoria! Premios repartidos.");

  } else {
    // --- DERROTA: CRASH DEL MERCADO ---
    registerNews('CRASH', `Ã°Å¸â€™â‚¬ FRACASO. Solo ${current}/${target} kills. El VacÃƒÂ­o corrompe la economÃƒÂ­a: -10% en todas las acciones.`);
    
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const prices = marketSheet.getRange(2, 2, marketSheet.getLastRow()-1, 1).getValues();
    
    for(let i=0; i<prices.length; i++) {
       let newPrice = prices[i][0] * 0.85; // -15%
       if(newPrice < 1) newPrice = 1;
       marketSheet.getRange(i+2, 2).setValue(newPrice);
       marketSheet.getRange(i+2, 4).setValue('Ã°Å¸â€œâ€°');
    }
    ui.alert("Derrota. Mercado crasheado.");
  }
  
  // Apagar evento
  props.setProperty('EVENT_VOID_ACTIVE', 'FALSE');
}

// FunciÃƒÂ³n para que la web lea el progreso (Barra de carga)
function getVoidHordeStatus() {
  const props = PropertiesService.getScriptProperties();
  return {
    active: props.getProperty('EVENT_VOID_ACTIVE') === 'TRUE',
    current: Number(props.getProperty('VOID_KILLS_CURRENT') || 0),
    target: Number(props.getProperty('VOID_KILLS_TARGET') || 500)
  };
}

/* --- FUNCIÃƒâ€œN FALTANTE: ENVIAR ESTADO DE EVENTOS A LA WEB --- */
function getActiveEventsForWeb() {
  const props = PropertiesService.getScriptProperties();
  
  return {
    purge: {
      active: props.getProperty('EVENT_PURGE_ACTIVE') === 'TRUE',
      title: "Ã°Å¸â€™â‚¬ LA PURGA",
      desc: "El peor jugador del dÃƒÂ­a perderÃƒÂ¡ el 20% de su oro."
    },
    voidHorde: {
      active: props.getProperty('EVENT_VOID_ACTIVE') === 'TRUE',
      current: Number(props.getProperty('VOID_KILLS_CURRENT') || 0),
      target: Number(props.getProperty('VOID_KILLS_TARGET') || 500),
      status: props.getProperty('VOID_STATUS')
    }
  };
}
/* ----------------- USAR OBJETOS DESDE INVENTARIO (CORREGIDO) ----------------- */
function useInventoryItem(player, itemID) {
  const lock = LockService.getScriptLock();
  
  // Ã°Å¸â€Â§ FIX: Aumentamos el tiempo de espera de 3000 a 15000 (15 segundos)
  // Esto evita el error "Inventario ocupado" si el sistema va un poco lento.
  if (!lock.tryLock(15000)) {
      return { success: false, msg: "Ã¢Å¡Â Ã¯Â¸Â El sistema estÃƒÂ¡ saturado. Espera 10 segundos y vuelve a intentar." };
  }

  try {
    const ss = SpreadsheetApp.getActive();
    const invSheet = ss.getSheetByName('INVENTORY');
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const txSheet = ss.getSheetByName('TRANSACTIONS');
    const portSheet = ss.getSheetByName('PORTFOLIO'); 

    // 1. Buscar el objeto ACTIVO en el inventario del jugador
    const data = invSheet.getDataRange().getValues();
    let itemRow = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === player && data[i][1] === itemID && data[i][2] === 'ACTIVE') {
        itemRow = i + 1; 
        break; 
      }
    }

    if (itemRow === -1) return { success: false, msg: "No tienes este objeto o ya fue usado." };

    // 2. LÃƒâ€œGICA DEL COFRE / ONE PIECE
    if (itemID === 'CHEST_HEXTECH' || itemID === 'ONE_PIECE') { 
       
       // A. Marcar como USADO inmediatamente
       invSheet.getRange(itemRow, 3).setValue('USED');

       // B. Buscar fila del jugador
       const mData = marketSheet.getDataRange().getValues();
       let playerRow = -1;
       for(let i=1; i<mData.length; i++) {
         if(mData[i][0] === player) { playerRow = i+1; break; }
       }
       
       // C. Ejecutar la Ruleta
       const rng = Math.random() * 100;
       let rewardMsg = "";
       let visualWinner = "";
       let type = "NEUTRAL";
       let newBalance = Number(marketSheet.getRange(playerRow, 3).getValue());

       // 1. BASURA (25%)
       if (rng < 25) {
           const trashGold = 10; 
           newBalance += trashGold;
           marketSheet.getRange(playerRow, 3).setValue(newBalance);
           rewardMsg = `Ã°Å¸â€™Â© Chatarra: El One Piece era mentira. Te dan ${trashGold} G por el cofre vacÃƒÂ­o.`;
           visualWinner = `Ã°Å¸â€™Â© Chatarra (${trashGold} G)`;
       }
       // 2. CONSUMIBLE (25%)
       else if (rng < 50) {
           const items = ['POTION_ELO', 'SOBORNO','ANGEL_GUARD','PACT_STREAK'];
           const itemNames = {'POTION_ELO': 'Ã°Å¸Â§Âª PociÃƒÂ³n', 'SOBORNO': 'Ã°Å¸â€™Â° Soborno', 'ANGEL_GUARD': 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ÃƒÂngel', 'PACT_STREAK': 'Ã°Å¸â€Â¥ Pacto'};
           const wonItem = items[Math.floor(Math.random() * items.length)];
           
           invSheet.appendRow([player, wonItem, 'ACTIVE', new Date()]);
           
           rewardMsg = `Ã°Å¸Å½â€™ Has encontrado: **${itemNames[wonItem]}**.`;
           visualWinner = itemNames[wonItem];
       }
       // 3. ACCIONES (30%)
       else if (rng < 80) {
           const totalShares = Math.floor(Math.random() * 3) + 3; 
           const allPlayers = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 1).getValues().flat();
           const randomTarget = allPlayers[Math.floor(Math.random() * allPlayers.length)];
           
           if(portSheet) portSheet.appendRow([player, randomTarget, totalShares, 0]);
           
           rewardMsg = `Ã°Å¸â€œË† Insider: Encuentras ${totalShares} acciones de ${randomTarget}.`;
           visualWinner = `Ã°Å¸â€œË† ${totalShares}x ${randomTarget}`;
           type = "LUCKY";
       }
       // 4. ORO PURO (19%)
       else if (rng < 99) {
           const gold = Math.floor(Math.random() * 700) + 800; 
           newBalance += gold;
           marketSheet.getRange(playerRow, 3).setValue(newBalance);
           rewardMsg = `Ã°Å¸â€™Â° Ã‚Â¡Tesoro! Encuentras **${gold} G**.`;
           visualWinner = `Ã°Å¸â€™Â° Saco (${gold} G)`;
       }
       // 5. JACKPOT (1%)
       else {
           const jack = 5000;
           newBalance += jack;
           marketSheet.getRange(playerRow, 3).setValue(newBalance);
           rewardMsg = `Ã°Å¸Å¡Â¨ **Ã‚Â¡EL ONE PIECE EXISTE!** JACKPOT DE ${jack} G.`;
           visualWinner = "Ã°Å¸Å¡Â¨ ONE PIECE";
           type = "HYPE";
       }

       if (type === "HYPE") registerNews('GACHA', `${player} ha encontrado el ONE PIECE.`);

       return { success: true, msg: rewardMsg, winnerItem: visualWinner };
    }

    return { success: false, msg: "Este objeto no se puede usar manualmente (es pasivo)." };

  } catch(e) {
    return { success: false, msg: "Error: " + e.message };
  } finally {
    lock.releaseLock(); // Soltar candado siempre
  }
}

/* ==========================================================
   Ã°Å¸â€™Â£ EVENTO: LA PATATA CALIENTE (HOT POTATO)
   ========================================================== */

// 1. INICIAR EL EVENTO (El Admin lo lanza manualmente o por trigger)
function startHotPotato() {
  const ss = SpreadsheetApp.getActive();
  const invSheet = ss.getSheetByName('INVENTORY');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  
  // Limpiar bombas anteriores
  const data = invSheet.getDataRange().getValues();
  // (Opcional: borrar filas antiguas con HOT_POTATO, aquÃƒÂ­ lo simplificamos aÃƒÂ±adiendo una nueva)
  
  // Elegir una vÃƒÂ­ctima aleatoria del Mercado
  const players = marketSheet.getRange(2, 1, marketSheet.getLastRow()-1, 1).getValues().flat();
  const victim = players[Math.floor(Math.random() * players.length)];
  
  // Darle la bomba
  // Formato: [Player, ItemID, Status, Date]
  invSheet.appendRow([victim, 'HOT_POTATO', 'ACTIVE', new Date()]);
  
  registerNews('BOMB', `Ã°Å¸â€™Â£ Ã‚Â¡LA PATATA CALIENTE! Se la ha quedado ${victim}. Ã‚Â¡Si pierde, EXPLOTA!`);
  SpreadsheetApp.getUi().alert(`Ã°Å¸â€™Â£ Bomba entregada a: ${victim}`);
}

/* ------------------------------------------------
   Ã°Å¸Â§Â¯ DETENER LA PATATA CALIENTE (MANUAL)
   Borra cualquier bomba activa del inventario.
   ------------------------------------------------ */
function stopHotPotato() {
  const ss = SpreadsheetApp.getActive();
  const invSheet = ss.getSheetByName('INVENTORY');
  const ui = SpreadsheetApp.getUi();
  
  if (!invSheet) return;

  const data = invSheet.getDataRange().getValues();
  let deletedCount = 0;

  // Recorremos de abajo a arriba para borrar filas sin romper ÃƒÂ­ndices
  for (let i = data.length - 1; i >= 1; i--) {
    // Si el objeto es HOT_POTATO y estÃƒÂ¡ ACTIVE
    if (data[i][1] === 'HOT_POTATO' && data[i][2] === 'ACTIVE') {
      invSheet.deleteRow(i + 1); // +1 porque el array empieza en 0 y las filas en 1
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    // Opcional: Avisar en noticias que el admin parÃƒÂ³ el juego
    if (typeof registerNews === 'function') {
        registerNews('INFO', 'Ã°Å¸Â§Â¯ El Admin ha desactivado la Patata Caliente. Nadie explota hoy.');
    }
    ui.alert(`Ã¢Å“â€¦ Evento detenido.\nSe han desactivado ${deletedCount} bomba(s).`);
  } else {
    ui.alert('Ã¢â€žÂ¹Ã¯Â¸Â No se encontrÃƒÂ³ ninguna Patata Caliente activa.');
  }
}

// 2. LÃƒâ€œGICA DE PASE O EXPLOSIÃƒâ€œN (Llamar dentro de processMatch)
function handleHotPotato(player, result, matchId) {
  const ss = SpreadsheetApp.getActive();
  const invSheet = ss.getSheetByName('INVENTORY');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const scoresSheet = ss.getSheetByName('SCORES');

  // A. Buscar si el jugador tiene la bomba ACTIVA
  const invData = invSheet.getDataRange().getValues();
  let bombRow = -1;
  
  for (let i = 1; i < invData.length; i++) {
    if (invData[i][0] === player && invData[i][1] === 'HOT_POTATO' && invData[i][2] === 'ACTIVE') {
      bombRow = i + 1;
      break;
    }
  }

  if (bombRow === -1) return; // No tiene la bomba, no hacemos nada

  // B. CASO DERROTA: Ã‚Â¡EXPLOSIÃƒâ€œN! Ã°Å¸â€™Â¥
  if (result !== 'Win') {
      // 1. Quitar bomba
      invSheet.getRange(bombRow, 3).setValue('EXPLODED');
      
      // 2. Aplicar PenalizaciÃƒÂ³n (Dinero y Acciones)
      // Buscar fila en mercado
      const mData = marketSheet.getDataRange().getValues();
      let mRow = -1;
      for(let i=1; i<mData.length; i++) { if(mData[i][0] === player) { mRow = i+1; break; } }
      
      if (mRow !== -1) {
          const currentBal = Number(marketSheet.getRange(mRow, 3).getValue());
          const currentPrice = Number(marketSheet.getRange(mRow, 2).getValue());
          
          marketSheet.getRange(mRow, 3).setValue(Math.max(0, currentBal - 500)); // 500G
          marketSheet.getRange(mRow, 2).setValue(Math.max(1, currentPrice * 0.85)); // -15% Valor
          marketSheet.getRange(mRow, 4).setValue('Ã°Å¸Â¤â€¢'); // Icono herido

          const txSheet = ss.getSheetByName('TRANSACTIONS');
          if(txSheet) {
              txSheet.appendRow([new Date(), 'BOMB_TIMEOUT', player, 'Hot Potato', 1, -500]);
          }
          
          registerNews('BOOM', `Ã°Å¸â€™Â¥ Ã‚Â¡BOOM! La patata ha explotado en manos de ${player}. Pierde 500G y un 15% de valor.`);
      }
  }
  
  // C. CASO VICTORIA: Ã‚Â¡PASE AL SIGUIENTE! Ã°Å¸ÂÂ
  else {
      // 1. Desactivar bomba actual (Pase exitoso)
      invSheet.getRange(bombRow, 3).setValue('PASSED');
      
      // 2. Encontrar al siguiente vÃƒÂ­ctima (El que estÃƒÂ© DEBAJO en el ranking)
      const sData = scoresSheet.getDataRange().getValues();
      // Asumimos que SCORES estÃƒÂ¡ ordenado o lo ordenamos nosotros por puntos
      // Filtramos header y ordenamos desc
      const ranking = sData.slice(1).sort((a,b) => b[1] - a[1]).map(r => r[0]);
      
      let myIndex = ranking.indexOf(player);
      let nextIndex = myIndex + 1;
      if (nextIndex >= ranking.length) nextIndex = 0; // Si es el ÃƒÂºltimo, pasa al primero (ciclo)
      
      const nextVictim = ranking[nextIndex];
      
      // 3. Dar bomba al siguiente
      invSheet.appendRow([nextVictim, 'HOT_POTATO', 'ACTIVE', new Date()]);
      
      registerNews('PASS', `Ã°Å¸ÂÂ Ã‚Â¡SALVADO! ${player} gana y le pasa la Ã°Å¸â€™Â£ Patata Caliente a ${nextVictim}.`);
  }
}

/* ==========================================================
   Ã¢Å¡â€Ã¯Â¸Â EVENTO SEMANAL: GUERRA DE FACCIONES (HEXTECH VS CHEMTECH)
   ========================================================== */
function startFactionWar() {
  const ss = SpreadsheetApp.getActive();
  const scoresSheet = ss.getSheetByName('SCORES');
  let factionSheet = ss.getSheetByName('FACTIONS');
  const props = PropertiesService.getScriptProperties();

  // 1. Crear o Limpiar Hoja (Borrado completo para evitar residuos)
  if (!factionSheet) {
    factionSheet = ss.insertSheet('FACTIONS');
  } else {
    factionSheet.clear(); 
  }

  // 2. Establecer Cabeceras (AHORA INCLUYE 'Votes' EN E1)
  factionSheet.getRange('A1:E1')
      .setValues([['Player', 'Team', 'StartPoints', 'Role', 'Votes']])
      .setFontWeight('bold')
      .setBackground("#d9ead3"); // Color verde suave para diferenciar

  // 3. Obtener jugadores
  const lastRow = scoresSheet.getLastRow();
  if (lastRow < 2) return; // Seguridad si no hay datos

  const data = scoresSheet.getRange(2, 1, lastRow - 1, 2).getValues(); 
  // data[i][0] = Name, data[i][1] = Points
  
  // Ordenar por puntos para equilibrar los equipos
  data.sort((a, b) => Number(b[1]) - Number(a[1]));

  const newRows = [];
  
  // 4. Algoritmo de distribuciÃƒÂ³n "Serpiente" (ABBA)
  for (let i = 0; i < data.length; i++) {
    const player = data[i][0];
    const currentPoints = Number(data[i][1]);
    
    // DistribuciÃƒÂ³n: 0->Hex, 1->Chem, 2->Chem, 3->Hex...
    const isHextech = (i % 4 === 0 || i % 4 === 3); 
    const team = isHextech ? 'HEXTECH' : 'CHEMTECH';
    
    // Empezamos todos como SOLDADOS para que la gente vote al General
    const role = 'SOLDIER'; 
    
    // IMPORTANTE: AÃƒÂ±adimos el '0' al final para la columna de Votos
    newRows.push([player, team, currentPoints, role, 0]);
  }

  // 5. Escribir Datos (Rango de 5 columnas: A-E)
  if (newRows.length > 0) {
      factionSheet.getRange(2, 1, newRows.length, 5).setValues(newRows);
  }

  // 6. Activar estado y notificar
  props.setProperty('EVENT_WAR_ACTIVE', 'TRUE');
  
  if (typeof registerNews === 'function') {
      registerNews('WAR', 'Ã¢Å¡â€Ã¯Â¸Â Ã‚Â¡GUERRA DECLARADA! Equipos formados. Ã‚Â¡Las urnas para elegir General estÃƒÂ¡n abiertas!');
  }
  
  SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Guerra Iniciada.\n- Equipos generados.\n- Columna 'Votes' creada.\n- Marcadores a 0.`);
}

function getFactionWarData() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('EVENT_WAR_ACTIVE') !== 'TRUE') return { active: false };

  const ss = SpreadsheetApp.getActive();
  const factionSheet = ss.getSheetByName('FACTIONS');
  const scoresSheet = ss.getSheetByName('SCORES');
  const matchesSheet = ss.getSheetByName('MATCHES'); 
  const manualSheet = ss.getSheetByName('MANUAL_POINTS'); 
  
  if (!factionSheet || factionSheet.getLastRow() < 2) {
      return { active: true, hexScore: 0, chemScore: 0, hexMembers: [], chemMembers: [] };
  }

  // 1. CALCULAR "PUNTOS ILEGALES" (NO WAR) DE LA SEMANA
  const contrabandMap = {};
  
  // Calculamos el inicio de la guerra (Lunes 09:00)
  const now = new Date();
  const day = now.getDay() || 7; 
  const warStart = new Date(now);
  warStart.setHours(9,0,0,0);
  warStart.setDate(now.getDate() - (day - 1)); 

  // --- BLOQUE A: MATCHES [NW:X] ---
  const mData = matchesSheet.getDataRange().getValues();
  for(let i=1; i<mData.length; i++) {
      const mDate = new Date(mData[i][1]);
      if (mDate >= warStart) {
          const player = String(mData[i][2]).trim(); // Limpiamos nombre
          const notes = String(mData[i][13]); 
          
          const match = notes.match(/\[NW:(\d+)\]/);
          if (match) {
              const illegalPoints = Number(match[1]);
              if (!contrabandMap[player]) contrabandMap[player] = 0;
              contrabandMap[player] += illegalPoints;
          }
      }
  }

  // --- BLOQUE B: MANUAL POINTS (FILTRO ARREGLADO) ---
  if (manualSheet) {
      const pData = manualSheet.getDataRange().getValues();
      for(let i=1; i<pData.length; i++) {
          
          // Forzamos conversiÃƒÂ³n de fecha
          let mDate = pData[i][0];
          if (!(mDate instanceof Date)) mDate = new Date(mDate);

          const player = String(pData[i][1]).trim(); // Limpiamos nombre
          const pts = Number(pData[i][2]);
          
          // DIAGNÃƒâ€œSTICO: Si es hello piti, chivamos al log si entra o no
          if (player.includes('hello piti') && pts === 300) {
             console.log(`DEBUG PITI: Fecha=${mDate}, WarStart=${warStart}, Ã‚Â¿Entra en fecha?: ${mDate >= warStart}`);
          }

          if (mDate >= warStart) {
              // Ã°Å¸â€ºÂ¡Ã¯Â¸Â REGLA: Puntos >= 50 se restan de la guerra
              if (pts >= 100) {
                  if (!contrabandMap[player]) contrabandMap[player] = 0;
                  contrabandMap[player] += pts;
              }
          }
      }
  }

  // 2. MAPA DE SCORES
  const scoreMap = {};
  const sData = scoresSheet.getDataRange().getValues();
  for(let i=1; i<sData.length; i++) {
      if(sData[i][0]) {
          const pName = String(sData[i][0]).trim();
          scoreMap[pName] = Number(sData[i][1] || 0);
      }
  }

  const hexBonus = Number(props.getProperty('WAR_BONUS_HEXTECH') || 0);
  const chemBonus = Number(props.getProperty('WAR_BONUS_CHEMTECH') || 0);
  let hexScore = hexBonus;
  let chemScore = chemBonus;
  const hexMembers = [];
  const chemMembers = [];

  // 3. CALCULAR PROGRESO
  const fData = factionSheet.getRange(2, 1, factionSheet.getLastRow()-1, 5).getValues();

  fData.forEach(row => {
      const player = String(row[0]).trim(); // Limpiamos nombre
      const team = row[1];
      const startPoints = Number(row[2] || 0);
      const role = row[3];
      
      if(player) { 
          const currentTotal = scoreMap.hasOwnProperty(player) ? scoreMap[player] : startPoints;
          let weeklyGain = currentTotal - startPoints;

          // Ã°Å¸â€ºâ€˜ APLICAR DEDUCCIÃƒâ€œN
          const deduction = contrabandMap[player] || 0;
          weeklyGain = weeklyGain - deduction; 

          // --- APLICAR ROLES ---
          let multiplier = 1.0;
          let namePrefix = "";

          if (role === 'GENERAL') { multiplier = 1.5; namePrefix = "Ã¢Â­Â "; }
          else if (role === 'TANQUE') {
              namePrefix = "Ã°Å¸â€ºÂ¡Ã¯Â¸Â ";
              if (weeklyGain < 0) multiplier = 0.5;
          }
          else if (role === 'ESTRATEGA') { namePrefix = "Ã°Å¸Â§Â  "; }

          let finalContribution = weeklyGain * multiplier;

          if (team === 'HEXTECH') {
              hexScore += finalContribution;
              hexMembers.push({ name: `${namePrefix}${player}`, pts: finalContribution.toFixed(1) });
          } else if (team === 'CHEMTECH') {
              chemScore += finalContribution;
              chemMembers.push({ name: `${namePrefix}${player}`, pts: finalContribution.toFixed(1) });
          }
      }
  });

  hexMembers.sort((a,b) => Number(b.pts) - Number(a.pts));
  chemMembers.sort((a,b) => Number(b.pts) - Number(a.pts));

  return {
      active: true,
      hexScore: hexScore.toFixed(1),
      chemScore: chemScore.toFixed(1),
      hexMembers: hexMembers,
      chemMembers: chemMembers,
      bonuses: { hex: hexBonus, chem: chemBonus }
  };
}

/* ==========================================================
   Ã¢ÂÂ³ CHECK TIME-OUT PATATA CALIENTE (48H)
   ========================================================== */
function checkHotPotatoTimeout() {
  const ss = SpreadsheetApp.getActive();
  const invSheet = ss.getSheetByName('INVENTORY');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  
  if (!invSheet || !marketSheet) return;

  const invData = invSheet.getDataRange().getValues();
  const now = new Date();
  
  // --- CAMBIO AQUÃƒÂ: 48 HORAS ---
  const TIMEOUT_HOURS = 48; 
  // -----------------------------

  // Recorremos el inventario (empezando en fila 2 para saltar header)
  for (let i = 1; i < invData.length; i++) {
    const row = invData[i];
    const player = row[0];
    const itemID = row[1];
    const status = row[2];
    const dateAcquired = new Date(row[3]); // Columna D es la fecha de adquisiciÃƒÂ³n

    // Buscamos bombas que sigan ACTIVAS
    if (itemID === 'HOT_POTATO' && status === 'ACTIVE') {
      
      // Calcular diferencia de tiempo en horas
      const diffMs = now - dateAcquired;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Si ha pasado mÃƒÂ¡s de 48 horas sin jugar... Ã‚Â¡BOOM!
      if (diffHours >= TIMEOUT_HOURS) {
        
        // 1. Marcar como explotada por inactividad
        invSheet.getRange(i + 1, 3).setValue('EXPLODED_AFK');

        // 2. Aplicar Castigo EconÃƒÂ³mico
        const marketData = marketSheet.getDataRange().getValues();
        let mRow = -1;
        
        for(let j=1; j<marketData.length; j++) { 
           if(marketData[j][0] === player) { mRow = j+1; break; } 
        }

        if (mRow !== -1) {
            const currentBal = Number(marketSheet.getRange(mRow, 3).getValue());
            const currentPrice = Number(marketSheet.getRange(mRow, 2).getValue());
            
            // Castigo: -500G y -15% Valor
            marketSheet.getRange(mRow, 3).setValue(Math.max(0, currentBal - 500)); 
            marketSheet.getRange(mRow, 2).setValue(Math.max(1, currentPrice * 0.85)); 
            marketSheet.getRange(mRow, 4).setValue('Ã°Å¸Â¤â€¢'); // Icono herido
            
            // 3. Notificar (Mensaje actualizado)
            if (typeof registerNews === 'function') {
                registerNews('BOOM', `Ã¢ÂÂ° Ã‚Â¡TIEMPO AGOTADO! La patata explotÃƒÂ³ en manos de ${player} por inactividad (+48h sin jugar).`);
            }
        }
        
        Logger.log(`Bomba explotada por timeout (48h) para ${player}`);
      }
    }
  }
}


function endFactionWar() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('EVENT_WAR_ACTIVE') !== 'TRUE') return;

  const data = getFactionWarData(); 
  const hScore = Number(data.hexScore);
  const cScore = Number(data.chemScore);
  
  let winningTeam = '';
  if (hScore > cScore) winningTeam = 'HEXTECH';
  else if (cScore > hScore) winningTeam = 'CHEMTECH';
  else {
      registerNews('WAR', 'Ã°Å¸Â¤Â La Guerra ha terminado en EMPATE. Nadie pierde dinero.');
      props.setProperty('EVENT_WAR_ACTIVE', 'FALSE');
      return;
  }

  const ss = SpreadsheetApp.getActive();
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const marketData = marketSheet.getDataRange().getValues();
  const factionSheet = ss.getSheetByName('FACTIONS');
  const factionRows = factionSheet.getDataRange().getValues();
  const portSheet = ss.getSheetByName('PORTFOLIO'); // Necesario para calcular patrimonio

  // 1. Mapa de Equipos
  const playerTeam = {};
  for(let i=1; i<factionRows.length; i++) playerTeam[factionRows[i][0]] = factionRows[i][1];

  // 2. Mapa de Precios (Para valorar las acciones)
  const priceMap = {};
  for(let i=1; i<marketData.length; i++) {
      priceMap[marketData[i][0]] = Number(marketData[i][1]);
  }

  // 3. Calcular Valor de Acciones (Stock Wealth) por Jugador
  const stockWealthMap = {};
  if (portSheet && portSheet.getLastRow() > 1) {
      const portData = portSheet.getDataRange().getValues();
      // Asumimos: Col A = Inversor, Col B = Objetivo, Col C = Cantidad
      for(let i=1; i<portData.length; i++) {
          const investor = portData[i][0];
          const target = portData[i][1];
          const amount = Number(portData[i][2]);
          const price = priceMap[target] || 0;
          
          if (!stockWealthMap[investor]) stockWealthMap[investor] = 0;
          stockWealthMap[investor] += (amount * price);
      }
  }

  let lootPool = 5000; // Bote base del Admin
  let winnersCount = 0;
  
  // --- FASE 1: RECAUDACIÃƒâ€œN (PERDEDORES) ---
  for (let i=1; i<marketData.length; i++) {
      const player = marketData[i][0];
      const team = playerTeam[player];
      
      if (team && team !== winningTeam) {
          const currentPrice = Number(marketData[i][1]);
          const currentWallet = Number(marketData[i][2]);
          
          // --- CÃƒÂLCULO DEL 10% DEL PATRIMONIO ---
          const stocksValue = stockWealthMap[player] || 0;
          const netWorth = currentWallet + stocksValue; // Dinero + Acciones
          
          // El impuesto es el 10% del total, pero mÃƒÂ­nimo 500G para que duela algo
          let tax = Math.floor(netWorth * 0.10); 
          // Aplicar castigo al Wallet (Se queda a 0 si no tiene suficiente, no vende acciones auto)
          let newWallet = Math.max(0, currentWallet - tax);
          
          // El Loot Pool crece con el impuesto teÃƒÂ³rico (El banco pone la diferencia si el jugador estÃƒÂ¡ arruinado)
          lootPool += tax; 
          
          // Castigo a la acciÃƒÂ³n (-25% valor)
          let newPrice = currentPrice * 0.75;
          if (newPrice < 1) newPrice = 1;

          marketSheet.getRange(i+1, 2).setValue(newPrice);
          marketSheet.getRange(i+1, 3).setValue(newWallet);
          marketSheet.getRange(i+1, 4).setValue('Ã°Å¸Â¤â€¢'); // Icono herido
          
          Logger.log(`PERDEDOR: ${player} | Patrimonio: ${netWorth} | Impuesto: ${tax}`);

      } else if (team === winningTeam) {
          winnersCount++;
      }
  }

  // --- FASE 2: REPARTO (GANADORES) ---
  const prizePerWinner = winnersCount > 0 ? (lootPool / winnersCount) : 0;

  for (let i=1; i<marketData.length; i++) {
      const player = marketData[i][0];
      const team = playerTeam[player];
      
      if (team === winningTeam) {
          const currentPrice = Number(marketData[i][1]);
          const currentWallet = Number(marketData[i][2]);
          
          // 1. SUBIDA DE BOLSA (+10%)
          let newPrice = currentPrice * 1.10;
          
          // 2. ENTREGA DE PREMIO MONETARIO
          let newWallet = currentWallet + prizePerWinner;

          // 3. ENTREGA DEL ÃƒÂTEM "ONE_PIECE"
          let newItemStatus = 'Ã°Å¸Å½Â ONE_PIECE'; 

          // Guardamos datos
          marketSheet.getRange(i+1, 2).setValue(newPrice);
          marketSheet.getRange(i+1, 3).setValue(newWallet);
          marketSheet.getRange(i+1, 4).setValue(newItemStatus); 
          
          // NOTA: Si usas la hoja INVENTORY separada, aÃƒÂ±ade aquÃƒÂ­:
          // const invSheet = ss.getSheetByName('INVENTORY');
          // invSheet.appendRow([player, 'ONE_PIECE', 'ACTIVE', new Date()]);
      }
  }

  const loserTeam = winningTeam === 'HEXTECH' ? 'CHEMTECH' : 'HEXTECH';
  registerNews('WAR_END', `Ã°Å¸ÂÂ´Ã¢â‚¬ÂÃ¢ËœÂ Ã¯Â¸Â EL ONE PIECE EXISTE! ${winningTeam} gana ${prizePerWinner.toFixed(0)}G (BotÃƒÂ­n acumulado), sus acciones suben un 10% y obtienen un Cofre.`);
  
  props.setProperty('EVENT_WAR_ACTIVE', 'FALSE');
  SpreadsheetApp.getUi().alert(`Guerra finalizada.\nGanador: ${winningTeam}\nPremio por cabeza: ${prizePerWinner.toFixed(0)} G`);
}

/* ==========================================================
   Ã°Å¸Å’Â¤Ã¯Â¸Â MEJORA VISUAL: CLIMA DEL MERCADO (SKIN)
   ========================================================== */

// AÃƒÂ±adir esta lÃƒÂ³gica dentro de tu funciÃƒÂ³n existente 'getMarketData' o crear una nueva para consultar el estado
function getMarketMood() {
    const props = PropertiesService.getScriptProperties();
    const isPurge = props.getProperty('EVENT_PURGE_ACTIVE') === 'TRUE';
    
    if (isPurge) return 'PURGE';
    
    // Si no hay purga, miramos la tendencia global
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('MARKET_STATUS');
    if (!sheet) return 'NEUTRAL';
    
    const changes = sheet.getRange(2, 5, sheet.getLastRow()-1, 1).getValues().flat();
    // Sumamos todos los cambios porcentuales
    const totalChange = changes.reduce((acc, val) => acc + Number(val || 0), 0);
    
    if (totalChange > 20) return 'BULL'; // Mercado muy alcista
    if (totalChange < -20) return 'BEAR'; // Mercado bajista/sangriento
    return 'NEUTRAL';
}

// --- HELPER: OBTENER IDs YA PROCESADOS ---
function getProcessedMatchIds() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("MATCHES");
  if (!sheet || sheet.getLastRow() < 2) return [];
  
  // Leemos la Columna A (MatchID) entera
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  // Aplanamos el array 2D a 1D y filtramos vacÃƒÂ­os
  return data.flat().filter(String);
}

function removeDuplicateMatches() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("MATCHES");
  const data = sheet.getDataRange().getValues();
  const seen = new Set();
  const rowsToDelete = [];

  // Recorremos de arriba a abajo. La primera vez que vemos una partida, la guardamos.
  // La segunda vez, marcamos la fila para borrar.
  for (let i = 1; i < data.length; i++) {
    const matchId = data[i][0];
    const player = data[i][2];
    const key = String(matchId).trim() + "_" + String(player).trim();
    
    if (seen.has(key)) {
      rowsToDelete.push(i + 1); // Es un duplicado
    } else {
      seen.add(key);
    }
  }

  // Borrar de abajo hacia arriba para no romper ÃƒÂ­ndices
  if (rowsToDelete.length > 0) {
    Logger.log(`Eliminando ${rowsToDelete.length} duplicados...`);
    rowsToDelete.reverse().forEach(row => {
       sheet.deleteRow(row);
    });
    SpreadsheetApp.getUi().alert(`Ã°Å¸Â§Â¹ Se han eliminado ${rowsToDelete.length} filas duplicadas.`);
  } else {
    SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ No se encontraron duplicados.`);
  }
}

/**
 * Reactiva a todos los jugadores para la nueva semana.
 * Configurar trigger: "De tiempo" -> "Semanal" -> "Lunes" -> "00:00 a 01:00"
 */
function weeklyResetPlayers() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName("PLAYERS");
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  // Reactiva a todos poniendo "SÃƒÂ­" en la columna E (5)
  // Sobrescribe cualquier "Cupo (15)" o "No" que hubiera.
  sheet.getRange(2, 5, lastRow - 1, 1).setValue("SÃƒÂ­");
  
  logToSheet("Ã°Å¸â€â€ž RESET SEMANAL: Cupos reiniciados. Ã‚Â¡A jugar!");
}

/* ==========================================================
   Ã°Å¸Â§Â¹ MANTENIMIENTO: LIMPIEZA DE LOGS
   ========================================================== */
function cleanUpLogs() {
  const ss = SpreadsheetApp.getActive();
  const logSheet = ss.getSheetByName("LOGS");
  
  if (!logSheet) return;

  const maxRowsToKeep = 500; // Guardar solo las ÃƒÂºltimas 500 lÃƒÂ­neas
  const lastRow = logSheet.getLastRow();

  // Si hay mÃƒÂ¡s filas de las que queremos guardar (+1 por el encabezado)
  if (lastRow > (maxRowsToKeep + 1)) {
    const rowsToDelete = lastRow - maxRowsToKeep - 1;
    // Borramos desde la fila 2 (respetando encabezado) hacia abajo
    logSheet.deleteRows(2, rowsToDelete);
    
    // AÃƒÂ±adimos una nota de que se limpiÃƒÂ³
    logSheet.appendRow([new Date(), `Ã°Å¸Â§Â¹ Limpieza automÃƒÂ¡tica: Se borraron ${rowsToDelete} filas antiguas.`]);
    console.log(`Logs limpiados. Se borraron ${rowsToDelete} filas.`);
  }
}


function TEST_DIAGNOSTICO() {
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName("PLAYERS");
  const cfg = readConfigMap(); // Lee tu config
  
  Logger.log("=== INICIO DIAGNÃƒâ€œSTICO ===");
  Logger.log(`1. ConfiguraciÃƒÂ³n leÃƒÂ­da:`);
  Logger.log(`   - RegiÃƒÂ³n: ${cfg.riot_region}`);
  Logger.log(`   - Colas: ${cfg.queue_filter}`);
  Logger.log(`   - API Key (primeros 5 chars): ${getApiKey().substring(0,5)}...`);

  const playersData = playersSheet.getDataRange().getValues();
  Logger.log(`2. Total filas en PLAYERS: ${playersData.length}`);

  if (playersData.length <= 1) {
    Logger.log("Ã¢ÂÅ’ ERROR: No hay jugadores en la hoja (solo encabezados).");
    return;
  }

  // Probamos con el primer jugador de la lista
  const i = 1; 
  const name = playersData[i][0];
  const puuid = playersData[i][2];
  const active = playersData[i][4];

  Logger.log(`3. Probando Jugador 1: ${name}`);
  Logger.log(`   - PUUID: ${puuid ? "OK" : "FALTA"}`);
  Logger.log(`   - Activo (Celda E${i+1}): "${active}"`);

  if (String(active).toLowerCase() === 'no' || String(active).toLowerCase() === 'false') {
    Logger.log("Ã¢ÂÅ’ ERROR: El jugador estÃƒÂ¡ marcado como INACTIVO en el Excel.");
    return;
  }

  // 4. PRUEBA DE CONEXIÃƒâ€œN REAL A RIOT
  Logger.log("4. Intentando conectar con Riot API...");
  const region = cfg.riot_region || 'europe';
  // Probamos SoloQ (420)
  const count = 5;
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&queue=420`;
  
  try {
    const key = getApiKey();
    const opts = { method: 'get', headers: {'X-Riot-Token': key}, muteHttpExceptions: true };
    const res = UrlFetchApp.fetch(url, opts);
    const code = res.getResponseCode();
    const content = res.getContentText();

    Logger.log(`   - CÃƒÂ³digo Respuesta HTTP: ${code}`);
    
    if (code === 200) {
      const matches = JSON.parse(content);
      Logger.log(`   Ã¢Å“â€¦ Ãƒâ€°XITO: La API devolviÃƒÂ³ ${matches.length} partidas.`);
      Logger.log(`   - IDs: ${JSON.stringify(matches)}`);
      
      if (matches.length === 0) {
        Logger.log("   Ã¢Å¡Â Ã¯Â¸Â AVISO: La API funciona, pero dice que este jugador no tiene partidas recientes en SoloQ.");
        Logger.log("   -> Ã‚Â¿Ha jugado en los ÃƒÂºltimos dÃƒÂ­as? Ã‚Â¿Es la regiÃƒÂ³n correcta?");
      }
    } else if (code === 403) {
      Logger.log("   Ã¢ÂÅ’ ERROR 403: API KEY CADUCADA O INVÃƒÂLIDA.");
      Logger.log("   -> SoluciÃƒÂ³n: Regenera la key en developer.riotgames.com");
    } else {
      Logger.log(`   Ã¢ÂÅ’ ERROR API: ${content}`);
    }

  } catch (e) {
    Logger.log(`   Ã¢ÂÅ’ EXCEPCIÃƒâ€œN AL CONECTAR: ${e.message}`);
  }
  Logger.log("=== FIN DIAGNÃƒâ€œSTICO ===");
}

/* ==============================================
   Ã°Å¸â€ºÂ Ã¯Â¸Â HERRAMIENTA DE REPARACIÃƒâ€œN DE JUGADORES (V2 BLINDADA)
   ============================================== */
function forceFillPuuids() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('PLAYERS');
  const data = sheet.getDataRange().getValues();
  const apiKey = getApiKey(); 
  const regionAccount = "europe"; 

  Logger.log("Ã°Å¸Å¡â‚¬ Iniciando reparaciÃƒÂ³n de PUUIDs...");

  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0]).trim();
    const tag = String(data[i][1]).trim();
    const currentPuuid = String(data[i][2]).trim();

    if (name && (!currentPuuid || currentPuuid === "")) {
      Logger.log(`Ã°Å¸â€Å½ Buscando PUUID para: ${name} #${tag}...`);
      
      try {
        const url = `https://${regionAccount}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
        const params = { method: "GET", headers: { "X-Riot-Token": apiKey }, muteHttpExceptions: true };
        const res = UrlFetchApp.fetch(url, params);
        const code = res.getResponseCode();

        if (code === 200) {
          const json = JSON.parse(res.getContentText());
          const newPuuid = json.puuid;

          // Guardar y FORZAR ESCRITURA INMEDIATA
          sheet.getRange(i + 1, 3).setValue(newPuuid);
          SpreadsheetApp.flush(); // <--- Ã‚Â¡ESTO ES LA CLAVE!
          
          Logger.log(`   Ã¢Å“â€¦ Guardado: ${newPuuid}`);
        } else {
          Logger.log(`   Ã¢ÂÅ’ Error ${code}: ${res.getContentText()}`);
          if (code === 403) break; 
        }
      } catch (e) {
        Logger.log(`   Ã¢ÂÅ’ ExcepciÃƒÂ³n: ${e.message}`);
      }
      Utilities.sleep(1200); 
    }
  }
  Logger.log("Ã¢Å“â€¦ Proceso finalizado. Revisa la hoja PLAYERS.");
}

// ==========================================
// Ã°Å¸â€ºâ€˜ CONTROL DE LÃƒÂMITE SEMANAL (15 PARTIDAS)
// ==========================================
function checkWeeklyLimits() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('PLAYERS');
  
  // Obtenemos todos los datos de la hoja PLAYERS
  // Asumimos: Col E = Activo (ÃƒÂndice 4), Col G = TotalGames (ÃƒÂndice 6)
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // Si no hay jugadores, salir

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues(); // Leemos hasta columna G
  
  data.forEach((row, index) => {
    const name = row[0];
    const isActive = row[4];       // Columna E (Active)
    const totalGames = Number(row[6]); // Columna G (TotalGames)

    // LÃƒâ€œGICA:
    // 1. Si estÃƒÂ¡ activo ('Si')
    // 2. Y tiene partidas jugadas (> 0)
    // 3. Y el nÃƒÂºmero es mÃƒÂºltiplo de 15 (residuo de la divisiÃƒÂ³n es 0)
    if (isActive === 'Si' && totalGames > 0 && totalGames % 15 === 0) {
      
      // Desactivamos al jugador
      // (index + 2 porque el array empieza en 0 y la hoja tiene cabecera en fila 1)
      sheet.getRange(index + 2, 5).setValue('No'); 
      
      Logger.log(`Ã°Å¸â€ºâ€˜ LÃƒÂMITE ALCANZADO: ${name} lleva ${totalGames} partidas. Desactivado.`);
    }
  });
}


/* ===============================================================
   Ã°Å¸â€ºÂ Ã¯Â¸Â HERRAMIENTA DE REPARACIÃƒâ€œN: RECALCULAR RACHAS Y TOTALES (V3 SAFE)
   =============================================================== */
function forceRecalculatePlayerStats() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName("MATCHES");
  const playersSheet = ss.getSheetByName("PLAYERS");
  
  if (!matchesSheet || !playersSheet) {
    logToSheet("Error: Faltan hojas MATCHES o PLAYERS."); // Log instead of alert first
    return;
  }

  // --- CORRECCIÃƒâ€œN: FORZAMOS FECHA AL 1 DE ENERO DE 2026 ---
  const seasonStart = new Date('2026-01-01T00:00:00Z'); 
  console.log(`Ã°Å¸â€â€ž Iniciando recÃƒÂ¡lculo total desde: ${seasonStart.toISOString()}`);

  // 2. LEER DATOS
  const matchesData = matchesSheet.getDataRange().getValues();
  const playersData = playersSheet.getDataRange().getValues();

  // Mapa para guardar las stats
  const playerStats = {};

  // Inicializamos a todos los jugadores del Excel
  for (let i = 1; i < playersData.length; i++) {
    const name = String(playersData[i][0]).trim().toLowerCase();
    if (name) {
      playerStats[name] = { streak: 0, total: 0, lastMatchId: "" };
    }
  }

  // 3. PROCESAR PARTIDAS (CRONOLÃƒâ€œGICAMENTE)
  const sortedMatches = matchesData.slice(1).sort((a, b) => new Date(a[1]) - new Date(b[1]));
  let processedCount = 0;

  sortedMatches.forEach(row => {
    const matchDate = new Date(row[1]);
    const playerName = String(row[2]).trim().toLowerCase(); 
    const result = row[5]; 
    const matchId = row[0];

    if (matchDate >= seasonStart) {
      if (playerStats[playerName]) {
        // A. Sumar Total HistÃƒÂ³rico
        playerStats[playerName].total++;
        playerStats[playerName].lastMatchId = matchId;

        // B. Calcular Racha
        let currentS = playerStats[playerName].streak;

        if (result === 'Win') {
            currentS = (currentS >= 0) ? currentS + 1 : 1;
        } else if (result === 'Loss') {
            currentS = (currentS <= 0) ? currentS - 1 : -1;
        }
        
        playerStats[playerName].streak = currentS;
        processedCount++;
      }
    }
  });

  // 4. VOLCAR RESULTADOS A LA HOJA 'PLAYERS'
  const streakCol = [];
  const totalCol = [];
  const lastMatchCol = [];

  for (let i = 1; i < playersData.length; i++) {
    const name = String(playersData[i][0]).trim().toLowerCase();
    const stats = playerStats[name];

    if (stats) {
      streakCol.push([stats.streak]);
      totalCol.push([stats.total]);
      lastMatchCol.push([stats.lastMatchId]);
    } else {
      streakCol.push([0]);
      totalCol.push([0]);
      lastMatchCol.push([""]);
    }
  }

  if (streakCol.length > 0) {
      playersSheet.getRange(2, 6, streakCol.length, 1).setValues(streakCol); 
      playersSheet.getRange(2, 7, totalCol.length, 1).setValues(totalCol);   
      playersSheet.getRange(2, 4, lastMatchCol.length, 1).setValues(lastMatchCol); 
  }

  const msg = `Ã¢Å“â€¦ RecÃƒÂ¡lculo total finalizado. ${processedCount} partidas procesadas.`;
  console.log(msg);
  logToSheet(msg);

  // Intentar mostrar UI solo si es posible
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // Si falla (trigger automÃƒÂ¡tico), no hacemos nada, ya se logueÃƒÂ³.
  }
}

/* ----------------- RESOLUCIÃƒâ€œN DE PATROCINIOS (SPONSORS) ----------------- */
function checkSponsorships(targetPlayer, result) {
  const ss = SpreadsheetApp.getActive();
  const sponsorSheet = ss.getSheetByName('SPONSORSHIPS');
  const marketSheet = ss.getSheetByName('MARKET_STATUS');
  const txSheet = ss.getSheetByName('TRANSACTIONS');

  if (!sponsorSheet || !marketSheet) return;

  const sData = sponsorSheet.getDataRange().getValues();
  const marketData = marketSheet.getDataRange().getValues();
  
  // Mapa rÃƒÂ¡pido para encontrar la fila del inversor en MARKET_STATUS
  const walletMap = {}; 
  for (let i = 1; i < marketData.length; i++) {
    walletMap[marketData[i][0]] = i + 1; // Guardamos el nÃƒÂºmero de fila
  }

  // Recorremos los patrocinios buscando al jugador que acaba de jugar
  for (let i = 1; i < sData.length; i++) {
    const row = sData[i];
    const investor = row[0];
    const target = row[1];
    const amount = Number(row[2]);
    const status = row[3];

    // CondiciÃƒÂ³n: Que sea el jugador objetivo Y que el patrocinio estÃƒÂ© ACTIVO
    if (target === targetPlayer && status === 'ACTIVE') {
       
       if (result === 'Win') {
          // --- CASO VICTORIA: PAGO DOBLE ---
          const payout = amount * 2;
          const investorRow = walletMap[investor];

          if (investorRow) {
             const currentWallet = Number(marketSheet.getRange(investorRow, 3).getValue());
             marketSheet.getRange(investorRow, 3).setValue(currentWallet + payout);
             
             // 1. Marcar como PAGADO en la hoja SPONSORSHIPS
             sponsorSheet.getRange(i + 1, 4).setValue('WON');
             
             // 2. Registrar transacciÃƒÂ³n
             if (txSheet) {
                 txSheet.appendRow([new Date(), 'SPONSOR_WIN', investor, target, 1, payout]);
             }
             
             // 3. Notificar
             if (typeof registerNews === 'function') {
                 registerNews('DEAL', `Ã°Å¸â€™Â° Ã‚Â¡APUESTA GANADA! ${investor} recibe ${payout} G gracias a la victoria de ${target}.`);
             }
          }
       } else {
          // --- CASO DERROTA: SE PIERDE EL DINERO ---
          // 1. Marcar como PERDIDO
          sponsorSheet.getRange(i + 1, 4).setValue('LOST');
          
          if (typeof registerNews === 'function') {
             // Solo notificamos si la inversiÃƒÂ³n fue grande (>500) para no spamear
             if (amount >= 500) {
                 registerNews('DEAL', `Ã°Å¸â€™Â¸ INVERSIÃƒâ€œN FALLIDA: ${investor} pierde sus ${amount} G. ${target} ha perdido la partida.`);
             }
          }
       }
    }
  }
}


/* ----------------- RESETEAR DUELOS ACTIVOS ----------------- */
function resetActiveRivals() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
     'Ã¢Å¡Â Ã¯Â¸Â REINICIAR DUELOS',
     'Ã‚Â¿Seguro que quieres poner todos los marcadores de Rivales a 0-0?\n\nEsto NO borrarÃƒÂ¡ los puntos del Ranking global, solo reiniciarÃƒÂ¡ el progreso del duelo de esta semana.',
     ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('RIVALS');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  // Headers: WeekID, P1, P2, Pts1(3), Pts2(4), Status(5), Games1(6), Games2(7)

  // Recorremos y modificamos en memoria
  for (let i = 1; i < data.length; i++) {
     if (data[i][5] === 'ACTIVE') {
         // Reiniciar Puntos
         data[i][3] = 0; 
         data[i][4] = 0; 
         // Reiniciar Contadores de Partidas
         data[i][6] = 0; 
         data[i][7] = 0; 
     }
  }

  // Escribimos todo de golpe (mucho mÃƒÂ¡s rÃƒÂ¡pido)
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  
  if (typeof registerNews === 'function') {
      registerNews('INFO', 'Ã°Å¸â€â€ž El ÃƒÂ¡rbitro ha reiniciado los marcadores de Rivales. Ã‚Â¡Todo empieza de nuevo!');
  }

  ui.alert('Ã¢Å“â€¦ Duelos reiniciados a 0-0.');
}


function getChampOceanStatus(playerName) {
  // 1. Accedemos a la hoja CORRECTA
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('KNOWN_CHAMPS'); // Nombre exacto de tu pestaÃƒÂ±a
  
  if (!sheet) return { count: 0, percent: 0, error: "Hoja no encontrada" };

  // 2. Leemos todos los datos de una vez (MÃƒÂ¡s rÃƒÂ¡pido)
  // Asumimos segÃƒÂºn tu foto: Columna B = Nombre (ÃƒÂndice 1), Columna C = Campeones (ÃƒÂndice 2)
  const data = sheet.getDataRange().getValues();
  
  let champString = "";
  let found = false;

  // 3. Buscamos al jugador en la Columna B (empezamos en i=1 para saltar cabecera)
  for (let i = 1; i < data.length; i++) {
    // Comparamos nombres (usamos trim() para evitar errores por espacios invisibles)
    if (String(data[i][1]).trim() === String(playerName).trim()) {
      champString = String(data[i][2]); // Cogemos la lista de la Columna C
      found = true;
      break; // Ya lo encontramos, dejamos de buscar
    }
  }

  if (!found) {
    Logger.log(`Jugador ${playerName} no encontrado en KNOWN_CHAMPS.`);
    return { count: 0, percent: 0, list: [] };
  }

  // 4. Procesamos la lista (Separar por comas y contar ÃƒÂºnicos)
  let champList = [];
  if (champString && champString.trim() !== "") {
    champList = champString.split(',')
      .map(c => c.trim())       // Quitar espacios alrededor de nombres
      .filter(c => c !== "");   // Quitar vacÃƒÂ­os
  }

  // Usamos Set para asegurar que no haya repetidos, aunque el CSV ya deberÃƒÂ­a estar limpio
  const uniqueChamps = [...new Set(champList)];
  const currentCount = uniqueChamps.length;
  
  // 5. Calculamos el porcentaje (Meta: 55)
  const GOAL = 55;
  let percentage = Math.floor((currentCount / GOAL) * 100);
  if (percentage > 100) percentage = 100;

  Logger.log(`MisiÃƒÂ³n Ocean para ${playerName}: ${currentCount}/${GOAL} (${percentage}%)`);

  return {
    count: currentCount,
    percent: percentage,
    list: uniqueChamps
  };
}


/* ===============================================================
   Ã°Å¸â€ºÂ Ã¯Â¸Â HERRAMIENTA: RECONSTRUIR CHAMPION POOL DESDE HISTORIAL
   =============================================================== */
function forceUpdateKnownChamps() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const playersSheet = ss.getSheetByName('PLAYERS');
  const knownSheet = ss.getSheetByName('KNOWN_CHAMPS');

  if (!matchesSheet || !playersSheet || !knownSheet) {
    SpreadsheetApp.getUi().alert("Ã¢ÂÅ’ Error: Faltan hojas necesarias (MATCHES, PLAYERS o KNOWN_CHAMPS).");
    return;
  }

  // 1. Obtener Mapa de Jugadores (Nombre -> PUUID)
  // Necesitamos el PUUID para la columna A de KNOWN_CHAMPS
  const pLastRow = playersSheet.getLastRow();
  if (pLastRow < 2) return;

  const pData = playersSheet.getRange(2, 1, pLastRow - 1, 3).getValues(); 
  // Col A: Nombre, Col C: PUUID
  const playerMap = {}; 

  pData.forEach(row => {
    const name = String(row[0]).trim();
    const puuid = String(row[2]).trim();
    // Usamos el nombre en minÃƒÂºsculas como clave para evitar errores de mayÃƒÂºsculas
    if (name) {
      playerMap[name.toLowerCase()] = { 
        realName: name, 
        puuid: puuid 
      };
    }
  });

  // 2. Escanear el Historial de Partidas
  const mLastRow = matchesSheet.getLastRow();
  if (mLastRow < 2) {
    SpreadsheetApp.getUi().alert("No hay partidas en MATCHES para escanear.");
    return;
  }

  // Leemos: Col C (Jugador) y Col D (CampeÃƒÂ³n)
  // Indices: 2 y 3 respectivamente en el array
  const mData = matchesSheet.getRange(2, 1, mLastRow - 1, 4).getValues();
  
  const poolMap = {}; // { "nombre_lowercase": Set("Ahri", "Yasuo") }

  mData.forEach(row => {
    const player = String(row[2]).trim().toLowerCase();
    const champion = String(row[3]).trim();

    // Si tenemos jugador y campeÃƒÂ³n vÃƒÂ¡lido
    if (player && champion && champion !== "" && champion !== "undefined") {
      if (!poolMap[player]) {
        poolMap[player] = new Set();
      }
      poolMap[player].add(champion);
    }
  });

  // 3. Preparar Datos para Escribir
  const output = [];

  // Recorremos los jugadores que hemos encontrado en las partidas
  for (const pKey in poolMap) {
    // Verificamos si tenemos su PUUID en la hoja PLAYERS
    const pInfo = playerMap[pKey];
    
    if (pInfo) {
      const uniqueChamps = Array.from(poolMap[pKey]).sort().join(",");
      // Formato: [PUUID, SummonerName, ChampionsCSV]
      output.push([pInfo.puuid, pInfo.realName, uniqueChamps]);
    } else {
      // Si el jugador estÃƒÂ¡ en MATCHES pero no en PLAYERS (raro, pero posible)
      // Lo aÃƒÂ±adimos sin PUUID o lo ignoramos. AquÃƒÂ­ lo aÃƒÂ±adimos con PUUID vacÃƒÂ­o por seguridad.
      const uniqueChamps = Array.from(poolMap[pKey]).sort().join(",");
      // Intentamos capitalizar el nombre key
      const displayName = pKey.charAt(0).toUpperCase() + pKey.slice(1);
      output.push(["", displayName, uniqueChamps]);
    }
  }

  // 4. Escribir en la Hoja
  knownSheet.clearContents(); // Borrar todo
  knownSheet.getRange('A1:C1').setValues([['PUUID', 'Summoner', 'ChampionsCSV']]).setFontWeight('bold'); // Poner cabecera

  if (output.length > 0) {
    knownSheet.getRange(2, 1, output.length, 3).setValues(output);
    const count = output.length;
    Logger.log(`Ã¢Å“â€¦ KNOWN_CHAMPS actualizado. ${count} jugadores procesados.`);
    SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Champion Pool actualizada.\nSe han procesado ${count} jugadores basados en el historial.`);
  } else {
    SpreadsheetApp.getUi().alert("Ã¢Å¡Â Ã¯Â¸Â No se encontraron datos para actualizar.");
  }
}


function syncMissionStateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stateSheet = ss.getSheetByName('MISSION_STATE');
  const missionsSheet = ss.getSheetByName('MISSIONS');
  const knownSheet = ss.getSheetByName('KNOWN_CHAMPS');

  if (!stateSheet || !missionsSheet || !knownSheet) {
    Logger.log("Ã¢ÂÅ’ Error: Faltan hojas (MISSION_STATE, MISSIONS o KNOWN_CHAMPS).");
    return;
  }

  // 1. OBTENER METAS (TARGETS) DE TODAS LAS MISIONES
  // Mapa: ID_MISION -> Meta NumÃƒÂ©rica (Columna E de MISSIONS)
  const missionTargets = {};
  const missionsData = missionsSheet.getDataRange().getValues();
  // Asumimos que la meta estÃƒÂ¡ en la columna E (ÃƒÂ­ndice 4) y el ID en la A (ÃƒÂ­ndice 0)
  for (let i = 1; i < missionsData.length; i++) {
    let mID = String(missionsData[i][0]).trim();
    let mTarget = Number(missionsData[i][4]); 
    if (mID && !isNaN(mTarget)) {
      missionTargets[mID] = mTarget;
    }
  }

  // 2. PREPARAR DATOS DE KNOWN_CHAMPS (Por si acaso)
  const knownData = knownSheet.getDataRange().getValues();
  let playerChampionsMap = {};
  for (let i = 1; i < knownData.length; i++) {
    let pName = String(knownData[i][1]).trim();
    let pCSV = String(knownData[i][2]).trim();
    if (pName) playerChampionsMap[pName] = pCSV;
  }

  // 3. RECORRER Y ARREGLAR MISSION_STATE
  const stateRange = stateSheet.getDataRange();
  const stateValues = stateRange.getValues();
  
  // ÃƒÂndices basados en tus imÃƒÂ¡genes (B=Player, C=ID, D=Status, E=Value)
  const COL_PLAYER = 1; 
  const COL_MISSION = 2;
  const COL_STATUS = 3;
  const COL_VALUE = 4;

  let updatesCount = 0;

  for (let i = 1; i < stateValues.length; i++) {
    let player = String(stateValues[i][COL_PLAYER]).trim();
    let missionID = String(stateValues[i][COL_MISSION]).trim();
    let currentStatus = String(stateValues[i][COL_STATUS]).trim();
    let currentValue = String(stateValues[i][COL_VALUE]).trim(); // Puede ser "Top,Mid" o "33"

    let target = missionTargets[missionID];

    // --- A. ARREGLO ESPECÃƒÂFICO CHAMP_OCEAN (Sincronizar CSV) ---
    if (missionID.includes('CHAMP_OCEAN')) {
      let realCSV = playerChampionsMap[player] || "";
      stateValues[i][COL_VALUE] = realCSV; // Actualizamos la lista
      currentValue = realCSV; // Para que el chequeo de abajo use el dato nuevo
    }

    // --- B. CHEQUEO GENERAL DE FINALIZACIÃƒâ€œN ---
    // Si la misiÃƒÂ³n tiene una meta numÃƒÂ©rica definida
    if (target > 0) {
      let currentCount = 0;

      // Si el valor es una lista separada por comas (Ej: "Top,Mid,Jungle")
      if (currentValue.includes(',')) {
        // Limpiamos y contamos ÃƒÂºnicos
        let list = currentValue.split(',').filter(x => x && x.trim().length > 0);
        currentCount = new Set(list).size;
      } 
      // Si el valor es un nÃƒÂºmero simple (Ej: "33")
      else if (!isNaN(parseFloat(currentValue))) {
        currentCount = Number(currentValue);
      }

      // LA CORRECCIÃƒâ€œN MÃƒÂGICA:
      // Si ya tienes lo necesario o mÃƒÂ¡s, y no estÃƒÂ¡ marcada como Completed...
      if (currentCount >= target && currentStatus !== 'Completed') {
        stateValues[i][COL_STATUS] = 'Completed';
        Logger.log(`Ã°Å¸Å½â€° Ã‚Â¡CORREGIDO! ${player} completÃƒÂ³ ${missionID} (${currentCount}/${target}).`);
        updatesCount++;
      }
    }
  }

  // 4. GUARDAR CAMBIOS
  if (updatesCount > 0) {
    stateRange.setValues(stateValues);
    SpreadsheetApp.flush();
    let msg = `Ã¢Å“â€¦ Se han completado ${updatesCount} misiones atascadas (incluyendo la de LÃƒÂ­neas).`;
    Logger.log(msg);
    SpreadsheetApp.getUi().alert(msg);
  } else {
    Logger.log("Ã°Å¸â€˜Â Todo parece estar correcto. No hubo cambios.");
    SpreadsheetApp.getUi().alert("Todas las misiones estÃƒÂ¡n sincronizadas correctamente.");
  }
}

/* ----------------- FIX MISIONES DE ROL (SUPPORT/UTILITY) ----------------- */
function syncRoleMissionsFromHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName('MATCHES'); 
  const stateSheet = ss.getSheetByName('MISSION_STATE');
  const missionsSheet = ss.getSheetByName('MISSIONS');

  if (!historySheet || !stateSheet || !missionsSheet) return;

  // CONFIGURACIÃƒâ€œN COLUMNAS (Ajustado a tu hoja MATCHES)
  // Columna C (2) = Player, Columna E (4) = Role/Lane
  const COL_PLAYER_HIST = 2; 
  const COL_ROLE_HIST = 4;   

  // 1. LEER DEFINICIONES
  const missionsData = missionsSheet.getDataRange().getValues();
  const roleMissionConfig = {}; 
  
  for (let i = 1; i < missionsData.length; i++) {
    let mID = String(missionsData[i][0]).trim();
    let mType = String(missionsData[i][2]).trim();
    let mRole = String(missionsData[i][3]).trim();
    let mTarget = Number(missionsData[i][4]);

    if (mType === 'GAMES_AS_ROLE') {
      roleMissionConfig[mID] = { role: mRole, target: mTarget };
    }
  }

  // 2. CONTAR ROLES DESDE EL HISTORIAL
  const historyData = historySheet.getDataRange().getValues();
  const playerRoleCounts = {};

  for (let i = 1; i < historyData.length; i++) {
    let pName = String(historyData[i][COL_PLAYER_HIST]).trim();
    let pRole = String(historyData[i][COL_ROLE_HIST]).trim().toUpperCase();

    // --- EL FIX CLAVE ---
    if (pRole === 'UTILITY') pRole = 'SUPPORT';
    if (pRole === 'MID') pRole = 'MIDDLE';
    if (pRole === 'BOT') pRole = 'BOTTOM';

    if (pName && pRole) {
      if (!playerRoleCounts[pName]) playerRoleCounts[pName] = {};
      if (!playerRoleCounts[pName][pRole]) playerRoleCounts[pName][pRole] = 0;
      playerRoleCounts[pName][pRole]++;
    }
  }

  // 3. ACTUALIZAR MISSION_STATE
  const stateRange = stateSheet.getDataRange();
  const stateValues = stateRange.getValues();
  
  // ÃƒÂndices MISSION_STATE: B=Player(1), C=ID(2), D=Status(3), E=Value(4)
  let updates = 0;

  for (let i = 1; i < stateValues.length; i++) {
    let mID = String(stateValues[i][2]).trim();
    let player = String(stateValues[i][1]).trim();

    if (roleMissionConfig[mID]) {
      let requiredRole = roleMissionConfig[mID].role.toUpperCase();
      let target = roleMissionConfig[mID].target;
      let realCount = 0;
      
      if (playerRoleCounts[player] && playerRoleCounts[player][requiredRole]) {
        realCount = playerRoleCounts[player][requiredRole];
      }

      let currentStatus = stateValues[i][3];
      // Si el nÃƒÂºmero estÃƒÂ¡ mal O si ya cumpliÃƒÂ³ pero no sale 'Completed'
      if (stateValues[i][4] != realCount || (realCount >= target && currentStatus !== 'Completed')) {
        stateValues[i][4] = realCount; // Valor
        if (realCount >= target) stateValues[i][3] = 'Completed';
        else stateValues[i][3] = 'InProgress';
        updates++;
      }
    }
  }

  if (updates > 0) {
    stateRange.setValues(stateValues);
    console.log(`Ã¢Å“â€¦ Sincronizadas ${updates} misiones de Roles.`);
  }
}


 function getGlobalWinrateBonus(summonerName, allMatchesData) {
    let wins = 0;
    let games = 0;

    // 1. Recorrer historial (allMatchesData viene de la hoja MATCHES)
    // Empezamos en 1 para saltar cabecera
    for (let i = 1; i < allMatchesData.length; i++) {
      const rowName = String(allMatchesData[i][2]).trim().toLowerCase();
      const result = String(allMatchesData[i][5]); // Columna F (Win/Loss)

      if (rowName === String(summonerName).trim().toLowerCase()) {
        games++;
        if (result === 'Win') wins++;
      }
    }

  // 2. Filtro de Muestra MÃƒÂ­nima (15 partidas)
  // Evita que alguien con 2-0 (100% WR) reciba el premio mÃƒÂ¡ximo injustamente.
  if (games < 15) return { bonus: 0, label: "", wr: 0 };

  const wr = wins / games;
  let bonus = 0;
  let label = "";

  // 3. ESCALA DE PRESTIGIO
  
  // TIER 3: THE CHOSEN ONE (> 70%)
  // Mantener 70% WR en >15 partidas es nivel Smurf alto.
  if (wr >= 0.70) {
    bonus = 2.0; 
    label = "Ã°Å¸â€˜â€˜ PRESTIGIO: GOD";
  }
  // TIER 2: SMURF (> 60%)
  // Un 60% sÃƒÂ³lido merece respeto.
  else if (wr >= 0.65) {
    bonus = 1.5;
    label = "Ã°Å¸Å¡â‚¬ PRESTIGIO: ALTO ELO";
  }
  // TIER 1: POSITIVE (> 53%)
  // Un poco por encima de la media (50%).
  else if (wr >= 0.60) {
    bonus = 1.0;
    label = "Ã°Å¸â€œË† PRESTIGIO: SÃƒâ€œLIDO";
  }

  return { bonus, label, wr: (wr * 100).toFixed(1) + "%" };
}


/* --- NUEVA FUNCIÃƒâ€œN PARA DASHBOARD V13 (HazaÃƒÂ±as y RÃƒÂ©cords) --- */
function getEpicDashboardData() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const scoresSheet = ss.getSheetByName('SCORES');
  
  if (!matchesSheet || !scoresSheet) return { topGames: [], titles: [] };

  const mData = matchesSheet.getDataRange().getValues();
  // Headers: MatchID(0), Date(1), Summoner(2), Champ(3), Lane(4), Result(5), K(6), D(7), A(8), Dmg(9), KP(10), Dur(11), Pts(12), Notes(13)

  // 1. TOP 5 PUNTUACIONES (Legendary Games)
  let allGames = [];
  for (let i = 1; i < mData.length; i++) {
     const row = mData[i];
     const pts = Number(row[12]);
     if (!isNaN(pts)) {
         allGames.push({
             player: row[2],
             champ: row[3],
             points: pts,
             kda: `${row[6]}/${row[7]}/${row[8]}`,
             notes: row[13]
         });
     }
  }
  // Ordenar y coger top 5
  const topGames = allGames.sort((a, b) => b.points - a.points).slice(0, 5);

  // 2. TÃƒÂTULOS ÃƒÅ¡NICOS (Best in Class)
  // Calculamos acumulados por jugador
  const playerStats = {}; 
  
  for (let i = 1; i < mData.length; i++) {
      const row = mData[i];
      const p = row[2];
      const k = Number(row[6] || 0);
      const d = Number(row[7] || 0);
      const notes = String(row[13] || "");
      const duration = Number(row[11] || 1);
      
      if (!playerStats[p]) playerStats[p] = { 
          games: 0, 
          totalKills: 0, 
          totalDeaths: 0, 
          towerDmgNoteCount: 0, 
          visionNoteCount: 0,
          wealthNoteCount: 0 
      };
      
      const s = playerStats[p];
      s.games++;
      s.totalKills += k;
      s.totalDeaths += d;
      
      if (notes.includes("Demoledor") || notes.includes("Estructuras") || notes.includes("Placas")) s.towerDmgNoteCount++;
      if (notes.includes("VisiÃƒÂ³n") || notes.includes("OJO DE SAURON") || notes.includes("VigÃƒÂ­a")) s.visionNoteCount++;
      if (notes.includes("Economista") || notes.includes("Magnate") || notes.includes("Wall Street")) s.wealthNoteCount++;
  }

  // Encontrar lÃƒÂ­deres
  let titles = {
      destructor: { player: 'N/A', val: 0 },
      visionary: { player: 'N/A', val: 0 },
      butcher: { player: 'N/A', val: 0 },
      immortal: { player: 'N/A', val: 999 }, // Menos es mejor (deaths)
      tycoon: { player: 'N/A', val: 0 }
  };

  for (const p in playerStats) {
      const s = playerStats[p];
      if (s.games < 3) continue; // MÃƒÂ­nimo 3 partidas para optar a tÃƒÂ­tulo

      const avgKills = s.totalKills / s.games;
      const avgDeaths = s.totalDeaths / s.games;

      if (s.towerDmgNoteCount > titles.destructor.val) titles.destructor = { player: p, val: s.towerDmgNoteCount };
      if (s.visionNoteCount > titles.visionary.val) titles.visionary = { player: p, val: s.visionNoteCount };
      if (avgKills > titles.butcher.val) titles.butcher = { player: p, val: avgKills };
      if (avgDeaths < titles.immortal.val) titles.immortal = { player: p, val: avgDeaths };
      if (s.wealthNoteCount > titles.tycoon.val) titles.tycoon = { player: p, val: s.wealthNoteCount };
  }

  // Formatear para enviar
  const finalTitles = [
      { id: 'DEMOLEDOR', player: titles.destructor.player, label: 'Ã°Å¸Å¡Å“ El Demoledor', sub: `${titles.destructor.val} hazaÃƒÂ±as` },
      { id: 'VISION', player: titles.visionary.player, label: 'Ã°Å¸â€˜ÂÃ¯Â¸Â El Ojo', sub: `${titles.visionary.val} menciones` },
      { id: 'BUTCHER', player: titles.butcher.player, label: 'Ã°Å¸Â©Â¸ Carnicero', sub: `${titles.butcher.val.toFixed(1)} kills/game` },
      { id: 'IMMORTAL', player: titles.immortal.player, label: 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â Inmortal', sub: `${titles.immortal.val.toFixed(1)} deaths/game` },
      { id: 'TYCOON', player: titles.tycoon.player, label: 'Ã°Å¸â€™Â° Magnate', sub: `${titles.tycoon.val} menciones` }
  ];

  return { topGames, titles: finalTitles };
}

/* =========================================
   FUNCIONES AUXILIARES FALTANTES
   ========================================= */

// Necesaria para el desplegable de vÃƒÂ­ctimas en la web
function getAliveTargets(currentUser) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MARKET_STATUS');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const targets = [];
  
  // Empezamos en 1 para saltar cabecera
  for (let i = 1; i < data.length; i++) {
    const name = String(data[i][0]).trim();
    const status = String(data[i][6]).trim(); // Columna G
    
    // Filtro: Debe estar VIVO y NO ser el usuario actual
    if (status === 'ALIVE' && name !== currentUser) {
      targets.push(name);
    }
  }
  return targets.sort();
}

// Necesaria para crear la hoja de sabotajes y aÃƒÂ±adir items a la tienda
function SetupPurgeExtras() {
  const ss = SpreadsheetApp.getActive();
  
  // 1. Crear Hoja de Sabotajes
  if (!ss.getSheetByName('PURGE_SABOTAGES')) {
    const sheet = ss.insertSheet('PURGE_SABOTAGES');
    sheet.getRange('A1:D1').setValues([['Attacker', 'Victim', 'Status', 'Date']]).setFontWeight('bold');
  }

  // 2. AÃƒÂ±adir Objetos a la Tienda
  const shopSheet = ss.getSheetByName('SHOP_ITEMS');
  if (shopSheet) {
    const currentItems = shopSheet.getDataRange().getValues().map(r => r[0]);
    
    if (!currentItems.includes('TOXIC_INJECTOR')) {
      shopSheet.appendRow(['TOXIC_INJECTOR', 'Inyector TÃƒÂ³xico', 'Aumenta la penalizaciÃƒÂ³n de una vÃƒÂ­ctima en -1.0 pts esta noche.', 600, 'Ã°Å¸â€™â€°']);
    }
    if (!currentItems.includes('GAS_MASK')) {
      shopSheet.appendRow(['GAS_MASK', 'MÃƒÂ¡scara de Gas', 'Bloquea TODOS los sabotajes recibidos esta noche (Se consume al uso).', 800, 'Ã°Å¸ËœÂ·']);
    }
  }
  
  // 3. Inicializar Clima
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PURGE_WEATHER')) {
    props.setProperty('PURGE_WEATHER', 'NEUTRAL');
  }

  Logger.log("Ã¢Å“â€¦ Extras de Purga configurados.");
}


function addVoteBallot() {
  const ss = SpreadsheetApp.getActive();
  const shopSheet = ss.getSheetByName('SHOP_ITEMS');
  // ID, Nombre, DescripciÃƒÂ³n, Precio, Icono
  shopSheet.appendRow(['VOTE_BALLOT', 'Papeleta de Voto', 'Vota por el General de tu facciÃƒÂ³n. Escribe su nombre al comprar.', 1, 'Ã°Å¸â€”Â³Ã¯Â¸Â']);
}

/* ==========================================
   Ã°Å¸ÂÂ FINALIZAR VOTACIÃƒâ€œN: ASIGNAR ROLES + ANUNCIO
   ========================================== */
function updateAllRoles() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('FACTIONS');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  
  // 1. LIMPIEZA: Reiniciar a todos a 'SOLDIER' antes de contar
  sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).setValue('SOLDIER');

  // 2. CONFIGURACIÃƒâ€œN DE ESCANEO
  const roleConfig = [
    { name: "GENERAL",   voteIndex: 4 },
    { name: "ESTRATEGA", voteIndex: 5 },
    { name: "TANQUE",    voteIndex: 6 }
  ];

  // Estructura para guardar ganadores (Fila y Nombre)
  const winners = {
    "HEXTECH": {},
    "CHEMTECH": {}
  };

  // Inicializar objetos
  ["HEXTECH", "CHEMTECH"].forEach(team => {
      roleConfig.forEach(r => {
          winners[team][r.name] = { playerRow: -1, maxVotes: -1, playerName: "Vacante" };
      });
  });

  // 3. RECUENTO DE VOTOS
  for (let i = 1; i < data.length; i++) { // Empezamos en 1 (fila 2)
    const row = data[i];
    const pName = row[0];
    const playerTeam = row[1]; // Columna B
    
    if (playerTeam === 'HEXTECH' || playerTeam === 'CHEMTECH') {
        
        roleConfig.forEach(role => {
            const votes = Number(row[role.voteIndex] || 0);
            
            // Si supera al lÃƒÂ­der actual de ese rol en su equipo
            if (votes > winners[playerTeam][role.name].maxVotes && votes > 0) {
                winners[playerTeam][role.name] = { 
                    playerRow: i + 1, 
                    maxVotes: votes,
                    playerName: pName // <--- GUARDAMOS EL NOMBRE AQUÃƒÂ
                };
            }
        });
    }
  }

  // 4. ASIGNAR LOS TÃƒÂTULOS EN EL EXCEL
  const finalAssignments = {};

  ["HEXTECH", "CHEMTECH"].forEach(team => {
      roleConfig.forEach(r => {
          const w = winners[team][r.name];
          if (w.playerRow !== -1) {
              if (!finalAssignments[w.playerRow]) finalAssignments[w.playerRow] = [];
              finalAssignments[w.playerRow].push(r.name);
          }
      });
  });

  // Escribir en la hoja
  for (const rowNum in finalAssignments) {
      const rolesString = finalAssignments[rowNum].join(" / ");
      sheet.getRange(Number(rowNum), 4).setValue(rolesString); 
  }

  // 5. ANUNCIO A DISCORD (LA NOVEDAD)
  sendDiscordRolesAnnouncement(winners);

  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Recuento finalizado y anunciado en Discord.");
}

/* ----------------- ESCARAMUZA DIARIA (DETALLADA) ----------------- */
function runDailySkirmish() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('EVENT_WAR_ACTIVE') !== 'TRUE') return;

  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const factionSheet = ss.getSheetByName('FACTIONS');
  
  // 1. Definir MisiÃƒÂ³n
  const today = new Date();
  const dayIndex = today.getDay(); 
  
  const missions = {
      1: { name: "LUNES DE SANGRE", stat: 'kills', unit: 'Kills' },
      2: { name: "MARTES TÃƒÂCTICO", stat: 'assists', unit: 'Asistencias' },
      3: { name: "MIÃƒâ€°RCOLES DE ASEDIO", stat: 'turrets', unit: 'DaÃƒÂ±o Torres' },
      4: { name: "JUEVES DE VISIÃƒâ€œN", stat: 'vision', unit: 'PuntuaciÃƒÂ³n VisiÃƒÂ³n' }, 
      5: { name: "VIERNES DE ORO", stat: 'gold', unit: 'Oro' }, // Se dividirÃƒÂ¡ por 1000 visualmente
      6: { name: "SÃƒÂBADO DEL VACÃƒÂO", stat: 'obj', unit: 'Objetivos' },
      0: { name: "DOMINGO DE SUPERVIVENCIA", stat: 'deaths_reverse', unit: 'Muertes (Menos es mejor)' }
  };

  const mission = missions[dayIndex];
  if (!mission) return;

  // 2. Obtener datos de jugadores
  const fData = factionSheet.getDataRange().getValues();
  const playerInfo = {}; 
  
  for(let i=1; i<fData.length; i++) {
      playerInfo[fData[i][0]] = { team: fData[i][1], role: fData[i][3] };
  }

  // 3. ACUMULADOR POR JUGADOR (NUEVO)
  const dailyStats = {}; // { "Nombre": { score: 0, team: "HEXTECH", isStrat: false } }

  const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
  const mData = matchesSheet.getDataRange().getValues();

  for(let i=1; i<mData.length; i++) {
      const rowDate = new Date(mData[i][1]).getTime();
      const player = mData[i][2];
      
      if (rowDate >= oneDayAgo && playerInfo[player]) {
          
          let value = 0;
          // Extraer dato
          if (mission.stat === 'kills') value = Number(mData[i][6]);
          else if (mission.stat === 'assists') value = Number(mData[i][8]);
          else if (mission.stat === 'turrets') value = Number(mData[i][9]); 
          else if (mission.stat === 'vision') value = Number(mData[i][10]) * 100; // KP como proxy si no hay vision score
          else if (mission.stat === 'gold') value = Number(mData[i][12]) * 100; 
          else if (mission.stat === 'obj') value = 1; 
          else if (mission.stat === 'deaths_reverse') value = Number(mData[i][7]); 

          // Inicializar jugador si no existe en el mapa de hoy
          if (!dailyStats[player]) {
              dailyStats[player] = { 
                  score: 0, 
                  team: playerInfo[player].team,
                  isStrat: playerInfo[player].role.includes('ESTRATEGA')
              };
          }

          // BONUS ESTRATEGA (x2)
          if (dailyStats[player].isStrat) {
              value = value * 2;
          }

          // Sumar al acumulado del jugador
          dailyStats[player].score += value;
      }
  }

  // 4. PREPARAR LISTAS Y TOTALES
  let hexTotal = 0;
  let chemTotal = 0;
  let hexDetails = [];
  let chemDetails = [];
  let mvpName = "Nadie";
  let mvpValue = -1;

  // Convertir mapa a arrays y sumar totales
  for (const [name, data] of Object.entries(dailyStats)) {
      if (data.team === 'HEXTECH') {
          hexTotal += data.score;
          hexDetails.push({ name: name, score: data.score, isStrat: data.isStrat });
      } else if (data.team === 'CHEMTECH') {
          chemTotal += data.score;
          chemDetails.push({ name: name, score: data.score, isStrat: data.isStrat });
      }

      // MVP Check (Ignorar lÃƒÂ³gica inversa de domingo para simplificar MVP visual)
      if (mission.stat !== 'deaths_reverse' && data.score > mvpValue) {
          mvpValue = data.score;
          mvpName = name;
      }
  }

  // Ordenar listas de mayor a menor aporte
  hexDetails.sort((a, b) => b.score - a.score);
  chemDetails.sort((a, b) => b.score - a.score);

  // 5. Determinar Ganador
  let winner = '';
  let bonusPts = 50;
  
  if (mission.stat === 'deaths_reverse') {
      if (hexTotal < chemTotal && hexTotal > 0) winner = 'HEXTECH'; // Menos es mejor
      else if (chemTotal < hexTotal && chemTotal > 0) winner = 'CHEMTECH';
  } else {
      if (hexTotal > chemTotal) winner = 'HEXTECH';
      else if (chemTotal > hexTotal) winner = 'CHEMTECH';
  }

  // 6. Enviar a Discord y Guardar Bonus
  if (winner) {
      const propKey = `WAR_BONUS_${winner}`;
      const currentBonus = Number(props.getProperty(propKey) || 0);
      props.setProperty(propKey, String(currentBonus + bonusPts));

      // Llamada actualizada con las listas detalladas
      sendDiscordWarNotification(mission.name, winner, hexTotal, chemTotal, hexDetails, chemDetails, mission.unit);
  }
}

/* ----------------- ENVÃƒÂO DISCORD ESCARAMUZA DETALLADA ----------------- */
function sendDiscordWarNotification(missionName, winner, hexScore, chemScore, hexList, chemList, unitLabel) {
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1441052410402570360/FRdkGyD-gdtgadnofato00bxOizHgXf7KV6Yjulu3mnKRAtT3owNaBlEJS7J8QIjFQo1"; 
  
  let color = (winner === 'HEXTECH') ? 3447003 : 5763719; 

  // FunciÃƒÂ³n auxiliar para crear el texto de la lista
  const formatList = (list) => {
      if (list.length === 0) return "Ã°Å¸â€™Â¤ Sin actividad hoy.";
      return list.map(p => {
          let icon = p.isStrat ? "Ã°Å¸Â§Â  " : ""; // Icono de Estratega
          // Formato numÃƒÂ©rico limpio (si es oro grande lo ponemos en k)
          let valStr = (unitLabel === 'Oro' && p.score > 1000) ? (p.score/100).toFixed(1) + "k" : p.score.toFixed(0);
          return `**${p.score.toFixed(0)}** - ${icon}${p.name}`;
      }).join('\n');
  };

  const hexBody = formatList(hexList);
  const chemBody = formatList(chemList);

  const payload = {
    username: "SoloQ Referee",
    avatar_url: "https://i.imgur.com/M0k3y3N.png",
    content: "Ã¢Å¡â€Ã¯Â¸Â **REPORTE DEL FRENTE**",
    embeds: [{
      title: `ESCARAMUZA: ${missionName}`,
      description: `La batalla ha terminado. **${winner}** se lleva el bonus (+50 Pts).`,
      color: color,
      fields: [
        { 
            name: `Ã°Å¸â€™Å½ HEXTECH (Total: ${hexScore.toFixed(0)})`, 
            value: hexBody, 
            inline: true 
        },
        { 
            name: `Ã°Å¸Â§Âª CHEMTECH (Total: ${chemScore.toFixed(0)})`, 
            value: chemBody, 
            inline: true 
        },
        {
            name: "Ã°Å¸â€œÅ  Detalle",
            value: `Unidad de medida: **${unitLabel}**.\n*(Ã°Å¸Â§Â  = Aporte Doble de Estratega)*`,
            inline: false
        }
      ],
      footer: { text: "Guerra de Facciones Ã¢â‚¬Â¢ Reporte Diario" },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch(e) {
    Logger.log("Discord Error: " + e.message);
  }
}

function configurarHorariosGuerra() {
  // 1. Borramos triggers anteriores de guerra para no duplicar
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    const handler = t.getHandlerFunction();
    if (['startFactionWar', 'updateFactionRoles', 'endFactionWar', 'runDailySkirmish'].includes(handler)) {
      ScriptApp.deleteTrigger(t);
    }
  }

  // 2. CREAR LOS NUEVOS TRIGGERS

  // A. INICIO DE GUERRA (Lunes 09:00)
  // Genera los equipos y abre la veda.
  ScriptApp.newTrigger('startFactionWar')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  // B. CIERRE DE URNAS Y NOMBRAMIENTO (Lunes 23:00) - Ã‚Â¡TU PETICIÃƒâ€œN!
  // Se ejecuta 1 vez a la semana. Cuenta votos y asigna Generales.
  ScriptApp.newTrigger('updateFactionRoles')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(23)
    .create();

  // C. ESCARAMUZAS DIARIAS (Cada noche a las 23:45, de Martes a Domingo)
  // Nota: No lo ponemos el lunes porque el lunes es dÃƒÂ­a de votaciÃƒÂ³n.
  // Creamos un trigger diario, y dentro de la funciÃƒÂ³n 'runDailySkirmish'
  // podemos poner un 'if (day === 1) return;' si queremos saltar el lunes,
  // pero ejecutarlo todos los dÃƒÂ­as a las 23:45 estÃƒÂ¡ bien.
  ScriptApp.newTrigger('runDailySkirmish')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(45)
    .create();

  // D. FINAL DE GUERRA (Domingo 23:30)
  // Reparte premios y cierra el evento.
  ScriptApp.newTrigger('endFactionWar')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .nearMinute(30)
    .create();

  console.log("Ã¢Å“â€¦ Horarios de Guerra configurados perfectamente.");
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Calendario de Guerra configurado:\n\n- Lunes 09:00: Inicio y Equipos.\n- Lunes 23:00: Recuento de Votos (Generales).\n- Diario 23:45: Escaramuzas.\n- Domingo 23:30: Final.");
}

/* ==================================================
   Ã°Å¸â€”Â³Ã¯Â¸Â SISTEMA DE VOTACIÃƒâ€œN VISUAL (INTERFAZ)
   ================================================== */

/* ==========================================================
   Ã°Å¸â€”Â³Ã¯Â¸Â GESTIÃƒâ€œN DE VOTOS DESDE INVENTARIO
   ========================================================== */

// 1. Abrir la urna en MODO INVENTARIO
function abrirUrnaInventario() {
  // Pasamos la variable 'mode' al HTML
  const template = HtmlService.createTemplateFromFile('VotingBooth');
  template.mode = 'INVENTORY'; 
  
  const html = template.evaluate()
      .setWidth(400)
      .setHeight(450)
      .setTitle('Ã°Å¸â€”Â³Ã¯Â¸Â Usar Voto del Inventario');
  SpreadsheetApp.getUi().showModalDialog(html, 'Urna Electoral');
}

// 2. Procesar el voto (CONSUME ÃƒÂTEM, NO COBRA ORO)
function procesarVotoInventario(player, candidateName) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, msg: "Sistema ocupado." };

  try {
    const ss = SpreadsheetApp.getActive();
    const factionSheet = ss.getSheetByName('FACTIONS');
    const invSheet = ss.getSheetByName('INVENTORY');
    
    // A. Validar que tiene el ÃƒÂ­tem en inventario
    const iData = invSheet.getDataRange().getValues();
    let itemRow = -1;
    
    for (let i=1; i<iData.length; i++) {
        if (iData[i][0] === player && iData[i][1] === 'VOTE_BALLOT' && iData[i][2] === 'ACTIVE') {
            itemRow = i+1;
            break;
        }
    }
    if (itemRow === -1) return { success: false, msg: "No tienes una papeleta activa." };

    // B. Validar FacciÃƒÂ³n y Candidato (Igual que en tienda)
    const fData = factionSheet.getDataRange().getValues();
    let voterTeam = null, candidateTeam = null, candidateRow = -1, voterRow = -1;
    let voteHistory = "";

    for(let i=1; i<fData.length; i++) {
        if (fData[i][0] === player) {
            voterRow = i+1; 
            voterTeam = fData[i][1];
            voteHistory = String(fData[i][5] || "");
        }
        if (fData[i][0] === candidateName) {
            candidateRow = i+1; 
            candidateTeam = fData[i][1];
        }
    }

    if (!voterTeam || !candidateTeam) return { success: false, msg: "Datos de facciÃƒÂ³n invÃƒÂ¡lidos." };
    if (voterTeam !== candidateTeam) return { success: false, msg: "Solo puedes votar a tu equipo." };
    if (voteHistory.includes("GENERAL")) return { success: false, msg: "Ya has votado para General." };

    // C. EJECUTAR VOTO
    // 1. Sumar voto
    let currentVotes = Number(factionSheet.getRange(candidateRow, 5).getValue() || 0);
    factionSheet.getRange(candidateRow, 5).setValue(currentVotes + 1);
    
    // 2. Marcar historial
    factionSheet.getRange(voterRow, 6).setValue(voteHistory + "GENERAL,");

    // 3. CONSUMIR ÃƒÂTEM
    invSheet.getRange(itemRow, 3).setValue('USED');

    return { success: true, msg: `Voto usado para ${candidateName}.` };

  } catch(e) {
    return { success: false, msg: "Error: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

// 3. Modificar la funciÃƒÂ³n de apertura normal (para que sepa que es MODO TIENDA)
function abrirUrnaVotacion() {
  const template = HtmlService.createTemplateFromFile('VotingBooth');
  template.mode = 'SHOP'; // Modo por defecto
  
  const html = template.evaluate()
      .setWidth(400)
      .setHeight(450)
      .setTitle('Ã°Å¸â€”Â³Ã¯Â¸Â Urna Electoral (Tienda)');
  SpreadsheetApp.getUi().showModalDialog(html, 'Elecciones Generales');
}

// 2. FunciÃƒÂ³n auxiliar: Obtener lista de TODOS los jugadores (para saber quiÃƒÂ©n eres)
function getAllFactionPlayers() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('FACTIONS');
  if (!sheet) return [];
  
  // Asumimos Columna A (0) = Nombre
  const data = sheet.getRange(2, 1, sheet.getLastRow()-1, 1).getValues().flat();
  return data.filter(String).sort();
}

// 3. FunciÃƒÂ³n auxiliar: Obtener compaÃƒÂ±eros de equipo (para el desplegable)
function getTeammatesForVoting(voterName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('FACTIONS');
  const data = sheet.getDataRange().getValues();
  
  let myTeam = null;
  const teammates = [];

  // 1. Buscar tu equipo
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === voterName) {
      myTeam = data[i][1]; // Columna B (Team)
      break;
    }
  }

  if (!myTeam) return { error: "No tienes equipo asignado." };

  // 2. Filtrar compaÃƒÂ±eros
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === myTeam) {
      // Opcional: Si quieres que puedan votarse a sÃƒÂ­ mismos, quita la condiciÃƒÂ³n `!== voterName`
      // if (data[i][0] !== voterName) { 
         teammates.push(data[i][0]);
      // }
    }
  }

  return { team: myTeam, candidates: teammates.sort() };
}

// 4. Procesar el voto desde el HTML
function procesarVotoWeb(voter, candidate) {
  // Reutilizamos tu potente funciÃƒÂ³n buyShopItem para no duplicar lÃƒÂ³gica
  // Simula que el jugador compra el ÃƒÂ­tem 'VOTE_BALLOT' con el nombre del candidato
  return buyShopItem(voter, 'VOTE_BALLOT', candidate);
}


/* ==========================================================
   Ã°Å¸â€ºÂÃ¯Â¸Â BOTÃƒâ€œN MAESTRO (ASIGNAR ESTA FUNCIÃƒâ€œN AL BOTÃƒâ€œN DEL EXCEL)
   ========================================================== */
function comprarObjetoActual() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  // 1. Validar que estamos en la Tienda
  if (sheet.getName() !== 'SHOP_ITEMS') {
    ui.alert("Ã¢ÂÅ’ Este botÃƒÂ³n solo funciona en la hoja SHOP_ITEMS.");
    return;
  }

  // 2. Leer el objeto seleccionado (Fila actual)
  const row = sheet.getActiveCell().getRow();
  if (row < 2) return; // Si estÃƒÂ¡ en la cabecera, no hace nada

  const itemID = String(sheet.getRange(row, 1).getValue()).trim(); // Col A: ID
  const itemName = String(sheet.getRange(row, 2).getValue()).trim(); // Col B: Nombre
  const price = Number(sheet.getRange(row, 4).getValue()); // Col D: Precio

  if (!itemID) {
    ui.alert("Ã¢ÂÅ’ Selecciona una fila vÃƒÂ¡lida con un objeto.");
    return;
  }

  // ======================================================
  // Ã°Å¸â€”Â³Ã¯Â¸Â CASO A: ES UN VOTO -> ABRIMOS LA URNA HTML
  // ======================================================
  if (itemID === 'VOTE_BALLOT') {
    // Esta funciÃƒÂ³n abre el archivo HTML 'VotingBooth'
    if (typeof abrirUrnaVotacion === 'function') {
        abrirUrnaVotacion(); 
    } else {
        ui.alert("Ã¢ÂÅ’ Error: No se encuentra la funciÃƒÂ³n 'abrirUrnaVotacion'. Revisa que copiaste el cÃƒÂ³digo de la interfaz.");
    }
    return; // Salimos, la web se encarga del resto
  }

  // ======================================================
  // Ã°Å¸Å½Â CASO B: RESTO DE OBJETOS (COFRES, POCIONES...)
  // ======================================================
  
  const response = ui.prompt(
    `Comprar ${itemName}`,
    `Vas a gastar ${price} G.\n\nEscribe tu nombre de invocador exacto:`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const player = response.getResponseText().trim();
  if (!player) return;

  // Pedir datos extra si es necesario
  let extraData = null;
  if (itemID === 'TOXIC_INJECTOR' || itemID === 'MEGAPHONE') {
      const extraRes = ui.prompt("Dato Adicional", itemID === 'MEGAPHONE' ? "Escribe el mensaje:" : "Escribe el nombre de la vÃƒÂ­ctima:", ui.ButtonSet.OK);
      extraData = extraRes.getResponseText();
  }

  // LLAMADA AL MOTOR (Tu funciÃƒÂ³n buyShopItem)
  const result = buyShopItem(player, itemID, extraData);

  // Resultado
  if (result.success) {
      // Ã°Å¸Å½Â° Si es un COFRE, lanzamos la RULETA
      if (itemID === 'CHEST_HEXTECH' || itemID === 'ONE_PIECE') {
          const lootVisual = [
              "Ã°Å¸â€™Â© Chatarra (5G)", "Ã°Å¸Â§Âª PociÃƒÂ³n de Elo", "Ã°Å¸â€ºÂ¡Ã¯Â¸Â ÃƒÂngel GuardiÃƒÂ¡n", 
              "Ã°Å¸â€™Â° Soborno", "Ã°Å¸â€œË† Acciones (Insider)", "Ã°Å¸â€™Â° Tesoro (800G)"
          ];
          if (itemID === 'ONE_PIECE') lootVisual.push("Ã°Å¸Å¡Â¨ JACKPOT ONE PIECE");

          if (typeof showRouletteAnimation === 'function') {
             showRouletteAnimation(result.winnerItem, lootVisual);
          } else {
             ui.alert(`Ã¢Å“â€¦ COMPRA Ãƒâ€°XITOSA\n${result.msg}`);
          }
      } 
      else {
          ui.alert(`Ã¢Å“â€¦ COMPRA Ãƒâ€°XITOSA\n${result.msg}`);
      }
  } else {
      ui.alert(`Ã¢ÂÅ’ ERROR\n${result.msg}`);
  }
}


/* ==========================================================
   Ã°Å¸Å½â€™ BOTÃƒâ€œN MAESTRO DE INVENTARIO (Asignar al botÃƒÂ³n de INVENTORY)
   ========================================================== */
function usarObjetoActual() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  if (sheet.getName() !== 'INVENTORY') {
    ui.alert("Ã¢ÂÅ’ Este botÃƒÂ³n solo funciona en la hoja INVENTORY.");
    return;
  }

  const row = sheet.getActiveCell().getRow();
  if (row < 2) return;

  const player = String(sheet.getRange(row, 1).getValue()).trim();
  const itemID = String(sheet.getRange(row, 2).getValue()).trim();
  const status = String(sheet.getRange(row, 3).getValue()).trim();

  // ValidaciÃƒÂ³n bÃƒÂ¡sica
  if (status !== 'ACTIVE') {
      ui.alert(`Ã¢ÂÅ’ Este objeto no se puede usar (Estado: ${status})`);
      return;
  }

  // --- 1. CASO VOTO -> ABRIR URNA (MODO INVENTARIO) ---
  if (itemID === 'VOTE_BALLOT') {
      abrirUrnaInventario(); // <--- Llama a la nueva funciÃƒÂ³n
      return;
  }

  // --- 2. CASO COFRE -> RULETA ---
  if (itemID === 'CHEST_HEXTECH' || itemID === 'ONE_PIECE') {
      // Usamos la funciÃƒÂ³n existente de usar inventario
      const result = useInventoryItem(player, itemID);
      
      if (result.success) {
          const lootVisual = [
              "Ã°Å¸â€™Â© Chatarra", "Ã°Å¸Â§Âª PociÃƒÂ³n", "Ã°Å¸â€ºÂ¡Ã¯Â¸Â ÃƒÂngel", "Ã°Å¸â€™Â° Soborno", "Ã°Å¸â€œË† Acciones", "Ã°Å¸â€™Â° 800 G"
          ];
          if (itemID === 'ONE_PIECE') lootVisual.push("Ã°Å¸Å¡Â¨ ONE PIECE");
          
          showRouletteAnimation(result.winnerItem, lootVisual);
      } else {
          ui.alert("Ã¢ÂÅ’ Error: " + result.msg);
      }
      return;
  }

  // --- 3. OTROS OBJETOS ---
  // Preguntar confirmaciÃƒÂ³n para objetos que no tienen interfaz
  const confirm = ui.alert(`Usar ${itemID}`, `Ã‚Â¿Seguro que quieres consumir este objeto?`, ui.ButtonSet.YES_NO);
  if (confirm === ui.Button.YES) {
      // LÃƒÂ³gica genÃƒÂ©rica de uso (si tienes una funciÃƒÂ³n para pociones, etc.)
      // Por defecto marcamos como USED
      sheet.getRange(row, 3).setValue('USED');
      ui.alert("Ã¢Å“â€¦ Objeto consumido.");
  }
}


function getTeammatesForVoting(voterName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('FACTIONS');
  if (!sheet) return { error: "No se ha iniciado la guerra." };
  
  const data = sheet.getDataRange().getValues();
  // Limpieza del nombre de entrada
  const voterClean = String(voterName).trim().toLowerCase();
  
  let myTeam = null;
  const teammates = [];

  // 1. Buscar tu equipo
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === voterClean) {
      myTeam = data[i][1]; 
      break;
    }
  }

  if (!myTeam) return { error: "No tienes equipo asignado." };

  // 2. Filtrar compaÃƒÂ±eros
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === myTeam) {
       teammates.push(data[i][0]);
    }
  }

  return { team: myTeam, candidates: teammates.sort() };
}

/* --- HELPER PARA LA WEB: OBTENER MISIÃƒâ€œN DIARIA --- */
function getCurrentDailyMission() {
  const today = new Date();
  // Ajuste horario: Si es antes de las 09:00 AM (inicio guerra), mostramos la de ayer o "Descanso"
  // Pero para simplificar, usaremos el dÃƒÂ­a natural.
  const dayIndex = today.getDay(); // 0=Domingo, 1=Lunes...

  const missions = {
    1: { name: "LUNES DE SANGRE", icon: "Ã°Å¸Â©Â¸", desc: "Objetivo: Acumular mÃƒÂ¡s Kills totales." },
    2: { name: "MARTES TÃƒÂCTICO", icon: "Ã°Å¸Â¤Â", desc: "Objetivo: Acumular mÃƒÂ¡s Asistencias." },
    3: { name: "MIÃƒâ€°RCOLES DE ASEDIO", icon: "Ã°Å¸Å¡Å“", desc: "Objetivo: Destruir mÃƒÂ¡s Torres e Inhibidores." },
    4: { name: "JUEVES DE VISIÃƒâ€œN", icon: "Ã°Å¸â€˜ÂÃ¯Â¸Â", desc: "Objetivo: Mejor puntuaciÃƒÂ³n de VisiÃƒÂ³n." },
    5: { name: "VIERNES DE ORO", icon: "Ã°Å¸â€™Â°", desc: "Objetivo: Acumular mÃƒÂ¡s Oro total." },
    6: { name: "SÃƒÂBADO DEL VACÃƒÂO", icon: "Ã°Å¸â€˜Â¾", desc: "Objetivo: Matar mÃƒÂ¡s Dragones y Barones." },
    0: { name: "DOMINGO DE SUPERVIVENCIA", icon: "Ã°Å¸â€ºÂ¡Ã¯Â¸Â", desc: "Objetivo: Morir menos veces." }
  };

  return missions[dayIndex] || { name: "DÃƒÂA DE PAZ", icon: "Ã°Å¸ÂÂ³Ã¯Â¸Â", desc: "Sin misiÃƒÂ³n activa hoy." };
}

function getRankingByDivision(seasonFilter) {
  const ss = SpreadsheetApp.getActive();
  const playersSheet = ss.getSheetByName('PLAYERS');
  
  // 1. OBTENER DATOS YA FILTRADOS
  // En lugar de leer la hoja SCORES (que tiene todo mezclado), 
  // llamamos a tu funciÃƒÂ³n que SÃƒÂ sabe filtrar las partidas por S1, S2 o ALL.
  const epicData = getEpicRankingData(seasonFilter);
  
  // 2. CREAR MAPA DE PUNTOS Y PARTIDAS FILTRADAS
  const scoreMap = {};
  const gamesMap = {}; 
  
  epicData.forEach(p => {
      scoreMap[p.name] = Number(p.points);
      gamesMap[p.name] = p.totalGames;
  });

  const pData = playersSheet.getDataRange().getValues();
  
  // Buscar columna DIVISION
  const headers = pData[0];
  let divColIndex = headers.length - 1; // Por defecto la ÃƒÂºltima
  for(let h=0; h < headers.length; h++){
    if(String(headers[h]).toUpperCase().includes("DIVISION")) {
      divColIndex = h;
      break;
    }
  }

  let listDiv1 = [];
  let listDiv2 = [];

  // 3. Recorrer Jugadores (Saltamos header i=0)
  for (let i = 1; i < pData.length; i++) {
    const name = pData[i][0];   // Columna A
    const active = pData[i][4]; // Columna E

    // Filtro de inactivos opcional
    // if (String(active).toLowerCase() === 'no') continue; 

    const streak = pData[i][5];      // Columna F: CurrentStreak
    const opgg = pData[i][7];
    const rank = pData[i][8];
    const division = String(pData[i][divColIndex]).toUpperCase();
    
    // Obtenemos los puntos y juegos de ESTA TEMPORADA (si no ha jugado, es 0)
    const points = scoreMap[name] || 0;
    const totalGames = gamesMap[name] || 0;

    let playerObj = {
      name: name,
      points: Number(points).toFixed(2),
      rank: rank,
      opgg: opgg,
      streak: streak,         
      totalGames: totalGames  
    };

    // Clasificar
    if (division.includes("2")) {
      listDiv2.push(playerObj);
    } else {
      listDiv1.push(playerObj);
    }
  }

  // 4. Ordenar de mayor a menor puntuaciÃƒÂ³n
  listDiv1.sort((a, b) => b.points - a.points);
  listDiv2.sort((a, b) => b.points - a.points);

  return { div1: listDiv1, div2: listDiv2 };
}


function SetupTeamBattleSheet() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName('TEAM_BATTLE')) {
    const sheet = ss.insertSheet('TEAM_BATTLE');
    // TeamID | Player | Role (Assigned) | Status (PENDING/LOCKED) | Score_Cache
    sheet.getRange('A1:E1').setValues([['TeamID', 'Player', 'AssignedRole', 'Status', 'LastScore']]).setFontWeight('bold');
    Logger.log("Hoja TEAM_BATTLE creada.");
  }
}

/* ==========================================================
   Ã°Å¸Ââ€  GESTIÃƒâ€œN DEL TORNEO POR FASES (SEMIS -> FINAL)
   ========================================================== */

// 1. INICIAR TORNEO (CONFIGURA LAS SEMIFINALES)
function startTeamBattleEvent() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  
  // ... (Tu lÃƒÂ³gica de Snake Draft existente para crear equipos se mantiene igual) ...
  // ... (AsegÃƒÂºrate de que crea 4 equipos preferiblemente, o mÃƒÂºltiplos pares) ...
  
  // [AQUÃƒÂ PEGAS TU LÃƒâ€œGICA DE CREACIÃƒâ€œN DE EQUIPOS/HOJA QUE YA TIENES]
  // Si no tienes la funciÃƒÂ³n a mano, usa la que te pasÃƒÂ© anteriormente que crea la hoja TEAM_BATTLE
  // ...
  
  // --- NUEVA LÃƒâ€œGICA DE FASES ---
  // Guardamos en memoria que estamos en SEMIFINALES
  props.setProperty('EVENT_TEAM_BATTLE_ACTIVE', 'TRUE');
  props.setProperty('TEAM_BATTLE_PHASE', 'LOCKED'); // Fase de juego
  props.setProperty('TOURNAMENT_ROUND', 'SEMIS'); // Ronda actual

  // Definimos los emparejamientos de Semifinales (1vs4 y 2vs3 tÃƒÂ­picos)
  // Guardamos un JSON: [[Team1, Team4], [Team2, Team3]]
  const matchups = JSON.stringify([[1, 4], [2, 3]]);
  props.setProperty('TOURNAMENT_MATCHUPS', matchups);

  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Torneo Iniciado: SEMIFINALES.\n\nEmparejamientos:\nÃ¢Å¡â€Ã¯Â¸Â Equipo 1 vs Equipo 4\nÃ¢Å¡â€Ã¯Â¸Â Equipo 2 vs Equipo 3");
}

/* ==========================================================
   Ã°Å¸Ââ€  RESOLUCIÃƒâ€œN DEL TORNEO (V5.0 - CON SUPLENTES)
   ========================================================== */

function resolveTeamBattleRound() {
  const props = PropertiesService.getScriptProperties();
  const currentRound = props.getProperty('TOURNAMENT_ROUND'); 
  
  if (!currentRound || currentRound === 'OFF') {
      Logger.log("No hay ronda activa.");
      return;
  }

  const ss = SpreadsheetApp.getActive();
  const battleSheet = ss.getSheetByName('TEAM_BATTLE');
  if (!battleSheet) return;

  const data = battleSheet.getDataRange().getValues();
  const teams = {}; 
  
  // 1. Lectura de Equipos
  for (let i = 1; i < data.length; i++) {
    const teamID = data[i][0];
    const player = data[i][1];
    let role = String(data[i][2]).toUpperCase().trim();
    
    // NormalizaciÃƒÂ³n de Roles
    if (role === 'UTILITY') role = 'SUPPORT';
    if (role === 'BOT') role = 'BOTTOM';
    if (role === 'MID') role = 'MIDDLE';
    if (role === 'SUPLENTE') role = 'SUB'; // <--- Nuevo Rol

    let score = 0;
    if (String(player).startsWith('Ã°Å¸Â¤â€“')) {
       score = Math.floor(Math.random() * 21); 
    } else {
       score = getPlayerCurrentScore(player); 
    }

    if (!teams[teamID]) teams[teamID] = { id: teamID, score: 0, members: {} };
    teams[teamID].members[role] = { player: player, score: score };
    
    battleSheet.getRange(i+1, 5).setValue(score);
  }

  // 2. Matchups
  let matchups = [];
  try {
      const stored = props.getProperty('TOURNAMENT_MATCHUPS');
      if (stored) matchups = JSON.parse(stored);
  } catch(e) { return; }

  if (!matchups || matchups.length === 0) return;

  let logMsg = "";
  const MAX_MATCH_POOL = 100;
  const MAX_PENALTY_POOL = 25;
  const CHAMPION_BONUS = 50;

  // --- LÃƒâ€œGICA DE PARTIDO CON SUPLENTES ---
  const calculateMatchResult = (teamA, teamB) => {
      let scoreA = 0;
      let scoreB = 0;
      const laneValues = { 'TOP': 1, 'JUNGLE': 2, 'MIDDLE': 2, 'BOTTOM': 1, 'SUPPORT': 1 };
      const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];

      // Banderas para saber si el suplente ya se usÃƒÂ³ en este partido
      let subUsedA = false;
      let subUsedB = false;

      roles.forEach(lane => {
          // Obtener titular o hueco vacÃƒÂ­o
          let pA = teamA.members[lane] || {score: -1, player: "VacÃƒÂ­o"};
          let pB = teamB.members[lane] || {score: -1, player: "VacÃƒÂ­o"};

          // --- MECÃƒÂNICA DE SUPLENTE (TEAM A) ---
          // Si el titular falta (score -1) o tiene 0 puntos (no jugÃƒÂ³), y hay suplente disponible
          if ((pA.score <= 0) && teamA.members['SUB'] && !subUsedA) {
              const sub = teamA.members['SUB'];
              if (sub.score > pA.score) { // Solo cambiamos si el suplente mejora al titular
                  pA = sub; // Ã‚Â¡El suplente entra al campo!
                  subUsedA = true; // Gastamos el cambio
                  Logger.log(`Ã°Å¸â€â€ž CAMBIO T${teamA.id}: Entra ${sub.player} por ${lane}`);
              }
          }

          // --- MECÃƒÂNICA DE SUPLENTE (TEAM B) ---
          if ((pB.score <= 0) && teamB.members['SUB'] && !subUsedB) {
              const sub = teamB.members['SUB'];
              if (sub.score > pB.score) {
                  pB = sub;
                  subUsedB = true;
                  Logger.log(`Ã°Å¸â€â€ž CAMBIO T${teamB.id}: Entra ${sub.player} por ${lane}`);
              }
          }
          
          // Duelo de LÃƒÂ­nea
          if (pA.score > pB.score) {
              scoreA += laneValues[lane];
              if (typeof giveHextechChest === 'function') giveHextechChest(pA.player);
          } else if (pB.score > pA.score) {
              scoreB += laneValues[lane];
              if (typeof giveHextechChest === 'function') giveHextechChest(pB.player);
          }
      });

      // Bonus Botlane (Nota: AquÃƒÂ­ no aplicamos suplente para simplificar, o usa el titular)
      const scoreABot = teamA.members['BOTTOM']?.score || -1;
      const scoreBBot = teamB.members['BOTTOM']?.score || -1;
      const scoreASupp = teamA.members['SUPPORT']?.score || -1;
      const scoreBSupp = teamB.members['SUPPORT']?.score || -1;

      if (scoreABot > scoreBBot && scoreASupp > scoreBSupp) scoreA += 1;
      if (scoreBBot > scoreABot && scoreBSupp > scoreASupp) scoreB += 1;

      return { scoreA, scoreB };
  };

  // --- EJECUCIÃƒâ€œN DE RONDAS ---

  if (currentRound === 'SEMIS') {
      const winners = [];
      const losers = [];
      logMsg += "Ã°Å¸â€œÂ¢ **RESULTADOS SEMIFINALES (Con Suplentes)**\n";

      matchups.forEach(match => {
          const tA = teams[match[0]];
          const tB = teams[match[1]];
          if (!tA || !tB) return;

          const res = calculateMatchResult(tA, tB);
          
          let winner, loser, diff;
          if (res.scoreA >= res.scoreB) { winner = tA; loser = tB; diff = res.scoreA - res.scoreB; }
          else { winner = tB; loser = tA; diff = res.scoreB - res.scoreA; }

          winners.push(winner.id);
          losers.push(loser.id);

          const reward = (diff / 8) * MAX_MATCH_POOL;
          const penalty = (diff / 8) * MAX_PENALTY_POOL;

          applyScaledTeamResult(winner, reward, false);
          applyScaledTeamResult(loser, penalty, true);

          logMsg += `Ã°Å¸â€Â¹ **T${winner.id}** (${Math.max(res.scoreA, res.scoreB)}) def. T${loser.id} (${Math.min(res.scoreA, res.scoreB)})\n`;
      });

      if (winners.length >= 2) {
          const finalsConfig = [[winners[0], winners[1]], [losers[0], losers[1]]];
          props.setProperty('TOURNAMENT_MATCHUPS', JSON.stringify(finalsConfig));
          props.setProperty('TOURNAMENT_ROUND', 'FINALS');
          logMsg += "\nÃ°Å¸â€Â¥ **Ã‚Â¡FINAL DEFINIDA!**";
      }

  } else if (currentRound === 'FINALS') {
      logMsg += "Ã°Å¸Ââ€  **GRAN FINAL DEL TORNEO**\n";
      
      const finalMatch = matchups[0];
      const fA = teams[finalMatch[0]];
      const fB = teams[finalMatch[1]];
      
      if (fA && fB) {
          const resF = calculateMatchResult(fA, fB);
          let champion, runnerUp, diffF;
          
          if (resF.scoreA >= resF.scoreB) { champion = fA; runnerUp = fB; diffF = resF.scoreA - resF.scoreB; }
          else { champion = fB; runnerUp = fA; diffF = resF.scoreB - resF.scoreA; }

          const champTotalReward = ((diffF / 8) * MAX_MATCH_POOL) + CHAMPION_BONUS;
          const runnerPenalty = (diffF / 8) * MAX_PENALTY_POOL;

          applyScaledTeamResult(champion, champTotalReward, false);
          applyScaledTeamResult(runnerUp, runnerPenalty, true);

          logMsg += `Ã°Å¸Â¥â€¡ **CAMPEÃƒâ€œN: TEAM ${champion.id}**\nÃ°Å¸Â¥Ë† SubcampeÃƒÂ³n: Team ${runnerUp.id}\n`;
      }
      
      // ConsolaciÃƒÂ³n
      const loserMatch = matchups[1];
      const lA = teams[loserMatch[0]];
      const lB = teams[loserMatch[1]];
      
      if (lA && lB) {
          const resL = calculateMatchResult(lA, lB);
          let third, fourth, diffL;
          
          if (resL.scoreA >= resL.scoreB) { third = lA; fourth = lB; diffL = resL.scoreA - resL.scoreB; }
          else { third = lB; fourth = lA; diffL = resL.scoreB - resL.scoreA; }

          const thirdReward = (diffL / 8) * MAX_MATCH_POOL;
          const fourthPenalty = ((diffL / 8) * MAX_PENALTY_POOL) + 10; 

          applyScaledTeamResult(third, thirdReward, false);
          applyScaledTeamResult(fourth, fourthPenalty, true);
          
          logMsg += `Ã°Å¸Â¥â€° 3Ã‚Âº: Team ${third.id} | Ã°Å¸Â¤Â¡ 4Ã‚Âº: Team ${fourth.id}\n`;
      }
      
      props.setProperty('EVENT_TEAM_BATTLE_ACTIVE', 'FALSE');
      props.setProperty('TOURNAMENT_ROUND', 'OFF');
  }
  
  if (typeof registerNews === 'function') {
      registerNews('EVENT', logMsg);
  }
}

// ==========================================================
// FUNCIONES AUXILIARES NECESARIAS
// ==========================================================

function getPlayerCurrentScore(playerName) {
  const ss = SpreadsheetApp.getActive();
  const rankingSheet = ss.getSheetByName('RANKING'); 
  if (!rankingSheet) return 10; 

  const data = rankingSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(playerName).trim().toLowerCase()) {
      return Number(data[i][1]) || 0;
    }
  }
  return 0;
}

function getFullLeaderboard() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MARKET_STATUS');
  const data = sheet.getDataRange().getValues();
  
  let players = [];
  // Asumimos que Summoner es col 0 y StockPrice (o puntos) es col 1
  for (let i = 1; i < data.length; i++) {
    players.push({
      name: data[i][0],
      score: Number(data[i][1])
    });
  }
  
  // Ordenar de mayor a menor puntuaciÃƒÂ³n
  return players.sort((a, b) => b.score - a.score);
}

function giveHextechChest(player) {
    if (!player || String(player).startsWith('Ã°Å¸Â¤â€“') || player === "VacÃƒÂ­o") return;
    const ss = SpreadsheetApp.getActive();
    let invSheet = ss.getSheetByName('INVENTORY');
    if (!invSheet) {
        invSheet = ss.insertSheet('INVENTORY');
        invSheet.appendRow(['Player', 'ItemID', 'Status', 'Date']);
    }
    invSheet.appendRow([player, 'CHEST_HEXTECH', 'ACTIVE', new Date()]);
}

function applyScaledTeamResult(teamObj, totalPool, isPenalty) {
    const ss = SpreadsheetApp.getActive();
    const marketSheet = ss.getSheetByName('MARKET_STATUS');
    const manualSheet = ss.getSheetByName('MANUAL_POINTS');

    let amountPerHead = Math.max(1, Math.floor(totalPool / 5));
    const finalAmount = isPenalty ? -amountPerHead : amountPerHead;
    const reason = isPenalty ? "Derrota Torneo" : "Victoria Torneo";

    if (teamObj && teamObj.members) {
        Object.values(teamObj.members).forEach(slot => {
            const player = slot.player;
            if (player && !String(player).startsWith('Ã°Å¸Â¤â€“') && player !== "VacÃƒÂ­o") {
                
                if (manualSheet) manualSheet.appendRow([new Date(), player, finalAmount, reason]);
                
                if (marketSheet) {
                    const data = marketSheet.getDataRange().getValues();
                    for (let i = 1; i < data.length; i++) {
                        if (String(data[i][0]).toLowerCase().trim() === String(player).toLowerCase().trim()) {
                            let current = Number(data[i][2]) || 0;
                            let newWallet = current + finalAmount; 
                            if (newWallet < 0) newWallet = 0; 
                            
                            marketSheet.getRange(i + 1, 3).setValue(newWallet);
                            break;
                        }
                    }
                }
            }
        });
    }
}

/* ==========================================================
   Ã°Å¸â€ºÂ Ã¯Â¸Â HERRAMIENTAS ADMIN TEAM BATTLE (GESTIÃƒâ€œN)
   ========================================================== */

// 1. AÃƒÂ±adir el objeto a la tienda (Ejecutar SOLO UNA VEZ)
function addTeamBattleItemToShop() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('SHOP_ITEMS');
  if(!sheet) return;
  // ID | Nombre | DescripciÃƒÂ³n | Precio | Icono
  sheet.appendRow([
    'TEAM_ROLE_VOTE', 
    'Contrato de Equipo', 
    'Reclama tu posiciÃƒÂ³n en el equipo. Escribe el rol al comprar: TOP, JUNGLE, MID, BOT o SUPPORT.', 
    50, // Precio simbÃƒÂ³lico
    'Ã°Å¸â€œÅ“'
  ]);
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Objeto 'Contrato de Equipo' aÃƒÂ±adido a la tienda.");
}

// 2. BLOQUEAR ROLES (Empieza la Guerra)
function lockTeamBattlePhase() {
  const props = PropertiesService.getScriptProperties();
  const current = props.getProperty('EVENT_TEAM_BATTLE_ACTIVE');
  
  if (current !== 'TRUE') {
      SpreadsheetApp.getUi().alert("Ã¢ÂÅ’ El evento no estÃƒÂ¡ activo. Ejecuta 'startTeamBattleEvent' primero.");
      return;
  }
  
  props.setProperty('TEAM_BATTLE_PHASE', 'LOCKED');
  
  if (typeof registerNews === 'function') {
      registerNews('WAR', 'Ã°Å¸â€â€™ FASE DE BLOQUEO: Los roles son definitivos. Ã‚Â¡Si jugÃƒÂ¡is off-role no puntuarÃƒÂ©is!');
  }
  
  SpreadsheetApp.getUi().alert("Ã°Å¸â€â€™ ROLES BLOQUEADOS. \nAhora el sistema castigarÃƒÂ¡ a quien no respete su posiciÃƒÂ³n.");
}

// 3. FINALIZAR EVENTO (Limpieza)
function stopTeamBattleEvent() {
   const props = PropertiesService.getScriptProperties();
   props.setProperty('EVENT_TEAM_BATTLE_ACTIVE', 'FALSE');
   props.setProperty('TEAM_BATTLE_PHASE', 'OFF');
   
   SpreadsheetApp.getUi().alert("Ã°Å¸ÂÂ³Ã¯Â¸Â Evento Team Battle finalizado.");
}



/* ==========================================
   Ã°Å¸â€œÂ¡ DATOS PARA LA WEB: TEAM BATTLE (CON CAPITÃƒÂN)
   ========================================== */
function getTeamBattleDataForWeb() {
  const props = PropertiesService.getScriptProperties();
  const active = props.getProperty('EVENT_TEAM_BATTLE_ACTIVE') === 'TRUE';
  const phase = props.getProperty('TEAM_BATTLE_PHASE') || 'OFF';

  if (!active) return { active: false };

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('TEAM_BATTLE');
  if (!sheet) return { active: false };

  const data = sheet.getDataRange().getValues();
  const teams = {};

  // Empezamos en 1 para saltar header
  for (let i = 1; i < data.length; i++) {
    const teamID = data[i][0];
    const player = data[i][1];
    const role = data[i][2];
    const score = Number(data[i][4]) || 0; // Ã°Å¸â€˜Ë† Lo forzamos a ser nÃƒÂºmero

    if (!teams[teamID]) {
      teams[teamID] = { 
        id: teamID, 
        score: 0, // Ã°Å¸â€˜Ë† NUEVO: Creamos el contador total del equipo
        members: [], 
        captain: null, 
        slots: { TOP: null, JUNGLE: null, MIDDLE: null, BOTTOM: null, SUPPORT: null, SUB: null }
      };
    }

    // Ã°Å¸â€˜Ë† NUEVO: Sumamos los puntos del jugador al total del equipo
    teams[teamID].score += score;

    // El primer jugador que encontramos de cada equipo es el CapitÃƒÂ¡n 
    if (teams[teamID].members.length === 0 && teams[teamID].captain === null) {
        teams[teamID].captain = player;
    }

    const isCap = (player === teams[teamID].captain);

    // Si tiene rol asignado
    if (role && role !== "") {
       teams[teamID].slots[role] = { name: player, score: score, isCaptain: isCap };
    } 
    // Si no tiene rol (estÃƒÂ¡ en el banquillo/pending)
    else {
       teams[teamID].members.push({ name: player, isCaptain: isCap });
    }
  }
  const round = props.getProperty('TOURNAMENT_ROUND') || 'DRAFT';
  const matchups = props.getProperty('TOURNAMENT_MATCHUPS');

  return {
    active: true,
    phase: phase, 
    round: round, 
    matchups: matchups, 
    teams: teams
  };
}


/* ==========================================================
   Ã°Å¸â€”Â³Ã¯Â¸Â SISTEMA CENTRALIZADO DE VOTACIONES Y MODALES
   (VersiÃƒÂ³n Definitiva Unificada)
   ========================================================== */

// 1. ABRIR MODAL (Router Central)
function openVotingModalGeneric(mode) {
  const template = HtmlService.createTemplateFromFile('VotingBooth');
  template.mode = mode; // 'TOURNAMENT' o 'FACTION'
  
  let title = 'Ã°Å¸â€”Â³Ã¯Â¸Â Urna Electoral';
  let height = 500;
  
  if (mode === 'TOURNAMENT') {
      title = 'Ã°Å¸â€œÅ“ Contrato de Equipo';
      height = 600;
  }
  
  const html = template.evaluate().setWidth(450).setHeight(height).setTitle(title);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}

// Wrappers para llamadas directas
function openTeamContractModal() { openVotingModalGeneric('TOURNAMENT'); }
function openFactionVoteModal() { openVotingModalGeneric('FACTION'); }
function abrirUrnaVotacion() { openVotingModalGeneric('FACTION'); } // Retrocompatibilidad
function abrirUrnaInventario() { openVotingModalGeneric('INVENTORY'); } // Retrocompatibilidad

function getPlayerList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PLAYERS');
  const data = sheet.getDataRange().getValues();
  let players = [];
  
  // Empezamos en 1 para saltar cabeceras
  for (let i = 1; i < data.length; i++) {
    // Si la columna E (Activo) es "SÃƒÂ­"
    if (data[i][4] === "SÃƒÂ­") {
      let name = data[i][0];
      let rank = data[i][8] || "Unranked"; // Columna I
      
      // Enviamos un objeto en lugar de solo un string
      players.push({
        name: name,
        rank: rank
      });
    }
  }
  return players;
}
/* ==========================================================
   HELPER FUNCTIONS PARA LA WEB (VOTACIONES)
   ========================================================== */

// 1. OBTENER DATOS DE EQUIPO (Para el Modal de Torneo)
function getTeamTeammates(player) {
  const props = PropertiesService.getScriptProperties();
  
  // VerificaciÃƒÂ³n de seguridad: Ã‚Â¿EstÃƒÂ¡ activo el evento?
  if (props.getProperty('EVENT_TEAM_BATTLE_ACTIVE') !== 'TRUE') {
      return { error: "Ã¢â€ºâ€ El torneo estÃƒÂ¡ cerrado o finalizado." };
  }

  const ss = SpreadsheetApp.getActive();
  const battleSheet = ss.getSheetByName('TEAM_BATTLE');
  
  if (!battleSheet) return { error: "Error: Hoja de torneo no encontrada." };
  
  const data = battleSheet.getDataRange().getValues();
  let myTeamID = null;
  const cleanPlayer = String(player).trim().toLowerCase();
  
  // A. Buscar equipo del jugador
  // Empezamos en 1 para saltar la cabecera
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === cleanPlayer) {
      myTeamID = data[i][0]; // Columna A es TeamID
      break;
    }
  }
  
  if (!myTeamID) return { error: "No estÃƒÂ¡s inscrito en ningÃƒÂºn equipo." };

  // B. Buscar compaÃƒÂ±eros de equipo
  const members = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === myTeamID) {
       const memberName = data[i][1];
       // Solo aÃƒÂ±adimos humanos al desplegable (filtramos los bots Ã°Å¸Â¤â€“)
       if (!String(memberName).startsWith('Ã°Å¸Â¤â€“')) {
           members.push(memberName);
       }
    }
  }
  
  // Devolvemos 'teamID' porque asÃƒÂ­ lo espera tu index.html en la secciÃƒÂ³n Tournament
  return { teamID: "EQUIPO " + myTeamID, members: members };
}

// 2. OBTENER DATOS DE FACCIÃƒâ€œN (Para el Modal de FacciÃƒÂ³n)
function getFactionTeammates(player) {
    const props = PropertiesService.getScriptProperties();
    
    // VerificaciÃƒÂ³n de seguridad: Ã‚Â¿EstÃƒÂ¡ activa la guerra?
    if (props.getProperty('EVENT_WAR_ACTIVE') !== 'TRUE') {
        return { error: "Ã¢â€ºâ€ No hay guerra activa en este momento." };
    }

    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('FACTIONS');
    
    if (!sheet) return { error: "Error: Hoja de facciones no encontrada." };
    
    const data = sheet.getDataRange().getValues();
    let myTeam = null;
    const candidates = [];
    const cleanPlayer = String(player).trim().toLowerCase();
    
    // A. Buscar facciÃƒÂ³n del jugador
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === cleanPlayer) {
            myTeam = data[i][1]; // Columna B es el Equipo (HEXTECH/CHEMTECH)
            break;
        }
    }
    
    if (!myTeam) return { error: "No tienes facciÃƒÂ³n asignada." };
    
    // B. Buscar compaÃƒÂ±eros para llenar el desplegable
    for (let i = 1; i < data.length; i++) {
        if (data[i][1] === myTeam) {
            candidates.push(data[i][0]);
        }
    }
    
    // Devolvemos 'team' y 'candidates' porque asÃƒÂ­ lo espera tu index.html en la secciÃƒÂ³n Faction
    return { team: myTeam, candidates: candidates.sort() };
}

// 3. EL PUENTE (WRAPPER) OBLIGATORIO
// Tu cÃƒÂ³digo HTML llama a veces a 'getTeammatesForVoting', asÃƒÂ­ que redirigimos esa llamada
// a la funciÃƒÂ³n de facciones que acabamos de definir arriba.
function getTeammatesForVoting(player) {
    return getFactionTeammates(player);
}

/* ==========================================================
   Ã°Å¸â€â€ž SISTEMA DE CAMBIO TÃƒÂCTICO (CAPITÃƒÂN)
   ========================================================== */
function executeTacticalSwap(captainName, targetRole) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, msg: "El mercado de fichajes estÃƒÂ¡ ocupado." };

  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('TEAM_BATTLE');
    if (!sheet) return { success: false, msg: "No se encuentra la hoja del torneo." };

    const data = sheet.getDataRange().getValues();
    const cleanCap = String(captainName).trim().toLowerCase();
    const targetRoleClean = String(targetRole).toUpperCase().trim();

    // 1. Buscar el equipo del CapitÃƒÂ¡n
    // Asumimos que el primer jugador de cada equipo en la lista (ordenada por puntos) es el capitÃƒÂ¡n virtual
    // O buscamos simplemente en quÃƒÂ© equipo estÃƒÂ¡ el usuario que solicita el cambio.
    let myTeamID = null;
    
    // Mapa de filas: { 'TOP': rowIndex, 'SUB': rowIndex }
    let teamRows = {}; 
    let teamMembers = [];

    // Barrido para encontrar mi equipo
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]).toLowerCase().trim() === cleanCap) {
            myTeamID = data[i][0];
            break;
        }
    }

    if (!myTeamID) return { success: false, msg: "No tienes equipo asignado." };

    // 2. Mapear a los miembros de MI equipo
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === myTeamID) {
            const r = String(data[i][2]).toUpperCase().trim(); // Rol
            const pName = data[i][1];
            
            // Guardamos la fila (i+1) y el nombre
            if (r) teamRows[r] = { row: i + 1, name: pName };
            else teamRows['PENDING'] = { row: i + 1, name: pName }; // Por si acaso
        }
    }

    // 3. Validaciones
    if (!teamRows['SUB']) return { success: false, msg: "Tu equipo no tiene Suplente (SUB) asignado." };
    if (!teamRows[targetRoleClean]) return { success: false, msg: `No hay nadie jugando en ${targetRoleClean} para sustituir.` };

    const mainPlayer = teamRows[targetRoleClean];
    const subPlayer = teamRows['SUB'];

    // 4. EJECUTAR EL CAMBIO (SWAP)
    // El Titular pasa a SUB
    sheet.getRange(mainPlayer.row, 3).setValue('SUB');
    // El Suplente pasa al ROL ELEGIDO
    sheet.getRange(subPlayer.row, 3).setValue(targetRoleClean);

    // 5. Noticia Drama
    if (typeof registerNews === 'function') {
        registerNews('TRANSFER', `Ã°Å¸â€â€ž **CAMBIO TÃƒÂCTICO T${myTeamID}:** El capitÃƒÂ¡n envÃƒÂ­a al banquillo a **${mainPlayer.name}** (${targetRoleClean}). Entra **${subPlayer.name}**.`);
    }

    return { success: true, msg: `Cambio realizado: ${subPlayer.name} ahora es ${targetRoleClean}.` };

  } catch (e) {
    return { success: false, msg: "Error: " + e.message };
  } finally {
    lock.releaseLock();
  }
}


/* ==========================================================
   Ã°Å¸â€Â¨ SETUP FORJA: AÃƒâ€˜ADIR MATERIALES Y RELIQUIAS A LA TIENDA
   ========================================================== */
function SetupForgeItems() {
  const ss = SpreadsheetApp.getActive();
  const shopSheet = ss.getSheetByName('SHOP_ITEMS');
  if (!shopSheet) return;

  const forgeItems = [
    // Tier 1 (Comunes)
    ['SCRAP_METAL', 'Chatarra', 'Material de Forja ComÃƒÂºn (Tier 1)', 0, 'Ã°Å¸â€Â©'],
    ['BENT_NAIL', 'Clavo Torcido', 'Material de Forja ComÃƒÂºn (Tier 1)', 0, 'Ã°Å¸â€œÂ'],
    ['RUSTY_CHAIN', 'Cadena Oxidada', 'Material de Forja ComÃƒÂºn (Tier 1)', 0, 'Ã°Å¸â€â€”'],
    ['OLD_BOOT', 'Bota Vieja', 'Material de Forja ComÃƒÂºn (Tier 1)', 0, 'Ã°Å¸â€˜Â¢'],
    // Tier 2 (Poco Comunes)
    ['BROKEN_RUNE', 'Runa Quebrada', 'Componente Poco ComÃƒÂºn (Tier 2)', 0, 'Ã°Å¸Â§Â¿'],
    ['ARCANE_DUST', 'Polvo Arcano', 'Componente Poco ComÃƒÂºn (Tier 2)', 0, 'Ã¢Å“Â¨'],
    ['CRYSTAL_SHARD', 'Esquirla de Cristal', 'Componente Poco ComÃƒÂºn (Tier 2)', 0, 'Ã°Å¸â€™Å½'],
    // Tier 3 (Raros)
    ['LIQUID_FIRE', 'Fuego LÃƒÂ­quido', 'Esencia Rara (Tier 3)', 0, 'Ã°Å¸â€Â¥'],
    ['TRUE_ICE', 'Hielo Puro', 'Esencia Rara (Tier 3)', 0, 'Ã¢Ââ€žÃ¯Â¸Â'],
    ['VOID_ESSENCE', 'Esencia del VacÃƒÂ­o', 'Esencia Rara (Tier 3)', 0, 'Ã°Å¸Å¸Â£'],
    // Tier 4 (Ãƒâ€°picos)
    ['HEX_CORE', 'NÃƒÂºcleo Hextech', 'Artefacto Ãƒâ€°pico (Tier 4)', 0, 'Ã¢Å¡â„¢Ã¯Â¸Â'],
    ['DRAGON_SCALE', 'Escama de DragÃƒÂ³n', 'Artefacto Ãƒâ€°pico (Tier 4)', 0, 'Ã°Å¸ÂÂ²'],
    // Tier 5 (Legendario)
    ['WORLD_RUNE', 'Runa Global', 'Reliquia Legendaria (Tier 5)', 0, 'Ã°Å¸Å’Â'],
    
    // OBJETOS CRAFTEABLES (Los resultados)
    ['ORNN_ANVIL', 'Yunque de Ornn', 'Otorga +8 Puntos base al total de tu prÃƒÂ³xima partida.', 0, 'Ã°Å¸â€Â¨'],
    ['ZHONYA_HOURGLASS', 'Reloj de Zhonya', 'Inmunidad. Si tu partida es derrota y el total es negativo, lo convierte en 0.', 0, 'Ã¢ÂÂ³'],
    ['ELIXIR_SORCERY', 'Elixir de BrujerÃƒÂ­a', 'Otorga +15 Puntos base y te ingresa +200G en tu cartera inmediatamente.', 0, 'Ã°Å¸Â§Âª'],
    ['INFINITY_PRIME', 'Filo Infinito Primigenio', 'Si ganas la partida (puntos > 0), multiplica tu puntuaciÃƒÂ³n x2.5', 0, 'Ã¢Å¡â€Ã¯Â¸Â'],
    ['GAUNTLET_GOD', 'Guantelete del Dios', 'Si ganas la partida (puntos > 0), multiplica tu puntuaciÃƒÂ³n x3.5', 0, 'Ã°Å¸Â¥Å '],
    ['GOD_CALL', 'Llamada de la Forja', 'Invoca el poder absoluto de Ornn (Objeto Supremo).', 0, 'Ã°Å¸Å’â€¹']
  ];

  const currentIDs = shopSheet.getDataRange().getValues().map(r => r[0]);
  let added = 0;

  forgeItems.forEach(item => {
    if (!currentIDs.includes(item[0])) {
      shopSheet.appendRow(item);
      added++;
    }
  });

  SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Setup completado. Se han aÃƒÂ±adido ${added} objetos de la Forja a la tienda.`);
}

/* ==========================================================
   Ã°Å¸Å’â€¹ MOTOR DE LA FORJA: LECTURA Y CRAFTEO (FRONTEND LINK)
   ========================================================== */

// Diccionario completo de Recetas y Costes (Originales + Nuevas)
const FORGE_RECIPES = {
  // --- Ã°Å¸â€Â¨ RECETAS ORIGINALES ---
  'ORNN_ANVIL': { 
    name: 'Yunque de Ornn', 
    req: { 'SCRAP_METAL': 3, 'BENT_NAIL': 2 }, 
    icon: 'Ã°Å¸â€Â¨',
    desc: 'Garantiza +5 puntos extra en tu prÃƒÂ³xima victoria.' 
  },
  'ZHONYA_HOURGLASS': { 
    name: 'Reloj de Zhonya', 
    req: { 'RUSTY_CHAIN': 1, 'CRYSTAL_SHARD': 2, 'ARCANE_DUST': 2 }, 
    icon: 'Ã¢ÂÂ³',
    desc: 'Te protege de perder puntos en una derrota (puntos = 0).'
  },
  'ELIXIR_SORCERY': { 
    name: 'Elixir de BrujerÃƒÂ­a', 
    req: { 'OLD_BOOT': 1, 'LIQUID_FIRE': 2, 'BROKEN_RUNE': 1 }, 
    icon: 'Ã°Å¸Â§Âª',
    desc: 'AÃƒÂ±ade daÃƒÂ±o verdadero a tus puntos basado en tus asistencias.'
  },
  'INFINITY_PRIME': { 
    name: 'Filo Infinito Primigenio', 
    req: { 'SCRAP_METAL': 1, 'TRUE_ICE': 1, 'HEX_CORE': 1 }, 
    icon: 'Ã¢Å¡â€Ã¯Â¸Â',
    desc: 'Tus crÃƒÂ­ticos de puntos valen el doble en victorias.'
  },
  'GAUNTLET_GOD': { 
    name: 'Guantelete del Dios', 
    req: { 'SCRAP_METAL': 2, 'DRAGON_SCALE': 1, 'VOID_ESSENCE': 1 }, 
    icon: 'Ã°Å¸Â¥Å ',
    desc: 'Roba 2 puntos extra al rival que elijas en un duelo.'
  },
  'GOD_CALL': { 
    name: 'Llamada de la Forja', 
    req: { 'WORLD_RUNE': 1, 'HEX_CORE': 1, 'LIQUID_FIRE': 1 }, 
    icon: 'Ã°Å¸Å’â€¹',
    desc: 'Invoca un evento global que beneficia a tu equipo por 24h.'
  },

  // Ã°Å¸Å’Å’ RUNA MAESTRA (BUFFED TIER 5)
  // Ahora es un "Seguro de Victoria Absoluta"
  'MASTERWORK_RUNE': { 
    name: 'Runa Maestra', 
    req: { 'WORLD_RUNE': 1, 'HEX_CORE': 1, 'ARCANE_DUST': 5 }, 
    icon: 'Ã°Å¸Å’Å’',
    desc: 'Tu prÃƒÂ³xima victoria otorga +15 puntos extra y TRIPLY (3x) el oro. Si pierdes, la Runa NO se consume (permanece activa hasta que ganes).'
  },

  // Ã¢Å¡â€“Ã¯Â¸Â SIFÃƒâ€œN DE DESTINO (ACTUALIZADA: CAOS ALEATORIO)
  'FATE_SIPHON': { 
    name: 'SifÃƒÂ³n de Destino', 
    req: { 'SHIMMER_VIAL': 2, 'HEX_CORE': 1, 'AGONY_ESSENCE': 1 }, 
    icon: 'Ã¢Å¡â€“Ã¯Â¸Â',
    desc: 'Roba puntos a un jugador aleatorio por encima de ti y dÃƒÂ¡selos a uno aleatorio por debajo. Ã‚Â¡Siembra el caos!'
  },

  // --- Ã°Å¸Â§Âª NUEVAS RECETAS DE SHIMMER (CORRUPCIÃƒâ€œN) ---
  'SHIMMER_OVERDOSE': { 
    name: 'Sobredosis de Shimmer', 
    req: { 'SHIMMER_VIAL': 2, 'TAINTED_METAL': 1 }, 
    icon: 'Ã°Å¸â€™â€°',
    desc: 'Riesgo total: Si ganas sumas +20 pts, pero si pierdes restas -25 pts.'
  },
  'ZAUN_PACT': { 
    name: 'Pacto de Zaun', 
    req: { 'AGONY_ESSENCE': 1, 'SHIMMER_VIAL': 1 }, 
    icon: 'Ã¢ËœÂ£Ã¯Â¸Â',
    desc: 'Inmunidad a la Purga por esta noche, pero maÃƒÂ±ana no ganas oro.'
  },
  'LAST_GASP': { 
    name: 'ÃƒÅ¡ltimo Aliento', 
    req: { 'AGONY_ESSENCE': 2, 'TAINTED_METAL': 2 }, 
    icon: 'Ã°Å¸â€™â‚¬',
    desc: 'Si mueres en la Purga, tu objetivo de recompensa pierde -15 pts.'
  }
};


// =======================================================
// Ã°Å¸â€Â¨ OVERRIDE DEFINITIVO DE LA FORJA Y TIENDA
// =======================================================

// 1. OBTENER DATOS PARA LA WEB (Inventario + Recetas) - VERSIÃƒâ€œN CORREGIDA
function getForgeData(player) {
  const ss = SpreadsheetApp.getActive();
  const invSheet = ss.getSheetByName('INVENTORY');
  const shopSheet = ss.getSheetByName('SHOP_ITEMS');
  
  if (!invSheet || !shopSheet) return { inventory: [], recipes: {} };

  // A. Mapa de Iconos y Nombres desde SHOP_ITEMS
  const sData = shopSheet.getDataRange().getValues();
  const itemMap = {};
  for(let i=1; i<sData.length; i++) {
      itemMap[sData[i][0]] = { name: sData[i][1], icon: sData[i][4] }; 
  }

  // B. Contar el inventario del jugador (Solo materiales ACTIVOS)
  const iData = invSheet.getDataRange().getValues();
  const myMats = {};
  
  for(let i=1; i<iData.length; i++) {
      if(String(iData[i][0]).toLowerCase().trim() === String(player).toLowerCase().trim() && iData[i][2] === 'ACTIVE') {
          const itemID = String(iData[i][1]).trim();
          
          // Ã°Å¸â€Â¥ FIX: Aceptamos si estÃƒÂ¡ en la tienda O si es un Plano (BP_)
          if (itemMap[itemID] || itemID.startsWith('BP_')) {
              myMats[itemID] = (myMats[itemID] || 0) + 1;
              
              // Si es un plano y no tiene icono registrado en la tienda, se lo creamos al vuelo
              if (!itemMap[itemID]) {
                  const baseName = itemID.replace('BP_', '').replace(/_/g, ' ');
                  itemMap[itemID] = { name: 'Plano: ' + baseName, icon: 'Ã°Å¸â€œÅ“' };
              }
          }
      }
  }

  const cleanInventory = [];
  for (const itemID in myMats) {
      cleanInventory.push({ 
          id: itemID, 
          name: itemMap[itemID].name, 
          count: myMats[itemID], 
          icon: itemMap[itemID].icon || 'Ã°Å¸â€œÂ¦' 
      });
  }

  return { inventory: cleanInventory, recipes: FORGE_RECIPES, itemsDb: itemMap };
}

// 2. EL YUNQUE (Fabricar Objeto) - VERSIÃƒâ€œN CORREGIDA
function craftOrnnItem(player, recipeID) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { success: false, msg: "El Yunque estÃƒÂ¡ ocupado por otro jugador." };

  try {
      const recipe = FORGE_RECIPES[recipeID];
      if (!recipe) return { success: false, msg: "Esa receta no existe en los pergaminos." };

      const ss = SpreadsheetApp.getActive();
      const invSheet = ss.getSheetByName('INVENTORY');
      const iData = invSheet.getDataRange().getValues();
      
      const cleanPlayer = String(player).toLowerCase().trim();
      const myItemsRows = {}; 
      
      for(let i=1; i<iData.length; i++) {
          if(String(iData[i][0]).toLowerCase().trim() === cleanPlayer && iData[i][2] === 'ACTIVE') {
              const item = String(iData[i][1]).trim();
              if (!myItemsRows[item]) myItemsRows[item] = [];
              myItemsRows[item].push(i + 1);
          }
      }

      // Ã°Å¸â€Â¥ FIX: AÃƒÂ±adimos el Plano a la comprobaciÃƒÂ³n
      const blueprintID = 'BP_' + recipeID;

      // Comprobar el Plano
      if (!myItemsRows[blueprintID] || myItemsRows[blueprintID].length < 1) {
          return { success: false, msg: "Te falta el Plano (Blueprint) para forjar este artefacto." };
      }

      // Comprobar los Materiales
      for (const reqItem in recipe.req) {
          const reqAmount = recipe.req[reqItem];
          const owned = myItemsRows[reqItem] ? myItemsRows[reqItem].length : 0;
          if (owned < reqAmount) {
              return { success: false, msg: `Te faltan materiales. Necesitas ${reqAmount} de ${reqItem}.` };
          }
      }

      // Quemar el Plano
      const bpRowToBurn = myItemsRows[blueprintID].pop();
      invSheet.getRange(bpRowToBurn, 3).setValue('CRAFTED');

      // Quemar los Materiales
      for (const reqItem in recipe.req) {
          const reqAmount = recipe.req[reqItem];
          for (let k=0; k<reqAmount; k++) {
              const rowToBurn = myItemsRows[reqItem].pop(); 
              invSheet.getRange(rowToBurn, 3).setValue('CRAFTED'); 
          }
      }

      // Entregar el Objeto Legendario
      invSheet.appendRow([player, recipeID, 'ACTIVE', new Date()]);

      if (typeof registerNews === 'function') {
          registerNews('FORGE', `Ã°Å¸Å’â€¹ **Ã‚Â¡EL YUNQUE RESUENA!** ${player} acaba de forjar un Artefacto Legendario: **${recipe.icon} ${recipe.name}**.`);
      }

      return { success: true, msg: `Ã‚Â¡Ãƒâ€°XITO! Has forjado: ${recipe.name} ${recipe.icon}` };

  } catch(e) {
      return { success: false, msg: "Error en la Forja: " + e.message };
  } finally {
      lock.releaseLock();
  }
}

// 3. TIENDA LIMPIA (Oculta materiales) - VERSIÃƒâ€œN CORREGIDA
function getShopData(player) {
  const ss = SpreadsheetApp.getActive();
  const shopSheet = ss.getSheetByName('SHOP_ITEMS');
  const invSheet = ss.getSheetByName('INVENTORY');
  
  const catalog = [];
  const itemDictionary = {}; 
  
  if(shopSheet) {
    const data = shopSheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      const id = data[i][0];
      const name = data[i][1];
      const desc = data[i][2];
      const price = Number(data[i][3]);
      const icon = data[i][4];
      
      itemDictionary[id] = { name: name, icon: icon };
      
      // SOLO lo aÃƒÂ±adimos a la tienda si cuesta mÃƒÂ¡s de 0 G
      if (price > 0) {
        catalog.push({ id: id, name: name, desc: desc, price: price, icon: icon });
      }
    }
  }
  
  const myItems = [];
  if(invSheet) {
    const data = invSheet.getDataRange().getValues();
    for(let i=1; i<data.length; i++) {
      if(data[i][0] === player && data[i][2] === 'ACTIVE') {
        const itemDef = itemDictionary[data[i][1]]; 
        myItems.push({
          id: data[i][1],
          name: itemDef ? itemDef.name : data[i][1],
          icon: itemDef ? itemDef.icon : 'Ã°Å¸â€œÂ¦'
        });
      }
    }
  }
  return { catalog: catalog, inventory: myItems };
}

// Guardar el mensaje de ÃƒÅ¡ltima Voluntad
function savePlayerLastWill(player, message) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MARKET_STATUS'); // Usamos esta hoja para centralizar datos
  const data = sheet.getDataRange().getValues();
  
  // Buscamos la columna de LastWill (supongamos que es la J, columna 10)
  // DeberÃƒÂ­as aÃƒÂ±adir una cabecera "LastWill" en tu Excel si no existe.
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === player) {
      sheet.getRange(i + 1, 10).setValue(message); // Ajusta el '10' a tu columna real
      return { success: true, msg: "Testamento sellado. Que Ornn te guarde." };
    }
  }
  return { success: false, msg: "No se encontrÃƒÂ³ al invocador." };
}

// ==========================================================
// Ã°Å¸â€Â¨ MOTOR DE DROPS DE LA FORJA (VERSION BLINDADA)
// ==========================================================
function rollForgeDrop(points, p, teamInfo, notes) {
    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â SHIELD: InicializaciÃƒÂ³n de seguridad para evitar "is not defined"
    const safeP = p || {};
    const safeTeamInfo = teamInfo || {};
    const safeNotes = notes || [];
    const notesStr = safeNotes.join(" ");

    const rollSpecial = Math.random() * 100;
    const d_stats = Number(safeP.deaths || 0);
    const k_stats = Number(safeP.kills || 0);
    const a_stats = Number(safeP.assists || 0);
    const kda = (k_stats + a_stats) / Math.max(1, d_stats);
    const lossStreak = Number(safeP.lossStreak || 0);
    const winStreak = Number(safeP.winStreak || 0);

    // Acceso seguro a teamInfo
    const dragonsCount = Number(safeTeamInfo.dragonsCount || 0);
    const stolen = Number(safeP.challenges?.epicMonstersStolen || 0);
    const towerDmg = Number(safeP.damageDealtToTurrets || 0);
    const mitigated = Number(safeP.damageSelfMitigated || 0);

    // --- FASE 0: DROPS DE SHIMMER ---
    if (d_stats >= 12 && rollSpecial < 40) return 'TAINTED_METAL';
    if (kda < 0.5 && rollSpecial < 25) return 'SHIMMER_VIAL';
    if (lossStreak >= 4 && rollSpecial < 30) return 'AGONY_ESSENCE';

    // --- FASE A: DROPS TEMÃƒÂTICOS ---
    if (d_stats >= 10 && rollSpecial < 15) return 'OLD_BOOT';
    if (stolen > 0 && rollSpecial < 10) return 'VOID_ESSENCE';
    if (dragonsCount >= 4 && rollSpecial < 10) return 'DRAGON_SCALE';
    if (towerDmg >= 8000 && rollSpecial < 10) return 'HEX_CORE';
    if (mitigated >= 40000 && rollSpecial < 10) return 'TRUE_ICE';
    if (notesStr.includes("SVP") && rollSpecial < 10) return 'BROKEN_RUNE';

    // --- FASE B: BENDICIÃƒâ€œN DE ORNN ---
    const roll = Math.random() * 100;
    let tier = 0;
    let luckBonus = winStreak * 5; 

    if (points >= 40 || winStreak >= 3) { 
        const finalLuck = roll + luckBonus;
        if (finalLuck > 95) tier = 5;
        else if (finalLuck > 75) tier = 4;
        else if (finalLuck > 40) tier = 3;
        else tier = 2;
    } 
    else if (points >= 25) { 
        if (roll < 15) tier = roll < 5 ? 4 : (roll < 15 ? 3 : 2); 
    } 
    else if (points >= 15) { 
        if (roll < 10) tier = roll < 2 ? 3 : (roll < 7 ? 2 : 1); 
    } 
    else if (roll < 10) { 
        tier = 1;
    }

    if (tier === 0) return null;

    const pools = {
        1: ['SCRAP_METAL', 'BENT_NAIL', 'RUSTY_CHAIN'],
        2: ['BROKEN_RUNE', 'ARCANE_DUST', 'CRYSTAL_SHARD'],
        3: ['LIQUID_FIRE', 'TRUE_ICE', 'VOID_ESSENCE'],
        4: ['HEX_CORE', 'DRAGON_SCALE'],
        5: ['WORLD_RUNE']
    };

    const selectedPool = pools[tier];
    return selectedPool[Math.floor(Math.random() * selectedPool.length)];
}

function fetchLeaguePressure(puuid, region) {
    try {
        // Ã°Å¸â€ºÂ¡Ã¯Â¸Â FIX 3: Las llamadas a perfil exigen la plataforma (euw1), NO la regiÃƒÂ³n (europe)
        let platform = "euw1";
        if (region === "americas") platform = "na1"; 
        
        // 1. PUUID a Summoner ID
        const sumUrl = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
        const sumData = riotFetchJson(sumUrl);
        if (!sumData || sumData.__error || !sumData.id) return { lp: 50, hotStreak: false };

        // 2. Summoner ID a Ligas
        const leagueUrl = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${sumData.id}`;
        const leagueData = riotFetchJson(leagueUrl);
        
        if (Array.isArray(leagueData)) {
            const soloQ = leagueData.find(q => q.queueType === 'RANKED_SOLO_5x5');
            if (soloQ) return { lp: soloQ.leaguePoints, hotStreak: soloQ.hotStreak };
        }
        return { lp: 50, hotStreak: false };
    } catch(e) { return { lp: 50, hotStreak: false }; }
}
/* ==========================================================
   Ã°Å¸â€œÂ¡ OBTENER ESTADÃƒÂSTICAS AVANZADAS DE UNA PARTIDA
   Ideal para mostrar un modal "Detalles de Partida" en la web
   ========================================================== */
function getAdvancedMatchStats(matchId, playerName) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  
  if (!matchesSheet) return { error: "No se encuentra la hoja de partidas." };
  
  const data = matchesSheet.getDataRange().getValues();
  
  // Buscar la partida (asumiendo MatchID en Col A [0] y Player en Col C [2])
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === matchId && String(data[i][2]).toLowerCase() === String(playerName).toLowerCase()) {
      
      const rawJson = data[i][15]; // Columna P (ÃƒÂ­ndice 15) donde guardamos el JSON
      
      try {
        if (rawJson) {
          return JSON.parse(rawJson); // Devuelve el objeto completo (gpm, dpm, vision, diffs...)
        } else {
          return { error: "Partida antigua. No tiene estadÃƒÂ­sticas avanzadas guardadas." };
        }
      } catch(e) {
        return { error: "Error leyendo las estadÃƒÂ­sticas avanzadas." };
      }
    }
  }
  
  return { error: "Partida no encontrada." };
}


/* ==========================================================
   Ã°Å¸â€œÂ¡ OBTENER PARTIDAS DE UN JUGADOR (Para el Dropdown de la web)
   ========================================================== */
function getPlayerMatchesForDropdown(playerName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MATCHES');
  if(!sheet || sheet.getLastRow() < 2) return [];
  
  const data = sheet.getDataRange().getValues();
  const matches = [];
  
  // Recorremos de abajo a arriba (mÃƒÂ¡s recientes primero)
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][2]).trim().toLowerCase() === String(playerName).trim().toLowerCase()) {
      
      // SOLO mostramos las partidas que ya tienen guardado el JSON en la columna P (ÃƒÂ­ndice 15)
      if (data[i][15] && String(data[i][15]).includes('{')) {
          let dateStr = "Fecha";
          try {
            let d = new Date(data[i][1]);
            dateStr = d.getDate().toString().padStart(2,'0') + "/" + (d.getMonth()+1).toString().padStart(2,'0') + " " + d.getHours().toString().padStart(2,'0') + ":" + d.getMinutes().toString().padStart(2,'0');
          } catch(e) {}
          
          matches.push({
            matchId: data[i][0],
            label: dateStr + " | " + data[i][3] + " (" + data[i][5] + ")"
          });
      }
      
      // Limitamos a las ÃƒÂºltimas 30 partidas vÃƒÂ¡lidas
      if (matches.length >= 30) break;
    }
  }
  return matches;
}

/* ==========================================================
   Ã°Å¸â€œÂ¡ OBTENER ESTADÃƒÂSTICAS AVANZADAS (JSON) PARA EL DASHBOARD
   ========================================================== */
function getAdvancedMatchDetails(matchId, playerName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('MATCHES');
  if (!sheet) return { error: "No se encuentra la hoja de partidas." };
  
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(matchId).trim() && 
        String(data[i][2]).trim().toLowerCase() === String(playerName).trim().toLowerCase()) {
      
      const rawJson = data[i][15]; // Columna P (ÃƒÂ­ndice 15) donde guardas el JSON
      let stats = {};
      
      try {
        if (rawJson) stats = JSON.parse(rawJson);
      } catch(e) { /* Ignorar si no es JSON vÃƒÂ¡lido */ }
          
      return {
        champion: data[i][3],
        role: data[i][4], // <--- Ã°Å¸Å¸Â¢ AÃƒâ€˜ADE ESTA LÃƒÂNEA EXACTAMENTE AQUÃƒÂ
        result: data[i][5],
        kda: data[i][6] + " / " + data[i][7] + " / " + data[i][8],
        points: Number(data[i][12]).toFixed(2),
        stats: stats
      };
    }
  }
  return { error: "Partida no encontrada." };
}


// ====================================================================
// Ã°Å¸Â§Âª FUNCIÃƒâ€œN DE PRUEBA: DOMINIO DE LÃƒÂNEA (VERSIÃƒâ€œN SÃƒâ€œLIDA MIN 10)
// ====================================================================
function testEarlyLaneGap(p, opponent, role) {
    if (!p || !opponent || role === 'JUNGLE') {
        return { finalScore: 0, debugLog: "N/A" };
    }

    let score = 0;
    let logs = [];

    // 1. VENTAJA DE CS AL MINUTO 10 (100% Fiable)
    const myCs10 = Number(p.challenges?.laneMinionsFirst10Minutes || 0);
    const oppCs10 = Number(opponent.challenges?.laneMinionsFirst10Minutes || 0);
    const cs10Diff = myCs10 - oppCs10;

    if (cs10Diff >= 10) {
        let pts = (cs10Diff / 10) * 0.6; // +0.6 pts por cada 10 minions de ventaja al min 10
        score += Math.min(2.5, pts); // Cap de +2.5
        logs.push(`+${cs10Diff.toFixed(0)} CS Lead (@10min)`);
    } else if (cs10Diff <= -10) {
        let pts = (Math.abs(cs10Diff) / 10) * 0.6;
        score -= Math.min(2.5, pts);
        logs.push(`${cs10Diff.toFixed(0)} CS Deficit (@10min)`);
    }

    // 2. VENTAJA MÃƒÂXIMA DE CS EN LÃƒÂNEA (Pico absoluto)
    const myMaxCsLead = Number(p.challenges?.maxCsAdvantageOnLaneOpponent || 0);
    const oppMaxCsLead = Number(opponent.challenges?.maxCsAdvantageOnLaneOpponent || 0);
    
    if (myMaxCsLead > 15) {
        score += Math.min(1.5, myMaxCsLead * 0.04);
        logs.push(`+${myMaxCsLead.toFixed(0)} Max CS Gap`);
    } else if (oppMaxCsLead > 15) {
        score -= Math.min(1.5, oppMaxCsLead * 0.04);
    }

    // 3. VENTAJA MÃƒÂXIMA DE NIVEL EN LÃƒÂNEA
    const myLvlLead = Number(p.challenges?.maxLevelLeadLaneOpponent || 0);
    const oppLvlLead = Number(opponent.challenges?.maxLevelLeadLaneOpponent || 0);
    
    if (myLvlLead >= 1) {
        score += Math.min(1.5, myLvlLead * 0.75);
        logs.push(`+${myLvlLead} Lvl Lead`);
    } else if (oppLvlLead >= 1) {
        score -= Math.min(1.5, oppLvlLead * 0.75);
    }

    // 4. PLACAS DE TORRE 
    const myPlates = Number(p.challenges?.turretPlatesTaken || 0);
    const oppPlates = Number(opponent.challenges?.turretPlatesTaken || 0);
    const plateDiff = myPlates - oppPlates;
    
    if (plateDiff > 1) {
        score += Math.min(1.5, plateDiff * 0.35);
        logs.push(`+${plateDiff} Placas`);
    } else if (plateDiff < -1) {
        score -= Math.min(1.5, Math.abs(plateDiff) * 0.35);
    }

    return {
        finalScore: parseFloat(score.toFixed(2)),
        debugLog: logs.length > 0 ? logs.join(" | ") : "LÃƒÂ­nea Igualada"
    };
}


/* ==========================================================
   Ã°Å¸Ââ€  ACTUALIZAR RESULTADO Y ENLAZAR CON STATS (CORREGIDO)
   ========================================================== */
function updateMatchResult(matchId, scoreA, scoreB, riotId) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
  const infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  const mData = matchesSheet.getDataRange().getValues();
  
  const format = infoSheet.getRange('B2').getValue();
  let updated = false; let winnerId = ''; let loserId = ''; let winnerName = ''; let loserName = '';

  for (let i = 1; i < mData.length; i++) {
    if (mData[i][0] === matchId) {
      const tA = mData[i][3]; const tB = mData[i][4];
      const names = String(mData[i][9]).split(' vs ');
      
      if (scoreA > scoreB) { winnerId = tA; loserId = tB; winnerName = names[0]; loserName = names[1]; }
      else if (scoreB > scoreA) { winnerId = tB; loserId = tA; winnerName = names[1]; loserName = names[0]; }
      else { winnerId = 'DRAW'; loserId = 'DRAW'; }

      matchesSheet.getRange(i + 1, 6).setValue(scoreA);      
      matchesSheet.getRange(i + 1, 7).setValue(scoreB);      
      matchesSheet.getRange(i + 1, 8).setValue(winnerId);      
      matchesSheet.getRange(i + 1, 9).setValue('COMPLETED'); 
      
      // AUTO-PAYOUT: Resolvemos apuestas inmediatamente
      try { payoutLeagueBets(matchId, scoreA, scoreB); } catch(e) {}

      if (riotId && String(riotId).trim() !== "") {
          matchesSheet.getRange(i + 1, 11).setValue(String(riotId).trim());
      }

      updated = true;
      try { announceTournamentResultToDiscord(names[0], names[1], scoreA, scoreB); } catch(e){}
      break;
    }
  }

  if (updated && winnerId !== 'DRAW') {
    recalculateStandings(); 
    
    if (format.includes('elim')) {
        const winTag = `W_${matchId}`; const loseTag = `L_${matchId}`;
        for (let j = 1; j < mData.length; j++) {
            let rowNames = String(mData[j][9]).split(' vs '); let modified = false;
            if (mData[j][3] === winTag) { matchesSheet.getRange(j + 1, 4).setValue(winnerId); matchesSheet.getRange(j + 1, 10).setValue(`${winnerName} vs ${rowNames[1]}`); modified = true; } 
            else if (mData[j][4] === winTag) { matchesSheet.getRange(j + 1, 5).setValue(winnerId); matchesSheet.getRange(j + 1, 10).setValue(`${rowNames[0]} vs ${winnerName}`); modified = true; }
            if (mData[j][3] === loseTag) { matchesSheet.getRange(j + 1, 4).setValue(loserId); matchesSheet.getRange(j + 1, 10).setValue(`${loserName} vs ${rowNames[1]}`); modified = true; } 
            else if (mData[j][4] === loseTag) { matchesSheet.getRange(j + 1, 5).setValue(loserId); matchesSheet.getRange(j + 1, 10).setValue(`${rowNames[0]} vs ${loserName}`); modified = true; }

            if (modified) {
                let newA = matchesSheet.getRange(j + 1, 4).getValue(); let newB = matchesSheet.getRange(j + 1, 5).getValue();
                if (!String(newA).startsWith('W_') && !String(newA).startsWith('L_') && !String(newB).startsWith('W_') && !String(newB).startsWith('L_')) {
                    matchesSheet.getRange(j + 1, 9).setValue('PENDING'); 
                }
            }
        }
    } 
    else if (format === 'swiss') {
        checkAndGenerateSwissRound();
    }
    return { success: true, msg: "Ã‚Â¡Resultado guardado y estadÃƒÂ­sticas enlazadas!" };
  }
  return { success: false, msg: "Error al actualizar." };
}

// Ã°Å¸Â§Â  MOTOR DINÃƒÂMICO SUIZO
function checkAndGenerateSwissRound() {
    const ss = SpreadsheetApp.getActive();
    const mSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
    const tSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
    const mData = mSheet.getDataRange().getValues();
    const tData = tSheet.getDataRange().getValues();

    // 1. Encontrar la ronda actual (la mÃƒÂ¡s alta)
    let currentRoundNum = 1;
    let allCompleted = true;

    for (let i=1; i<mData.length; i++) {
        let rStr = String(mData[i][1]); // Ej: "Ronda 1"
        let rNum = parseInt(rStr.replace('Ronda ', ''));
        if (rNum > currentRoundNum) currentRoundNum = rNum;
    }

    // 2. Verificar si TODOS los partidos de la ronda actual estÃƒÂ¡n acabados
    for (let i=1; i<mData.length; i++) {
        let rStr = String(mData[i][1]);
        let rNum = parseInt(rStr.replace('Ronda ', ''));
        if (rNum === currentRoundNum && mData[i][8] !== 'COMPLETED') {
            allCompleted = false; break;
        }
    }

    if (!allCompleted) return; // AÃƒÂºn quedan partidos en juego

    // 3. Obtener equipos y sus rÃƒÂ©cords (Victorias y Derrotas)
    let activeTeams = [];
    for (let i=1; i<tData.length; i++) {
        let w = Number(tData[i][2]);
        let l = Number(tData[i][3]);
        // Equipos que aÃƒÂºn no se han clasificado (3W) ni eliminado (3L)
        if (w < 3 && l < 3) {
            activeTeams.push({ id: tData[i][0], name: tData[i][1], pool: `${w}-${l}` });
        }
    }

    if (activeTeams.length === 0) return; // Torneo Suizo terminado

    // 4. Agrupar por RÃƒÂ©cord (Pools) y generar nuevos partidos
    let nextMatchId = mData.length; // Si hay 8 partidos, el siguiente es M9
    let pools = {};
    activeTeams.forEach(t => {
        if (!pools[t.pool]) pools[t.pool] = [];
        pools[t.pool].push(t);
    });

    let newMatches = [];
    let nextRoundName = `Ronda ${currentRoundNum + 1}`;

    for (let poolScore in pools) {
        let teamsInPool = pools[poolScore];
        // Barajar aleatoriamente los equipos del mismo pool
        teamsInPool.sort(() => Math.random() - 0.5);
        
        for (let i=0; i < teamsInPool.length; i+=2) {
            if (i+1 < teamsInPool.length) {
                let tA = teamsInPool[i]; let tB = teamsInPool[i+1];
                newMatches.push([
                    `M${nextMatchId}`, nextRoundName, poolScore, tA.id, tB.id, 0, 0, '', 'PENDING', `${tA.name} vs ${tB.name}`
                ]);
                nextMatchId++;
            }
        }
    }

    if (newMatches.length > 0) {
        mSheet.getRange(mSheet.getLastRow() + 1, 1, newMatches.length, 10).setValues(newMatches);
        SpreadsheetApp.flush();
    }
}

function createTournamentBackend(config) {
  const ss = SpreadsheetApp.getActive();

  let infoSheet = ss.getSheetByName('TOURNAMENT_INFO') || ss.insertSheet('TOURNAMENT_INFO');
  let teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS') || ss.insertSheet('TOURNAMENT_TEAMS');
  let matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES') || ss.insertSheet('TOURNAMENT_MATCHES');

  infoSheet.clear(); teamsSheet.clear(); matchesSheet.clear();

  infoSheet.getRange('A1:B1').setValues([['Key', 'Value']]).setFontWeight('bold');
  infoSheet.getRange('A2:B4').setValues([
    ['Format', config.format],
    ['TeamCount', config.teamCount],
    ['Status', 'ACTIVE'] 
  ]);

  teamsSheet.getRange('A1:J1').setValues([['TeamID', 'Name', 'Wins', 'Losses', 'Draws', 'Points', 'Tiebreaker', 'Status', 'Roster', 'Logo']]).setFontWeight('bold');
  
  let teamData = [];
  let teamIds = [];
  config.teams.forEach((t, index) => {
     let id = index + 1;
     teamIds.push({id: id, name: t.name});
     teamData.push([id, t.name, 0, 0, 0, 0, 0, 'ACTIVE', t.roster, t.logo]);
  });
  teamsSheet.getRange(2, 1, teamData.length, 10).setValues(teamData);

  matchesSheet.getRange('A1:J1').setValues([['MatchID', 'Round', 'Bracket', 'TeamA', 'TeamB', 'ScoreA', 'ScoreB', 'Winner', 'Status', 'TeamNames']]).setFontWeight('bold');
  let matchData = [];
  
  let numTeams = teamIds.length;
  
  if (config.format.includes('rr_')) {
      let rounds = numTeams - 1; let half = numTeams / 2; let matchCounter = 1; let tournamentTeams = [...teamIds];
      for (let r = 0; r < rounds; r++) {
          for (let i = 0; i < half; i++) {
              let t1 = tournamentTeams[i]; let t2 = tournamentTeams[numTeams - 1 - i];
              let home = (r % 2 === 0) ? t1 : t2; let away = (r % 2 === 0) ? t2 : t1;
              // Ã°Å¸Å¸Â¢ CAMBIO: Ahora genera "Jornada 1", "Jornada 2", etc.
              matchData.push([`M${matchCounter}`, `Jornada ${r + 1}`, 'Regular', home.id, away.id, 0, 0, '', 'PENDING', `${home.name} vs ${away.name}`]);
              matchCounter++;
          }
          tournamentTeams.splice(1, 0, tournamentTeams.pop());
      }
      if (config.format === 'rr_double') {
          let extraMatches = [];
          matchData.forEach(m => { extraMatches.push([`M${matchCounter}`, `Jornada ${parseInt(m[1].split(' ')[1]) + rounds}`, 'Regular', m[4], m[3], 0, 0, '', 'PENDING', `${m[9].split(' vs ')[1]} vs ${m[9].split(' vs ')[0]}`]); matchCounter++; });
          matchData = matchData.concat(extraMatches);
      }
  } 
  else if (config.format === 'elim_single' && numTeams === 10) {
      let t = teamIds;
      matchData.push(['M1', 'Play-In', 'Upper', t[6].id, t[9].id, 0, 0, '', 'PENDING', `${t[6].name} vs ${t[9].name}`]); 
      matchData.push(['M2', 'Play-In', 'Upper', t[7].id, t[8].id, 0, 0, '', 'PENDING', `${t[7].name} vs ${t[8].name}`]); 
      matchData.push(['M3', 'Cuartos', 'Upper', t[0].id, 'W_M2', 0, 0, '', 'LOCKED', `${t[0].name} vs Ganador M2`]); 
      matchData.push(['M4', 'Cuartos', 'Upper', t[1].id, 'W_M1', 0, 0, '', 'LOCKED', `${t[1].name} vs Ganador M1`]); 
      matchData.push(['M5', 'Cuartos', 'Upper', t[2].id, t[5].id, 0, 0, '', 'PENDING', `${t[2].name} vs ${t[5].name}`]); 
      matchData.push(['M6', 'Cuartos', 'Upper', t[3].id, t[4].id, 0, 0, '', 'PENDING', `${t[3].name} vs ${t[4].name}`]); 
      matchData.push(['M7', 'Semis', 'Upper', 'W_M3', 'W_M6', 0, 0, '', 'LOCKED', `Ganador M3 vs Ganador M6`]);
      matchData.push(['M8', 'Semis', 'Upper', 'W_M4', 'W_M5', 0, 0, '', 'LOCKED', `Ganador M4 vs Ganador M5`]);
      matchData.push(['M9', 'Gran Final', 'Final', 'W_M7', 'W_M8', 0, 0, '', 'LOCKED', `Ganador Semis 1 vs Ganador Semis 2`]);
  }
  else if (config.format === 'elim_single' || config.format === 'elim_double') {
      let matchCounter = 1; let currentRoundIds = [];
      let r1Name = numTeams === 16 ? 'Octavos' : (numTeams === 8 ? 'Cuartos' : 'Semifinales');
      
      for (let i=0; i<numTeams; i+=2) {
          let t1 = teamIds[i]; let t2 = teamIds[i+1];
          matchData.push([`M${matchCounter}`, `Upper ${r1Name}`, 'Upper', t1.id, t2.id, 0, 0, '', 'PENDING', `${t1.name} vs ${t2.name}`]);
          currentRoundIds.push(`M${matchCounter}`); matchCounter++;
      }
      
      if (config.format === 'elim_single') {
          let rNum = 2;
          while (currentRoundIds.length > 1) {
              let nextRoundIds = [];
              let rName = currentRoundIds.length === 2 ? 'Gran Final' : (currentRoundIds.length === 4 ? 'Semifinales' : `Ronda ${rNum}`);
              for (let i=0; i<currentRoundIds.length; i+=2) {
                  let mA = currentRoundIds[i]; let mB = currentRoundIds[i+1];
                  matchData.push([`M${matchCounter}`, rName, 'Upper', `W_${mA}`, `W_${mB}`, 0, 0, '', 'LOCKED', `Ganador ${mA} vs Ganador ${mB}`]);
                  nextRoundIds.push(`M${matchCounter}`); matchCounter++;
              }
              currentRoundIds = nextRoundIds; rNum++;
          }
      } else if (config.format === 'elim_double' && numTeams === 8) {
          matchData.push(['M5', 'Upper Semis', 'Upper', 'W_M1', 'W_M2', 0, 0, '', 'LOCKED', `Ganador M1 vs Ganador M2`]);
          matchData.push(['M6', 'Upper Semis', 'Upper', 'W_M3', 'W_M4', 0, 0, '', 'LOCKED', `Ganador M3 vs Ganador M4`]);
          matchData.push(['M11', 'Upper Final', 'Upper', 'W_M5', 'W_M6', 0, 0, '', 'LOCKED', `Ganador M5 vs Ganador M6`]);
          matchData.push(['M7', 'Lower R1', 'Lower', 'L_M1', 'L_M2', 0, 0, '', 'LOCKED', `Perdedor M1 vs Perdedor M2`]);
          matchData.push(['M8', 'Lower R1', 'Lower', 'L_M3', 'L_M4', 0, 0, '', 'LOCKED', `Perdedor M3 vs Perdedor M4`]);
          matchData.push(['M9', 'Lower R2', 'Lower', 'L_M5', 'W_M8', 0, 0, '', 'LOCKED', `Perdedor M5 vs Ganador M8`]);
          matchData.push(['M10', 'Lower R2', 'Lower', 'L_M6', 'W_M7', 0, 0, '', 'LOCKED', `Perdedor M6 vs Ganador M7`]);
          matchData.push(['M12', 'Lower Semi', 'Lower', 'W_M9', 'W_M10', 0, 0, '', 'LOCKED', `Ganador M9 vs Ganador M10`]);
          matchData.push(['M13', 'Lower Final', 'Lower', 'L_M11', 'W_M12', 0, 0, '', 'LOCKED', `Perdedor M11 vs Ganador M12`]);
          matchData.push(['M14', 'Gran Final', 'Final', 'W_M11', 'W_M13', 0, 0, '', 'LOCKED', `Ganador Upper vs Ganador Lower`]);
      }
  }
  else if (config.format === 'swiss') {
      let numTeams = teamIds.length; let matchCounter = 1;
      for (let i=0; i<numTeams; i+=2) {
          let t1 = teamIds[i]; let t2 = teamIds[i+1];
          // Ã°Å¸Å¸Â¢ CAMBIO: Jornada en Suizo
          matchData.push([`M${matchCounter}`, `Jornada 1`, '0-0', t1.id, t2.id, 0, 0, '', 'PENDING', `${t1.name} vs ${t2.name}`]);
          matchCounter++;
      }
  }

  if (matchData.length > 0) matchesSheet.getRange(2, 1, matchData.length, 10).setValues(matchData);
  SpreadsheetApp.flush();
  return "Ã‚Â¡Torneo configurado con ÃƒÂ©xito!";
}

// ==========================================================
// Ã°Å¸â€â€” CONFIGURACIÃƒâ€œN DE DISCORD (WEBHOOK BLINDADO)
// ==========================================================
function sendDiscordAlert(mensaje) {
    // Ponemos el enlace directamente aquÃƒÂ­ dentro para evitar problemas de variables globales
    const WEBHOOK_URL = "https://discord.com/api/webhooks/1480713889137299570/GoF0yYvBFPd9fZfRfGLa3aT-isTJkmtPNziY6unLVGItfUPSjvj3bkpHEK6P8JQgt7Yo"; 

    if (!WEBHOOK_URL) return;

    try {
        const payload = {
            username: "SoloQ Referee", // Le damos nombre al bot
            avatar_url: "https://i.imgur.com/M0k3y3N.png", // Le damos una imagen
            content: mensaje
        };

        const options = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true // Evita que el script pete si Discord se queja
        };

        const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
        Logger.log("Discord enviado. CÃƒÂ³digo: " + response.getResponseCode());

    } catch (e) { 
        Logger.log("Error crÃƒÂ­tico Discord: " + e.message); 
    }
}

// ==========================================================
// Ã°Å¸â€œÅ  OBTENER DATOS (CON SISTEMA DE NEGOCIACIÃƒâ€œN DE CAPITANES)
// ==========================================================
function getTournamentData() {
  const ss = SpreadsheetApp.getActive();
  const infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  if (!infoSheet || infoSheet.getLastRow() < 2) return { status: 'NONE' };
  const status = infoSheet.getRange('B4').getValue();
  if (status === 'NONE') return { status: 'NONE' };

  const format = infoSheet.getRange('B2').getValue();
  const teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
  const tData = teamsSheet.getDataRange().getValues();
  let teams = [];
  
  for (let i = 1; i < tData.length; i++) {
     let id = tData[i][0]; let name = tData[i][1];
     if (!id || String(name).trim() === "") continue;
     teams.push({
         id: id, name: name, w: tData[i][2], l: tData[i][3], d: tData[i][4], pts: tData[i][5],
         roster: String(tData[i][8] || ""), logo: String(tData[i][9] || ""), streak: 0 
     });
  }

  let betsVolume = {}; 
  const betSheet = ss.getSheetByName("Liga_Bets");
  if (betSheet && betSheet.getLastRow() > 1) {
      let bData = betSheet.getDataRange().getValues();
      for (let i = 1; i < bData.length; i++) {
          let mId = String(bData[i][2]); let teamIdx = parseInt(bData[i][3]); let amount = parseFloat(bData[i][4]) || 0;
          if (!betsVolume[mId]) betsVolume[mId] = { volA: 0, volB: 0 };
          if (teamIdx === 0) betsVolume[mId].volA += amount; else if (teamIdx === 1) betsVolume[mId].volB += amount;
      }
  }

  let votesMap = {};
  const votesSheet = ss.getSheetByName('TOURNAMENT_VOTES');
  if (votesSheet && votesSheet.getLastRow() > 1) {
      let vData = votesSheet.getDataRange().getValues();
      for (let i = 1; i < vData.length; i++) { votesMap[vData[i][0]] = { a: vData[i][1], b: vData[i][2] }; }
  }

  const matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
  const mData = matchesSheet.getDataRange().getValues();
  let matches = [];
  let streaksTracker = {}; 

  for (let i = 1; i < mData.length; i++) {
     let mId = mData[i][0]; let tA = mData[i][3]; let tB = mData[i][4];
     let sA = mData[i][5]; let sB = mData[i][6]; let mStatus = mData[i][8];
     
     if (!mId) continue; 

     let vodUrl = ""; let matchDate = ""; let propDate = ""; let propBy = "";
     try {
         if (mData[i].length > 11 && mData[i][11]) vodUrl = String(mData[i][11]).trim();
         // Col M (12) Fecha final
         if (mData[i].length > 12 && mData[i][12]) matchDate = String(mData[i][12]).trim();
         // Col N (13) Fecha Propuesta y Col O (14) Propuesto Por
         if (mData[i].length > 13 && mData[i][13]) propDate = String(mData[i][13]).trim();
         if (mData[i].length > 14 && mData[i][14]) propBy = String(mData[i][14]).trim();
     } catch(e) {}

     matches.push({
         id: mId, round: mData[i][1], bracket: mData[i][2], tA: tA, tB: tB, 
         sA: sA, sB: sB, winner: mData[i][7], status: mStatus, names: mData[i][9],
         riotId: String(mData[i][10] || ""), vod: vodUrl,      
         date: matchDate, proposedDate: propDate, proposedBy: propBy, // Ã°Å¸â€œâ€¦ AÃƒÂ±adimos la propuesta
         votesA: votesMap[mId] ? Number(votesMap[mId].a) : 0, votesB: votesMap[mId] ? Number(votesMap[mId].b) : 0,
         volA: betsVolume[mId] ? betsVolume[mId].volA : 0, volB: betsVolume[mId] ? betsVolume[mId].volB : 0
     });

     if (mStatus === 'COMPLETED') {
         let currentStreakA = streaksTracker[tA] || 0; let currentStreakB = streaksTracker[tB] || 0;
         if (sA > sB) { streaksTracker[tA] = currentStreakA > 0 ? currentStreakA + 1 : 1; streaksTracker[tB] = currentStreakB < 0 ? currentStreakB - 1 : -1; }
         else if (sB > sA) { streaksTracker[tB] = currentStreakB > 0 ? currentStreakB + 1 : 1; streaksTracker[tA] = currentStreakA < 0 ? currentStreakA - 1 : -1; }
     }
  }

  teams.forEach(t => { t.streak = streaksTracker[t.id] || 0; });
  teams.sort((a, b) => b.pts - a.pts || b.w - a.w);
  teams.forEach((t, idx) => t.pos = idx + 1);

  return { status: status, format: format, teams: teams, matches: matches };
}

// ==========================================================
// Ã°Å¸Â¤Â EL ÃƒÂRBITRO DE LA NEGOCIACIÃƒâ€œN (Vestuario)
// ==========================================================
function handleMatchNegotiation(action, matchId, teamId, pin, dateStr) {
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(10000)) return {success: false, msg: "Servidor ocupado, reintenta."};

  try {
    const ss = SpreadsheetApp.getActive();
    const tSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
    const mSheet = ss.getSheetByName('TOURNAMENT_MATCHES');

    // 1. Verificamos el PIN secreto en la Columna K (10)
    let validPin = false;
    const tData = tSheet.getDataRange().getValues();
    for(let i=1; i<tData.length; i++) {
      if(String(tData[i][0]) === String(teamId)) {
         let teamPin = String(tData[i][10] || "").trim();
         if(teamPin === String(pin).trim()) validPin = true;
         break;
      }
    }
    if(!validPin) return {success: false, msg: "Ã¢ÂÅ’ Acceso Denegado. El PIN de CapitÃƒÂ¡n es incorrecto."};

    // 2. Buscamos el partido
    const mData = mSheet.getDataRange().getValues();
    let matchRow = -1;
    for(let i=1; i<mData.length; i++) {
      if(String(mData[i][0]) === String(matchId)) { matchRow = i + 1; break; }
    }
    if(matchRow === -1) return {success: false, msg: "Partido no encontrado."};

    // Ã°Å¸â€ºÂ¡Ã¯Â¸Â SEGURO: Si el Excel no tiene las columnas N (14) y O (15), las crea para que no de error
    if (mSheet.getMaxColumns() < 15) {
        mSheet.insertColumnsAfter(mSheet.getMaxColumns(), 15 - mSheet.getMaxColumns());
    }

    // 3. Ejecutamos la acciÃƒÂ³n en el Excel
    if(action === 'PROPOSE') {
      mSheet.getRange(matchRow, 14).setValue(dateStr.replace("T", " ")); // N (Propuesta)
      mSheet.getRange(matchRow, 15).setValue(teamId);  // O (Por quiÃƒÂ©n)
      return {success: true, msg: "Ã¢Å“â€¦ Propuesta enviada. El equipo rival debe aceptarla."};
    }
    else if(action === 'ACCEPT') {
      let propDate = mSheet.getRange(matchRow, 14).getValue();
      mSheet.getRange(matchRow, 13).setValue(propDate); // Movemos a M (Fecha Final)
      mSheet.getRange(matchRow, 14).setValue(""); // Limpiamos N
      mSheet.getRange(matchRow, 15).setValue(""); // Limpiamos O
      return {success: true, msg: "Ã°Å¸Â¤Â Ã‚Â¡PACTO SELLADO! El horario ya es oficial en la web."};
    }
    else if(action === 'REJECT') {
      mSheet.getRange(matchRow, 14).setValue("");
      mSheet.getRange(matchRow, 15).setValue("");
      return {success: true, msg: "Ã¢ÂÅ’ Propuesta rechazada. El cuadro vuelve a estar vacÃƒÂ­o."};
    }
  } catch(e) { return {success: false, msg: "Error: " + e.message}; } 
  finally { lock.releaseLock(); }
}


// Ã°Å¸â€Â® FUNCIÃƒâ€œN DE VOTACIÃƒâ€œN BLINDADA (Con LockService y Anti-Fraude)
function castVoteBackend(matchId, teamIndex, voterName) {
    const lock = LockService.getScriptLock();
    // Si 50 personas votan a la vez, esperan en fila hasta 10 segundos
    if (!lock.tryLock(10000)) return { success: false, msg: "El sistema de votos estÃƒÂ¡ muy concurrido. Intenta de nuevo en 5 segundos." };

    try {
        const ss = SpreadsheetApp.getActive();
        const realVoter = voterName ? String(voterName).trim() : "AnÃƒÂ³nimo";

        // 1. COMPROBAR SI YA VOTÃƒâ€œ (Backend check, imposible de burlar)
        let recordsSheet = ss.getSheetByName('PICKEMS_RECORDS');
        if (!recordsSheet) {
            recordsSheet = ss.insertSheet('PICKEMS_RECORDS');
            recordsSheet.getRange('A1:D1').setValues([['Fecha', 'Invocador', 'MatchID', 'Voto_A_Favor_De']]).setFontWeight('bold').setBackground('#f39c12');
        } else {
            const rData = recordsSheet.getDataRange().getValues();
            for (let i = 1; i < rData.length; i++) {
                // Si el MatchID coincide Y el nombre coincide = Ã‚Â¡Fraude!
                if (rData[i][2] === matchId && String(rData[i][1]).toLowerCase() === realVoter.toLowerCase()) {
                    return { success: false, msg: `Ã¢ÂÅ’ ${realVoter}, ya has votado en este partido. No intentes hacer trampas.` };
                }
            }
        }

        // 2. SUMAR EL VOTO AL %
        let votesSheet = ss.getSheetByName('TOURNAMENT_VOTES');
        if (!votesSheet) {
            votesSheet = ss.insertSheet('TOURNAMENT_VOTES');
            votesSheet.getRange('A1:C1').setValues([['MatchID', 'VotesTeamA', 'VotesTeamB']]).setFontWeight('bold');
        }

        let vData = votesSheet.getDataRange().getValues();
        let found = false;

        for (let i = 1; i < vData.length; i++) {
            if (vData[i][0] === matchId) {
                found = true;
                if (teamIndex === 0) votesSheet.getRange(i + 1, 2).setValue(Number(vData[i][1] || 0) + 1);
                else votesSheet.getRange(i + 1, 3).setValue(Number(vData[i][2] || 0) + 1);
                break;
            }
        }

        if (!found) {
            let vA = teamIndex === 0 ? 1 : 0;
            let vB = teamIndex === 1 ? 1 : 0;
            votesSheet.appendRow([matchId, vA, vB]);
        }

        // 3. GUARDAR EL REGISTRO DE QUIÃƒâ€°N VOTÃƒâ€œ
        let teamVoted = teamIndex === 0 ? "Equipo A" : "Equipo B";
        const mSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
        if (mSheet) {
            const mData = mSheet.getDataRange().getValues();
            for (let i=1; i<mData.length; i++) {
                if (mData[i][0] === matchId) {
                    const names = String(mData[i][9]).split(' vs ');
                    teamVoted = teamIndex === 0 ? names[0] : names[1];
                    break;
                }
            }
        }

        recordsSheet.appendRow([new Date(), realVoter, matchId, teamVoted]);
        return { success: true, msg: `Ã¢Å“â€¦ Voto registrado correctamente para ${teamVoted}.` }; 

    } catch(e) {
        return { success: false, msg: "Error de servidor: " + e.message };
    } finally {
        lock.releaseLock(); // Soltamos a la siguiente persona de la fila
    }
}

/* ==========================================================
   Ã°Å¸Ââ€  SISTEMA DE TORNEOS: ARCHIVO HISTÃƒâ€œRICO (SALÃƒâ€œN DE LA FAMA)
   ========================================================== */

function resetTournamentData() {
  const ss = SpreadsheetApp.getActive();
  const infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  const matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
  const teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
  
  // 1. Crear la hoja del Archivo HistÃƒÂ³rico si no existe
  let archiveSheet = ss.getSheetByName('TOURNAMENT_ARCHIVE');
  if (!archiveSheet) {
      archiveSheet = ss.insertSheet('TOURNAMENT_ARCHIVE');
      archiveSheet.getRange('A1:D1').setValues([['Fecha', 'Formato', 'CampeÃƒÂ³n', 'Detalles']]).setFontWeight('bold').setBackground('#f1c40f');
  }

  // 2. Intentar buscar al Ganador antes de borrar los datos
  if (infoSheet && matchesSheet && teamsSheet) {
      try {
          const format = infoSheet.getRange('B2').getValue();
          let winnerName = "Desconocido";
          let details = "Torneo cancelado";

          if (format.includes('rr_') || format === 'swiss') {
              const tData = teamsSheet.getDataRange().getValues();
              let maxPts = -1;
              for (let i = 1; i < tData.length; i++) {
                  if (Number(tData[i][5]) > maxPts) { 
                      maxPts = Number(tData[i][5]); 
                      winnerName = tData[i][1]; 
                  }
              }
              if (maxPts > -1) details = `${maxPts} Puntos en Liga`;
          } 
          else {
              const mData = matchesSheet.getDataRange().getValues();
              for (let i = mData.length - 1; i >= 1; i--) {
                  if (String(mData[i][1]).includes('Final') && !String(mData[i][1]).includes('Semi') && mData[i][8] !== 'PENDING') {
                      const winnerID = mData[i][7];
                      const names = String(mData[i][9]).split(' vs ');
                      winnerName = (winnerID === mData[i][3]) ? names[0] : names[1];
                      details = `Victoria en Final (${mData[i][5]} - ${mData[i][6]})`;
                      break;
                  }
              }
          }

          if (winnerName !== "Desconocido") {
              archiveSheet.appendRow([new Date(), format, winnerName, details]);
          }
      } catch (e) {
          Logger.log("Error guardando histÃƒÂ³rico: " + e.message);
      }
  }

  // 3. Destruir el torneo actual Y LAS URNAS DE VOTOS (NUEVO)
  try { ss.deleteSheet(infoSheet); } catch(e){}
  try { ss.deleteSheet(teamsSheet); } catch(e){}
  try { ss.deleteSheet(matchesSheet); } catch(e){}
  try { ss.deleteSheet(ss.getSheetByName('TOURNAMENT_VOTES')); } catch(e){}
  try { ss.deleteSheet(ss.getSheetByName('PICKEMS_RECORDS')); } catch(e){}
  
  return "Torneo finalizado. El CampeÃƒÂ³n ha sido registrado en el SalÃƒÂ³n de la Fama y las urnas han sido limpiadas.";
}

// Lector del Historial para la Web
function getTournamentArchive() {
  const ss = SpreadsheetApp.getActive();
  const archiveSheet = ss.getSheetByName('TOURNAMENT_ARCHIVE');
  if (!archiveSheet || archiveSheet.getLastRow() < 2) return [];
  
  const data = archiveSheet.getRange(2, 1, archiveSheet.getLastRow()-1, 4).getValues();
  return data.map(r => ({
      date: new Date(r[0]).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }),
      format: r[1],
      winner: r[2],
      details: r[3]
  })).reverse(); // Del mÃƒÂ¡s reciente al mÃƒÂ¡s antiguo
}



// Esta funciÃƒÂ³n lee todos los partidos completados y reconstruye la clasificaciÃƒÂ³n desde 0
function recalculateStandings() {
  const ss = SpreadsheetApp.getActive();
  const teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
  const matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');

  const tData = teamsSheet.getDataRange().getValues();
  const mData = matchesSheet.getDataRange().getValues();

  // 1. Crear un diccionario con todos los equipos a 0
  let stats = {};
  for (let i = 1; i < tData.length; i++) {
    // Guardamos la fila para luego escribir los datos rÃƒÂ¡pido
    stats[tData[i][0]] = { w: 0, l: 0, d: 0, pts: 0, row: i + 1 };
  }

  // 2. Recorrer partidos y sumar victorias/derrotas/puntos (3 pts victoria, 1 pt empate)
  for (let i = 1; i < mData.length; i++) {
    if (mData[i][8] === 'COMPLETED') { // ÃƒÂndice 8 es Status
       const tA = mData[i][3]; // ID Team A
       const tB = mData[i][4]; // ID Team B
       const winner = mData[i][7]; // Winner ID o 'DRAW'

       if (winner === tA) {
         stats[tA].w++; stats[tA].pts += 3;
         stats[tB].l++;
       } else if (winner === tB) {
         stats[tB].w++; stats[tB].pts += 3;
         stats[tA].l++;
       } else if (winner === 'DRAW') {
         stats[tA].d++; stats[tA].pts += 1;
         stats[tB].d++; stats[tB].pts += 1;
       }
    }
  }

  // 3. Volcar los nuevos nÃƒÂºmeros a la hoja TOURNAMENT_TEAMS
  for (let id in stats) {
    let s = stats[id];
    teamsSheet.getRange(s.row, 3).setValue(s.w);   // Wins
    teamsSheet.getRange(s.row, 4).setValue(s.l);   // Losses
    teamsSheet.getRange(s.row, 5).setValue(s.d);   // Draws
    teamsSheet.getRange(s.row, 6).setValue(s.pts); // Points
  }
  
  SpreadsheetApp.flush();
}


/* ==========================================================
   Ã°Å¸â€™Â° SISTEMA DE MERCADO DE FICHAJES (BASADO EN ELO Y RANKING)
   ========================================================== */

function generateTransferMarket() {
  const ss = SpreadsheetApp.getActive();
  
  // 1. Obtener las hojas necesarias
  const playersSheet = ss.getSheetByName('PLAYERS');
  const rankingSheet = ss.getSheetByName('RANKING');
  const matchesSheet = ss.getSheetByName('MATCHES');
  
  if (!playersSheet || !rankingSheet || !matchesSheet) {
    SpreadsheetApp.getUi().alert("Ã¢ÂÅ’ Error: Faltan las hojas PLAYERS, RANKING o MATCHES.");
    return;
  }

  let playersDb = {};

  // 2. Leer ELO exacto desde PLAYERS (Nombre en Col A, Rango en Col I)
  const pData = playersSheet.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    let name = pData[i][0];
    let rank = String(pData[i][8] || "Unranked").trim();
    if (name) {
      playersDb[name] = { name: name, rank: rank, points: 0, roles: {}, baseValue: 5, bonusValue: 0 };
    }
  }

  // 3. Leer Puntos desde RANKING (Nombre en Col A, Puntos en Col B)
  const rData = rankingSheet.getDataRange().getValues();
  for (let i = 1; i < rData.length; i++) {
    let name = rData[i][0];
    let pts = Number(rData[i][1]) || 0;
    if (name && playersDb[name]) {
      playersDb[name].points = pts;
    }
  }

  // 4. Leer Roles desde MATCHES (Nombre en Col C, Rol en Col E)
  const mData = matchesSheet.getDataRange().getValues();
  for (let i = 1; i < mData.length; i++) {
    let name = mData[i][2];
    let role = mData[i][4];
    if (name && role && playersDb[name]) {
      if (!playersDb[name].roles[role]) playersDb[name].roles[role] = 0;
      playersDb[name].roles[role]++;
    }
  }

  const roleNames = { 'TOP': 'Top', 'JUNGLE': 'Jungla', 'MIDDLE': 'Mid', 'BOTTOM': 'ADC', 'UTILITY': 'Support' };

  // 5. ASIGNAR VALOR DE MERCADO
  
  // A) BONUS DEL SOLOQ CHALLENGE (15M al Top 1, bajando 1M por puesto)
  let playersList = Object.values(playersDb).sort((a, b) => b.points - a.points);
  playersList.forEach((p, index) => {
    let position = index + 1;
    // Solo damos bonus a los que tengan puntos positivos, mÃƒÂ¡ximo a los 15 primeros.
    if (p.points > 0 && position <= 15) {
      p.bonusValue = 16 - position; // Top 1 = +15M, Top 2 = +14M, etc.
    }
  });

  // B) CÃƒÂLCULO DE ELO PURO
  let marketData = [];
  playersList.forEach(p => {
    let rUp = p.rank.toUpperCase();
    let base = 5;
    let step = 0; // Valor extra por cada divisiÃƒÂ³n que suba (Ej: Plata 4 vs Plata 1)

    if (rUp.includes("CHALLENGER")) { base = 110; }
    else if (rUp.includes("GRANDMASTER")) { base = 95; }
    else if (rUp.includes("MASTER")) { base = 80; }
    else if (rUp.includes("DIAMOND")) { base = 60; step = 4; } // D4=60, D1=72
    else if (rUp.includes("EMERALD")) { base = 40; step = 4; } // E4=40, E1=52
    else if (rUp.includes("PLATINUM")) { base = 25; step = 3; } // P4=25, P1=34
    else if (rUp.includes("GOLD")) { base = 15; step = 2; }    // G4=15, G1=21
    else if (rUp.includes("SILVER")) { base = 8; step = 1; }   // S4=8, S1=11
    else if (rUp.includes("BRONZE")) { base = 4; step = 1; }   // B4=4, B1=7
    else if (rUp.includes("IRON")) { base = 1; step = 0; }

    let divBonus = 0;
    let matchDiv = rUp.match(/[1-4]/);
    if (matchDiv && step > 0) {
      let div = parseInt(matchDiv[0]);
      divBonus = (4 - div) * step; // (4 - 4)*step = 0. (4 - 1)*step = 3*step.
    }

    let finalValue = base + divBonus + p.bonusValue;
    if (finalValue < 1) finalValue = 1;

    // Determinar Roles
    let topRoles = ["ComodÃƒÂ­n", "-"];
    let sortedRoles = Object.keys(p.roles).sort((a, b) => p.roles[b] - p.roles[a]);
    if (sortedRoles.length > 0) topRoles[0] = roleNames[sortedRoles[0]] || sortedRoles[0];
    if (sortedRoles.length > 1) topRoles[1] = roleNames[sortedRoles[1]] || sortedRoles[1];

    let bonusTag = p.bonusValue > 0 ? ` (+${p.bonusValue}M Forma)` : "";

    marketData.push([
      p.name, 
      p.rank, 
      Math.round(p.points) + bonusTag, 
      topRoles[0], 
      topRoles[1], 
      finalValue
    ]);
  });

  // Ordenar por Valor de Mercado final (Los mÃƒÂ¡s caros arriba)
  marketData.sort((a, b) => b[5] - a[5]);

  // 6. CALCULAR PRESUPUESTO EQUILIBRADO PARA EL DRAFT
  let topSum = 0;
  let countToAverage = Math.min(marketData.length, 40); // Media de los mejores jugadores
  for(let i = 0; i < countToAverage; i++) {
      topSum += marketData[i][5];
  }
  let avgPlayerValue = topSum / countToAverage;
  let recommendedBudget = Math.round(avgPlayerValue * 5); // 5 jugadores por equipo

  // 7. CONSTRUIR LA INTERFAZ EN EL EXCEL
  let marketSheet = ss.getSheetByName('TRANSFER_MARKET');
  if (!marketSheet) {
    marketSheet = ss.insertSheet('TRANSFER_MARKET');
  } else {
    marketSheet.clear();
  }

  // Estilos de la Cabecera
  marketSheet.getRange('A1:F1').merge().setValue('Ã°Å¸â€œÅ  MERCADO DE FICHAJES: WARGODS PREMIER').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#0f172a').setFontColor('#fbbf24');
  marketSheet.getRange('A2:B2').setValues([['Ã°Å¸â€™Â° LÃƒÂMITE SALARIAL POR EQUIPO:', `${recommendedBudget} Millones`]]).setFontWeight('bold').setBackground('#1e293b').setFontColor('#10b981').setFontSize(12);
  
  marketSheet.getRange('A3:F3').merge().setValue(`Regla del Draft: La suma del Valor de Mercado de los 5 titulares de un equipo no puede superar los ${recommendedBudget} Millones.`).setFontStyle('italic').setFontColor('#64748b');

  // Cabeceras de la Tabla
  marketSheet.getRange('A5:F5').setValues([['JUGADOR', 'ELO (RANK)', 'PUNTOS SOLOQ (BONUS)', 'LÃƒÂNEA PRINCIPAL', 'LÃƒÂNEA SECUNDARIA', 'VALOR DE MERCADO']])
    .setFontWeight('bold')
    .setBackground('#334155')
    .setFontColor('white')
    .setHorizontalAlignment('center');

  // Volcar los datos
  if (marketData.length > 0) {
    marketSheet.getRange(6, 1, marketData.length, 6).setValues(marketData).setHorizontalAlignment('center');
  }

  // Dar formato dorado a la columna de precio
  marketSheet.getRange(6, 6, marketData.length, 1).setFontWeight('bold').setFontColor('#d97706'); // Naranja/Dorado
  
  // Formato Visual (Bordes y Anchos)
  marketSheet.setColumnWidth(1, 200);
  marketSheet.setColumnWidth(2, 130);
  marketSheet.setColumnWidth(3, 200);
  marketSheet.setColumnWidth(4, 150);
  marketSheet.setColumnWidth(5, 150);
  marketSheet.setColumnWidth(6, 170);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`Ã¢Å“â€¦ Ã‚Â¡Mercado Generado!\n\nEl lÃƒÂ­mite salarial recomendado para equilibrar a los capitanes es de ${recommendedBudget} Millones por equipo.\n\nRevisa la pestaÃƒÂ±a TRANSFER_MARKET.`);
}


/* ==========================================================
   Ã°Å¸â€Â® ANUNCIAR QUINIELAS A DISCORD (PICK'EMS)
   ========================================================== */
function announcePickemsToDiscord() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
  if (!matchesSheet) return SpreadsheetApp.getUi().alert("No hay torneo activo.");

  const data = matchesSheet.getDataRange().getValues();
  let pendingMatches = [];

  // Buscar partidos pendientes
  for (let i = 1; i < data.length; i++) {
    if (data[i][8] === 'PENDING') {
      const names = String(data[i][9]).split(' vs ');
      pendingMatches.push(`Ã°Å¸â€Â¸ **${names[0]}** Ã°Å¸â€ Å¡  **${names[1]}**`);
    }
  }

  if (pendingMatches.length === 0) {
    return SpreadsheetApp.getUi().alert("No hay partidos pendientes para anunciar.");
  }

  // Ã°Å¸â€˜â€¡ PON TU WEBHOOK AQUÃƒÂ Ã°Å¸â€˜â€¡
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1441052410402570360/FRdkGyD-gdtgadnofato00bxOizHgXf7KV6Yjulu3mnKRAtT3owNaBlEJS7J8QIjFQo1"; 
  const webUrl = ScriptApp.getService().getUrl() + "?p=tournaments";

  const payload = {
    content: " Ã°Å¸â€Â® **Ã‚Â¡LAS QUINIELAS ESTÃƒÂN ABIERTAS!**",
    embeds: [{
      title: "Ã°Å¸Ââ€  PICK'EMS: PRÃƒâ€œXIMOS PARTIDOS",
      description: "Entra a la web oficial, analiza las estadÃƒÂ­sticas (Scouting) y vota por los ganadores.\n\n" + 
                   pendingMatches.join("\n\n") + 
                   "\n\nÃ°Å¸â€˜â€° **[HAZ CLIC AQUÃƒÂ PARA VOTAR EN LA WEB](" + webUrl + ")**",
      color: 16766720,
      image: { url: "https://images.contentstack.io/api/v1/assets/5931bc10-d8d5-4dc2-a720-032a84352a16/e4df94cc-19d1-41d8-a1fb-3b4ee3f7e5d8/Summoners_Rift_1.jpg" }
    }]
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Quinielas anunciadas en Discord con ÃƒÂ©xito.");
  } catch(e) {
    SpreadsheetApp.getUi().alert("Error enviando a Discord: " + e.message);
  }
}


/* ==========================================================
   Ã°Å¸Å½â„¢Ã¯Â¸Â ANUNCIAR RESULTADOS DEL TORNEO A DISCORD
   ========================================================== */
function announceTournamentResultToDiscord(teamA, teamB, scoreA, scoreB) {
  // Ã°Å¸â€˜â€¡ PEGA TU WEBHOOK DE DISCORD AQUÃƒÂ Ã°Å¸â€˜â€¡
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1441052410402570360/FRdkGyD-gdtgadnofato00bxOizHgXf7KV6Yjulu3mnKRAtT3owNaBlEJS7J8QIjFQo1"; 

  if (!WEBHOOK_URL || WEBHOOK_URL.includes("TU_ENLACE_AQUI")) return;

  let winner = "";
  let loser = "";
  let displayScore = "";
  let color = 16766720; // Dorado por defecto

  if (scoreA > scoreB) {
      winner = teamA;
      loser = teamB;
      displayScore = `${scoreA} - ${scoreB}`;
      color = 3066993; // Azul victoria
  } else if (scoreB > scoreA) {
      winner = teamB;
      loser = teamA;
      displayScore = `${scoreB} - ${scoreA}`;
      color = 15548997; // Rojo victoria
  } else {
      // Empate
      const payloadDraw = {
        content: "Ã¢Å¡â€“Ã¯Â¸Â **Ã‚Â¡RESULTADO DEL TORNEO!**",
        embeds: [{
          title: `Empate tÃƒÂ©cnico entre ${teamA} y ${teamB}`,
          description: `El partido ha finalizado en tablas con un **${scoreA} - ${scoreB}**. Ã‚Â¡Reparto de puntos para ambos!`,
          color: 9807270
        }]
      };
      UrlFetchApp.fetch(WEBHOOK_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payloadDraw) });
      return;
  }

  const payload = {
    content: "Ã°Å¸Ââ€  **Ã‚Â¡NUEVO RESULTADO OFICIAL DE LA LIGA!**",
    embeds: [{
      title: `Ã°Å¸â€Â¥ ${winner} aplasta a ${loser} Ã°Å¸â€Â¥`,
      description: `El enfrentamiento ha terminado con un contundente **${displayScore}** a favor de **${winner}**.\n\nÃ°Å¸â€™Â¸ *Revisando las quinielas (Pick'ems)... los que apostaron por ${loser} acaban de perder su oro.*`,
      color: color,
      image: { url: "https://images.contentstack.io/api/v1/assets/5931bc10-d8d5-4dc2-a720-032a84352a16/e4df94cc-19d1-41d8-a1fb-3b4ee3f7e5d8/Summoners_Rift_1.jpg" },
      footer: { text: "Wargods Premier Ã¢â‚¬Â¢ Resultados Oficiales" }
    }]
  };

  try {
    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch(e) {
    Logger.log("Error mandando resultado a Discord: " + e.message);
  }
}

/* ==========================================================
   Ã°Å¸â€œÅ  OBTENER POST-GAME LOBBY (CON TANK, MVP, TIMELINE Y EVENTOS)
   ========================================================== */
function getPostGameLobbyData(matchId) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const mvpSheet = ss.getSheetByName('TOURNAMENT_MVP_VOTES');
  
  if (!matchesSheet) return { error: "Hoja MATCHES no encontrada" };

  let currentMatchVotes = {};
  let officialMvp = null;
  let officialAce = null;
  let isResolved = false;

  // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO: Variables para guardar los datos globales del partido
  let matchWinStats = null;
  let matchLosStats = null;
  let matchTimeline = null;
  let matchEvents = null; // <--- VITAL para el Timeline de Objetivos (OP.GG)

  if (mvpSheet && mvpSheet.getLastRow() > 1) {
      const vData = mvpSheet.getDataRange().getValues();
      for (let i = 1; i < vData.length; i++) {
          if (vData[i][2] === matchId) {
              if (vData[i][1] === 'SYSTEM_RESOLVED') {
                  isResolved = true;
                  if (vData[i][4] === 'MVP') officialMvp = String(vData[i][3]).trim();
                  if (vData[i][4] === 'ACE') officialAce = String(vData[i][3]).trim();
              } else {
                  const voted = String(vData[i][3]).trim();
                  currentMatchVotes[voted] = (currentMatchVotes[voted] || 0) + 1;
              }
          }
      }
  }

  const data = matchesSheet.getDataRange().getValues();
  let winners = [];
  let losers = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(matchId).trim()) {
      const pName = String(data[i][2]).trim();
      
      let cs = "0.0";
      let csTotal = 0;
      let cs15 = 0;      // Ã°Å¸Å¸Â¢ NUEVO
      let plates = 0;    // Ã°Å¸Å¸Â¢ NUEVO
      let gpm = "0";
      let gold = 0;
      let tank = "-";
      let vspm = "0.00";
      let visionScore = 0;

      let items = [];
      let spells = [];

      let dmgObj = 0;      // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO
      let dmgTurrets = 0;  // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO

      const rawJson = data[i][15]; 
      if (rawJson) {
          try {
              let adv = JSON.parse(rawJson);
              
              if (adv.csMin) cs = Number(adv.csMin).toFixed(1);
              if (adv.cs) csTotal = Number(adv.cs);
              
              if (adv.cs15 !== undefined) cs15 = Number(adv.cs15);    
              if (adv.plates !== undefined) plates = Number(adv.plates); 
              
              if (adv.gpm) gpm = Number(adv.gpm).toFixed(0);
              if (adv.gold) gold = Number(adv.gold);
              if (adv.vspm) vspm = Number(adv.vspm).toFixed(2);
              if (adv.visionScore) visionScore = Number(adv.visionScore);
              
              if (adv.dmgTakenPct) tank = Number(adv.dmgTakenPct).toFixed(0) + "%";
              if (adv.dmgTaken) tank = (Number(adv.dmgTaken) / 1000).toFixed(1) + "k";

              if (adv.items) items = adv.items;
              if (adv.spells) spells = adv.spells;
              
              if (adv.dmgObj) dmgObj = Number(adv.dmgObj);         // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO
              if (adv.dmgTurrets) dmgTurrets = Number(adv.dmgTurrets); // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO
              
              if (adv.goldTimeline && matchTimeline === null) {
                  matchTimeline = adv.goldTimeline;
                  matchWinStats = adv.winStats;
                  matchLosStats = adv.losStats;
              }
              if (adv.eventsList && matchEvents === null) {
                  matchEvents = adv.eventsList;
              } else if (adv.events && matchEvents === null) { 
                  matchEvents = adv.events;
              }
          } catch(e) {}
      }

      let pData = {
        name: pName,
        champ: data[i][3],
        role: data[i][4],
        k: Number(data[i][6] || 0),
        d: Number(data[i][7] || 0),
        a: Number(data[i][8] || 0),
        dmg: Number(data[i][9] || 0),
        kp: Number(data[i][10] || 0),
        points: Number(data[i][12] || 0).toFixed(1),
        votes: currentMatchVotes[pName] || 0,
        cs: cs,
        csTotal: csTotal,
        cs15: cs15,       // Ã°Å¸Å¸Â¢ NUEVO
        plates: plates,   // Ã°Å¸Å¸Â¢ NUEVO
        gpm: gpm,
        gold: gold,
        tank: tank,
        vspm: vspm,
        visionScore: visionScore,
        items: items,   // Ã°Å¸Å¸Â¢ NUEVO
        spells: spells,  // Ã°Å¸Å¸Â¢ NUEVO
        dmgObj: dmgObj,        // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO
        dmgTurrets: dmgTurrets // Ã°Å¸Å¸Â¢ AÃƒâ€˜ADIDO
      };

      if (data[i][5] === 'Win') winners.push(pData);
      else losers.push(pData);
    }
  }

  const roleOrder = { "TOP": 1, "JUNGLE": 2, "MIDDLE": 3, "BOTTOM": 4, "SUPPORT": 5, "UTILITY": 5 };
  const sortRoles = (a, b) => (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9);
  
  winners.sort(sortRoles); losers.sort(sortRoles);

  return { 
      winners: winners, 
      losers: losers, 
      officialMvp: officialMvp, 
      officialAce: officialAce, 
      isResolved: isResolved,
      winStats: matchWinStats, 
      losStats: matchLosStats, 
      timeline: matchTimeline,  
      events: matchEvents // Ã°Å¸Å¸Â¢ Ã‚Â¡ESTO ES LO QUE LE FALTABA A LA WEB PARA PINTAR EL TIMELINE DE OBJETIVOS!
  };
}


function resolveMatchAwardsBackend(matchId) {
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(10000)) return {success: false, msg: "Servidor ocupado, reintenta."};
    
    try {
        const ss = SpreadsheetApp.getActive();
        const mvpSheet = ss.getSheetByName('TOURNAMENT_MVP_VOTES');
        if(!mvpSheet) return {success: false, msg: "No hay votos para resolver."};
        
        const data = mvpSheet.getDataRange().getValues();

        // 1. RECUENTO DE VOTOS DE MVP Y ACE
        let mvpCounts = {};
        let aceCounts = {};
        let isAlreadyResolved = false;

        for(let i = 1; i < data.length; i++) {
            if(data[i][2] === matchId) {
                if(data[i][1] === 'SYSTEM_RESOLVED') isAlreadyResolved = true;
                
                let player = data[i][3];
                let type = data[i][4] || 'MVP';
                if (type === 'MVP') mvpCounts[player] = (mvpCounts[player] || 0) + 1;
                if (type === 'ACE') aceCounts[player] = (aceCounts[player] || 0) + 1;
            }
        }

        if (isAlreadyResolved) {
            return {success: false, msg: "El acta de este partido ya estaba cerrada."};
        }

        let finalMvp = null; let maxMvp = 0;
        for(let p in mvpCounts) { if(mvpCounts[p] > maxMvp) { maxMvp = mvpCounts[p]; finalMvp = p; } }

        let finalAce = null; let maxAce = 0;
        for(let p in aceCounts) { if(aceCounts[p] > maxAce) { maxAce = aceCounts[p]; finalAce = p; } }

        // 2. REGISTRAR LOS PREMIOS INDIVIDUALES
        if(finalMvp) mvpSheet.appendRow([new Date(), 'SYSTEM_RESOLVED', matchId, finalMvp, 'MVP']);
        if(finalAce) mvpSheet.appendRow([new Date(), 'SYSTEM_RESOLVED', matchId, finalAce, 'ACE']);


        // 3. Ã°Å¸Å½Â° LÃƒâ€œGICA DEL CASINO: ENCONTRAR AL GANADOR DEL PARTIDO PARA PAGAR LAS APUESTAS
        try {
            var matchSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
            if (matchSheet) {
                var mData = matchSheet.getDataRange().getValues();
                var sA = 0; var sB = 0;
                var winnerIdx = -1;
                
                // Buscamos el partido en la base de datos
                for (var m = 1; m < mData.length; m++) {
                    if (String(mData[m][0]) === String(matchId)) {
                        // Las columnas F (ÃƒÂ­ndice 5) y G (ÃƒÂ­ndice 6) suelen ser los Scores A y B en tu formato
                        sA = parseInt(mData[m][5]) || 0;
                        sB = parseInt(mData[m][6]) || 0;
                        break;
                    }
                }
                
                // Determinamos quiÃƒÂ©n ganÃƒÂ³ (0 = Equipo A, 1 = Equipo B)
                if (sA > sB) winnerIdx = 0;
                else if (sB > sA) winnerIdx = 1;
                
                // Si hay un ganador claro, ejecutamos los pagos del Casino
                if (winnerIdx !== -1) {
                    payoutLeagueBets(matchId, winnerIdx);
                }
            }
        } catch(e) {
            Logger.log("Error procesando pagos del Casino: " + e.toString());
        }

        // 4. FINALIZAR Y ENVIAR MENSAJE
        SpreadsheetApp.flush();
        
        let msg = "Ã‚Â¡Acta Cerrada Oficialmente!\n\n";
        msg += "Ã¢Â­Â MVP: " + (finalMvp || 'Nadie') + "\n";
        msg += "Ã°Å¸â€ºÂ¡Ã¯Â¸Â ACE: " + (finalAce || 'Nadie') + "\n";
        msg += "Ã°Å¸â€™Â° Apuestas del Casino resueltas y pagadas.";
        
        return {success: true, msg: msg};
        
    } catch(e) {
        return {success: false, msg: "Error al cerrar acta: " + e.message};
    } finally {
        lock.releaseLock();
    }
}

/* ==========================================================
   Ã°Å¸â€”Â³Ã¯Â¸Â VOTACIÃƒâ€œN DE MVP Y ACE (PERMITE 1 DE CADA POR PARTIDO)
   ========================================================== */
function castMvpVoteBackend(matchId, playerName, voterName, voteType) {
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        const ss = SpreadsheetApp.getActive();
        let sheet = ss.getSheetByName('TOURNAMENT_MVP_VOTES');
        
        // Si no existe la hoja, la creamos con las cabeceras correctas (incluyendo 'Type')
        if (!sheet) {
            sheet = ss.insertSheet('TOURNAMENT_MVP_VOTES');
            sheet.appendRow(['Timestamp', 'Voter', 'MatchId', 'Player', 'Type']);
        }
        
        const data = sheet.getDataRange().getValues();
        
        // 1. Comprobar si el partido ya ha sido cerrado oficialmente por el Admin
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][2]) === String(matchId) && String(data[i][1]) === 'SYSTEM_RESOLVED') {
                return { success: false, msg: "Ã¢ÂÅ’ Las votaciones para este partido ya estÃƒÂ¡n cerradas (Acta Oficial generada)." };
            }
        }
        
        // 2. Comprobar si el usuario ya ha votado para ESTE ROL (MVP o ACE) en ESTE PARTIDO
        for (let i = 1; i < data.length; i++) {
            const rowVoter = String(data[i][1]).trim();
            const rowMatch = String(data[i][2]).trim();
            const rowType = String(data[i][4] || "MVP").trim().toUpperCase(); // Si es antiguo, asumimos que era MVP
            
            if (rowVoter === voterName && rowMatch === matchId && rowType === voteType.toUpperCase()) {
                return { 
                    success: false, 
                    msg: "Ã¢ÂÅ’ " + voterName + ", ya has emitido tu voto para el " + voteType + " de este partido." 
                };
            }
        }
        
        // 3. Registrar el voto con el Tipo (MVP o ACE)
        sheet.appendRow([new Date(), voterName, matchId, playerName, voteType.toUpperCase()]);
        
        return { 
            success: true, 
            msg: "Ã¢Å“â€¦ Voto para " + voteType + " registrado a favor de " + playerName + "!" 
        };
        
    } catch (e) {
        return { success: false, msg: "Error del servidor: " + e.toString() };
    } finally {
        lock.releaseLock();
    }
}


/* ==========================================================
   Ã°Å¸â€¢ÂµÃ¯Â¸Â SCOUTING PRE-PARTIDO (ACTUALIZADO PARA HEAD 2 HEAD)
   ========================================================== */
function getMatchScoutingData(matchId) {
    const ss = SpreadsheetApp.getActive();
    const tMatchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
    const tTeamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
    const matchesSheet = ss.getSheetByName('MATCHES');

    if (!tMatchesSheet || !tTeamsSheet || !matchesSheet) return { error: "Faltan datos." };

    let tA_id, tB_id;
    const tmData = tMatchesSheet.getDataRange().getValues();
    for (let i = 1; i < tmData.length; i++) {
        if (tmData[i][0] === matchId) {
            tA_id = tmData[i][3]; tB_id = tmData[i][4]; break;
        }
    }

    if (!tA_id || !tB_id) return { error: "Partido no encontrado." };

    const tData = tTeamsSheet.getDataRange().getValues();
    let teamA = { name: "", roster: [] };
    let teamB = { name: "", roster: [] };

    for (let i = 1; i < tData.length; i++) {
        if (tData[i][0] == tA_id) { teamA.name = tData[i][1]; teamA.roster = String(tData[i][8]).split(',').map(s=>s.trim()).filter(Boolean); }
        if (tData[i][0] == tB_id) { teamB.name = tData[i][1]; teamB.roster = String(tData[i][8]).split(',').map(s=>s.trim()).filter(Boolean); }
    }

    const allMatches = matchesSheet.getDataRange().getValues();
    
    function getPlayerScouting(playerName) {
        const nameLow = playerName.toLowerCase();
        let roles = {}; let champs = {};
        let games = 0, wins = 0, totalDmg = 0, totalDur = 0, k=0, d=0, a=0;
        
        for (let i = 1; i < allMatches.length; i++) {
            if (String(allMatches[i][2]).trim().toLowerCase() === nameLow) {
                games++;
                let r = String(allMatches[i][4]).toUpperCase();
                let c = String(allMatches[i][3]);
                if(r === 'UTILITY') r = 'SUPPORT'; if(r === 'BOT') r = 'BOTTOM'; if(r === 'MID') r = 'MIDDLE';
                roles[r] = (roles[r] || 0) + 1;
                champs[c] = (champs[c] || 0) + 1;
                
                if (allMatches[i][5] === 'Win') wins++;
                k += Number(allMatches[i][6]||0); d += Number(allMatches[i][7]||0); a += Number(allMatches[i][8]||0);
                totalDmg += Number(allMatches[i][9]||0); totalDur += Number(allMatches[i][11]||1);
            }
        }

        let mainRole = "FILL"; let maxRole = 0;
        for(let r in roles) { if(roles[r] > maxRole) { maxRole = roles[r]; mainRole = r; } }
        let topChamps = Object.keys(champs).sort((a,b) => champs[b] - champs[a]).slice(0, 3);
        
        const wr = games > 0 ? Math.round((wins/games)*100) : 0;
        const dpm = totalDur > 0 ? Math.round(totalDmg/totalDur) : 0;
        const kda = d > 0 ? ((k+a)/d).toFixed(2) : (k+a).toFixed(2);

        return { name: playerName, mainRole: mainRole, topChamps: topChamps, wr: wr, dpm: dpm, kda: kda };
    }

    return {
        teamA: { name: teamA.name, players: teamA.roster.map(getPlayerScouting) },
        teamB: { name: teamB.name, players: teamB.roster.map(getPlayerScouting) }
    };
}

/* ==========================================================
   Ã°Å¸â€œÅ  ESTADÃƒÂSTICAS AVANZADAS (PARA EL SALÃƒâ€œN DE LA FAMA Y FANTASY)
   ========================================================== */
function getTournamentStatsForWeb(roundFilter) {
  roundFilter = roundFilter || 'ALL';
  const ss = SpreadsheetApp.getActive();
  const teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
  const matchesSheet = ss.getSheetByName('MATCHES');
  const tMatchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');

  if (!teamsSheet || !matchesSheet || !tMatchesSheet) return { stats: [], rounds: [] };

  const normalizeName = (n) => String(n).replace(/[\s\xA0]/g, '').toLowerCase();

  const tData = teamsSheet.getDataRange().getValues();
  const playerTeamMap = {}; 
  for (let i = 1; i < tData.length; i++) {
      const teamName = String(tData[i][1]).trim();
      const rosterStr = String(tData[i][8] || ""); 
      if (rosterStr) {
          rosterStr.split(',').forEach(p => {
              if(p.trim()) playerTeamMap[normalizeName(p)] = teamName;
          });
      }
  }

  const tmData = tMatchesSheet.getDataRange().getValues();
  const validMatchIds = new Set();
  const availableRounds = new Set();
  
  for (let i = 1; i < tmData.length; i++) {
      const rId = String(tmData[i][10] || "").trim(); 
      const round = String(tmData[i][1] || "").trim();
      if (round && round !== 'Round' && round !== 'Ronda') availableRounds.add(round);
      if (rId && (roundFilter === 'ALL' || round === roundFilter)) validMatchIds.add(rId);
  }

  const playerVotes = {};
  const mvpSheet = ss.getSheetByName('TOURNAMENT_MVP_VOTES');
  if (mvpSheet && mvpSheet.getLastRow() > 1) {
      const vData = mvpSheet.getDataRange().getValues();
      for (let i = 1; i < vData.length; i++) {
          if (String(vData[i][1]) !== 'SYSTEM_RESOLVED') continue;
          if (!validMatchIds.has(String(vData[i][2]).trim()) && roundFilter !== 'ALL') continue;

          let pNameLow = normalizeName(vData[i][3]);
          let vType = String(vData[i][4] || "MVP").toUpperCase(); 
          if (!playerVotes[pNameLow]) playerVotes[pNameLow] = { mvps: 0, aces: 0 };
          if (vType === 'ACE') playerVotes[pNameLow].aces++;
          else playerVotes[pNameLow].mvps++;
      }
  }

  const stats = {};
  const mData = matchesSheet.getDataRange().getValues();
  
  for (let i = mData.length - 1; i >= 1; i--) {
      const matchId = String(mData[i][0]).trim();
      
      if (validMatchIds.has(matchId)) {
          const pNameRaw = String(mData[i][2]).trim();
          const pNameLow = normalizeName(pNameRaw);
          const result = mData[i][5]; 
          let pTeam = playerTeamMap[pNameLow] || "Agente Libre";

          if (!stats[pNameLow]) {
              stats[pNameLow] = { 
                name: pNameRaw, team: pTeam, 
                games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, 
                dmg: 0, duration: 0, kpTotal: 0, csTotal: 0, vsTotal: 0, gpmTotal: 0, 
                points: 0, champs: new Set(), rolesCount: {}, 
                form: [], 
                dmgObjTotal: 0, 
                dmgTurretsTotal: 0,
                // Ã°Å¸Å¸Â¢ NUEVOS CONTADORES PARA EL SALÃƒâ€œN DE LA FAMA
                tankTotal: 0, 
                pinksTotal: 0,
                epicsTotal: 0,
                pentasTotal: 0
              };
          }

          let s = stats[pNameLow];
          s.games++;
          if (result === 'Win') s.wins++;
          
          s.form.push(result === 'Win' ? 'W' : 'L');

          s.kills += Number(mData[i][6] || 0);
          s.deaths += Number(mData[i][7] || 0);
          s.assists += Number(mData[i][8] || 0);
          s.dmg += Number(mData[i][9] || 0);
          s.kpTotal += Number(mData[i][10] || 0); 
          s.duration += Number(mData[i][11] || 1); 
          s.points += Number(mData[i][12] || 0);
          
          if (mData[i][3]) s.champs.add(mData[i][3]); 
          
          // Ã°Å¸Å¸Â¢ RECOLECTOR DE DATOS OCULTOS
          const rawJson = mData[i][15];
          if (rawJson) {
              try {
                  let adv = JSON.parse(rawJson);
                  s.csTotal += Number(adv.csMin || 0);
                  s.vsTotal += Number(adv.vspm || 0);
                  s.gpmTotal += Number(adv.gpm || 0);
                  s.dmgObjTotal += Number(adv.dmgObj || 0);        
                  s.dmgTurretsTotal += Number(adv.dmgTurrets || 0);
                  
                  // Rescatamos los datos clave de tu json
                  s.tankTotal += Number(adv.dmgTaken || adv.damageTaken || adv.totalDamageTaken || 0);
                  s.pinksTotal += Number(adv.pinks || adv.controlWards || adv.visionWardsBoughtInGame || 0);
                  s.epicsTotal += Number(adv.epicMonsters || adv.epics || adv.dragonKills || 0);
                  s.pentasTotal += Number(adv.pentas || adv.pentaKills || adv.pentakills || 0);
              } catch(e) {}
          }
          
          let role = String(mData[i][4]).toUpperCase().trim();
          if (role === 'UTILITY') role = 'SUPPORT';
          if (role === 'BOT') role = 'BOTTOM';
          if (role === 'MID') role = 'MIDDLE';
          s.rolesCount[role] = (s.rolesCount[role] || 0) + 1;
      }
  }

  const result = [];
  for (const key in stats) {
      const s = stats[key];
      if (s.games > 0) { 
          const kdaNum = s.deaths > 0 ? (s.kills + s.assists) / s.deaths : (s.kills + s.assists);
          const winrate = Math.round((s.wins / s.games) * 100);
          const avgKp = Math.round((s.kpTotal / s.games) * 100);
          const avgCs = Number((s.csTotal / s.games).toFixed(1));
          const dpm = s.duration > 0 ? Math.round(s.dmg / s.duration) : 0;
          const avgGpm = Math.round(s.gpmTotal / s.games);
          const myVotes = playerVotes[key] || { mvps: 0, aces: 0 };
          
          let trend = 'NORMAL';
          if (s.form.length >= 2) {
              if (s.form[0] === 'W' && s.form[1] === 'W') trend = 'ON_FIRE';
              else if (s.form[0] === 'L' && s.form[1] === 'L') trend = 'COLD';
          }

          // Ã°Å¸Å¸Â¢ AQUÃƒÂ EMPAQUETAMOS TODO PARA MANDARLO A LA WEB
          result.push({
              name: s.name, team: s.team, role: Object.keys(s.rolesCount).reduce((a, b) => s.rolesCount[a] > s.rolesCount[b] ? a : b, "FILL"), games: s.games,
              winrate: winrate, mvps: myVotes.mvps, aces: myVotes.aces,
              kp: avgKp, kdaNum: kdaNum, kdaText: (s.kills/s.games).toFixed(1) + '/' + (s.deaths/s.games).toFixed(1) + '/' + (s.assists/s.games).toFixed(1),
              avgDeaths: (s.deaths/s.games).toFixed(1), cs: avgCs, vspm: (s.vsTotal/s.games).toFixed(2), dpm: dpm, gpm: avgGpm, champs: Array.from(s.champs).join(', '),
              points: Number((s.points / s.games).toFixed(1)),
              dmgObj: s.dmgObjTotal,          
              dmgTurrets: s.dmgTurretsTotal,  
              trend: trend,
              
              // Ã°Å¸â€Â´ ENVIAMOS LOS DATOS MÃƒÂGICOS A LA WEB (Se envÃƒÂ­an como totales acumulados)
              tank: s.tankTotal,
              pinks: s.pinksTotal,
              epicMonsters: s.epicsTotal,
              pentas: s.pentasTotal
          });
      }
  }
  
  let sortedStats = result.sort((a, b) => b.points - a.points);
  let sortedRounds = Array.from(availableRounds).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
  return { stats: sortedStats, rounds: sortedRounds };
}

/* ==========================================================
   Ã°Å¸â€œÂ° MOTOR DE NOTICIAS Y TENDENCIAS (CON ANALISTA IA EXTENDIDO)
   ========================================================== */
function getNewsAndTrends() {
  const ss = SpreadsheetApp.getActive();
  const infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  const statsData = getTournamentStatsForWeb('ALL'); 
  const players = statsData.stats || [];

  let rawDate = infoSheet ? infoSheet.getRange('B5').getValue() : "";
  let streamDate = "";
  if (rawDate instanceof Date) {
      streamDate = rawDate.toISOString(); 
  } else if (typeof rawDate === 'string' && rawDate.trim() !== "") {
      streamDate = rawDate.trim().replace(" ", "T"); 
  }

  let headlines = [];
  
  // Ã°Å¸Â¤â€“ 1. EL ANALISTA IA (PREDICCIÃƒâ€œN DEL PRÃƒâ€œXIMO PARTIDO)
  const tournamentData = getTournamentData();
  if (tournamentData && tournamentData.matches) {
      let pending = tournamentData.matches.filter(m => m.status !== 'COMPLETED');
      if (pending.length > 0) {
          let nextMatch = pending.sort((a,b) => ((b.votesA||0)+(b.votesB||0)) - ((a.votesA||0)+(a.votesB||0)))[0];
          let names = nextMatch.names.split(' vs ');
          let tA = names[0].trim(); let tB = names[1].trim();
          
          let bestA = players.filter(p => p.team === tA).sort((a,b)=>b.points - a.points)[0];
          let bestB = players.filter(p => p.team === tB).sort((a,b)=>b.points - a.points)[0];
          
          if (bestA && bestB) {
              headlines.push({ type: 'Ã°Å¸â€Â® IA ANALYTICS', text: `AnÃƒÂ¡lisis del prÃƒÂ³ximo duelo: Ã‚Â¿PodrÃƒÂ¡ el poder ofensivo de **${bestA.name}** doblegar a la defensa liderada por **${bestB.name}**?` });
          } else {
              headlines.push({ type: 'Ã°Å¸â€Â® IA ANALYTICS', text: `TensiÃƒÂ³n mÃƒÂ¡xima en la Grieta: **${tA}** y **${tB}** calientan motores para un enfrentamiento decisivo.` });
          }
      }
  }

  // Ã°Å¸â€Â¥ 2. JUGADORES "ON FIRE"
  const onFirePlayers = players.filter(p => p.trend === 'ON_FIRE');
  if (onFirePlayers.length > 0) {
      let pFire = onFirePlayers[Math.floor(Math.random() * onFirePlayers.length)];
      headlines.push({ type: 'Ã°Å¸â€Â¥ HOT', text: `Estado de gracia: **${pFire.name}** estÃƒÂ¡ ON FIRE. Sus rivales deberÃƒÂ­an plantearse banear sus mejores campeones en el prÃƒÂ³ximo draft.` });
  }

  // Ã°Å¸Â§Å  3. ALERTA DE TILT (Mala Racha)
  const coldPlayers = players.filter(p => p.trend === 'COLD');
  if (coldPlayers.length > 0) {
      let pCold = coldPlayers[Math.floor(Math.random() * coldPlayers.length)];
      headlines.push({ type: 'Ã°Å¸Â§Å  TILT ALERT', text: `Alarma roja para **${pCold.name}**, que atraviesa una racha de derrotas. Ã‚Â¿PodrÃƒÂ¡ romper la maldiciÃƒÂ³n en su prÃƒÂ³ximo partido?` });
  }

  // Ã°Å¸â€˜â€˜ 4. RACHA DE MVPs
  players.forEach(p => {
    if (p.mvps >= 2) headlines.push({ type: 'ALERTA', text: 'Ã‚Â¡Incontrolable! **' + p.name + '** encadena ' + p.mvps + ' MVPs y es el terror de la liga.' });
  });

  // Ã°Å¸â€™Â¥ 5. MAYOR DPM
  const topDpmPlayer = [...players].sort((a,b) => b.dpm - a.dpm)[0];
  if (topDpmPlayer && topDpmPlayer.dpm > 800) {
    headlines.push({ type: 'REPORTE', text: 'Poder destructivo: **' + topDpmPlayer.name + '** revienta los medidores con una media de DPM de ' + topDpmPlayer.dpm + '.' });
  }
  
  // Ã°Å¸Å¡Å“ 6. GRANJERO SUPREMO
  const topCsPlayer = [...players].sort((a,b) => b.cs - a.cs)[0];
  if (topCsPlayer && topCsPlayer.cs >= 8.0) {
    headlines.push({ type: 'TENDENCIA', text: 'MÃƒÂ¡quina de farmear: **' + topCsPlayer.name + '** arrasa con los sÃƒÂºbditos a un ritmo de ' + topCsPlayer.cs + ' CS/Min.' });
  }

  // Ã°Å¸â€ºÂ¡Ã¯Â¸Â 7. EL INMORTAL
  const immortal = [...players].filter(p => p.games >= 2).sort((a,b) => a.avgDeaths - b.avgDeaths)[0];
  if (immortal && immortal.avgDeaths < 2.5) {
    headlines.push({ type: 'REPORTE', text: 'Muro infranqueable: Es casi imposible matar a **' + immortal.name + '** (Media de solo ' + immortal.avgDeaths + ' muertes por partido).' });
  }

  // Ã°Å¸Å½Â¯ 8. KDA SUPREMO
  const topKdaPlayer = [...players].sort((a,b) => b.kdaNum - a.kdaNum)[0];
  if (topKdaPlayer && topKdaPlayer.kdaNum >= 6.0 && topKdaPlayer.games >= 2) {
      headlines.push({ type: 'Ã°Å¸Å½Â¯ PRECISIÃƒâ€œN', text: 'Intocable y letal: **' + topKdaPlayer.name + '** ostenta un KDA de ' + topKdaPlayer.kdaText + ' liderando la tabla de eficiencia en combate.' });
  }

  // Ã°Å¸â€˜ÂÃ¯Â¸Â 9. DIOS DE LA VISIÃƒâ€œN
  const topVisPlayer = [...players].sort((a,b) => b.vspm - a.vspm)[0];
  if (topVisPlayer && topVisPlayer.vspm >= 2.0) {
      headlines.push({ type: 'Ã°Å¸â€˜ÂÃ¯Â¸Â MAP CONTROL', text: 'El mapa no tiene secretos para **' + topVisPlayer.name + '**, que ilumina la Grieta con ' + topVisPlayer.vspm + ' de VisiÃƒÂ³n por Minuto.' });
  }

  // Ã°Å¸â€™Â° 10. REY DEL ORO (GPM)
  const topGpmPlayer = [...players].sort((a,b) => b.gpm - a.gpm)[0];
  if (topGpmPlayer && topGpmPlayer.gpm >= 450) {
      headlines.push({ type: 'Ã°Å¸â€™Â° ECONOMÃƒÂA', text: 'AutÃƒÂ©ntico magnate: **' + topGpmPlayer.name + '** genera ' + topGpmPlayer.gpm + ' de oro por minuto, marcando la diferencia en compras de objetos.' });
  }

  if (headlines.length === 0) {
    headlines.push({ type: 'INFO', text: "La liga estÃƒÂ¡ al rojo vivo. Analiza los scouting para preparar tus Pick'ems." });
  }

  // Mezclamos aleatoriamente y ahora extraemos hasta 9 noticias para llenar bien el periÃƒÂ³dico panorÃƒÂ¡mico
  headlines = headlines.sort(() => 0.5 - Math.random()).slice(0, 9);

  return {
    streamDate: streamDate,
    headlines: headlines
  };
}

/* ==========================================================
   Ã°Å¸â€Â® RÃƒâ€°CORDS Y ORÃƒÂCULOS (FIX: CÃƒÂLCULO EXACTO DEL COLOSO)
   ========================================================== */
function getLeagueRecordsAndPickems(roundFilter) {
    roundFilter = roundFilter || 'ALL';
    const ss = SpreadsheetApp.getActive();
    const matchesSheet = ss.getSheetByName('MATCHES');
    const tMatchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
    const pickemsSheet = ss.getSheetByName('PICKEMS_RECORDS');
    const teamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
    
    const matchResultsMap = {};
    if (tMatchesSheet && teamsSheet) {
        const tmData = tMatchesSheet.getDataRange().getValues();
        const teamsData = teamsSheet.getDataRange().getValues();
        for (let i = 1; i < tmData.length; i++) {
            const mId = String(tmData[i][0]);
            const winnerId = String(tmData[i][7]);
            const status = String(tmData[i][8]);
            if (status === 'COMPLETED' && winnerId !== "" && winnerId !== 'DRAW') {
                const teamRow = teamsData.find(r => String(r[0]) === winnerId);
                matchResultsMap[mId] = teamRow ? String(teamRow[1]) : winnerId; 
            }
        }
    }

    const validMatchIds = new Set();
    if (tMatchesSheet) {
        const tmData = tMatchesSheet.getDataRange().getValues();
        for (let i = 1; i < tmData.length; i++) {
            const rId = String(tmData[i][10] || "").trim();
            const round = String(tmData[i][1] || "").trim();
            if (rId && (roundFilter === 'ALL' || round === roundFilter)) {
                validMatchIds.add(rId);
            }
        }
    }

    let records = {
        bloodiest: { player: '-', val: 0, sub: 'Kills' },
        pacifist: { player: '-', val: 999999, sub: 'DaÃƒÂ±o (Win)' },
        tank: { player: '-', val: 0, sub: '% Absorbido (Media)' },
        farmer: { player: '-', val: 0, sub: 'CS/M' }
    };

    if (matchesSheet) {
        const mData = matchesSheet.getDataRange().getValues();
        
        let playerTankAcc = {};
        for (let i = 1; i < mData.length; i++) {
            const mId = String(mData[i][0]).trim();
            if (!validMatchIds.has(mId)) continue;

            const p = String(mData[i][2]);
            const result = mData[i][5];
            const k = Number(mData[i][6] || 0);
            const dmg = Number(mData[i][9] || 0);
            const rawJson = mData[i][15]; // Columna P
            
            if (k > records.bloodiest.val) records.bloodiest = { player: p, val: k, sub: 'Kills' };
            if (result === 'Win' && dmg > 0 && dmg < records.pacifist.val) records.pacifist = { player: p, val: dmg, sub: 'DaÃƒÂ±o (Win)' };
            
            if (rawJson) {
                try {
                    let adv = JSON.parse(rawJson);
                    if (Number(adv.csMin || 0) > records.farmer.val) records.farmer = { player: p, val: Number(adv.csMin).toFixed(1), sub: 'CS/M' };
                    
                    // Ã°Å¸â€™Â¡ FIX: Leemos el % de tanqueo directamente de la base de datos de Riot
                    let pct = 0;
                    if (adv.tank !== undefined) pct = Number(adv.tank);
                    else if (adv.dmgTakenPct !== undefined) pct = Number(adv.dmgTakenPct);
                    
                    // Si el nÃƒÂºmero viene como 0.27, lo pasamos a 27 para sacar la media entera
                    if (pct > 0 && pct <= 1) {
                        pct = pct * 100;
                    }
                    
                    if (pct > 0) {
                        if (!playerTankAcc[p]) playerTankAcc[p] = { sum: 0, count: 0 };
                        playerTankAcc[p].sum += pct;
                        playerTankAcc[p].count++;
                    }
                } catch(e) {}
            }
        }
        
        // Calcular la media y ver quiÃƒÂ©n es el Coloso absoluto
        let bestTank = { player: '-', val: 0 };
        for (let p in playerTankAcc) {
            let avg = playerTankAcc[p].sum / playerTankAcc[p].count;
            if (avg > bestTank.val) {
                bestTank = { player: p, val: avg };
            }
        }
        if (bestTank.val > 0) {
            records.tank = { player: bestTank.player, val: bestTank.val.toFixed(0) + '%', sub: '% Absorbido' };
        }
    }
    if(records.pacifist.val === 999999) records.pacifist.val = 0;

    let oracles = {};
    if (pickemsSheet && pickemsSheet.getLastRow() > 1) {
        const pData = pickemsSheet.getDataRange().getValues();
        for (let i = 1; i < pData.length; i++) {
            const voter = String(pData[i][1]).trim();
            const mId = String(pData[i][2]).trim();
            const teamVoted = String(pData[i][3]).trim();
            if (!oracles[voter]) oracles[voter] = { name: voter, guesses: 0, correct: 0 };
            oracles[voter].guesses++;
            if (matchResultsMap[mId] && matchResultsMap[mId] === teamVoted) oracles[voter].correct++;
        }
    }
    
    let oraclesArr = Object.values(oracles).filter(o => o.correct > 0).sort((a,b) => b.correct - a.correct).slice(0, 5);
    return { records: records, oracles: oraclesArr };
}


/* ==========================================================
   ESTADÃƒÂSTICAS AVANZADAS DE EQUIPO (PARA EL PERFIL AL HACER CLIC)
   ========================================================== */
function getTeamAdvancedStats(rosterStr) {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  if(!matchesSheet) return { error: true };
  
  // Limpiamos los nombres del roster
  let players = rosterStr.split(',').map(p => p.trim().toLowerCase());
  let mData = matchesSheet.getDataRange().getValues();
  
  // Agrupamos por partida para sumar el total del equipo en cada mapa
  let teamMatches = {}; 
  
  for(let i = 1; i < mData.length; i++) {
     let pNameRaw = String(mData[i][2]).trim().toLowerCase();
     
     if (players.includes(pNameRaw)) {
        let mId = mData[i][0];
        let result = mData[i][5]; 
        let k = Number(mData[i][6] || 0);
        let d = Number(mData[i][7] || 0);
        let a = Number(mData[i][8] || 0);
        let dmg = Number(mData[i][9] || 0);
        let dur = Number(mData[i][11] || 1); // DuraciÃƒÂ³n
        
        let vision = 0;
        let gold = 0;
        let adv = mData[i][15];
        if(adv){
           try { 
               let j = JSON.parse(adv); 
               // Intentamos sacar los pinks o wards, si no, multiplicamos la visiÃƒÂ³n por minuto
               vision = j.pinks ? Number(j.pinks) : (Number(j.vspm || 0) * dur);
               gold = Number(j.gpm || 0) * dur;
           } catch(e) {}
        }

        if (!teamMatches[mId]) {
            teamMatches[mId] = { k: 0, d: 0, a: 0, dmg: 0, gold: 0, vision: 0, duration: dur, win: result === 'Win' };
        }
        
        // Sumamos las stats de este jugador al total de su equipo en esta partida
        teamMatches[mId].k += k;
        teamMatches[mId].d += d;
        teamMatches[mId].a += a;
        teamMatches[mId].dmg += dmg;
        teamMatches[mId].gold += gold;
        teamMatches[mId].vision += vision;
     }
  }
  
  let totalGames = Object.keys(teamMatches).length;
  if(totalGames === 0) return { realGames: 0 };
  
  let tk=0, td=0, ta=0, tdmg=0, tgold=0, tvis=0, tdur=0;
  for (let mId in teamMatches) {
      tk += teamMatches[mId].k;
      td += teamMatches[mId].d;
      ta += teamMatches[mId].a;
      tdmg += teamMatches[mId].dmg;
      tgold += teamMatches[mId].gold;
      tvis += teamMatches[mId].vision;
      tdur += teamMatches[mId].duration;
  }
  
  return {
     realGames: totalGames,
     avgKills: (tk / totalGames).toFixed(1),
     avgDeaths: (td / totalGames).toFixed(1),
     avgAssists: (ta / totalGames).toFixed(1),
     avgVision: (tvis / totalGames).toFixed(1),
     avgDuration: (tdur / totalGames).toFixed(1),
     avgDpm: (tdmg / tdur).toFixed(0),
     avgGpm: (tgold / tdur).toFixed(0)
  };
}

/* ==========================================================
   Ã°Å¸â€œÂ¡ ESCÃƒÂNER MANUAL DE PARTIDAS DE TORNEO (CUSTOMS)
   ========================================================== */
function registerTournamentMatch(matchId) {
  try {
    const cfg = readConfigMap();
    const region = cfg.riot_region || 'europe'; 
    
    matchId = String(matchId).trim();
    if (!matchId.includes('_')) {
      return { success: false, msg: "Ã¢ÂÅ’ Formato incorrecto. Debe incluir la regiÃƒÂ³n (Ej: EUW1_12345678)" };
    }

    // 1. Descargar la partida directamente de Riot API
    const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    const matchData = riotFetchJson(url);

    if (!matchData || matchData.__error) {
      return { success: false, msg: "Ã¢ÂÅ’ Riot no encuentra la partida. Verifica que el ID es correcto." };
    }

    // =====================================================
    // Ã°Å¸Å¸Â¢ NUEVO: EXTRAER OBJETIVOS Y LÃƒÂNEA DE TIEMPO (ORO Y EVENTOS)
    // =====================================================
    const timelineUrl = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
    const timelineData = riotFetchJson(timelineUrl);

    let winStats = { gold: 0, towers: 0, inhibs: 0, dragons: 0, barons: 0 };
    let losStats = { gold: 0, towers: 0, inhibs: 0, dragons: 0, barons: 0 };
    let goldTimeline = [];
    let eventsList = []; 
    let csAt15 = {}; // <--- NUEVO: Para guardar el farmeo exacto al min 15

    if (matchData.info && matchData.info.teams) {
        let winTeam = matchData.info.teams.find(t => t.win === true);
        let losTeam = matchData.info.teams.find(t => t.win === false);
        let winParticipants = matchData.info.participants.filter(p => p.win === true);
        let losParticipants = matchData.info.participants.filter(p => p.win === false);

        if (winTeam && winTeam.objectives) {
            winStats.towers = winTeam.objectives.tower.kills;
            winStats.inhibs = winTeam.objectives.inhibitor.kills;
            winStats.dragons = winTeam.objectives.dragon.kills;
            winStats.barons = winTeam.objectives.baron.kills;
        }
        if (losTeam && losTeam.objectives) {
            losStats.towers = losTeam.objectives.tower.kills;
            losStats.inhibs = losTeam.objectives.inhibitor.kills;
            losStats.dragons = losTeam.objectives.dragon.kills;
            losStats.barons = losTeam.objectives.baron.kills;
        }

        let winGoldTotal = winParticipants.reduce((acc, p) => acc + p.goldEarned, 0);
        let losGoldTotal = losParticipants.reduce((acc, p) => acc + p.goldEarned, 0);
        winStats.gold = (winGoldTotal / 1000).toFixed(1);
        losStats.gold = (losGoldTotal / 1000).toFixed(1);

        if (timelineData && timelineData.info && timelineData.info.frames) {
            let winTeamId = winTeam ? winTeam.teamId : 100;
            let firstBloodFound = false;
            let firstTowerFound = false;

            // Ã°Å¸Å¸Â¢ EXTRAEMOS EL CS AL MINUTO 15 DESDE LA CACHÃƒâ€°
            // Si la partida durÃƒÂ³ menos de 15 min, coge el ÃƒÂºltimo frame
            let min15Frame = timelineData.info.frames[15] || timelineData.info.frames[timelineData.info.frames.length - 1]; 
            if (min15Frame && min15Frame.participantFrames) {
                for (let pId in min15Frame.participantFrames) {
                    let pf = min15Frame.participantFrames[pId];
                    csAt15[pf.participantId] = (pf.minionsKilled || 0) + (pf.jungleMinionsKilled || 0);
                }
            }

            // Ã°Å¸Å¸Â¢ EXTRAER BANS REALES DE LA PARTIDA
            let matchBans = [];
            if (matchData && matchData.info && matchData.info.teams) {
                matchData.info.teams.forEach(t => {
                    if (t.bans && Array.isArray(t.bans)) {
                        t.bans.forEach(b => {
                            let bName = getChampionNameFromId(b.championId);
                            if (bName) matchBans.push(bName);
                        });
                    }
                });
            }

            // Ã°Å¸Å¸Â¢ LÃƒâ€œGICA DE EVENTOS (AHORA BASADA EN GANADOR/PERDEDOR, NO EN AZUL/ROJO)
            timelineData.info.frames.forEach(frame => {
                let wGold = 0, lGold = 0;
                for (let pId in frame.participantFrames) {
                    let pf = frame.participantFrames[pId];
                    let pData = matchData.info.participants.find(p => p.participantId == pf.participantId);
                    if (pData) {
                        if (pData.teamId === winTeamId) wGold += pf.totalGold;
                        else lGold += pf.totalGold;
                    }
                }
                // La grÃƒÂ¡fica de oro siempre serÃƒÂ¡ Ganador - Perdedor
                goldTimeline.push(wGold - lGold); 

                if (frame.events) {
                    frame.events.forEach(evt => {
                        let minute = Math.floor(evt.timestamp / 60000);
                        
                        // AVERIGUAR SI EL EVENTO FUE DEL EQUIPO GANADOR O PERDEDOR
                        let isWinTeam = false;
                        if (evt.killerId > 0 && evt.killerId <= 10) {
                            let kData = matchData.info.participants.find(p => p.participantId == evt.killerId);
                            if (kData) isWinTeam = (kData.teamId === winTeamId);
                        } else if (evt.killerTeamId) {
                            isWinTeam = (evt.killerTeamId === winTeamId);
                        } else if (evt.type === "BUILDING_KILL") {
                            // Si una torre muere, el asesino es el equipo CONTRARIO al de la torre
                            isWinTeam = (evt.teamId !== winTeamId); 
                        }

                        let teamStr = isWinTeam ? "WIN" : "LOS";

                        if (evt.type === "CHAMPION_KILL" && !firstBloodFound && evt.killerId > 0) {
                            firstBloodFound = true;
                            eventsList.push({ minute: minute, type: "FB", team: teamStr });
                        }
                        if (evt.type === "BUILDING_KILL" && evt.buildingType === "TOWER_BUILDING" && !firstTowerFound) {
                            firstTowerFound = true;
                            eventsList.push({ minute: minute, type: "FT", team: teamStr });
                        }
                        if (evt.type === "ELITE_MONSTER_KILL") {
                            if (evt.monsterType === "DRAGON") eventsList.push({ minute: minute, type: "DRAGON", team: teamStr });
                            else if (evt.monsterType === "BARON_NASHOR") eventsList.push({ minute: minute, type: "BARON", team: teamStr });
                            else if (evt.monsterType === "RIFTHERALD") eventsList.push({ minute: minute, type: "HERALD", team: teamStr });
                            else if (evt.monsterType === "HORDE") {
                                let alreadyHasGrub = eventsList.some(e => e.type === "GRUB" && e.minute === minute && e.team === teamStr);
                                if (!alreadyHasGrub) eventsList.push({ minute: minute, type: "GRUB", team: teamStr });
                            }
                        }
                    });
                }
            });
        }
    }

    matchData.customWinStats = winStats;
    matchData.customLosStats = losStats;
    matchData.customGoldTimeline = goldTimeline;
    matchData.customEventsList = eventsList; 
    matchData.customCsAt15 = csAt15;
    // =====================================================

    // 2. Guardarla en la Memoria Global
    if (typeof GLOBAL_MATCH_CACHE !== 'undefined') {
        GLOBAL_MATCH_CACHE[matchId] = matchData;
    }

    // 3. Mapear a los jugadores de nuestra base de datos
    const ss = SpreadsheetApp.getActive();
    const playersSheet = ss.getSheetByName('PLAYERS');
    const pData = playersSheet.getDataRange().getValues();
    
    const puuidMap = {};
    for (let i = 1; i < pData.length; i++) {
      const name = pData[i][0];
      const puuid = pData[i][2];
      const streak = Number(pData[i][5] || 0);
      if (puuid) puuidMap[puuid] = { name: name, streak: streak };
    }

    const champDataMap = getChampionDataMap();
    let processedCount = 0;

    // 4. Procesar el partido
    const participants = matchData.info.participants || [];
    for (const p of participants) {
      if (puuidMap[p.puuid]) {
        const playerInfo = puuidMap[p.puuid];
        processMatch(matchId, p.puuid, playerInfo.name, playerInfo.streak, cfg, champDataMap);
        processedCount++;
      }
    }

    // --- Ã°Å¸Å¸Â¢ NUEVO: NOTIFICACIÃƒâ€œN PARA EL FANTASY PREMIER ---
    try {
        var txSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fantasy_Transactions");
        if (txSheet) {
            // Buscamos los nombres de los equipos para la notificaciÃƒÂ³n
            var tA_Name = teamA_Db ? teamA_Db.name : "Equipo Azul";
            var tB_Name = teamB_Db ? teamB_Db.name : "Equipo Rojo";
            
            var matchMsg = "Se ha registrado el acta oficial de: " + tA_Name + " vs " + tB_Name;
            
            // Lo aÃƒÂ±adimos al historial de transacciones con el tipo MATCH
            txSheet.appendRow([new Date(), 'MATCH', 'LIGA', matchMsg, 0]);
        }
    } catch(e) {
        // Ignoramos el error para no interrumpir el registro del partido
    }
    // -----------------------------------------------------

    if (processedCount > 0) {
      return { success: true, msg: `Ã¢Å“â€¦ Ã‚Â¡Partida Escaneada! Se han guardado las estadÃƒÂ­sticas de ${processedCount} jugadores.` };
    } else {
      return { success: false, msg: "Ã¢Å¡Â Ã¯Â¸Â La partida existe, pero NINGUNO de los 10 jugadores estÃƒÂ¡ en tu pestaÃƒÂ±a PLAYERS." };
    }

  } catch (e) {
    return { success: false, msg: "Error del sistema: " + e.message };
  }
}

/* ==========================================================
   Ã¢Å¡Â¡ AUTO-RESOLUCIÃƒâ€œN MÃƒÂGICA DE PARTIDOS DE TORNEO
   ========================================================== */
function autoResolveTournamentMatch(tMatchId, riotId) {
  try {
    riotId = String(riotId).trim();
    if (!riotId.includes('_')) return { success: false, msg: "Riot ID invÃƒÂ¡lido (Falta la regiÃƒÂ³n, ej: EUW1_...)." };

    // 1. Escanear y guardar la partida en la base de datos general
    const scanRes = registerTournamentMatch(riotId);
    if (!scanRes.success) return scanRes; 

    // 2. Extraer datos de la cachÃƒÂ© (registerTournamentMatch la guarda ahÃƒÂ­ al descargar)
    let matchData = GLOBAL_MATCH_CACHE[riotId];
    if (!matchData) {
        const cfg = readConfigMap();
        const url = `https://${cfg.riot_region || 'europe'}.api.riotgames.com/lol/match/v5/matches/${riotId}`;
        matchData = riotFetchJson(url);
    }
    
    if (!matchData || !matchData.info) return { success: false, msg: "No se pudo analizar la partida." };

    // 3. Buscar el partido en el Torneo
    const ss = SpreadsheetApp.getActive();
    const tMatchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
    const tTeamsSheet = ss.getSheetByName('TOURNAMENT_TEAMS');
    
    let tA_id, tB_id;
    const mData = tMatchesSheet.getDataRange().getValues();
    for (let i = 1; i < mData.length; i++) {
      if (mData[i][0] === tMatchId) {
        tA_id = mData[i][3];
        tB_id = mData[i][4];
        break;
      }
    }

    // 4. Leer los Rosters (Jugadores de cada equipo)
    let rosterA = []; let rosterB = [];
    const tData = tTeamsSheet.getDataRange().getValues();
    for (let i = 1; i < tData.length; i++) {
      if (tData[i][0] == tA_id) rosterA = String(tData[i][8] || "").toLowerCase().split(',').map(s=>s.trim());
      if (tData[i][0] == tB_id) rosterB = String(tData[i][8] || "").toLowerCase().split(',').map(s=>s.trim());
    }

    // 5. Traducir los PUUID de Riot a los Nombres de nuestro Excel
    const playersSheet = ss.getSheetByName('PLAYERS');
    const pDataSheet = playersSheet.getDataRange().getValues();
    const puuidToName = {};
    for(let i=1; i<pDataSheet.length; i++) {
        if(pDataSheet[i][2]) {
            puuidToName[pDataSheet[i][2]] = String(pDataSheet[i][0]).trim().toLowerCase();
        }
    }

    // 6. Contar de quÃƒÂ© equipo son los ganadores
    const participants = matchData.info.participants;
    let matchedA = 0; let matchedB = 0;

    for (const p of participants) {
        if (p.win) {
            const dbName = puuidToName[p.puuid];
            if (dbName) {
                if (rosterA.includes(dbName)) matchedA++;
                if (rosterB.includes(dbName)) matchedB++;
            }
        }
    }

    let pointsA = 0; let pointsB = 0;
    if (matchedA > matchedB) { pointsA = 1; pointsB = 0; }
    else if (matchedB > matchedA) { pointsA = 0; pointsB = 1; }
    else {
        return { success: false, msg: "Ã¢Å¡Â Ã¯Â¸Â Partida escaneada y guardada, pero no pude deducir automÃƒÂ¡ticamente quiÃƒÂ©n ganÃƒÂ³ porque los jugadores de la partida no coinciden con los nombres que pusiste en los Rosters. Por favor, pon el 1-0 manualmente abajo y dale a GUARDAR." };
    }

    // 7. Aplicar Resultado Oficial
    const updateRes = updateMatchResult(tMatchId, pointsA, pointsB, riotId);
    
    if (updateRes.success) {
        return { success: true, msg: `Ã¢Å“Â¨ Ã‚Â¡MAGIA PURA! La partida se ha descargado, se ha detectado al ganador automÃƒÂ¡ticamente y las stats estÃƒÂ¡n listas para verse en el Acta.` };
    } else {
        return { success: false, msg: "Fallo al guardar el resultado final en el cuadro." };
    }

  } catch(e) {
      return { success: false, msg: "Error Auto-Resolve: " + e.message };
  }
}

// ==========================================================
// Ã°Å¸â€œÂº ANUNCIAR STREAM EN DISCORD
// ==========================================================
function announceStreamBackend(streamUrl, matchInfo) {
  const mensaje = "Ã°Å¸â€Â´ **Ã‚Â¡ESTAMOS EN DIRECTO!** Ã°Å¸â€Â´\n\nÃ°Å¸Å½â„¢Ã¯Â¸Â Arranca el casteo oficial del partido:\nÃ¢Å¡â€Ã¯Â¸Â **" + matchInfo + "**\n\nÃ°Å¸â€˜â€° **ENTRA AL STREAM AQUÃƒÂ:** " + streamUrl;
  sendDiscordAlert(mensaje); // Usa el webhook que ya configuramos antes
  return "Ã‚Â¡Alerta de Stream enviada a Discord!";
}


function setStreamDate(dateStr) {
  const ss = SpreadsheetApp.getActive();
  const infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  infoSheet.getRange('B5').setValue(dateStr);
  return "Stream programado: " + dateStr;
}

/* ==========================================================
   Ã°Å¸Â§Â¬ META SNAPSHOT (ESTADÃƒÂSTICAS DE CAMPEONES)
   ========================================================== */
function getMetaStats() {
  const ss = SpreadsheetApp.getActive();
  const matchesSheet = ss.getSheetByName('MATCHES');
  const tMatchesSheet = ss.getSheetByName('TOURNAMENT_MATCHES');
  if (!matchesSheet || !tMatchesSheet) return [];

  // Solo contabilizamos partidas oficiales del calendario
  const tmData = tMatchesSheet.getDataRange().getValues();
  const validMatchIds = new Set();
  for (let i = 1; i < tmData.length; i++) {
      const rId = String(tmData[i][10] || "").trim();
      if (rId) validMatchIds.add(rId);
  }

  const mData = matchesSheet.getDataRange().getValues();
  const champStats = {};

  for (let i = 1; i < mData.length; i++) {
      const matchId = String(mData[i][0]).trim();
      if (!validMatchIds.has(matchId)) continue;

      let champ = String(mData[i][3]).trim();
      let result = mData[i][5];
      if (!champ || champ === 'undefined') continue;

      if (!champStats[champ]) {
          champStats[champ] = { champ: champ, picks: 0, wins: 0 };
      }
      champStats[champ].picks++;
      if (result === 'Win') champStats[champ].wins++;
  }

  let resultArr = [];
  for (let c in champStats) {
      let s = champStats[c];
      resultArr.push({
          champ: s.champ,
          picks: s.picks,
          wins: s.wins,
          winrate: Math.round((s.wins / s.picks) * 100)
      });
  }
  
  // Ordenamos por los mÃƒÂ¡s elegidos, y en caso de empate por Winrate
  return resultArr.sort((a, b) => b.picks - a.picks || b.winrate - a.winrate);
}


/* ==========================================================
   Ã°Å¸Ââ€  SISTEMA DE PLAYOFFS (BOTÃƒâ€œN MÃƒÂGICO)
   ========================================================== */
function getPlayoffsStatus() {
  const ss = SpreadsheetApp.getActive();
  let infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  if (!infoSheet) return false;
  // Usamos la celda B6 de TOURNAMENT_INFO para guardar si estÃƒÂ¡ activo o no
  const status = infoSheet.getRange('B6').getValue();
  return status === 'ACTIVE';
}

function togglePlayoffsBackend(isActive) {
  const ss = SpreadsheetApp.getActive();
  let infoSheet = ss.getSheetByName('TOURNAMENT_INFO');
  if (!infoSheet) infoSheet = ss.insertSheet('TOURNAMENT_INFO'); // Por si acaso no existe
  
  infoSheet.getRange('B6').setValue(isActive ? 'ACTIVE' : 'INACTIVE');
  return { msg: isActive ? "Ã°Å¸Ââ€  ÃƒÂrbol de Playoffs DESBLOQUEADO para todos los usuarios." : "Ã°Å¸â€â€™ Fase de Playoffs OCULTA de nuevo." };
}

function checkAdminPassword(inputPass) {
  const REAL_PASSWORD = "admin"; // Pon aquÃƒÂ­ la contraseÃƒÂ±a que quieras
  
  if (inputPass === REAL_PASSWORD) {
    return true;
  } else {
    return false;
  }
}

function getPublicPlayerProfile(playerName) {
  try {
    if (!playerName || playerName === "") {
      return { error: "No se ha recibido ningÃƒÂºn nombre en la URL" };
    }

    var data = getTournamentStatsForWeb("ALL"); 
    
    if (!data) {
      return { error: "La base de datos (data) no responde o estÃƒÂ¡ vacÃƒÂ­a" };
    }
    
    if (!data.stats || data.stats.length === 0) {
      return { error: "La pestaÃƒÂ±a de estadÃƒÂ­sticas (data.stats) estÃƒÂ¡ vacÃƒÂ­a" };
    }
    
    var searchName = String(playerName).toLowerCase().trim();
    
    var player = data.stats.find(function(p) {
      var dbName = String(p.name).toLowerCase().trim();
      return dbName === searchName;
    });
    
    if (!player) {
      return { error: "El jugador '" + searchName + "' no existe en la lista de " + data.stats.length + " jugadores registrados." };
    }
    
    return player;
    
  } catch (e) {
    return { error: "Fallo interno del servidor: " + e.toString() };
  }
}

function getPublicPlayerUrl(playerName) {
  var url = ScriptApp.getService().getUrl();
  // encodeURIComponent asegura que los espacios y sÃƒÂ­mbolos raros viajen bien por la URL
  return url + "?player=" + encodeURIComponent(playerName);
}



// =========================================================================
// Ã°Å¸Å’Å¸ MÃƒâ€œDULO FANTASY PREMIER - BACKEND UNIFICADO V4.1 (PRECIOS DINÃƒÂMICOS)
// =========================================================================

function setupFantasySheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsConfig = {
    "Fantasy_Managers": ["Manager_ID", "Password", "Budget", "Total_Points"],
    "Fantasy_Rosters":  ["Manager_ID", "TOP", "JGL", "MID", "ADC", "SUP", "Captain_Role", "Sinergy_Active", "SUB", "IS_LOCKED", "ACTIVE_CARD"],
    "Fantasy_Market":   ["Player_Name", "Role", "Base_Price", "Ends_At"],
    "Fantasy_Bids":     ["Manager_ID", "Player_Name", "Bid_Amount"],
    "Fantasy_Transactions": ["Date", "Type", "Manager", "Player", "Amount"],
    "Fantasy_Inventory":    ["Manager_ID", "Card_Name", "Rarity", "Description", "Status"],
    "Fantasy_History":      ["Date", "Manager_ID", "Points", "Budget"]
  };
  for (var name in sheetsConfig) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheetsConfig[name]);
      sheet.getRange(1, 1, 1, sheetsConfig[name].length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
    }
  }
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Fantasy Premier configurado correctamente.");
  return "OK";
}

function loginManager(managerId, pin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Fantasy_Managers");
    if (!sheet) return { success: false, error: "Falta la pestaÃƒÂ±a Fantasy_Managers." };
    var data = sheet.getDataRange().getValues();
    var searchId = String(managerId).trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim().toLowerCase() === searchId) {
        if (String(data[i][1]).trim() === String(pin).trim()) {
          return { success: true, name: data[i][0], budget: data[i][2], points: data[i][3] };
        } else return { success: false, error: "Ã¢ÂÅ’ PIN incorrecto." };
      }
    }
    return { success: false, error: "NOT_FOUND" };
  } catch(e) { return { success: false, error: "Fallo en login: " + e.message }; }
}

function registerManager(managerId, pin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetManagers = ss.getSheetByName("Fantasy_Managers");
    var sheetRosters = ss.getSheetByName("Fantasy_Rosters");
    if (!sheetManagers || !sheetRosters) return { success: false, error: "Faltan las pestaÃƒÂ±as base." };
    
    var existingData = sheetManagers.getDataRange().getValues();
    if (existingData.length > 15) return { success: false, error: "Ã¢â€ºâ€ Cupo mÃƒÂ¡ximo alcanzado." };

    var cleanId = String(managerId).trim();
    var rostersData = sheetRosters.getDataRange().getValues();
    var takenPlayers = [];
    for (var r = 1; r < rostersData.length; r++) {
        for (var c = 1; c <= 5; c++) { if (rostersData[r][c]) takenPlayers.push(String(rostersData[r][c]).trim().toLowerCase()); }
        if (rostersData[r][8]) takenPlayers.push(String(rostersData[r][8]).trim().toLowerCase());
    }
    
    // Leemos stats reales para asignar precios justos a los Starter Packs
    var statsResponse = getTournamentStatsForWeb('ALL');
    var allPlayers = statsResponse.stats || [];
    var cheapPlayers = [];
    
    allPlayers.forEach(function(p) {
        if (takenPlayers.indexOf(p.name.toLowerCase()) === -1) {
            var price = getFantasyPlayerPrice(p);
            // Consideramos "baratos" a los que valen 3.5M o menos para el pack inicial
            if (price <= 3500000) cheapPlayers.push({ name: p.name, role: p.role, price: price });
        }
    });
    
    cheapPlayers.sort(function() { return 0.5 - Math.random(); });
    var starter1 = null, starter2 = null;
    if (cheapPlayers.length > 0) {
        starter1 = cheapPlayers[0];
        for (var k = 1; k < cheapPlayers.length; k++) { if (cheapPlayers[k].role !== starter1.role) { starter2 = cheapPlayers[k]; break; } }
    }
    if (starter1 && !starter2 && cheapPlayers.length > 1) starter2 = cheapPlayers[1];
    
    // Ã°Å¸Å¸Â¢ PRESUPUESTO INICIAL AUMENTADO A 15M (Las estrellas ahora cuestan ~10M)
    var initialBudget = 15000000; 
    var newRoster = ["", "", "", "", ""]; 
    var roleMap = { "TOP": 0, "JUNGLE": 1, "JGL": 1, "MIDDLE": 2, "MID": 2, "BOTTOM": 3, "ADC": 3, "SUPPORT": 4, "SUP": 4 };
    
    var txSheet = ss.getSheetByName("Fantasy_Transactions");
    if (!txSheet) { txSheet = ss.insertSheet("Fantasy_Transactions"); txSheet.appendRow(["Date", "Type", "Manager", "Player", "Amount"]); }

    if (starter1) {
        newRoster[roleMap[starter1.role ? starter1.role.toUpperCase() : "TOP"] || 0] = starter1.name;
        initialBudget -= starter1.price;
        txSheet.appendRow([new Date(), 'BUY', cleanId, starter1.name + " (Starter)", starter1.price]);
    }
    if (starter2) {
        var idx = roleMap[starter2.role ? starter2.role.toUpperCase() : "TOP"];
        if (idx !== undefined && newRoster[idx] === "") newRoster[idx] = starter2.name;
        else { for (var z = 0; z < 5; z++) { if (newRoster[z] === "") { newRoster[z] = starter2.name; break; } } }
        initialBudget -= starter2.price;
        txSheet.appendRow([new Date(), 'BUY', cleanId, starter2.name + " (Starter)", starter2.price]);
    }
    
    sheetManagers.appendRow([cleanId, String(pin), initialBudget, 0]);
    sheetRosters.appendRow([cleanId, newRoster[0], newRoster[1], newRoster[2], newRoster[3], newRoster[4], "NONE", "NONE", "", false, ""]);
    
    return { success: true, name: cleanId, budget: initialBudget, points: 0 };
  } catch(e) { return { success: false, error: "Fallo en registro: " + e.message }; }
}

function getFantasyInitData(managerId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var searchId = String(managerId).trim().toLowerCase();

    var manSheet  = ss.getSheetByName("Fantasy_Managers");
    var rosSheet  = ss.getSheetByName("Fantasy_Rosters");
    var txSheet   = ss.getSheetByName("Fantasy_Transactions");
    var bidsSheet = ss.getSheetByName("Fantasy_Bids");
    var histSheet = ss.getSheetByName("Fantasy_History");
    var invSheet  = ss.getSheetByName("Fantasy_Inventory");

    var mData = manSheet  ? manSheet.getDataRange().getValues()  : [];
    var rData = rosSheet  ? rosSheet.getDataRange().getValues()  : [];
    var tData = txSheet   ? txSheet.getDataRange().getValues()   : [];
    var bData = bidsSheet ? bidsSheet.getDataRange().getValues() : [];
    var hData = histSheet ? histSheet.getDataRange().getValues() : [];
    var iData = invSheet  ? invSheet.getDataRange().getValues()  : [];

    var result = {
      success: true, financials: { budget: 0, bids: 0 }, roster: null,
      ranking: [], activity: [], charts: { labels: [], points: [], budget: [] }, inventory: [],
      allRosters: [] // Ã°Å¸Å¸Â¢ AQUÃƒÂ GUARDAMOS TODOS LOS EQUIPOS PARA EL LIVE SCORING
    };

    var statsResponse = getTournamentStatsForWeb('ALL');
    var allPlayers = statsResponse.stats || [];
    var priceMap = {};
    allPlayers.forEach(function(p) { priceMap[p.name.toLowerCase()] = getFantasyPlayerPrice(p); });

    var teamValues = {};
    for(var k = 1; k < rData.length; k++) {
        var mId = String(rData[k][0]).trim().toLowerCase();
        if(!mId) continue;
        
        var val = 0;
        for(var col = 1; col <= 5; col++) { 
            var pName = String(rData[k][col]).trim().toLowerCase();
            if(pName && priceMap[pName]) val += priceMap[pName];
            else if(pName) val += 500000;
        }
        var subName = String(rData[k][8]).trim().toLowerCase();
        if(subName && priceMap[subName]) val += priceMap[subName];
        else if(subName) val += 500000;
        teamValues[mId] = val;

        // Ã°Å¸Å¸Â¢ LLENAMOS EL ARRAY PARA LA WEB
        result.allRosters.push({
            manager: String(rData[k][0]),
            top: rData[k][1], jgl: rData[k][2], mid: rData[k][3], adc: rData[k][4], sup: rData[k][5], 
            captain: rData[k][6], sub: rData[k][8], activeCard: rData[k][10]
        });
    }

    for (var i = 1; i < mData.length; i++) {
      if (mData[i][0]) {
        var mName = String(mData[i][0]);
        var currId = mName.trim().toLowerCase();
        var mBud = parseFloat(mData[i][2]) || 0;
        var mPts = parseFloat(mData[i][3]) || 0;
        var tVal = teamValues[currId] || 0;
        result.ranking.push({ name: mName, budget: mBud, points: mPts, teamValue: tVal });
        if (currId === searchId) result.financials.budget = mBud;
      }
    }
    
    for (var j = 1; j < bData.length; j++) {
      if (String(bData[j][0]).toLowerCase() === searchId) result.financials.bids += parseFloat(bData[j][2]) || 0;
    }

    for (var r = 1; r < rData.length; r++) {
      if (String(rData[r][0]).trim().toLowerCase() === searchId) {
        result.roster = {
          top: rData[r][1] || "", jgl: rData[r][2] || "", mid: rData[r][3] || "", adc: rData[r][4] || "",
          sup: rData[r][5] || "", captain: rData[r][6] || "NONE", sub: rData[r][8] || "", 
          isLocked: rData[r][9] === true || String(rData[r][9]).toUpperCase() === "TRUE", activeCard: rData[r][10] || ""
        };
        break;
      }
    }

    for (var a = tData.length - 1; a >= 1 && result.activity.length < 6; a--) {
      if (!tData[a][0]) continue;
      var d = new Date(tData[a][0]);
      result.activity.push({
        date: d.getDate() + "/" + (d.getMonth()+1) + " " + d.getHours() + ":" + String(d.getMinutes()).padStart(2,"0"),
        type: tData[a][1], manager: tData[a][2], player: tData[a][3], amount: parseFloat(tData[a][4]) || 0
      });
    }

    for (var h = 1; h < hData.length; h++) {
      if (String(hData[h][1]).toLowerCase() === searchId) {
        var hd = new Date(hData[h][0]);
        result.charts.labels.push(hd.getDate() + "/" + (hd.getMonth()+1));
        result.charts.points.push(hData[h][2]);
        result.charts.budget.push(hData[h][3]);
      }
    }

    return result;
  } catch(e) { return { success: false, error: e.toString() }; }
}

function formatMoneyBack(num) {
    return parseInt(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Ã¢â€šÂ¬";
}

// Ã°Å¸Å¸Â¢ NUEVA FÃƒâ€œRMULA DE PRECIOS (JUSTICIA ABSOLUTA BASADA EN PUNTOS)
function getFantasyPlayerPrice(p) {
    if (!p) return 500000;
    var ovr = calculatePlayerOVRBackend(p);
    
    // Extraemos los puntos totales reales
    var avgPts = parseFloat(p.points) || 0;
    var gamesPlayed = parseInt(p.games) || 0;
    var totalPts = Math.round(avgPts * gamesPlayed);
    
    // Base de 500k.
    // Sumamos +130.000Ã¢â€šÂ¬ por cada punto que haya aportado.
    // Sumamos +35.000Ã¢â€šÂ¬ por cada punto de estadÃƒÂ­stica global (OVR) por encima de 60.
    var price = 500000 + (Math.max(0, totalPts) * 130000) + ((ovr - 60) * 35000);
    
    // LÃƒÂ­mites del mercado
    if (price < 500000) price = 500000;
    if (price > 18000000) price = 18000000; // Cap en 18 Millones
    
    // Redondeo bonito para la vista
    return Math.round(price / 10000) * 10000;
}

function calculatePlayerOVRBackend(p) {
    if (!p || p.games === 0) return 60;
    const safeFloat = (val) => parseFloat(val) || 0;
    let kdaNum = safeFloat(p.kdaNum); let dpm = safeFloat(p.dpm); let cs = safeFloat(p.cs);
    let kpReal = safeFloat(p.kp); let vspm = safeFloat(p.vspm); let gpm = safeFloat(p.gpm); let pts = safeFloat(p.points);

    const calcStat = (val, max) => { let ratio = Math.min(1, Math.max(0, val / max)); return 60 + (Math.pow(ratio, 1.3) * 39); };

    let sKDA = calcStat(kdaNum, 11.0); let sDPM = calcStat(dpm, 1050); let sCS  = calcStat(cs, 9.5);      
    let sKP  = calcStat(kpReal, 85); let sVIS = calcStat(vspm, 3.5); let sGPM = calcStat(gpm, 520); let sPTS = calcStat(pts, 15);

    let shortRole = p.role ? p.role.toUpperCase() : 'FILL'; let ovr = 60;
    switch(shortRole) {
        case 'TOP': ovr = (sDPM * 0.25) + (sCS * 0.25) + (sKDA * 0.20) + (sKP * 0.15) + (sPTS * 0.15); break;
        case 'JUNGLE': case 'JGL': ovr = (sKP * 0.30) + (sKDA * 0.25) + (sVIS * 0.20) + (sPTS * 0.15) + (sCS * 0.10); break;
        case 'MIDDLE': case 'MID': ovr = (sDPM * 0.30) + (sKDA * 0.25) + (sCS * 0.25) + (sKP * 0.10) + (sPTS * 0.10); break;
        case 'BOTTOM': case 'ADC': ovr = (sDPM * 0.35) + (sKDA * 0.25) + (sCS * 0.20) + (sGPM * 0.10) + (sPTS * 0.10); break;
        case 'SUPPORT': case 'SUP': ovr = (sVIS * 0.35) + (sKP * 0.35) + (sKDA * 0.20) + (sPTS * 0.10); break;
        default: ovr = (sDPM * 0.20) + (sKDA * 0.20) + (sCS * 0.20) + (sKP * 0.20) + (sPTS * 0.20);
    }
    ovr = Math.floor(ovr);
    if (safeFloat(p.winrate) < 50 && ovr > 85) ovr -= 4; 
    return Math.min(99, Math.max(60, ovr));
}

function getMarketPlayers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Fantasy_Market");
    if (!sheet) {
        sheet = ss.insertSheet("Fantasy_Market");
        sheet.appendRow(["Player_Name", "Role", "Base_Price", "Ends_At"]);
        return { success: true, players: [] };
    }
    var data = sheet.getDataRange().getValues();
    var players = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0] !== "") {
        players.push({ name: data[i][0], role: data[i][1], price: data[i][2], endsAt: data[i][3] });
      }
    }
    return { success: true, players: players };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function generateDailyMarket() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fantasyMarketSheet = ss.getSheetByName("Fantasy_Market");
  if (!fantasyMarketSheet) { fantasyMarketSheet = ss.insertSheet("Fantasy_Market"); fantasyMarketSheet.appendRow(["Player_Name", "Role", "Base_Price", "Ends_At"]); }
  
  var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
  var rData = rostersSheet.getDataRange().getValues();
  var takenPlayers = [];
  for (var r = 1; r < rData.length; r++) {
      for (var c = 1; c <= 5; c++) { if (rData[r][c]) takenPlayers.push(String(rData[r][c]).trim().toLowerCase()); }
      if (rData[r][8]) takenPlayers.push(String(rData[r][8]).trim().toLowerCase()); 
  }
  
  var statsResponse = getTournamentStatsForWeb('ALL');
  var allPlayers = statsResponse.stats || [];
  var availablePlayers = [];
  allPlayers.forEach(function(p) { if (takenPlayers.indexOf(p.name.toLowerCase()) === -1) availablePlayers.push(p); });
  
  var currentMarketData = fantasyMarketSheet.getDataRange().getValues();
  var oldMarketNames = [];
  for (var m = 1; m < currentMarketData.length; m++) {
      if (currentMarketData[m][0]) {
          var pName = String(currentMarketData[m][0]).trim().toLowerCase();
          if (takenPlayers.indexOf(pName) === -1) oldMarketNames.push(pName);
      }
  }
  
  oldMarketNames.sort(function() { return 0.5 - Math.random(); });
  var survivorsNames = oldMarketNames.slice(0, 4); 
  var newCandidates = availablePlayers.filter(function(p) { return survivorsNames.indexOf(p.name.toLowerCase()) === -1; });
  
  // Ã°Å¸Å¸Â¢ FASE DE MERCADO (1 = Baratos, 2 = Equilibrado, 3 = Aleatorio puro)
  var MARKET_PHASE = 1; 

  var weightedCandidates = [];
  newCandidates.forEach(function(p) {
      var price = getFantasyPlayerPrice(p);
      var copies = 1;
      
      if (MARKET_PHASE === 1) { // Early Game
          if (price <= 4000000) copies = 25; // 25x mÃƒÂ¡s probabilidades de salir
          else if (price <= 7500000) copies = 5;
          else copies = 1; // Raro que salgan caros
      } else if (MARKET_PHASE === 2) { // Mid Game
          if (price <= 4000000) copies = 5;
          else if (price <= 8000000) copies = 20; // Dominan los medios
          else copies = 4;
      } else { // Late Game
          copies = 1; // Todos igual
      }
      for(var w=0; w<copies; w++) { weightedCandidates.push(p); }
  });
  
  weightedCandidates.sort(function() { return 0.5 - Math.random(); });
  
  // Eliminar duplicados de las probabilidades
  var finalNewCandidates = []; var seenNames = {};
  for (var w=0; w<weightedCandidates.length; w++) {
      var n = weightedCandidates[w].name;
      if (!seenNames[n]) { seenNames[n] = true; finalNewCandidates.push(weightedCandidates[w]); }
  }
  
  var needed = 15 - survivorsNames.length;
  var selectedPlayers = [];
  survivorsNames.forEach(function(sn) { var found = availablePlayers.find(function(p) { return p.name.toLowerCase() === sn; }); if (found) selectedPlayers.push(found); });
  selectedPlayers = selectedPlayers.concat(finalNewCandidates.slice(0, needed));
  
  var marketEntries = [];
  var endsAtText = "Medianoche";
  selectedPlayers.forEach(function(p) {
      marketEntries.push([ p.name, p.role, getFantasyPlayerPrice(p), endsAtText ]);
  });
  
  marketEntries.sort(function(a, b) { return b[2] - a[2]; });
  if (fantasyMarketSheet.getLastRow() > 1) { fantasyMarketSheet.getRange(2, 1, fantasyMarketSheet.getLastRow() - 1, 4).clearContent(); }
  if (marketEntries.length > 0) { fantasyMarketSheet.getRange(2, 1, marketEntries.length, 4).setValues(marketEntries); }
  return "Mercado rotado con fase " + MARKET_PHASE;
}
function placeBid(managerId, playerName, bidAmount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var managersSheet = ss.getSheetByName("Fantasy_Managers");
    var bidsSheet = ss.getSheetByName("Fantasy_Bids");
    if (!bidsSheet) { bidsSheet = ss.insertSheet("Fantasy_Bids"); bidsSheet.appendRow(["Manager_ID", "Player_Name", "Bid_Amount"]); }
    if (!managersSheet) return { success: false, error: "Manager no encontrado" };
    
    var mData = managersSheet.getDataRange().getValues();
    var bData = bidsSheet.getDataRange().getValues();
    var mIndex = -1, currentBudget = 0;
    
    for (var i = 1; i < mData.length; i++) {
      if (String(mData[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        mIndex = i; currentBudget = parseFloat(mData[i][2]) || 0; break;
      }
    }
    if (mIndex === -1) return { success: false, error: "Manager no encontrado." };
    
    var numBid = parseFloat(bidAmount);
    if (isNaN(numBid) || numBid <= 0) return { success: false, error: "Cantidad no vÃƒÂ¡lida." };

    var bIndex = -1, previousBid = 0;
    for (var j = 1; j < bData.length; j++) {
      if (String(bData[j][0]).toLowerCase() === String(managerId).toLowerCase() && String(bData[j][1]).toLowerCase() === String(playerName).toLowerCase()) {
        bIndex = j; previousBid = parseFloat(bData[j][2]) || 0; break;
      }
    }

    var costDifference = numBid - previousBid;
    if (currentBudget < costDifference) return { success: false, error: "Presupuesto insuficiente. Necesitas " + formatMoneyBack(costDifference) + " extra." };
    
    var newBudget = currentBudget - costDifference;
    managersSheet.getRange(mIndex + 1, 3).setValue(newBudget); 
    
    if (bIndex !== -1) bidsSheet.getRange(bIndex + 1, 3).setValue(numBid);
    else bidsSheet.appendRow([managerId, playerName, numBid]);
    
    return { success: true, newBudget: newBudget, msg: "Puja de " + formatMoneyBack(numBid) + " registrada por " + playerName };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function lockFantasyTeam(managerId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Fantasy_Rosters");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        if (!data[i][1] || !data[i][2] || !data[i][3] || !data[i][4] || !data[i][5]) {
            return { success: false, error: "Debes tener los 5 huecos titulares ocupados para confirmar." };
        }
        sheet.getRange(i + 1, 10).setValue(true);
        return { success: true, msg: "AlineaciÃƒÂ³n bloqueada para esta jornada." };
      }
    }
    return { success: false, error: "Roster no encontrado." };
  } catch(e) { return { success: false, error: e.message }; }
}

function swapSub(managerId, roleKey) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fantasy_Rosters");
    var data = sheet.getDataRange().getValues();
    var colMap = { "top": 2, "jgl": 3, "mid": 4, "adc": 5, "sup": 6 };
    var roleIdx = colMap[roleKey.toLowerCase()];
    var subIdx = 9; 

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(managerId).trim().toLowerCase()) {
        if (data[i][9] === true || String(data[i][9]).toUpperCase() === "TRUE") return { success: false, error: "Equipo bloqueado." };
        var currentStarter = data[i][roleIdx - 1] || "";
        var currentSub = data[i][subIdx - 1] || "";
        sheet.getRange(i + 1, roleIdx).setValue(currentSub);
        sheet.getRange(i + 1, subIdx).setValue(currentStarter);
        return { success: true, msg: "SustituciÃƒÂ³n realizada con ÃƒÂ©xito." };
      }
    }
    return { success: false, error: "MÃƒÂ¡nager no encontrado." };
  } catch (e) { return { success: false, error: e.message }; }
}

// Ã°Å¸Å¸Â¢ VENTA INSTANTÃƒÂNEA AL SISTEMA (50% DEL VALOR)
function sellPlayerInstant(managerId, roleKey) {
  try {
    var ss = SpreadsheetApp.getActive();
    var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
    var managersSheet = ss.getSheetByName("Fantasy_Managers");
    var txSheet = ss.getSheetByName("Fantasy_Transactions");

    var rData = rostersSheet.getDataRange().getValues();
    var colMap = { "top": 2, "jgl": 3, "mid": 4, "adc": 5, "sup": 6, "sub": 9 };
    var colIndex = colMap[roleKey.toLowerCase()];
    
    var rRow = -1; var playerName = "";
    for (var i = 1; i < rData.length; i++) {
      if (String(rData[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        if (rData[i][9] === true || String(rData[i][9]).toUpperCase() === "TRUE") return { success: false, error: "Equipo bloqueado." };
        rRow = i + 1; playerName = rData[i][colIndex - 1]; break;
      }
    }
    if (!playerName) return { success: false, error: "Slot vacÃƒÂ­o." };

    // Calculamos el 50% del valor real actual
    var stats = getTournamentStatsForWeb('ALL').stats || [];
    var pData = stats.find(x => x.name.toLowerCase() === playerName.toLowerCase());
    var fullValue = getFantasyPlayerPrice(pData);
    var instantValue = Math.round(fullValue * 0.5);

    // Ejecutar venta
    rostersSheet.getRange(rRow, colIndex).setValue("");
    var mData = managersSheet.getDataRange().getValues();
    for (var k = 1; k < mData.length; k++) {
      if (String(mData[k][0]).toLowerCase() === String(managerId).toLowerCase()) {
        var currentBud = parseFloat(mData[k][2]) || 0;
        managersSheet.getRange(k + 1, 3).setValue(currentBud + instantValue);
        break;
      }
    }

    txSheet.appendRow([new Date(), 'SELL', managerId, playerName + " (INSTANT)", instantValue]);
    return { success: true, msg: "Vendido por " + formatMoneyBack(instantValue) + " (50% de su valor)." };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// Ã°Å¸â€Âµ PONER EN EL MERCADO (VALOR PERSONALIZADO)
function listPlayerOnMarket(managerId, roleKey, customPrice) {
  try {
    var ss = SpreadsheetApp.getActive();
    var marketSheet = ss.getSheetByName("Fantasy_Market");
    var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
    
    var rData = rostersSheet.getDataRange().getValues();
    var colMap = { "top": 2, "jgl": 3, "mid": 4, "adc": 5, "sup": 6, "sub": 9 };
    var colIndex = colMap[roleKey.toLowerCase()];
    
    var rRow = -1; var playerName = "";
    for (var i = 1; i < rData.length; i++) {
      if (String(rData[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        if (rData[i][9] === true || String(rData[i][9]).toUpperCase() === "TRUE") return { success: false, error: "Equipo bloqueado." };
        rRow = i + 1; playerName = rData[i][colIndex - 1]; break;
      }
    }

    // Buscamos el rol para el mercado
    var roleLabel = "FLEX";
    for(var key in colMap){ if(colMap[key] === colIndex) roleLabel = key.toUpperCase(); }

    // AÃƒÂ±adir al mercado y quitar del roster
    marketSheet.appendRow([playerName, roleLabel, customPrice, "Vendedor: " + managerId]);
    rostersSheet.getRange(rRow, colIndex).setValue("");

    return { success: true, msg: playerName + " puesto a la venta por " + formatMoneyBack(customPrice) };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function setManagerCaptain(managerId, roleLabel) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fantasy_Rosters");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        if (data[i][9] === true || String(data[i][9]).toUpperCase() === "TRUE") return { success: false, error: "Equipo bloqueado." };
        sheet.getRange(i + 1, 7).setValue(roleLabel); 
        return { success: true, msg: "CapitÃƒÂ¡n actualizado a " + roleLabel };
      }
    }
    return { success: false, error: "Tu equipo no existe." };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function payClause(buyerId, targetName) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { success: false, error: "Sistema ocupado." };
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var mSheet = ss.getSheetByName("Fantasy_Managers");
    var rSheet = ss.getSheetByName("Fantasy_Rosters");
    var txSheet = ss.getSheetByName("Fantasy_Transactions");
    if (!txSheet) { txSheet = ss.insertSheet("Fantasy_Transactions"); txSheet.appendRow(["Date", "Type", "Manager", "Player", "Amount"]); }
    
    var cBuy = String(buyerId).trim().toLowerCase();
    var cPlay = String(targetName).trim().toLowerCase();
    
    // Ã°Å¸Å¸Â¢ Extraemos precio real calculado
    var statsResponse = getTournamentStatsForWeb('ALL');
    var allPlayers = statsResponse.stats || [];
    var pData = allPlayers.find(function(x) { return x.name.toLowerCase() === cPlay; });
    
    var basePrice = getFantasyPlayerPrice(pData);
    var cost = Math.round(basePrice * 1.5); // Paga el 150% del valor
    
    var mData = mSheet.getDataRange().getValues();
    var buyRow = -1, buyBud = 0;
    for(var j=1; j<mData.length; j++) { if(String(mData[j][0]).trim().toLowerCase() === cBuy) { buyRow = j+1; buyBud = parseFloat(mData[j][2])||0; break; } }
    if (buyBud < cost) return { success: false, error: "Necesitas " + formatMoneyBack(cost) };
    
    var rData = rSheet.getDataRange().getValues();
    var sellRow = -1, sellCol = -1, sellName = "";
    
    for(var r=1; r<rData.length; r++) {
      for(var c=1; c<=8; c++) { 
        if([1,2,3,4,5,8].includes(c) && String(rData[r][c]).trim().toLowerCase() === cPlay) {
          if(String(rData[r][0]).trim().toLowerCase() === cBuy) return { success: false, error: "Ya es tuyo." };
          sellRow = r+1; sellCol = c+1; sellName = String(rData[r][0]); break;
        }
      }
      if(sellRow !== -1) break;
    }
    if (sellRow === -1) return { success: false, error: "CÃƒÂ³mpralo en el mercado normal." };
    
    var buyerRosterRow = -1;
    for(var b=1; b<rData.length; b++) { if(String(rData[b][0]).trim().toLowerCase() === cBuy) { buyerRosterRow = b+1; break; } }
    
    rSheet.getRange(sellRow, sellCol).setValue("");
    rSheet.getRange(buyerRosterRow, sellCol).setValue(targetName);
    mSheet.getRange(buyRow, 3).setValue(buyBud - cost);
    
    var comp = Math.round(basePrice * 1.2); // La vÃƒÂ­ctima cobra un 120% del valor real (no el 150% para que duela robar)
    for(var m=1; m<mData.length; m++) {
      if(String(mData[m][0]).trim().toLowerCase() === sellName.toLowerCase()) {
        mSheet.getRange(m+1, 3).setValue((parseFloat(mData[m][2])||0) + comp); break;
      }
    }
    txSheet.appendRow([new Date(), 'CLAUSE', buyerId, targetName, cost]);
    return { success: true, msg: "Clausulazo completado por " + formatMoneyBack(cost) + ".\n" + sellName + " recibe " + formatMoneyBack(comp), newBudget: buyBud - cost };
  } catch(e) { return { success: false, error: e.message }; } finally { lock.releaseLock(); }
}

function buyGachaBox(managerId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName("Fantasy_Inventory");
  if (!invSheet) { invSheet = ss.insertSheet("Fantasy_Inventory"); invSheet.appendRow(["Manager_ID", "Card_Name", "Rarity", "Description", "Status"]); }
  var txSheet = ss.getSheetByName("Fantasy_Transactions");
  if (!txSheet) { txSheet = ss.insertSheet("Fantasy_Transactions"); txSheet.appendRow(["Date", "Type", "Manager", "Player", "Amount"]); }
  var mSheet = ss.getSheetByName("Fantasy_Managers");
  
  var mData = mSheet.getDataRange().getValues();
  var mRow = -1, budget = 0, cost = 500000;
  for (var i = 1; i < mData.length; i++) {
    if (String(mData[i][0]).toLowerCase() === String(managerId).toLowerCase()) { mRow = i + 1; budget = parseFloat(mData[i][2]); break; }
  }
  if (budget < cost) return { success: false, error: "No tienes 500.000 Ã¢â€šÂ¬ para el sobre." };
  
  // Ã°Å¸Æ’Â LA NUEVA COLECCIÃƒâ€œN DE CARTAS
  var pool = [
    // ECONOMÃƒÂA
    { name: "Bolsa de Monedas", desc: "InstantÃƒÂ¡nea: Al activarla recibes 250.000 Ã¢â€šÂ¬ directos a tu caja. (No ocupa hueco de carta)", rarity: "ComÃƒÂºn", weight: 60 },
    { name: "Cofre de Oro", desc: "InstantÃƒÂ¡nea: Al activarla recibes 750.000 Ã¢â€šÂ¬ directos a tu caja. (No ocupa hueco de carta)", rarity: "Rara", weight: 30 },
    { name: "MaletÃƒÂ­n de Faker", desc: "InstantÃƒÂ¡nea: Al activarla recibes 2.000.000 Ã¢â€šÂ¬ directos a tu caja. (No ocupa hueco de carta)", rarity: "Legendaria", weight: 5 },
    // BOOSTERS DE LÃƒÂNEA
    { name: "Entrenamiento de TOP", desc: "Equipable: Tu TOP puntÃƒÂºa un +20% adicional esta jornada.", rarity: "ComÃƒÂºn", weight: 40 },
    { name: "Entrenamiento de JGL", desc: "Equipable: Tu JUNGLE puntÃƒÂºa un +20% adicional esta jornada.", rarity: "ComÃƒÂºn", weight: 40 },
    { name: "Entrenamiento de MID", desc: "Equipable: Tu MIDDLE puntÃƒÂºa un +20% adicional esta jornada.", rarity: "ComÃƒÂºn", weight: 40 },
    { name: "Entrenamiento de ADC", desc: "Equipable: Tu BOTTOM puntÃƒÂºa un +20% adicional esta jornada.", rarity: "ComÃƒÂºn", weight: 40 },
    { name: "Entrenamiento de SUP", desc: "Equipable: Tu SUPPORT puntÃƒÂºa un +20% adicional esta jornada.", rarity: "ComÃƒÂºn", weight: 40 },
    // MISIONES TÃƒÂCTICAS
    { name: "MisiÃƒÂ³n: Muro de Escudos", desc: "Equipable: Si NINGÃƒÅ¡N jugador de tu alineaciÃƒÂ³n puntÃƒÂºa en negativo, ganas +15 Pts extra.", rarity: "Ãƒâ€°pica", weight: 20 },
    { name: "MisiÃƒÂ³n: El Dream Team", desc: "Equipable: Si tu equipo base supera los 80 puntos, ganas +25 Pts extra masivos.", rarity: "Ãƒâ€°pica", weight: 20 },
    // LOCURAS LEGENDARIAS
    { name: "PociÃƒÂ³n del Gigante", desc: "Equipable: Tu CapitÃƒÂ¡n puntÃƒÂºa x2.5 en lugar de x1.25 esta jornada.", rarity: "Legendaria", weight: 10 },
    { name: "Contrato Bilateral", desc: "Equipable: Tu jugador con MENOS puntos esta jornada igualarÃƒÂ¡ los puntos de tu CapitÃƒÂ¡n.", rarity: "Legendaria", weight: 5 }
  ];
  
  var totalWeight = pool.reduce(function(sum, c) { return sum + c.weight; }, 0);
  var random = Math.random() * totalWeight; var card = pool[0];
  for (var j = 0; j < pool.length; j++) { if (random < pool[j].weight) { card = pool[j]; break; } random -= pool[j].weight; }
  
  mSheet.getRange(mRow, 3).setValue(budget - cost);
  invSheet.appendRow([managerId, card.name, card.rarity, card.desc, "UNUSED"]);
  txSheet.appendRow([new Date(), 'GACHA', managerId, card.name, cost]);
  return { success: true, newBudget: budget - cost, card: card };
}

function activateFantasyCard(managerId, cardName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rSheet = ss.getSheetByName("Fantasy_Rosters");
    var iSheet = ss.getSheetByName("Fantasy_Inventory");
    var mSheet = ss.getSheetByName("Fantasy_Managers");
    
    // Buscar la carta en el inventario
    var iData = iSheet.getDataRange().getValues();
    var iRowNew = -1; 
    for (var j = 1; j < iData.length; j++) {
      if (String(iData[j][0]).toLowerCase() === String(managerId).toLowerCase() && String(iData[j][1]) === cardName && String(iData[j][4]) === "UNUSED") {
          iRowNew = j + 1; break;
      }
    }
    if (iRowNew === -1) return { success: false, error: "Carta no encontrada o ya usada." };

    // Ã°Å¸Å¸Â¢ LÃƒâ€œGICA DE CARTAS INSTANTÃƒÂNEAS (DINERO)
    var isInstant = cardName.includes("Bolsa de Monedas") || cardName.includes("Cofre de Oro") || cardName.includes("MaletÃƒÂ­n de Faker");
    
    if (isInstant) {
        var mData = mSheet.getDataRange().getValues();
        for (var m = 1; m < mData.length; m++) {
            if (String(mData[m][0]).toLowerCase() === String(managerId).toLowerCase()) {
                var bud = parseFloat(mData[m][2]) || 0;
                var reward = 0;
                if (cardName === "Bolsa de Monedas") reward = 250000;
                else if (cardName === "Cofre de Oro") reward = 750000;
                else if (cardName === "MaletÃƒÂ­n de Faker") reward = 2000000;
                
                mSheet.getRange(m + 1, 3).setValue(bud + reward);
                iSheet.getRange(iRowNew, 5).setValue("CONSUMED"); // Desaparece del inventario
                return { success: true, msg: "Ã‚Â¡Dinero inyectado! Has recibido " + parseInt(reward).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Ã¢â€šÂ¬." };
            }
        }
    }

    // Ã°Å¸Å¸Â¢ LÃƒâ€œGICA DE CARTAS EQUIPABLES (EL RESTO)
    var rData = rSheet.getDataRange().getValues();
    var rRow = -1; var currentActiveCard = "";
    for (var i = 1; i < rData.length; i++) {
      if (String(rData[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        rRow = i + 1;
        if (rData[i][9] === true || String(rData[i][9]).toUpperCase() === "TRUE") {
           return { success: false, error: "El equipo estÃƒÂ¡ bloqueado. No puedes cambiar cartas." };
        }
        currentActiveCard = rData[i][10] || ""; break;
      }
    }
    if (rRow === -1) return { success: false, error: "Roster no encontrado." };

    // Devolver la vieja al inventario si ya tenÃƒÂ­a una
    if (currentActiveCard) {
        for (var o = 1; o < iData.length; o++) {
            if (String(iData[o][0]).toLowerCase() === String(managerId).toLowerCase() && String(iData[o][1]) === currentActiveCard && String(iData[o][4]) === "ACTIVE") {
                iSheet.getRange(o + 1, 5).setValue("UNUSED"); break;
            }
        }
    }

    iSheet.getRange(iRowNew, 5).setValue("ACTIVE"); 
    rSheet.getRange(rRow, 11).setValue(cardName);
    return { success: true, msg: "Carta '" + cardName + "' equipada en tu plantilla." };
  } catch(e) { return { success: false, error: e.message }; }
}

// Ã°Å¸â€â„¢ DESEQUIPAR CARTA (DEVOLVER AL INVENTARIO)
function unequipFantasyCard(managerId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rSheet = ss.getSheetByName("Fantasy_Rosters");
    var iSheet = ss.getSheetByName("Fantasy_Inventory");
    var rData = rSheet.getDataRange().getValues();
    var rRow = -1; var currentActiveCard = "";

    for (var i = 1; i < rData.length; i++) {
      if (String(rData[i][0]).toLowerCase() === String(managerId).toLowerCase()) {
        rRow = i + 1;
        if (rData[i][9] === true || String(rData[i][9]).toUpperCase() === "TRUE") return { success: false, error: "El equipo estÃƒÂ¡ bloqueado." };
        currentActiveCard = rData[i][10] || ""; break;
      }
    }
    if (rRow === -1 || !currentActiveCard) return { success: false, error: "No hay carta activa." };

    var iData = iSheet.getDataRange().getValues();
    for (var j = 1; j < iData.length; j++) {
      if (String(iData[j][0]).toLowerCase() === String(managerId).toLowerCase() && String(iData[j][1]) === currentActiveCard && String(iData[j][4]) === "ACTIVE") {
          iSheet.getRange(j + 1, 5).setValue("UNUSED"); break;
      }
    }
    rSheet.getRange(rRow, 11).setValue("");
    return { success: true, msg: "Carta desequipada. Vuelve a estar en tu inventario." };
  } catch(e) { return { success: false, error: e.message }; }
}

// Ã°Å¸Å¡Â¨ CERRAR ALINEACIONES (MARTES 08:00) Y PENALIZAR HUECOS (-15 PTS)
function autoLockTeamsWeekly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
  var managersSheet = ss.getSheetByName("Fantasy_Managers");
  var histSheet = ss.getSheetByName("Fantasy_History");
  if (!histSheet) { histSheet = ss.insertSheet("Fantasy_History"); histSheet.appendRow(["Date", "Manager_ID", "Points", "Budget"]); }
  
  var rData = rostersSheet.getDataRange().getValues();
  var mData = managersSheet.getDataRange().getValues();
  
  for (var i = 1; i < rData.length; i++) {
      if (!rData[i][0]) continue;
      var managerId = String(rData[i][0]);
      var emptySlots = 0;
      
      // Chequeamos los 5 huecos titulares (columnas 2 a 6)
      for (var c = 1; c <= 5; c++) {
          if (!rData[i][c] || String(rData[i][c]).trim() === "") emptySlots++;
      }
      
      var penalty = emptySlots * 15; // 15 puntos por cada hueco vacÃƒÂ­o
      if (penalty > 0) {
          for (var m = 1; m < mData.length; m++) {
              if (String(mData[m][0]).trim().toLowerCase() === managerId.toLowerCase()) {
                  var currentPts = parseFloat(mData[m][3]) || 0;
                  var currentBud = parseFloat(mData[m][2]) || 0;
                  var newPts = currentPts - penalty;
                  managersSheet.getRange(m+1, 4).setValue(newPts);
                  histSheet.appendRow([new Date(), managerId, newPts, currentBud]);
                  break;
              }
          }
      }
      rostersSheet.getRange(i+1, 10).setValue(true); // Bloqueamos el equipo
  }
  return "Todos los equipos bloqueados. Penalizaciones aplicadas.";
}

// Ã¢ÂÂ° CONFIGURAR RELOJES AUTOMÃƒÂTICOS DEL SERVIDOR
function setupFantasyTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'resolveMarketBids' || fn === 'weeklyFantasyReset' || fn === 'autoLockTeamsWeekly' || fn === 'payFantasyRound') {
        ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Mercado a medianoche todos los dÃƒÂ­as
  ScriptApp.newTrigger('resolveMarketBids').timeBased().everyDays(1).atHour(0).nearMinute(5).create();
  
  // Bloquear equipos el Martes a las 08:00 AM
  ScriptApp.newTrigger('autoLockTeamsWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(8).create();
  
  // Pagar ronda y desbloquear equipos el Domingo a las 23:55 (casi Lunes)
  ScriptApp.newTrigger('payFantasyRound').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(23).nearMinute(55).create();
  
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Temporizadores configurados: Cierre Martes 08:00 / Pagos Domingo 23:55");
}

function getManagerInventory(managerId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Fantasy_Inventory");
    if (!sheet) {
      sheet = ss.insertSheet("Fantasy_Inventory");
      sheet.appendRow(["Manager_ID", "Card_Name", "Rarity", "Description", "Status"]);
      return { success: true, cards: [] };
    }
    var data = sheet.getDataRange().getValues();
    var cards = []; var searchId = String(managerId).trim().toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === searchId && String(data[i][4]).trim() === "UNUSED") {
        cards.push({ name: String(data[i][1]), rarity: String(data[i][2]), desc: String(data[i][3]), status: "UNUSED" });
      }
    }
    return { success: true, cards: cards };
  } catch(e) { return { success: false, error: e.toString() }; }
}

function resolveMarketBids() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bidsSheet = ss.getSheetByName("Fantasy_Bids");
  var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
  var managersSheet = ss.getSheetByName("Fantasy_Managers");
  var marketSheet = ss.getSheetByName("Fantasy_Market");
  var txSheet = ss.getSheetByName("Fantasy_Transactions");
  if (!txSheet) { txSheet = ss.insertSheet("Fantasy_Transactions"); txSheet.appendRow(["Date", "Type", "Manager", "Player", "Amount"]); }

  var bidsData = bidsSheet.getDataRange().getValues();
  if (bidsData.length <= 1) { generateDailyMarket(); return "Mercado rotado sin pujas."; }
  
  var bidsByPlayer = {};
  for (var i = 1; i < bidsData.length; i++) {
    var mName = String(bidsData[i][0]).trim();
    var pName = String(bidsData[i][1]).trim();
    var bidAmt = parseFloat(bidsData[i][2]);
    if (!bidsByPlayer[pName]) bidsByPlayer[pName] = [];
    bidsByPlayer[pName].push({ manager: mName, bid: bidAmt });
  }
  
  var rostersData = rostersSheet.getDataRange().getValues();
  var managersData = managersSheet.getDataRange().getValues();
  var marketData = marketSheet.getDataRange().getValues();
  var refunds = {}; 
  
  for (var player in bidsByPlayer) {
    var playerBids = bidsByPlayer[player];
    playerBids.sort(function(a, b) { return b.bid - a.bid; });
    var winner = playerBids[0]; 
    
    // Ã°Å¸Å¸Â¢ DICCIONARIO BLINDADO CONTRA ERRORES DE ROL
    var role = "SUB"; 
    var colMap = { "TOP": 2, "JUNGLE": 3, "JGL": 3, "MIDDLE": 4, "MID": 4, "BOTTOM": 5, "ADC": 5, "SUPPORT": 6, "SUP": 6, "UTILITY": 6 };
    
    for (var k = 1; k < marketData.length; k++) {
      if (String(marketData[k][0]).toLowerCase() === String(player).toLowerCase()) {
        var mRole = String(marketData[k][1]).toUpperCase();
        if (colMap[mRole]) role = mRole; break;
      }
    }
    
    var rIndex = -1;
    for (var r = 1; r < rostersData.length; r++) {
      if (String(rostersData[r][0]).toLowerCase() === String(winner.manager).toLowerCase()) { rIndex = r + 1; break; }
    }
    
    if (rIndex !== -1) {
      var targetCol = colMap[role] || 9; // Si el rol es rarÃƒÂ­simo, lo manda al banquillo (9)
      var currentStarter = rostersSheet.getRange(rIndex, targetCol).getValue();
      
      if (currentStarter && currentStarter !== "") {
          var currentSub = rostersSheet.getRange(rIndex, 9).getValue();
          if (!currentSub || currentSub === "") rostersSheet.getRange(rIndex, 9).setValue(player);
          else rostersSheet.getRange(rIndex, targetCol).setValue(player);
      } else {
          rostersSheet.getRange(rIndex, targetCol).setValue(player);
      }
      txSheet.appendRow([new Date(), 'BUY', winner.manager, player, winner.bid]);
    }
    
    for (var idx = 1; idx < playerBids.length; idx++) {
      var loser = playerBids[idx];
      if (!refunds[loser.manager]) refunds[loser.manager] = 0;
      refunds[loser.manager] += loser.bid;
    }
  }
  
  for (var m = 1; m < managersData.length; m++) {
    var manName = String(managersData[m][0]).trim();
    if (refunds[manName]) {
      var currentB = parseFloat(managersData[m][2]) || 0;
      managersSheet.getRange(m + 1, 3).setValue(currentB + refunds[manName]);
      txSheet.appendRow([new Date(), 'REFUND', manName, 'Puja Perdida', refunds[manName]]);
    }
  }
  
  bidsSheet.getRange(2, 1, bidsData.length, 3).clearContent();
  generateDailyMarket();
  return "Subastas resueltas.";
}

function payFantasyRound() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var managersSheet = ss.getSheetByName("Fantasy_Managers");
  var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
  var txSheet = ss.getSheetByName("Fantasy_Transactions");
  var rankingSheet = ss.getSheetByName("RANKING"); 
  var histSheet = ss.getSheetByName("Fantasy_History");
  if (!histSheet) { histSheet = ss.insertSheet("Fantasy_History"); histSheet.appendRow(["Date", "Manager_ID", "Points", "Budget"]); }
  
  var mData = managersSheet.getDataRange().getValues();
  var rData = rostersSheet.getDataRange().getValues();
  var rankData = rankingSheet.getDataRange().getValues();

  var playerPts = {};
  for (var i = 1; i < rankData.length; i++) {
      var pName = String(rankData[i][0]).trim().toLowerCase();
      if (pName) playerPts[pName] = Number(rankData[i][1]) || 0;
  }

  var roundResults = [];
  var moneyPerPoint = 25000; // Ã°Å¸â€™Â¸ Valor del punto en Ã¢â€šÂ¬

  for (var i = 1; i < mData.length; i++) {
      var manager = String(mData[i][0]).trim();
      if (!manager) continue;
      
      var currentBudget = parseFloat(mData[i][2]) || 0;
      var currentTotalPoints = parseFloat(mData[i][3]) || 0;
      var roundPoints = 0;

      for (var j = 1; j < rData.length; j++) {
          if (String(rData[j][0]).trim() === manager) {
              var capRole = String(rData[j][6]).toUpperCase();
              var activeCard = String(rData[j][10]).trim(); // Ã°Å¸Æ’Â Leemos la carta equipada
              var roleNames = ["", "TOP", "JGL", "MID", "ADC", "SUP"];
              
              var teamPtsArr = [];
              var capPts = 0;
              var noNegatives = true;

              for (var r = 1; r <= 5; r++) {
                  var pName = String(rData[j][r]).trim().toLowerCase();
                  if (pName && playerPts[pName] !== undefined) {
                      var pts = playerPts[pName];
                      
                      // Ã°Å¸Å¡Â¨ PENALIZACIÃƒâ€œN FUERA DE POSICIÃƒâ€œN (OOP)
                      var isOOP = false;
                      var slot = roleNames[r]; 
                      var statsResponse = getTournamentStatsForWeb('ALL');
                      var pData = (statsResponse.stats || []).find(function(x){ return x.name.toLowerCase() === pName; });
                      var actualRole = pData && pData.role ? pData.role.toUpperCase() : "FILL";
                      
                      if (slot === "TOP" && !actualRole.includes("TOP")) isOOP = true;
                      if (slot === "JGL" && !actualRole.includes("JUNG") && actualRole !== "JGL") isOOP = true;
                      if (slot === "MID" && !actualRole.includes("MID")) isOOP = true;
                      if (slot === "ADC" && !actualRole.includes("BOT") && actualRole !== "ADC") isOOP = true;
                      if (slot === "SUP" && !actualRole.includes("SUP") && !actualRole.includes("UTIL")) isOOP = true;

                      if (isOOP) pts = pts * 0.20; // Pierde el 80% de sus puntos

                      // Ã°Å¸Æ’Â CARTAS: BOOSTERS DE ROL
                      if (activeCard === "Entrenamiento de TOP" && slot === "TOP") pts *= 1.20;
                      if (activeCard === "Entrenamiento de JGL" && slot === "JGL") pts *= 1.20;
                      if (activeCard === "Entrenamiento de MID" && slot === "MID") pts *= 1.20;
                      if (activeCard === "Entrenamiento de ADC" && slot === "ADC") pts *= 1.20;
                      if (activeCard === "Entrenamiento de SUP" && slot === "SUP") pts *= 1.20;

                      // Ã°Å¸â€˜â€˜ MULTIPLICADOR DE CAPITÃƒÂN
                      var capMult = 1.25;
                      if (activeCard === "PociÃƒÂ³n del Gigante") capMult = 2.5; // Ã°Å¸Æ’Â CARTA LEGENDARIA

                      if (slot === capRole) {
                          pts = pts > 0 ? pts * capMult : pts * 2.0; 
                          capPts = pts;
                      }

                      if (pts < 0) noNegatives = false;
                      teamPtsArr.push({role: slot, pts: pts});
                      roundPoints += pts;
                  }
              }

              // Ã°Å¸Æ’Â RESOLUCIÃƒâ€œN DE MISIONES Y CARTAS ESPECIALES AL FINALIZAR LA SUMA
              if (activeCard === "MisiÃƒÂ³n: El Dream Team" && roundPoints >= 80) roundPoints += 25;
              if (activeCard === "MisiÃƒÂ³n: Muro de Escudos" && noNegatives && teamPtsArr.length === 5) roundPoints += 15;
              
              if (activeCard === "Contrato Bilateral" && teamPtsArr.length > 0 && capPts > 0) {
                  teamPtsArr.sort(function(a,b) { return a.pts - b.pts; });
                  var lowest = teamPtsArr[0];
                  var diff = capPts - lowest.pts;
                  if (diff > 0) roundPoints += diff; // El peor sube e iguala al capitÃƒÂ¡n
              }
              
              // Quemar la carta activa del inventario y del roster
              if (activeCard !== "") {
                  var invSheet = ss.getSheetByName("Fantasy_Inventory");
                  var iData = invSheet.getDataRange().getValues();
                  for (var inv = 1; inv < iData.length; inv++) {
                      if (String(iData[inv][0]).toLowerCase() === manager.toLowerCase() && String(iData[inv][1]) === activeCard && String(iData[inv][4]) === "ACTIVE") {
                          invSheet.getRange(inv + 1, 5).setValue("CONSUMED"); // Destruye la carta
                          break;
                      }
                  }
                  rostersSheet.getRange(j, 11).setValue(""); // Limpia el slot
              }
              break;
          }
      }
      
      // REPARTO FINAL
      var prize = Math.max(0, Math.round(roundPoints * moneyPerPoint));
      var newBudget = currentBudget + prize;
      var finalPoints = currentTotalPoints + roundPoints;

      managersSheet.getRange(i, 3).setValue(newBudget);
      managersSheet.getRange(i, 4).setValue(finalPoints);
      
      txSheet.appendRow([new Date(), 'REWARD', manager, roundPoints.toFixed(1) + ' Pts ganados', prize]);
      histSheet.appendRow([new Date(), manager, finalPoints, newBudget]);
  }
  
  // Desbloqueamos los equipos
  for (var r = 1; r < rData.length; r++) {
     if (rData[r][0]) rostersSheet.getRange(r + 1, 10).setValue(false); 
  }
  return "Jornada procesada. Cartas consumidas y pagos realizados.";
}

function weeklyFantasyReset() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
    if (!rostersSheet || rostersSheet.getLastRow() < 2) return;
    var rData = rostersSheet.getDataRange().getValues();
    for (var i = 1; i < rData.length; i++) {
      if (rData[i][0]) {
        rostersSheet.getRange(i + 1, 10).setValue(false);
        rostersSheet.getRange(i + 1, 11).setValue("");
      }
    }
    generateDailyMarket(); 
  } catch(e) { }
}

function setupFantasyTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'resolveMarketBids' || fn === 'weeklyFantasyReset') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('resolveMarketBids').timeBased().everyDays(1).atHour(0).nearMinute(5).create();
  ScriptApp.newTrigger('weeklyFantasyReset').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(1).create();
  SpreadsheetApp.getUi().alert("Ã¢Å“â€¦ Triggers Fantasy configurados.");
}

// Ã°Å¸â€˜ÂÃ¯Â¸Â OBTENER ROSTER DE UN RIVAL (PARA EL RANKING)
function getManagerRoster(managerName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rSheet = ss.getSheetByName("Fantasy_Rosters");
    var rData = rSheet.getDataRange().getValues();
    
    for (var i = 1; i < rData.length; i++) {
      if (String(rData[i][0]).trim().toLowerCase() === String(managerName).trim().toLowerCase()) {
        return { 
          success: true, 
          roster: { top: rData[i][1], jgl: rData[i][2], mid: rData[i][3], adc: rData[i][4], sup: rData[i][5], sub: rData[i][8] }
        };
      }
    }
    return { success: false, error: "Plantilla no encontrada." };
  } catch(e) { return { success: false, error: e.toString() }; }
}

// Ã°Å¸â€â€ž INTERCAMBIAR POSICIONES EN EL ROSTER (Drag & Drop)
function swapPlayers(managerId, roleA, roleB) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Fantasy_Rosters");
    var data = sheet.getDataRange().getValues();
    var colMap = { "top": 2, "jgl": 3, "mid": 4, "adc": 5, "sup": 6, "sub": 9 };
    var colA = colMap[roleA.toLowerCase()];
    var colB = colMap[roleB.toLowerCase()];
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(managerId).trim().toLowerCase()) {
        if (data[i][9] === true || String(data[i][9]).toUpperCase() === "TRUE") return { success: false, error: "Equipo bloqueado." };
        var valA = data[i][colA - 1] || "";
        var valB = data[i][colB - 1] || "";
        sheet.getRange(i + 1, colA).setValue(valB);
        sheet.getRange(i + 1, colB).setValue(valA);
        return { success: true, msg: "Posiciones intercambiadas." };
      }
    }
    return { success: false, error: "MÃƒÂ¡nager no encontrado." };
  } catch (e) { return { success: false, error: e.message }; }
}

// Ã°Å¸Å¡Â¨ CERRAR ALINEACIONES EL LUNES A LA NOCHE Y PENALIZAR HUECOS (-15 PTS)
function autoLockTeamsWeekly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rostersSheet = ss.getSheetByName("Fantasy_Rosters");
  var managersSheet = ss.getSheetByName("Fantasy_Managers");
  var histSheet = ss.getSheetByName("Fantasy_History");
  if (!histSheet) { histSheet = ss.insertSheet("Fantasy_History"); histSheet.appendRow(["Date", "Manager_ID", "Points", "Budget"]); }
  
  var rData = rostersSheet.getDataRange().getValues();
  var mData = managersSheet.getDataRange().getValues();
  
  for (var i = 1; i < rData.length; i++) {
      if (!rData[i][0]) continue;
      var managerId = String(rData[i][0]);
      var emptySlots = 0;
      
      // Chequeamos los 5 huecos titulares (columnas 2 a 6)
      for (var c = 1; c <= 5; c++) {
          if (!rData[i][c] || String(rData[i][c]).trim() === "") emptySlots++;
      }
      
      var penalty = emptySlots * 15;
      
      if (penalty > 0) {
          for (var m = 1; m < mData.length; m++) {
              if (String(mData[m][0]).trim().toLowerCase() === managerId.toLowerCase()) {
                  var currentPts = parseFloat(mData[m][3]) || 0;
                  var currentBud = parseFloat(mData[m][2]) || 0;
                  var newPts = currentPts - penalty;
                  managersSheet.getRange(m+1, 4).setValue(newPts);
                  histSheet.appendRow([new Date(), managerId, newPts, currentBud]);
                  break;
              }
          }
      }
      // Bloqueamos el equipo
      rostersSheet.getRange(i+1, 10).setValue(true);
  }
  return "Todos los equipos bloqueados. Se han restado 15 puntos por cada hueco vacÃƒÂ­o.";
}


// ==========================================
// Ã°Å¸Å½Â° CASINO Y APUESTAS DE LA LIGA (WG COINS)
// ==========================================

function getWalletBalance(summonerName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var walletSheet = ss.getSheetByName("Liga_Wallets");
    if (!walletSheet) { 
        walletSheet = ss.insertSheet("Liga_Wallets"); 
        walletSheet.appendRow(["Summoner", "Balance"]); 
    }
    
    var data = walletSheet.getDataRange().getValues();
    var sName = String(summonerName).trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === sName) {
        return { success: true, balance: parseFloat(data[i][1]) };
      }
    }
    // Si es un usuario nuevo, le regalamos 1.000 WG Coins de bienvenida
    walletSheet.appendRow([summonerName, 1000]);
    return { success: true, balance: 1000, msg: "Ã‚Â¡Bienvenido! Has recibido 1.000 WG Coins iniciales." };
  } catch(e) { return { success: false, error: e.message }; }
}

function placeLeagueBet(summonerName, matchId, teamIndex, amount, odds) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var walletSheet = ss.getSheetByName("Liga_Wallets");
    var betSheet = ss.getSheetByName("Liga_Bets");
    
    if (!betSheet) { 
        betSheet = ss.insertSheet("Liga_Bets"); 
        betSheet.appendRow(["Date", "Summoner", "MatchID", "TeamIndex", "Amount", "Odds", "Status"]); 
    }
    
    var sName = String(summonerName).trim().toLowerCase();
    var wData = walletSheet.getDataRange().getValues();
    var wRow = -1; var balance = 0;
    
    for (var i = 1; i < wData.length; i++) {
      if (String(wData[i][0]).trim().toLowerCase() === sName) {
        wRow = i + 1; balance = parseFloat(wData[i][1]); break;
      }
    }
    
    if (wRow === -1) return { success: false, error: "Cartera no encontrada." };
    if (balance < amount) return { success: false, error: "No tienes suficientes WG Coins." };
    if (amount <= 0) return { success: false, error: "La apuesta debe ser mayor a 0." };
    
    // Descontar saldo
    walletSheet.getRange(wRow, 2).setValue(balance - amount);
    
    // Registrar apuesta
    betSheet.appendRow([new Date(), summonerName, matchId, teamIndex, amount, odds, "PENDING"]);
    
    return { success: true, newBalance: balance - amount, msg: "Ã‚Â¡Apuesta registrada! Posible ganancia: " + Math.floor(amount * odds) + " Ã°Å¸Âªâ„¢" };
  } catch(e) { return { success: false, error: e.message }; }
}


// ==========================================
// Ã°Å¸Â¤â€˜ RANKING DEL CASINO (LOS MÃƒÂS RICOS)
// ==========================================
function getCasinoRanking() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var walletSheet = ss.getSheetByName("Liga_Wallets");
    var betSheet = ss.getSheetByName("Liga_Bets");
    
    if (!walletSheet) return []; // Si nadie ha entrado aÃƒÂºn al casino
    
    var wallets = walletSheet.getDataRange().getValues();
    var bets = betSheet ? betSheet.getDataRange().getValues() : [];

    var userStats = {};
    
    // 1. Recopilar saldos base
    for (var i = 1; i < wallets.length; i++) {
       var name = String(wallets[i][0]).trim();
       if (name) {
           userStats[name] = { 
               name: name, 
               balance: parseFloat(wallets[i][1]) || 0, 
               betsWon: 0, 
               betsResolved: 0, 
               totalWon: 0 
           };
       }
    }

    // 2. Analizar historial de apuestas
    for (var j = 1; j < bets.length; j++) {
       var bName = String(bets[j][1]).trim();
       var amount = parseFloat(bets[j][4]) || 0;
       var odds = parseFloat(bets[j][5]) || 0;
       var status = String(bets[j][6]).toUpperCase(); // "WON", "LOST", "PENDING"

       if (bName && userStats[bName]) {
           if (status === "WON" || status === "LOST") {
               userStats[bName].betsResolved++;
               if (status === "WON") {
                   userStats[bName].betsWon++;
                   userStats[bName].totalWon += Math.floor(amount * odds); // Ganancia bruta
               }
           }
       }
    }

    // 3. Formatear para enviar a la web
    var ranking = Object.keys(userStats).map(function(k) {
       var u = userStats[k];
       u.winRate = u.betsResolved > 0 ? (u.betsWon / u.betsResolved) * 100 : 0;
       return u;
    });

    return ranking;
  } catch(e) { return []; }
}

// ==========================================
// Ã°Å¸â€™Â¸ MOTOR DE PAGOS DEL CASINO
// ==========================================

function payoutLeagueBets(matchId, winningTeamIndex) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var betSheet = ss.getSheetByName("Liga_Bets");
    var walletSheet = ss.getSheetByName("Liga_Wallets");
    
    if (!betSheet || !walletSheet) return;
    
    var bData = betSheet.getDataRange().getValues();
    var wData = walletSheet.getDataRange().getValues();
    
    // Crear un mapa de las carteras para actualizar rÃƒÂ¡pido
    var wallets = {};
    for (var i = 1; i < wData.length; i++) {
      wallets[String(wData[i][0]).toLowerCase()] = { row: i + 1, balance: parseFloat(wData[i][1]) };
    }

    for (var j = 1; j < bData.length; j++) {
      // Si la apuesta es de este partido y estÃƒÂ¡ pendiente
      if (String(bData[j][2]) === String(matchId) && bData[j][6] === "PENDING") {
        var user = String(bData[j][1]).toLowerCase();
        var betTeamIndex = parseInt(bData[j][3]);
        var amount = parseFloat(bData[j][4]);
        var odds = parseFloat(bData[j][5]);
        
        if (betTeamIndex === winningTeamIndex) {
          // Ã°Å¸â€™Â° GANÃƒâ€œ: Calculamos premio y actualizamos cartera
          var prize = Math.floor(amount * odds);
          if (wallets[user]) {
            wallets[user].balance += prize;
            walletSheet.getRange(wallets[user].row, 2).setValue(wallets[user].balance);
          }
          betSheet.getRange(j + 1, 7).setValue("WON");
        } else {
          // Ã¢ÂÅ’ PERDIÃƒâ€œ
          betSheet.getRange(j + 1, 7).setValue("LOST");
        }
      }
    }
  } catch(e) {
    Logger.log("Error en pagos: " + e.toString());
  }
}

// ---------------------------------------------------------
// 8. HELPERS BÃƒÂSICOS HTML
// ---------------------------------------------------------
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// === FIN DEL ARCHIVO ===
function getAIPrediction(matchData) { return "IA Predictor cargado."; }
function getAIChronicle(matchStats) { return "IA Cronista cargada."; }
