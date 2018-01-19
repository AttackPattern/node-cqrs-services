import moment from 'moment';
import uuidV4 from 'uuid/v4';

export default class DomainServices {
  constructor({ commandScheduler, repositories, clock }) {
    this.commandScheduler = commandScheduler;
    this.repositories = repositories;
    this.clock = clock;
  }

  get = async ({ service, id }) => this.repositories[service].get(id);

  create = async ({ aggregate, target, command }) => {
    let id = target || uuidV4();
    await this.scheduleCommand({ service: aggregate, target: id, command });
    return id;
  }

  scheduleCommand = async ({ service, target, command, due, seconds }) => {
    this.commandScheduler.schedule({
      service: service,
      target: target,
      command: command,
      due: due || moment(this.clock.now()).add(seconds || 0, 'seconds').toDate(),
      clock: this.clock
    });
  }
}
