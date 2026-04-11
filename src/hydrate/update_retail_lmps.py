"""
Script: Update PJM Day-Ahead LMPs from PJM API
Description:
    A script to fetch PJM Day-Ahead Hourly LMP data for PNodes listed in the retail_lmps table.
    Optimized with a bulk database gap-check to prevent hanging, and a "smart throttle" 
    to dynamically pace API requests to exactly 10.5 seconds, avoiding 429 rate limits.
"""

import os
import requests
from dotenv import load_dotenv
from pathlib import Path
import time
from datetime import date, datetime, timedelta
import psycopg2
from psycopg2.extras import DictCursor, execute_values

# Load .env
env_path = Path(__file__).resolve().parents[2] / '.env'
load_dotenv(dotenv_path=env_path)

# API configuration
PJM_API_KEY = os.getenv("PJM_API_KEY")
PJM_API_ENDPOINT = 'https://api.pjm.com/api/v1/da_hrl_lmps'

# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME", "electricity_db"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "connect_timeout": 10
}

# Time block and archive configuration
ARCHIVE_CUTOFF_DAYS = 731
ARCHIVED_TIME_BLOCK_SIZE = 2   
RECENT_TIME_BLOCK_SIZE = 183   
TARGET_TABLE = "pjm_da_hrl_lmps"

# Rate limiting configuration
last_api_call_time = 0.0
MIN_API_INTERVAL = 10.5  # 10.5s ensures we stay safely under 6 requests/minute

def get_pnode_ids_from_db():
    """Retrieve distinct PNode IDs from the retail_lmps table."""
    conn = None
    pnode_ids = []
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            query = "SELECT DISTINCT pnode_id FROM retail_lmps WHERE pnode_id IS NOT NULL"
            cursor.execute(query)
            pnode_ids = [row['pnode_id'] for row in cursor.fetchall() if row['pnode_id'] is not None]
            print(f"Retrieved {len(pnode_ids)} unique PNode IDs from retail_lmps table.")
    except psycopg2.Error as e:
        print(f"Database error while fetching PNode IDs: {e}")
    finally:
        if conn:
            conn.close()
    return pnode_ids

def get_missing_pnodes(all_pnode_ids, start_date, end_date):
    """
    Does a SINGLE database query to check all PNodes for a given date range.
    Returns a SET of pnode_ids that do not have the expected number of records.
    """
    if not all_pnode_ids:
        return set()
        
    expected_days = (end_date - start_date).days + 1
    missing_pnodes = set()
    
    conn = None
    t0 = time.time()
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            query = f"""
                SELECT pnode_id, COUNT(DISTINCT CAST(datetime_beginning_ept AS DATE)) as day_count
                FROM {TARGET_TABLE}
                WHERE pnode_id = ANY(%s)
                  AND CAST(datetime_beginning_ept AS DATE) >= %s
                  AND CAST(datetime_beginning_ept AS DATE) <= %s
                GROUP BY pnode_id
            """
            cursor.execute(query, (all_pnode_ids, start_date, end_date))
            results = cursor.fetchall()
            
            # Map DB results to a dictionary {pnode_id: count}
            db_counts = {row['pnode_id']: row['day_count'] for row in results}
            
            # Identify which PNodes are missing or short on data
            for pnode in all_pnode_ids:
                if db_counts.get(pnode, 0) < expected_days:
                    missing_pnodes.add(pnode)
                    
            t1 = time.time()
            print(f"  [DB Check] Evaluated {len(all_pnode_ids)} PNodes in {t1-t0:.2f}s. Found {len(missing_pnodes)} missing data.")
            return missing_pnodes
            
    except psycopg2.Error as e:
        print(f"Database error while checking for gaps: {e}")
        return set(all_pnode_ids) # Failsafe: if DB errors, assume all are missing so we fetch them
    finally:
        if conn:
            conn.close()

def upsert_data_to_db(items):
    """Upsert retrieved LMP data into the database."""
    if not items:
        return
    
    # Deduplication logic
    unique_items_dict = {(item.get('pnode_id'), item.get('datetime_beginning_ept')): item for item in items}
    clean_items = list(unique_items_dict.values())
    
    conn = None
    t0 = time.time()
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cursor:
            upsert_query = f"""
                INSERT INTO {TARGET_TABLE} (
                    datetime_beginning_ept, pnode_id, pnode_name, type,
                    system_energy_price_da, total_lmp_da, congestion_price_da,
                    marginal_loss_price_da
                ) VALUES %s
                ON CONFLICT (pnode_id, datetime_beginning_ept)
                DO UPDATE SET
                    pnode_name = EXCLUDED.pnode_name,
                    type = EXCLUDED.type,
                    system_energy_price_da = EXCLUDED.system_energy_price_da,
                    total_lmp_da = EXCLUDED.total_lmp_da,
                    congestion_price_da = EXCLUDED.congestion_price_da,
                    marginal_loss_price_da = EXCLUDED.marginal_loss_price_da
            """
            batch_size = 1000
            for i in range(0, len(clean_items), batch_size):
                batch = clean_items[i:i + batch_size]
                values = [
                    (
                        item.get('datetime_beginning_ept'), item.get('pnode_id'),
                        item.get('pnode_name'), item.get('type'),
                        item.get('system_energy_price_da'), item.get('total_lmp_da'),
                        item.get('congestion_price_da'), item.get('marginal_loss_price_da')
                    ) for item in batch
                ]
                execute_values(cursor, upsert_query, values)
            conn.commit()
            t1 = time.time()
            print(f"  [DB Upsert] Successfully saved {len(clean_items)} records in {t1-t0:.2f}s.")
    except psycopg2.Error as e:
        print(f"Database error while upserting data: {e}")
    finally:
        if conn:
            conn.close()

def is_archived_date(test_date_str):
    test_date = datetime.strptime(test_date_str, "%Y-%m-%d")
    cutoff_date = datetime.now() - timedelta(days=ARCHIVE_CUTOFF_DAYS)
    return test_date < cutoff_date

def attempt_request(method, endpoint, headers, params=None, attempt_desc="", max_retries=3):
    """Helper function that manages the smart throttle and handles retries."""
    global last_api_call_time
    retries = 0
    
    while retries < max_retries:
        # --- 🛑 SMART THROTTLE LOGIC ---
        current_time = time.time()
        elapsed = current_time - last_api_call_time
        
        if elapsed < MIN_API_INTERVAL:
            sleep_time = MIN_API_INTERVAL - elapsed
            print(f"  [Throttle] Pacing API call. Pausing for {sleep_time:.2f}s...")
            time.sleep(sleep_time)
        # -------------------------------
        
        try:
            response = requests.get(endpoint, headers=headers, params=params, timeout=30)
            
            # ⏱️ Update the timestamp IMMEDIATELY after the request is made
            last_api_call_time = time.time()
            
            if response.status_code == 429:
                retries += 1
                wait_time = 10 * (2 ** retries)
                print(f"  [API] Rate limit hit (429). Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
                
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            print(f"  [API] Request failed: {e}")
            break
            
    return None

def fetch_pjm_data(start_date, end_date, pnode_id=None, valid_pnodes_set=None):
    """Fetch PJM data, handling archived data restrictions and pagination."""
    date_range_str = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
    is_archived = is_archived_date(start_date.strftime('%Y-%m-%d'))
    
    headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}
    all_items = []
    start_row = 1
    row_count = 50000
    page = 1
    
    t0 = time.time()
    while True:
        if is_archived:
            params = {"rowCount": row_count, "startRow": start_row, "datetime_beginning_ept": date_range_str}
            print(f"  [Pagination] Fetching Page {page} (Rows {start_row} to {start_row + row_count - 1}) for entire grid...")
        else:
            params = {"rowCount": row_count, "order": "Asc", "startRow": start_row, "datetime_beginning_ept": date_range_str, "pnode_id": pnode_id}
        
        response = attempt_request("GET", PJM_API_ENDPOINT, headers.copy(), params, f"Row {start_row}")
        if not response:
            break
        
        items = response.json().get('items', [])
        
        # Filter archived bulk data in-memory to only keep the PNodes we actually need
        if is_archived and valid_pnodes_set:
            filtered_items = [item for item in items if item.get('pnode_id') in valid_pnodes_set]
            all_items.extend(filtered_items)
            print(f"    -> Kept {len(filtered_items)} relevant records from this page.")
        else:
            all_items.extend(items)
        
        links = response.json().get('links', [])
        if not any(link.get('rel') == 'next' for link in links) or len(items) < row_count:
            break
            
        start_row += len(items)
        page += 1
        
    t1 = time.time()
    print(f"  [API Fetch] Completed. Retrieved {len(all_items)} total target records in {t1-t0:.2f}s.")
    return all_items

def update_pjm_da_lmps():
    """Main function to orchestrate the update process."""
    if not PJM_API_KEY:
        print("Error: PJM_API_KEY environment variable is missing.")
        return
        
    PNODE_IDS_CACHED = get_pnode_ids_from_db()
    if not PNODE_IDS_CACHED:
        print("Warning: No PNode IDs retrieved from database. Exiting.")
        return
        
    full_start_date = date(2020, 1, 1)
    full_end_date = date(2022, 4, 6)
    
    current_start = full_start_date
    while current_start <= full_end_date:
        is_archived = is_archived_date(current_start.strftime('%Y-%m-%d'))
        block_size = ARCHIVED_TIME_BLOCK_SIZE if is_archived else RECENT_TIME_BLOCK_SIZE
        current_end = min(current_start + timedelta(days=block_size - 1), full_end_date)
        
        print(f"\n--- Processing Period: {current_start} to {current_end} ---")
        
        # 1. BULK GAP CHECK
        missing_pnodes = get_missing_pnodes(PNODE_IDS_CACHED, current_start, current_end)
        
        # 2. SKIP IF FULL
        if not missing_pnodes:
            print(f"  ✅ All data populated. Skipping to next period.")
            current_start = current_end + timedelta(days=1)
            continue
            
        # 3. TARGETED FETCH
        if is_archived:
            print(f"  ⚠️ Fetching bulk archived data (filtering to {len(missing_pnodes)} missing PNodes)...")
            items = fetch_pjm_data(current_start, current_end, valid_pnodes_set=missing_pnodes)
            upsert_data_to_db(items)
        else:
            print(f"  ⚠️ Fetching recent data specifically for {len(missing_pnodes)} missing PNodes...")
            for i, pnode_id in enumerate(missing_pnodes):
                print(f"  -> Fetching PNode {pnode_id} ({i+1}/{len(missing_pnodes)})...")
                items = fetch_pjm_data(current_start, current_end, pnode_id=pnode_id)
                upsert_data_to_db(items)
                # No sleep needed here; the attempt_request throttle handles PNode pacing automatically
                
        current_start = current_end + timedelta(days=1)

if __name__ == '__main__':
    update_pjm_da_lmps()
