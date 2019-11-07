import aws from 'aws-sdk';
import passport from 'koa-passport';
import fetch from 'node-fetch';
import AuthenticationRouter from './routing/authenticationRouter';
import CommandRouter from './routing/commandRouter';
import InjectEventRouter from './routing/injectEventRouter';
import TaskSchedulerRouter from './routing/taskSchedulerRouter';

import IdentityMiddleware from './routing/identityMiddleware';
import CommandExecutor from './commandHandling/commandExecutor';
import WebCommandHandler from './commandHandling/webCommandHandler';
import PasswordCommandHandler from './commandHandling/passwordCommandHandler';
import DomainCommandHandler from './commandHandling/domainCommandDeliverer';
import { EventMapper, EventStore, EventStoreInitializer } from './eventing';
import { Emailer, SecretCodes, AwsEmailSender } from './services';

import AuthTokenMapper from './auth/authTokenMapper';
import AuthStore from './auth/authStore';
import { Identity, Repository, RealWorldClock, TaskScheduler } from '@facetdev/node-cqrs-lib';
import DomainServices from './scheduling/domainServices';

export default class Services {
  static initialize = async ({ container, config, db, fcmKey, bootstrap, domain, emailTemplates, emailSender, decorateUser = i => i, identityMapper = token => new Identity(token) }) => {

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
    container.register('AuthTokenMapper', () => authTokenMapper);

    container.register('systemIdentity', () => authTokenMapper.sign(Identity.system));

    aws.config.update({
      region: config('aws').SNS_SES_region,
      accessKeyId: config('aws').AccessKey && config.decrypt(config('aws').AccessKey),
      secretAccessKey: config('aws').SecretAccessKey && config.decrypt(config('aws').SecretAccessKey)
    });

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
      sender: emailSender || ((config('aws').Test || []).includes('email') ?
        stubSES : new AwsEmailSender({ awsSes: new aws.SES(), from: config('aws').SES_Source })),
      templateLibrary: emailTemplates
    });
    container.register('Emailer', () => emailer);

    const secretCodes = new SecretCodes();
    container.register('SecretCodes', () => secretCodes);
    container.register('AuthStore', () => authStore);

    const domainCommandDeliverer = new DomainCommandHandler(executors);
    const clock = new RealWorldClock();

    /**
     * For Google Cloud tasks we need a callback URL for the scheduled task to be delivered to
     * in Dev this presents a unique challenge so we use ngrok to create a tunnel proxy, the problem
     * is that ngrok generates a new url on startup every time.  So we need to use said tunnel in dev
     **/
    let rootUrl = config('google').tasks?.deliveryRoot;
    if (process.env.ConfigurationPrecedence === 'dev') {
      try {
        const response = await fetch('http://ngrok:4040/api/tunnels', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        console.log('setting Gcloud Task callback root to:', result.tunnels?.[0]?.public_url);
        rootUrl = result.tunnels?.[0]?.public_url;
      }
      catch (ex) {
        console.log('lookup of ngrok in dev environment failed');
      }
    }

    const commandScheduler = new TaskScheduler({
      ...config('google').tasks,
      rootUrl,
      deliveryPath: 'services/task/deliver',
      credentials: {
        private_key: fcmKey,
        client_email: config('google').serviceAccounts.firebase.client_email,
        email: config('google').serviceAccounts.firebase.client_email
      }
    });
    const domainServices = new DomainServices({ commandScheduler, commandExecuter: domainCommandDeliverer, repositories, clock });

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

    const injectEventRouter = new InjectEventRouter({
      repositories,
      eventStore
    });

  const taskSchedulerRouter = new TaskSchedulerRouter({ deliverer: domainCommandDeliverer });

  return {
      routers: {
        command: commandRouter,
        auth: authRouter,
        injectEvent: injectEventRouter,
        task: taskSchedulerRouter
      },
      middleware: {
        identity: new IdentityMiddleware(authTokenMapper).inject
      },
      aws,
      authStore,
      authTokenMapper,
      emailer,
      repositories
    };
  }
}
