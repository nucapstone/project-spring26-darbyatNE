/**
 * src/components/ui.js
 * Manages UI updates for the filter display and modals.
 */

export function initInfoModals() {
  const helpBtn = document.getElementById('help-btn');
  const filterBtn = document.getElementById('filter-btn');
  const helpModal = document.getElementById('help-modal');
  const filterModal = document.getElementById('filter-modal');

  if (helpBtn && helpModal) {
    helpBtn.addEventListener('click', () => helpModal.showModal());
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.close();
    });
  }

  if (filterBtn && filterModal) {
    filterBtn.addEventListener('click', () => filterModal.showModal());
    filterModal.addEventListener('click', (e) => {
      if (e.target === filterModal) filterModal.close();
    });
  }
}

export function displayCurrentFilter(filter, statusOverride = null) {
  const container = document.getElementById('current-filter-display');
  if (!container) return;

  // 1. Handle Loading/Status Messages
  if (statusOverride) {
    container.innerHTML = `<span style="color: #666; font-style: italic;">${statusOverride}</span>`;
    return;
  }

  // 2. Format the Year String
  let yearText = "All Years";
  
  // Ensure we have numbers
  const start = parseInt(filter.startYear || filter.year);
  const end = parseInt(filter.endYear || filter.year);

  if (!isNaN(start)) {
      if (!isNaN(end) && start !== end) {
          yearText = `${start} – ${end}`;
      } else {
          yearText = `${start}`;
      }
  }

  // 3. Format the Month String
  let monthText = "All Months";
  
  // Handle months (ensure it's an array)
  let monthArray = filter.months;
  
  // If it's a string (from URL), split it
  if (typeof monthArray === 'string') {
      monthArray = monthArray.split(',').map(Number);
  }

  if (Array.isArray(monthArray) && monthArray.length > 0) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    if (monthArray.length === 12) {
        monthText = "All Months";
    } else {
        const sorted = [...monthArray].sort((a, b) => a - b);
        monthText = sorted.map(m => monthNames[m]).join(", ");
    }
  }

  // 4. Render the HTML
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; line-height: 1.2;">
            <span style="font-weight: bold; color: #0066cc; font-size: 14px;">${yearText}</span>
            <span style="font-size: 12px; color: #0066cc;">${monthText}</span>
    </div>
  `;
}

export function buildLegend(retailScale, wholesaleScale, title = "Price ($/MWh)", options = {}) {
    const legendContainer = document.getElementById('legend');
    if (!legendContainer) return;

    // Always re-open on redraw so the color bins remain visible.
    const isMinimized = false;
    legendContainer.dataset.minimized = 'false';

    const subtitleRow = (options.locational && options.zoneColorMap)
        ? `<div style="margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px; font-size: 12px; color: #000; font-weight: 700; text-align: center;">Retail Servcie Trerritories</div>`
        : `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; font-size: 10px; color: #000;">
                    <span style="font-weight: bold; color: #000; text-align: right;">Retail (Territory Shapes)<br><span style="font-weight: normal;">(¢/kWhr)</span></span>
                    <span style="font-weight: bold; color: #000; text-align: left;">Wholesale (LMP Points)<br><span style="font-weight: normal;">(¢/kWhr)</span></span>
                </div>`;

    let html = `
        <div style="background: rgba(255, 255, 255, 0.9); padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="font-weight: bold; font-size: 13px;">${title}</div>
                <button id="legend-minimize-btn" style="border: 1px solid #bbb; border-radius: 3px; background: #fff; color: #333; font-size: 12px; width: 20px; height: 20px; line-height: 16px; padding: 0; cursor: pointer;" aria-expanded="${!isMinimized}" title="${isMinimized ? 'Expand legend' : 'Minimize legend'}">${isMinimized ? '+' : '-'}</button>
            </div>
            <div id="legend-content" style="display: ${isMinimized ? 'none' : 'block'}; max-height: 300px; overflow-y: auto; overflow-x: hidden;">
                ${subtitleRow}
    `;

    if (options.locational && options.zoneColorMap) {
        const zonePairs = Array.from(options.zoneColorMap.entries());
        zonePairs.forEach(([zone, color]) => {
            html += `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span style="background-color: ${color}; width: 15px; height: 15px; display: inline-block; margin-right: 8px; border: 1px solid #ccc; border-radius: 2px;"></span>
                    <span style="font-size: 11px; white-space: nowrap;">${zone}</span>
                </div>
            `;
        });
    } else {
        if (!retailScale || !wholesaleScale) {
            html += `<div style="font-size: 11px; color: #666;">No scale data available.</div>`;
        } else {
            const stepCount = Math.min(retailScale.length, wholesaleScale.length);
            const formatScaleLabel = (scale, index) => {
                const currentStep = scale[index];
                const previousStep = scale[index - 1];
                if (!currentStep) return '';

                if (index === 0) {
                    return `≤ ${(currentStep.threshold * 100).toFixed(1)}¢`;
                }

                if (index === stepCount - 1) {
                    return `> ${(previousStep.threshold * 100).toFixed(1)}¢`;
                }

                return `${(previousStep.threshold * 100).toFixed(1)}¢-${(currentStep.threshold * 100).toFixed(1)}¢`;
            };

            for (let index = 0; index < stepCount; index++) {
                const retailStep = retailScale[index];
                const wholesaleStep = wholesaleScale[index];
                const color = (retailStep && retailStep.color) || (wholesaleStep && wholesaleStep.color) || '#cccccc';

                const retailLabel = formatScaleLabel(retailScale, index);
                const wholesaleLabel = formatScaleLabel(wholesaleScale, index);

                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px;">
                        <span style="font-size: 10px; white-space: nowrap; color: #0066cc; flex: 1; text-align: right;">${retailLabel}</span>
                        <span style="background-color: ${color}; width: 15px; height: 15px; display: inline-block; border: 1px solid #ccc; border-radius: 2px; flex-shrink: 0;"></span>
                        <span style="font-size: 10px; white-space: nowrap; color: #cc6600; flex: 1; text-align: left;">${wholesaleLabel}</span>
                    </div>
                `;
            }
        }
    }

    html += `
            </div>
        </div>
    `;

    legendContainer.innerHTML = html;

    const toggleBtn = document.getElementById('legend-minimize-btn');
    const legendContent = document.getElementById('legend-content');

    if (toggleBtn && legendContent) {
        toggleBtn.addEventListener('click', () => {
            const willMinimize = legendContent.style.display !== 'none';
            legendContent.style.display = willMinimize ? 'none' : 'block';
            legendContainer.dataset.minimized = willMinimize ? 'true' : 'false';
            toggleBtn.textContent = willMinimize ? '+' : '-';
            toggleBtn.setAttribute('aria-expanded', willMinimize ? 'false' : 'true');
            toggleBtn.title = willMinimize ? 'Expand legend' : 'Minimize legend';
        });
    }
}
