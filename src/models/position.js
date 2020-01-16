export default class Position {
  constructor(data = {}) {
    this.latitude = +data.latitude;
    this.longitude = +data.longitude;

    this.accuracy = +data.accuracy || null;
    this.altitude = +data.altitude || null;
    this.altitudeAccuracy = +data.altitudeAccuracy || null;
    this.heading = +data.heading || null;
    this.speed = +data.speed || null;
  }

  validate() {
    return (
      Number.isFinite(this.latitude) &&
      Number.isFinite(this.longitude) &&
      this.latitude >= -90 &&
      this.latitude <= 90 &&
      this.longitude >= -180 &&
      this.longitude <= 180
    );
  }
}
