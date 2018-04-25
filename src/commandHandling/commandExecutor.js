import { CommandHandlerError } from '@attackpattern/node-cqrs-lib';

export default class CommandExecutor {
  constructor({ name, handlers, repository }) {
    this.name = name;
    this.handlers = handlers;
    this.repository = repository;
  }

  execute = async ({ aggregateId, commandType, command }) => {
    const handler = this.handlers[commandType] && this.handlers[commandType]();
    if (!handler) {
      throw new CommandHandlerError({
        error: new Error(`Unknown command ${commandType}`),
        aggregate
      });
    }

    const aggregate = await this.getAggregate(handler, aggregateId);

    const result = await handler.handle(command, aggregate);
    try {
      let { events, ...body } = result || {};

      await this.repository.record(events);
      return { id: aggregate.id, ...body };
    }
    catch (error) {
      throw new CommandHandlerError({ error, handler, aggregate });
    }
  }

  getAggregate = async (handler, aggregateId) => {
    if (!aggregateId) {
      return await this.repository.create();
    }
    const aggregate = await this.repository.get(aggregateId) ||
      (handler.isCreateHandler && await this.repository.create(aggregateId));
    if (!aggregate) {
      throw new CommandHandlerError({
        error: new Error(`${this.name} ${aggregateId} not found`),
        handler,
        aggregate
      });
    }
    return aggregate;
  }
}
