# LMP Query Tool
#### LMP - Locational Marginal Price

<link rel="stylesheet" href="./styles/picker.css">

```js
import { filter, saveFilter } from "./components/filter.js";
import { dateTimeRangePicker } from "./components/picker.js";
import { API_BASE_URL } from "../utils/config.js";

(async () => {
  // 1. Initialize Picker
  // We removed the constraint fetching block entirely.
  // We now pass Year and Month configurations instead of Date/Time/Constraint props.
  const picker = dateTimeRangePicker({
    width: 800,
    
    // Yearly Slider Configuration
    minYear: 2020,
    maxYear: 2026,
    initialStartYear: filter.startYear || 2020,
    initialEndYear: filter.endYear || 2026,

    // Month Selector Configuration (Jan, Feb...)
    // Assuming filter.months is an array of selected month indices (0-11)
    initialMonths: filter.months || [],
  });

  // 2. State Management
  function updateState(e) {
    const f = e.detail; 
    
    // Check if all 12 months are selected
    const isAllMonths = f.months && f.months.length === 12;

    const newFilterState = {
      // Map new Year/Month values
      startYear: f.startYear,
      endYear: f.endYear,
      months: isAllMonths ? null : f.months, // If all are selected, save as null to imply "no filter"
    };

    saveFilter(newFilterState);
  }

  // 3. Event Listeners
  picker.addEventListener('filterchange', updateState);
  
  picker.addEventListener('apply', (e) => {
    updateState(e);
    window.location.href = '/index?fetch=true';
  });

  display(picker);
})();
