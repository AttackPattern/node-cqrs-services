import eachSeries from 'async/eachSeries';
import bookshelf from 'bookshelf';

export default class EventStore {
  constructor({ aggregate = '', mapper, db }) {
    this.aggregate = aggregate;
    this.mapper = mapper;

    this.Event = bookshelf(db.knex('eventstore')).Model.extend({
      tableName: 'events'
    });
    this.Snapshot = bookshelf(db.knex('eventstore')).Model.extend({
      tableName: 'snapshots'
    });
  }

  getEvents = async aggregateId => {
    try {
      return {
        events: (await this.Event
          .where({ aggregate: this.aggregate, aggregateId: aggregateId })
          .orderBy('sequenceNumber', 'asc')
          .query()
        ).map(e => this.mapper.fromStoredEvent(e)),
        snapshot: JSON.parse((await this.Snapshot
          .where({ aggregate: this.aggregate, aggregateId: aggregateId })
          .orderBy('version', 'desc')
          .query())[0]?.body || '{}')
      };
    }
    catch (e) {
      console.log('Error loading events', e);
      throw e;
    }
  }

  record = async events =>
    await eachSeries(events, async (event, cb) => {
      await this.recordEvent(event);
      cb();
    })

  recordEvent = async event => {
    let storedEvent = this.mapper.toStoredEvent(event);
    try {
      return this.mapper.fromStoredEvent((await new this.Event(storedEvent).save()).toJSON());
    }
    catch (e) {
      console.log('Failed to save event', e);
      throw e;
    }
  }

  saveSnapshot = async ({ aggregate }) => {

  }
}
