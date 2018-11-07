import aws from 'aws-sdk';
import passport from 'koa-passport';
import ampq from 'amqplib';

import AuthenticationRouter from './routing/authenticationRouter';
import CommandRouter from './routing/commandRouter';

import IdentityMiddleware from './routing/identityMiddleware';
import CommandExecutor from './commandHandling/commandExecutor';
import WebCommandHandler from './commandHandling/webCommandHandler';
import PasswordCommandHandler from './commandHandling/passwordCommandHandler';
import DomainCommandHandler from './commandHandling/domainCommandDeliverer';
import { EventMapper, EventStore, EventStoreInitializer } from './eventing';
import { AwsSNS, Emailer, SecretCodes, AwsEmailSender } from './services';

import AuthTokenMapper from './auth/authTokenMapper';
import AuthStore from './auth/authStore';
import { Identity, Repository, RealWorldClock, RabbitScheduler } from '@facetdev/node-cqrs-lib';
import DomainServices from './scheduling/domainServices';

export default class Services {
  static initialize = async ({ container, config, db, bootstrap, domain, emailTemplates, decorateUser = i => i, identityMapper = token => new Identity(token) }) => {

    await EventStoreInitializer.assureEventsTable(db);

    function mapHandlers(handlers) {
      return Object.entries(handlers).map(([handlerName, handler]) =>
          ({ name: handlerName, handler: () => container.resolve(handler) }))
        .reduce((result, item) => {
          result[item.name] = item.handler;
          return result;
        }, {});
    }

    const eventStore = new EventStore({
      db: db,
      mapper: new EventMapper(Object.entries(domain).reduce((events, [name, aggregate]) => {
        events[name] = aggregate.events;
        return events;
      }, {}))
    });

    if (bootstrap?.events && await eventStore.count() === 0) {
      console.log('bootstrapping events');
      const events = bootstrap.events().reduce((result, event) => {
        result.sequence[event.aggregateId] = (result.sequence[event.aggregateId] || 0) + 1;
        result.events.push({
          ...event,
          actor: 'bootstrap',
          sequenceNumber: result.sequence[event.aggregateId]
        });
        return result;
      }, { sequence: {}, events: [] }).events;
      await eventStore.record(events.map(ev => ({
        ...ev,
        actor: 'bootstrap'
      })));
    }

    const repositories = Object.entries(domain).reduce(
      (repos, [name, aggregate]) => {
        repos[name] = new Repository({
          eventStore: eventStore,
          aggregateType: name,
          constructor: aggregate.aggregate,
          snapshots: config('eventStore').snapshots
        });
        return repos;
      }, {});

    const executors = Object.entries(domain).map(([aggregateName, aggregate]) =>
      new CommandExecutor({
        name: aggregateName,
        handlers: mapHandlers(aggregate.handlers),
        repository: repositories[aggregateName]
      })
    );

    const authStore = await AuthStore.create({
      db,
      identityMapper
    });

    if (bootstrap?.users && await authStore.count() === 0) {
      console.log('bootstrapping users');
      for (const user of bootstrap.users()) {
        await authStore.addUser(user);
      }
    }

    const authTokenMapper = new AuthTokenMapper({
      authStore,
      secret: config.decrypt(config('authentication').secret),
      expiration: config('authentication').expiration,
      identityMapper
    });
    container.register('systemIdentity', () => authTokenMapper.sign(Identity.system));

    aws.config.update({
      region: config('aws').SNS_SES_region,
      accessKeyId: config('aws').AccessKey && config.decrypt(config('aws').AccessKey),
      secretAccessKey: config('aws').SecretAccessKey && config.decrypt(config('aws').SecretAccessKey)
    });

    const notifications = new AwsSNS({
      applicationArns: {
        ios: config('aws').IOS_APP_ARN,
        android: config('aws').ANDROID_APP_ARN
      }
    });
    container.register('PushNotifications', () => notifications);

    const stubSES = {
      sendEmail: async ({ recipient, subject, body }) => {
        console.log(`Simulating Sending Email
  ---------------------
  ${subject}
  To: ${recipient}
  ---------------------
  ${body.text}`);
      }
    };

    const emailer = new Emailer({
      sender: (config('aws').Test || []).includes('email') ?
        stubSES : new AwsEmailSender({ awsSes: new aws.SES(), from: config('aws').SES_Source }),
      templateLibrary: emailTemplates
    });
    container.register('Emailer', () => emailer);

    const secretCodes = new SecretCodes();
    container.register('SecretCodes', () => secretCodes);
    container.register('AuthStore', () => authStore);

    const domainCommandDeliverer = new DomainCommandHandler(executors);
    const clock = new RealWorldClock();

    function connectRabbit(store) {
      return new Promise(resolve => {
        function retry() {
          ampq.connect(store)
            .then(c => {
              console.log('Connected to rabbit');
              resolve(c);
            })
            .catch(() => {
              setTimeout(retry, 500);
            });
        }
        retry();
      });
    }

    const scheduledCommandChannel = await (await connectRabbit(config('scheduledCommands').store)).createChannel();
    const commandScheduler = new RabbitScheduler({ channel: scheduledCommandChannel, clock, deliverer: domainCommandDeliverer });
    const domainServices = new DomainServices({ commandScheduler, repositories, clock });

    container.register('DomainServices', () => domainServices);

    const commandRouter = new CommandRouter({ webHandler: new WebCommandHandler(domainCommandDeliverer) });

    const passwordHandler = new PasswordCommandHandler(domainCommandDeliverer, authStore);
    const authRouter = new AuthenticationRouter({
      passport,
      authStore,
      decorateUser,
      authTokenMapper,
      passwordHandler
    });

    return {
      routers: {
        command: commandRouter,
        auth: authRouter
      },
      middleware: {
        identity: new IdentityMiddleware(authTokenMapper).inject
      },
      authStore,
      repositories
    };
  }
}
