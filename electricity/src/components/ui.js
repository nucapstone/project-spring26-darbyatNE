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
      <span style="font-weight: bold; color: #333; font-size: 14px;">${yearText}</span>
      <span style="font-size: 12px; color: #666;">${monthText}</span>
    </div>
  `;
}

export function buildLegend(colorScale, title = "Price ($/MWh)") {
    // Note: Make sure your HTML has an element with id="legend" (or change this to 'map-legend' if that's what you are using)
    const legendContainer = document.getElementById('legend');
    if (!legendContainer) return;

    let html = `
        <div style="background: rgba(255, 255, 255, 0.9); padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 12px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px; text-align: center;">${title}</div>
            <div style="max-height: 300px; overflow-y: auto; overflow-x: hidden;">
    `;

    // Loop through every increment in the color scale array
    colorScale.forEach((step, index) => {
        const value = Array.isArray(step) ? step[0] : step.value;
        const color = Array.isArray(step) ? step[1] : step.color;

        let label = '';

        // Format the text based on where we are in the list
        if (index === colorScale.length - 1) {
            label = `$${value}+`;
        } else {
            const nextStep = colorScale[index + 1];
            const nextValue = Array.isArray(nextStep) ? nextStep[0] : nextStep.value;
            label = `$${value} to $${nextValue}`;
        }

        // Add the color box and label to the HTML
        html += `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                <span style="background-color: ${color}; width: 15px; height: 15px; display: inline-block; margin-right: 8px; border: 1px solid #ccc; border-radius: 2px;"></span>
                <span style="font-size: 11px; white-space: nowrap;">${label}</span>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    legendContainer.innerHTML = html;
}
