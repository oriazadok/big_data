from kafka import KafkaConsumer
import json

from insertElasticSearch import insert


def main():
    consumer = KafkaConsumer("event13", bootstrap_servers='localhost:9092', auto_offset_reset='earliest')
    print("starting the consumer")
    for msg in consumer:
        insert(json.loads(msg.value))


if __name__ == '__main__':
    main()
