import pandas as pd

# 1. Load your CSV file
df = pd.read_csv('retail/load_frcstd_hist.csv')

# 2. Sort the data so the newest 'evaluated_at' is at the top of each group
df = df.sort_values(
    by=['forecast_area', 'forecast_hour_beginning_ept', 'evaluated_at_utc'], 
    ascending=[True, True, False] # False makes the evaluation time Newest to Oldest
)

# 3. Drop duplicates, keeping the first row (the newest one) for each hour/area combo
df_final = df.drop_duplicates(
    subset=['forecast_area', 'forecast_hour_beginning_ept'], 
    keep='first'
)

# 4. Save the cleaned data back to a new CSV file
df_final.to_csv('retail/cleaned_final_forecasts.csv', index=False)
