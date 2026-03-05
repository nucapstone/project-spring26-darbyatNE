import pandas as pd
import geopandas as gpd
import requests
import sys

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================

# 1. API Configuration
API_URL = "http://localhost:8000/api/service-terr" 

# 2. Input Excel File (LMP Locations)
LMP_FILE = 'cleaned_retail_lmps.xlsx'

# 3. Column Mapping (Must match your Excel headers)
LAT_COL = 'Latitude'
LONG_COL = 'Longitude'
LMP_ID_COL = 'Location'

# 4. Output Filename (Changed to .xlsx)
OUTPUT_FILE = 'lmp_territory_assignments2.xlsx'

# ==========================================
# 🚀 PROCESSING SCRIPT
# ==========================================

def get_territories_from_api():
    """Fetches GeoJSON features from the running backend API."""
    print(f"📡 Connecting to API: {API_URL}...")
    try:
        response = requests.get(API_URL)
        response.raise_for_status() # Raise error for 404, 500, etc.
        
        data = response.json()
        
        # Check if features exist
        if "features" not in data or not data["features"]:
            print("⚠️  API returned no features. Check your CSV/Database on the backend.")
            sys.exit(1)
            
        print(f"✅ API Success. Received {len(data['features'])} territory polygons.")
        return data
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to the API. Is the server running?")
        sys.exit(1)
    except Exception as e:
        print(f"❌ API Error: {e}")
        sys.exit(1)

def main():
    # --- STEP 1: LOAD LMP DATA ---
    print(f"📂 Loading LMP Excel: {LMP_FILE}...")
    try:
        df_lmp = pd.read_excel(LMP_FILE)
        
        # 🔍 DIAGNOSTIC PRINT (Add this!)
        print("\n" + "="*40)
        print("🧐 DEBUG: ACTUAL COLUMNS FOUND IN EXCEL:")
        print(df_lmp.columns.tolist())
        print("="*40 + "\n")

        # Optional: Auto-clean whitespace (fixes "Longitude " vs "Longitude")
        df_lmp.columns = df_lmp.columns.str.strip()

    except FileNotFoundError:
        print(f"❌ Error: File {LMP_FILE} not found.")
        return

    # Check if columns exist BEFORE crashing
    if LAT_COL not in df_lmp.columns or LONG_COL not in df_lmp.columns:
        print(f"❌ CRITICAL ERROR: Column mismatch.")
        print(f"   Script expects: '{LAT_COL}' and '{LONG_COL}'")
        print(f"   Excel contains: {df_lmp.columns.tolist()}")
        print("   -> Please update LAT_COL and LONG_COL in the script config.")
        return

    # Create Geometry for LMPs (Points)
    # Note: gpd.points_from_xy handles the zip(x,y) logic automatically
    gdf_lmp = gpd.GeoDataFrame(
        df_lmp, 
        geometry=gpd.points_from_xy(df_lmp[LONG_COL], df_lmp[LAT_COL]),
        crs="EPSG:4326" # Standard Lat/Long
    )

    # --- STEP 2: FETCH TERRITORIES FROM API ---
    geojson_data = get_territories_from_api()
    
    # Convert API JSON to GeoDataFrame
    # The API returns a FeatureCollection, which GeoPandas handles natively
    gdf_terr = gpd.GeoDataFrame.from_features(geojson_data["features"])
    
    # Ensure CRS is set (GeoJSON is usually 4326, but we force it to be safe)
    if gdf_terr.crs is None:
        gdf_terr.set_crs("EPSG:4326", inplace=True)
    else:
        gdf_terr = gdf_terr.to_crs("EPSG:4326")

    # --- STEP 3: SPATIAL JOIN ---
    print("🔗 Performing Spatial Join (Point-in-Polygon)...")
    
    # 'left' join keeps ALL LMPs. If they don't match a territory, fields are NaN.
    # predicate='within' checks if the Point is inside the Polygon.
    joined = gpd.sjoin(gdf_lmp, gdf_terr, how="left", predicate="within")

    # --- STEP 4: CLEANUP & EXPORT ---
    
    # The API returns properties 'name' and 'id'. 
    # Let's rename 'name' to 'Service_Territory' for clarity in the output.
    if 'name' in joined.columns:
        joined.rename(columns={'name': 'Service_Territory'}, inplace=True)
    else:
        joined['Service_Territory'] = "UNKNOWN"

    # Fill NaNs for points that fell outside all polygons
    joined['Service_Territory'] = joined['Service_Territory'].fillna('OUT_OF_TERRITORY')

    # Select clean columns (drop geometry and join artifacts)
    # We keep the original columns plus the new Territory column
    cols_to_keep = list(df_lmp.columns) + ['Service_Territory']
    final_df = pd.DataFrame(joined)[cols_to_keep]

    print(f"💾 Saving results to {OUTPUT_FILE}...")
    
    # Write to Excel
    final_df.to_excel(OUTPUT_FILE, index=False, sheet_name='Mapped_LMPs')

    # --- SUMMARY ---
    matched = final_df[final_df['Service_Territory'] != 'OUT_OF_TERRITORY']
    print("\n" + "="*30)
    print("📊 MAPPING SUMMARY")
    print("="*30)
    print(f"Total LMPs Processed:   {len(final_df)}")
    print(f"Successfully Mapped:    {len(matched)}")
    print(f"Unmapped / Outside:     {len(final_df) - len(matched)}")
    print("="*30)
    
    # Optional: Show a preview of mapped items
    if not matched.empty:
        print("\nSample Matches:")
        print(matched[[LMP_ID_COL, 'Service_Territory']].head(5))

if __name__ == "__main__":
    main()
