import json
import pandas as pd
from sqlalchemy import create_engine
from shapely import wkt

# Load the GeoJSON data
geojson_file_path = 'nj.geojson'
with open(geojson_file_path, 'r') as geojson_file:
    geojson_data = json.load(geojson_file)

# Load the Excel data from the "NJ" worksheet
xl_file_path = 'nj_lmps.xlsx'  # Change this to your actual file path  
lmp_data = pd.read_excel(xl_file_path, sheet_name='NJ')  # Specify the sheet name

# Create a list to hold matched results
matched_results = []

# Extract substations and their coordinates from GeoJSON
substations = []
for feature in geojson_data['features']:
    substation_name = feature['properties'].get('name', 'Unknown')  # Safely get the name
    substation_coords = feature['geometry']['coordinates'][0]  # Get the coordinates directly
    substations.append({
        'name': substation_name,
        'coords': substation_coords
    })

# Iterate over substations and attempt to find corresponding LMP points
for substation in substations:
    substation_name = substation['name']
    substation_coords = substation['coords']

    # Look for LMP points that might match based on name similarities
    for index, row in lmp_data.iterrows():
        lmp_name = row['pnode_name']
        
        # Check for name similarity (you can adjust this logic as needed)
        if substation_name.lower() in lmp_name.lower() or lmp_name.lower() in substation_name.lower():
            matched_results.append({
                'substation_name': substation_name,
                'substation_coords': substation_coords,
                'pnode_id': row['pnode_id'],
                'pnode_name': lmp_name,
                'voltage': row['voltage']
            })

# Connect to the database
db_connection_string = 'postgresql://username:password@localhost/electricity_db'  # Update with your credentials
engine = create_engine(db_connection_string)

# Load service territories from the database
service_territories_query = "SELECT id, service_provider, ST_AsText(wkb_geometry) AS geom FROM service_territories"
service_territories = pd.read_sql(service_territories_query, engine)

# Convert geometries to Shapely objects for spatial operations
service_territories['geom'] = service_territories['geom'].apply(wkt.loads)

# Identify the service territory for each matched LMP
for match in matched_results:
    lmp_coords = match['substation_coords']
    point = wkt.loads(f'POINT({lmp_coords[0]} {lmp_coords[1]})')  # Create a point from LMP coordinates

    # Check which service territory contains the point
    for _, territory in service_territories.iterrows():
        if territory['geom'].contains(point):
            match['service_provider'] = territory['service_provider']
            break
    else:
        match['service_provider'] = 'Unknown'  # If no territory matches

# Convert matched results to a DataFrame
matched_df = pd.DataFrame(matched_results)

# Save the results to an Excel file
output_file_path = 'matched_lmps_with_service_providers.xlsx'
matched_df.to_excel(output_file_path, index=False)

print(f"Results saved to {output_file_path}")
