import { CommandHandlerError } from '@facetdev/node-cqrs-lib';

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
        message: `Unknown command ${commandType}`,
      });
    }

    try {
      const aggregate = await this.getAggregate(handler, aggregateId);
      const result = await handler.handle(command, aggregate);
      let { events, ...body } = result || {};

      await this.repository.record(events);
      return { id: aggregate.id, ...body };
    } catch (error) {
      error.handler = handler;
      throw error;
    }
  };

  getAggregate = async (handler, aggregateId) => {
    if (!aggregateId) {
      return await this.repository.create();
    }
    const aggregate =
      (await this.repository.get(aggregateId)) ||
      (handler.isCreateHandler && (await this.repository.create(aggregateId)));
    if (!aggregate) {
      throw new CommandHandlerError({
        message: `${this.name} ${aggregateId} not found`,
        handler,
        aggregate,
      });
    }
    return aggregate;
  };
}
