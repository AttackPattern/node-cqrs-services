import aws from 'aws-sdk';
import promisify from 'es6-promisify';

export default class AwsSNS {

  constructor(config) {
    this.SNS = new aws.SNS();
    // add android check
    this.applicationArns = config.applicationArns;
  }

  createPlatformEndpoint = async (deviceToken) => {
    try {
      // do a type check against token for type
      console.log('token for os', deviceToken.os);
      const appArn = deviceToken.os === 'ios' ?
        this.applicationArns.ios : this.applicationArns.android;
      const response = await promisify(this.SNS.createPlatformEndpoint, this.SNS)({
        PlatformApplicationArn: appArn,
        Token: deviceToken.token
      });
      return response.EndpointArn;
    }
    catch (e) {
      console.log('SNS Create Platform Endpoint Error', e);
      return '';
    }
  }

  dispatchNotification = async (endpointArn) => {
    const message = {
      MessageStructure: 'json',
      Message: JSON.stringify({
        default: 'You have a dispatch request',
        GCM: JSON.stringify({ data: { message: 'You have a dispatch request', type: 'dispatch' } }),
        APNS_SANDBOX: JSON.stringify(apnsDispatch),
        APNS: JSON.stringify(apnsDispatch)
      }),
      Subject: 'Dispatch Request',
      TargetArn: endpointArn
    };
    this.sendNotification(message);
  }
  dispatchClosed = async (endpointArn) => {
    const message = {
      MessageStructure: 'json',
      Message: JSON.stringify({
        default: 'The dispatch was accepted by another or canceled',
        GCM: JSON.stringify({ data: { message: 'The dispatch was accepted by another or canceled', type: 'dispatchClosed' } }),
        APNS_SANDBOX: JSON.stringify(apnsClosed),
        APNS: JSON.stringify(apnsClosed)
      }),
      Subject: 'Dispatch Canceled',
      TargetArn: endpointArn
    };
    this.sendNotification(message);
  }

  sendNotification = async (message) => {
    try {
      await promisify(this.SNS.publish, this.SNS)(message);
    }
    catch (e) {
      console.log('SES setup error', e.message);
    }
  }
}

const apnsDispatch = {
  aps: {
    alert: 'You have a dispatch request',
    badge: 6,
    sound: 'default'
  }, payload: { type: 'dispatch' }
};

const apnsClosed = {
  aps: {
    alert: 'The dispatch was accepted by another or canceled',
    badge: 6,
    sound: 'default'
  }, payload: { type: 'dispatchClosed' }
};
