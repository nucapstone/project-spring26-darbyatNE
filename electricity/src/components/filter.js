const params = new URLSearchParams(window.location.search);

// 1. Parse Years
const pStartYear = params.get("start_year");
const pEndYear = params.get("end_year");
const pYear = params.get("year");

// Default to 2024 if nothing exists
const startYear = pStartYear ? parseInt(pStartYear) : (pYear ? parseInt(pYear) : 2024);
const endYear = pEndYear ? parseInt(pEndYear) : (pYear ? parseInt(pYear) : 2024);

// 2. Parse Months
const pMonths = params.get("months");
// If param exists, parse "1,2,3" -> [1,2,3]. If missing, default to ALL (0-11).
const months = pMonths ? pMonths.split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// 3. Construct Date Strings (Required for API/MapController)
const startDate = `${startYear}-01-01`;
const endDate = `${endYear}-12-31`;

export const filter = {
    startYear,
    endYear,
    year: startYear, // Legacy compatibility
    months,
    startDate,
    endDate
};

export function saveFilter(newFilter) {
    Object.assign(filter, newFilter);
}
