import requests
from dotenv import load_dotenv
import os

load_dotenv()

async def reverse_geocode(lat, lng):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        'latlng': f"{lat},{lng}",
        'key': os.getenv("GOOGLE_MAPS_API_KEY")
    }
    headers = {
        "User-Agent": "my_mapp_client/1.0"
    }
    response = requests.get(url, params=params, headers=headers).json()
    return response['results'][0]['formatted_address'] if response['results'] else None

if __name__ == "__main__":
    import asyncio
    address = asyncio.run(reverse_geocode(5.6037, -0.1870))
    print(address)