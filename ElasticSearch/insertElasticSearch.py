import requests

def connect_elasticsearch():
    url = "https://oriya-and-niv-2114271212.us-east-1.bonsaisearch.net:443"
    username = "5gcyxc4555"
    password = "jn152uisr8"
    auth = (username, password)

    try:
        response = requests.get(url, auth=auth)
        if response.status_code == 200:
            print("Connection to Elasticsearch successful!")
            return url, auth
        else:
            print(f"Connection failed with status code: {response.status_code}")
            return None, None

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        return None, None


def create_index(url, auth):
    index_name = "sample_index"

    try:
        create_url = f"{url}/{index_name}"
        headers = {"Content-Type": "application/json"}
        response = requests.put(create_url, headers=headers, auth=auth)

        if response.status_code == 200:
            print("Index creation successful!")
        elif response.status_code == 400:
            print("Index already exists.")
        else:
            print(f"Index creation failed with status code: {response.status_code}")

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")


def insert_data(url:str, auth,data_to_insert:dict):
    index_name = "sample_index"

    try:
        insert_url = f"{url}/{index_name}/_doc"
        headers = {"Content-Type": "application/json"}
        response = requests.post(insert_url, json=data_to_insert, headers=headers, auth=auth)

        if response.status_code == 201:
            print("Data inserted successfully!")
        else:
            print(f"Data insertion failed with status code: {response.status_code}")

    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")


def insert(data):
    url, auth = connect_elasticsearch()
    if url and auth:
        create_index(url, auth)
        insert_data(url, auth,data)

