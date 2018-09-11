export default class EventMapper {
  constructor(events) {
    this.events = events;
  }

  toStoredEvent = event => {
    let { aggregate, aggregateId, type, sequenceNumber, timestamp, actor, position, ...body } = event;
    return {
      aggregate: aggregate,
      aggregateId: aggregateId,
      type: type || name,
      sequenceNumber: sequenceNumber,
      position: JSON.stringify(event.position),
      actor: actor,
      body: JSON.stringify(body)
    };
  }

  fromStoredEvent = event => {
    try {
      let Event = this.events[event.aggregate][event.type];
      return new Event({
        aggregate: event.aggregate,
        aggregateId: event.aggregateId,
        timestamp: event.timestamp,
        type: event.type,
        sequenceNumber: event.sequenceNumber,
        actor: event.actor,
        position: JSON.parse(event.position || null),
        ...JSON.parse(event.body)
      });
    }
    catch (e) {
      console.log(`Failed to map event ${event.type} ${event.sequenceNumber}`);
      throw e;
    }
  }
}
