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
      .get('/signRequest', this.getSignedRequest);
  }

  getSignedRequest = async ctx => {
    const fileId = uuidV4();

    try {
      let url = this.s3.getSignedUrl('putObject', {
        Bucket: this.bucket,
        Key: `${fileId}.jpg`,
        Expires: 60,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      });
      ctx.status = 200;
      ctx.body = {
        fileId: fileId,
        signedRequest: url,
        url: `https://${this.bucket}.s3.amazonaws.com/${fileId}.jpg`
      };
    }
    catch (err) {
      ctx.status = 500;
      console.log(err);
      ctx.body = { error: 'Failed to build upload url' };
    }
  }
}
