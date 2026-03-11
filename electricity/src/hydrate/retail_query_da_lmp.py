"""
Script: PJM Day-Ahead LMP Scraper (PostgreSQL)
Description:
    Fetches Day-Ahead Hourly LMP data from the PJM API for a specific date range 
    and a specific list of PNodes.
    
    called by the 'update_retail_lmps.py' orchestrator.

Arguments:
    1. Start Date (YYYY-MM-DD)
    2. End Date (YYYY-MM-DD)
    3. PNode IDs
"""

import os
import sys
import requests
import psycopg2
from psycopg2.extras import DictCursor
import time
from datetime import datetime
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "port": int(os.getenv("DB_PORT", 5432)), # Default Postgres port
}

PJM_API_KEY = os.getenv("PJM_API_KEY")
PJM_API_ENDPOINT = 'https://api.pjm.com/api/v1/da_hrl_lmps' 
DB_TABLE_NAME = 'pjm_da_hrl_lmps' 

def fetch_and_upsert_da_lmps(start_date, end_date, pnode_list):
    """
    Fetches PJM data for the given date range and list of PNodes.
    """
    if not pnode_list:
        print("   [!] No PNodes provided to scraper. Exiting.")
        return

    if not all([PJM_API_KEY, DB_CONFIG["host"]]):
        print("   [!] Error: Missing .env configuration.")
        return

    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Format for API: "YYYY-MM-DD to YYYY-MM-DD"
        date_range_str = f"{start_date} to {end_date}"
        headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}
        
        print(f"   --- Scraper Started: {date_range_str} for {len(pnode_list)} PNodes ---")

        for i, pnode_id in enumerate(pnode_list):
            print(f"   [{i+1}/{len(pnode_list)}] PNode {pnode_id}...", end=" ", flush=True)
            
            params = {
                'rowCount': 50000,
                'order': 'Asc',
                'startRow': 1,
                'datetime_beginning_ept': date_range_str,
                'pnode_id': pnode_id
            }

            try:
                response = requests.get(PJM_API_ENDPOINT, headers=headers, params=params, timeout=30)
                response.raise_for_status()
                data = response.json()
                items = data.get('items', [])
                
                if not items:
                    print("No data found.")
                else:
                    # Prepare data for batch insert
                    rows_to_upsert = []
                    for item in items:
                        rows_to_upsert.append((
                            item.get('datetime_beginning_ept'),
                            item.get('pnode_id'),
                            item.get('pnode_name'),
                            item.get('type'),
                            item.get('system_energy_price_da'),
                            item.get('total_lmp_da'),
                            item.get('congestion_price_da'),
                            item.get('marginal_loss_price_da')
                        ))

                    # PostgreSQL Upsert (ON CONFLICT)
                    # Assumes a composite unique constraint on (datetime_beginning_ept, pnode_id)
                    sql_upsert = f"""
                        INSERT INTO {DB_TABLE_NAME} (
                            datetime_beginning_ept, pnode_id, pnode_name, type,
                            system_energy_price_da, total_lmp_da, congestion_price_da, marginal_loss_price_da
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (datetime_beginning_ept, pnode_id) DO UPDATE SET
                            pnode_name = EXCLUDED.pnode_name,
                            type = EXCLUDED.type,
                            system_energy_price_da = EXCLUDED.system_energy_price_da,
                            total_lmp_da = EXCLUDED.total_lmp_da,
                            congestion_price_da = EXCLUDED.congestion_price_da,
                            marginal_loss_price_da = EXCLUDED.marginal_loss_price_da;
                    """
                    
                    cursor.executemany(sql_upsert, rows_to_upsert)
                    conn.commit()
                    print(f"Saved {len(rows_to_upsert)} rows.", end=" ")

            except requests.exceptions.RequestException as re:
                print(f"API Error: {re}", end=" ")
            except psycopg2.Error as db_err:
                conn.rollback() # Rollback on DB error
                print(f"DB Error: {db_err}", end=" ")
            except Exception as e:
                print(f"Error: {e}", end=" ")
                
            # --- Rate Limit Handling ---
            if i < len(pnode_list) - 1: 
                print(" (Waiting 10s)")
                time.sleep(10)
            else:
                print("\n   --- Scraper Finished ---")

    except psycopg2.Error as e:
        print(f"\n   [!!!] CRITICAL DB CONNECTION ERROR: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python pjm_query_da_lmp.py <START_DATE> <END_DATE> <PNODE_LIST_STR>")
        sys.exit(1)

    start_arg = sys.argv[1]
    end_arg = sys.argv[2]
    pnode_str = sys.argv[3]

    try:
        pnode_ids = [int(x.strip()) for x in pnode_str.split(',') if x.strip()]
    except ValueError:
        print("Error: PNode list must be comma-separated integers.")
        sys.exit(1)

    fetch_and_upsert_da_lmps(start_arg, end_arg, pnode_ids)
