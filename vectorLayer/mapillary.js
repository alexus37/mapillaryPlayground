const CLIENT_ID = 'YzhHRGF3TExNTzkxR3JBWGxZRjNXQTplOTg4MjFkOTNkYzg0ZTlk';
const MAPILLARY_URL = 'https://a.mapillary.com/v3/images';

define(function (require, exports, module) {
  function MapillaryWrapper(Mapillary, Point, meshExternalRenderer, elevationService, goToSync) {
    this.mly = new Mapillary.Viewer('mly', CLIENT_ID, null);
    this.meshExternalRenderer = meshExternalRenderer;
    this.elevationService = elevationService;
    this.goToSync = goToSync;
    this.Point = Point;
    this.position = null;
    this.nodeBearing = null;
    this.activeState = false;
    this.mlyInitalized = false;

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
      this.meshExternalRenderer && this.meshExternalRenderer.positionHistory.push({
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

      // save bearing of current node
      this.nodeBearing = node.computedCA;
      // update sceneview
      this.goToSync({
        position: this.position,
        heading: node.computedCA,
        zoom: 23.5,
        tilt: 85,
      });
    });

    this.mly.on(Mapillary.Viewer.bearingchanged, (heading) => {
      if(this.activeState) {
        console.log('MJS camera changed: Update SV');
        this.goToSync({
          position: this.position,
          heading,
          tilt: 85
        }, {
          animate: true,
          duration: 100
        });
      }
    });
    window.addEventListener("resize", function() {
      this.mly.resize();
    }.bind(this));
  }

  MapillaryWrapper.prototype.moveToKey = function(key) {
    this.mly.moveToKey(key);
  }

  MapillaryWrapper.prototype.setActive = function(activeState) {
    this.activeState = activeState;
  }

  MapillaryWrapper.prototype.setBearing = function(desiredBearing) {
    var basicX = this.bearingToBasic(desiredBearing, this.nodeBearing);
    var basicY = 0.5; // Vertical center

    var center = [basicX, basicY];

    this.mly.setCenter(center);
  }

    /**
   * Convert a desired bearing to a basic X image coordinate for
   * a specific node bearing.
   *
   * Works only for a full 360 panorama.
   */
  MapillaryWrapper.prototype.bearingToBasic = function(desiredBearing, nodeBearing) {
    // 1. Take difference of desired bearing and node bearing in degrees.
    // 2. Scale to basic coordinates.
    // 3. Add 0.5 because node bearing corresponds to the center
    //    of the image. See
    //    https://mapillary.github.io/mapillary-js/classes/viewer.html
    //    for explanation of the basic coordinate system of an image.
    var basic = (desiredBearing - nodeBearing) / 360 + 0.5;

    // Wrap to a valid basic coordinate (on the [0, 1] interval).
    // Needed when difference between desired bearing and node
    // bearing is more than 180 degrees.
    return this.wrap(basic, 0, 1);
  }

  /**
  * Wrap a value on the interval [min, max].
  */
  MapillaryWrapper.prototype.wrap = function(value, min, max) {
    var interval = (max - min);

    while (value > max || value < min) {
        if (value > max) {
            value = value - interval;
        } else if (value < min) {
            value = value + interval;
        }
    }

    return value;
  }

  MapillaryWrapper.prototype.show = function() {
    if(!this.mlyInitalized) {
      this.mlyInitalized = true;
    }
    document.getElementById('viewDiv').style.width = '50%';
    document.getElementById('viewDiv').style.left = '50%';
  }

  MapillaryWrapper.prototype.hide = function() {
      document.getElementById('viewDiv').style.width = '100%';
      document.getElementById('viewDiv').style.left = '0%';
  }


  module.exports.MapillaryWrapper = MapillaryWrapper;
});