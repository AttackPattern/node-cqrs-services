export default class UserProfiles {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  getProfile = async (userId) => {
    let user = await this.userRepo.get(userId);
    return user && user.profile;
  }
}
