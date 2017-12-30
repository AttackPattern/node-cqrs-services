import promisify from 'es6-promisify';
import aws from 'aws-sdk';

export default class AwsEmailSender {
  constructor({ awsSes, from }) {
    this.awsSes = new aws.SES();
    this.from = from;
  }

  sendEmail({ recipient, subject, body }) {
    return promisify(this.awsSes.sendEmail, this.awsSes)({
      Destination: { ToAddresses: [recipient] },
      Source: this.from,
      ReplyToAddresses: [this.from],
      ReturnPath: this.from,
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: body.html },
          Text: { Data: body.text }
        }
      }
    });
  }
}
