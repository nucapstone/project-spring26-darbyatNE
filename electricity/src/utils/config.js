// src/utils/config.js

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// export const API_BASE_URL = "https://obvolutive-secondarily-lainey.ngrok-free.dev";
export const API_BASE_URL = "http://localhost:8000";

export const ZONE_LABEL_OVERRIDES = {
    "AEP": [[40.9, -84.4], [39.03, -82.55]],
    "APS": [[39.14, -79.8], [41.46, -78.2]],
    "COMED": [[41.95, -88.67]],
    "DAY": [[40.02, -84.42]],
    "DPL": [[38.74, -75.68]],
    "DOM": [[37.52, -77.65]],
    "DUQ": [[40.44, -79.96]],
    "EKPC": [[37.19, -85.17], [38.25, -83.60]],
    "FE-ATSI": [[41.2, -81.52]],
    "METED": [[40.37, -76.45], [40.86, -75.25]],
    "LGE": [[38.00, -85.06]],
    "PECO": [[40.10, -75.39]],
    "PENELEC": [[40.45, -78.29], [41.75, -76.49]],
    "RECO": [[41.13, -74.34]],
    "JCPL": [[40.13, -74.24], [40.97, -74.6]]
};

export const COLOR_SCALE = [
    { threshold: 100, color: '#b30000' }, { threshold: 75, color: '#dc3545' },
    { threshold: 62, color: '#ff5500' }, { threshold: 52, color: '#ff7b00' },
    { threshold: 44, color: '#ff9900' }, { threshold: 37, color: '#ffc107' },
    { threshold: 30, color: '#99cc33' }, { threshold: 25, color: '#00cc66' },
    { threshold: 20, color: '#00aaff' }, { threshold: 0, color: '#007bff' },
    { threshold: -Infinity, color: '#800080' }
];

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