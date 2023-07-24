import requests
import json
import random
import datetime
from kafka import KafkaProducer
import time

from datetime import datetime, timezone

def date_and_time_r():
    # Generate a random year between 2000 and 2023
    year = random.randint(2023, 2023)

    # Generate a random month
    month = random.randint(7, 7)

    # Generate a random day
    day = random.randint(1, 31)  # Assuming all months have 28 days for simplicity

    # Generate a random hour
    hour = random.randint(0, 23)

    # Generate a random minute
    minute = random.randint(0, 59)

    # Generate a random second
    second = random.randint(0, 59)

    # Create a datetime object with the random values
    random_datetime = datetime(year, month, day, hour, minute, second)

    # Convert the datetime to UTC timezone
    random_datetime_utc = random_datetime.astimezone(timezone.utc)

    # Extract the date and time components as strings
    date_str = random_datetime_utc.strftime("%Y-%m-%d")
    time_str = random_datetime_utc.strftime("%H:%M:%S")

    return date_str, time_str


def get_planetariums():
    planetariums = [
        "MMT",
        "Gemini Observatory Telescopes",
        "Very Large Telescope",
        "Subaru Telescope",
        "Large Binocular Telescope",
        "Southern African Large Telescope",
        "Keck 1 and 2",
        "Hobby-Eberly Telescope",
        "Gran Telescopio Canarias",
        "The Giant Magellan Telescope",
        "Thirty Meter Telescope",
        "European Extremely Large Telescope"
    ]
    return random.choice(planetariums)


def get_events_types():
    events_types = [
        "GRB",
        "Apparent Brightness Rise",
        "UV Rise",
        "X-Ray Rise",
        "Comet"
    ]
    return random.choice(events_types)


def get_data():
    try:
        url = 'http://localhost:3000/getStar'
        response = requests.get(url)
        if response.status_code == 200:
            return response.text
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return {}
    except requests.exceptions.RequestException as error:
        print('Error:', error)




def create_msg():
    date = date_and_time_r()
    planetarium = get_planetariums()
    events_type = get_events_types()
    urgency = random.randint(1, 5)
    t = get_data()
    random_item = json.loads(t)

    id = random_item['harvard_ref_#']
    ra = random_item['RA']
    dec = random_item['DEC']
    Title_HD = random_item['Title HD']

    msg = {'date': date[0],'time': date[1], 'planetarium': planetarium, 'events_type': events_type, 'urgency': urgency, 'id': id, 'RA': ra,
           'DEC': dec, 'Title_HD': Title_HD}
    return msg


def json_ser(data):
    return json.dumps(data).encode('utf-8')


def get_partition(key, all, available):
    return 0


def kafka_producer():
    # Create a Kafka producer
    # producer = KafkaProducer(bootstrap_servers=['localhost:9092'], value_serializer=json_ser, partitioner=get_partition)
    producer = KafkaProducer(
            bootstrap_servers=['tough-ewe-9441-eu1-kafka.upstash.io:9092'],
            sasl_mechanism='SCRAM-SHA-256',
            security_protocol='SASL_SSL',
            sasl_plain_username='dG91Z2gtZXdlLTk0NDEktvsDhIZ6n36KijOs8dYQcsvTKRW5q2rfAHn6t6JpntA',
            sasl_plain_password='1841bd9acc424db5a8b06eeab2f87567',
            )

    # for _ in range(100):
    while True:
        m = create_msg()
        print(m)
        serialized_msg = json_ser(m)  # Serialize the message value to bytes
        producer.send("events", value=serialized_msg)  # Send the serialized message
        # producer.send("event16", m)
        time.sleep(3)


if __name__ == '__main__':
    kafka_producer()
