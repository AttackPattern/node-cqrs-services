let latitudeFudge = .012;
let longitudeFudge = .020;
let origin = { latitude: 47.612855, longitude: -122.316676 };

function fudge(factor) {
  return (Math.random() - 0.5) * factor;
}

export default class Maps {
  getPosition = () => ({
    latitude: Math.round((+origin.latitude + fudge(latitudeFudge)) * 100000) / 100000,
    longitude: Math.round((+origin.longitude + fudge(longitudeFudge)) * 100000) / 100000
  })

  getResponseTimes = (destination, responders) => responders.map(responder => ({
    responder: responder,
    distance: this.distance(responder.position.longitude, responder.position.latitude, destination.longitude, destination.latitude)
  }));

  // borrowed from http://www.geodatasource.com/developers/javascript
  distance(lon1, lat1, lon2, lat2) {
    var radlat1 = Math.PI * lat1 / 180;
    var radlat2 = Math.PI * lat2 / 180;

    var theta = lon1 - lon2;
    var radtheta = Math.PI * theta / 180;

    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515;

    return dist * 120; /* assume 30mph */
  }
}
