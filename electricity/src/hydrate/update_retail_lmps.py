"""
Script: Update PJM Day-Ahead LMPs from PJM API
Description:
    A script to fetch PJM Day-Ahead Hourly LMP data for PNodes listed in the retail_lmps table,
    optimizing for archived and recent data with smaller time blocks for archived data.
    Includes gap-checking to skip unnecessary API calls.
Usage:
    python update_pjm_da_lmps.py
    Ensure environment variables (PJM_API_KEY and database credentials) are set via .env or otherwise.
"""

import os
import requests
from dotenv import load_dotenv
from pathlib import Path
import json
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
    "connect_timeout": 10  # Timeout in seconds for connection attempt
}

# Archive cutoff (days) 
ARCHIVE_CUTOFF_DAYS = 731

# Configurable time block sizes (in days)
ARCHIVED_TIME_BLOCK_SIZE = 2   # Very small blocks for archived data to manage rate limits
RECENT_TIME_BLOCK_SIZE = 183   # Full non archived time period block

# Target table for upserting data
TARGET_TABLE = "pjm_da_hrl_lmps"

def get_pnode_ids_from_db():
    """Retrieve distinct PNode IDs from the retail_lmps table in the database using psycopg2 with DictCursor."""
    conn = None
    pnode_ids = []
    try:
        print(f"Connecting to database at {DB_CONFIG['host']} to fetch PNode IDs...")
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            query = "SELECT DISTINCT pnode_id FROM retail_lmps WHERE pnode_id IS NOT NULL"
            cursor.execute(query)
            results = cursor.fetchall()
            pnode_ids = [row['pnode_id'] for row in results if row['pnode_id'] is not None]
            print(f"Retrieved {len(pnode_ids)} unique PNode IDs from retail_lmps table.")
    except psycopg2.Error as e:
        print(f"Database error while fetching PNode IDs: {e}")
    finally:
        if conn:
            conn.close()
    return pnode_ids

def has_data_gaps(pnode_ids, start_date, end_date):
    """
    Check if the database already has at least one entry for every day 
    in the date range for the specified PNode(s).
    Accepts a single pnode_id or a list of pnode_ids.
    """
    # Normalize to a list so we can handle both single PNodes and multiple
    if not isinstance(pnode_ids, list):
        pnode_ids = [pnode_ids]
        
    if not pnode_ids:
        return False  # Nothing to check
        
    # Calculate how many days we expect in this range (inclusive)
    expected_days = (end_date - start_date).days + 1
    
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cursor:
            # Safely cast datetime to DATE and group by pnode_id
            query = f"""
                SELECT pnode_id, COUNT(DISTINCT CAST(datetime_beginning_ept AS DATE))
                FROM {TARGET_TABLE}
                WHERE pnode_id = ANY(%s)
                  AND CAST(datetime_beginning_ept AS DATE) >= %s
                  AND CAST(datetime_beginning_ept AS DATE) <= %s
                GROUP BY pnode_id
            """
            cursor.execute(query, (pnode_ids, start_date, end_date))
            results = cursor.fetchall()
            
            # 1. If the query returned fewer rows than our list of PNodes, 
            # it means at least one PNode has ZERO records in this range -> GAP!
            if len(results) < len(pnode_ids):
                return True
                
            # 2. Check if any PNode has fewer distinct days than expected -> GAP!
            for row in results:
                actual_days = row[1]
                if actual_days < expected_days:
                    return True
                    
            # If we pass both checks, the data is fully populated!
            return False
            
    except psycopg2.Error as e:
        print(f"Database error while checking for gaps: {e}")
        return True  # If the check fails, default to True so we fetch the data safely
    finally:
        if conn:
            conn.close()

def upsert_data_to_db(items):
    """Upsert retrieved LMP data into the pjm_da_hrl_lmps table in batches."""
    if not items:
        print("No data to upsert.")
        return
    
    # --- 🧹 DEDUPLICATION LOGIC ---
    unique_items_dict = {}
    for item in items:
        key = (item.get('pnode_id'), item.get('datetime_beginning_ept'))
        unique_items_dict[key] = item
        
    clean_items = list(unique_items_dict.values())
    
    duplicates_removed = len(items) - len(clean_items)
    if duplicates_removed > 0:
        print(f"Cleaned up {duplicates_removed} duplicate records (e.g., Daylight Saving Time overlaps).")
        
    items = clean_items
    # ------------------------------
    
    conn = None
    try:
        print(f"Connecting to database at {DB_CONFIG['host']} to upsert {len(items)} records...")
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
            upsert_count = 0
            for i in range(0, len(items), batch_size):
                batch = items[i:i + batch_size]
                values = [
                    (
                        item.get('datetime_beginning_ept'),
                        item.get('pnode_id'),
                        item.get('pnode_name'),
                        item.get('type'),
                        item.get('system_energy_price_da'),
                        item.get('total_lmp_da'),
                        item.get('congestion_price_da'),
                        item.get('marginal_loss_price_da')
                    )
                    for item in batch
                ]
                execute_values(cursor, upsert_query, values)
                upsert_count += len(batch)
                print(f"Upserted batch of {len(batch)} records ({upsert_count}/{len(items)} total).")
            conn.commit()
            print(f"Successfully upserted {upsert_count} records to {TARGET_TABLE}.")
    except psycopg2.Error as e:
        print(f"Database error while upserting data: {e}")
    except Exception as e:
        print(f"Unexpected error during upsert: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

def is_archived_date(test_date_str):
    """Check if the test date is older than the archive cutoff (731 days from today)."""
    test_date = datetime.strptime(test_date_str, "%Y-%m-%d")
    cutoff_date = datetime.now() - timedelta(days=ARCHIVE_CUTOFF_DAYS)
    return test_date < cutoff_date

def attempt_request(method, endpoint, headers, params=None, attempt_desc="", max_retries=3):
    """Helper function to attempt an API request with detailed logging, error handling, and retries."""
    retries = 0
    while retries < max_retries:
        print(f"Trying {attempt_desc} (Attempt {retries + 1}/{max_retries})...")
        try:
            if method.upper() == "GET":
                response = requests.get(endpoint, headers=headers, params=params, timeout=30)
                print(f"Generated URL: {response.url}")
            print(f"Response Status Code: {response.status_code}")
            if response.status_code == 429:  # Too Many Requests
                retries += 1
                wait_time = 10 * (2 ** retries)
                print(f"Rate limit hit (429). Retrying after {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed for {attempt_desc}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response text (if any): {e.response.text}")
                if e.response.status_code == 429:
                    retries += 1
                    wait_time = 10 * (2 ** retries)
                    print(f"Rate limit hit (429). Retrying after {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
            break
    print(f"Failed after {max_retries} retries for {attempt_desc}.")
    return None

def fetch_pjm_data(start_date, end_date, pnode_id=None):
    """Fetch PJM data for a given date range and PNode, handling archived data restrictions and pagination."""
    date_range_str = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
    start_date_str = start_date.strftime('%Y-%m-%d')
    is_archived = is_archived_date(start_date_str)
    
    headers = {'Ocp-Apim-Subscription-Key': PJM_API_KEY}
    all_items = []
    start_row = 1
    row_count = 50000  # Maximum rows per request
    
    while True:
        if is_archived:
            params = {
                "rowCount": row_count,
                "startRow": start_row,
                "datetime_beginning_ept": date_range_str
            }
            attempt_desc = f"GET for archived date range {date_range_str} without order or pnode_id (startRow={start_row})"
        else:
            params = {
                "rowCount": row_count,
                "order": "Asc",
                "startRow": start_row,
                "datetime_beginning_ept": date_range_str,
                "pnode_id": pnode_id
            }
            attempt_desc = f"GET for recent date range {date_range_str} with PNode {pnode_id} (startRow={start_row})"
        
        response = attempt_request(
            method="GET",
            endpoint=PJM_API_ENDPOINT,
            headers=headers.copy(),
            params=params,
            attempt_desc=attempt_desc
        )
        
        if not response:
            print(f"Failed to fetch data for {date_range_str}. Stopping.")
            break
        
        response_data = response.json()
        items = response_data.get('items', [])
        print(f"Retrieved {len(items)} records for {date_range_str} at startRow={start_row}.")
        
        if is_archived:
            filtered_items = [item for item in items if item.get('pnode_id') in PNODE_IDS_CACHED]
            all_items.extend(filtered_items)
            print(f"Filtered to {len(filtered_items)} records for relevant PNodes.")
        else:
            all_items.extend(items)
        
        links = response_data.get('links', [])
        has_next = any(link.get('rel') == 'next' for link in links)
        if not has_next or len(items) < row_count:
            print(f"No more data to fetch for {date_range_str}.")
            break
        
        start_row += len(items)
        print(f"More data available. Fetching next batch starting at row {start_row}...")
        time.sleep(10)
    
    return all_items

def update_pjm_da_lmps():
    """Main function to update PJM Day-Ahead LMPs for the date range with optimized time blocks."""
    global PNODE_IDS_CACHED
    if not PJM_API_KEY:
        print("Error: PJM_API_KEY environment variable is missing.")
        return
    
    if not all([DB_CONFIG["host"], DB_CONFIG["user"], DB_CONFIG["password"], DB_CONFIG["database"]]):
        print("Error: Database configuration environment variables are missing.")
        return
    
    PNODE_IDS_CACHED = get_pnode_ids_from_db()
    if not PNODE_IDS_CACHED:
        print("Warning: No PNode IDs retrieved from database. Using an empty list.")
        PNODE_IDS_CACHED = []
    
    full_start_date = date(2024, 3, 14)
    full_end_date = date(2026, 3, 14)
    
    current_start = full_start_date
    while current_start <= full_end_date:
        block_size = ARCHIVED_TIME_BLOCK_SIZE if is_archived_date(current_start.strftime('%Y-%m-%d')) else RECENT_TIME_BLOCK_SIZE
        current_end = min(current_start + timedelta(days=block_size - 1), full_end_date)
        print(f"\nFetching data for range {current_start} to {current_end} with block size {block_size} days...")
        
        if is_archived_date(current_start.strftime('%Y-%m-%d')):
            print(f"Processing archived data range {current_start} to {current_end}...")
            
            # --- 🔍 GAP CHECK FOR ARCHIVED DATA ---
            # We check ALL cached PNodes at once. If none have gaps, we skip the massive API call!
            if not has_data_gaps(PNODE_IDS_CACHED, current_start, current_end):
                print(f"  ✅ Data is fully populated for all {len(PNODE_IDS_CACHED)} PNodes. Skipping archived API call.")
                current_start = current_end + timedelta(days=1)
                continue
            # --------------------------------------
            
            print(f"  ⚠️ Gaps found in archived range. Fetching from API...")
            items = fetch_pjm_data(current_start, current_end)
            print(f"Total filtered records for archived range {current_start} to {current_end}: {len(items)}")
            upsert_data_to_db(items)
            
        else:
            print(f"Processing recent data range {current_start} to {current_end} for {len(PNODE_IDS_CACHED)} PNodes...")
            for i, pnode_id in enumerate(PNODE_IDS_CACHED):
                print(f"[{i+1}/{len(PNODE_IDS_CACHED)}] Checking PNode {pnode_id} for {current_start} to {current_end}...")
                
                # --- 🔍 GAP CHECK FOR RECENT DATA ---
                # We check this specific PNode. If it has no gaps, we skip to the next PNode!
                if not has_data_gaps(pnode_id, current_start, current_end):
                    print(f"  ✅ Data is fully populated for PNode {pnode_id}. Skipping API call.")
                    continue
                # ------------------------------------
                
                print(f"  ⚠️ Gaps found. Fetching from API...")
                items = fetch_pjm_data(current_start, current_end, pnode_id=pnode_id)
                print(f"Total records for PNode {pnode_id}: {len(items)}")
                upsert_data_to_db(items)
                
                if i < len(PNODE_IDS_CACHED) - 1:
                    time.sleep(10)
        
        current_start = current_end + timedelta(days=1)

if __name__ == '__main__':
    update_pjm_da_lmps()
