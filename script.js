/********************************************************************
 *  INVEST QUEST
 *  Hlavní cíl: zábavná naučná investiční hra pro mladé.
 *  Hráč se učí prostřednictvím rozhodnutí, následků a dlouhodobého vývoje.
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
        updateLeverageLesson();
        calculateCost();
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
const DEFAULT_LEVERAGE = 1;
const MAX_LEVERAGE = 5;
const STORAGE_KEY = "tradingGameState";
const AUTOSAVE_INTERVAL = 10000;
const SAVE_VERSION = 3;
const TRANSACTION_HISTORY_LIMIT = 1000;
const DIVIDEND_RATE = 0.003;
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

const REAL_ESTATE_PROFILES = {
    small_apartment: {
        tier: "START",
        category: "Byt • stabilní poptávka",
        risk: "Nízké riziko",
        riskKey: "low",
        occupancy: 97
    },
    medium_apartment: {
        tier: "RŮST",
        category: "Byt • vyšší kapitál",
        risk: "Nízké riziko",
        riskKey: "low",
        occupancy: 96
    },
    commercial: {
        tier: "EXPERT",
        category: "Komerce • vyšší kolísání",
        risk: "Vyšší riziko",
        riskKey: "high",
        occupancy: 88
    },
    house: {
        tier: "POKROČILÉ",
        category: "Dům • dlouhodobý pronájem",
        risk: "Střední riziko",
        riskKey: "medium",
        occupancy: 93
    }
};

function createDefaultRealEstates() {
    return {
        small_apartment: {
            name: "Malý byt",
            image: "images/real-estate/small-apartment.webp",
            value: 3500000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 10000,
            rentIncreaseBuffer: 0,
            maintenance: 2000,
            owned: 0
        },
        medium_apartment: {
            name: "Střední byt",
            image: "images/real-estate/medium-apartment.webp",
            value: 5000000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 15000,
            rentIncreaseBuffer: 0,
            maintenance: 3000,
            owned: 0
        },
        commercial: {
            name: "Komerční prostory",
            image: "images/real-estate/commercial.webp",
            value: 10000000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 30000,
            rentIncreaseBuffer: 0,
            maintenance: 7000,
            owned: 0
        },
        house: {
            name: "Rodinný dům",
            image: "images/real-estate/family-house.webp",
            value: 8000000,
            growthRate: REAL_ESTATE_GROWTH_RATE,
            monthlyRent: 24000,
            rentIncreaseBuffer: 0,
            maintenance: 4000,
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
    remainingBalance: 0,
    monthlyPayment: 0,
    remainingInstallments: 0
};
let selectedLoanAmount = 0;
const BUSINESS_PROFILES = {
    shop: {
        tier: "STARTUP",
        category: "Digitální podnikání • aktivní",
        risk: "Vyšší riziko",
        riskKey: "high"
    },
    carWash: {
        tier: "STABILNÍ PŘÍJEM",
        category: "Lokální služba • polo-pasivní",
        risk: "Nízké riziko",
        riskKey: "low"
    }
};

let businessState = {
    shop: {
        name: "E-shop",
        image: "images/business/e-shop.webp",
        value: 200000,
        owned: 0
    },
    carWash: {
        name: "Samoobslužná myčka",
        image: "images/business/car-wash.webp",
        value: 1000000,
        monthlyIncome: 10000,
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
        salaryPerEmployee: 500,
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

function getTradeLeverage(trade) {
    const leverage = Number(trade?.leverage);
    return leverage === MAX_LEVERAGE ? MAX_LEVERAGE : DEFAULT_LEVERAGE;
}

function formatLeverage(trade) {
    const leverage = getTradeLeverage(trade);
    return leverage === DEFAULT_LEVERAGE ? "1×" : `1:${leverage}`;
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
    const { affectMonthly = false } = options;
    transactionHistory.unshift({
        time: new Date().toLocaleString(),
        label,
        amount: round2(amount),
        cashflow: affectMonthly
    });
    if (transactionHistory.length > TRANSACTION_HISTORY_LIMIT) {
        transactionHistory.length = TRANSACTION_HISTORY_LIMIT;
    }
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
                        roundedPayout,
                        { affectMonthly: true }
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
        const range = max - min || 1;
        return (max - v) / range * canvas.height;
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
        const range = max - min || 1;
        return (max - v) / range * canvas.height;
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
        const range = max - min || 1;
        return (max - v) / range * canvas.height;
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
        const range = max - min || 1;
        return (max - v) / range * canvas.height;
    }

    trades
    .filter(t => (t.asset || "growth") === currentAsset)
    .forEach(t => {
        ctx.lineWidth = 1;

        if (Number.isFinite(t.sl)) {
            ctx.strokeStyle = "red";
            ctx.beginPath();
            ctx.moveTo(0, py(t.sl));
            ctx.lineTo(canvas.width, py(t.sl));
            ctx.stroke();
        }

        if (Number.isFinite(t.tp)) {
            ctx.strokeStyle = "lime";
            ctx.beginPath();
            ctx.moveTo(0, py(t.tp));
            ctx.lineTo(canvas.width, py(t.tp));
            ctx.stroke();
        }
    });
}

/* ---------------------------------------------------
      TRADE OPEN / CLOSE
--------------------------------------------------- */

function buy() { openTrade("BUY"); }
function sell() { openTrade("SELL"); }

function openTrade(type) {
    const slValue = document.getElementById("sl").value.trim();
    const tpValue = document.getElementById("tp").value.trim();
    const sl = slValue === "" ? null : Number(slValue);
    const tp = tpValue === "" ? null : Number(tpValue);
    let volume = parseFloat(document.getElementById("volume").value);
    const buyPercent = parseFloat(document.getElementById("buyPercent").value);
    const leverage = Number(document.getElementById("leverage")?.value) === MAX_LEVERAGE
        ? MAX_LEVERAGE
        : DEFAULT_LEVERAGE;

    const entry = round2(type === "BUY" ? price + SPREAD : price - SPREAD);

    if (sl !== null && !Number.isFinite(sl)) {
        return alert("Stop Loss musí být platné číslo, nebo může zůstat prázdný.");
    }
    if (tp !== null && !Number.isFinite(tp)) {
        return alert("Take Profit musí být platné číslo, nebo může zůstat prázdný.");
    }
    if (type === "BUY" && sl !== null && sl >= entry) {
        return alert("U BUY musí být Stop Loss pod vstupní cenou.");
    }
    if (type === "BUY" && tp !== null && tp <= entry) {
        return alert("U BUY musí být Take Profit nad vstupní cenou.");
    }
    if (type === "SELL" && sl !== null && sl <= entry) {
        return alert("U SELL musí být Stop Loss nad vstupní cenou.");
    }
    if (type === "SELL" && tp !== null && tp >= entry) {
        return alert("U SELL musí být Take Profit pod vstupní cenou.");
    }

    if (buyPercent && buyPercent > 0) {
        const pct = Math.min(Math.max(buyPercent, 0), 100);
        volume = round2((balance * (pct / 100) * leverage) / entry);
        document.getElementById("volume").value = volume;
    }

    if (!volume || volume <= 0) return alert("Neplatný objem.");

    const margin = round2(entry * volume / leverage);
    if (margin > balance) return alert("Nedostatek volných prostředků.");

    const trade = {
        id: tradeId++,
        asset: currentAsset,
        type,
        entry,
        sl,
        tp,
        volume,
        leverage,
        margin,
        trailing: null
    };

    balance -= margin;
    balance -= COMMISSION;
    addTransaction(`Otevřena pozice (${assets[currentAsset].name}, ${formatLeverage(trade)})`, -(margin + COMMISSION));
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
    return trades.reduce((sum, t) => sum + (t.margin ?? (t.entry * t.volume / getTradeLeverage(t))), 0);
}

function calculateRealEstateValue() {
    return Object.values(realEstates).reduce(
        (sum, item) => sum + (Number(item.value) || 0) * (Number(item.owned) || 0),
        0
    );
}

function calculateBusinessValue() {
    const shopValue = (businessState.shop?.value || 0) * (businessState.shop?.owned || 0);
    const carWashValue = (businessState.carWash?.value || 0) * (businessState.carWash?.owned || 0);
    const goodsValue = businessState.goods?.inProgress ? (businessState.goods.buyPrice || 0) : 0;
    return round2(shopValue + carWashValue + goodsValue);
}

function calculateOutstandingDebt() {
    if (!loanState || loanState.remainingInstallments <= 0) return 0;
    return round2(
        loanState.remainingBalance ??
        (loanState.remainingInstallments * loanState.monthlyPayment)
    );
}

function calculateNetWorth() {
    return round2(
        balance +
        calculateInvestedCapital() +
        calculateUnrealized() +
        calculateRealEstateValue() +
        calculateBusinessValue() -
        calculateOutstandingDebt()
    );
}

function calculateLoanLimit() {
    const assetBase =
        balance +
        calculateInvestedCapital() +
        calculateRealEstateValue() +
        calculateBusinessValue();
    return roundDownToHundreds(Math.max(50000, assetBase * 5));
}

function renderGameHud(netWorth) {
    const earned = Math.max(0, round2(netWorth - STARTING_CAPITAL));
    const levelSize = 10000;
    const level = Math.floor(earned / levelSize) + 1;
    const levelStart = (level - 1) * levelSize;
    const levelProgress = earned - levelStart;
    const levelProgressPct = Math.min(100, (levelProgress / levelSize) * 100);
    const titles = [
        "Začínající investor",
        "Průzkumník trhu",
        "Tvůrce portfolia",
        "Správce majetku",
        "Investiční stratég",
        "Finanční vizionář"
    ];
    const title = titles[Math.min(level - 1, titles.length - 1)];
    const debt = calculateOutstandingDebt();
    const grossAssets = Math.max(0, netWorth + debt);
    const debtRatio = grossAssets > 0 ? debt / grossAssets : (debt > 0 ? 1 : 0);
    const cashflowNet = round2(monthlyCashflow.income - monthlyCashflow.expenses);

    const levelEl = document.getElementById("playerLevel");
    const titleEl = document.getElementById("playerTitle");
    const xpBar = document.getElementById("playerXpBar");
    const xpText = document.getElementById("playerXpText");
    const debtEl = document.getElementById("topDebt");
    const missionEl = document.getElementById("currentMissionProgress");
    const healthEl = document.getElementById("healthStatus");
    const healthDot = document.getElementById("healthDot");
    const healthHint = document.getElementById("healthHint");
    const monthlyNetEl = document.getElementById("monthlyNet");

    if (levelEl) levelEl.innerText = `LVL ${level}`;
    if (titleEl) titleEl.innerText = title;
    if (xpBar) xpBar.style.width = `${levelProgressPct}%`;
    if (xpText) xpText.innerText =
        `${formatNumberGrouped(levelProgress)} / ${formatNumberGrouped(levelSize)} XP`;
    if (debtEl) debtEl.innerHTML = formatCurrencyInt(debt);
    if (missionEl) {
        missionEl.innerText =
            `${Math.round(Math.min(100, earned / milestonesState.firstTarget * 100))} %`;
    }

    let health = "Stabilní";
    let healthClass = "";
    let hint = "Majetek po odečtení všech dluhů";

    if (netWorth < 0 || debtRatio > 0.60) {
        health = "Riziková";
        healthClass = "danger";
        hint = "Vysoký dluh ohrožuje tvoji finanční stabilitu";
    } else if (cashflowNet < 0 || debtRatio > 0.35) {
        health = "Napjatá";
        healthClass = "warning";
        hint = "Sleduj záporné cashflow a zatížení dluhem";
    }

    if (healthEl) healthEl.innerText = health;
    if (healthDot) healthDot.className = `health-dot ${healthClass}`.trim();
    if (healthHint) healthHint.innerText = hint;
    if (monthlyNetEl) {
        monthlyNetEl.classList.toggle("positive-value", cashflowNet > 0);
        monthlyNetEl.classList.toggle("negative-value", cashflowNet < 0);
    }
}

/* ---------------------------------------------------
      TRAILING STOP
--------------------------------------------------- */

function updateTrailing(trade) {
    if (!trade.trailing) return;
    const assetPrice = getAssetPrice(trade.asset || currentAsset);

    if (trade.type === "BUY") {
        const newSL = assetPrice - trade.trailing;
        if (!Number.isFinite(trade.sl) || newSL > trade.sl) trade.sl = newSL;
    } else {
        const newSL = assetPrice + trade.trailing;
        if (!Number.isFinite(trade.sl) || newSL < trade.sl) trade.sl = newSL;
    }
}

/* ---------------------------------------------------
      TP/SL CHECK
--------------------------------------------------- */

function checkAllTrades() {
    [...trades].forEach(trade => {
        const assetPrice = getAssetPrice(trade.asset || currentAsset);
        updateTrailing(trade);

        const margin = trade.margin ?? (trade.entry * trade.volume / getTradeLeverage(trade));
        if (calculatePnL(trade) <= -margin) {
            closeTrade(trade.id, "Margin call");
            return;
        }

        if (trade.type === "BUY") {
            if (Number.isFinite(trade.sl) && assetPrice <= trade.sl) closeTrade(trade.id, "SL hit");
            if (Number.isFinite(trade.tp) && assetPrice >= trade.tp) closeTrade(trade.id, "TP hit");
        }

        if (trade.type === "SELL") {
            if (Number.isFinite(trade.sl) && assetPrice >= trade.sl) closeTrade(trade.id, "SL hit");
            if (Number.isFinite(trade.tp) && assetPrice <= trade.tp) closeTrade(trade.id, "TP hit");
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
    const margin = trade.margin ?? (trade.entry * trade.volume / getTradeLeverage(trade));
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
    leverage: getTradeLeverage(trade),
    margin: trade.margin ?? (trade.entry * trade.volume / getTradeLeverage(trade)),
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
            Entry: ${trade.entry} | Páka: ${formatLeverage(trade)} | SL: ${Number.isFinite(trade.sl) ? trade.sl : "—"} | TP: ${Number.isFinite(trade.tp) ? trade.tp : "—"} |
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
            ${trade.type} | Entry: ${trade.entry} | Páka: ${formatLeverage(trade)} |
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
    let maintenanceExpense = 0;

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
        if (item.owned > 0 && item.maintenance > 0) {
            maintenanceExpense += item.owned * item.maintenance;
        }
    });

    if (rentIncome > 0) {
        balance = round2(balance + rentIncome);
        addTransaction("Nájemné z nemovitostí", rentIncome, { affectMonthly: true });
    }
    if (maintenanceExpense > 0) {
        balance = round2(balance - maintenanceExpense);
        addTransaction("Údržba nemovitostí", -maintenanceExpense, { affectMonthly: true });
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

function buyCarWash() {
    const item = businessState.carWash;
    if (balance < item.value) return alert("Nedostatek volných prostředků.");
    balance = round2(balance - item.value);
    item.owned += 1;
    addTransaction("Koupeno: Samoobslužná myčka", -item.value);
    renderBusinessPage();
    updateAccount();
}

function sellCarWash() {
    const item = businessState.carWash;
    if (item.owned <= 0) return alert("Samoobslužnou myčku aktuálně nevlastníš.");
    item.owned -= 1;
    balance = round2(balance + item.value);
    addTransaction("Prodáno: Samoobslužná myčka", item.value);
    renderBusinessPage();
    updateAccount();
}

function hireEmployee() {
    if (businessState.shop.owned <= 0) return alert("Nejdřív musíš vlastnit e-shop.");
    const hireCost = 10000;
    if (balance < hireCost) return alert("Nedostatek volných prostředků na nábor zaměstnance.");
    balance = round2(balance - hireCost);
    addTransaction("Nábor zaměstnance (e-shop)", -hireCost, { affectMonthly: true });
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
    addTransaction("Nákup zboží (e-shop)", -businessState.goods.buyPrice, { affectMonthly: true });
    renderBusinessPage();
    updateAccount();
}

function sellBusinessGoods() {
    if (businessState.staff.employees > 0) return alert("Se zaměstnanci probíhá nákup/prodej automaticky.");
    if (!businessState.goods.inProgress) return alert("Nejdřív nakup zboží.");
    if (!businessState.goods.readyToSell) return alert("Zboží můžeš prodat až po jednom měsíci.");

    balance = round2(balance + businessState.goods.sellPrice);
    addTransaction("Prodej zboží (e-shop)", businessState.goods.sellPrice, { affectMonthly: true });
    businessState.goods.inProgress = false;
    businessState.goods.readyToSell = false;
    renderBusinessPage();
    updateAccount();
}

function processBusinessMonth() {
    if (businessState.carWash.owned > 0) {
        const washIncome = round2(businessState.carWash.owned * businessState.carWash.monthlyIncome);
        balance = round2(balance + washIncome);
        addTransaction("Příjem: Samoobslužná myčka", washIncome, { affectMonthly: true });
    }

    if (businessState.shop.owned > 0 && businessState.staff.employees > 0) {
        const employees = businessState.staff.employees;
        const salaryTotal = round2(employees * businessState.staff.salaryPerEmployee);
        balance = round2(balance - salaryTotal);
        addTransaction("Mzdy zaměstnanců (e-shop)", -salaryTotal, { affectMonthly: true });

        const autoBuy = round2(10000 * employees);
        const autoSell = round2(autoBuy * 1.1);

        if (businessState.staff.autoInProgress) {
            balance = round2(balance + autoSell);
            addTransaction("Automatický prodej zboží (e-shop)", autoSell, { affectMonthly: true });
        }

        if (balance >= autoBuy) {
            balance = round2(balance - autoBuy);
            addTransaction("Automatický nákup zboží (e-shop)", -autoBuy, { affectMonthly: true });
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

    const payment = round2(Math.min(
        loanState.monthlyPayment,
        loanState.remainingBalance ?? loanState.totalDue
    ));
    balance = round2(balance - payment);
    loanState.remainingBalance = round2(
        Math.max(0, (loanState.remainingBalance ?? loanState.totalDue) - payment)
    );
    loanState.remainingInstallments -= 1;
    addTransaction("Splátka půjčky", -payment, { affectMonthly: true });

    if (loanState.remainingInstallments <= 0 || loanState.remainingBalance <= 0) {
        loanState = {
            principal: 0,
            totalDue: 0,
            remainingBalance: 0,
            monthlyPayment: 0,
            remainingInstallments: 0
        };
    }

    if (!document.getElementById("loansPage")?.classList.contains("hidden")) {
        renderLoansPage();
    }
}

function borrowLoan() {
    const maxLoan = calculateLoanLimit();
    const amount = roundDownToHundreds(selectedLoanAmount);
    if (!amount || amount <= 0) return alert("Neplatná výše půjčky.");
    if (loanState.remainingInstallments > 0) return alert("Nejdřív doplať stávající půjčku.");
    if (amount > maxLoan) return alert("Překročen maximální limit půjčky.");

    loanState.principal = round2(amount);
    loanState.totalDue = round2(amount * 1.05);
    loanState.remainingBalance = loanState.totalDue;
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
    const amountToRepay = calculateOutstandingDebt();
    if (balance < amountToRepay) return alert("Na splacení půjčky nemáš dostatek volných prostředků.");

    balance = round2(balance - amountToRepay);
    addTransaction("Předčasné splacení půjčky", -amountToRepay);
    loanState = {
        principal: 0,
        totalDue: 0,
        remainingBalance: 0,
        monthlyPayment: 0,
        remainingInstallments: 0
    };
    selectedLoanAmount = 0;
    renderLoansPage();
    updateAccount();
}

function selectLoanOffer(percent) {
    const maxLoan = calculateLoanLimit();
    selectedLoanAmount = roundDownToHundreds(maxLoan * percent);
    renderLoansPage();
}

function renderLoansPage() {
    const maxEl = document.getElementById("loanMaxValue");
    const infoEl = document.getElementById("loanInfo");
    const presetEl = document.getElementById("loanPresetButtons");
    if (!maxEl || !infoEl || !presetEl) return;

    const maxLoan = calculateLoanLimit();
    const options = [
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
        const remainingToPay = calculateOutstandingDebt();
        infoEl.innerHTML = `
            <p>Aktivní půjčka: <strong>${formatCurrencyInt(loanState.principal)}</strong></p>
            <p>Celkem k úhradě: <strong>${formatCurrencyInt(loanState.totalDue)}</strong></p>
            <p>Měsíční splátka: <strong>${formatCurrencyInt(loanState.monthlyPayment)}</strong></p>
            <p>Zbývá splátek: <strong>${loanState.remainingInstallments}</strong></p>
            <p>Zbývá doplatit: <strong>${formatCurrencyInt(remainingToPay)}</strong></p>
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
    loanState.remainingBalance = round2(
        (loanState.remainingBalance ?? calculateOutstandingDebt()) + addedTotalDue
    );
    loanState.remainingInstallments = installments;
    loanState.monthlyPayment = round2(loanState.remainingBalance / loanState.remainingInstallments);

    balance = 0;
    addTransaction("Automatická půjčka", needed, { affectMonthly: false });
    alert(`Volné prostředky šly do mínusu. Byla automaticky poskytnuta půjčka ${needed.toFixed(2)} 🪙 s úrokem 10 %.`);
    renderLoansPage();
}

function renderRealEstatePage() {
    const grid = document.getElementById("realEstateGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const formatPercent = value => `${Number(value).toLocaleString("cs-CZ", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })} %`;

    Object.entries(realEstates).forEach(([key, item]) => {
        const profile = REAL_ESTATE_PROFILES[key] || {
            tier: "INVESTICE",
            category: "Nemovitost",
            risk: "Neznámé riziko",
            riskKey: "medium",
            occupancy: 90
        };
        const netMonthlyCashflow = round2(item.monthlyRent - item.maintenance);
        const grossYield = item.value > 0 ? (item.monthlyRent * 12 / item.value) * 100 : 0;
        const netYield = item.value > 0 ? (netMonthlyCashflow * 12 / item.value) * 100 : 0;
        const paybackYears = netMonthlyCashflow > 0 ? item.value / (netMonthlyCashflow * 12) : null;
        const canBuy = item.value > 0 && balance >= item.value;
        const canSell = item.owned > 0;
        const missingFunds = Math.max(0, item.value - balance);
        const ownershipLabel = item.owned > 0 ? `Vlastním ${item.owned}×` : "Zatím nevlastním";
        const availabilityLabel = canBuy
            ? "Připraveno k nákupu"
            : `K nákupu chybí ${formatCurrencyInt(missingFunds)}`;

        const card = document.createElement("article");
        card.className = `realestate-card property-card risk-${profile.riskKey}`;
        card.innerHTML = `
            <div class="property-media">
                <img src="${item.image || "images/real-estate/family-house.webp"}" alt="${item.name}" class="entity-image" loading="lazy" decoding="async">
                <div class="property-badges">
                    <span class="property-tier">${profile.tier}</span>
                    <span class="property-risk risk-${profile.riskKey}"><i></i>${profile.risk}</span>
                </div>
            </div>

            <div class="property-content">
                <div class="property-heading">
                    <div>
                        <span class="property-kicker">${profile.category}</span>
                        <h3>${item.name}</h3>
                    </div>
                    <div class="property-price">
                        <span>Aktuální cena</span>
                        <strong>${formatCurrencyInt(item.value)}</strong>
                    </div>
                </div>

                <div class="property-metrics">
                    <div class="property-metric primary">
                        <span>Čisté cashflow</span>
                        <strong>${formatCurrencyInt(netMonthlyCashflow)} <small>/ měsíc</small></strong>
                    </div>
                    <div class="property-metric">
                        <span>Hrubý výnos</span>
                        <strong>${formatPercent(grossYield)}</strong>
                    </div>
                    <div class="property-metric">
                        <span>Čistý výnos</span>
                        <strong>${formatPercent(netYield)}</strong>
                    </div>
                    <div class="property-metric">
                        <span>Obsazenost</span>
                        <strong>${profile.occupancy} %</strong>
                    </div>
                    <div class="property-metric">
                        <span>Návratnost</span>
                        <strong>${paybackYears ? `${paybackYears.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} let` : "—"}</strong>
                    </div>
                </div>

                <div class="property-breakdown">
                    <div><span>Měsíční nájem</span><strong>${formatCurrencyInt(item.monthlyRent)}</strong></div>
                    <div><span>Údržba</span><strong>− ${formatCurrencyInt(item.maintenance)}</strong></div>
                    <div><span>Portfolio</span><strong>${ownershipLabel}</strong></div>
                </div>

                <div class="property-availability ${canBuy ? "available" : "locked"}">
                    <span class="availability-dot"></span>
                    <span>${availabilityLabel}</span>
                </div>

                <div class="toolbar property-actions">
                    <button class="buy-btn" onclick="buyRealEstate('${key}')" ${canBuy ? "" : "disabled"}>Koupit za ${formatCurrencyInt(item.value)}</button>
                    <button class="sell-btn" onclick="sellRealEstate('${key}')" ${canSell ? "" : "disabled"}>Prodat</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderBusinessPage() {
    const grid = document.getElementById("businessGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const shop = businessState.shop;
    const goods = businessState.goods;
    const staff = businessState.staff;
    const shopProfile = BUSINESS_PROFILES.shop;
    const autoBuy = round2(10000 * staff.employees);
    const autoSell = round2(autoBuy * 1.1);
    const salaryTotal = round2(staff.salaryPerEmployee * staff.employees);
    const automatedMonthlyProfit = round2(autoSell - autoBuy - salaryTotal);
    const manualProfit = round2(goods.sellPrice - goods.buyPrice);
    const goodsMargin = goods.buyPrice > 0 ? ((goods.sellPrice - goods.buyPrice) / goods.buyPrice) * 100 : 0;
    const canPurchaseShop = shop.owned < 1 && shop.value > 0 && balance >= shop.value;
    const canSellShop = shop.owned > 0 && staff.employees === 0 && !goods.inProgress && !staff.autoInProgress;
    const canBuyGoods = shop.owned > 0 && staff.employees === 0 && !goods.inProgress && balance >= goods.buyPrice;
    const canSellGoods = shop.owned > 0 && staff.employees === 0 && goods.inProgress && goods.readyToSell;
    const canHire = shop.owned > 0 && balance >= 10000;
    const canFire = shop.owned > 0 && staff.employees > 0;
    const shopMode = staff.employees > 0 ? "Automatizovaný provoz" : "Ruční provoz";
    const goodsStatus = goods.inProgress
        ? (goods.readyToSell ? "Připraveno k prodeji" : "Zboží čeká na další měsíc")
        : "Sklad je prázdný";
    const shopStatus = shop.owned > 0
        ? `Provoz aktivní • ${shopMode.toLowerCase()}`
        : (canPurchaseShop
            ? "Připraveno k nákupu"
            : `K nákupu chybí ${formatCurrencyInt(Math.max(0, shop.value - balance))}`);

    const shopCard = document.createElement("article");
    shopCard.className = `realestate-card property-card business-card risk-${shopProfile.riskKey}`;
    shopCard.innerHTML = `
        <div class="property-media">
            <img src="images/business/e-shop.webp" alt="${shop.name}" class="entity-image" loading="lazy" decoding="async">
            <div class="property-badges">
                <span class="property-tier">${shopProfile.tier}</span>
                <span class="property-risk risk-${shopProfile.riskKey}"><i></i>${shopProfile.risk}</span>
            </div>
        </div>

        <div class="property-content">
            <div class="property-heading">
                <div>
                    <span class="property-kicker">${shopProfile.category}</span>
                    <h3>${shop.name}</h3>
                </div>
                <div class="property-price">
                    <span>Pořizovací cena</span>
                    <strong>${formatCurrencyInt(shop.value)}</strong>
                </div>
            </div>

            <div class="property-metrics business-metrics">
                <div class="property-metric primary">
                    <span>Potenciál zisku</span>
                    <strong>${formatCurrencyInt(staff.employees > 0 ? automatedMonthlyProfit : manualProfit)} <small>/ měsíc</small></strong>
                </div>
                <div class="property-metric">
                    <span>Marže zboží</span>
                    <strong>${goodsMargin.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %</strong>
                </div>
                <div class="property-metric">
                    <span>Zaměstnanci</span>
                    <strong>${staff.employees}</strong>
                </div>
                <div class="property-metric">
                    <span>Auto nákup</span>
                    <strong>${formatCurrencyInt(autoBuy)}</strong>
                </div>
                <div class="property-metric">
                    <span>Auto prodej</span>
                    <strong>${formatCurrencyInt(autoSell)}</strong>
                </div>
            </div>

            <div class="property-breakdown">
                <div><span>Portfolio</span><strong>${shop.owned > 0 ? "Vlastním" : "Nevlastním"}</strong></div>
                <div><span>Mzdy za měsíc</span><strong>− ${formatCurrencyInt(salaryTotal)}</strong></div>
                <div><span>Režim</span><strong>${shopMode}</strong></div>
            </div>

            <div class="business-learning-note">
                <span>💡</span>
                <span>Marže není čistý zisk. Automatizace přidává objem, ale také mzdy zaměstnanců.</span>
            </div>

            <div class="property-availability ${shop.owned > 0 || canPurchaseShop ? "available" : "locked"}">
                <span class="availability-dot"></span>
                <span>${shopStatus}</span>
            </div>

            <div class="toolbar property-actions">
                <button class="buy-btn" onclick="buyBusinessShop()" ${canPurchaseShop ? "" : "disabled"}>Koupit za ${formatCurrencyInt(shop.value)}</button>
                <button class="sell-btn" onclick="sellBusinessShop()" ${canSellShop ? "" : "disabled"}>Prodat</button>
            </div>

            ${shop.owned > 0 ? `
                <div class="business-operations">
                    <div class="business-operations-heading">
                        <div>
                            <span class="property-kicker">ŘÍZENÍ PROVOZU</span>
                            <strong>E-shop operace</strong>
                        </div>
                        <span class="operation-state ${staff.autoInProgress || goods.inProgress ? "running" : ""}">${goodsStatus}</span>
                    </div>
                    <div class="operations-actions">
                        <button onclick="buyBusinessGoods()" ${canBuyGoods ? "" : "disabled"}>Nakoupit zboží</button>
                        <button onclick="sellBusinessGoods()" ${canSellGoods ? "" : "disabled"}>Prodat zboží</button>
                        <button onclick="hireEmployee()" ${canHire ? "" : "disabled"}>Najmout zaměstnance</button>
                        <button onclick="fireEmployee()" ${canFire ? "" : "disabled"}>Propustit zaměstnance</button>
                    </div>
                </div>
            ` : ""}
        </div>
    `;
    grid.appendChild(shopCard);

    const wash = businessState.carWash;
    const washProfile = BUSINESS_PROFILES.carWash;
    const washAnnualIncome = round2(wash.monthlyIncome * 12);
    const washYield = wash.value > 0 ? (washAnnualIncome / wash.value) * 100 : 0;
    const washPayback = washAnnualIncome > 0 ? wash.value / washAnnualIncome : null;
    const canBuyWash = wash.value > 0 && balance >= wash.value;
    const canSellWash = wash.owned > 0;
    const washStatus = canBuyWash
        ? "Připraveno k nákupu"
        : `K nákupu chybí ${formatCurrencyInt(Math.max(0, wash.value - balance))}`;

    const washCard = document.createElement("article");
    washCard.className = `realestate-card property-card business-card risk-${washProfile.riskKey}`;
    washCard.innerHTML = `
        <div class="property-media">
            <img src="images/business/car-wash.webp" alt="${wash.name}" class="entity-image" loading="lazy" decoding="async">
            <div class="property-badges">
                <span class="property-tier">${washProfile.tier}</span>
                <span class="property-risk risk-${washProfile.riskKey}"><i></i>${washProfile.risk}</span>
            </div>
        </div>

        <div class="property-content">
            <div class="property-heading">
                <div>
                    <span class="property-kicker">${washProfile.category}</span>
                    <h3>${wash.name}</h3>
                </div>
                <div class="property-price">
                    <span>Pořizovací cena</span>
                    <strong>${formatCurrencyInt(wash.value)}</strong>
                </div>
            </div>

            <div class="property-metrics business-metrics">
                <div class="property-metric primary">
                    <span>Měsíční příjem</span>
                    <strong>${formatCurrencyInt(wash.monthlyIncome)} <small>/ provoz</small></strong>
                </div>
                <div class="property-metric">
                    <span>Roční příjem</span>
                    <strong>${formatCurrencyInt(washAnnualIncome)}</strong>
                </div>
                <div class="property-metric">
                    <span>Hrubý výnos</span>
                    <strong>${washYield.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %</strong>
                </div>
                <div class="property-metric">
                    <span>Návratnost</span>
                    <strong>${washPayback ? `${washPayback.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} let` : "—"}</strong>
                </div>
                <div class="property-metric">
                    <span>Počet provozů</span>
                    <strong>${wash.owned}</strong>
                </div>
            </div>

            <div class="property-breakdown">
                <div><span>Portfolio</span><strong>${wash.owned > 0 ? `Vlastním ${wash.owned}×` : "Nevlastním"}</strong></div>
                <div><span>Typ příjmu</span><strong>Polo-pasivní</strong></div>
                <div><span>Výplata</span><strong>Každý měsíc</strong></div>
            </div>

            <div class="business-learning-note warning">
                <span>💡</span>
                <span>Výnos je v současném modelu hrubý — před případnými provozními náklady.</span>
            </div>

            <div class="property-availability ${canBuyWash ? "available" : "locked"}">
                <span class="availability-dot"></span>
                <span>${washStatus}</span>
            </div>

            <div class="toolbar property-actions">
                <button class="buy-btn" onclick="buyCarWash()" ${canBuyWash ? "" : "disabled"}>Koupit za ${formatCurrencyInt(wash.value)}</button>
                <button class="sell-btn" onclick="sellCarWash()" ${canSellWash ? "" : "disabled"}>Prodat</button>
            </div>
        </div>
    `;
    grid.appendChild(washCard);
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

    const pageEyebrow = document.getElementById("pageEyebrow");
    const pageTitle = document.getElementById("pageTitle");
    const pageSubtitle = document.getElementById("pageSubtitle");
    const pageMeta = {
        trading: {
            eyebrow: "Kapitola 1 · Budování majetku",
            title: "Tvoje finanční cesta",
            subtitle: "Rozhoduj se chytře a vybuduj portfolio, které tě uživí."
        },
        realestate: {
            eyebrow: "Kapitola 2 · Hmotný majetek",
            title: "Svět nemovitostí",
            subtitle: "Porovnávej cenu, nájem, růst hodnoty a pravidelné náklady."
        },
        business: {
            eyebrow: "Kapitola 3 · Aktivní příjem",
            title: "Podnikatelská čtvrť",
            subtitle: "Buduj firmy a uč se pracovat s marží, lidmi a provozními náklady."
        },
        loans: {
            eyebrow: "Kapitola 4 · Cizí kapitál",
            title: "Banka",
            subtitle: "Používej dluh jako nástroj, ne jako náhradu zdravého cashflow."
        },
        milestones: {
            eyebrow: "Herní postup · Dlouhodobé cíle",
            title: "Výzvy a milníky",
            subtitle: "Postup od prvních úspor až k finanční svobodě."
        },
        cheats: {
            eyebrow: "Vývojářská zóna · Testování",
            title: "Finanční laboratoř",
            subtitle: "Ověřuj herní scénáře bez omezení běžného postupu."
        }
    };
    const meta = pageMeta[view] || pageMeta.trading;
    if (pageEyebrow) pageEyebrow.innerText = meta.eyebrow;
    if (pageTitle) pageTitle.innerText = meta.title;
    if (pageSubtitle) pageSubtitle.innerText = meta.subtitle;

    tradingPage?.classList.toggle("hidden", view !== "trading");
    realEstatePage?.classList.toggle("hidden", view !== "realestate");
    businessPage?.classList.toggle("hidden", view !== "business");
    loansPage?.classList.toggle("hidden", view !== "loans");
    milestonesPage?.classList.toggle("hidden", view !== "milestones");
    cheatsPage?.classList.toggle("hidden", view !== "cheats");
    assetsSidebarCard?.classList.toggle("hidden", view !== "trading");
    assetsSidebarCard?.classList.toggle("align-chart", view === "trading");
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
            .reduce(
                (sum, t) =>
                    sum +
                    (t.margin ?? (t.entry * t.volume / getTradeLeverage(t))) +
                    calculatePnL(t),
                0
            )
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
            value:
                (businessState.shop?.value || 0) * (businessState.shop?.owned || 0) +
                (businessState.carWash?.value || 0) * (businessState.carWash?.owned || 0),
            color: "#06b6d4"
        }
    ].filter(s => s.value > 0);

    const incomeMap = new Map();
    const costMap = new Map();
    transactionHistory.forEach(tx => {
        if (!tx.cashflow) return;
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
    let total = calculateNetWorth();
    const earnedProfit = round2(total - STARTING_CAPITAL);

    document.getElementById("balance").innerHTML = formatCurrencyInt(balance);
    document.getElementById("invested").innerHTML = formatCurrencyInt(invested);
    document.getElementById("unrealized").innerHTML = formatCurrencyInt(unreal);
    document.getElementById("total").innerHTML = formatCurrencyInt(total);
    renderMonthlyCashflow();
    renderMilestones(earnedProfit);
    renderGameHud(total);

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

function updateLeverageLesson() {
    const leverage = Number(document.getElementById("leverage")?.value) === MAX_LEVERAGE
        ? MAX_LEVERAGE
        : DEFAULT_LEVERAGE;
    const title = document.getElementById("leverageLessonTitle");
    const text = document.getElementById("leverageLessonText");
    const ruleTitle = document.getElementById("leverageRuleTitle");
    const ruleText = document.getElementById("leverageRuleText");
    const lesson = document.querySelector(".risk-lesson");

    if (leverage === MAX_LEVERAGE) {
        if (title) title.innerText = "Páka násobí zisk i ztrátu";
        if (text) text.innerText = "S pákou 1:5 ovládáš pětkrát větší pozici. Pohyb ceny o 1 % znamená přibližně 5% změnu vložené marže.";
        if (ruleTitle) ruleTitle.innerText = "Riziko margin callu";
        if (ruleText) ruleText.innerText = "Když ztráta spotřebuje celou marži, hra pozici automaticky uzavře.";
        lesson?.classList.add("leverage-active");
    } else {
        if (title) title.innerText = "Neinvestuj vše do jedné sázky";
        if (text) text.innerText = "Bez páky odpovídá expozice vložené částce. Stop Loss může dále omezit možnou ztrátu.";
        if (ruleTitle) ruleTitle.innerText = "Pravidlo hry";
        if (ruleText) ruleText.innerText = "Nejdřív chraň kapitál, potom hledej výnos.";
        lesson?.classList.remove("leverage-active");
    }
}

function calculateCost() {
    const volume = parseFloat(document.getElementById("volume").value);
    const buyPercent = parseFloat(document.getElementById("buyPercent").value);
    const leverage = Number(document.getElementById("leverage")?.value) === MAX_LEVERAGE
        ? MAX_LEVERAGE
        : DEFAULT_LEVERAGE;

    let margin = 0;
    let exposure = 0;
    if (buyPercent && buyPercent > 0) {
        const pct = Math.min(Math.max(buyPercent, 0), 100);
        margin = balance * (pct / 100);
        exposure = margin * leverage;
    } else if (volume && volume > 0) {
        exposure = price * volume;
        margin = exposure / leverage;
    }

    document.getElementById("cost").innerText = formatCurrencyInt(margin);
    const exposureEl = document.getElementById("positionExposure");
    if (exposureEl) {
        exposureEl.innerText = `Expozice ${formatCurrencyInt(exposure)} • ${leverage === 1 ? "bez páky" : `páka 1:${leverage}`}`;
    }
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
    text += `=== SAVE VERSION ===\nVersion: ${SAVE_VERSION}\n\n`;
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
            text += `SL: ${Number.isFinite(t.sl) ? t.sl : "none"}\n`;
            text += `TP: ${Number.isFinite(t.tp) ? t.tp : "none"}\n`;
            text += `Volume: ${t.volume}\n`;
            text += `Leverage: ${getTradeLeverage(t)}\n`;
            text += `Margin: ${t.margin ?? (t.entry * t.volume / getTradeLeverage(t))}\n`;
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
                text += `Leverage: ${getTradeLeverage(t)}\n`;
                text += `Margin: ${t.margin ?? (t.entry * t.volume / getTradeLeverage(t))}\n`;
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
    try {
        localStorage.setItem(STORAGE_KEY, buildSaveText());
    } catch (error) {
        console.error("Automatické uložení selhalo:", error);
    }
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
        shop: { name: "E-shop", image: "images/business/e-shop.webp", value: 200000, owned: 0 },
        carWash: { name: "Samoobslužná myčka", image: "images/business/car-wash.webp", value: 1000000, monthlyIncome: 10000, owned: 0 },
        goods: { inProgress: false, readyToSell: false, buyPrice: 1000, sellPrice: 1100 },
        staff: { employees: 0, salaryPerEmployee: 500, autoInProgress: false }
    };
    monthTick = 0;
    elapsedMonths = 0;
    loanState = { principal: 0, totalDue: 0, remainingBalance: 0, monthlyPayment: 0, remainingInstallments: 0 };
    window.closedTrades = [];
    let hasAssetStates = false;

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
                if (assets.dividend) assets.dividend.dividendRate = DIVIDEND_RATE;
                if (assets.dividend2) assets.dividend2.dividendRate = DIVIDEND_RATE;
                hasAssetStates = true;
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
                    amount: round2(item.amount ?? 0),
                    cashflow: Boolean(item.cashflow)
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
                const defaults = createDefaultRealEstates();
                realEstates = Object.fromEntries(
                    Object.entries(defaults).map(([key, defaultItem]) => {
                        const savedItem = parsedRealEstate[key] || {};
                        const migratedItem = { ...defaultItem, ...savedItem };
                        if (!Number(savedItem.maintenance) || savedItem.maintenance <= 0) {
                            migratedItem.maintenance = defaultItem.maintenance;
                        }
                        if (key === "house" && (!Number(savedItem.value) || savedItem.value <= 0)) {
                            migratedItem.name = defaultItem.name;
                            migratedItem.value = defaultItem.value;
                            migratedItem.growthRate = defaultItem.growthRate;
                            migratedItem.monthlyRent = defaultItem.monthlyRent;
                            migratedItem.maintenance = defaultItem.maintenance;
                        }
                        return [key, migratedItem];
                    })
                );
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
                        image: parsedBusiness.shop?.image || "images/business/e-shop.webp",
                        value: round2(parsedBusiness.shop?.value ?? 200000),
                        owned: Math.min(1, Number(parsedBusiness.shop?.owned ?? 0))
                    },
                    carWash: {
                        name: parsedBusiness.carWash?.name || "Samoobslužná myčka",
                        image: parsedBusiness.carWash?.image || "images/business/car-wash.webp",
                        value: round2(parsedBusiness.carWash?.value ?? 1000000),
                        monthlyIncome: round2(parsedBusiness.carWash?.monthlyIncome ?? 10000),
                        owned: Number(parsedBusiness.carWash?.owned ?? 0)
                    },
                    goods: {
                        inProgress: Boolean(parsedBusiness.goods?.inProgress),
                        readyToSell: Boolean(parsedBusiness.goods?.readyToSell),
                        buyPrice: round2(parsedBusiness.goods?.buyPrice ?? 1000),
                        sellPrice: round2(parsedBusiness.goods?.sellPrice ?? 1100)
                    },
                    staff: {
                        employees: Number(parsedBusiness.staff?.employees ?? 0),
                        salaryPerEmployee: Math.max(500, round2(parsedBusiness.staff?.salaryPerEmployee ?? 500)),
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
                const remainingInstallments = Number(parsedLoan.remainingInstallments ?? 0);
                const monthlyPayment = round2(parsedLoan.monthlyPayment ?? 0);
                loanState = {
                    principal: round2(parsedLoan.principal ?? 0),
                    totalDue: round2(parsedLoan.totalDue ?? 0),
                    remainingBalance: round2(
                        parsedLoan.remainingBalance ??
                        (remainingInstallments * monthlyPayment)
                    ),
                    monthlyPayment,
                    remainingInstallments
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
                const slMatch = b.match(/SL:\s*([0-9.]+)/);
                t.sl = slMatch ? Number(slMatch[1]) : null;
                const tpMatch = b.match(/TP:\s*([0-9.]+)/);
                t.tp = tpMatch ? Number(tpMatch[1]) : null;
                t.volume = Number(b.match(/Volume:\s*([0-9.]+)/)?.[1]);
                t.leverage = Number(b.match(/Leverage:\s*(1|5)/)?.[1]) || DEFAULT_LEVERAGE;
                t.margin = Number(b.match(/Margin:\s*([0-9.]+)/)?.[1]);
                t.trailing = null;
                if (Number.isNaN(t.margin)) t.margin = t.entry * t.volume / getTradeLeverage(t);

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
                t.leverage = Number(b.match(/Leverage:\s*(1|5)/)?.[1]) || DEFAULT_LEVERAGE;
                t.margin = Number(b.match(/Margin:\s*([0-9.]+)/)?.[1]);
                t.pnl = Number(b.match(/P\/L:\s*(-?[0-9.]+)/)?.[1]);
                t.reason = b.match(/Reason:\s*(.*)/)?.[1];

                if (!isNaN(t.entry)) window.closedTrades.push(t);
            }
        });
    }

    /* ----- CANDLES: legacy saves only ----- */
    if (!hasAssetStates) {
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
        if (candles.length === 0) candles = generateFlatCandles(price);
        assets[currentAsset].candles = candles;
        assets[currentAsset].price = price;
        assets[currentAsset].velocity = 0;
        assets[currentAsset].tick = 0;
        assets[currentAsset].tradeMarkers = [];
    }
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
    updateLeverageLesson();

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
    loanState = { principal: 0, totalDue: 0, remainingBalance: 0, monthlyPayment: 0, remainingInstallments: 0 };
    selectedLoanAmount = 0;
    realEstates = createDefaultRealEstates();
    businessState = {
        shop: { name: "E-shop", image: "images/business/e-shop.webp", value: 200000, owned: 0 },
        carWash: { name: "Samoobslužná myčka", image: "images/business/car-wash.webp", value: 1000000, monthlyIncome: 10000, owned: 0 },
        goods: { inProgress: false, readyToSell: false, buyPrice: 1000, sellPrice: 1100 },
        staff: { employees: 0, salaryPerEmployee: 500, autoInProgress: false }
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
    const leverageSelect = document.getElementById("leverage");
    if (leverageSelect) leverageSelect.value = String(DEFAULT_LEVERAGE);
    document.getElementById("cost").innerText = "0";
    const exposureEl = document.getElementById("positionExposure");
    if (exposureEl) exposureEl.innerText = "Expozice 0";
    updateLeverageLesson();
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
