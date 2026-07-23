/********************************************************************
 *  INVEST QUEST
 *  Hlavní cíl: zábavná naučná investiční hra pro mladé.
 *  Hráč se učí prostřednictvím rozhodnutí, následků a dlouhodobého vývoje.
 ********************************************************************/
window.addEventListener("load", () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const loaded = saved ? parseImportedData(saved, { silent: true }) : false;

    if (loaded) {
        console.log("Automaticky načten poslední uložený stav.");
    } else {
        if (saved) localStorage.removeItem(STORAGE_KEY);
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
    renderWorldPanel();
    refreshSaveSlots();
    updateAutosaveStatus(loaded ? "Automatický postup načten" : "Automatické ukládání aktivní");
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
const SAVE_SLOT_PREFIX = "investQuestSaveSlot";
const AUTOSAVE_INTERVAL = 10000;
const SAVE_VERSION = 6;
const TRANSACTION_HISTORY_LIMIT = 1000;
const DIVIDEND_RATE = 0.003;
const DIVIDEND_PERIOD_TICKS = 12;
const MAX_CANDLES = 75;
const STARTING_CAPITAL = 10000;
const REAL_ESTATE_GROWTH_RATE = 0.0003;
const LAND_GROWTH_RATE = 0.00015;

const CHALLENGE_DEFINITIONS = [
    {
        id: "first_trade",
        icon: "📈",
        category: "Burza",
        title: "První krok na burze",
        description: "Otevři svoji první BUY nebo SELL pozici.",
        target: 1,
        rewardXp: 150,
        rewardCash: 100
    },
    {
        id: "risk_manager",
        icon: "🛡️",
        category: "Burza",
        title: "Řízení rizika",
        description: "Otevři obchod se Stop Lossem nebo Take Profitem.",
        target: 1,
        rewardXp: 200,
        rewardCash: 150
    },
    {
        id: "leverage_lesson",
        icon: "⚡",
        category: "Burza",
        title: "Síla finanční páky",
        description: "Otevři jednu pozici s pákou 1:5 a sleduj marži.",
        target: 1,
        rewardXp: 250,
        rewardCash: 200
    },
    {
        id: "wealth_builder",
        icon: "💰",
        category: "Portfolio",
        title: "Prvních 10 000 navíc",
        description: "Zvyš čisté jmění o 10 000 💵 oproti startu.",
        target: 10000,
        rewardXp: 500,
        rewardCash: 500
    },
    {
        id: "first_business",
        icon: "🏪",
        category: "Business",
        title: "První vlastní podnik",
        description: "Kup E-shop nebo samoobslužnou myčku.",
        target: 1,
        rewardXp: 500,
        rewardCash: 1000
    },
    {
        id: "first_property",
        icon: "🏠",
        category: "Reality",
        title: "První nemovitost",
        description: "Pořiď první nemovitost do svého portfolia.",
        target: 1,
        rewardXp: 750,
        rewardCash: 2500
    },
    {
        id: "diversified",
        icon: "🧩",
        category: "Strategie",
        title: "Tři světy investování",
        description: "Investuj na Burze, v Reality i v Businessu.",
        target: 3,
        rewardXp: 1000,
        rewardCash: 5000
    }
];

function createDefaultChallengeState() {
    return {
        xp: 0,
        claimed: {},
        counters: {
            tradesOpened: 0,
            protectedTrades: 0,
            leveragedTrades: 0,
            propertiesBought: 0,
            businessesBought: 0
        },
        categories: {
            stocks: false,
            realEstate: false,
            business: false
        }
    };
}

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
let challengeState = createDefaultChallengeState();
let monthlyCashflow = {
    income: 0,
    expenses: 0
};
function createEmptyLoanState() {
    return {
        principal: 0,
        remainingPrincipal: 0,
        totalDue: 0,
        remainingBalance: 0,
        monthlyPayment: 0,
        remainingInstallments: 0,
        termMonths: 60,
        rateType: "fixed",
        annualRate: 0,
        baseRateAtStart: 0,
        riskPremium: 0,
        legacyFlat: false,
        lastInterestCharge: 0
    };
}

function normalizeLoanState(value) {
    if (!value || Number(value.remainingInstallments) <= 0) return createEmptyLoanState();
    const legacy = !["fixed", "variable"].includes(value.rateType);
    const remainingPrincipal = Math.max(0, Number(
        value.remainingPrincipal ??
        value.remainingBalance ??
        (Number(value.remainingInstallments) * Number(value.monthlyPayment))
    ) || 0);
    return {
        ...createEmptyLoanState(),
        ...value,
        principal: Math.max(0, Number(value.principal) || remainingPrincipal),
        remainingPrincipal: round2(remainingPrincipal),
        remainingBalance: round2(remainingPrincipal),
        monthlyPayment: Math.max(0, round2(value.monthlyPayment || 0)),
        remainingInstallments: Math.max(0, Math.round(Number(value.remainingInstallments) || 0)),
        termMonths: Math.max(1, Math.round(Number(value.termMonths) || 60)),
        rateType: legacy ? "fixed" : value.rateType,
        annualRate: legacy ? 5 : Math.max(0, Number(value.annualRate) || 0),
        baseRateAtStart: legacy ? 5 : Math.max(0, Number(value.baseRateAtStart) || 0),
        riskPremium: legacy ? 0 : Math.max(0, Number(value.riskPremium) || 0),
        legacyFlat: legacy || Boolean(value.legacyFlat),
        lastInterestCharge: Math.max(0, Number(value.lastInterestCharge) || 0)
    };
}

function getBaseInterestRate() {
    const cycleRates = {
        expansion: 4.5,
        slowdown: 5.5,
        recession: 3.25,
        recovery: 3.75
    };
    let rate = cycleRates[economyState?.cycle] ?? 4.5;
    const activeIds = new Set((economyState?.activeEvents || []).map(event => event.id));
    if (activeIds.has("rate_hike")) rate += 2.5;
    if (activeIds.has("inflation_wave")) rate += 1.5;
    if (activeIds.has("banking_panic")) rate += 1;
    if (activeIds.has("strong_jobs")) rate += 0.35;
    if (activeIds.has("consumer_crisis")) rate -= 0.5;
    if (activeIds.has("tax_relief")) rate -= 0.25;
    return round2(Math.min(12, Math.max(1, rate)));
}

function getLoanRiskPremium(amount) {
    const maxLoan = Math.max(1, calculateLoanLimit());
    const utilization = Math.min(1, Math.max(0, Number(amount) / maxLoan));
    return round2(1.75 + utilization * 2.5);
}

function getLoanOfferRate(type = selectedLoanType, amount = selectedLoanAmount) {
    const baseRate = getBaseInterestRate();
    const riskPremium = getLoanRiskPremium(Math.max(0, Number(amount) || 0));
    const fixationPremium = type === "fixed" ? 0.75 : 0;
    return round2(baseRate + riskPremium + fixationPremium);
}

function calculateMonthlyPayment(principal, annualRate, months) {
    principal = Math.max(0, Number(principal) || 0);
    months = Math.max(1, Math.round(Number(months) || 1));
    const monthlyRate = Math.max(0, Number(annualRate) || 0) / 1200;
    if (monthlyRate === 0) return round2(principal / months);
    return round2(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
}

let loanState = createEmptyLoanState();
let selectedLoanAmount = 0;
let selectedLoanType = "fixed";
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


const MONTH_NAMES = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

const ECONOMIC_CYCLES = {
    expansion: {
        name: "Expanze", icon: "🟢", next: "slowdown",
        duration: [14, 22],
        lesson: "V expanzi rostou zisky i optimismus. Právě tehdy je snadné podcenit riziko.",
        impacts: { stockDrift: 0.010, propertyGrowth: 0.00045, businessRevenue: 1.10, rentMultiplier: 1.04, volatility: 0.95 }
    },
    slowdown: {
        name: "Zpomalení", icon: "🟡", next: "recession",
        duration: [8, 14],
        lesson: "Zpomalení prověřuje rezervu a kvalitu investic dřív, než přijde skutečná recese.",
        impacts: { stockDrift: -0.002, propertyGrowth: 0, businessRevenue: 0.94, rentMultiplier: 1, volatility: 1.12 }
    },
    recession: {
        name: "Recese", icon: "🔴", next: "recovery",
        duration: [7, 12],
        lesson: "Recese ničí slabé projekty, ale dlouhodobým investorům vytváří levnější vstupy.",
        impacts: { stockDrift: -0.014, propertyGrowth: -0.0011, businessRevenue: 0.79, rentMultiplier: 0.94, volatility: 1.48, maintenance: 1.08 }
    },
    recovery: {
        name: "Oživení", icon: "🔵", next: "expansion",
        duration: [8, 15],
        lesson: "Oživení často začíná dříve, než ekonomické zprávy vypadají optimisticky.",
        impacts: { stockDrift: 0.007, propertyGrowth: 0.0002, businessRevenue: 1.04, rentMultiplier: 1.01, volatility: 1.18 }
    }
};

const WORLD_EVENTS = [
    { id: "tech_boom", icon: "🚀", title: "Technologický boom", description: "Investoři přesouvají kapitál do růstových firem.", duration: 6, lesson: "Sektorový boom může zvednout výnos, ale také koncentraci rizika.", impacts: { growthDrift: 0.030, dividendDrift: -0.004, volatility: 1.16 } },
    { id: "rate_hike", icon: "🏦", title: "Růst úrokových sazeb", description: "Dražší financování ochlazuje reality a růstové firmy.", duration: 7, lesson: "Vyšší sazby snižují současnou hodnotu budoucích zisků a zdražují úvěry.", impacts: { growthDrift: -0.020, dividendDrift: 0.004, propertyGrowth: -0.001, businessRevenue: 0.94 } },
    { id: "consumer_crisis", icon: "🛒", title: "Krize spotřeby", description: "Domácnosti omezují nákupy a firmy bojují o zákazníky.", duration: 5, lesson: "Tržby podnikání jsou cyklické. Rezerva pomáhá přežít slabší poptávku.", impacts: { businessRevenue: 0.76, dividendDrift: -0.006 } },
    { id: "new_highway", icon: "🛣️", title: "Nová infrastruktura", description: "Lepší dostupnost zvyšuje atraktivitu nemovitostí.", duration: 9, lesson: "Hodnotu reality neurčuje jen stav budovy, ale také její okolí.", impacts: { propertyGrowth: 0.0013, rentMultiplier: 1.08 } },
    { id: "market_selloff", icon: "📉", title: "Výprodej na trzích", description: "Strach investorů stlačuje ceny napříč burzou.", duration: 4, lesson: "Pokles ceny není automaticky ztráta kvality. Rozhoduje důvod a časový horizont.", impacts: { stockDrift: -0.026, volatility: 1.60 } },
    { id: "inflation_wave", icon: "🔥", title: "Inflační vlna", description: "Ceny, nájmy i provozní náklady rychle rostou.", duration: 8, lesson: "Inflace pomáhá některým reálným aktivům, ale poškozuje hotovost a marže.", impacts: { propertyGrowth: 0.0009, rentMultiplier: 1.11, maintenance: 1.18, businessRevenue: 0.96 } },
    { id: "energy_shock", icon: "⚡", title: "Energetický šok", description: "Provoz budov a podniků skokově zdražuje.", duration: 5, lesson: "Fixní náklady mohou z bezpečné investice rychle udělat problém.", impacts: { maintenance: 1.38, businessRevenue: 0.88, dividendDrift: -0.005 } },
    { id: "tourism_wave", icon: "🧳", title: "Silná turistická sezóna", description: "Služby a pronájmy těží z přílivu návštěvníků.", duration: 4, lesson: "Dočasný růst příjmů není totéž jako dlouhodobě udržitelný výnos.", impacts: { rentMultiplier: 1.16, businessRevenue: 1.13 } },
    { id: "housing_shortage", icon: "🏘️", title: "Nedostatek bydlení", description: "Malá nabídka tlačí ceny a nájmy vzhůru.", duration: 10, lesson: "Omezená nabídka podporuje cenu, ale může vyvolat regulaci.", impacts: { propertyGrowth: 0.0015, rentMultiplier: 1.12 } },
    { id: "new_regulation", icon: "📜", title: "Nová regulace", description: "Majitelům nemovitostí a firmám přibývají náklady.", duration: 7, lesson: "Regulatorní riziko nelze odstranit, ale lze ho rozložit diverzifikací.", impacts: { maintenance: 1.22, businessRevenue: 0.91, propertyGrowth: -0.0003 } },
    { id: "tax_relief", icon: "🎁", title: "Daňová úleva pro firmy", description: "Podnikům zůstává více peněz na investice.", duration: 6, lesson: "Změna daní ovlivňuje čistý zisk, a tím i hodnotu firem.", impacts: { businessRevenue: 1.18, stockDrift: 0.010 } },
    { id: "strong_jobs", icon: "👷", title: "Silný pracovní trh", description: "Rostoucí mzdy podporují spotřebu i nájmy.", duration: 6, lesson: "Více příjmů domácností podporuje ekonomiku, ale může zesílit inflaci.", impacts: { businessRevenue: 1.10, rentMultiplier: 1.06, volatility: 1.06 } },
    { id: "banking_panic", icon: "🏚️", title: "Bankovní panika", description: "Likvidita mizí a investoři hledají bezpečí.", duration: 3, lesson: "Likvidní rezerva má největší hodnotu právě tehdy, když ji ostatní nemají.", impacts: { stockDrift: -0.032, propertyGrowth: -0.0014, volatility: 1.82 } },
    { id: "green_subsidy", icon: "🌱", title: "Zelené dotace", description: "Nové pobídky podporují modernizaci firem a budov.", duration: 8, lesson: "Dotace mohou změnit návratnost projektu, ale neměly by být jeho jediným důvodem.", impacts: { propertyGrowth: 0.0007, businessRevenue: 1.08, growthDrift: 0.010 } },
    { id: "logistics_boost", icon: "📦", title: "Levnější logistika", description: "Doprava zboží zrychluje a marže e-shopů rostou.", duration: 5, lesson: "Vyšší marže může vzniknout růstem ceny i poklesem nákladů.", impacts: { businessRevenue: 1.21, growthDrift: 0.006 } }
];

const WORLD_OPPORTUNITIES = [
    { id: "property_auction", icon: "🏷️", title: "Dražba nemovitostí", description: "Nákupní ceny realit jsou dočasně o 15 % nižší.", duration: 4, impacts: { propertyDiscount: 0.15 } },
    { id: "supplier_window", icon: "📦", title: "Výhodný dodavatel", description: "E-shop prodává zboží s o 25 % vyšší marží.", duration: 5, impacts: { goodsSale: 1.25 } },
    { id: "rent_demand", icon: "🔑", title: "Nájemní špička", description: "Nájemné přináší o 20 % vyšší příjem.", duration: 4, impacts: { rentMultiplier: 1.20 } },
    { id: "flash_crash", icon: "💥", title: "Krátký propad burzy", description: "Akcie zlevnily. Příležitost trvá jen několik měsíců.", duration: 3, impacts: { stockDrift: 0.010, volatility: 1.25 }, immediateDrop: 0.08 }
];

const WORLD_DECISIONS = [
    {
        id: "tech_wave", icon: "🧠", title: "Vsadíš na novou technologii?",
        description: "Začínající technologický trend může změnit celý trh. Výsledek ale zatím není jistý.",
        context: "Vyšší potenciální výnos znamená také vyšší pravděpodobnost ztráty.",
        options: [
            { action: "invest", label: "Investovat 10 000 💵", detail: "65% šance na silný růstový impuls.", cost: 10000, risky: true },
            { action: "watch", label: "Pouze sledovat", detail: "Bez finančního rizika, menší zkušenost." }
        ]
    },
    {
        id: "recession_warning", icon: "🛡️", title: "Trh varuje před recesí",
        description: "Volatilita roste a analytici se neshodnou, zda přijde hlubší propad.",
        context: "Pojištění snižuje riziko, ale vždy něco stojí.",
        options: [
            { action: "hedge", label: "Zaplatit ochranu 5 000 💵", detail: "Na šest měsíců výrazně sníží volatilitu.", cost: 5000 },
            { action: "hold", label: "Držet plán", detail: "Nic nestojí, ale portfolio zůstane vystavené trhu.", risky: true }
        ]
    },
    {
        id: "city_project", icon: "🏗️", title: "Město plánuje novou čtvrť",
        description: "Můžeš si předem rezervovat účast na projektu, jeho schválení ale není jisté.",
        context: "Investice před potvrzením projektu nabízí slevu výměnou za nejistotu.",
        options: [
            { action: "reserve", label: "Rezervovat za 20 000 💵", detail: "60% šance na výrazný růst realit.", cost: 20000, risky: true },
            { action: "skip", label: "Počkat na jistotu", detail: "Bez rizika i bez výhody." }
        ]
    },
    {
        id: "viral_shop", icon: "📣", title: "E-shop může spustit virální kampaň",
        description: "Agentura nabízí rychlou kampaň s potenciálem zvýšit prodeje.",
        context: "Marketing nezaručuje úspěch. Bez vlastního e-shopu je placená varianta nedostupná.",
        requiresBusiness: true,
        options: [
            { action: "campaign", label: "Investovat 15 000 💵", detail: "Na šest měsíců zvýší tržby e-shopu.", cost: 15000, risky: true },
            { action: "organic", label: "Růst organicky", detail: "Pomalejší cesta bez finančního rizika." }
        ]
    },
    {
        id: "education", icon: "🎓", title: "Nabídka investičního kurzu",
        description: "Můžeš investovat do znalostí, nebo pokračovat metodou pokus–omyl.",
        context: "Znalosti nezaručí zisk, ale zlepšují kvalitu budoucích rozhodnutí.",
        options: [
            { action: "course", label: "Kurz za 5 000 💵", detail: "Získáš 350 XP.", cost: 5000 },
            { action: "self_study", label: "Studovat samostatně", detail: "Získáš 100 XP bez nákladů." }
        ]
    }
];

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createDefaultEconomyState() {
    return {
        cycle: "expansion",
        cycleMonthsLeft: 18,
        activeEvents: [],
        opportunity: null,
        news: [],
        nextEventIn: 3,
        nextDecisionIn: 6,
        nextOpportunityIn: 5,
        pendingDecision: null,
        resumeSpeed: 1000,
        decisionsMade: 0
    };
}

let economyState = createDefaultEconomyState();

function normalizeEconomyState(value) {
    const defaults = createDefaultEconomyState();
    if (!value || typeof value !== "object") return defaults;
    return {
        ...defaults,
        ...value,
        cycle: ECONOMIC_CYCLES[value.cycle] ? value.cycle : defaults.cycle,
        cycleMonthsLeft: Math.max(1, Number(value.cycleMonthsLeft) || defaults.cycleMonthsLeft),
        activeEvents: Array.isArray(value.activeEvents) ? value.activeEvents.filter(event => Number(event.remaining) > 0) : [],
        opportunity: value.opportunity && Number(value.opportunity.remaining) > 0 ? value.opportunity : null,
        news: Array.isArray(value.news) ? value.news.slice(0, 6) : [],
        pendingDecision: value.pendingDecision || null
    };
}

function addWorldNews(icon, title) {
    economyState.news.unshift({ icon, title, month: elapsedMonths });
    economyState.news = economyState.news.slice(0, 6);
}

function showGameToast(title, detail, tone = "lesson") {
    const stack = document.getElementById("gameToastStack");
    if (!stack) return;
    const toast = document.createElement("article");
    toast.className = `game-toast ${tone}`;
    toast.innerHTML = `<strong>${title}</strong><span>${detail}</span>`;
    stack.appendChild(toast);
    window.setTimeout(() => toast.remove(), 6500);
}

function awardWorldXp(amount, reason) {
    challengeState = normalizeChallengeState(challengeState);
    challengeState.xp = round2(challengeState.xp + amount);
    renderMilestones();
    showGameToast(`+${amount} XP · ${reason}`, "Zkušenosti získáváš za rozhodování a pochopení souvislostí.", "positive");
}

function addTemporaryWorldEffect(effect) {
    economyState.activeEvents.push({
        id: effect.id,
        icon: effect.icon || "✨",
        title: effect.title,
        description: effect.description,
        lesson: effect.lesson || "",
        remaining: effect.duration,
        duration: effect.duration,
        impacts: effect.impacts || {}
    });
    addWorldNews(effect.icon || "✨", effect.title);
}

function getWorldModifiers() {
    economyState = normalizeEconomyState(economyState);
    const cycle = ECONOMIC_CYCLES[economyState.cycle];
    const result = {
        stockDrift: Number(cycle.impacts.stockDrift) || 0,
        growthDrift: 0,
        dividendDrift: 0,
        propertyGrowth: Number(cycle.impacts.propertyGrowth) || 0,
        businessRevenue: Number(cycle.impacts.businessRevenue) || 1,
        rentMultiplier: Number(cycle.impacts.rentMultiplier) || 1,
        maintenance: Number(cycle.impacts.maintenance) || 1,
        volatility: Number(cycle.impacts.volatility) || 1,
        propertyDiscount: 0,
        goodsSale: 1
    };

    const sources = economyState.activeEvents.map(event => event.impacts || {});
    if (economyState.opportunity) sources.push(economyState.opportunity.impacts || {});
    sources.forEach(impact => {
        result.stockDrift += Number(impact.stockDrift) || 0;
        result.growthDrift += Number(impact.growthDrift) || 0;
        result.dividendDrift += Number(impact.dividendDrift) || 0;
        result.propertyGrowth += Number(impact.propertyGrowth) || 0;
        result.businessRevenue *= Number(impact.businessRevenue) || 1;
        result.rentMultiplier *= Number(impact.rentMultiplier) || 1;
        result.maintenance *= Number(impact.maintenance) || 1;
        result.volatility *= Number(impact.volatility) || 1;
        result.propertyDiscount = Math.max(result.propertyDiscount, Number(impact.propertyDiscount) || 0);
        result.goodsSale *= Number(impact.goodsSale) || 1;
    });
    return result;
}

function getRealEstatePurchasePrice(item) {
    const discount = getWorldModifiers().propertyDiscount;
    return round2(item.value * (1 - discount));
}

function startNextEconomicCycle() {
    const previous = ECONOMIC_CYCLES[economyState.cycle];
    economyState.cycle = previous.next;
    const next = ECONOMIC_CYCLES[economyState.cycle];
    economyState.cycleMonthsLeft = randomBetween(next.duration[0], next.duration[1]);
    addWorldNews(next.icon, `Ekonomika vstupuje do fáze: ${next.name}`);
    showGameToast(`${next.icon} Začíná ${next.name.toLowerCase()}`, next.lesson, "lesson");
    awardWorldXp(50, "Rozpoznání ekonomického cyklu");
}

function spawnWorldEvent() {
    const activeIds = new Set(economyState.activeEvents.map(event => event.id));
    const pool = WORLD_EVENTS.filter(event => !activeIds.has(event.id));
    const event = pool[Math.floor(Math.random() * pool.length)];
    addTemporaryWorldEffect({ ...event, remaining: event.duration });
    showGameToast(`${event.icon} ${event.title}`, event.description, event.impacts.stockDrift < 0 || event.impacts.businessRevenue < 1 ? "negative" : "positive");
    window.setTimeout(() => showGameToast("Co ses právě naučil?", event.lesson, "lesson"), 450);
}

function spawnWorldOpportunity() {
    const template = WORLD_OPPORTUNITIES[Math.floor(Math.random() * WORLD_OPPORTUNITIES.length)];
    economyState.opportunity = { ...template, remaining: template.duration };
    if (template.immediateDrop) {
        Object.values(assets).forEach(asset => {
            asset.price = round2(Math.max(0.01, asset.price * (1 - template.immediateDrop)));
            const candle = asset.candles[asset.candles.length - 1];
            if (candle) {
                candle.c = asset.price;
                candle.l = Math.min(candle.l, asset.price);
            }
        });
    }
    addWorldNews(template.icon, `Časově omezená příležitost: ${template.title}`);
    showGameToast(`${template.icon} ${template.title}`, `${template.description} Zbývá ${template.duration} měsíců.`, "positive");
}

function getEligibleWorldDecisions() {
    const pool = WORLD_DECISIONS.filter(decision => {
        if (decision.requiresBusiness) return Number(businessState.shop?.owned) > 0;
        return true;
    });
    return pool.length ? pool : WORLD_DECISIONS.filter(decision => decision.id === "education");
}

function openWorldDecision() {
    if (economyState.pendingDecision) return;
    const pool = getEligibleWorldDecisions();
    const decision = pool[Math.floor(Math.random() * pool.length)];
    economyState.resumeSpeed = currentSpeed > 0 ? currentSpeed : 1000;
    economyState.pendingDecision = { id: decision.id };
    setSpeed(0);
    renderWorldDecision();
}

function renderWorldDecision() {
    const modal = document.getElementById("worldDecisionModal");
    if (!modal) return;
    const decision = WORLD_DECISIONS.find(item => item.id === economyState.pendingDecision?.id);
    if (!decision) {
        modal.classList.add("hidden");
        return;
    }

    document.getElementById("worldDecisionIcon").textContent = decision.icon;
    document.getElementById("worldDecisionTitle").textContent = decision.title;
    document.getElementById("worldDecisionDescription").textContent = decision.description;
    document.getElementById("worldDecisionContext").textContent = `💡 ${decision.context}`;
    const options = document.getElementById("worldDecisionOptions");
    options.innerHTML = decision.options.map(option => {
        const disabled = Number(option.cost) > balance;
        return `<button class="decision-option ${option.risky ? "risky" : ""}" ${disabled ? "disabled" : ""} onclick="resolveWorldDecision('${decision.id}', '${option.action}')"><strong>${option.label}</strong><span>${disabled ? "Nedostatek hotovosti" : option.detail}</span></button>`;
    }).join("");
    modal.classList.remove("hidden");
}

function resolveWorldDecision(decisionId, action) {
    const decision = WORLD_DECISIONS.find(item => item.id === decisionId);
    if (!decision || economyState.pendingDecision?.id !== decisionId) return;
    const option = decision.options.find(item => item.action === action);
    if (!option || Number(option.cost) > balance) return;

    if (option.cost) {
        balance = round2(balance - option.cost);
        addTransaction(`Rozhodnutí: ${decision.title}`, -option.cost);
    }

    let resultTitle = "Rozhodnutí provedeno";
    let resultDetail = "Každé rozhodnutí mění poměr rizika a možného výnosu.";
    let tone = "lesson";

    if (decisionId === "tech_wave" && action === "invest") {
        if (Math.random() < 0.65) {
            addTemporaryWorldEffect({ id: "tech_success", icon: "🚀", title: "Technologická investice uspěla", description: "Růstové akcie získávají silný impuls.", lesson: "Riziko bylo odměněno, ale stejná volba nemusí vždy dopadnout stejně.", duration: 7, impacts: { growthDrift: 0.032, volatility: 1.18 } });
            resultTitle = "Technologie prorazila";
            resultDetail = "Růstové akcie získaly sedmiměsíční impuls.";
            tone = "positive";
            awardWorldXp(220, "Promyšlené riziko");
        } else {
            resultTitle = "Projekt neuspěl";
            resultDetail = "Investice se nevrátila. I dobře odůvodněné riziko může skončit ztrátou.";
            tone = "negative";
            awardWorldXp(120, "Poučení ze ztráty");
        }
    } else if (decisionId === "tech_wave") {
        awardWorldXp(75, "Trpělivé sledování trhu");
    } else if (decisionId === "recession_warning" && action === "hedge") {
        addTemporaryWorldEffect({ id: "portfolio_hedge", icon: "🛡️", title: "Ochrana portfolia", description: "Výkyvy trhu jsou dočasně slabší.", duration: 6, impacts: { volatility: 0.60 } });
        resultTitle = "Portfolio je chráněné";
        resultDetail = "Volatilita bude šest měsíců nižší.";
        tone = "positive";
        awardWorldXp(160, "Řízení rizika");
    } else if (decisionId === "recession_warning") {
        awardWorldXp(100, "Disciplína dlouhodobého investora");
    } else if (decisionId === "city_project" && action === "reserve") {
        if (Math.random() < 0.60) {
            addTemporaryWorldEffect({ id: "city_approved", icon: "🏗️", title: "Projekt byl schválen", description: "Reality v lokalitě rychle získávají hodnotu.", duration: 10, impacts: { propertyGrowth: 0.0022, rentMultiplier: 1.08 } });
            resultTitle = "Městský projekt schválen";
            resultDetail = "Reality získaly desetiměsíční růstový impuls.";
            tone = "positive";
            awardWorldXp(240, "Investice před potvrzením");
        } else {
            resultTitle = "Projekt se odkládá";
            resultDetail = "Rezervační poplatek propadl. Nejistota byla součástí nabídky.";
            tone = "negative";
            awardWorldXp(120, "Pochopení projektového rizika");
        }
    } else if (decisionId === "city_project") {
        awardWorldXp(60, "Odmítnutí nejasného rizika");
    } else if (decisionId === "viral_shop" && action === "campaign") {
        addTemporaryWorldEffect({ id: "viral_campaign", icon: "📣", title: "Virální kampaň", description: "E-shop získává více zákazníků.", duration: 6, impacts: { businessRevenue: 1.36 } });
        resultTitle = "Kampaň nabírá sílu";
        resultDetail = "Tržby podnikání budou šest měsíců vyšší.";
        tone = "positive";
        awardWorldXp(180, "Investice do růstu firmy");
    } else if (decisionId === "viral_shop") {
        awardWorldXp(75, "Organický růst");
    } else if (decisionId === "education" && action === "course") {
        awardWorldXp(350, "Investice do znalostí");
        resultTitle = "Nové znalosti odemčeny";
        resultDetail = "Získal jsi 350 XP. Vzdělání je aktivum, které se neodepisuje propadem trhu.";
        tone = "positive";
    } else if (decisionId === "education") {
        awardWorldXp(100, "Samostatné studium");
    }

    economyState.pendingDecision = null;
    economyState.decisionsMade += 1;
    document.getElementById("worldDecisionModal")?.classList.add("hidden");
    showGameToast(resultTitle, resultDetail, tone);
    addWorldNews(decision.icon, `${decision.title}: ${option.label}`);
    updateAccount();
    renderWorldPanel();
    saveGameState();
    setSpeed(economyState.resumeSpeed || 1000);
}

function advanceWorldMonth() {
    economyState = normalizeEconomyState(economyState);
    economyState.cycleMonthsLeft -= 1;
    if (economyState.cycleMonthsLeft <= 0) startNextEconomicCycle();

    economyState.activeEvents = economyState.activeEvents
        .map(event => ({ ...event, remaining: Number(event.remaining) - 1 }))
        .filter(event => event.remaining > 0);

    if (economyState.opportunity) {
        economyState.opportunity.remaining -= 1;
        if (economyState.opportunity.remaining <= 0) {
            addWorldNews("⌛", `Příležitost skončila: ${economyState.opportunity.title}`);
            economyState.opportunity = null;
        }
    }

    economyState.nextEventIn -= 1;
    if (economyState.nextEventIn <= 0) {
        spawnWorldEvent();
        economyState.nextEventIn = randomBetween(3, 8);
    }

    economyState.nextOpportunityIn -= 1;
    if (economyState.nextOpportunityIn <= 0 && !economyState.opportunity) {
        spawnWorldOpportunity();
        economyState.nextOpportunityIn = randomBetween(8, 14);
    }

    economyState.nextDecisionIn -= 1;
    if (economyState.nextDecisionIn <= 0 && !economyState.pendingDecision) {
        economyState.nextDecisionIn = randomBetween(7, 12);
        window.setTimeout(openWorldDecision, 120);
    }

    renderWorldPanel();
}

function renderWorldPanel() {
    economyState = normalizeEconomyState(economyState);
    const cycle = ECONOMIC_CYCLES[economyState.cycle];
    const year = Math.floor(elapsedMonths / 12) + 1;
    const monthName = MONTH_NAMES[elapsedMonths % 12];
    const latestEvent = economyState.activeEvents[economyState.activeEvents.length - 1];
    const modifiers = getWorldModifiers();

    const cycleName = document.getElementById("economyCycleName");
    const cycleIcon = document.getElementById("economyCycleIcon");
    const calendar = document.getElementById("worldCalendar");
    const countdown = document.getElementById("cycleCountdown");
    if (cycleName) cycleName.textContent = cycle.name;
    if (cycleIcon) cycleIcon.textContent = cycle.icon;
    if (calendar) calendar.textContent = `Rok ${year} · ${monthName}`;
    if (countdown) countdown.textContent = `Další fáze přibližně za ${economyState.cycleMonthsLeft} měsíců`;

    const eventIcon = document.getElementById("worldEventIcon");
    const eventKicker = document.getElementById("worldEventKicker");
    const eventTitle = document.getElementById("worldEventTitle");
    const eventDescription = document.getElementById("worldEventDescription");
    if (latestEvent) {
        if (eventIcon) eventIcon.textContent = latestEvent.icon;
        if (eventKicker) eventKicker.textContent = `Aktivní ještě ${latestEvent.remaining} měsíců`;
        if (eventTitle) eventTitle.textContent = latestEvent.title;
        if (eventDescription) eventDescription.textContent = latestEvent.description;
    } else {
        if (eventIcon) eventIcon.textContent = cycle.icon;
        if (eventKicker) eventKicker.textContent = "Aktuální ekonomické prostředí";
        if (eventTitle) eventTitle.textContent = cycle.name;
        if (eventDescription) eventDescription.textContent = cycle.lesson;
    }

    const opportunityCard = document.getElementById("opportunityCard");
    const opportunityTitle = document.getElementById("opportunityTitle");
    const opportunityDescription = document.getElementById("opportunityDescription");
    if (economyState.opportunity) {
        opportunityCard?.classList.add("active");
        if (opportunityTitle) opportunityTitle.textContent = `${economyState.opportunity.icon} ${economyState.opportunity.title}`;
        if (opportunityDescription) opportunityDescription.textContent = `${economyState.opportunity.description} Zbývá ${economyState.opportunity.remaining} měs.`;
    } else {
        opportunityCard?.classList.remove("active");
        if (opportunityTitle) opportunityTitle.textContent = "Žádná aktivní";
        if (opportunityDescription) opportunityDescription.textContent = `Další může přijít za ${economyState.nextOpportunityIn} měsíců.`;
    }

    const averageStockDrift = modifiers.stockDrift + (modifiers.growthDrift + modifiers.dividendDrift) / 2;
    const impacts = [
        { label: `Akcie ${averageStockDrift > 0.004 ? "↗" : averageStockDrift < -0.004 ? "↘" : "→"}`, tone: averageStockDrift > 0.004 ? "positive" : averageStockDrift < -0.004 ? "negative" : "" },
        { label: `Reality ${modifiers.propertyGrowth > 0.0004 ? "↗" : modifiers.propertyGrowth < 0 ? "↘" : "→"}`, tone: modifiers.propertyGrowth > 0.0004 ? "positive" : modifiers.propertyGrowth < 0 ? "negative" : "" },
        { label: `Business ${modifiers.businessRevenue > 1.04 ? "↗" : modifiers.businessRevenue < 0.96 ? "↘" : "→"}`, tone: modifiers.businessRevenue > 1.04 ? "positive" : modifiers.businessRevenue < 0.96 ? "negative" : "" },
        { label: `Riziko ${modifiers.volatility > 1.2 ? "vysoké" : modifiers.volatility < 0.9 ? "nižší" : "běžné"}`, tone: modifiers.volatility > 1.2 ? "negative" : modifiers.volatility < 0.9 ? "positive" : "" },
        { label: `Základní sazba ${getBaseInterestRate().toFixed(2)} %`, tone: getBaseInterestRate() >= 6 ? "negative" : getBaseInterestRate() <= 3.5 ? "positive" : "" }
    ];
    const impactRow = document.getElementById("worldImpactRow");
    if (impactRow) impactRow.innerHTML = impacts.map(item => `<span class="impact-chip ${item.tone}">${item.label}</span>`).join("");

    const feed = document.getElementById("worldNewsFeed");
    if (feed) {
        feed.innerHTML = economyState.news.length
            ? economyState.news.map(item => `<span>${item.icon} ${item.title}</span>`).join("")
            : "<span>Svět Invest Quest se právě probouzí…</span>";
    }

    renderWorldDecision();
}


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
        advanceWorldMonth();
        processRealEstateMonth();
        processBusinessMonth();
        processLoanMonth();
        renderGameTime();
        renderMonthlyCashflow();
    }

    const worldModifiers = getWorldModifiers();
    Object.entries(assets).forEach(([assetKey, asset]) => {
        const sectorDrift = asset.dividendRate > 0
            ? worldModifiers.dividendDrift
            : worldModifiers.growthDrift;
        const randomFactor = (Math.random() - 0.5) * asset.volatility * worldModifiers.volatility;
        asset.velocity = (asset.velocity + randomFactor + worldModifiers.stockDrift + sectorDrift) * asset.damping;

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

let currentSpeed = 1000;
let timer = setInterval(updatePrice, currentSpeed);

function setSpeed(ms) {
    currentSpeed = Number(ms);
    clearInterval(timer);
    timer = null;
    if (currentSpeed > 0) timer = setInterval(updatePrice, currentSpeed);

    document.querySelectorAll(".speed-toolbar [data-speed]").forEach(button => {
        const isActive = Number(button.dataset.speed) === currentSpeed;
        button.classList.toggle("speed-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
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

    recordChallengeEvent("tradesOpened", "stocks");
    if (Number.isFinite(sl) || Number.isFinite(tp)) {
        recordChallengeEvent("protectedTrades", "stocks");
    }
    if (leverage === MAX_LEVERAGE) {
        recordChallengeEvent("leveragedTrades", "stocks");
    }

    addTradeMarker(type);
    renderTrades();
    const protection = Number.isFinite(sl) || Number.isFinite(tp)
        ? "Pozice má nastavenou ochranu rizika."
        : "Pozice nemá Stop Loss ani Take Profit — sleduj ji aktivně.";
    showGameToast(
        `${type === "BUY" ? "📈" : "📉"} Pozice #${trade.id} otevřena`,
        `${formatLeverage(trade)} • marže ${formatCurrencyInt(margin)}. ${protection}`,
        leverage === MAX_LEVERAGE ? "negative" : "positive"
    );
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
        loanState.remainingPrincipal ??
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
    const financialXp = Math.max(0, round2(netWorth - STARTING_CAPITAL));
    const missionXp = Math.max(0, Number(challengeState?.xp) || 0);
    const earned = financialXp + missionXp;
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
        const active = getActiveChallenge();
        const progress = active ? getChallengeProgress(active.id) : 1;
        const target = active?.target || 1;
        missionEl.innerText = active
            ? `${Math.round(Math.min(100, progress / target * 100))} %`
            : "100 %";
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
    showGameToast(
        pnl >= 0 ? "✅ Obchod skončil ziskem" : "📉 Obchod skončil ztrátou",
        `P/L: ${formatCurrencyInt(pnl)}. ${pnl >= 0 ? "Zisk je odměna za podstoupené riziko." : "Ztráta patří k investování — důležitá je její velikost vůči portfoliu."}`,
        pnl >= 0 ? "positive" : "negative"
    );
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
    const purchasePrice = getRealEstatePurchasePrice(item);
    if (balance < purchasePrice) return alert("Nedostatek volných prostředků.");

    balance = round2(balance - purchasePrice);
    item.owned += 1;
    recordChallengeEvent("propertiesBought", "realEstate");
    addTransaction(`Koupeno: ${item.name}`, -purchasePrice);
    if (purchasePrice < item.value) {
        showGameToast("🏷️ Využitá dražební sleva", `Ušetřil jsi ${formatCurrencyInt(item.value - purchasePrice)}.`, "positive");
    } else {
        showGameToast(`🏠 Koupeno: ${item.name}`, "Reality mohou vytvářet nájemní cashflow, ale vyžadují kapitál a údržbu.", "lesson");
    }
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
    const worldModifiers = getWorldModifiers();

    Object.values(realEstates).forEach(item => {
        const effectiveGrowth = Math.max(-0.02, item.growthRate + worldModifiers.propertyGrowth);
        item.value = round2(item.value * (1 + effectiveGrowth));
        if (typeof item.rentIncreaseBuffer !== "number") item.rentIncreaseBuffer = 0;
        const rentIncrease = item.monthlyRent * item.growthRate;
        item.rentIncreaseBuffer = round2(item.rentIncreaseBuffer + rentIncrease);
        const rentStepCount = Math.floor(item.rentIncreaseBuffer / 500);
        if (rentStepCount > 0) {
            item.monthlyRent = round2(item.monthlyRent + rentStepCount * 500);
            item.rentIncreaseBuffer = round2(item.rentIncreaseBuffer - rentStepCount * 500);
        }
        if (item.owned > 0 && item.monthlyRent > 0) {
            rentIncome += item.owned * item.monthlyRent * worldModifiers.rentMultiplier;
        }
        if (item.owned > 0 && item.maintenance > 0) {
            maintenanceExpense += item.owned * item.maintenance * worldModifiers.maintenance;
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
    recordChallengeEvent("businessesBought", "business");
    addTransaction("Koupeno: E-shop", -shop.value);
    showGameToast("🏪 E-shop je tvůj", "Aktivní podnikání může růst rychle, ale jeho výnos závisí na poptávce a provozu.", "lesson");
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
    recordChallengeEvent("businessesBought", "business");
    addTransaction("Koupeno: Samoobslužná myčka", -item.value);
    showGameToast("🚿 Myčka je v portfoliu", "Stabilnější podnikání obvykle nabízí nižší růst, ale předvídatelnější cashflow.", "lesson");
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

    const salePrice = round2(businessState.goods.sellPrice * getWorldModifiers().businessRevenue * getWorldModifiers().goodsSale);
    balance = round2(balance + salePrice);
    addTransaction("Prodej zboží (e-shop)", salePrice, { affectMonthly: true });
    businessState.goods.inProgress = false;
    businessState.goods.readyToSell = false;
    renderBusinessPage();
    updateAccount();
}

function processBusinessMonth() {
    const worldModifiers = getWorldModifiers();
    if (businessState.carWash.owned > 0) {
        const washIncome = round2(businessState.carWash.owned * businessState.carWash.monthlyIncome * worldModifiers.businessRevenue);
        balance = round2(balance + washIncome);
        addTransaction("Příjem: Samoobslužná myčka", washIncome, { affectMonthly: true });
    }

    if (businessState.shop.owned > 0 && businessState.staff.employees > 0) {
        const employees = businessState.staff.employees;
        const salaryTotal = round2(employees * businessState.staff.salaryPerEmployee);
        balance = round2(balance - salaryTotal);
        addTransaction("Mzdy zaměstnanců (e-shop)", -salaryTotal, { affectMonthly: true });

        const autoBuy = round2(10000 * employees);
        const autoSell = round2(autoBuy * 1.1 * worldModifiers.businessRevenue * worldModifiers.goodsSale);

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
    loanState = normalizeLoanState(loanState);
    if (loanState.remainingInstallments <= 0) return;

    if (loanState.rateType === "variable" && !loanState.legacyFlat) {
        const previousRate = loanState.annualRate;
        loanState.annualRate = round2(getBaseInterestRate() + loanState.riskPremium);
        loanState.monthlyPayment = calculateMonthlyPayment(
            loanState.remainingPrincipal,
            loanState.annualRate,
            loanState.remainingInstallments
        );
        if (Math.abs(previousRate - loanState.annualRate) >= 0.1) {
            const direction = loanState.annualRate > previousRate ? "vzrostla" : "klesla";
            showGameToast(
                `〽️ Variabilní sazba ${direction}`,
                `${previousRate.toFixed(2)} % → ${loanState.annualRate.toFixed(2)} %. Nová splátka je ${formatCurrencyInt(loanState.monthlyPayment)}.`,
                loanState.annualRate > previousRate ? "negative" : "positive"
            );
            addWorldNews("🏦", `Variabilní sazba ${direction} na ${loanState.annualRate.toFixed(2)} %`);
        }
    }

    const interestCharge = loanState.legacyFlat
        ? 0
        : round2(loanState.remainingPrincipal * loanState.annualRate / 1200);
    const scheduledPayment = Math.max(interestCharge, loanState.monthlyPayment);
    const payment = round2(Math.min(
        scheduledPayment,
        loanState.remainingPrincipal + interestCharge
    ));
    const principalPaid = loanState.legacyFlat
        ? payment
        : round2(Math.max(0, payment - interestCharge));

    balance = round2(balance - payment);
    loanState.remainingPrincipal = round2(Math.max(0, loanState.remainingPrincipal - principalPaid));
    loanState.remainingBalance = loanState.remainingPrincipal;
    loanState.lastInterestCharge = interestCharge;
    loanState.remainingInstallments -= 1;
    addTransaction(
        `Splátka půjčky · úrok ${formatCurrencyInt(interestCharge)}`,
        -payment,
        { affectMonthly: true }
    );

    if (loanState.remainingInstallments <= 0 || loanState.remainingPrincipal <= 0.01) {
        loanState = createEmptyLoanState();
        showGameToast("🎉 Půjčka je splacená", "Celý dluh byl uhrazen. Uvolnilo se ti měsíční cashflow.", "positive");
    }

    if (!document.getElementById("loansPage")?.classList.contains("hidden")) {
        renderLoansPage();
    }
}

function borrowLoan() {
    const maxLoan = calculateLoanLimit();
    const amount = roundDownToHundreds(selectedLoanAmount);
    if (!amount || amount <= 0) return alert("Neplatná výše půjčky.");
    if (loanState.remainingInstallments > 0) return alert("Nejdřív doplať nebo refinancuj stávající půjčku.");
    if (amount > maxLoan) return alert("Překročen maximální limit půjčky.");

    const baseRate = getBaseInterestRate();
    const riskPremium = getLoanRiskPremium(amount);
    const annualRate = getLoanOfferRate(selectedLoanType, amount);
    const monthlyPayment = calculateMonthlyPayment(amount, annualRate, 60);

    loanState = {
        ...createEmptyLoanState(),
        principal: round2(amount),
        remainingPrincipal: round2(amount),
        totalDue: round2(monthlyPayment * 60),
        remainingBalance: round2(amount),
        monthlyPayment,
        remainingInstallments: 60,
        termMonths: 60,
        rateType: selectedLoanType,
        annualRate,
        baseRateAtStart: baseRate,
        riskPremium,
        legacyFlat: false
    };

    balance = round2(balance + loanState.principal);
    addTransaction(`Přijatá půjčka · ${selectedLoanType === "fixed" ? "fixní" : "pohyblivá"} sazba`, loanState.principal);
    showGameToast(
        "🏦 Půjčka byla načerpána",
        `${annualRate.toFixed(2)} % p.a. · splátka ${formatCurrencyInt(monthlyPayment)}. ${selectedLoanType === "fixed" ? "Sazba zůstane stejná." : "Sazba se bude měnit s ekonomikou."}`,
        "lesson"
    );
    selectedLoanAmount = 0;
    renderLoansPage();
    updateAccount();
}

function repayLoan() {
    loanState = normalizeLoanState(loanState);
    if (loanState.remainingInstallments <= 0) return alert("Nemáš aktivní půjčku.");
    const amountToRepay = calculateOutstandingDebt();
    if (balance < amountToRepay) return alert("Na splacení půjčky nemáš dostatek volných prostředků.");

    balance = round2(balance - amountToRepay);
    addTransaction("Předčasné splacení půjčky", -amountToRepay);
    loanState = createEmptyLoanState();
    selectedLoanAmount = 0;
    showGameToast("✅ Dluh předčasně splacen", "Ušetřil jsi budoucí úroky, ale snížil svoji hotovostní rezervu.", "positive");
    renderLoansPage();
    updateAccount();
}

function refinanceLoan() {
    loanState = normalizeLoanState(loanState);
    if (loanState.remainingInstallments <= 0) return alert("Nemáš aktivní půjčku k refinancování.");

    const remainingPrincipal = calculateOutstandingDebt();
    const previousRate = loanState.annualRate;
    const newBaseRate = getBaseInterestRate();
    const newRiskPremium = getLoanRiskPremium(remainingPrincipal);
    const newRate = round2(newBaseRate + newRiskPremium + (selectedLoanType === "fixed" ? 0.75 : 0));
    const fee = round2(Math.max(500, remainingPrincipal * 0.01));

    if (loanState.rateType === selectedLoanType && Math.abs(newRate - loanState.annualRate) < 0.1 && !loanState.legacyFlat) {
        return alert("Nová nabídka se od současné sazby téměř neliší.");
    }
    if (balance < fee) return alert(`Na poplatek za refinancování potřebuješ ${formatCurrencyInt(fee)}.`);
    if (!confirm(`Refinancovat za poplatek ${formatCurrencyInt(fee)} na sazbu ${newRate.toFixed(2)} %?`)) return;

    balance = round2(balance - fee);
    addTransaction("Poplatek za refinancování", -fee);
    loanState = {
        ...loanState,
        remainingPrincipal,
        remainingBalance: remainingPrincipal,
        totalDue: round2(calculateMonthlyPayment(remainingPrincipal, newRate, loanState.remainingInstallments) * loanState.remainingInstallments),
        monthlyPayment: calculateMonthlyPayment(remainingPrincipal, newRate, loanState.remainingInstallments),
        rateType: selectedLoanType,
        annualRate: newRate,
        baseRateAtStart: newBaseRate,
        riskPremium: newRiskPremium,
        legacyFlat: false,
        lastInterestCharge: 0
    };

    showGameToast(
        "🔄 Půjčka refinancována",
        `Nová ${selectedLoanType === "fixed" ? "fixní" : "pohyblivá"} sazba je ${newRate.toFixed(2)} % a splátka ${formatCurrencyInt(loanState.monthlyPayment)}.`,
        newRate < previousRate ? "positive" : "lesson"
    );
    renderLoansPage();
    updateAccount();
    saveGameState();
}

function selectLoanRateType(type) {
    if (!["fixed", "variable"].includes(type)) return;
    selectedLoanType = type;
    renderLoansPage();
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
    const baseRateEl = document.getElementById("baseRateValue");
    const offerRateEl = document.getElementById("loanOfferRate");
    const summaryEl = document.getElementById("loanOfferSummary");
    const lessonEl = document.getElementById("loanRateTypeDescription");
    if (!maxEl || !infoEl || !presetEl) return;

    loanState = normalizeLoanState(loanState);
    const maxLoan = calculateLoanLimit();
    const referenceAmount = loanState.remainingInstallments > 0
        ? calculateOutstandingDebt()
        : Math.max(selectedLoanAmount, maxLoan * 0.10);
    const baseRate = getBaseInterestRate();
    const offerRate = getLoanOfferRate(selectedLoanType, referenceAmount);
    const options = [
        { key: "25", percent: 0.25 },
        { key: "10", percent: 0.10 },
        { key: "1", percent: 0.01 }
    ].map(option => ({
        ...option,
        amount: roundDownToHundreds(maxLoan * option.percent)
    }));

    if (selectedLoanAmount > maxLoan || selectedLoanAmount < 0) selectedLoanAmount = 0;
    maxEl.innerHTML = formatCurrencyInt(maxLoan);
    if (baseRateEl) baseRateEl.textContent = `${baseRate.toFixed(2)} %`;
    if (offerRateEl) offerRateEl.textContent = `${offerRate.toFixed(2)} %`;
    if (summaryEl) summaryEl.textContent = `${selectedLoanType === "fixed" ? "Fixní" : "Pohyblivá"} sazba · 60 měsíčních splátek`;
    if (lessonEl) lessonEl.textContent = selectedLoanType === "fixed"
        ? "Fixace stojí přirážku 0,75 p. b., ale chrání splátku před růstem sazeb."
        : "Pohyblivá sazba nemá fixační přirážku, každý měsíc se však přepočítá podle ekonomiky.";
    document.getElementById("fixedRateButton")?.classList.toggle("active", selectedLoanType === "fixed");
    document.getElementById("variableRateButton")?.classList.toggle("active", selectedLoanType === "variable");

    presetEl.innerHTML = "";
    options.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("loan-option");
        const rate = getLoanOfferRate(selectedLoanType, option.amount);
        const installment = calculateMonthlyPayment(option.amount, rate, 60);
        button.innerHTML = `
            <div class="loan-option-amount">${formatCurrencyInt(option.amount)}</div>
            <div class="loan-option-installment">${rate.toFixed(2)} % · ${formatCurrencyInt(installment)} / měsíc</div>
        `;
        button.disabled = option.amount <= 0 || loanState.remainingInstallments > 0;
        if (option.amount === selectedLoanAmount && option.amount > 0) button.classList.add("active");
        button.onclick = () => selectLoanOffer(option.percent);
        presetEl.appendChild(button);
    });

    if (loanState.remainingInstallments > 0) {
        const remainingPrincipal = calculateOutstandingDebt();
        const projectedPayments = round2(loanState.monthlyPayment * loanState.remainingInstallments);
        const typeLabel = loanState.rateType === "variable" ? "Pohyblivá" : "Fixní";
        infoEl.innerHTML = `
            <p>Aktivní půjčka: <strong>${formatCurrencyInt(loanState.principal)}</strong></p>
            <p>Typ sazby: <strong>${typeLabel}</strong></p>
            <p>Aktuální sazba: <strong class="rate-change">${loanState.annualRate.toFixed(2)} % p.a.</strong></p>
            <p>Měsíční splátka: <strong>${formatCurrencyInt(loanState.monthlyPayment)}</strong></p>
            <p>Z toho poslední úrok: <strong>${formatCurrencyInt(loanState.lastInterestCharge)}</strong></p>
            <p>Zbývá splátek: <strong>${loanState.remainingInstallments}</strong></p>
            <p>Zbývající jistina: <strong>${formatCurrencyInt(remainingPrincipal)}</strong></p>
            <p>Odhad zbývajících plateb: <strong>${formatCurrencyInt(projectedPayments)}</strong></p>
            ${loanState.legacyFlat ? "<p><em>Starší půjčka: původní splátka zůstala zachována. Refinancováním přejdeš na nový model.</em></p>" : ""}
        `;
    } else {
        const selectedRate = selectedLoanAmount > 0 ? getLoanOfferRate(selectedLoanType, selectedLoanAmount) : offerRate;
        const selectedPayment = selectedLoanAmount > 0
            ? calculateMonthlyPayment(selectedLoanAmount, selectedRate, 60)
            : 0;
        infoEl.innerHTML = selectedLoanAmount > 0
            ? `<p>Vybraná částka: <strong>${formatCurrencyInt(selectedLoanAmount)}</strong></p><p>Sazba: <strong>${selectedRate.toFixed(2)} %</strong></p><p>Splátka: <strong>${formatCurrencyInt(selectedPayment)}</strong></p>`
            : "<p>Momentálně nemáš aktivní půjčku.</p>";
    }
}

function applyAutomaticOverdraftLoan() {
    if (balance >= 0) return;

    const needed = round2(Math.abs(balance));
    loanState = normalizeLoanState(loanState);
    const installments = loanState.remainingInstallments > 0 ? loanState.remainingInstallments : 60;
    const previousPrincipal = calculateOutstandingDebt();
    const newPrincipal = round2(previousPrincipal + needed);

    if (loanState.remainingInstallments <= 0) {
        loanState = {
            ...createEmptyLoanState(),
            principal: needed,
            remainingInstallments: installments,
            termMonths: installments
        };
    } else {
        loanState.principal = round2(loanState.principal + needed);
    }
    loanState.remainingPrincipal = newPrincipal;
    loanState.remainingBalance = newPrincipal;
    loanState.rateType = "variable";
    loanState.riskPremium = Math.max(6, Number(loanState.riskPremium) || 0);
    loanState.baseRateAtStart = getBaseInterestRate();
    loanState.annualRate = round2(getBaseInterestRate() + loanState.riskPremium);
    loanState.legacyFlat = false;
    loanState.monthlyPayment = calculateMonthlyPayment(newPrincipal, loanState.annualRate, installments);
    loanState.totalDue = round2(loanState.monthlyPayment * installments);

    balance = 0;
    addTransaction("Automatická překlenovací půjčka", needed, { affectMonthly: false });
    showGameToast(
        "⚠️ Automatická půjčka",
        `Hotovost klesla pod nulu. Banka doplnila ${formatCurrencyInt(needed)} se sazbou ${loanState.annualRate.toFixed(2)} %.`,
        "negative"
    );
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
        const purchasePrice = getRealEstatePurchasePrice(item);
        const canBuy = purchasePrice > 0 && balance >= purchasePrice;
        const canSell = item.owned > 0;
        const missingFunds = Math.max(0, purchasePrice - balance);
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
                    <button class="buy-btn" onclick="buyRealEstate('${key}')" ${canBuy ? "" : "disabled"}>Koupit za ${formatCurrencyInt(getRealEstatePurchasePrice(item))}</button>
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

function normalizeChallengeState(value) {
    const defaults = createDefaultChallengeState();
    if (!value || typeof value !== "object") return defaults;

    return {
        xp: Math.max(0, Number(value.xp) || 0),
        claimed: value.claimed && typeof value.claimed === "object" ? { ...value.claimed } : {},
        counters: {
            ...defaults.counters,
            ...(value.counters && typeof value.counters === "object" ? value.counters : {})
        },
        categories: {
            ...defaults.categories,
            ...(value.categories && typeof value.categories === "object" ? value.categories : {})
        }
    };
}

function recordChallengeEvent(counter, category = null, amount = 1) {
    challengeState = normalizeChallengeState(challengeState);
    if (counter in challengeState.counters) {
        challengeState.counters[counter] = Math.max(
            0,
            Number(challengeState.counters[counter]) || 0
        ) + amount;
    }
    if (category && category in challengeState.categories) {
        challengeState.categories[category] = true;
    }
    renderMilestones();
}

function getChallengeCategoryCount() {
    const categories = {
        stocks: Boolean(challengeState?.categories?.stocks) ||
            trades.length > 0 ||
            (window.closedTrades?.length || 0) > 0,
        realEstate: Boolean(challengeState?.categories?.realEstate) ||
            Object.values(realEstates).some(item => Number(item.owned) > 0),
        business: Boolean(challengeState?.categories?.business) ||
            Number(businessState.shop?.owned) > 0 ||
            Number(businessState.carWash?.owned) > 0
    };
    return Object.values(categories).filter(Boolean).length;
}

function getChallengeProgress(id, financialGrowth = null) {
    challengeState = normalizeChallengeState(challengeState);
    const counters = challengeState.counters;
    const closed = window.closedTrades || [];

    switch (id) {
        case "first_trade":
            return Math.max(counters.tradesOpened, trades.length + closed.length > 0 ? 1 : 0);
        case "risk_manager":
            return Math.max(
                counters.protectedTrades,
                trades.some(trade => Number.isFinite(trade.sl) || Number.isFinite(trade.tp)) ? 1 : 0
            );
        case "leverage_lesson":
            return Math.max(
                counters.leveragedTrades,
                trades.some(trade => getTradeLeverage(trade) === MAX_LEVERAGE) ||
                closed.some(trade => getTradeLeverage(trade) === MAX_LEVERAGE) ? 1 : 0
            );
        case "wealth_builder":
            return Math.max(
                0,
                financialGrowth == null
                    ? round2(calculateNetWorth() - STARTING_CAPITAL)
                    : Number(financialGrowth) || 0
            );
        case "first_business":
            return Math.max(
                counters.businessesBought,
                Number(businessState.shop?.owned) > 0 || Number(businessState.carWash?.owned) > 0 ? 1 : 0
            );
        case "first_property":
            return Math.max(
                counters.propertiesBought,
                Object.values(realEstates).some(item => Number(item.owned) > 0) ? 1 : 0
            );
        case "diversified":
            return getChallengeCategoryCount();
        default:
            return 0;
    }
}

function getActiveChallenge() {
    return CHALLENGE_DEFINITIONS.find(def => !challengeState?.claimed?.[def.id]) || null;
}

function claimChallenge(id) {
    challengeState = normalizeChallengeState(challengeState);
    const index = CHALLENGE_DEFINITIONS.findIndex(def => def.id === id);
    const challenge = CHALLENGE_DEFINITIONS[index];
    if (!challenge || challengeState.claimed[id]) return;

    const isUnlocked = index === 0 || Boolean(
        challengeState.claimed[CHALLENGE_DEFINITIONS[index - 1].id]
    );
    if (!isUnlocked) return alert("Nejdřív dokonči a vyzvedni předchozí výzvu.");

    const progress = getChallengeProgress(id);
    if (progress < challenge.target) return alert("Tato výzva ještě není dokončená.");

    challengeState.claimed[id] = true;
    challengeState.xp = round2(challengeState.xp + challenge.rewardXp);
    balance = round2(balance + challenge.rewardCash);
    addTransaction(`Odměna za výzvu: ${challenge.title}`, challenge.rewardCash);

    updateAccount();
    saveGameState();
    showGameToast(
        `🏆 Výzva dokončena: ${challenge.title}`,
        `+${challenge.rewardXp} XP a +${formatCurrencyInt(challenge.rewardCash)}`,
        "positive"
    );
}

function renderChallenges(financialGrowth = null) {
    challengeState = normalizeChallengeState(challengeState);
    const grid = document.getElementById("challengeGrid");
    const completedCount = CHALLENGE_DEFINITIONS.filter(
        def => challengeState.claimed[def.id]
    ).length;
    const firstUnclaimedIndex = CHALLENGE_DEFINITIONS.findIndex(
        def => !challengeState.claimed[def.id]
    );

    if (grid) {
        grid.innerHTML = "";
        CHALLENGE_DEFINITIONS.forEach((challenge, index) => {
            const progress = Math.min(
                challenge.target,
                getChallengeProgress(challenge.id, financialGrowth)
            );
            const progressPct = Math.min(100, (progress / challenge.target) * 100);
            const isClaimed = Boolean(challengeState.claimed[challenge.id]);
            const isUnlocked = index === 0 || Boolean(
                challengeState.claimed[CHALLENGE_DEFINITIONS[index - 1].id]
            );
            const isComplete = progress >= challenge.target;
            const card = document.createElement("article");
            card.className = `card challenge-card ${isClaimed ? "claimed" : isComplete && isUnlocked ? "complete" : !isUnlocked ? "locked" : "active"}`;

            const progressText = challenge.id === "wealth_builder"
                ? `${formatCurrencyInt(progress)} / ${formatCurrencyInt(challenge.target)}`
                : `${Math.round(progress)} / ${challenge.target}`;
            const action = isClaimed
                ? '<span class="challenge-done">✓ Odměna vyzvednuta</span>'
                : !isUnlocked
                    ? '<span class="challenge-locked">🔒 Dokonči předchozí misi</span>'
                    : isComplete
                        ? `<button class="challenge-claim" onclick="claimChallenge('${challenge.id}')">Vyzvednout odměnu</button>`
                        : '<span class="challenge-in-progress">Mise probíhá</span>';

            card.innerHTML = `
                <div class="challenge-card-head">
                    <span class="challenge-icon">${isClaimed ? "✓" : challenge.icon}</span>
                    <div><span class="challenge-category-label">${challenge.category}</span><h3>${challenge.title}</h3></div>
                    <span class="challenge-number">${index + 1}/${CHALLENGE_DEFINITIONS.length}</span>
                </div>
                <p>${challenge.description}</p>
                <div class="challenge-rewards"><span>+${challenge.rewardXp} XP</span><span>+${formatCurrencyInt(challenge.rewardCash)}</span></div>
                <div class="challenge-progress-row"><span>Postup</span><strong>${progressText}</strong></div>
                <div class="challenge-progress-track"><span style="width:${progressPct}%"></span></div>
                <div class="challenge-card-action">${action}</div>
            `;
            grid.appendChild(card);
        });
    }

    const countEl = document.getElementById("challengeCompletedCount");
    const xpEl = document.getElementById("challengeXpEarned");
    const hintEl = document.getElementById("challengeClaimHint");
    if (countEl) countEl.innerText = `${completedCount} / ${CHALLENGE_DEFINITIONS.length}`;
    if (xpEl) xpEl.innerText = `${formatNumberGrouped(challengeState.xp)} XP`;
    if (hintEl) {
        hintEl.innerText = completedCount === CHALLENGE_DEFINITIONS.length
            ? "Investiční cesta je dokončená."
            : `${CHALLENGE_DEFINITIONS.length - completedCount} výzev ještě čeká.`;
    }

    const active = firstUnclaimedIndex >= 0
        ? CHALLENGE_DEFINITIONS[firstUnclaimedIndex]
        : null;
    const titleEl = document.getElementById("currentMissionTitle");
    const descriptionEl = document.getElementById("currentMissionDescription");
    const progressEl = document.getElementById("currentMissionProgress");
    if (titleEl) titleEl.innerText = active?.title || "Všechny výzvy dokončeny";
    if (descriptionEl) descriptionEl.innerText = active?.description || "Dokázal jsi projít celou současnou investiční cestu.";
    if (progressEl) {
        const progress = active ? getChallengeProgress(active.id, financialGrowth) : 1;
        const target = active?.target || 1;
        progressEl.innerText = `${Math.round(Math.min(100, progress / target * 100))} %`;
    }
}

function renderMilestones(currentProfit = null) {
    renderChallenges(currentProfit);
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
    renderMilestones(round2(calculateNetWorth() - STARTING_CAPITAL));
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
    renderMilestones(round2(calculateNetWorth() - STARTING_CAPITAL));
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
    const serialized = serializeSaveData();
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");

    a.href = url;
    a.download = `invest-quest-save-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(STORAGE_KEY, serialized);
    updateAutosaveStatus("Postup exportován");
}

function buildSaveData() {
    persistCurrentAssetState();

    return {
        format: "invest-quest-save",
        saveVersion: SAVE_VERSION,
        savedAt: new Date().toISOString(),
        game: {
            title: "Invest Quest",
            goal: "Zábavná naučná investiční hra pro mladé"
        },
        player: {
            balance,
            nextTradeId: tradeId,
            elapsedMonths,
            milestones: milestonesState,
            challenges: challengeState,
            monthlyCashflow
        },
        market: {
            currentAsset,
            assets,
            displaySettings,
            monthTick,
            speed: currentSpeed
        },
        portfolio: {
            openTrades: trades,
            closedTrades: window.closedTrades || [],
            realEstates,
            business: businessState,
            loans: loanState,
            transactionHistory,
            accountHistory
        },
        world: economyState,
        legacyText: buildSaveText()
    };
}

function serializeSaveData() {
    return JSON.stringify(buildSaveData(), null, 2);
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

    text += "=== CHALLENGE STATE ===\n";
    text += `${JSON.stringify(challengeState)}\n\n`;

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

function updateAutosaveStatus(message = "Postup automaticky uložen") {
    const status = document.getElementById("autosaveStatus");
    if (!status) return;
    status.textContent = `● ${message} • ${new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function getSlotStorageKey(slot) {
    return `${SAVE_SLOT_PREFIX}${slot}`;
}

function getSaveMetadata(serialized) {
    try {
        const data = JSON.parse(serialized);
        if (data?.format !== "invest-quest-save") return null;
        return { savedAt: data.savedAt, balance: Number(data.player?.balance) || 0 };
    } catch {
        return null;
    }
}

function refreshSaveSlots() {
    for (let slot = 1; slot <= 3; slot++) {
        const element = document.getElementById(`saveSlotMeta${slot}`);
        if (!element) continue;
        const serialized = localStorage.getItem(getSlotStorageKey(slot));
        if (!serialized) {
            element.textContent = "Prázdná";
            continue;
        }
        const meta = getSaveMetadata(serialized);
        if (!meta) {
            element.textContent = "Starší uložená hra";
            continue;
        }
        const date = new Date(meta.savedAt);
        const label = Number.isNaN(date.getTime())
            ? "Bez data"
            : date.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        element.textContent = `${label} • ${formatCurrencyInt(meta.balance)}`;
    }
}

function saveToSlot(slot) {
    slot = Number(slot);
    if (![1, 2, 3].includes(slot)) return;
    const key = getSlotStorageKey(slot);
    if (localStorage.getItem(key) && !confirm(`Pozice ${slot} už obsahuje uloženou hru. Přepsat ji?`)) return;

    try {
        const serialized = serializeSaveData();
        localStorage.setItem(key, serialized);
        localStorage.setItem(STORAGE_KEY, serialized);
        refreshSaveSlots();
        updateAutosaveStatus(`Uloženo do pozice ${slot}`);
    } catch (error) {
        console.error("Ruční uložení selhalo:", error);
        alert("Hru se nepodařilo uložit.");
    }
}

function loadFromSlot(slot) {
    slot = Number(slot);
    if (![1, 2, 3].includes(slot)) return;
    const serialized = localStorage.getItem(getSlotStorageKey(slot));
    if (!serialized) return alert(`Pozice ${slot} je zatím prázdná.`);
    if (!confirm(`Načíst pozici ${slot}? Současný postup zůstane v automatické záloze.`)) return;

    if (!parseImportedData(serialized, { silent: true })) return;
    saveGameState();
    refreshSaveSlots();
    updateAutosaveStatus(`Načtena pozice ${slot}`);
    alert(`Pozice ${slot} byla načtena.`);
}

function saveGameState() {
    try {
        localStorage.setItem(STORAGE_KEY, serializeSaveData());
        updateAutosaveStatus();
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
    if (!file) return alert("Nejprve vyber uložený soubor .json nebo starší .txt.");

    const reader = new FileReader();
    reader.onload = e => parseImportedData(e.target.result);
    reader.onerror = () => alert("Nepodařilo se přečíst soubor.");
    reader.readAsText(file);
}

function parseImportedData(text, options = {}) {
    if (!text || typeof text !== "string") return false;

    const { silent = false } = options;
    const trimmedText = text.trim();
    let importedSpeed = null;
    let importedWorld = null;

    if (trimmedText.startsWith("{")) {
        try {
            const saveData = JSON.parse(trimmedText);
            if (saveData?.format !== "invest-quest-save" || typeof saveData.legacyText !== "string") {
                throw new Error("Soubor není platná uložená hra Invest Quest.");
            }
            if (Number(saveData.saveVersion) > SAVE_VERSION) {
                throw new Error("Uložená hra pochází z novější verze aplikace.");
            }
            importedSpeed = Number(saveData.market?.speed);
            importedWorld = saveData.world || null;
            text = saveData.legacyText;
        } catch (error) {
            console.error("Načtení JSON uložené hry selhalo:", error);
            if (!silent) alert(error.message || "Uložený soubor není platný.");
            return false;
        }
    }

    // Reset
    trades = [];
    candles = [];
    tradeMarkers = [];
    transactionHistory = [];
    accountHistory = [];
    milestonesState = { firstTarget: 10000, firstReached: false };
    challengeState = createDefaultChallengeState();
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
    economyState = createDefaultEconomyState();
    loanState = createEmptyLoanState();
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

    /* ----- CHALLENGE STATE ----- */
    let secChallenges = getSection("CHALLENGE STATE");
    if (secChallenges) {
        try {
            challengeState = normalizeChallengeState(JSON.parse(secChallenges.split("\n")[0]));
        } catch {
            challengeState = createDefaultChallengeState();
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
            loanState = normalizeLoanState(parsedLoan);
        } catch {
            loanState = createEmptyLoanState();
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
    economyState = normalizeEconomyState(importedWorld || economyState);
    selectedLoanType = loanState.remainingInstallments > 0 ? loanState.rateType : "fixed";
    renderWorldPanel();
    if ([0, 200, 500, 1000].includes(importedSpeed)) setSpeed(importedSpeed);

    if (!silent) {
        saveGameState();
        refreshSaveSlots();
        alert("Uložená hra byla úspěšně načtena.");
    }
    return true;
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
    challengeState = createDefaultChallengeState();
    monthlyCashflow = { income: 0, expenses: 0 };
    loanState = createEmptyLoanState();
    selectedLoanAmount = 0;
    selectedLoanType = "fixed";
    realEstates = createDefaultRealEstates();
    businessState = {
        shop: { name: "E-shop", image: "images/business/e-shop.webp", value: 200000, owned: 0 },
        carWash: { name: "Samoobslužná myčka", image: "images/business/car-wash.webp", value: 1000000, monthlyIncome: 10000, owned: 0 },
        goods: { inProgress: false, readyToSell: false, buyPrice: 1000, sellPrice: 1100 },
        staff: { employees: 0, salaryPerEmployee: 500, autoInProgress: false }
    };
    monthTick = 0;
    elapsedMonths = 0;
    economyState = createDefaultEconomyState();
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
    renderMilestones(round2(calculateNetWorth() - STARTING_CAPITAL));
    renderMonthlyCashflow();
    renderGameTime();
    renderWorldPanel();
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
