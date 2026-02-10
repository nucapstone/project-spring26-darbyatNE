# LMP Query Tool
#### LMP - Locational Marginal Price

<link rel="stylesheet" href="./styles/picker.css">

```js
import { filter, saveFilter } from "./components/filter.js";
import { dateTimeRangePicker } from "./components/picker.js";

import { API_BASE_URL } from "../utils/config.js";
```
```js
(async () => {
  // 1. Fetch Constraints
  let constraintList = [];
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/constraints/list`, {
        headers: {
            "ngrok-skip-browser-warning": "true"
        }
    });
    const data = await response.json();


    if (data.constraints && Array.isArray(data.constraints)) {
        constraintList = data.constraints;
    } else if (Array.isArray(data)) {
        constraintList = data;
    }
  } catch (e) {
    console.error("Error loading constraints", e);
    constraintList = [];
  }

  // 2. Initialize Picker
  const picker = dateTimeRangePicker({
    width: 800,
    initialStartTime: filter.startTime,
    initialEndTime: filter.endTime,
    initialStartDate: filter.startDate,
    initialEndDate: filter.endDate,
    initialDaysOfWeek: filter.daysOfWeek,
    constraintList: constraintList,
    initialConstraint: filter.selectedConstraint
  });

  // 3. State Management
  const toDateStr = (d) => d instanceof Date ? d.toISOString().split('T')[0] : d;

  function updateState(e) {
    const f = e.detail; 
    const isFullDay = (f.startTime === 0 && f.endTime === 24);
    const isAllDays = f.daysOfWeek && f.daysOfWeek.every(day => day === true);
    const newFilterState = {
      ...f,
      startDate: toDateStr(f.startDate),
      endDate: toDateStr(f.endDate),
      startHour: isFullDay ? null : f.startTime,
      endHour:   isFullDay ? null : f.endTime,
      daysOfWeek: isAllDays ? null : f.daysOfWeek,
      selectedConstraint: f.selectedConstraint || null 
    };

    saveFilter(newFilterState);
  }

  // 4. Event Listeners
  picker.addEventListener('filterchange', updateState);
  
  picker.addEventListener('apply', (e) => {
    updateState(e);
    window.location.href = '/index?fetch=true';
  });

  display(picker);
})();
```