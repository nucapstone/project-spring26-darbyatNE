// src/components/filter.js

const FILTER_STORAGE_KEY = 'pjm-map-filter';

const DEFAULT_FILTER = {
  startDate: '2025-06-30',
  endDate: '2025-06-30',
  startTime: 15,
  endTime: 20,
  daysOfWeek: [false, true, true, true, true, true, false], // Mon-Fri
};

function loadFilter() {
  const saved = localStorage.getItem(FILTER_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return parsed;
  }
  return DEFAULT_FILTER;
}

export function saveFilter(newFilter) {
  Object.assign(filter, newFilter);
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(newFilter));
}

export let filter = loadFilter();