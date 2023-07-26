from kafka import KafkaConsumer
import json

from insertElasticSearch import insert
topic = 'events2023'

def main():
    # consumer = KafkaConsumer("event16", bootstrap_servers='localhost:9092', auto_offset_reset='earliest')
    consumer = KafkaConsumer(
        topic,
        bootstrap_servers=['tough-ewe-9441-eu1-kafka.upstash.io:9092'],
        sasl_mechanism='SCRAM-SHA-256',
        security_protocol='SASL_SSL',
        sasl_plain_username='dG91Z2gtZXdlLTk0NDEktvsDhIZ6n36KijOs8dYQcsvTKRW5q2rfAHn6t6JpntA',
        sasl_plain_password='1841bd9acc424db5a8b06eeab2f87567',
        group_id='events',
        auto_offset_reset='earliest',
    )

    print("starting the consumer")
    for msg in consumer:
        print(msg)
        insert(json.loads(msg.value))


if __name__ == '__main__':
    main()

