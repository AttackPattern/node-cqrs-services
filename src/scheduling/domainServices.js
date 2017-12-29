import uuidV4 from 'uuid/v4';

export default class DomainServices {
  constructor({ commandScheduler }) {
    this.commandScheduler = commandScheduler;
  }

  create = async ({ aggregate, target, command }) => {
    let id = target || uuidV4();
    await this.scheduleCommand({ service: aggregate, target: id, command });
    return id;
  }

  scheduleCommand = async ({ service, target, command, due, seconds }) => {
    return this.commandScheduler.schedule({ service, target, command, due, seconds });
  }
}
