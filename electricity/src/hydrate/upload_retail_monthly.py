#  This script imports retail service company monthly rates into the retail_monthly_rates_pjm table of the electricity_db

import os
import sys
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine
from dotenv import load_dotenv

def main():
    # Load environment variables from .env file
    load_dotenv()

    # Define the directory containing the Excel files
    data_dir = Path(__file__).parent / 'retail/PJM_data'

    # Database configuration
    db_config = {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD"),
        "database": os.getenv("DB_NAME", "pjm_data"),
        "port": os.getenv("DB_PORT", "5433") 
    }

    # Create a connection string
    connection_string = f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
    
    try:
        # Create a database engine
        engine = create_engine(connection_string)

        # Always use the 'retail_pjm' table for data insertion
        table_name = 'retail_monthly_rates_pjm'
        print(f"Using table: {table_name}")

        # Iterate over all Excel files in the specified directory
        for excel_file in data_dir.glob("*_Utility_Monthly_Price_*.xlsx"):
            # Skip the PJM_utility_list file
            if "PJM_utility_list" in excel_file.name:
                print(f"Skipping file: {excel_file.name}")
                continue

            print(f"📂 Processing file: {excel_file.name}")

            # Read the Excel file, using the first row as headers
            df = pd.read_excel(excel_file)
            print(df.head())  # Print the first few rows for debugging
            print(f"Original columns: {df.columns}")

            # Ensure the DataFrame columns match the table structure
            df.rename(columns={
                'Utility': 'utility',
                'Utility_ID_EIA': 'utility_id_eia',
                'Year': 'year',
                'Month': 'month',
                'Total': 'total',
                'Generation': 'generation',
                'Transmission': 'transmission',
                'Distribution': 'distribution',
                'Other': 'other'
            }, inplace=True)

            print(f"Renamed columns: {df.columns}")
            print(f"Number of rows to insert: {len(df)}")

            if df.empty:
                print(f"No data found in {excel_file.name}. Skipping this file.")
                continue

            # Upsert data into the 'retail_pjm' table
            df.to_sql(table_name, con=engine, if_exists='append', index=False)

    except Exception as e:
        print(f"❌ Initialization Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
