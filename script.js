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
        renderAssetsSidebar();
        renderTrades();
        renderTransactionHistory();
        renderRealEstatePage();
        renderBusinessPage();
        renderLoansPage();
        renderGameTime();
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
let balance = 10000;
let tradeId = 1;
let transactionHistory = [];
let accountHistory = [];
let displaySettings = {
    ema20: true,
    ema50: true,
    rsi: true
};

const SPREAD = 0.02;
const COMMISSION = 0;
const LEVERAGE = 1;
const STORAGE_KEY = "tradingGameState";
const AUTOSAVE_INTERVAL = 2000;
const DIVIDEND_RATE = 0.025;
const DIVIDEND_PERIOD_TICKS = 12;
const MAX_CANDLES = 75;
const STARTING_CAPITAL = 10000;
const REAL_ESTATE_GROWTH_RATE = 0.0003;
const LAND_GROWTH_RATE = 0.00015;

let currentAsset = "growth";

function generateInitialCandles(startPrice, count = MAX_CANDLES) {
    const candles = [];
    let p = startPrice;

    for (let i = 0; i < count; i++) {
        const drift = (Math.random() - 0.5) * 0.9;
        const open = p;
        const close = Math.max(0.01, round2(open + drift));
        const high = round2(Math.max(open, close) + Math.random() * 0.5);
        const low = round2(Math.max(0.01, Math.min(open, close) - Math.random() * 0.5));
        candles.push({ o: round2(open), h: high, l: low, c: close });
        p = close;
    }

    return candles;
}

function generateFlatCandles(startPrice, count = MAX_CANDLES) {
    const p = round2(startPrice);
    return Array.from({ length: count }, () => ({ o: p, h: p, l: p, c: p }));
}

let assets = {
    growth: {
        name: "GrowthTech",
        price: 100,
        velocity: 0,
        candles: generateFlatCandles(100),
        tick: 0,
        dividendTick: 0,
        tradeMarkers: [],
        volatility: 0.25,
        damping: 0.92,
        dividendRate: 0
    },
    dividend: {
        name: "StableDiv",
        price: 80,
        velocity: 0,
        candles: generateFlatCandles(80),
        tick: 0,
        dividendTick: 0,
        tradeMarkers: [],
        volatility: 0.10,
        damping: 0.96,
        dividendRate: DIVIDEND_RATE
    },
    growth2: {
        name: "GrowthNext",
        price: 120,
        velocity: 0,
        candles: generateFlatCandles(120),
        tick: 0,
        dividendTick: 0,
        tradeMarkers: [],
        volatility: 0.28,
        damping: 0.91,
        dividendRate: 0
    },
    dividend2: {
        name: "StableDiv Plus",
        price: 90,
        velocity: 0,
        candles: generateFlatCandles(90),
        tick: 0,
        dividendTick: 0,
        tradeMarkers: [],
        volatility: 0.10,
        damping: 0.96,
        dividendRate: DIVIDEND_RATE
    }
};
Object.values(assets).forEach(a => {
    a.price = a.candles[a.candles.length - 1].c;
});

function createDefaultRealEstates() {
    return {
        small_apartment: {
            name: "Malý byt",
            image: "img-small-apartment.svg",
            value: 3500000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 10000,
            rentIncreaseBuffer: 0,
            maintenance: 0,
            owned: 0
        },
        medium_apartment: {
            name: "Střední byt",
            image: "img-medium-apartment.svg",
            value: 5000000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 15000,
            rentIncreaseBuffer: 0,
            maintenance: 0,
            owned: 0
        },
        commercial: {
            name: "Komerční prostory",
            image: "img-commercial.svg",
            value: 10000000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 30000,
            rentIncreaseBuffer: 0,
            maintenance: 0,
            owned: 0
        },
        house: {
            name: "Dům (upřesníš později)",
            image: "img-house.svg",
            value: 0,
            growthRate: LAND_GROWTH_RATE,
            monthlyRent: 0,
            rentIncreaseBuffer: 0,
            maintenance: 0,
            owned: 0
        }
    };
}

let realEstates = createDefaultRealEstates();

let monthTick = 0;
let elapsedMonths = 0;
let milestonesState = {
    firstTarget: 10000,
    firstReached: false
};
let monthlyCashflow = {
    income: 0,
    expenses: 0
};
let loanState = {
    principal: 0,
    totalDue: 0,
    monthlyPayment: 0,
    remainingInstallments: 0
};
let selectedLoanAmount = 0;
let businessState = {
    shop: {
        name: "E-shop",
        image: "img-eshop.svg",
        value: 200000,
        owned: 0
    },
    goods: {
        inProgress: false,
        readyToSell: false,
        buyPrice: 1000,
        sellPrice: 1100
    },
    staff: {
        employees: 0,
        salaryPerEmployee: 90,
        autoInProgress: false
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

let candles = assets.growth.candles;

let candleIndex = 0;
let tick = 0;
let tradeMarkers = [];

function getAssetPrice(assetKey) {
    return assets[assetKey]?.price ?? price;
}

function round2(value) {
    return Math.round(Number(value) * 100) / 100;
}

function formatCurrencyInt(value) {
    return `${Math.round(Number(value) || 0).toLocaleString("cs-CZ")} 💵`;
}

function formatNumberGrouped(value) {
    return Math.round(Number(value) || 0).toLocaleString("cs-CZ");
}

function roundDownToHundreds(value) {
    return Math.floor((Number(value) || 0) / 100) * 100;
}

function addTransaction(label, amount, options = {}) {
    const { affectMonthly = true } = options;
    transactionHistory.unshift({
        time: new Date().toLocaleString(),
        label,
        amount: round2(amount)
    });
    if (affectMonthly) {
        if (amount >= 0) monthlyCashflow.income = round2(monthlyCashflow.income + amount);
        else monthlyCashflow.expenses = round2(monthlyCashflow.expenses + Math.abs(amount));
    }
}

function renderMonthlyCashflow() {
    const incomeEl = document.getElementById("monthlyIncome");
    const expensesEl = document.getElementById("monthlyExpenses");
    const netEl = document.getElementById("monthlyNet");
    if (!incomeEl || !expensesEl || !netEl) return;

    const net = round2(monthlyCashflow.income - monthlyCashflow.expenses);
    incomeEl.innerHTML = formatCurrencyInt(monthlyCashflow.income);
    expensesEl.innerHTML = formatCurrencyInt(monthlyCashflow.expenses);
    netEl.innerHTML = formatCurrencyInt(net);
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
    renderAssetsSidebar();
    document.getElementById("status").innerText = `Přepnuto na akcii: ${assets[assetKey].name}`;
    saveGameState();
}

/* ---------------------------------------------------
      PRICE ENGINE (CREATES OHLC)
--------------------------------------------------- */

function updatePrice() {
    persistCurrentAssetState();
    monthTick++;
    if (monthTick >= DIVIDEND_PERIOD_TICKS) {
        monthTick = 0;
        elapsedMonths += 1;
        monthlyCashflow = { income: 0, expenses: 0 };
        processRealEstateMonth();
        processBusinessMonth();
        processLoanMonth();
        renderGameTime();
        renderMonthlyCashflow();
    }

    Object.entries(assets).forEach(([assetKey, asset]) => {
        let randomFactor = (Math.random() - 0.5) * asset.volatility;
        asset.velocity = (asset.velocity + randomFactor) * asset.damping;

        asset.price += asset.velocity;
        asset.price = Math.max(0.01, Math.round(asset.price * 100) / 100);

        asset.tick++;
        asset.dividendTick = (asset.dividendTick || 0) + 1;

        let c = asset.candles[asset.candles.length - 1];
        c.h = Math.max(c.h, asset.price);
        c.l = Math.min(c.l, asset.price);
        c.c = asset.price;

        if (asset.tick >= 6) {
            asset.candles.push({ o: asset.price, h: asset.price, l: asset.price, c: asset.price });

            if (asset.candles.length > MAX_CANDLES) {
                asset.candles.splice(0, asset.candles.length - MAX_CANDLES);
            }

            asset.tick = 0;
            asset.tradeMarkers = asset.tradeMarkers
                .filter(m => m.x > 0)
                .map(m => ({ ...m, x: m.x - 1 }));

            // dividend payment now runs for dividend asset even when it is not currently displayed
            if (asset.dividendRate > 0 && asset.dividendTick >= DIVIDEND_PERIOD_TICKS) {
                asset.dividendTick = 0;
                const payout = trades
                    .filter(t => t.asset === assetKey && t.type === "BUY")
                    .reduce((sum, t) => sum + (asset.price * t.volume * asset.dividendRate), 0);

                if (payout > 0) {
                    const roundedPayout = round2(payout);
                    balance += roundedPayout;
                    addTransaction(
                        `Dividenda (${asset.name}) ${(asset.dividendRate * 100).toFixed(1)} %`,
                        roundedPayout
                    );
                    document.getElementById("status").innerText =
                        `Dividendy (${asset.name}): +${roundedPayout.toFixed(2)} (${(asset.dividendRate * 100).toFixed(1)} %)`;
                }
            }
        }
    });

    loadAssetState(currentAsset);
    renderAssetsSidebar();
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
    drawYAxis();
    drawIndicators();
    if (displaySettings.rsi) drawRSI();
    drawTradeLines();
    drawTradeMarkers();
}

function drawYAxis() {
    if (!candles.length) return;
    const highs = candles.map(c => c.h);
    const lows = candles.map(c => c.l);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    const ticks = 6;
    const axisX = 56;

    ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
    ctx.fillRect(0, 0, 56, canvas.height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, canvas.height);
    ctx.stroke();

    ctx.font = "12px Inter, Arial, sans-serif";
    ctx.fillStyle = "#cbd5e1";

    for (let i = 0; i <= ticks; i++) {
        const ratio = i / ticks;
        const y = ratio * canvas.height;
        const value = max - ratio * range;
        ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
        ctx.beginPath();
        ctx.moveTo(axisX, y);
        ctx.lineTo(axisX + 8, y);
        ctx.stroke();
        ctx.fillText(value.toFixed(2), 6, y + 4);
    }
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
    let volume = parseFloat(document.getElementById("volume").value);
    const buyPercent = parseFloat(document.getElementById("buyPercent").value);

    const entry = round2(type === "BUY" ? price + SPREAD : price - SPREAD);
    if (buyPercent && buyPercent > 0) {
        const pct = Math.min(Math.max(buyPercent, 0), 100);
        volume = round2((balance * (pct / 100)) / entry);
        document.getElementById("volume").value = volume;
    }

    if (!volume || volume <= 0) return alert("Neplatný objem.");

    const margin = round2(entry * volume / LEVERAGE);
    if (margin > balance) return alert("Nedostatek volných prostředků.");

    const trade = {
        id: tradeId++,
        asset: currentAsset,
        type,
        entry,
        sl,
        tp,
        volume,
        margin,
        trailing: null
    };

    balance -= margin;
    balance -= COMMISSION;
    addTransaction(`Nákup pozice (${assets[currentAsset].name})`, -(margin + COMMISSION));
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

function calculateInvestedCapital() {
    return trades.reduce((sum, t) => sum + (t.margin ?? (t.entry * t.volume / LEVERAGE)), 0);
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
    const margin = trade.margin ?? (trade.entry * trade.volume / LEVERAGE);
    const settlement = round2(margin + pnl);
    balance += settlement;
    addTransaction(`Uzavření pozice (${assets[trade.asset || "growth"]?.name || trade.asset})`, settlement);

if (!window.closedTrades) window.closedTrades = [];

window.closedTrades.push({
    id: trade.id,
    asset: trade.asset,
    type: trade.type,
    entry: trade.entry,
    exitPrice: getAssetPrice(trade.asset || currentAsset),
    volume: trade.volume,
    margin: trade.margin ?? (trade.entry * trade.volume / LEVERAGE),
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

    renderGlobalOpenPositions();
    renderTransactionHistory();
    updateAccount();
    if (!document.getElementById("portfolioPage")?.classList.contains("hidden")) {
        drawPortfolioChart();
    }
}

function renderGlobalOpenPositions() {
    const container = document.getElementById("globalOpenPositions");
    if (!container) return;
    container.innerHTML = "";

    if (trades.length === 0) {
        container.innerHTML = "<div class='trade-row'>Žádné otevřené pozice.</div>";
        return;
    }

    trades.forEach(trade => {
        const pnl = calculatePnL(trade);
        const row = document.createElement("div");
        row.className = "trade-row";
        row.innerHTML = `
            <strong>${assets[trade.asset || "growth"]?.name || trade.asset}</strong> |
            ${trade.type} | Entry: ${trade.entry} |
            P/L: <span style="color:${pnl >= 0 ? 'lime' : 'red'}">${pnl}</span>
            <button onclick="closeTrade(${trade.id})">Zavřít</button>
        `;
        container.appendChild(row);
    });
}

function renderAssetsSidebar() {
    const container = document.getElementById("assetsSidebar");
    if (!container) return;
    container.innerHTML = "";

    Object.entries(assets).forEach(([key, asset]) => {
        const isCurrent = key === currentAsset;
        const row = document.createElement("div");
        row.className = "asset-row";
        row.innerHTML = `
            <div class="asset-row-head">
                <strong>${asset.name}</strong>
                <button onclick="switchAsset('${key}')">${isCurrent ? "Zobrazeno" : "Zobrazit"}</button>
            </div>
            <div>Cena: ${Number(asset.price).toFixed(2)}</div>
            <div>Dividendová: ${asset.dividendRate > 0 ? "Ano" : "Ne"}</div>
            ${asset.dividendRate > 0 ? `<div>Dividenda: ${(asset.dividendRate * 100).toFixed(2)} % / období</div>` : ""}
        `;
        container.appendChild(row);
    });
}

function buyRealEstate(key) {
    const item = realEstates[key];
    if (!item) return;
    if (item.value <= 0) return alert("Cena této nemovitosti zatím není nastavena.");
    if (balance < item.value) return alert("Nedostatek volných prostředků.");

    balance = round2(balance - item.value);
    item.owned += 1;
    addTransaction(`Koupeno: ${item.name}`, -item.value);
    renderRealEstatePage();
    updateAccount();
}

function sellRealEstate(key) {
    const item = realEstates[key];
    if (!item) return;
    if (item.owned <= 0) return alert("Tuto nemovitost aktuálně nevlastníš.");

    item.owned -= 1;
    balance = round2(balance + item.value);
    addTransaction(`Prodáno: ${item.name}`, item.value);
    renderRealEstatePage();
    updateAccount();
}

function processRealEstateMonth() {
    let rentIncome = 0;

    Object.values(realEstates).forEach(item => {
        item.value = round2(item.value * (1 + item.growthRate));
        if (typeof item.rentIncreaseBuffer !== "number") item.rentIncreaseBuffer = 0;
        const rentIncrease = item.monthlyRent * item.growthRate;
        item.rentIncreaseBuffer = round2(item.rentIncreaseBuffer + rentIncrease);
        const rentStepCount = Math.floor(item.rentIncreaseBuffer / 500);
        if (rentStepCount > 0) {
            item.monthlyRent = round2(item.monthlyRent + rentStepCount * 500);
            item.rentIncreaseBuffer = round2(item.rentIncreaseBuffer - rentStepCount * 500);
        }
        if (item.owned > 0 && item.monthlyRent > 0) {
            rentIncome += item.owned * item.monthlyRent;
        }
    });

    if (rentIncome > 0) {
        balance = round2(balance + rentIncome);
        addTransaction("Nájemné z nemovitostí", rentIncome);
    }

    if (!document.getElementById("realEstatePage")?.classList.contains("hidden")) {
        renderRealEstatePage();
    }
}

function buyBusinessShop() {
    const shop = businessState.shop;
    if (shop.owned >= 1) return alert("Můžeš vlastnit pouze jeden e-shop.");
    if (shop.value <= 0) return alert("Cena e-shopu zatím není nastavena.");
    if (balance < shop.value) return alert("Nedostatek volných prostředků.");

    balance = round2(balance - shop.value);
    shop.owned += 1;
    addTransaction("Koupeno: E-shop", -shop.value);
    renderBusinessPage();
    updateAccount();
}

function sellBusinessShop() {
    const shop = businessState.shop;
    if (shop.owned <= 0) return alert("E-shop aktuálně nevlastníš.");
    if (businessState.staff.employees > 0) return alert("Nejdřív propusť všechny zaměstnance.");
    if (businessState.goods.inProgress) return alert("Nejdřív dokonči cyklus zboží nebo ho prodej.");
    if (businessState.staff.autoInProgress) return alert("Počkej na automatický prodej zboží nebo propusť zaměstnance.");

    shop.owned -= 1;
    balance = round2(balance + shop.value);
    addTransaction("Prodáno: E-shop", shop.value);
    renderBusinessPage();
    updateAccount();
}

function hireEmployee() {
    if (businessState.shop.owned <= 0) return alert("Nejdřív musíš vlastnit e-shop.");
    const hireCost = 10000;
    if (balance < hireCost) return alert("Nedostatek volných prostředků na nábor zaměstnance.");
    balance = round2(balance - hireCost);
    addTransaction("Nábor zaměstnance (e-shop)", -hireCost);
    businessState.staff.employees += 1;
    renderBusinessPage();
    updateAccount();
}

function fireEmployee() {
    if (businessState.staff.employees <= 0) return alert("Nemáš žádné zaměstnance.");
    businessState.staff.employees -= 1;
    if (businessState.staff.employees === 0) {
        businessState.staff.autoInProgress = false;
    }
    renderBusinessPage();
}

function buyBusinessGoods() {
    if (businessState.shop.owned <= 0) return alert("Nejdřív musíš vlastnit e-shop.");
    if (businessState.staff.employees > 0) return alert("Se zaměstnanci probíhá nákup/prodej automaticky.");
    if (businessState.goods.inProgress) return alert("Zboží už máš nakoupené. Počkej na další měsíc.");
    if (balance < businessState.goods.buyPrice) return alert("Nedostatek volných prostředků.");

    balance = round2(balance - businessState.goods.buyPrice);
    businessState.goods.inProgress = true;
    businessState.goods.readyToSell = false;
    addTransaction("Nákup zboží (e-shop)", -businessState.goods.buyPrice);
    renderBusinessPage();
    updateAccount();
}

function sellBusinessGoods() {
    if (businessState.staff.employees > 0) return alert("Se zaměstnanci probíhá nákup/prodej automaticky.");
    if (!businessState.goods.inProgress) return alert("Nejdřív nakup zboží.");
    if (!businessState.goods.readyToSell) return alert("Zboží můžeš prodat až po jednom měsíci.");

    balance = round2(balance + businessState.goods.sellPrice);
    addTransaction("Prodej zboží (e-shop)", businessState.goods.sellPrice);
    businessState.goods.inProgress = false;
    businessState.goods.readyToSell = false;
    renderBusinessPage();
    updateAccount();
}

function processBusinessMonth() {
    if (businessState.shop.owned > 0 && businessState.staff.employees > 0) {
        const employees = businessState.staff.employees;
        const salaryTotal = round2(employees * businessState.staff.salaryPerEmployee);
        balance = round2(balance - salaryTotal);
        addTransaction("Mzdy zaměstnanců (e-shop)", -salaryTotal);

        const autoBuy = round2(1000 * employees);
        const autoSell = round2(autoBuy * (1 + 0.1 * employees));

        if (businessState.staff.autoInProgress) {
            balance = round2(balance + autoSell);
            addTransaction("Automatický prodej zboží (e-shop)", autoSell);
        }

        if (balance >= autoBuy) {
            balance = round2(balance - autoBuy);
            addTransaction("Automatický nákup zboží (e-shop)", -autoBuy);
            businessState.staff.autoInProgress = true;
        } else {
            businessState.staff.autoInProgress = false;
        }
    }

    if (businessState.shop.owned > 0 && businessState.goods.inProgress && !businessState.goods.readyToSell) {
        businessState.goods.readyToSell = true;
        if (!document.getElementById("businessPage")?.classList.contains("hidden")) {
            renderBusinessPage();
        }
    }
}

function processLoanMonth() {
    if (!loanState.remainingInstallments || loanState.remainingInstallments <= 0) return;

    balance = round2(balance - loanState.monthlyPayment);
    loanState.remainingInstallments -= 1;
    addTransaction("Splátka půjčky", -loanState.monthlyPayment);

    if (loanState.remainingInstallments <= 0) {
        loanState = {
            principal: 0,
            totalDue: 0,
            monthlyPayment: 0,
            remainingInstallments: 0
        };
    }

    if (!document.getElementById("loansPage")?.classList.contains("hidden")) {
        renderLoansPage();
    }
}

function borrowLoan() {
    const maxLoan = roundDownToHundreds(balance * 100);
    const amount = roundDownToHundreds(selectedLoanAmount);
    if (!amount || amount <= 0) return alert("Neplatná výše půjčky.");
    if (loanState.remainingInstallments > 0) return alert("Nejdřív doplať stávající půjčku.");
    if (amount > maxLoan) return alert("Překročen maximální limit půjčky.");

    loanState.principal = round2(amount);
    loanState.totalDue = round2(amount * 1.05);
    loanState.monthlyPayment = round2(loanState.totalDue / 60);
    loanState.remainingInstallments = 60;

    balance = round2(balance + loanState.principal);
    addTransaction("Přijatá půjčka", loanState.principal);
    selectedLoanAmount = 0;
    renderLoansPage();
    updateAccount();
}

function repayLoan() {
    if (loanState.remainingInstallments <= 0) return alert("Nemáš aktivní půjčku.");
    const amountToRepay = round2(loanState.totalDue);
    if (balance < amountToRepay) return alert("Na splacení půjčky nemáš dostatek volných prostředků.");

    balance = round2(balance - amountToRepay);
    addTransaction("Předčasné splacení půjčky", -amountToRepay);
    loanState = {
        principal: 0,
        totalDue: 0,
        monthlyPayment: 0,
        remainingInstallments: 0
    };
    selectedLoanAmount = 0;
    renderLoansPage();
    updateAccount();
}

function selectLoanOffer(percent) {
    const maxLoan = roundDownToHundreds(balance * 100);
    selectedLoanAmount = roundDownToHundreds(maxLoan * percent);
    renderLoansPage();
}

function renderLoansPage() {
    const maxEl = document.getElementById("loanMaxValue");
    const infoEl = document.getElementById("loanInfo");
    const presetEl = document.getElementById("loanPresetButtons");
    if (!maxEl || !infoEl || !presetEl) return;

    const maxLoan = roundDownToHundreds(balance * 100);
    const options = [
        { key: "max", percent: 1.0 },
        { key: "75", percent: 0.75 },
        { key: "50", percent: 0.5 },
        { key: "25", percent: 0.25 },
        { key: "10", percent: 0.10 },
        { key: "1", percent: 0.01 }
    ].map(o => ({
        ...o,
        amount: roundDownToHundreds(maxLoan * o.percent)
    }));

    if (selectedLoanAmount > maxLoan || selectedLoanAmount < 0) selectedLoanAmount = 0;
    maxEl.innerHTML = formatCurrencyInt(maxLoan);
    presetEl.innerHTML = "";

    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.classList.add("loan-option");
        const installment = round2((opt.amount * 1.05) / 60);
        btn.innerHTML = `
            <div class="loan-option-amount">${formatCurrencyInt(opt.amount)}</div>
            <div class="loan-option-installment">Splátka: ${formatCurrencyInt(installment)} / měsíc</div>
        `;
        btn.disabled = opt.amount <= 0 || loanState.remainingInstallments > 0;
        if (opt.amount === selectedLoanAmount && opt.amount > 0) btn.classList.add("active");
        btn.onclick = () => selectLoanOffer(opt.percent);
        presetEl.appendChild(btn);
    });

    if (loanState.remainingInstallments > 0) {
        infoEl.innerHTML = `
            <p>Aktivní půjčka: <strong>${formatCurrencyInt(loanState.principal)}</strong></p>
            <p>Celkem k úhradě: <strong>${formatCurrencyInt(loanState.totalDue)}</strong></p>
            <p>Měsíční splátka: <strong>${formatCurrencyInt(loanState.monthlyPayment)}</strong></p>
            <p>Zbývá splátek: <strong>${loanState.remainingInstallments}</strong></p>
        `;
    } else {
        infoEl.innerHTML = selectedLoanAmount > 0
            ? `<p>Vybraná částka půjčky: <strong>${formatCurrencyInt(selectedLoanAmount)}</strong></p>`
            : "<p>Momentálně nemáš aktivní půjčku.</p>";
    }
}

function applyAutomaticOverdraftLoan() {
    if (balance >= 0) return;

    const needed = round2(Math.abs(balance));
    const addedTotalDue = round2(needed * 1.10);
    const installments = loanState.remainingInstallments > 0 ? loanState.remainingInstallments : 60;

    loanState.principal = round2(loanState.principal + needed);
    loanState.totalDue = round2(loanState.totalDue + addedTotalDue);
    loanState.remainingInstallments = installments;
    loanState.monthlyPayment = round2(loanState.totalDue / loanState.remainingInstallments);

    balance = 0;
    addTransaction("Automatická půjčka", needed);
    alert(`Volné prostředky šly do mínusu. Byla automaticky poskytnuta půjčka ${needed.toFixed(2)} 🪙 s úrokem 10 %.`);
    renderLoansPage();
}

function renderRealEstatePage() {
    const grid = document.getElementById("realEstateGrid");
    if (!grid) return;
    grid.innerHTML = "";

    Object.entries(realEstates).forEach(([key, item]) => {
        const card = document.createElement("div");
        card.className = "realestate-card";
        card.innerHTML = `
            <img src="${item.image || "img-house.svg"}" alt="${item.name}" class="entity-image">
            <h3>${item.name}</h3>
            <p>Aktuální hodnota: <strong>${formatCurrencyInt(item.value)}</strong></p>
            <p>Vlastním: <strong>${item.owned}</strong></p>
            <p>Měsíční nájem: <strong>${formatCurrencyInt(item.monthlyRent)}</strong></p>
            <p>Údržba: <strong>${formatCurrencyInt(item.maintenance)}</strong></p>
            <div class="toolbar">
                <button class="buy-btn" onclick="buyRealEstate('${key}')">Koupit</button>
                <button class="sell-btn" onclick="sellRealEstate('${key}')">Prodat</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderBusinessPage() {
    const grid = document.getElementById("businessGrid");
    if (!grid) return;

    const shop = businessState.shop;
    const goods = businessState.goods;
    const staff = businessState.staff;
    const autoBuy = round2(1000 * staff.employees);
    const autoSell = round2(autoBuy * (1 + 0.1 * staff.employees));
    grid.innerHTML = "";

    const card = document.createElement("div");
    card.className = "realestate-card";
    const canBuyShop = shop.owned < 1;
    card.innerHTML = `
        <img src="${shop.image || "img-eshop.svg"}" alt="${shop.name}" class="entity-image">
        <h3>${shop.name}</h3>
        <p>Aktuální hodnota: <strong>${formatCurrencyInt(shop.value)}</strong></p>
        <p>Vlastním: <strong>${shop.owned}</strong></p>
        <p>Zaměstnanci: <strong>${staff.employees}</strong> | Mzda: <strong>${formatCurrencyInt(staff.salaryPerEmployee)} / měsíc / zaměstnanec</strong></p>
        <p>Automatický cyklus: <strong>${staff.autoInProgress ? "Nakoupeno, příští měsíc prodej" : "Připraveno nakoupit"}</strong></p>
        <p>Auto nákup/prodej: <strong>${formatCurrencyInt(autoBuy)} → ${formatCurrencyInt(autoSell)}</strong></p>
        <p>Zboží: <strong>${goods.inProgress ? (goods.readyToSell ? "Připraveno k prodeji" : "Nakoupeno, čeká na měsíc") : "Žádné"} </strong></p>
        <p>Nákup zboží (manuálně): <strong>${formatCurrencyInt(goods.buyPrice)}</strong> | Prodej: <strong>${formatCurrencyInt(goods.sellPrice)}</strong></p>
        <div class="toolbar">
            <button class="buy-btn" onclick="buyBusinessShop()" ${canBuyShop ? "" : "disabled"}>Koupit e-shop</button>
            <button class="sell-btn" onclick="sellBusinessShop()">Prodat e-shop</button>
        </div>
        ${shop.owned > 0 ? `
        <div class="toolbar">
            <button onclick="buyBusinessGoods()">Nakoupit zboží za ${formatCurrencyInt(goods.buyPrice)}</button>
            <button onclick="sellBusinessGoods()">Prodat zboží za ${formatCurrencyInt(goods.sellPrice)}</button>
        </div>
        <div class="toolbar">
            <button onclick="hireEmployee()">Najmout zaměstnance</button>
            <button onclick="fireEmployee()">Propustit zaměstnance</button>
        </div>
        ` : ""}
    `;
    grid.appendChild(card);
}

function renderGameTime() {
    const el = document.getElementById("gameTime");
    if (!el) return;

    const years = Math.floor(elapsedMonths / 12);
    const months = elapsedMonths % 12;
    const yearPart = years > 0 ? `${years} ${years === 1 ? "rok" : years < 5 ? "roky" : "let"}` : "";
    const monthPart = `${months} ${months === 1 ? "měsíc" : months < 5 ? "měsíce" : "měsíců"}`;
    el.innerText = yearPart ? `${yearPart} a ${monthPart}` : monthPart;
}

function renderMilestones(currentProfit = null) {
    const bar = document.getElementById("milestoneProgressBar");
    const text = document.getElementById("milestoneProgressText");
    if (!bar || !text) return;

    const profit = currentProfit == null ? 0 : currentProfit;
    const clamped = Math.max(0, Math.min(milestonesState.firstTarget, profit));
    const progressPct = (clamped / milestonesState.firstTarget) * 100;
    bar.style.width = `${progressPct}%`;
    text.innerHTML = `${formatCurrencyInt(clamped)} / ${formatCurrencyInt(milestonesState.firstTarget)}`;

    if (!milestonesState.firstReached && profit >= milestonesState.firstTarget) {
        milestonesState.firstReached = true;
        alert("🎉 Gratulace! Dosáhl jsi prvního milníku: 10 000 💵 vydělaných peněz.");
    }
}

function applyCheatBalance() {
    const input = document.getElementById("cheatBalanceInput");
    const value = Number(input?.value ?? NaN);
    if (!Number.isFinite(value) || value < 0) return alert("Zadej platnou nezápornou částku.");

    const delta = round2(value - balance);
    balance = round2(value);
    addTransaction("Cheat: změna volných prostředků", delta);
    updateAccount();
    renderLoansPage();
    renderMilestones(round2((balance + calculateInvestedCapital() + calculateUnrealized()) - STARTING_CAPITAL));
    if (input) input.value = "";
}

function renderTransactionHistory() {
    const container = document.getElementById("transactionHistory");
    if (!container) return;
    container.innerHTML = "";

    if (transactionHistory.length === 0) {
        container.innerHTML = "<div class='trade-row'>Zatím bez transakcí.</div>";
        return;
    }

    transactionHistory.slice(0, 300).forEach(t => {
        const amountClass = t.amount >= 0 ? "tx-income" : "tx-expense";
        const amountPrefix = t.amount >= 0 ? "+" : "";
        const row = document.createElement("div");
        row.className = "transaction-row";
        row.innerHTML = `
            <div><strong>${t.label}</strong></div>
            <div class="${amountClass}">${amountPrefix}${Number(t.amount).toFixed(2)}</div>
            <div class="dividend-time">${t.time}</div>
        `;
        container.appendChild(row);
    });
}

function openPortfolio() {
    setActiveNav("navPortfolio");
    document.querySelector(".app-shell")?.classList.add("hidden");
    document.getElementById("realEstatePage")?.classList.add("hidden");
    document.getElementById("businessPage")?.classList.add("hidden");
    document.getElementById("loansPage")?.classList.add("hidden");
    document.getElementById("milestonesPage")?.classList.add("hidden");
    document.getElementById("cheatsPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.getElementById("portfolioPage")?.classList.remove("hidden");
    drawPortfolioChart();
}

function closePortfolio() {
    openTrading();
}

function openAccountHistory() {
    setActiveNav("navAccountHistory");
    document.querySelector(".app-shell")?.classList.add("hidden");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("realEstatePage")?.classList.add("hidden");
    document.getElementById("businessPage")?.classList.add("hidden");
    document.getElementById("loansPage")?.classList.add("hidden");
    document.getElementById("milestonesPage")?.classList.add("hidden");
    document.getElementById("cheatsPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.remove("hidden");
    drawAccountHistoryChart();
}

function closeAccountHistory() {
    openTrading();
}

function setActiveNav(activeId) {
    document.getElementById("navTrading")?.classList.remove("active");
    document.getElementById("navRealEstate")?.classList.remove("active");
    document.getElementById("navBusiness")?.classList.remove("active");
    document.getElementById("navLoans")?.classList.remove("active");
    document.getElementById("navPortfolio")?.classList.remove("active");
    document.getElementById("navAccountHistory")?.classList.remove("active");
    document.getElementById("navMilestones")?.classList.remove("active");
    document.getElementById("navCheats")?.classList.remove("active");
    document.getElementById(activeId)?.classList.add("active");
}

function setMainCardView(view) {
    const tradingPage = document.getElementById("tradingPage");
    const realEstatePage = document.getElementById("realEstatePage");
    const businessPage = document.getElementById("businessPage");
    const loansPage = document.getElementById("loansPage");
    const milestonesPage = document.getElementById("milestonesPage");
    const cheatsPage = document.getElementById("cheatsPage");
    const assetsSidebarCard = document.getElementById("assetsSidebarCard");
    const appShell = document.querySelector(".app-shell");

    tradingPage?.classList.toggle("hidden", view !== "trading");
    realEstatePage?.classList.toggle("hidden", view !== "realestate");
    businessPage?.classList.toggle("hidden", view !== "business");
    loansPage?.classList.toggle("hidden", view !== "loans");
    milestonesPage?.classList.toggle("hidden", view !== "milestones");
    cheatsPage?.classList.toggle("hidden", view !== "cheats");
    assetsSidebarCard?.classList.toggle("hidden", view !== "trading");
    appShell?.classList.toggle("no-assets-layout", view !== "trading");
}

function openTrading() {
    setActiveNav("navTrading");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("trading");
}

function openRealEstate() {
    setActiveNav("navRealEstate");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("realestate");
    renderRealEstatePage();
}

function openBusiness() {
    setActiveNav("navBusiness");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("business");
    renderBusinessPage();
}

function openLoans() {
    setActiveNav("navLoans");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("loans");
    renderLoansPage();
}

function openMilestones() {
    setActiveNav("navMilestones");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("milestones");
    renderMilestones(round2((balance + calculateInvestedCapital() + calculateUnrealized()) - STARTING_CAPITAL));
}

function openCheats() {
    setActiveNav("navCheats");
    document.getElementById("portfolioPage")?.classList.add("hidden");
    document.getElementById("accountHistoryPage")?.classList.add("hidden");
    document.querySelector(".app-shell")?.classList.remove("hidden");
    setMainCardView("cheats");
}

function drawDonutChart(canvas, legend, title, slices) {
    if (!canvas || !legend) return;
    const ctxPie = canvas.getContext("2d");
    const sortedSlices = [...slices].sort((a, b) => b.value - a.value);
    const total = sortedSlices.reduce((sum, s) => sum + s.value, 0);
    ctxPie.clearRect(0, 0, canvas.width, canvas.height);

    if (total <= 0) {
        ctxPie.fillStyle = "#cbd5e1";
        ctxPie.font = "20px Inter, sans-serif";
        ctxPie.fillText("Žádná data k vykreslení.", 120, canvas.height / 2);
        legend.innerHTML = "";
        return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.35;
    let start = -Math.PI / 2;

    sortedSlices.forEach(slice => {
        const angle = (slice.value / total) * Math.PI * 2;
        const end = start + angle;
        ctxPie.beginPath();
        ctxPie.moveTo(cx, cy);
        ctxPie.arc(cx, cy, radius, start, end);
        ctxPie.closePath();
        ctxPie.fillStyle = slice.color;
        ctxPie.fill();
        start = end;
    });

    ctxPie.beginPath();
    ctxPie.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
    ctxPie.fillStyle = "#0f172a";
    ctxPie.fill();

    ctxPie.fillStyle = "#e2e8f0";
    ctxPie.font = "bold 20px Inter, sans-serif";
    ctxPie.textAlign = "center";
    ctxPie.fillText(title, cx, cy - 8);
    ctxPie.font = "16px Inter, sans-serif";
    ctxPie.fillText(formatNumberGrouped(total), cx, cy + 18);

    legend.innerHTML = sortedSlices.map(s => {
        const pct = ((s.value / total) * 100).toFixed(1);
        return `
            <div class="legend-row">
                <span class="legend-dot" style="background:${s.color}"></span>
                <span>${s.name}</span>
                <strong>${formatNumberGrouped(s.value)} (${pct} %)</strong>
            </div>
        `;
    }).join("");
}

function drawPortfolioChart() {
    const canvas = document.getElementById("portfolioChart");
    const legend = document.getElementById("portfolioLegend");
    const incomeCanvas = document.getElementById("incomeChart");
    const incomeLegend = document.getElementById("incomeLegend");
    const costCanvas = document.getElementById("costChart");
    const costLegend = document.getElementById("costLegend");
    if (!canvas || !legend || !incomeCanvas || !incomeLegend || !costCanvas || !costLegend) return;

    const colors = ["#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#38bdf8", "#14b8a6", "#eab308", "#f472b6"];
    const assetSlices = Object.entries(assets).map(([key, asset]) => ({
        key,
        name: asset.name,
        value: trades
            .filter(t => t.asset === key)
            .reduce((sum, t) => sum + (t.margin ?? (t.entry * t.volume / LEVERAGE)), 0)
    }));

    const portfolioSlices = [
        { key: "cash", name: "Volné prostředky", value: Math.max(balance, 0), color: "#22d3ee" },
        ...assetSlices.map((s, i) => ({ ...s, color: colors[i % colors.length] })),
        {
            key: "realestate",
            name: "Nemovitosti",
            value: Object.values(realEstates).reduce((sum, item) => sum + (item.value * item.owned), 0),
            color: "#f97316"
        },
        {
            key: "business",
            name: "Business (E-shop)",
            value: (businessState.shop?.value || 0) * (businessState.shop?.owned || 0),
            color: "#06b6d4"
        }
    ].filter(s => s.value > 0);

    const incomeMap = new Map();
    const costMap = new Map();
    transactionHistory.forEach(tx => {
        const key = tx.label || "Neznámé";
        if (tx.amount >= 0) incomeMap.set(key, (incomeMap.get(key) || 0) + tx.amount);
        else costMap.set(key, (costMap.get(key) || 0) + Math.abs(tx.amount));
    });

    const incomeSlices = [...incomeMap.entries()]
        .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
        .filter(s => s.value > 0);

    const costSlices = [...costMap.entries()]
        .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
        .filter(s => s.value > 0);

    drawDonutChart(canvas, legend, "Portfolio", portfolioSlices);
    drawDonutChart(incomeCanvas, incomeLegend, "Příjmy", incomeSlices);
    drawDonutChart(costCanvas, costLegend, "Náklady", costSlices);
}

function drawAccountHistoryChart() {
    const canvas = document.getElementById("accountHistoryChart");
    const legend = document.getElementById("accountHistoryLegend");
    if (!canvas || !legend) return;

    const ctxLine = canvas.getContext("2d");
    ctxLine.clearRect(0, 0, canvas.width, canvas.height);

    const visibleHistory = accountHistory.slice(-100);

    if (visibleHistory.length < 2) {
        ctxLine.fillStyle = "#cbd5e1";
        ctxLine.font = "20px Inter, sans-serif";
        ctxLine.fillText("Málo dat pro vykreslení křivky.", 240, canvas.height / 2);
        legend.innerHTML = "";
        return;
    }

    const values = visibleHistory.map(p => p.total);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = 50;
    const w = canvas.width - padding * 2;
    const h = canvas.height - padding * 2;
    const range = Math.max(max - min, 1);

    // axes
    ctxLine.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctxLine.lineWidth = 1;
    ctxLine.beginPath();
    ctxLine.moveTo(padding, padding);
    ctxLine.lineTo(padding, canvas.height - padding);
    ctxLine.lineTo(canvas.width - padding, canvas.height - padding);
    ctxLine.stroke();

    // chart line
    ctxLine.strokeStyle = "#22d3ee";
    ctxLine.lineWidth = 3;
    ctxLine.beginPath();
    visibleHistory.forEach((p, i) => {
        const x = padding + (i / (visibleHistory.length - 1)) * w;
        const y = canvas.height - padding - ((p.total - min) / range) * h;
        if (i === 0) ctxLine.moveTo(x, y);
        else ctxLine.lineTo(x, y);
    });
    ctxLine.stroke();

    const last = visibleHistory[visibleHistory.length - 1];
    const first = visibleHistory[0];
    const delta = round2(last.total - first.total);
    const deltaColor = delta >= 0 ? "#4ade80" : "#f87171";

    legend.innerHTML = `
        <div class="legend-row"><span class="legend-dot" style="background:#22d3ee"></span><span>Počáteční hodnota</span><strong>${formatNumberGrouped(first.total)}</strong></div>
        <div class="legend-row"><span class="legend-dot" style="background:#a78bfa"></span><span>Aktuální hodnota</span><strong>${formatNumberGrouped(last.total)}</strong></div>
        <div class="legend-row"><span class="legend-dot" style="background:${deltaColor}"></span><span>Změna</span><strong style="color:${deltaColor}">${delta >= 0 ? "+" : ""}${formatNumberGrouped(delta)}</strong></div>
    `;
}

/* ---------------------------------------------------
      ACCOUNT
--------------------------------------------------- */

function updateAccount() {
    applyAutomaticOverdraftLoan();

    let unreal = calculateUnrealized();
    let invested = calculateInvestedCapital();
    let total = balance + invested + unreal;
    const earnedProfit = round2(total - STARTING_CAPITAL);

    document.getElementById("balance").innerHTML = formatCurrencyInt(balance);
    document.getElementById("invested").innerHTML = formatCurrencyInt(invested);
    document.getElementById("unrealized").innerHTML = formatCurrencyInt(unreal);
    document.getElementById("total").innerHTML = formatCurrencyInt(total);
    renderMonthlyCashflow();
    renderMilestones(earnedProfit);

    const last = accountHistory[accountHistory.length - 1];
    if (!last || Math.abs(last.total - total) > 0.009) {
        accountHistory.push({
            time: new Date().toLocaleTimeString(),
            balance: round2(balance),
            invested: round2(invested),
            total: round2(total)
        });
        if (accountHistory.length > 2000) accountHistory.shift();
    }

    if (!document.getElementById("accountHistoryPage")?.classList.contains("hidden")) {
        drawAccountHistoryChart();
    }
}

/* ---------------------------------------------------
      COST CALCULATION
--------------------------------------------------- */

function calculateCost() {
    const volume = parseFloat(document.getElementById("volume").value);
    const buyPercent = parseFloat(document.getElementById("buyPercent").value);

    let cost = 0;
    if (buyPercent && buyPercent > 0) {
        const pct = Math.min(Math.max(buyPercent, 0), 100);
        cost = balance * (pct / 100);
    } else if (volume && volume > 0) {
        cost = price * volume;
    }

    document.getElementById("cost").innerText = cost.toFixed(2);
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
    text += `ElapsedMonths: ${elapsedMonths}\n\n`;

    text += "=== MILESTONES ===\n";
    text += `${JSON.stringify(milestonesState)}\n\n`;

    text += "=== MONTHLY CASHFLOW ===\n";
    text += `${JSON.stringify(monthlyCashflow)}\n\n`;

    /* ----------------------------------------
       6) Dividendy
    ---------------------------------------- */
    text += "=== TRANSACTION HISTORY ===\n";
    text += `${JSON.stringify(transactionHistory)}\n\n`;

    /* ----------------------------------------
       7) Account history
    ---------------------------------------- */
    text += "=== ACCOUNT HISTORY ===\n";
    text += `${JSON.stringify(accountHistory)}\n\n`;

    /* ----------------------------------------
       8) Real estate
    ---------------------------------------- */
    text += "=== REAL ESTATE ===\n";
    text += `${JSON.stringify(realEstates)}\n`;
    text += `MonthTick: ${monthTick}\n\n`;

    /* ----------------------------------------
       9) Business
    ---------------------------------------- */
    text += "=== BUSINESS STATE ===\n";
    text += `${JSON.stringify(businessState)}\n\n`;

    /* ----------------------------------------
       10) Loans
    ---------------------------------------- */
    text += "=== LOAN STATE ===\n";
    text += `${JSON.stringify(loanState)}\n\n`;

    /* ----------------------------------------
       11) Otevřené obchody
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
            text += `Margin: ${t.margin ?? (t.entry * t.volume / LEVERAGE)}\n`;
            text += `P/L: ${calculatePnL(t)}\n`;
            text += "-----------------------\n";
        });
    }
    text += "\n";

    /* ----------------------------------------
       12) Uzavřené obchody
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
                text += `Margin: ${t.margin ?? (t.entry * t.volume / LEVERAGE)}\n`;
                text += `P/L: ${t.pnl}\n`;
                text += `Reason: ${t.reason}\n`;
                text += "-----------------------\n";
            });
        }
        text += "\n";
    }

    /* ----------------------------------------
       12) candles (svíčky)
    ---------------------------------------- */
    text += "=== LAST 75 CANDLES (OHLC) ===\n";

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
    transactionHistory = [];
    accountHistory = [];
    milestonesState = { firstTarget: 10000, firstReached: false };
    monthlyCashflow = { income: 0, expenses: 0 };
    realEstates = createDefaultRealEstates();
    businessState = {
        shop: { name: "E-shop", image: "img-eshop.svg", value: 200000, owned: 0 },
        goods: { inProgress: false, readyToSell: false, buyPrice: 1000, sellPrice: 1100 },
        staff: { employees: 0, salaryPerEmployee: 90, autoInProgress: false }
    };
    monthTick = 0;
    elapsedMonths = 0;
    loanState = { principal: 0, totalDue: 0, monthlyPayment: 0, remainingInstallments: 0 };
    window.closedTrades = [];

    // Helper — safe section extractor
    function getSection(name) {
        let regex = new RegExp(`=== ${name} ===([\\s\\S]*?)(?===|$)`);
        let match = text.match(regex);
        return match ? match[1].trim() : "";
    }

    /* ----- ACTIVE ASSET ----- */
    let secActiveAsset = getSection("ACTIVE ASSET");
    let activeAssetMatch = secActiveAsset.match(/Asset:\s*(growth|dividend|growth2|dividend2)/);
    if (activeAssetMatch) currentAsset = activeAssetMatch[1];

    /* ----- ASSET STATES ----- */
    let secAssetStates = getSection("ASSET STATES");
    if (secAssetStates) {
        try {
            const parsedAssets = JSON.parse(secAssetStates);
            if (parsedAssets?.growth && parsedAssets?.dividend) {
                assets = { ...assets, ...parsedAssets };
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

        let elapsedMonthsMatch = secAccount.match(/ElapsedMonths:\s*([0-9]+)/);
        if (elapsedMonthsMatch) elapsedMonths = Number(elapsedMonthsMatch[1]);
    }

    /* ----- MILESTONES ----- */
    let secMilestones = getSection("MILESTONES");
    if (secMilestones) {
        try {
            const parsedMilestones = JSON.parse(secMilestones.split("\n")[0]);
            if (parsedMilestones && typeof parsedMilestones === "object") {
                milestonesState = {
                    firstTarget: round2(parsedMilestones.firstTarget ?? 10000),
                    firstReached: Boolean(parsedMilestones.firstReached)
                };
            }
        } catch {
            // keep defaults
        }
    }

    /* ----- MONTHLY CASHFLOW ----- */
    let secMonthlyCashflow = getSection("MONTHLY CASHFLOW");
    if (secMonthlyCashflow) {
        try {
            const parsedMonthly = JSON.parse(secMonthlyCashflow.split("\n")[0]);
            if (parsedMonthly && typeof parsedMonthly === "object") {
                monthlyCashflow = {
                    income: round2(parsedMonthly.income ?? 0),
                    expenses: round2(parsedMonthly.expenses ?? 0)
                };
            }
        } catch {
            // keep defaults
        }
    }

    /* ----- TRANSACTION HISTORY ----- */
    let secTxHistory = getSection("TRANSACTION HISTORY");
    if (!secTxHistory) secTxHistory = getSection("DIVIDEND HISTORY");
    if (secTxHistory) {
        try {
            const parsedHistory = JSON.parse(secTxHistory);
            if (Array.isArray(parsedHistory)) {
                transactionHistory = parsedHistory.map(item => ({
                    time: item.time || new Date().toLocaleString(),
                    label: item.label || (item.asset ? `Dividenda (${item.asset})` : "Transakce"),
                    amount: round2(item.amount ?? 0)
                }));
            }
        } catch {
            transactionHistory = [];
        }
    }

    /* ----- ACCOUNT HISTORY ----- */
    let secAccHistory = getSection("ACCOUNT HISTORY");
    if (secAccHistory) {
        try {
            const parsedAccHistory = JSON.parse(secAccHistory);
            if (Array.isArray(parsedAccHistory)) {
                accountHistory = parsedAccHistory.map(p => ({
                    time: p.time || new Date().toLocaleTimeString(),
                    balance: round2(p.balance ?? 0),
                    invested: round2(p.invested ?? 0),
                    total: round2(p.total ?? 0)
                }));
            }
        } catch {
            accountHistory = [];
        }
    }

    /* ----- REAL ESTATE ----- */
    let secRealEstate = getSection("REAL ESTATE");
    if (secRealEstate) {
        const jsonLine = secRealEstate.split("\n")[0];
        const monthLine = secRealEstate.split("\n").find(l => l.startsWith("MonthTick:"));
        try {
            const parsedRealEstate = JSON.parse(jsonLine);
            if (parsedRealEstate && typeof parsedRealEstate === "object") {
                realEstates = parsedRealEstate;
            }
        } catch {
            // keep defaults
        }
        if (monthLine) {
            monthTick = Number(monthLine.replace("MonthTick:", "").trim()) || 0;
        }
    }

    /* ----- BUSINESS STATE ----- */
    let secBusiness = getSection("BUSINESS STATE");
    if (secBusiness) {
        try {
            const parsedBusiness = JSON.parse(secBusiness.split("\n")[0]);
            if (parsedBusiness && typeof parsedBusiness === "object") {
                businessState = {
                    shop: {
                        name: parsedBusiness.shop?.name || "E-shop",
                        image: parsedBusiness.shop?.image || "img-eshop.svg",
                        value: round2(parsedBusiness.shop?.value ?? 200000),
                        owned: Math.min(1, Number(parsedBusiness.shop?.owned ?? 0))
                    },
                    goods: {
                        inProgress: Boolean(parsedBusiness.goods?.inProgress),
                        readyToSell: Boolean(parsedBusiness.goods?.readyToSell),
                        buyPrice: round2(parsedBusiness.goods?.buyPrice ?? 1000),
                        sellPrice: round2(parsedBusiness.goods?.sellPrice ?? 1100)
                    },
                    staff: {
                        employees: Number(parsedBusiness.staff?.employees ?? 0),
                        salaryPerEmployee: round2(parsedBusiness.staff?.salaryPerEmployee ?? 90),
                        autoInProgress: Boolean(parsedBusiness.staff?.autoInProgress)
                    }
                };
            }
        } catch {
            // keep defaults
        }
    }

    /* ----- LOAN STATE ----- */
    let secLoan = getSection("LOAN STATE");
    if (secLoan) {
        try {
            const parsedLoan = JSON.parse(secLoan.split("\n")[0]);
            if (parsedLoan && typeof parsedLoan === "object") {
                loanState = {
                    principal: round2(parsedLoan.principal ?? 0),
                    totalDue: round2(parsedLoan.totalDue ?? 0),
                    monthlyPayment: round2(parsedLoan.monthlyPayment ?? 0),
                    remainingInstallments: Number(parsedLoan.remainingInstallments ?? 0)
                };
            }
        } catch {
            // keep defaults
        }
    }

    /* ----- OPEN TRADES ----- */
    let secOpen = getSection("OPEN TRADES");
    if (secOpen) {
        let blocks = secOpen.split("-----------------------");
        blocks.forEach(b => {
            if (b.includes("Type")) {
                let t = {};
                t.id = Number(b.match(/ID:\s*([0-9]+)/)?.[1]);
                t.asset = b.match(/Asset:\s*(growth|dividend|growth2|dividend2)/)?.[1] || currentAsset;
                t.type = b.match(/Type:\s*(BUY|SELL)/)?.[1];
                t.entry = Number(b.match(/Entry:\s*([0-9.]+)/)?.[1]);
                t.sl = Number(b.match(/SL:\s*([0-9.]+)/)?.[1]);
                t.tp = Number(b.match(/TP:\s*([0-9.]+)/)?.[1]);
                t.volume = Number(b.match(/Volume:\s*([0-9.]+)/)?.[1]);
                t.margin = Number(b.match(/Margin:\s*([0-9.]+)/)?.[1]);
                t.trailing = null;
                if (Number.isNaN(t.margin)) t.margin = t.entry * t.volume / LEVERAGE;

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
                t.asset = b.match(/Asset:\s*(growth|dividend|growth2|dividend2)/)?.[1] || currentAsset;
                t.type = b.match(/Type:\s*(BUY|SELL)/)?.[1];
                t.entry = Number(b.match(/Entry:\s*([0-9.]+)/)?.[1]);
                t.exitPrice = Number(b.match(/Exit:\s*([0-9.]+)/)?.[1]);
                t.volume = Number(b.match(/Volume:\s*([0-9.]+)/)?.[1]);
                t.margin = Number(b.match(/Margin:\s*([0-9.]+)/)?.[1]);
                t.pnl = Number(b.match(/P\/L:\s*([0-9.]+)/)?.[1]);
                t.reason = b.match(/Reason:\s*(.*)/)?.[1];

                if (!isNaN(t.entry)) window.closedTrades.push(t);
            }
        });
    }

    /* ----- CANDLES ----- */
    let secCandles = getSection("LAST 75 CANDLES (OHLC)");
    if (!secCandles) secCandles = getSection("LAST 100 CANDLES (OHLC)");
    if (!secCandles) secCandles = getSection("LAST 50 CANDLES (OHLC)");
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
        candles = generateFlatCandles(price);
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
    renderAssetsSidebar();
    renderTransactionHistory();
    renderRealEstatePage();
    renderBusinessPage();
    renderLoansPage();
    renderGameTime();

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
            candles: generateInitialCandles(100),
            tick: 0,
            dividendTick: 0,
            tradeMarkers: [],
            volatility: 0.25,
            damping: 0.92,
            dividendRate: 0
        },
        dividend: {
            name: "StableDiv",
            price: 80,
            velocity: 0,
            candles: generateInitialCandles(80),
            tick: 0,
            dividendTick: 0,
            tradeMarkers: [],
            volatility: 0.10,
            damping: 0.96,
            dividendRate: DIVIDEND_RATE
        },
        growth2: {
            name: "GrowthNext",
            price: 120,
            velocity: 0,
            candles: generateInitialCandles(120),
            tick: 0,
            dividendTick: 0,
            tradeMarkers: [],
            volatility: 0.28,
            damping: 0.91,
            dividendRate: 0
        },
        dividend2: {
            name: "StableDiv Plus",
            price: 90,
            velocity: 0,
            candles: generateInitialCandles(90),
            tick: 0,
            dividendTick: 0,
            tradeMarkers: [],
            volatility: 0.10,
            damping: 0.96,
            dividendRate: DIVIDEND_RATE
        }
    };
    Object.values(assets).forEach(a => {
        a.price = a.candles[a.candles.length - 1].c;
    });

    price = assets.growth.price;
    velocity = assets.growth.velocity;
    trades = [];
    balance = 10000;
    tradeId = 1;
    transactionHistory = [];
    accountHistory = [];
    milestonesState = { firstTarget: 10000, firstReached: false };
    monthlyCashflow = { income: 0, expenses: 0 };
    loanState = { principal: 0, totalDue: 0, monthlyPayment: 0, remainingInstallments: 0 };
    realEstates = createDefaultRealEstates();
    businessState = {
        shop: { name: "E-shop", image: "img-eshop.svg", value: 200000, owned: 0 },
        goods: { inProgress: false, readyToSell: false, buyPrice: 1000, sellPrice: 1100 },
        staff: { employees: 0, salaryPerEmployee: 90, autoInProgress: false }
    };
    monthTick = 0;
    elapsedMonths = 0;
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
    document.getElementById("buyPercent").value = "";
    document.getElementById("cost").innerText = "0";
    document.getElementById("trades").innerHTML = "";
    syncIndicatorCheckboxes();
    const select = document.getElementById("assetSelect");
    if (select) select.value = currentAsset;

    localStorage.removeItem(STORAGE_KEY);
    renderTrades();
    renderAssetsSidebar();
    updateAccount();
    drawChart();
    renderTransactionHistory();
    renderRealEstatePage();
    renderBusinessPage();
    renderLoansPage();
    renderMilestones(round2((balance + calculateInvestedCapital() + calculateUnrealized()) - STARTING_CAPITAL));
    renderMonthlyCashflow();
    renderGameTime();
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
