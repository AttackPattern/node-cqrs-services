import { Created as User_Created } from './domain/user/events';

let hasRun = false;

export default class Bootstrap {
  static assureInitialized = async ({ systemUser, userRepository, authStore }) => {
    if (hasRun || !!(await userRepository.get(systemUser.userId))) {
      return;
    }
    console.log(`bootstraping system user "${systemUser.username}"`);
    await authStore.addLogin({
      userId: systemUser.userId,
      username: systemUser.username,
      password: systemUser.password,
      claims: {
        roles: ['systemAdmin']
      }
    });

    let events = [
      Object.assign(new User_Created({
        username: systemUser.username,
        profile: systemUser.profile
      }), {
          sequenceNumber: 1,
          aggregateId: systemUser.userId,
          actor: 'bootstrap'
        })
    ];

    await userRepository.record(events);
    hasRun = true;
  }
}
