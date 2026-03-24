// src/utils/config.js

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// export const API_BASE_URL = "https://obvolutive-secondarily-lainey.ngrok-free.dev";
export const API_BASE_URL = "http://localhost:8000";

// --- NEW SCALES ---

// 11-step traditional heat scale: Blue -> Cyan -> Green -> Yellow -> Red
const PRICE_COLORS = [
    '#000080', // 0: dark blue
    '#0000CC', // 1: medium blue
    '#0066FF', // 2: light blue
    '#00AAFF', // 3: blue-cyan
    '#00FFFF', // 4: cyan
    '#00FFAA', // 5: cyan-green
    '#00FF00', // 6: green
    '#AAFF00', // 7: green-yellow
    '#FFFF00', // 8: yellow
    '#FFAA00', // 9: yellow-red
    '#FF0000'  // 10: red
];

// Retail fits approximately 0.13 -> 0.28
export const RETAIL_COLOR_SCALE = [
    { threshold: 0.13, color: PRICE_COLORS[0] },
    { threshold: 0.14, color: PRICE_COLORS[1] },
    { threshold: 0.15, color: PRICE_COLORS[2] },
    { threshold: 0.16, color: PRICE_COLORS[3] },
    { threshold: 0.17, color: PRICE_COLORS[4] },
    { threshold: 0.18, color: PRICE_COLORS[5] },
    { threshold: 0.19, color: PRICE_COLORS[6] },
    { threshold: 0.20, color: PRICE_COLORS[7] },
    { threshold: 0.21, color: PRICE_COLORS[8] },
    { threshold: 0.23, color: PRICE_COLORS[9] },
    { threshold: 0.25, color: PRICE_COLORS[10] }
];

// Wholesale fits approximately 0.015 -> 0.038
export const WHOLESALE_COLOR_SCALE = [
    { threshold: 0.015, color: PRICE_COLORS[0] },
    { threshold: 0.018, color: PRICE_COLORS[1] },
    { threshold: 0.020, color: PRICE_COLORS[2] },
    { threshold: 0.022, color: PRICE_COLORS[3] },
    { threshold: 0.024, color: PRICE_COLORS[4] },
    { threshold: 0.026, color: PRICE_COLORS[5] },
    { threshold: 0.028, color: PRICE_COLORS[6] },
    { threshold: 0.030, color: PRICE_COLORS[7] },
    { threshold: 0.032, color: PRICE_COLORS[8] },
    { threshold: 0.035, color: PRICE_COLORS[9] },
    { threshold: 0.038, color: PRICE_COLORS[10] }
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
