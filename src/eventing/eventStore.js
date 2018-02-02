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
      const snapshot = (await this.Snapshot
        .where({ aggregate: this.aggregate, aggregateId: aggregateId })
        .orderBy('version', 'desc')
        .fetch()
      ) ?.toJSON();
      let eventQuery = this.Event
        .where({ aggregate: this.aggregate })
        .where({ aggregateId: aggregateId });
      if (snapshot) {
        eventQuery = eventQuery.where('sequenceNumber', '>', snapshot.version);
      }
      return {
        events: (await eventQuery
          .orderBy('sequenceNumber', 'asc')
          .query()
        ).map(e => this.mapper.fromStoredEvent(e)),
        snapshot: snapshot && {
          version: snapshot.version,
          body: JSON.parse(snapshot.body)
        }
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

  saveSnapshot = async ({ id, version, ...body }) => {
    await new this.Snapshot({
      aggregate: this.aggregate,
      aggregateId: id,
      version,
      body: JSON.stringify(body)
    }).save();
  }
}
