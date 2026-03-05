import pandas as pd

# Path to the input Excel file
input_excel_file_path = 'retail_lmps.xlsx'  # Adjust the path if necessary

# Read the Excel file into a DataFrame
df = pd.read_excel(input_excel_file_path)

# Group by 'transmission_zone' and 'pnode_name' and keep the first occurrence
cleaned_df = df.groupby(['transmission_zone', 'pnode_name'], as_index=False).first()

# Path to the output Excel file
output_excel_file_path = 'cleaned_retail_lmps.xlsx'  # Name for the new Excel file

# Save the cleaned DataFrame to a new Excel file
cleaned_df.to_excel(output_excel_file_path, index=False)

print(f"Cleaned data has been saved to {output_excel_file_path}")
