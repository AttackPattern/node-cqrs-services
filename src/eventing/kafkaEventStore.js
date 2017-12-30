import { HighLevelProducer } from 'kafka-node';
import promisify from 'es6-promisify';

export default class KafkaEventStore {
  constructor(getProducer) {
    this.producer = getProducer;

    this.ready = new Promise((resolve, reject) =>
      this.producer().once('ready', async() => resolve(true))
    );
  }

  commit = async(events, topic) => {
    await Promise.all(events.map(async event => {
      try {
        await promisify(this.producer().send, this.producer())([{
          topic: topic,
          key: event.aggregateId,
          messages: JSON.stringify({
            timestamp: event.timestamp || new Date(),
            ...event
          }),
          attributes: 1
        }]);
      }
      catch (err) {
        console.log('error publishing events to Kafka', err);
        throw err;
      }
    }));
  }

  record = async(events, topic) => {
    await this.ready;
    await this.commit(events, topic);
  }
}
