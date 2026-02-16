import requests
import json

# Define the Overpass API endpoint
overpass_url = "http://overpass-api.de/api/interpreter"

# Define the Overpass query
overpass_query = """
[out:json][timeout:60];
// Define the search areas for all PJM states
area["name"="New Jersey"]["admin_level"="4"]->.newjersey;
area["name"="Ohio"]["admin_level"="4"]->.ohio;
area["name"="Pennsylvania"]["admin_level"="4"]->.pennsylvania;
area["name"="Virginia"]["admin_level"="4"]->.virginia;
area["name"="West Virginia"]["admin_level"="4"]->.westvirginia;

// Combine all areas into a single search area
(
  nwr["power"="substation"](area.newjersey);
  nwr["power"="substation"](area.ohio);
  nwr["power"="substation"](area.pennsylvania);
  nwr["power"="substation"](area.virginia);
  nwr["power"="substation"](area.westvirginia);
);

// Output the results with relevant identifying information
out body;
>;
out skel qt;
"""

# Send the request to the Overpass API
response = requests.post(overpass_url, data={'data': overpass_query})

# Check if the request was successful
if response.status_code == 200:
    # Load the response JSON
    data = response.json()
    
    # Save the results to a GeoJSON file
    with open('pjm_substations_2.geojson', 'w') as f:
        json.dump(data, f, indent=2)
    
    print("Results saved to pjm_substations_2.geojson")
else:
    print(f"Error: {response.status_code} - {response.text}")
