# update_wholesale_prices.py
import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load credentials
load_dotenv()
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

def run_upsert():
    create_table_sql = text("""
        CREATE TABLE IF NOT EXISTS wholesale_month_price (
            service_territory VARCHAR(255),
            year INTEGER,
            month INTEGER,
            ws_price NUMERIC,
            PRIMARY KEY (service_territory, year, month)
        );
    """)

    # Service territory names are normalized to UPPER CASE so they match
    # UPPER(retail_monthly_rates_pjm.utility) in the API join.
    upsert_prices_sql = text("""
    INSERT INTO wholesale_month_price (service_territory, year, month, ws_price)
    WITH hourly_territory_avg AS (
        -- Step 1: Average LMP per territory per hour (UPPER-case names for consistency)
        SELECT
            UPPER(r.service_territory) AS service_territory,
            p.datetime_beginning_ept,
            AVG(p.total_lmp_da) AS hourly_avg_price
        FROM pjm_da_hrl_lmps p
        JOIN (SELECT DISTINCT pnode_id, service_territory FROM retail_lmps) r
            ON p.pnode_id = r.pnode_id
        GROUP BY
            UPPER(r.service_territory),
            p.datetime_beginning_ept
    )
    -- Step 2: Roll hourly averages into monthly averages
    SELECT
        service_territory,
        EXTRACT(YEAR FROM datetime_beginning_ept)::INTEGER AS year,
        EXTRACT(MONTH FROM datetime_beginning_ept)::INTEGER AS month,
        AVG(hourly_avg_price) AS ws_price
    FROM hourly_territory_avg
    GROUP BY
        service_territory,
        EXTRACT(YEAR FROM datetime_beginning_ept),
        EXTRACT(MONTH FROM datetime_beginning_ept)
    ON CONFLICT (service_territory, year, month)
    DO UPDATE SET
        ws_price = EXCLUDED.ws_price;
    """)

    try:
        with engine.begin() as conn:
            logging.info("Checking/Creating wholesale_month_price table...")
            conn.execute(create_table_sql)

            logging.info("Calculating averages and upserting data...")
            result = conn.execute(upsert_prices_sql)

            logging.info(f"Successfully updated wholesale prices. Rows affected: {result.rowcount}")

    except Exception as e:
        logging.error(f"An error occurred during the upsert: {e}")

if __name__ == "__main__":
    run_upsert()
