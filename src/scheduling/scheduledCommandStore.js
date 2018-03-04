import { Schedule } from 'node-cqrs-lib';

export default class ScheduledCommandStore {

  constructor(db, commandMapping, getClock) {
    this.getClock = getClock;
    this.commandMapping = commandMapping;

    this.ScheduledCommands = require('bookshelf')(db.knex('scheduledcommands')).Model.extend({
      tableName: 'commands'
    });
  }

  push = command => this.recordCommand(command)

  complete = command => this.ScheduledCommands.where({ id: command.$scheduler.id }).destroy()

  retry = async (command) => {
    let scheduledCommand = await this.ScheduledCommands.where({ id: command.$scheduler.id }).fetch();
    scheduledCommand.set('due', command.$scheduler.due);
    scheduledCommand.set('attempts', command.$scheduler.attempts);
    await scheduledCommand.save();
  }

  loadCommands = async () => {
    try {
      return (await this.ScheduledCommands.query()).map(cmd => this.fromStoredCommand(cmd));
    }
    catch (e) {
      console.log('Error loading commands', e);
      throw e;
    }
  }

  recordCommand = async cmd => {
    let storedCommand = this.toStoredCommand(cmd);
    try {
      return this.fromStoredCommand((await new this.ScheduledCommands().save(storedCommand)).serialize());
    }
    catch (e) {
      console.log('Failed to save command', e);
      throw e;
    }
  }

  toStoredCommand = cmd => {
    let { $scheduler, ...command } = cmd;
    return {
      service: $scheduler.service,
      target: $scheduler.target,
      type: command.type,
      created: $scheduler.created || new Date(),
      due: $scheduler.due,
      attempts: $scheduler.attempts,
      command: JSON.stringify(command)
    };
  }

  fromStoredCommand = cmd => {
    let parsedCommand = JSON.parse(cmd.command);
    parsedCommand.$scheduler = new Schedule({
      id: cmd.id,
      service: cmd.service,
      target: cmd.target,
      due: cmd.due,
      created: cmd.created,
      attempts: cmd.attempts,
      clock: this.getClock()
    });

    let CommandType = this.commandMapping(cmd.service, cmd.type);
    return new CommandType(parsedCommand);
  }
}
