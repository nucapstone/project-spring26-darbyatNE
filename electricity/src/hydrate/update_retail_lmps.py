# src/hydrate/update_retail_lmps.py

"""
Script: PJM Day-Ahead LMP Update Orchestrator (PostgreSQL)
Description:
    This script automates the incremental updating of the PJM Day-Ahead Hourly LMP table.
    
    It is "Retail-Aware":
    1. Queries 'retail_lmps' (Postgres) to find relevant PNodes.
    2. Checks 'pjm_da_hrl_lmps' (Postgres) for the last data date.
    3. Triggers 'pjm_query_da_lmp.py' to fill gaps.

Usage:
    python src/hydrate/update_pjm_db.py
"""

import os
import sys
import subprocess
import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv
from datetime import date, timedelta, datetime

load_dotenv()

# --- Configuration ---
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
    "port": int(os.getenv("DB_PORT", 5432)), # Default Postgres Port
}

# --- Task Definitions ---
TASKS = [
    {
        "name": "Day-Ahead Hourly LMP",
        "table": "pjm_da_hrl_lmps",
        "date_col": "datetime_beginning_ept",
        "script": "retail_query_da_lmp.py"
    },
]

def get_monitored_pnodes():
    """
    Fetches the list of unique pnode_ids from the retail_lmps table.
    Returns a list of integers.
    """
    print("   ... Fetching PNode IDs from retail_lmps table ...")
    conn = None
    pnodes = []
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        # Use DictCursor to access columns by name
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            sql = "SELECT DISTINCT pnode_id FROM retail_lmps WHERE pnode_id IS NOT NULL"
            cursor.execute(sql)
            results = cursor.fetchall()
            
            pnodes = [row['pnode_id'] for row in results]
            
            print(f"   ... Found {len(pnodes)} PNodes to monitor.")
            return pnodes
            
    except psycopg2.Error as e:
        print(f"   [!] Error fetching PNodes: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_latest_db_date(table_name, date_col):
    """
    Queries the database for the maximum date present in the table.
    Returns a python date object.
    """
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor(cursor_factory=DictCursor) as cursor:
            # Postgres Syntax: Cast timestamp to date using ::date
            sql = f"SELECT MAX({date_col}::date) as max_date FROM {table_name}"
            cursor.execute(sql)
            result = cursor.fetchone()
            
            if result and result['max_date']:
                val = result['max_date']
                # Psycopg2 usually returns a datetime.date object directly, but we check to be safe
                if isinstance(val, str):
                    return datetime.strptime(val, "%Y-%m-%d").date()
                if isinstance(val, datetime):
                    return val.date()
                return val
            else:
                return None
    except psycopg2.Error as e:
        print(f"   [!] Error checking table {table_name}: {e}")
        return None
    finally:
        if conn:
            conn.close()

def run_update_script(script_relative_path, start_date, end_date, pnode_list=None):
    """
    Runs the specific python script as a subprocess with date arguments.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(current_dir, script_relative_path)
    
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Base command: python script.py START END
    cmd = [sys.executable, script_path, start_str, end_str]
    
    # Append PNodes as 3rd argument if they exist
    if pnode_list and len(pnode_list) > 0:
        pnode_arg = ",".join(map(str, pnode_list))
        cmd.append(pnode_arg)
    
    print(f"   >>> Launching {script_relative_path}...")
    print(f"   >>> Range: {start_str} to {end_str}")
    
    try:
        subprocess.run(cmd, check=True)
        print(f"   >>> {script_relative_path} finished successfully.\n")
    except subprocess.CalledProcessError as e:
        print(f"   [!!!] Error running {script_relative_path}. Exit code: {e.returncode}\n")
    except FileNotFoundError:
        print(f"   [!!!] Script file not found: {script_path}\n")

def main():
    print("==========================================")
    print("   PJM DATABASE UPDATE ORCHESTRATOR (PG)")
    print("==========================================\n")
    
    # Target Date: Yesterday
    target_date = date.today() - timedelta(days=1)
    
    # 1. Fetch PNodes
    pnode_ids = get_monitored_pnodes()
    
    if not pnode_ids:
        print("   [WARNING] No PNodes found in retail_lmps. Aborting updates.")
        return

    print(f"Target Date (Up-To): {target_date}")
    print(f"Checking {len(TASKS)} tables...\n")

    for task in TASKS:
        print(f"--- Checking: {task['name']} ({task['table']}) ---")
        
        last_date = get_latest_db_date(task['table'], task['date_col'])
        
        if last_date is None:
            print(f"   Status: Table appears empty.")
            # Default start date
            start_date = date(2025, 10, 1) 
            run_update_script(task['script'], start_date, target_date, pnode_ids)
            
        elif last_date < target_date:
            print(f"   Status: OUT OF DATE. Last data: {last_date}")
            start_date = last_date + timedelta(days=1)
            
            if start_date <= target_date:
                run_update_script(task['script'], start_date, target_date, pnode_ids)
            else:
                print("   Status: Gap is too small (less than 1 day). Skipping.")
                
        else:
            print(f"   Status: UP TO DATE ({last_date}). No action.")
        
        print("") 

    print("==========================================")
    print("   All checks completed.")
    print("==========================================")

if __name__ == "__main__":
    main()
