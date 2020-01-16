export default class Emailer {
  constructor({ sender, templateLibrary }) {
    this.sender = sender;
    this.templateLibrary = templateLibrary;
  }

  sendEmail = async ({ recipient, template, data }) => {
    let emailTemplate = this.templateLibrary.getTemplate(template);

    let { subject, body } = await emailTemplate.transform(data);
    try {
      await this.sender.sendEmail({ recipient, subject, body });
    } catch (err) {
      console.log('Emailing error', err);
    }
  };
}
