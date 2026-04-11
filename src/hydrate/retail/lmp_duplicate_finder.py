import pandas as pd

# Load the data from an Excel file
input_file = 'lmps_69kv_locations.xlsx'  # Change this to your actual file path
output_file = 'retail_lmps.xlsx'  # Output file path

# Read the Excel file into a DataFrame
df = pd.read_excel(input_file)

# Display the first few rows of the DataFrame (optional)
print("Original Data:")
print(df.head())

# Filter out "GEN" LMPs based on the 'type' column
filtered_df = df[df['type'] != 'GEN']

# Drop duplicates based on 'pnode_name', keeping the first occurrence
unique_df = filtered_df.drop_duplicates(subset=['pnode_name'])

# Display the result (optional)
print("\nUnique Data:")
print(unique_df.head())

# Save the unique DataFrame to a new Excel file
unique_df.to_excel(output_file, index=False)

print(f"\nUnique LMP data saved to {output_file}")
