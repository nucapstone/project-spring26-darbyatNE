import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load your .env file
load_dotenv()

# Get the database URL
DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

print(f"Attempting to connect to: {DATABASE_URL}")

try:
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("\n✅ SUCCESS: Database connection established!\n")
        
        # List of tables to inspect
        tables_to_check = [
            "pjm_da_hrl_lmps", 
            "pjm_rt_hrl_lmps", 
            "pjm_lat_long"
        ]

        for table in tables_to_check:
            try:
                # Get column names efficiently
                result = conn.execute(text(f"SELECT * FROM {table} LIMIT 0"))
                columns = list(result.keys())
                
                print(f"--- Columns in '{table}' ---")
                print(columns)
                print("")
                
            except Exception as table_error:
                print(f"⚠️  Could not read table '{table}': {table_error}\n")

        print("---------------------------------------------------")
        print("Copy the list above and paste it in the chat.")
        print("---------------------------------------------------\n")

except Exception as e:
    print("\n❌ ERROR: Connection failed.")
    print(e)