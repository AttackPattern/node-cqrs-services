
export default class AwsEmailSender {
  constructor({ awsSes, from }) {
    this.awsSes = awsSes;
    this.from = from;
  }

  sendEmail({ recipient, subject, body }) {
    return this.awsSes.sendEmail({
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
    }).promise();
  }
}
