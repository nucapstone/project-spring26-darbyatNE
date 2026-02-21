// src/components/ui.js

/**
 * Updates the top filter display with Year/Month range and Total Months count.
 */
export function displayCurrentFilter(filter, status = null) {
    const container = document.getElementById('top-filter-display');
    if (!container) return; 

    // --- 1. Parse Years & Calculate Year Span ---
    // We use safe parsing to ensure we get numbers
    const startYearStr = filter.startDate ? filter.startDate.split('-')[0] : new Date().getFullYear().toString();
    const endYearStr = filter.endDate ? filter.endDate.split('-')[0] : new Date().getFullYear().toString();
    
    const sYear = parseInt(startYearStr, 10);
    const eYear = parseInt(endYearStr, 10);
    
    // Calculate span (inclusive). e.g., 2020-2020 = 1 year. 2020-2022 = 3 years.
    const numberOfYears = (isNaN(sYear) || isNaN(eYear)) ? 0 : (Math.abs(eYear - sYear) + 1);

    const yearDisplay = sYear === eYear ? `${sYear}` : `${sYear} – ${eYear}`;

    // --- 2. Parse Months & Calculate Month Count ---
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthsDisplay = "All Months";
    let activeMonthCount = 12; // Default to 12 (All)

    // Check if specific months are selected
    if (filter.months && Array.isArray(filter.months)) {
        const len = filter.months.length;
        
        // If 0 (empty) or 12 (full), we consider it "All Months"
        if (len === 0 || len === 12) {
            monthsDisplay = "All Months";
            activeMonthCount = 12;
        } else {
            // Sort and map indices (0=Jan) to names
            const sortedMonths = [...filter.months].sort((a, b) => a - b);
            monthsDisplay = sortedMonths.map(i => monthNames[i]).join(", ");
            activeMonthCount = len;
        }
    }

    // --- 3. Calculate Total Months ---
    const totalMonths = numberOfYears * activeMonthCount;

    // --- 4. Handle Status / Count Display ---
    let countValue = "--"; 
    let countColor = "#333"; 
    let labelText = "Total Months";

    if (status === "Loading...") {
        countValue = "Loading...";
        countColor = "#666";
    } else {
        // Force the calculated total, ignoring any '0' passed from the database/controller
        countValue = totalMonths.toLocaleString();
        countColor = totalMonths > 0 ? "#007bff" : "#dc3545";
    }

    // --- 5. Render HTML ---
    container.style.display = "flex"; 
    container.style.justifyContent = "space-between"; 
    container.style.alignItems = "center";
    
    container.innerHTML = `
        <div style="flex: 1; min-width: 0; padding-right: 10px;">
            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px;">
                <li style="font-size: 14px;">
                    <span style="color: #666; font-weight: bold; width: 50px; display: inline-block;">Years:</span> 
                    <span style="font-weight: 600; color: #333;">${yearDisplay}</span>
                </li>
                <li style="font-size: 13px; line-height: 1.4;">
                    <span style="color: #666; font-weight: bold; width: 50px; display: inline-block;">Months:</span> 
                    <span style="color: #444;">${monthsDisplay}</span>
                </li>
            </ul>
        </div>
        
        <div style="flex-shrink: 0; border-left: 1px solid #ccc; padding-left: 15px; margin-left: 10px; text-align: center; display: flex; flex-direction: column; justify-content: center; min-width: 80px;">
            <span style="font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; line-height: 1; margin-bottom: 4px;">${labelText}</span>
            <span style="font-size: 20px; font-weight: bold; color: ${countColor}; line-height: 1;">${countValue}</span>
        </div>
    `;
}

/**
 * Renders a static legend for the map colors.
 */
export function buildLegend() {
    const legendContainer = document.getElementById('map-legend');
    if (!legendContainer) return;

    legendContainer.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.9); padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 12px;">
            <div style="font-weight: bold; margin-bottom: 5px; text-align: center;">LMP Price ($/MWh)</div>
            <div style="display: flex; align-items: center; justify-content: center;">
                <span style="margin-right: 8px; font-weight: 500;">Low</span>
                <div style="
                    width: 120px; 
                    height: 12px; 
                    background: linear-gradient(90deg, #4575b4 0%, #ffffbf 50%, #d73027 100%); 
                    border: 1px solid #ccc;
                    border-radius: 2px;
                "></div>
                <span style="margin-left: 8px; font-weight: 500;">High</span>
            </div>
        </div>
    `;
}

/**
 * Initializes Info Modals (About, Help, etc.)
 */
export function initInfoModals() {
    console.log("Info modals initialized");
}
