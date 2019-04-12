const CLIENT_ID = 'YzhHRGF3TExNTzkxR3JBWGxZRjNXQTowZTYyYWVmOGI0Mjg5OWFm';
const MAPILLARY_URL = 'https://a.mapillary.com/v3/sequences';

define(function (require, exports, module) {
  function MapillaryWrapper(Mapillary, Point, meshExternalRenderer, elevationService, view) {
    this.mly = new Mapillary.Viewer('mly', CLIENT_ID, null);
    this.meshExternalRenderer = meshExternalRenderer;
    this.elevationService = elevationService;
    this.view = view;
    this.Point = Point;

    this.mly.on(Mapillary.Viewer.nodechanged, async (node) => {
      const curElevation = await this.elevationService.queryElevation(new this.Point({
        longitude: node.computedLatLon.lon,
        latitude: node.computedLatLon.lat
      }));
      const roation = (-(node.computedCA * (Math.PI / 180))) + Math.PI;
      this.meshExternalRenderer.mjsRotation = roation;

      const pos = [
        node.computedLatLon.lon,
        node.computedLatLon.lat,
        curElevation.geometry.z + 4
      ];

      // mapillary degrees, clockwise, zero pointing north
      // three.js radians, anticlockwise, zero pointing east
      var time = Date.now() / 1000;

      // update three.js state
      meshExternalRenderer.positionHistory.push({
        pos,
        time,
        roation
      });

      // update sceneview
      this.view.goTo({
        center: [node.latLon.lon, node.latLon.lat],
        heading: node.computedCA,
        tilt: this.view.camera.tilt,
        zoom: this.view.camera.zoom,
      });
    });
  }

  MapillaryWrapper.prototype.moveToKey = function(key) {
    this.mly.moveToKey(key);
  }



  module.exports.MapillaryWrapper = MapillaryWrapper;
});