const ELEVATION_SERVICE_URL = "https://scene.arcgis.com/arcgis/rest/services/Zurich_DTM/ImageServer";
const BUILDINGS_LAYER_ID = "1a87758a24724a879f5a7c17e739ab21";
const STUDY_AREA_URL = 'studyAreaOffice.json';

const SEQ_TO_LOAD = 1000;
const OFFSET_DISTANCE = 150; // in meters

define([
  'exports',
  "esri/Map",
  "esri/views/SceneView",
  "esri/views/3d/externalRenderers",
  "esri/geometry/Polygon",
  "esri/geometry/Polyline",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/layers/GeoJSONLayer",
  "esri/layers/Layer",
  "esri/layers/ElevationLayer",
  "esri/geometry/Point",
  "esri/geometry/geometryEngine",
  "esri/geometry/support/webMercatorUtils",
  "esri/core/watchUtils"
], function(
  exports,
  Map,
  SceneView,
  externalRenderers,
  Polygon,
  Polyline,
  GraphicsLayer,
  Graphic,
  GeoJSONLayer,
  Layer,
  ElevationLayer,
  Point,
  geometryEngine,
  webMercatorUtils,
  watchUtils,
) {
  exports.EsriWrapper = function() {
    // VARS
    this.mly = null;
    this.lookAroundMode = true;

    // create elevation service, map and view
    this.elevationService = new ElevationLayer({ url: ELEVATION_SERVICE_URL });
    this.map = new Map({ basemap: "gray", ground: "world-elevation" });
    this.map.ground.navigationConstraint = { type: "none" };

    this.graphicsLayer = new GraphicsLayer();
    this.map.add(this.graphicsLayer);

    this.view = new SceneView({
      container: "viewDiv",
      map: this.map,
      viewingMode: "global",
      camera: {
        heading: 0,
        tilt: 45, // looking from a bird's eye view
        position: {
          latitude: 47.389,
          longitude: 8.5099,
          z: 900,
          spatialReference: {
            wkid: 3857
          }
        }
      }
    });
    this.view.environment.lighting.cameraTrackingEnabled = false;
    this.view.when(this.initCallback.bind(this));
    this.view.on("click", this.nodeHitFn.bind(this));
    this.view.on("drag", this.dragHandler.bind(this));

    // load 3d buildings
    this.layerView = null;
    Layer.fromPortalItem({
      portalItem: {
        id: BUILDINGS_LAYER_ID
      }
    })
    .then((layer) => {
      layer.popupEnabled = false;
      layer.renderer = {
        type: "simple", // autocasts as new SimpleRenderer()
        symbol: {
          type: "mesh-3d",
          symbolLayers: [{
            type: "fill",
            material: {
              color: [255, 255, 255, 0.9],
              // if buildings are textured, don't display the textures
              colorMixMode: "replace"
            },
            // set dark sketch edges
            edges: {
              type: "sketch",
              color: [0, 0, 0, 0.8],
              size: 1,
              extensionLength: 2
            }
          }]
        }
      };

      this.map.add(layer);
      this.view.whenLayerView(layer).then(function(lView) {
      // do something with the layerView
        console.log("set layer view")
        this.layerView = lView;
      });
    })
    .catch(error => console.log("Layer failed to load: ", error));
  }

  exports.EsriWrapper.prototype.setMappilary = function(mly) {
    this.mly = mly;
  }

  exports.EsriWrapper.prototype.nodeHitFn = function(event) {
    this.view.hitTest(event).then((response) => {
      console.log('Node clicked');
      // check if a feature is returned from the layer
      // do something with the result graphic
      const graphic = response.results.filter(result => result.graphic.layer === graphicsLayer)[0].graphic;

      const { key } = graphic.attributes;
      this.mly.show();
      this.mly.moveToKey(key);
    });
  }

  exports.EsriWrapper.prototype.createGlobalFn = function() {
    window.dragstart_handler = function (ev) {
      console.log("dragStart");
      // Set the drag's format and data. Use the event target's id for the data
      ev.dataTransfer.setData("text/plain", ev.target.id);
      // Create an image and use it for the drag image
      // NOTE: change "example.gif" to an existing image or the image will not
      // be created and the default drag image will be used.
      var img = new Image();
      img.src = 'drag.png';
      img.height = 42;
      img.width = 42;
      ev.dataTransfer.setDragImage(img, 32, 32);
    }
    window.dragend_handler = function (ev) {
      console.log('dragend global');
      this.nodeHitFn(ev);
    }
  }
  exports.EsriWrapper.prototype.getMapExtent = function() {
    return this.mapExtent;
  }

  exports.EsriWrapper.prototype.getView = function() {
    return this.view;
  }

  exports.EsriWrapper.prototype.getElevationService = function() {
    return this.elevationService;
  }

  exports.EsriWrapper.prototype.addExternalRenderer = function(renderer) {
    externalRenderers.add(this.view, renderer);
  }

  exports.EsriWrapper.prototype.dragHandler = function(event) {
    if(this.lookAroundMode) {
      // TODO:
      // prevents panning with the mouse drag event
      switch (event.action) {
        case "start":
          isDragging = true;
          center = view.center.clone();
          screenPoint = { x: event.x, y: event.y };
          scale = view.scale;
          camera = view.camera.clone();
          break;
        case "update":
          if (!isDragging) {
            return;
          }
          var dx = event.x - screenPoint.x;
          var dy = event.y - screenPoint.y; // tilt not possible to set in mappilary
          var newCenter = center.clone();
          //newCenter.x -= dx * scale / 2000;
          newCenter.y -= dy * scale / 2000;
          console.log(newCenter.y);
          view.goTo({
            center: newCenter,
            position: camera.position,
            scale: scale,
          }, { animate: false });
          break;
        case "end":
          if (!isDragging) {
            return;
          }
          isDragging = false;
          break;
      }
      event.stopPropagation();
      }
  }

  exports.EsriWrapper.prototype.createUi = function() {
    var dropContainer = document.createElement('div');
    dropContainer.setAttribute("id", "dropContainer");
    var elem = document.createElement("img");
    elem.setAttribute("src", "drag.png");
    elem.setAttribute("id", "dragImg");
    elem.setAttribute("draggable", "true");
    elem.setAttribute("ondragstart", "dragstart_handler(event);");
    elem.setAttribute("height", "64");
    elem.setAttribute("width", "64");
    dropContainer.appendChild(elem);
    this.view.ui.add(dropContainer, "bottom-right");

    const viewModeSwitch = document.createElement('button');
    viewModeSwitch.setAttribute("id", "viewModeSwitch");
    viewModeSwitch.innerHTML = "toggle look around";
    window.toggleCamMode = () => {
      lookAroundMode = !lookAroundMode;
      document.getElementById('viewModeSwitch').innerHTML = lookAroundMode? "deactivate look around" : "activate look around";
    }
    viewModeSwitch.setAttribute("onclick", "toggleCamMode();");
    this.view.ui.add(viewModeSwitch, "top-right");
  }

  exports.EsriWrapper.prototype.initCallback = function () {
    console.log('Map loaded');
    console.log(this);
    this.createGlobalFn();

    // TODO: refactor => index.js
    const hoverHandler = function ( mode) {
      currentHover = mode;
      this.mly && this.mly.setActive(mode === 'mappilary');
    }.bind(this);

    document.getElementById('viewDiv').onmouseenter = (function() {
      return hoverHandler('sceneviewer')}
    );
    document.getElementById('mly').onmouseenter = (() => hoverHandler('mappilary'));


    this.createUi();

    watchUtils.watch(this.view, "camera", (e) => {
      if(e.heading !== curCamHeading && currentHover === 'sceneviewer' && mlyInitalized) {
        console.log('SV camera changed: Update MJS');
        curCamHeading = e.heading;
        this.mly.setBearing(curCamHeading);
      }
    });

    // fetch some stuff
    //const loadData = this.loadData.bind(this);
    // loadData();
  }

  exports.EsriWrapper.prototype.loadData = function(){
    return new Promise(async function (resolve, reject) {
    // add the study area
    let response = await fetch(STUDY_AREA_URL)
    const data = await response.json();
    const polygon = new Polygon({
      rings: data.features[0].geometry.coordinates[0]
    });

    this.graphicsLayer.add(new Graphic({
      geometry: polygon,
      symbol: {
        type: "simple-fill", // autocasts as new SimpleFillSymbol()
        color: [127, 139, 179, 0.2],
        outline: {
          color: [255, 255, 255],
          width: 1
        }
      }
    }));

    // get buffer
    const bufferGeometry = geometryEngine.offset(
      webMercatorUtils.geographicToWebMercator(polygon),
      OFFSET_DISTANCE,
      "meters",
      'square'
    ); // 9001 code for meters
    this.graphicsLayer.add(new Graphic({
      geometry: bufferGeometry.extent,
      symbol: {
        type: "simple-fill", // autocasts as new SimpleFillSymbol()
        color: [0, 139, 179, 0.2],
        outline: {
          color: [255, 255, 255],
          width: 1
        }
      }
    }));


    // query data from mapillary api and add to map
    const { xmin: xminXY, ymin: yminXY, xmax: xmaxXY, ymax: ymaxXY } = bufferGeometry.extent;
    const [ xmin, ymin ] = webMercatorUtils.xyToLngLat(xminXY, yminXY);
    const [ xmax, ymax ] = webMercatorUtils.xyToLngLat(xmaxXY, ymaxXY);
    const url = `${MAPILLARY_URL}?bbox=${xmin},${ymin},${xmax},${ymax}&per_page=${SEQ_TO_LOAD}&client_id=${CLIENT_ID}`;

    // add the points
    response = await fetch(url);
    const seqJson = await response.json();

    seqJson.features.forEach(feature => {
      if(feature.properties.pano) {
        console.log("Pano found");
      }
      feature.geometry.coordinates.forEach((lnglat, index) => {
        var geometry = new Point({
          longitude: lnglat[0],
          latitude: lnglat[1]
        });
        if(geometryEngine.contains(
          bufferGeometry,
          webMercatorUtils.geographicToWebMercator(geometry))) {
          symbol = {
            type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
            color: [226, 119, 40],
          };

          var attributes = {
            key: feature.properties.coordinateProperties.image_keys[index],
            cas: feature.properties.coordinateProperties.cas[index]
          };

          var pointGraphic = new Graphic({ geometry, symbol, attributes });
          this.graphicsLayer.add(pointGraphic);
        }
      });

      // add the lines as poly lines
      let polyline = new Polyline({ paths: feature.geometry.coordinates});
      polyline = geometryEngine.clip(
        webMercatorUtils.geographicToWebMercator(polyline),
        bufferGeometry.extent
      );

      symbol =  {
        type: "simple-line",
        color: [226, 119, 40],
        width: 4
      };
      var polylineGraphic = new Graphic({
        geometry: polyline,
        symbol
      });

      this.graphicsLayer.add(polylineGraphic);
    });


    const geojsonLayer = new GeoJSONLayer({
      url: url,
    });
    await geojsonLayer.load();
    // map.add(geojsonLayer); do not add the geojson lay er TODO: this could be refactored


    this.mapExtent = geojsonLayer.fullExtent;
    resolve();
  }.bind(this));
}
});