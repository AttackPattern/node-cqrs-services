export default class Maps {
  constructor(googleMaps) {
    this.googleMaps = googleMaps;
  }

  getPosition = async address => {
    try {
      let response = await (this.googleMaps.geocode({
        address: address
      }).asPromise());

      let result = response.json.results[0];
      return result && {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng
      };
    }
    catch (err) {
      console.log('Failed call to Google Maps: GeoCode', err);
      throw err;
    }
  }

  getResponseTimes = async (destination, responders) => {
    let responderPositions = responders.map(responder => responder.position);
    let times = await this._lookupTimes(destination, responderPositions);
    return responders.map((responder, index) => ({
      responder: responder,
      duration: times[index]
    }));
  };

  _lookupTimes = async (destination, origins = []) => {
    if (!origins.length) {
      return [];
    }
    try {
      let response = await (this.googleMaps.distanceMatrix({
        units: 'imperial',
        origins: origins.map(orig => ({ lat: orig.latitude, lng: orig.longitude })),
        destinations: [destination]
      }).asPromise());

      return response.json.rows.map(row => row.elements[0] && row.elements[0].duration && row.elements[0].duration.value || Number.MAX_SAFE_INTEGER);
    }
    catch (err) {
      console.log('Failed call to Google Maps: Distance Matrix', err);
    }
    return [];
  }
}
