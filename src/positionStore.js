export default class PositionStore {
  constructor(eventStore) {
    this.eventStore = eventStore;
  }

  store = async({ responderId, position }) =>
    await this.eventStore.record([{
      type: 'TrackedPosition',
      responderId: responderId,
      position: position
    }], 'position');
}
