import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def get_ercot_token():
    # 1. Credentials
    username = os.getenv("ERCOT_USERNAME")
    password = os.getenv("ERCOT_PASSWORD")
    api_key = os.getenv("ERCOT_API_KEY")

    if not all([username, password, api_key]):
        print("❌ Error: Missing credentials in .env")
        return None

    # 2. The URL (Base only)
    # Note: We removed the query parameters from the URL string to send them cleanly in the body
    base_auth_url = "https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token"

    # 3. The Payload (Form Data)
    # This matches the parameters in your example URL, but sends them as data
    payload = {
        "username": username,
        "password": password,
        "grant_type": "password",
        "scope": "openid fec253ea-0d06-4272-a5e6-b478baeecd70 offline_access",
        "client_id": "fec253ea-0d06-4272-a5e6-b478baeecd70",
        "response_type": "id_token"
    }

    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }

    print(f"🔐 Requesting Token...")
    
    try:
        # Send as POST data (standard OAuth2)
        response = requests.post(base_auth_url, data=payload, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Auth Failed: {response.status_code}")
            print(response.text)
            return None

        data = response.json()
        
        # The example code says .get("access_token"), but sometimes it's "id_token"
        # We check both to be safe.
        token = data.get("access_token") or data.get("id_token")
        
        if token:
            print(f"✅ Token Acquired")
            return token
        else:
            print("❌ Token not found in response:", data.keys())
            return None

    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return None

def test_data(token):
    # 4. Use the token
    url = "https://api.ercot.com/api/public-reports/np3-907-ex/2d_agg_edc"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Ocp-Apim-Subscription-Key": os.getenv("ERCOT_API_KEY")
    }
    
    # Test with just 1 row
    params = {"size": 1}
    
    try:
        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        print("✅ Data Access Successful")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print(f"❌ Data Error: {e}")
        if 'r' in locals():
            print(r.text)

if __name__ == "__main__":
    token = get_ercot_token()
    if token:
        test_data(token)