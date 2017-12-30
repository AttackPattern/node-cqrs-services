import mysql from 'mysql2/promise';
import eachSeries from 'async/eachSeries';
import EventStoreInitializer from './eventStoreInitializer';
import bookshelf from 'bookshelf';

export default class EventStore {
  constructor({ aggregate = '', mapper, db }) {
    this.aggregate = aggregate;
    this.mapper = mapper;

    this.Event = bookshelf(db.knex('eventstore')).Model.extend({
      tableName: 'events'
    });
  }

  getEvents = async aggregateId => {
    try {
      return (await this.Event
        .where({ aggregate: this.aggregate, aggregateId: aggregateId })
        .orderBy('sequenceNumber', 'asc')
        .query()
      ).map(e => this.mapper.fromStoredEvent(e));
    }
    catch (e) {
      console.log('Error loading events', e);
      throw e;
    }
  }

  record = async events =>
    await eachSeries(events, async(event, cb) => {
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
}
