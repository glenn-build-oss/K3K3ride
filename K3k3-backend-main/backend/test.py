# float1  = 0.0; float2 = float1
# float2 += 0
# list1 = [0]; list2 = list1
# list2 += [1]
# str1 = "0"; str2 = str1
# str2 += '1'
# tup = (0, ); tup2 = tup
# tup2 += (1, )
# set1 = {0}; set2 = set1
# set1 |= {1}


# print(str1)     # 0    
# print(float1)   # 0.0
# print(list1)    # [0, 1]
# print(tup)      # (0,)
# print(set1)     # {0, 1}

import requests
from dotenv import load_dotenv
import os
import json

load_dotenv()

location = "Great Hall, Kwame Nkrumah University of Science and Technology, Kumasi, Ghana"
url = "https://maps.googleapis.com/maps/api/geocode/json"

params = {
    'address': location,
    'key': os.getenv("GOOGLE_MAPS_API_KEY")
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

response = requests.get(url, params=params, headers=headers).json()

lat = response['results'][0]['geometry']['location']['lat']
lng = response['results'][0]['geometry']['location']['lng']

print(lat, lng)
# print(response)

# with open("response.json", "w") as f:
#     json.dump(response.json(), f, indent=4)


