import pandas as pd
import matplotlib.pyplot as plt
import os

# Function to load all Excel files from the current directory
def load_excel_files():
    current_directory = os.path.dirname(__file__)  # Get the directory of the script
    all_data = []
    
    for filename in os.listdir(current_directory):
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            file_path = os.path.join(current_directory, filename)
            print(f"Loading data from {file_path}")
            df = pd.read_excel(file_path)
            all_data.append(df)
    
    return pd.concat(all_data, ignore_index=True)

# Function to plot the data
def plot_data(df):
    # Check for missing values in 'Year' and 'Month' columns
    if df['Year'].isnull().any() or df['Month'].isnull().any():
        print("Warning: Missing values found in 'Year' or 'Month' columns.")
        # Option 1: Fill missing values with a default value (e.g., 0)
        df['Year'] = df['Year'].fillna(0).astype(int)
        df['Month'] = df['Month'].fillna(1).astype(int)  # Filling Month with 1 (January)
        
        # Option 2: Alternatively, you could drop rows with missing values
        # df = df.dropna(subset=['Year', 'Month'])

    else:
        # Convert 'Year' and 'Month' to integers
        df['Year'] = df['Year'].astype(int)
        df['Month'] = df['Month'].astype(int)

    # Create a date column for plotting
    df['date'] = pd.to_datetime(df[['Year', 'Month']].assign(day=1))

    # Plotting
    plt.figure(figsize=(14, 7))
    plt.plot(df['date'], df['Total'], marker='o', linestyle='-', color='b', label='Total Rate')
    plt.title('Total Rate Over Time')
    plt.xlabel('Date (Year-Month)')
    plt.ylabel('Total Rate')
    plt.xticks(rotation=45)
    plt.grid()
    plt.legend()
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    # Load the data
    data = load_excel_files()
    
    # Debugging: Print the first few rows of the DataFrame
    print(data.head())
    
    # Plot the data
    plot_data(data)
