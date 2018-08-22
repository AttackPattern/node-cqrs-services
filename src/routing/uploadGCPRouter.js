import Router from 'koa-router';
import uuidV4 from 'uuid/v4';
import Storage from '@google-cloud/storage';

export default class GoogleUploadRouter extends Router {
  //pass in googleConfig, trace this back 
  constructor(googleConfig) {
    console.log(googleConfig)
    super();
    this.bucket = googleConfig.GCP_Bucket;
    this.storage = new Storage({
      credentials: {
        "client_email": googleConfig.client_email,
        "private_key": googleConfig.private_key,
      }
    });

    this.prefix('/upload')
      .post('/signRequest', this.getSignedRequest);
  }

  getSignedRequest = async ctx => {
    const body = ctx.request.body;
    const fileId = body.fileId || uuidV4();
    let folder = body.folder && `${body.folder}/` || '';
    try {
      let url = await this.storage
        .bucket(this.bucket)
        .file(`${folder}${fileId}.jpg`)
        .getSignedUrl({
          action: 'write',
          expires: '08/22/2019',
          contentType: 'image/jpeg'
        })
        .catch(err => {
          console.error('ERROR:', err);
        });
      ctx.status = 200;
      ctx.body = {
        fileId: fileId,
        signedRequest: url[0],
        url: `https://storage.googleapis.com/${this.bucket}/${folder}${fileId}.jpg`
      };
    }
    catch (err) {
      ctx.status = 500;
      console.log(err);
      ctx.body = { error: 'Failed to build upload url' };
    }
  }
}

