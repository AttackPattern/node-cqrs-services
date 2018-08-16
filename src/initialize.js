import aws from 'aws-sdk';
import passport from 'koa-passport';
import ampq from 'amqplib';

import AuthenticationRouter from './routing/authenticationRouter';
import CommandRouter from './routing/commandRouter';
import UploadRouter from './routing/uploadRouter';
import IdentityMiddleware from './routing/identityMiddleware';
import CommandExecutor from './commandHandling/commandExecutor';
import WebCommandHandler from './commandHandling/webCommandHandler';
import PasswordCommandHandler from './commandHandling/passwordCommandHandler';
import DomainCommandHandler from './commandHandling/domainCommandDeliverer';
import { EventMapper, EventStore, EventStoreInitializer } from './eventing';
import { AwsSNS, Emailer, SecretCodes, AwsEmailSender } from './services';

import AuthTokenMapper from './auth/authTokenMapper';
import AuthStore from './auth/authStore';
import { Identity, Repository, RealWorldClock, RabbitScheduler, RoleMapping } from '@facetdev/node-cqrs-lib';
import DomainServices from './scheduling/domainServices';

export default class Services {
  static initialize = async ({ container, config, db, domain, emailTemplates, decorateUser = i => i }) => {

    await EventStoreInitializer.assureEventsTable(db);

    function mapHandlers(handlers) {
      return Object.entries(handlers).map(({
        [0]: handlerName, [1]: handler }) =>
        ({ name: handlerName, handler: () => container.resolve(handler) }))
        .reduce((result, item) => {
          result[item.name] = item.handler;
          return result;
        }, {});
    }

    const repositories = Object.entries(domain).reduce(
      (repos, { [0]: name, [1]: aggregate }) => {
        repos[name] = new Repository({
          eventStore: new EventStore({
            aggregate: name,
            db: db,
            mapper: new EventMapper(name, aggregate.events)
          }),
          aggregate: aggregate.aggregate,
          snapshots: config('eventStore').snapshots
        });
        return repos;
      }, {});

    const executors = Object.entries(domain).map(({
      [0]: aggregateName, [1]: aggregate }) =>
      new CommandExecutor({
        name: aggregateName,
        handlers: mapHandlers(aggregate.handlers),
        repository: repositories[aggregateName]
      })
    );

    const authStore = await AuthStore.create({ db, roleMapping: new RoleMapping(config('roles').roles) });

    const authTokenMapper = new AuthTokenMapper({
      authStore,
      secret: config.decrypt(config('authentication').secret),
      expiration: config('authentication').expiration
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
        stubSES :
        new AwsEmailSender({ awsSes: new aws.SES(), from: config('aws').SES_Source }),
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

    const uploadRouter = new UploadRouter({
      S3_Bucket: config('aws').S3_Bucket
    });
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
        upload: uploadRouter,
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
