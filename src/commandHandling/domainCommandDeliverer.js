export default class DomainCommandDeliverer {
  constructor(executors) {
    this.executors = executors.reduce((result, exec) => {
      result[exec.name] = exec;
      return result;
    }, {});

    this.services = executors.map(e => e.name);
  }

  async deliver({ service, target, commandType, command }) {
    let executor = this.executors[service];
    return await executor.execute({ aggregateId: target, commandType: commandType || command.type, command });
  }
}
