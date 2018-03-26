import Router from 'koa-router';
import aws from 'aws-sdk';
import uuidV4 from 'uuid/v4';

export default class UploadRouter extends Router {

  constructor(awsConfig) {
    super();

    this.bucket = awsConfig.S3_Bucket;
    this.s3 = new aws.S3({
      accessKeyId: awsConfig.AccessKey,
      secretAccessKey: awsConfig.SecretAccessKey
    });

    this.prefix('/upload')
      .post('/signRequest', this.getSignedRequest);
  }

  getSignedRequest = async ctx => {
    const body = ctx.request.body;
    const fileId = body.fileId || uuidV4();
    let folder = body.folder && `${body.folder}/` || '';
    try {
      let url = await this.s3.getSignedUrl('putObject', {
        Bucket: this.bucket,
        Key: `${folder}${fileId}.jpg`,
        Expires: 60,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      });
      ctx.status = 200;
      ctx.body = {
        fileId: fileId,
        signedRequest: url,
        url: `https://${this.bucket}.s3.amazonaws.com/${folder}${fileId}.jpg`
      };
    }
    catch (err) {
      ctx.status = 500;
      console.log(err);
      ctx.body = { error: 'Failed to build upload url' };
    }
  }
}
