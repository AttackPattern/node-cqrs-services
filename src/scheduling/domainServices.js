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
    await this.executeCommand({ service: aggregate, target: id, command });
    return id;
  }

  scheduleCommand = async ({ service, aggregate, target, command, seconds }) => {
    await this.commandScheduler.schedule({
      service: service || aggregate,
      target,
      command,
      seconds
    });
  }

  executeCommand = async ({ service, aggregate, target, command }) => {
    await this.commandScheduler.execute({
      service: service || aggregate,
      target: target,
      command: command
    });
  }
}
