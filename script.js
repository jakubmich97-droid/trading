/********************************************************************
 *  TRADING GAME 

 ********************************************************************/
window.addEventListener("load", () => {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        parseImportedData(saved, { silent: true });
        console.log("Automaticky načten poslední uložený stav.");
    } else {
        loadAssetState(currentAsset);
        syncIndicatorCheckboxes();
        updateAccount();
        drawChart();
    }
});
/* ---------------------------------------------------
      BASE VARIABLES
--------------------------------------------------- */

let price = 100;
let velocity = 0;

let trades = [];
let balance = 1000;
let tradeId = 1;
let displaySettings = {
    ema20: true,
    ema50: true,
    rsi: true
};

const SPREAD = 0.02;
const COMMISSION = 0.10;
const LEVERAGE = 1;
const STORAGE_KEY = "tradingGameState";
const AUTOSAVE_INTERVAL = 2000;
const DIVIDEND_RATE = 0.025;

let currentAsset = "growth";
let assets = {
    growth: {
        name: "GrowthTech",
        price: 100,
        velocity: 0,
        candles: [{ o: 100, h: 100, l: 100, c: 100 }],
        tick: 0,
        tradeMarkers: [],
        volatility: 0.25,
        damping: 0.92,
        dividendRate: 0
    },
    dividend: {
        name: "StableDiv",
        price: 80,
        velocity: 0,
        candles: [{ o: 80, h: 80, l: 80, c: 80 }],
        tick: 0,
        tradeMarkers: [],
        volatility: 0.10,
        damping: 0.96,
        dividendRate: DIVIDEND_RATE
    }
};

/* ---------------------------------------------------
      CANVAS INIT (RESPONSIVE)
--------------------------------------------------- */

const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    const parent = document.getElementById("chartContainer");
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ---------------------------------------------------
      CANDLE DATA
--------------------------------------------------- */

let candles = [{
    o: 100, h: 100, l: 100, c: 100
}];

let candleIndex = 0;
let tick = 0;
let tradeMarkers = [];

function getAssetPrice(assetKey) {
    if (assetKey === currentAsset) return price;
    return assets[assetKey]?.price ?? price;
}

function persistCurrentAssetState() {
    assets[currentAsset].price = price;
    assets[currentAsset].velocity = velocity;
    assets[currentAsset].candles = candles;
    assets[currentAsset].tick = tick;
    assets[currentAsset].tradeMarkers = tradeMarkers;
}

function loadAssetState(assetKey) {
    const state = assets[assetKey];
    if (!state) return;

    price = state.price;
    velocity = state.velocity;
    candles = state.candles;
    tick = state.tick;
    tradeMarkers = state.tradeMarkers;
    candleIndex = candles.length - 1;

    document.getElementById("price").innerText = price.toFixed(2);
    const select = document.getElementById("assetSelect");
    if (select) select.value = assetKey;
}

function switchAsset(assetKey) {
    if (!assets[assetKey] || assetKey === currentAsset) return;

    persistCurrentAssetState();
    currentAsset = assetKey;
    loadAssetState(assetKey);
    renderTrades();
    drawChart();
    calculateCost();
    document.getElementById("status").innerText = `Přepnuto na akcii: ${assets[assetKey].name}`;
    saveGameState();
}

/* ---------------------------------------------------
      PRICE ENGINE (CREATES OHLC)
--------------------------------------------------- */

function updatePrice() {
    const asset = assets[currentAsset];
    let randomFactor = (Math.random() - 0.5) * asset.volatility;
    velocity = (velocity + randomFactor) * asset.damping;

    price += velocity;
    price = Math.max(0.01, Math.round(price * 100) / 100);

    document.getElementById("price").innerText = price;

    tick++;

    // update current candle
    let c = candles[candles.length - 1];
    c.h = Math.max(c.h, price);
    c.l = Math.min(c.l, price);
    c.c = price;

    // new candle every 6 ticks
    if (tick >= 6) {
        candleIndex++;
        candles.push({ o: price, h: price, l: price, c: price });

        if (candles.length > 50)
            candles.splice(0, candles.length - 50);

        tick = 0;

        // shift trade markers
        tradeMarkers = tradeMarkers
            .filter(m => m.x > 0)
            .map(m => ({ ...m, x: m.x - 1 }));

        // dividend payment only for dividend stock and BUY positions
        if (asset.dividendRate > 0) {
            const payout = trades
                .filter(t => t.asset === currentAsset && t.type === "BUY")
                .reduce((sum, t) => sum + (price * t.volume * asset.dividendRate), 0);

            if (payout > 0) {
                const roundedPayout = Math.round(payout * 100) / 100;
                balance += roundedPayout;
                document.getElementById("status").innerText =
                    `Dividendy (${asset.name}): +${roundedPayout.toFixed(2)} (${(asset.dividendRate * 100).toFixed(1)} %)`;
            }
        }

        // SL/TP lines move automatically because we map price→pixel
    }

    persistCurrentAssetState();
    drawChart();
    checkAllTrades();
    renderTrades();
    calculateCost();
}

let timer = setInterval(updatePrice, 1000);

function setSpeed(ms) {
    clearInterval(timer);
    if (ms > 0) timer = setInterval(updatePrice, ms);
}

setInterval(saveGameState, AUTOSAVE_INTERVAL);
window.addEventListener("beforeunload", saveGameState);

/* ---------------------------------------------------
      DRAW MAIN CHART
--------------------------------------------------- */

function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawCandles();
    drawIndicators();
    if (displaySettings.rsi) drawRSI();
    drawTradeLines();
    drawTradeMarkers();
}

/* ---------------------------------------------------
      DRAW CANDLES
--------------------------------------------------- */

function drawCandles() {
    let count = candles.length;
    let cw = canvas.width / count;

    let highs = candles.map(c => c.h);
    let lows = candles.map(c => c.l);

    let max = Math.max(...highs);
    let min = Math.min(...lows);

    function py(v) {
        return (max - v) / (max - min) * canvas.height;
    }

    candles.forEach((c, i) => {
        let x = i * cw + cw * 0.1;
        let bodyW = cw * 0.8;

        let color = c.c >= c.o ? "#3FCC51" : "#E84A5F";

        // Wick
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + bodyW / 2, py(c.h));
        ctx.lineTo(x + bodyW / 2, py(c.l));
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(
            x,
            py(Math.max(c.o, c.c)),
            bodyW,
            Math.abs(py(c.o) - py(c.c))
        );
    });
}

/* ---------------------------------------------------
      INDICATORS (EMA 20 / EMA 50)
--------------------------------------------------- */

function EMA(values, period) {
    let k = 2 / (period + 1);
    let ema = [values[0]];

    for (let i = 1; i < values.length; i++) {
        ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
}

function drawIndicators() {
    let closes = candles.map(c => c.c);

    if (displaySettings.ema20) {
        let ema20 = EMA(closes, 20);
        drawIndicatorLine(ema20, "orange");
    }

    if (displaySettings.ema50) {
        let ema50 = EMA(closes, 50);
        drawIndicatorLine(ema50, "purple");
    }
}

function drawIndicatorLine(values, color) {
    let count = candles.length;
    let cw = canvas.width / count;

    let highs = candles.map(c => c.h);
    let lows = candles.map(c => c.l);

    let max = Math.max(...highs);
    let min = Math.min(...lows);

    function py(v) {
        return (max - v) / (max - min) * canvas.height;
    }

    ctx.strokeStyle = color;
    ctx.beginPath();

    values.forEach((v, i) => {
        if (v == null) return;
        let x = i * cw + cw / 2;
        let y = py(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}

/* ---------------------------------------------------
      RSI OVERLAY (VARIANTA B)
--------------------------------------------------- */

function RSI(values, period = 14) {
    if (values.length <= period) return Array(values.length).fill(null);

    let rsi = [];
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        let d = values[i] - values[i - 1];
        d >= 0 ? gains += d : losses -= d;
    }

    gains /= period;
    losses /= period;

    for (let i = period; i < values.length; i++) {
        let d = values[i] - values[i - 1];

        gains = (gains * (period - 1) + Math.max(d, 0)) / period;
        losses = (losses * (period - 1) + Math.max(-d, 0)) / period;

        let rs = gains / losses;
        rsi.push(100 - 100 / (1 + rs));
    }

    return Array(period).fill(null).concat(rsi);
}

function drawRSI() {
    let closes = candles.map(c => c.c);
    let rsi = RSI(closes, 14);

    let count = rsi.length;
    let cw = canvas.width / count;

    ctx.strokeStyle = "rgba(255,255,0,0.4)";
    ctx.beginPath();

    rsi.forEach((v, i) => {
        if (v == null) return;
        let x = i * cw + cw / 2;
        let y = canvas.height - (v / 100) * canvas.height;
        if (i === 14) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();
}

/* ---------------------------------------------------
      TRADE MARKERS (BUY/SELL)
--------------------------------------------------- */

// tradeMarkers are stored per asset in `assets[assetKey].tradeMarkers`

function addTradeMarker(type) {
    tradeMarkers.push({
        x: candles.length - 1,
        y: candles[candles.length - 1].c,
        type
    });
}

function drawTradeMarkers() {
    let count = candles.length;
    let cw = canvas.width / count;

    let highs = candles.map(c => c.h);
    let lows = candles.map(c => c.l);
    let max = Math.max(...highs);
    let min = Math.min(...lows);

    function py(v) {
        return (max - v) / (max - min) * canvas.height;
    }

    tradeMarkers.forEach(m => {
        let x = m.x * cw + cw / 2;
        let y = py(m.y);

        ctx.fillStyle = m.type === "BUY" ? "lime" : "red";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

/* ---------------------------------------------------
      TRADE LINES (SL / TP)
--------------------------------------------------- */

function drawTradeLines() {
    let highs = candles.map(c => c.h);
    let lows = candles.map(c => c.l);
    let max = Math.max(...highs);
    let min = Math.min(...lows);

    function py(v) {
        return (max - v) / (max - min) * canvas.height;
    }

    trades
    .filter(t => (t.asset || "growth") === currentAsset)
    .forEach(t => {
        ctx.lineWidth = 1;

        // SL
        ctx.strokeStyle = "red";
        ctx.beginPath();
        ctx.moveTo(0, py(t.sl));
        ctx.lineTo(canvas.width, py(t.sl));
        ctx.stroke();

        // TP
        ctx.strokeStyle = "lime";
        ctx.beginPath();
        ctx.moveTo(0, py(t.tp));
        ctx.lineTo(canvas.width, py(t.tp));
        ctx.stroke();
    });
}

/* ---------------------------------------------------
      TRADE OPEN / CLOSE
--------------------------------------------------- */

function buy() { openTrade("BUY"); }
function sell() { openTrade("SELL"); }

function openTrade(type) {
    const sl = parseFloat(document.getElementById("sl").value);
    const tp = parseFloat(document.getElementById("tp").value);
    const volume = parseFloat(document.getElementById("volume").value);

    if (!volume || volume <= 0) return alert("Neplatný objem.");

    const cost = price * volume / LEVERAGE;
    if (cost > balance) return alert("Nedostatek prostředků (MARGIN).");

    const trade = {
        id: tradeId++,
        asset: currentAsset,
        type,
        entry: type === "BUY" ? price + SPREAD : price - SPREAD,
        sl,
        tp,
        volume,
        trailing: null
    };

    balance -= COMMISSION;
    trades.push(trade);

    addTradeMarker(type);
    renderTrades();
}

/* ---------------------------------------------------
      P/L CALCULATIONS
--------------------------------------------------- */

function calculatePnL(trade) {
    const assetPrice = getAssetPrice(trade.asset || currentAsset);
    let diff = trade.type === "BUY"
        ? assetPrice - trade.entry
        : trade.entry - assetPrice;

    return Math.round(diff * trade.volume * 100) / 100;
}

function calculateUnrealized() {
    return trades.reduce((s, t) => s + calculatePnL(t), 0);
}

/* ---------------------------------------------------
      TRAILING STOP
--------------------------------------------------- */

function updateTrailing(trade) {
    if (!trade.trailing) return;
    const assetPrice = getAssetPrice(trade.asset || currentAsset);

    if (trade.type === "BUY") {
        let newSL = assetPrice - trade.trailing;
        if (newSL > trade.sl) trade.sl = newSL;
    } else {
        let newSL = assetPrice + trade.trailing;
        if (newSL < trade.sl) trade.sl = newSL;
    }
}

/* ---------------------------------------------------
      TP/SL CHECK
--------------------------------------------------- */

function checkAllTrades() {
    [...trades].forEach(trade => {
        const assetPrice = getAssetPrice(trade.asset || currentAsset);
        updateTrailing(trade);

        if (trade.type === "BUY") {
            if (assetPrice <= trade.sl) closeTrade(trade.id, "SL hit");
            if (assetPrice >= trade.tp) closeTrade(trade.id, "TP hit");
        }

        if (trade.type === "SELL") {
            if (assetPrice >= trade.sl) closeTrade(trade.id, "SL hit");
            if (assetPrice <= trade.tp) closeTrade(trade.id, "TP hit");
        }
    });
}

/* ---------------------------------------------------
      CLOSE TRADE
--------------------------------------------------- */

function closeTrade(id, reason = "Manuální uzavření") {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;

    const pnl = calculatePnL(trade);
    balance += pnl;

if (!window.closedTrades) window.closedTrades = [];

window.closedTrades.push({
    id: trade.id,
    asset: trade.asset,
    type: trade.type,
    entry: trade.entry,
    exitPrice: getAssetPrice(trade.asset || currentAsset),
    volume: trade.volume,
    pnl,
    reason
});

    trades = trades.filter(t => t.id !== id);

    document.getElementById("status").innerText =
        `Trade #${id} uzavřen | ${reason} | P/L: ${pnl}`;

    renderTrades();
}




/* ---------------------------------------------------
      DOM RENDERING
--------------------------------------------------- */

function renderTrades() {
    let container = document.getElementById("trades");
    container.innerHTML = "";

    trades
    .filter(trade => (trade.asset || "growth") === currentAsset)
    .forEach(trade => {
        let pnl = calculatePnL(trade);

        let div = document.createElement("div");
        div.className = "trade-row";

        div.innerHTML = `
            <strong>${trade.type}</strong> (${assets[trade.asset || "growth"]?.name || trade.asset}) |
            Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp} |
            P/L: <span style="color:${pnl >= 0 ? 'lime' : 'red'}">${pnl}</span>
            <button onclick="closeTrade(${trade.id})">Zavřít</button>
        `;

        container.appendChild(div);
    });

    updateAccount();
}

/* ---------------------------------------------------
      ACCOUNT
--------------------------------------------------- */

function updateAccount() {
    let unreal = calculateUnrealized();
    let total = balance + unreal;

    document.getElementById("balance").innerText = balance.toFixed(2);
    document.getElementById("unrealized").innerText = unreal.toFixed(2);
    document.getElementById("total").innerText = total.toFixed(2);
}

/* ---------------------------------------------------
      COST CALCULATION
--------------------------------------------------- */

function calculateCost() {
    const volume = parseFloat(document.getElementById("volume").value);
    if (!volume) return;
    document.getElementById("cost").innerText = (price * volume).toFixed(2);
}


/* ---------------------------------------------------
      SAVE
--------------------------------------------------- */

function exportData() {
    const text = buildSaveText();

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    let dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `trading_export_${dateStr}.txt`;

    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(STORAGE_KEY, text);
}

function buildSaveText() {
    persistCurrentAssetState();
    // Oddělené sekce do TXT
    let text = "=== TRADING GAME EXPORT ===\n";
    text += `Export created: ${new Date().toLocaleString()}\n\n`;

    /* ----------------------------------------
       1) Aktivní akcie
    ---------------------------------------- */
    text += "=== ACTIVE ASSET ===\n";
    text += `Asset: ${currentAsset}\n\n`;

    /* ----------------------------------------
       2) Stav akcií
    ---------------------------------------- */
    text += "=== ASSET STATES ===\n";
    text += `${JSON.stringify(assets)}\n\n`;

    /* ----------------------------------------
       3) Aktuální cena
    ---------------------------------------- */
    text += "=== CURRENT PRICE ===\n";
    text += `Price: ${price}\n\n`;

    /* ----------------------------------------
       4) Zobrazení indikátorů
    ---------------------------------------- */
    text += "=== DISPLAY SETTINGS ===\n";
    text += `EMA20: ${displaySettings.ema20}\n`;
    text += `EMA50: ${displaySettings.ema50}\n`;
    text += `RSI: ${displaySettings.rsi}\n\n`;

    /* ----------------------------------------
       5) Stav účtu
    ---------------------------------------- */
    text += "=== ACCOUNT ===\n";
    text += `Balance: ${balance}\n`;
    text += `NextTradeId: ${tradeId}\n\n`;

    /* ----------------------------------------
       6) Otevřené obchody
    ---------------------------------------- */
    text += "=== OPEN TRADES ===\n";
    if (trades.length === 0) {
        text += "No open trades.\n";
    } else {
        trades.forEach(t => {
            text += `ID: ${t.id}\n`;
            text += `Asset: ${t.asset || "growth"}\n`;
            text += `Type: ${t.type}\n`;
            text += `Entry: ${t.entry}\n`;
            text += `SL: ${t.sl}\n`;
            text += `TP: ${t.tp}\n`;
            text += `Volume: ${t.volume}\n`;
            text += `P/L: ${calculatePnL(t)}\n`;
            text += "-----------------------\n";
        });
    }
    text += "\n";

    /* ----------------------------------------
       7) Uzavřené obchody
    ---------------------------------------- */
    if (window.closedTrades) {
        text += "=== CLOSED TRADES ===\n";
        if (window.closedTrades.length === 0) {
            text += "No closed trades.\n";
        } else {
            window.closedTrades.forEach(t => {
                text += `ID: ${t.id}\n`;
                text += `Asset: ${t.asset || "growth"}\n`;
                text += `Type: ${t.type}\n`;
                text += `Entry: ${t.entry}\n`;
                text += `Exit: ${t.exitPrice}\n`;
                text += `Volume: ${t.volume}\n`;
                text += `P/L: ${t.pnl}\n`;
                text += `Reason: ${t.reason}\n`;
                text += "-----------------------\n";
            });
        }
        text += "\n";
    }

    /* ----------------------------------------
       8) candles (svíčky)
    ---------------------------------------- */
    text += "=== LAST 50 CANDLES (OHLC) ===\n";

    candles.forEach((c, i) => {
        text += `${i}. O:${c.o} H:${c.h} L:${c.l} C:${c.c}\n`;
    });

    return text;
}

function saveGameState() {
    localStorage.setItem(STORAGE_KEY, buildSaveText());
}

/* ---------------------------------------------------
      IMPORT
--------------------------------------------------- */
function parseImportedDataFromFile() {
    const input = document.getElementById("importFile");
    const file = input.files?.[0];
    if (!file) return alert("Nejprve vyber .txt soubor.");

    const reader = new FileReader();
    reader.onload = e => parseImportedData(e.target.result);
    reader.onerror = () => alert("Nepodařilo se přečíst soubor.");
    reader.readAsText(file);
}

function parseImportedData(text, options = {}) {
    if (!text || typeof text !== "string") return;

    const { silent = false } = options;

    // Reset
    trades = [];
    candles = [];
    tradeMarkers = [];
    window.closedTrades = [];

    // Helper — safe section extractor
    function getSection(name) {
        let regex = new RegExp(`=== ${name} ===([\\s\\S]*?)(?===|$)`);
        let match = text.match(regex);
        return match ? match[1].trim() : "";
    }

    /* ----- ACTIVE ASSET ----- */
    let secActiveAsset = getSection("ACTIVE ASSET");
    let activeAssetMatch = secActiveAsset.match(/Asset:\s*(growth|dividend)/);
    if (activeAssetMatch) currentAsset = activeAssetMatch[1];

    /* ----- ASSET STATES ----- */
    let secAssetStates = getSection("ASSET STATES");
    if (secAssetStates) {
        try {
            const parsedAssets = JSON.parse(secAssetStates);
            if (parsedAssets?.growth && parsedAssets?.dividend) {
                assets = parsedAssets;
            }
        } catch {
            // fallback to legacy format
        }
    }

    /* ----- CURRENT PRICE ----- */
    let secPrice = getSection("CURRENT PRICE");
    let priceMatch = secPrice.match(/Price:\s*([0-9.]+)/);
    if (priceMatch) price = parseFloat(priceMatch[1]);

    /* ----- DISPLAY SETTINGS ----- */
    let secDisplaySettings = getSection("DISPLAY SETTINGS");
    if (secDisplaySettings) {
        let ema20Match = secDisplaySettings.match(/EMA20:\s*(true|false)/i);
        let ema50Match = secDisplaySettings.match(/EMA50:\s*(true|false)/i);
        let rsiMatch = secDisplaySettings.match(/RSI:\s*(true|false)/i);

        if (ema20Match) displaySettings.ema20 = ema20Match[1].toLowerCase() === "true";
        if (ema50Match) displaySettings.ema50 = ema50Match[1].toLowerCase() === "true";
        if (rsiMatch) displaySettings.rsi = rsiMatch[1].toLowerCase() === "true";
    }

    /* ----- ACCOUNT ----- */
    let secAccount = getSection("ACCOUNT");
    if (secAccount) {
        let balanceMatch = secAccount.match(/Balance:\s*([0-9.]+)/);
        if (balanceMatch) balance = Number(balanceMatch[1]);

        let tradeIdMatch = secAccount.match(/NextTradeId:\s*([0-9]+)/);
        if (tradeIdMatch) tradeId = Number(tradeIdMatch[1]);
    }

    /* ----- OPEN TRADES ----- */
    let secOpen = getSection("OPEN TRADES");
    if (secOpen) {
        let blocks = secOpen.split("-----------------------");
        blocks.forEach(b => {
            if (b.includes("Type")) {
                let t = {};
                t.id = Number(b.match(/ID:\s*([0-9]+)/)?.[1]);
                t.asset = b.match(/Asset:\s*(growth|dividend)/)?.[1] || currentAsset;
                t.type = b.match(/Type:\s*(BUY|SELL)/)?.[1];
                t.entry = Number(b.match(/Entry:\s*([0-9.]+)/)?.[1]);
                t.sl = Number(b.match(/SL:\s*([0-9.]+)/)?.[1]);
                t.tp = Number(b.match(/TP:\s*([0-9.]+)/)?.[1]);
                t.volume = Number(b.match(/Volume:\s*([0-9.]+)/)?.[1]);
                t.trailing = null;

                if (!isNaN(t.entry)) trades.push(t);
            }
        });
    }

    /* ----- CLOSED TRADES ----- */
    let secClosed = getSection("CLOSED TRADES");
    if (secClosed) {
        let blocks = secClosed.split("-----------------------");
        blocks.forEach(b => {
            if (b.includes("Type")) {
                let t = {};
                t.id = Number(b.match(/ID:\s*([0-9]+)/)?.[1]);
                t.asset = b.match(/Asset:\s*(growth|dividend)/)?.[1] || currentAsset;
                t.type = b.match(/Type:\s*(BUY|SELL)/)?.[1];
                t.entry = Number(b.match(/Entry:\s*([0-9.]+)/)?.[1]);
                t.exitPrice = Number(b.match(/Exit:\s*([0-9.]+)/)?.[1]);
                t.volume = Number(b.match(/Volume:\s*([0-9.]+)/)?.[1]);
                t.pnl = Number(b.match(/P\/L:\s*([0-9.]+)/)?.[1]);
                t.reason = b.match(/Reason:\s*(.*)/)?.[1];

                if (!isNaN(t.entry)) window.closedTrades.push(t);
            }
        });
    }

    /* ----- CANDLES ----- */
    let secCandles = getSection("LAST 50 CANDLES (OHLC)");
    if (secCandles) {
        let lines = secCandles.split("\n");
        lines.forEach(line => {
            let m = line.match(/[0-9]+\.\s*O:([0-9.]+)\s*H:([0-9.]+)\s*L:([0-9.]+)\s*C:([0-9.]+)/);
            if (m) {
                candles.push({
                    o: parseFloat(m[1]),
                    h: parseFloat(m[2]),
                    l: parseFloat(m[3]),
                    c: parseFloat(m[4])
                });
            }
        });
    }

    if (candles.length === 0) {
        candles = [{ o: price, h: price, l: price, c: price }];
    }

    candleIndex = candles.length - 1;
    tick = 0;
    velocity = 0;
    persistCurrentAssetState();
    loadAssetState(currentAsset);

    // Refresh displays
    document.getElementById("price").innerText = price;
    syncIndicatorCheckboxes();
    renderTrades();
    updateAccount();
    drawChart();
    calculateCost();

    if (!silent) alert("Data byla úspěšně načtena.");
}

function newGame() {
    const shouldReset = confirm("Opravdu chceš spustit novou hru? Současný stav se vymaže.");
    if (!shouldReset) return;

    currentAsset = "growth";
    assets = {
        growth: {
            name: "GrowthTech",
            price: 100,
            velocity: 0,
            candles: [{ o: 100, h: 100, l: 100, c: 100 }],
            tick: 0,
            tradeMarkers: [],
            volatility: 0.25,
            damping: 0.92,
            dividendRate: 0
        },
        dividend: {
            name: "StableDiv",
            price: 80,
            velocity: 0,
            candles: [{ o: 80, h: 80, l: 80, c: 80 }],
            tick: 0,
            tradeMarkers: [],
            volatility: 0.10,
            damping: 0.96,
            dividendRate: DIVIDEND_RATE
        }
    };

    price = assets.growth.price;
    velocity = assets.growth.velocity;
    trades = [];
    balance = 1000;
    tradeId = 1;
    candles = assets.growth.candles;
    candleIndex = 0;
    tick = 0;
    tradeMarkers = assets.growth.tradeMarkers;
    window.closedTrades = [];
    displaySettings = {
        ema20: true,
        ema50: true,
        rsi: true
    };

    document.getElementById("price").innerText = price;
    document.getElementById("status").innerText = "Nová hra spuštěna.";
    document.getElementById("sl").value = "";
    document.getElementById("tp").value = "";
    document.getElementById("volume").value = "";
    document.getElementById("cost").innerText = "0";
    document.getElementById("trades").innerHTML = "";
    syncIndicatorCheckboxes();
    const select = document.getElementById("assetSelect");
    if (select) select.value = currentAsset;

    localStorage.removeItem(STORAGE_KEY);
    renderTrades();
    updateAccount();
    drawChart();
}

function syncIndicatorCheckboxes() {
    const ema20 = document.getElementById("toggleEma20");
    const ema50 = document.getElementById("toggleEma50");
    const rsi = document.getElementById("toggleRsi");

    if (ema20) ema20.checked = displaySettings.ema20;
    if (ema50) ema50.checked = displaySettings.ema50;
    if (rsi) rsi.checked = displaySettings.rsi;
}

function setIndicatorVisibility() {
    displaySettings.ema20 = document.getElementById("toggleEma20")?.checked ?? true;
    displaySettings.ema50 = document.getElementById("toggleEma50")?.checked ?? true;
    displaySettings.rsi = document.getElementById("toggleRsi")?.checked ?? true;

    drawChart();
    saveGameState();
}
