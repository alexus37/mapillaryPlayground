const CLIENT_ID = 'YzhHRGF3TExNTzkxR3JBWGxZRjNXQTowZTYyYWVmOGI0Mjg5OWFm';
const MAPILLARY_URL = 'https://a.mapillary.com/v3/sequences';

define(function (require, exports, module) {
  function MapillaryWrapper(Mapillary, Point, meshExternalRenderer, elevationService, view) {
    this.mly = new Mapillary.Viewer('mly', CLIENT_ID, null);
    this.meshExternalRenderer = meshExternalRenderer;
    this.elevationService = elevationService;
    this.view = view;
    this.Point = Point;
    this.position

    this.mly.on(Mapillary.Viewer.nodechanged, async (node) => {
      const curElevation = await this.elevationService.queryElevation(new this.Point({
        longitude: node.computedLatLon.lon,
        latitude: node.computedLatLon.lat
      }));
      const rotation = (-(node.computedCA * (Math.PI / 180))) + Math.PI;

      const pos = [
        node.computedLatLon.lon,
        node.computedLatLon.lat,
        curElevation.geometry.z
      ];

      // mapillary degrees, clockwise, zero pointing north
      // three.js radians, anticlockwise, zero pointing east
      var time = Date.now() / 1000;

      // update three.js state
      meshExternalRenderer.positionHistory.push({
        pos,
        time,
        rotation
      });

      //
      this.position = [
        node.computedLatLon.lon,
        node.computedLatLon.lat,
        curElevation.geometry.z + 4
      ];

      // update sceneview
      this.view.goTo({
        position: this.position,
        heading: node.computedCA,
        zoom: 23.5,
        tilt: 80,
      });
      this.view.
    });

    this.mly.on(Mapillary.Viewer.bearingchanged, (heading) => {
      view.goTo({
        position: this.position,
        heading,
        tilt: 80
      });
    });
  }

  MapillaryWrapper.prototype.moveToKey = function(key) {
    this.mly.moveToKey(key);
  }



  module.exports.MapillaryWrapper = MapillaryWrapper;
});