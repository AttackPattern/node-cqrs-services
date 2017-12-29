import { CommandScheduling } from 'node-cqrs-lib';
import fetch from 'node-fetch';
import ScheduledCommandStore from './scheduledCommandStore';
import DomainServices from './domainServices';

const {
  RealWorldClock,
  CommandScheduler,
  CommandScheduleTrigger
} = CommandScheduling;

export default function ({ db, deliverer, commands, repositories }) {

  let clock = new RealWorldClock();
  let commandStore = new ScheduledCommandStore(db, (service, commandName) => commands[service][commandName], () => new RealWorldClock());
  let commandScheduler = new CommandScheduler({ store: commandStore, clock, deliverer: deliverer });

  let trigger = new CommandScheduleTrigger(commandScheduler, clock, 1000);
  trigger.start();

  return new DomainServices({ commandScheduler, repositories, clock });
}
