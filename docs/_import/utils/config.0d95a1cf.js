// src/utils/config.js

const hostname = window.location.hostname;
const searchParams = new URLSearchParams(window.location.search);
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
const isGitHubPages = hostname.endsWith("github.io");

export const IS_GITHUB_PAGES = isGitHubPages;

// Runtime toggles:
// - On GitHub Pages, default to static demo mode.
// - Use ?live=1 to force live API mode.
// - Use ?demo=1 to force static demo mode.
const forceLive = searchParams.get("live") === "1";
const forceDemo = searchParams.get("demo") === "1";

export const STATIC_DEMO_MODE = forceDemo || (isGitHubPages && !forceLive);
export const API_BASE_URL = isLocal ? "http://localhost:8000" : "";

export const DEMO_DATA_PATHS = {
    territories: "data/demo/service_territories.geojson",
    retailLmps: "data/demo/retail_lmps.json",
    priceData: "data/demo/service_territory_price_data.json"
};

// --- NEW SCALES ---

// Diverging palette: blue -> light gray -> red
const PRICE_COLORS = [
    '#0f4c81', // 0: deep blue
    '#2b6c9e', // 1: blue
    '#5a90b5', // 2: medium-light blue
    '#8fb4cc', // 3: pale blue
    '#d9a3a3', // 4: pale red
    '#c97c7c', // 5: muted red
    '#b55252', // 6: red
    '#8f1d1d'  // 7: deep red
];

// Retail fits approximately 0.13 -> 0.28
export const RETAIL_COLOR_SCALE = [
    { threshold: 0.13, color: PRICE_COLORS[0] },
    { threshold: 0.145, color: PRICE_COLORS[1] },
    { threshold: 0.16, color: PRICE_COLORS[2] },
    { threshold: 0.175, color: PRICE_COLORS[3] },
    { threshold: 0.19, color: PRICE_COLORS[4] },
    { threshold: 0.205, color: PRICE_COLORS[5] },
    { threshold: 0.225, color: PRICE_COLORS[6] },
    { threshold: 0.25, color: PRICE_COLORS[7] }
];

// Wholesale fits approximately 0.015 -> 0.038
export const WHOLESALE_COLOR_SCALE = [
    { threshold: 0.015, color: PRICE_COLORS[0] },
    { threshold: 0.018, color: PRICE_COLORS[1] },
    { threshold: 0.021, color: PRICE_COLORS[2] },
    { threshold: 0.024, color: PRICE_COLORS[3] },
    { threshold: 0.027, color: PRICE_COLORS[4] },
    { threshold: 0.03, color: PRICE_COLORS[5] },
    { threshold: 0.034, color: PRICE_COLORS[6] },
    { threshold: 0.038, color: PRICE_COLORS[7] }
];

// --- RETAINED SCALE ---

export const NET_COLOR_SCALE = [
    { threshold: 20,  color: '#8b0000' }, // Deepest Red
    { threshold: 15,  color: '#cc0000' }, // Strong Red
    { threshold: 10,  color: '#ff6666' }, // Light Red
    { threshold: 6,   color: '#ff9999' }, // Medium Pink
    { threshold: 2,   color: '#ffcccc' }, // Light Pink
    { threshold: -2,  color: '#ffffff' }, // White
    { threshold: -6,  color: '#bbdefb' }, // Very Pale Blue
    { threshold: -10, color: '#64b5f6' }, // Light Blue
    { threshold: -15, color: '#1976d2' }, // Medium Blue
    { threshold: -20, color: '#0d47a1' }, // Deep Blue
    { threshold: -Infinity, color: '#000050' } // Black-Blue
];
