import { Client, HighLevelProducer } from 'kafka-node';

export default class KafkaConnection {
  constructor({
    storeUrl = '',
    clientId = ''
  }) {
    this.connect = () => {
      console.log(`connecting to ${storeUrl} ${clientId}`);
      this.currentProducer && this.currentProducer.close();

      this.client = new Client(storeUrl, `${clientId}-${process.pid}`);
      this.currentProducer = new HighLevelProducer(this.client, { partitionerType: 3 });
      this.currentProducer.on('error', () => setTimeout(() => this.connect(), 500));

      // NOTE: this is required for our HighLevelProducer with KeyedPartitioner usage to resolve errors on first send on a fresh instance. see:
      //          - https://www.npmjs.com/package/kafka-node#highlevelproducer-with-keyedpartitioner-errors-on-first-send
      this.client.refreshMetadata(['position'], () => {});
    };

    this.connect();
  }

  producer = () => {
    return this.currentProducer;
  }

  close() {
    this.client.close();
  }
}
