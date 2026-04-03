"""
Script: PJM Historical Zonal Load Forecast Scraper (PostgreSQL)
Description:
    Fetches historical load forecast data from the PJM Historical Load Forecast
    API for a specific date range and list of forecast areas. Requests are
    chunked by month to stay within PJM row and date-range limits.

Arguments:
    1. Start Year (YYYY)
    2. End Year (YYYY)
    3. (Optional) Comma-separated list of forecast areas or zone aliases.
       Defaults to all supported PJM forecast areas.
"""

import os
import sys
import requests
import psycopg2
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "port": int(os.getenv("DB_PORT", 5432)),
}

PJM_API_KEY = os.getenv("PJM_API_KEY")
PJM_API_ENDPOINT = 'https://api.pjm.com/api/v1/load_frcstd_hist'
DB_TABLE_NAME = 'pjm_forecast_load'
MAX_API_RETRIES = 4

# Historical load forecast supports broader forecast areas rather than every
# individual PJM transmission zone.
SUPPORTED_FORECAST_AREAS = [
    "AEP", "APS", "ATSI", "COMED", "DAY", "DEOK",
    "DOM", "DUQ", "EKPC", "MIDATL", "OVEC", "RTO"
]

# Map common PJM zone names to the supported historical forecast areas.
ZONE_TO_FORECAST_AREA = {
    "AECO": "MIDATL",
    "BGE": "MIDATL",
    "DPL": "MIDATL",
    "JCPL": "MIDATL",
    "METED": "MIDATL",
    "PECO": "MIDATL",
    "PENELEC": "MIDATL",
    "PEPCO": "MIDATL",
    "PPL": "MIDATL",
    "PSEG": "MIDATL",
    "RECO": "MIDATL",
}


def normalize_forecast_areas(values):
    normalized = []
    for value in values:
        candidate = value.strip().upper()
        if not candidate:
            continue

        area = ZONE_TO_FORECAST_AREA.get(candidate, candidate)
        if area not in SUPPORTED_FORECAST_AREAS:
            print(f"   [!] Skipping unsupported forecast area/zone: {candidate}")
            continue

        if area not in normalized:
            normalized.append(area)

    return normalized

def fetch_and_upsert_forecast_load(start_year, end_year, zone_list):
    """
    Fetches PJM forecast load data in monthly chunks to avoid API row limits.
    """
    if not all([PJM_API_KEY, DB_CONFIG["host"]]):
        print("   [!] Error: Missing .env configuration.")
        return

    forecast_areas = normalize_forecast_areas(zone_list)
    if not forecast_areas:
        print("   [!] No supported forecast areas provided. Exiting.")
        return

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}
        
        print(f"   --- Forecast Scraper Started: {start_year}-{end_year} for {len(forecast_areas)} Forecast Areas ---")

        for i, area in enumerate(forecast_areas):
            print(f"\n   [{i+1}/{len(forecast_areas)}] Processing Forecast Area: {area}")
            
            for year in range(start_year, end_year + 1):
                for month in range(1, 13):
                    chunk_start = datetime(year, month, 1, 0, 0)
                    if month == 12:
                        next_month = datetime(year + 1, 1, 1, 0, 0)
                    else:
                        next_month = datetime(year, month + 1, 1, 0, 0)

                    chunk_end = next_month - timedelta(minutes=1)
                    date_range_str = f"{chunk_start:%Y-%m-%d %H:%M} to {chunk_end:%Y-%m-%d %H:%M}"
                    print(f"       -> Fetching {year}-{month:02d}...", end=" ", flush=True)
                    
                    params = {
                        'rowCount': 50000,
                        'sort': 'evaluated_at_utc',
                        'order': 'Asc',
                        'startRow': 1,
                        'forecast_hour_beginning_ept': date_range_str,
                        'forecast_area': area
                    }

                    try:
                        response = None
                        for attempt in range(1, MAX_API_RETRIES + 1):
                            response = requests.get(PJM_API_ENDPOINT, headers=headers, params=params, timeout=60)

                            if response.status_code != 429:
                                break

                            wait_seconds = int(response.headers.get("Retry-After", 15))
                            print(f"Rate limited (attempt {attempt}/{MAX_API_RETRIES}); waiting {wait_seconds}s...", end=" ", flush=True)
                            time.sleep(wait_seconds)
                        else:
                            print("API Error: exceeded PJM rate limit retries.")
                            continue

                        response.raise_for_status()
                        data = response.json()
                        items = data.get('items', [])
                        
                        if not items:
                            print("No data found.")
                        else:
                            rows_to_upsert = []
                            for item in items:
                                rows_to_upsert.append((
                                    item.get('forecast_hour_beginning_ept') or item.get('forecast_datetime_beginning_ept'),
                                    item.get('evaluated_at_ept') or item.get('evaluated_at_datetime_ept'),
                                    item.get('forecast_area'),
                                    item.get('forecast_load_mw')
                                ))

                            sql_upsert = f"""
                                INSERT INTO {DB_TABLE_NAME} (
                                    forecast_hour_beginning_ept, evaluated_at_ept, forecast_area, forecast_load_mw
                                )
                                VALUES (%s, %s, %s, %s)
                                ON CONFLICT (forecast_hour_beginning_ept, forecast_area) DO UPDATE SET
                                    evaluated_at_ept = EXCLUDED.evaluated_at_ept,
                                    forecast_load_mw = EXCLUDED.forecast_load_mw;
                            """
                            
                            cursor.executemany(sql_upsert, rows_to_upsert)
                            conn.commit()

                            total_rows = data.get('totalRows', len(items))
                            if total_rows > len(items):
                                print(f"Processed {len(rows_to_upsert)} forecast records (returned {len(items)} of {total_rows}).")
                            else:
                                print(f"Processed {len(rows_to_upsert)} forecast records.")

                    except requests.exceptions.RequestException as re:
                        error_detail = ""
                        if getattr(re, "response", None) is not None:
                            error_detail = f" | Response: {re.response.text[:500]}"
                        print(f"API Error: {re}{error_detail}")
                    except psycopg2.Error as db_err:
                        conn.rollback()
                        print(f"DB Error: {db_err}")
                    except Exception as e:
                        print(f"Error: {e}")
                        
                    time.sleep(2)

            if i < len(forecast_areas) - 1: 
                print("   [Waiting 5s before next forecast area to respect rate limits...]")
                time.sleep(5)

        print("\n   --- Scraper Finished Successfully ---")

    except psycopg2.Error as e:
        print(f"\n   [!!!] CRITICAL DB CONNECTION ERROR: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python retail_query_forecast_by_zone.py <START_YEAR> <END_YEAR> [OPTIONAL_ZONE_LIST]")
        print("Example: python retail_query_forecast_by_zone.py 2020 2026")
        sys.exit(1)

    try:
        start_y = int(sys.argv[1])
        end_y = int(sys.argv[2])
    except ValueError:
        print("Error: Start and End years must be integers (e.g., 2020 2026).")
        sys.exit(1)

    if len(sys.argv) >= 4:
        zones_str = sys.argv[3]
        target_zones = [x.strip().upper() for x in zones_str.split(',') if x.strip()]
    else:
        target_zones = SUPPORTED_FORECAST_AREAS

    fetch_and_upsert_forecast_load(start_y, end_y, target_zones)
