let maxTravelTime = 3600; // 1 hour

export default class ResponderSearch {
  constructor(getAvailableResponders, maps) {
    this.getAvailableResponders = getAvailableResponders;
    this.maps = maps;
  }

  findClosestResponder = async ({ destination, excludedCandidates = [] }) => {
    let availableResponders = await this.getAvailableResponders();
    // so we filter on within range so that we don't send a direction request for someone over 100 miles away.
    // that keeps us from pulling in people overseas with no path to the destination and causing the
    // distance api to throw
    let eligibleResponders = availableResponders
      .filter(responder => !excludedCandidates.some(candidate => candidate.shiftId === responder.shiftId))
      .filter(responder => this.withinRange(responder.position, destination.latitude, destination.longitude));
    let responseTimes = await this.maps.getResponseTimes(destination, eligibleResponders.filter(r => r.position));
    // even though we checked if the responders were within 100 miles, if they are over the maxTravelTime filter them out
    let respondersInRange = responseTimes.filter(r => r.duration < maxTravelTime);

    return respondersInRange.reduce(
      (current, next) => current.duration < next.duration ? current : next, { duration: Number.MAX_VALUE }
    ).responder;
  }

  // borrowed from http://www.geodatasource.com/developers/javascript
  withinRange({ latitude, longitude }, lat2, lon2) {
    var radlatitude = Math.PI * latitude / 180;
    var radlat2 = Math.PI * lat2 / 180;

    var theta = longitude - lon2;
    var radtheta = Math.PI * theta / 180;

    var dist = Math.sin(radlatitude) * Math.sin(radlat2) + Math.cos(radlatitude) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;
    // within range if less than 100 miles
    return dist < 100;
  }
}
