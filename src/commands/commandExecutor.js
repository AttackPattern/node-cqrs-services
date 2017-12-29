import { ValidationError, CommandHandlerError } from 'node-cqrs-lib';

export default class CommandExecutor {
  constructor({ name, handlers, repository }) {
    this.name = name;
    this.handlers = handlers;
    this.repository = repository;
  }

  execute = async({ aggregateId, commandType, command }) => {
    const handler = this.handlers[commandType] && this.handlers[commandType]();
    if (!handler) {
      throw new CommandHandlerError({
        error: new Error(`Unknown command ${commandType}`),
        aggregate
      });
      return ctx.body = { error: 'Unknown command', command: commandType };
    }

    let aggregate;
    if (!aggregateId) {
      aggregate = await this.repository.create();
    }
    else {
      aggregate = await this.repository.get(aggregateId) ||
        (handler.isCreateHandler && await this.repository.create(aggregateId));
      if (!aggregate) {
        throw new CommandHandlerError({
          error: new Error(`${this.name} ${aggregateId} not found`),
          handler,
          aggregate
        });
      }
    }

    try {
      const events = await handler.handle(command, aggregate);
      await this.repository.record(events);
      return { id: aggregate.id };
    }
    catch (error) {
      throw new CommandHandlerError({ error, handler, aggregate });
    }
  }
}
