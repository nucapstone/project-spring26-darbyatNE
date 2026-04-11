import os
import requests
import pandas as pd
from dotenv import load_dotenv
import time
from datetime import datetime

# --- CONFIGURATION ---
load_dotenv()

# 1. API Configuration
PJM_API_KEY = os.getenv("PJM_API_KEY")
PJM_API_ENDPOINT = 'https://api.pjm.com/api/v1/da_hrl_lmps'

# Default dates for Manual Runs
START_DATE = datetime(2026, 3, 1, 0, 0)  # Start at midnight
END_DATE = datetime(2026, 3, 1, 1, 0)    # End at 1 AM

def fetch_and_save_pjm_da_lmp_data_to_excel():
    """
    Fetches PJM historical Day-Ahead LMP data for a specific hour and saves it to an Excel file.
    """
    if not PJM_API_KEY:
        print("Error: Missing .env configuration.")
        return

    date_range_str = f"{START_DATE.isoformat()} to {END_DATE.isoformat()}"
    headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}

    print(f"--- Processing Day-Ahead LMPs: {date_range_str} ---")

    # Prepare params for the API request
    params = {
        'rowCount': 50000,
        'order': 'Asc',
        'startRow': 1,
        'datetime_beginning_ept': date_range_str
    }

    try:
        print("Querying PJM API for LMP data...")
        response = requests.get(PJM_API_ENDPOINT, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        items = response.json().get('items', [])

        if not items:
            print("No data.")
            return
        
        # Prepare data for DataFrame
        data = []
        for item in items:
            data.append({
                'datetime_beginning_ept': item.get('datetime_beginning_ept'),
                'pnode_id': item.get('pnode_id'),
                'pnode_name': item.get('pnode_name'),
                'type': item.get('type'),
                'system_energy_price_da': item.get('system_energy_price_da'),
                'total_lmp_da': item.get('total_lmp_da'),
                'congestion_price_da': item.get('congestion_price_da'),
                'marginal_loss_price_da': item.get('marginal_loss_price_da'),
                'transmission_zone': item.get('zone'),  
                'voltage': item.get('voltage')  
            })

        # Create a DataFrame
        df = pd.DataFrame(data)

        # Save to Excel
        excel_filename = "retail_lmps.xlsx"
        df.to_excel(excel_filename, index=False)
        print(f"Data saved to {excel_filename}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    fetch_and_save_pjm_da_lmp_data_to_excel()
