import json
import os

# Define the path to the GeoJSON file
geojson_file = 'export.geojson'

# Load the GeoJSON data from the file
with open(geojson_file, 'r') as file:
    json_data = json.load(file)

# Initialize a list to hold substation names
substation_names = []

# Iterate through each feature in the JSON data
for feature in json_data['features']:
    properties = feature['properties']
    # Check if the operator is BGE and if a name exists
    if 'operator' in properties and 'name' in properties:
        if "Baltimore Gas" in properties['operator']:
            substation_names.append(properties['name'])

# Print the list of substation names
print("BGE Substation Names:")
for name in substation_names:
    print(name)
