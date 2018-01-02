import aws from 'aws-sdk';
import passport from 'koa-passport';

import AuthenticationRouter from './routing/authenticationRouter';
import CommandRouter from './routing/commandRouter';
import UploadRouter from './routing/uploadRouter';
import { Identity, Repository } from 'node-cqrs-lib';
import IdentityMiddleware from './routing/identityMiddleware';
import CommandExecutor from './commandHandling/commandExecutor';
import WebCommandHandler from './commandHandling/webCommandHandler';
import PasswordCommandHandler from './commandHandling/passwordCommandHandler';
import DomainCommandHandler from './commandHandling/domainCommandDeliverer';
import { EventMapper, EventStore, EventStoreInitializer } from './eventing';
import { AwsSNS, Emailer, SecretCodes, AwsEmailSender } from './services';

import configureScheduling from './scheduling/configure';
import AuthTokenMapper from './auth/authTokenMapper';
import AuthStore from './auth/authStore';

export default class Services {
  static initialize = async ({ container, config, db, domain, emailTemplates, decorateUser }) => {

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

    let repositories = Object.entries(domain).reduce((repos, {
      [0]: name, [1]: aggregate }) => {
      repos[name] = new Repository({
        eventStore: new EventStore({
          aggregate: name,
          db: db,
          mapper: new EventMapper(name, aggregate.events)
        }),
        aggregate: aggregate.aggregate
      });
      return repos;
    }, {});

    let executors = Object.entries(domain).map(({
        [0]: aggregateName, [1]: aggregate }) =>
      new CommandExecutor({
        name: aggregateName,
        handlers: mapHandlers(aggregate.handlers),
        repository: repositories[aggregateName]
      })
    );

    let commands = Object.entries(domain)
      .reduce((result, {
        [0]: aggregateName, [1]: aggregate }) => {
        result[aggregateName] = aggregate.commands;
        return result;
      }, {});

    let authStore = await AuthStore.create(db);

    let authTokenMapper = new AuthTokenMapper({
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

    let notifications = new AwsSNS({
      applicationArns: {
        ios: config('aws').IOS_APP_ARN,
        android: config('aws').ANDROID_APP_ARN
      }
    });
    container.register('PushNotifications', () => notifications);

    let emailer = new Emailer({
      sender: new AwsEmailSender({ awsSes: new aws.SES(), from: config('aws').SES_Source }),
      templateLibrary: emailTemplates
    });
    container.register('Emailer', () => emailer);

    let secretCodes = new SecretCodes();
    container.register('SecretCodes', () => secretCodes);
    container.register('AuthStore', () => authStore);

    let domainCommandDeliverer = new DomainCommandHandler(executors);
    let domainServices = configureScheduling({ db, deliverer: domainCommandDeliverer, commands, repositories });
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
