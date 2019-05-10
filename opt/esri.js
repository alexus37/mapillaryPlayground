const ELEVATION_SERVICE_URL = "https://scene.arcgis.com/arcgis/rest/services/Zurich_DTM/ImageServer";
const BUILDINGS_LAYER_ID = "1a87758a24724a879f5a7c17e739ab21";
const STUDY_AREA_URL = 'studyAreaOffice.json';

const SEQ_TO_LOAD = 1000;
const OFFSET_DISTANCE = 150; // in meters
const INITIAL_LAT = 47.389;
const INITIAL_LNG = 8.5099;
const FLY_TO_HIGHT = 550; // meters after exit the streetview
const NAV_SYMBOL = {
  type: "simple-marker",
  style: "path",
  path: "M 93.738093,28.069939 65.635025,83.619958 92.323865,67.410291 118.30877,84.928003 Z",
  angle: -20,
  size: 19,
  color: [230, 0, 0, 1]
};

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
  "esri/core/watchUtils",
  "esri/views/MapView"
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
  MapView,
) {
  exports.EsriWrapper = function() {
    // VARS
    this.mly = null;
    this.mapView = null;
    this.lookAroundMode = false;
    this.isDragging = true;
    this.center = null;
    this.screenPoint = null;
    this.scale = null;
    this.camera = null;
    this.curCamHeading = null;
    this.currentHover = null;

    // drag
    this.dragAnimationId = null;
    this.drag  = false;
    this.coordX = 0;
    this.coordY = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    // 2D Map vars
    this.viewMarkerGraphic = null;

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
          latitude: INITIAL_LAT,
          longitude: INITIAL_LNG,
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
    this.view.ui.remove('zoom');
    this.view.ui.remove('compass');
    this.view.ui.remove('navigation-toggle');

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
      const graphic = response.results.filter(result => result.graphic.layer === this.graphicsLayer)[0].graphic;

      const { key } = graphic.attributes;
      this.enterStreetView(key);
    });
  }

  exports.EsriWrapper.prototype.enterStreetView = function(key) {
    this.mly.show();
    this.lookAroundMode = true;
    this.mly.moveToKey(key);
    const elem = document.getElementById('dragImg');
    elem.setAttribute("src", "close.png");
    elem.setAttribute("draggable", "false");
    elem.setAttribute("onclick", "exitStreetview();");
    elem.removeAttribute("ondragstart");

    const twoDMap = document.getElementById('twoDMap');
    twoDMap.style.zIndex = 1;
  }

  exports.EsriWrapper.prototype.exitStreetView = function() {
    this.camera = this.view.camera.clone();
    this.mly.hide();
    this.camera.position.z = FLY_TO_HIGHT;

    this.view.goTo({
      position: this.camera.position,
      tilt: 45
    });

    this.lookAroundMode = false;
    const elem = document.getElementById('dragImg');
    elem.setAttribute("src", "drag.png");
    elem.setAttribute("draggable", "true");
    elem.setAttribute("ondragstart", "dragstart_handler(event);");
    elem.removeAttribute("onclick");

    // hide 2d map
    const twoDMap = document.getElementById('twoDMap');
    twoDMap.style.zIndex = -1;

  }

  exports.EsriWrapper.prototype.createGlobalFn = function() {
    window.dragstart_handler = function (ev) {
      console.log("dragStart");
      // Set the drag's format and data. Use the event target's id for the data
      ev.dataTransfer.setData("text/plain", ev.target.id);
      // determine event object

      if(ev.preventDefault) ev.preventDefault();

      // calculate event X, Y coordinates
      this.offsetX = ev.clientX;
      this.offsetY = ev.clientY;

      let position = 0;
      let interval =  100;
      var elem = document.createElement("div");
      elem.id = "dragContainer";
      elem.style.backgroundImage= "url('spritesheet.png')";
      if(!elem.style.left) {
        elem.style.left=`${this.offsetX - 48 }px`;
      }

      if(!elem.style.top) {
        elem.style.top=`${this.offsetY  - 48 }px`;
      }

      this.coordX = parseInt(elem.style.left);
      this.coordY = parseInt(elem.style.top);
      this.drag = true;

      document.body.appendChild(elem);

      this.dragAnimationId = setInterval( () => {
        var curElem = document.getElementById("dragContainer");
        curElem.style.backgroundPosition = `-${position}px 0px`;
        //we use the ES6 template literal to insert the variable "position"
        if (position < 3552) {
          position = position + 96;
        } else {
          position = 0;
        }
      }, interval );


      document.onmousemove=dragDiv;
    }.bind(this);


    window.dragend_handler = function (ev) {
      console.log('dragend global');
      this.nodeHitFn(ev);
    }.bind(this);

    window.exitStreetview = function () {
      console.log('exit streetview');
      this.exitStreetView();
    }.bind(this);


    document.addEventListener("mouseup", function(e) {
      if(this.drag) {
        this.drag=false;
        var ghost = document.getElementById("dragContainer");
        if (ghost.parentNode) {
          ghost.parentNode.removeChild(ghost);
          clearInterval(this.dragAnimationId);
        }
        console.log('dragend global');
        this.nodeHitFn(e);
      }
    }.bind(this), false);

    window.dragDiv = function(e) {
      if (!this.drag) {return};
      if (!e) { var e= window.event};
      // var targ=e.target?e.target:e.srcElement;
      // move div element
      var targ = document.getElementById("dragContainer");
      targ.style.left = this.coordX + e.clientX - this.offsetX + 'px';
      targ.style.top = this.coordY + e.clientY - this.offsetY + 'px';
      return false;
    }.bind(this);
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
      // prevents panning with the mouse drag event
      switch (event.action) {
        case "start":
          this.isDragging = true;
          this.center = this.view.center.clone();
          this.screenPoint = { x: event.x, y: event.y };
          this.scale = this.view.scale;
          this.camera = this.view.camera.clone();
          break;
        case "update":
          if (!this.isDragging) {
            return;
          }
          var dx = event.x - this.screenPoint.x;

          var newCenter = this.center.clone();
          newCenter.x -= dx * this.scale / 2000;
          console.log(newCenter.y);
          this.view.goTo({
            center: newCenter,
            position: this.camera.position,
            scale: this.scale,
          }, { animate: false });
          break;
        case "end":
          if (!this.isDragging) {
            return;
          }
          this.isDragging = false;
          break;
      }
      event.stopPropagation();
      }
  }

  exports.EsriWrapper.prototype.createUi = function() {
    var dropContainer = document.createElement('div');
    dropContainer.setAttribute("id", "dropContainer");
    var elem = document.createElement("img");
    elem.setAttribute("id", "dragImg");
    elem.setAttribute("src", "drag.png");
    elem.setAttribute("draggable", "true");
    elem.setAttribute("ondragstart", "dragstart_handler(event);");
    elem.setAttribute("height", "64");
    elem.setAttribute("width", "64");
    dropContainer.appendChild(elem);
    this.view.ui.add(dropContainer, "bottom-right");

    // create 2d map
    var twoDMap = document.createElement('div');
    twoDMap.setAttribute("id", "twoDMap");
    this.view.ui.add(twoDMap, 'top-right');

    const map = new Map({ basemap: "gray", ground: "world-elevation" });

    const geometry = {
      type: "point", // autocasts as new Point()
      longitude: INITIAL_LNG,
      latitude: INITIAL_LAT
    }
    this.viewMarkerGraphic = new Graphic({
      geometry,
      symbol: NAV_SYMBOL
    });

    const graphicsLayer = new GraphicsLayer();
    graphicsLayer.add(this.viewMarkerGraphic);
    map.add(graphicsLayer);

    this.mapView = new MapView({
      map,
      container: "twoDMap"  // References the ID of a DOM element
    });

    this.mapView.ui.remove('zoom');
    this.mapView.ui.remove('attribution');
    const stopPropagation = function(event) { event.stopPropagation(); };
    this.mapView.on("click", stopPropagation);
    this.mapView.on("drag", stopPropagation);
    this.mapView.on("mouse-wheel", stopPropagation);
    this.mapView.on("double-click", stopPropagation);
  }

  exports.EsriWrapper.prototype.initCallback = function () {
    console.log('Map loaded');
    console.log(this);
    this.createGlobalFn();

    // TODO: refactor => index.js add setter
    const hoverHandler = function ( mode) {
      this.currentHover = mode;
      this.mly && this.mly.setActive(mode === 'mappilary');
    }.bind(this);

    document.getElementById('viewDiv').onmouseenter = (function() {
      return hoverHandler('sceneviewer')}
    );
    document.getElementById('mly').onmouseenter = (() => hoverHandler('mappilary'));


    this.createUi();

    watchUtils.watch(this.view, "camera", (e) => {
      if(e.heading !== this.curCamHeading && this.currentHover === 'sceneviewer' && this.mly.mlyInitalized) {
        console.log('SV camera changed: Update MJS');
        this.curCamHeading = e.heading;
        this.mly.setBearing(this.curCamHeading);
      }

      // sync the map view
      this.mapView.center = e.position;
      this.mapView.zoom = 16;
      this.viewMarkerGraphic.geometry = e.position;
      this.viewMarkerGraphic.symbol = {...NAV_SYMBOL, angle:  e.heading};
    });
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
            const attributes = {
              key: feature.properties.coordinateProperties.image_keys[index],
              cas: feature.properties.coordinateProperties.cas[index]
            };
            symbol = {
              type: "point-3d",  // autocasts as new PointSymbol3D()
              symbolLayers: [{
                type: "object",  // autocasts as new ObjectSymbol3DLayer()
                width: 3,  // diameter of the object from east to west in meters
                height: 1,  // height of the object in meters
                heading: 180 + attributes.cas  ,
                depth: 4,  // diameter of the object from north to south in meters
                resource: { primitive: "tetrahedron" },
                material: { color: "red" }
              }]
            };


            var pointGraphic = new Graphic({
              geometry,
              symbol,
              attributes });
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