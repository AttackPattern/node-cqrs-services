import randToken from 'rand-token';

export default class SecretCodes {
  generate(length = 8) {
    return randToken.generate(length);
  }
}
