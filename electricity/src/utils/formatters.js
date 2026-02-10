// src/utils/formatters.js

import { COLOR_SCALE } from './config.js';

export function formatDateForInput(date) {
    if (!date) return '';
    return date.toISOString().split('T')[0];
}

export function getColorForLmp(value, scale = COLOR_SCALE) {
    if (value === null || value === undefined) {
        return '#cccccc';
    }
    for (const item of scale) {
        if (value >= item.threshold) {
            return item.color;
        }
    }
    return scale[scale.length - 1].color;
}
