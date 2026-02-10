import os
import sys
import requests
import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv
import time
from datetime import date, timedelta, datetime

# --- CONFIGURATION ---
load_dotenv()

# 1. DB Config
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "cursorclass": DictCursor
}

PJM_API_KEY = os.getenv("PJM_API_KEY")
PJM_API_ENDPOINT = 'https://api.pjm.com/api/v1/da_hrl_lmps' 
DB_TABLE_NAME = 'pjm_da_hrl_lmps' 

# 2. PNODE LIST
PNODE_IDS = [
    51217, 51288, 4669664, 5413134, 31252687, 33092311, 33092313,
    33092315, 34497125, 34497127, 34497151, 35010337, 40523629,
    56958967, 81436855, 116013751, 116472927, 116472931, 116472933,
    116472935, 116472937, 116472939, 116472941, 116472943,
    116472945, 116472947, 116472949, 116472951, 116472953,
    116472955, 116472957, 116472959, 126769999, 1069452904,
    1124361945, 1127872598, 1258625176, 1269364670, 1269364671,
    1269364672, 1269364674, 1288248099, 1304468347, 1441662202,
    1709726615, 2156111904
]

# Default dates for Manual Runs
START_DATE = date(2025, 11, 1)
END_DATE = date(2025, 12, 6)

def fetch_and_upsert_pjm_da_lmp_data_pymysql():
    """
    Fetches PJM historical Day-Ahead LMP data for a list of PNode IDs.
    Strictly follows 5 requests/minute limit (12s buffer).
    """
    global START_DATE, END_DATE

    if not all([PJM_API_KEY, DB_CONFIG["host"]]):
        print("Error: Missing .env configuration.")
        return

    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()

        date_range_str = f"{START_DATE.strftime('%Y-%m-%d')} to {END_DATE.strftime('%Y-%m-%d')}"
        headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}
        
        print(f"--- Processing Day-Ahead LMPs: {date_range_str} ---")

        for i, pnode_id in enumerate(PNODE_IDS):
            print(f"   [{i+1}/{len(PNODE_IDS)}] Querying PNode {pnode_id}...", end=" ", flush=True)
            
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
                items = response.json().get('items', [])
                
                if not items:
                    print("No data.")
                else:
                    # Prepare data
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

                    # Batch upsert
                    sql_upsert = f"""
                        INSERT INTO {DB_TABLE_NAME} (
                            datetime_beginning_ept, pnode_id, pnode_name, type,
                            system_energy_price_da, total_lmp_da, congestion_price_da, marginal_loss_price_da
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            pnode_name = VALUES(pnode_name),
                            type = VALUES(type),
                            system_energy_price_da = VALUES(system_energy_price_da),
                            total_lmp_da = VALUES(total_lmp_da),
                            congestion_price_da = VALUES(congestion_price_da),
                            marginal_loss_price_da = VALUES(marginal_loss_price_da)
                    """
                    
                    cursor.executemany(sql_upsert, rows_to_upsert)
                    conn.commit()
                    print(f"Saved {len(rows_to_upsert)} rows.", end=" ")

            except Exception as e:
                print(f"Error: {e}", end=" ")
                
            # --- API RAte Limit ---
            if i < len(PNODE_IDS) - 1: # Don't sleep after the very last one
                print("⏳ Waiting 10s...")
                time.sleep(10)
            else:
                print("\nDone.")

    except pymysql.Error as e:
        print(f"\nCRITICAL DB ERROR: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # Command Line Argument Parsing
    if len(sys.argv) > 2:
        try:
            START_DATE = date.fromisoformat(sys.argv[1])
            END_DATE = date.fromisoformat(sys.argv[2])
        except ValueError:
            print("Error: Invalid date format. Use YYYY-MM-DD.")
            sys.exit(1)
    
    fetch_and_upsert_pjm_da_lmp_data_pymysql()
