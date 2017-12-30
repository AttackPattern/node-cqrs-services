export default class AvailableResponders {
  constructor(fetch, getSystemUser) {
    this.fetch = fetch;
    this.getSystemUser = getSystemUser;
  }

  getResponders = async() => {
    let result = await this.fetch('http://speedwell-projections:3000/services/availableResponders', {
      headers: { authorization: this.getSystemUser() }
    });

    return result.ok ? result.json() || [] : [];
  }
}
