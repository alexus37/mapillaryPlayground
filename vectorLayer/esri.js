const ELEVATION_SERVICE_URL = "https://scene.arcgis.com/arcgis/rest/services/Zurich_DTM/ImageServer";

const SEQ_TO_LOAD = 1;
const FOV = 100;

// TODO: refactor this
const INITIAL_LAT = 47.389;
const INITIAL_LNG = 8.5099;
const FLY_TO_HIGHT = 550; // meters after exit the streetview

const VIEW_RADIUS = 100; //meters

const NAV_SYMBOL = {
  type: "simple-marker",
  style: "path",
  path: "M6493 11337 c-23 -111 -90 -431 -148 -712 -58 -280 -153 -735 -210  -1010 -57 -275 -163 -783 -235 -1130 -155 -749 -167 -806 -172 -810 -1 -1  -329 211 -727 472 -647 424 -725 473 -739 460 -13 -14 35 -92 460 -739 261  -398 475 -724 474 -725 -1 -2 -226 -49 -1211 -253 -346 -72 -823 -171 -1060  -220 -236 -49 -605 -126 -820 -170 -214 -44 -475 -99 -578 -120 -103 -22 -190  -40 -192 -40 -3 0 -5 -16 -5 -35 0 -19 2 -35 5 -35 3 0 100 -20 217 -45 117  -24 386 -80 598 -124 600 -124 1138 -236 1450 -301 1089 -227 1542 -320 1553  -320 50 -1 42 -14 -437 -745 -421 -641 -476 -729 -463 -742 13 -13 101 42 742  462 400 262 728 475 729 473 1 -2 26 -118 55 -258 28 -140 99 -480 156 -755  57 -275 140 -673 184 -885 44 -212 116 -559 160 -772 45 -214 117 -562 161  -775 44 -214 83 -396 86 -405 4 -12 16 -18 38 -18 l32 0 47 223 c25 122 128  614 227 1092 273 1316 290 1397 415 1994 63 305 117 556 118 558 2 2 326 -209  721 -467 395 -259 722 -471 728 -473 5 -1 14 5 20 13 8 12 -92 171 -462 734  -259 395 -468 722 -463 726 4 4 175 41 378 83 204 42 609 126 900 186 292 61  814 169 1160 241 347 72 807 167 1023 212 l393 82 -3 35 -3 34 -255 53 c-140  29 -538 112 -885 184 -751 156 -1504 312 -2200 457 -280 58 -512 107 -513 108  -2 2 211 331 473 730 426 649 476 729 462 742 -13 14 -92 -35 -738 -459 -583  -382 -725 -472 -731 -459 -4 9 -33 138 -63 286 -31 149 -103 495 -160 770 -57  275 -140 676 -185 890 -45 215 -128 615 -185 890 -57 275 -128 616 -157 757  l-53 258 -35 0 -35 0 -42 -203z m37 -2560 l-5 -2377 -409 409 -409 409 12 48  c6 27 58 276 115 554 96 464 184 884 471 2265 57 275 129 624 160 775 57 276  64 306 68 299 1 -2 0 -1074 -3 -2382z m1561 -922 c-328 -326 -596 -593 -597  -592 -1 1 -18 83 -39 181 -30 146 -34 181 -23 187 7 5 290 191 628 413 338  223 617 405 620 405 3 1 -262 -267 -589 -594z m-2491 -625 c0 -5 -353 -81  -356 -77 -1 1 -189 288 -418 637 l-417 635 595 -595 c328 -327 596 -597 596  -600z m2365 -174 c429 -89 656 -136 1983 -411 1304 -271 1477 -307 1481 -311  2 -2 -1073 -4 -2390 -4 l-2394 0 415 415 c265 265 420 413 430 411 8 -3 222  -48 475 -100z m-1893 -1199 l-413 -413 -392 82 c-566 118 -2273 472 -3102 644  -236 49 -439 91 -450 93 -11 3 1058 5 2375 6 l2395 1 -413 -413z m1265 -889  c-47 -227 -133 -640 -191 -918 -58 -278 -175 -842 -261 -1255 -86 -412 -182  -878 -215 -1035 -32 -157 -61 -294 -63 -305 -3 -11 -5 1053 -6 2365 l-1 2385  412 -412 411 -411 -86 -414z m959 -140 c225 -341 413 -628 418 -637 4 -9 -262  254 -593 584 -331 330 -596 601 -589 603 68 15 336 70 344 71 7 1 196 -279  420 -621z m-2616 314 c18 -89 31 -164 29 -166 -5 -5 -949 -624 -1134 -743  l-130 -85 595 596 c459 460 596 592 601 578 3 -9 21 -90 39 -180z",
  angle: 0,
  size: 50,
  color: [230, 0, 0, 1]
};

define([
  'exports',
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/layers/Layer",
  "esri/layers/ElevationLayer",
  "esri/core/watchUtils",
  "esri/views/MapView",
  "esri/layers/VectorTileLayer",
], function (
  exports,
  Map,
  SceneView,
  GraphicsLayer,
  Graphic,
  Layer,
  ElevationLayer,
  watchUtils,
  MapView,
  VectorTileLayer,
  ) {
    exports.EsriWrapper = function (buildingsLayerId) {
      // VARS
      // mapillary
      this.mly = null;
      // 2d map
      this.mapView = null;
      // streetview mode
      this.lookAroundMode = false;
      //
      this.isDragging = true;
      this.screenPoint = null;
      this.camera = null;
      this.lastCameraPosition = null;

      this.curCamHeading = null;
      // what the user is currently hovering
      this.currentHover = null;

      // drag
      this.dragAnimationId = null;
      this.drag = false;
      this.coordX = 0;
      this.coordY = 0;
      this.offsetX = 0;
      this.offsetY = 0;

      // 2D Map vars
      // compass
      this.viewMarkerGraphic = null;

      // create elevation service, map and view
      this.elevationService = new ElevationLayer({ url: ELEVATION_SERVICE_URL });
      this.map = new Map({ basemap: "gray-vector", ground: "world-elevation" });
      this.map.ground.navigationConstraint = { type: "none" };

      this.graphicsLayer = new GraphicsLayer();
      this.coverageLayer = new VectorTileLayer({
        url: "./vectorLayerConf.json",
        visible: false
      });

      this.map.add(this.graphicsLayer);
      this.map.add(this.coverageLayer);

      this.view = new SceneView({
        container: "viewDiv",
        map: this.map,
        viewingMode: "global",
        qualityProfile: "high",
        camera: {
          fov: FOV,
          heading: 0,
          tilt: 0, // looking from a bird's eye view
          position: {
            latitude: INITIAL_LAT,
            longitude: INITIAL_LNG,
            z: 10000000,
            spatialReference: {
              wkid: 3857
            }
          }
        }
      });
      this.view.environment.lighting.cameraTrackingEnabled = false;
      this.camera = this.view.camera.clone();
      this.goToSync.bind(this);

      this.view.when(this.initCallback.bind(this));

      this.view.on("click", this.nodeHitFn.bind(this));
      this.view.on("drag", this.dragHandler.bind(this));
      this.view.on("mouse-wheel", this.mouseWheelHandler.bind(this));
      this.view.on("double-click", this.mouseWheelHandler.bind(this));

      this.view.ui.remove('zoom');
      this.view.ui.remove('compass');
      this.view.ui.remove('navigation-toggle');

      // load 3d buildings
      Layer.fromPortalItem({
        portalItem: {
          id: buildingsLayerId
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
                  colorMixMode: "replace"
                },
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
          layer.when(function () {
            this.goToSync({
              heading: 0,
              tilt: 15, // looking from a bird's eye view
              position: {
                x: layer.fullExtent.center.x,
                y: layer.fullExtent.center.y,
                z: layer.fullExtent.center.z + 2500,
              }
            });
          }.bind(this))
        })
        .catch(error => console.log("Layer failed to load: ", error));
    }

    exports.EsriWrapper.prototype.setMappilary = function (mly) {
      this.mly = mly;
    }

    exports.EsriWrapper.prototype.nodeHitFn = function (event) {
      this.view.hitTest(event).then(async (hitTestResult) => {
        console.log('Node clicked', hitTestResult);
        const { latitude, longitude } = hitTestResult.ground.mapPoint;
        const url = `${MAPILLARY_URL}?closeto=${longitude},${latitude}&per_page=${SEQ_TO_LOAD}&radius=${VIEW_RADIUS}&client_id=${CLIENT_ID}`;

        // add the points
        const response = await fetch(url);
        const imgJson = await response.json();

        if (imgJson && imgJson.features && imgJson.features.length > 0) {
          const { key } = imgJson.features[0].properties;
          this.enterStreetView(key);
        }
      });
    }

    exports.EsriWrapper.prototype.goToSync = function (target, options) {
      this.view.goTo(target, options).then(() => { });
    }

    exports.EsriWrapper.prototype.enterStreetView = function (key) {
      this.lastCameraPosition = this.view.camera.clone();
      this.mly.show();
      this.lookAroundMode = true;
      this.mly.moveToKey(key);

      const elem = document.getElementById('dragImg');
      elem.setAttribute("src", "close.png");
      elem.setAttribute("draggable", "false");
      elem.setAttribute("onclick", "exitStreetview();");
      elem.removeAttribute("ondragstart");

      const twoDMap = document.getElementById('twoDMap');
      twoDMap.style.zIndex = 1000;
    }

    exports.EsriWrapper.prototype.exitStreetView = function () {
      this.mly.hide();

      this.goToSync(this.lastCameraPosition);

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

    exports.EsriWrapper.prototype.createGlobalFn = function () {
      window.dragstart_handler = function (ev) {
        console.log("dragStart");
        this.coverageLayer.visible = true;
        // Set the drag's format and data. Use the event target's id for the data
        ev.dataTransfer.setData("text/plain", ev.target.id);
        // determine event object

        if (ev.preventDefault) ev.preventDefault();

        // calculate event X, Y coordinates
        this.offsetX = ev.clientX;
        this.offsetY = ev.clientY;

        let position = 0;
        let interval = 100;
        var elem = document.createElement("div");
        elem.id = "dragContainer";
        elem.style.backgroundImage = "url('spritesheet.png')";
        if (!elem.style.left) {
          elem.style.left = `${this.offsetX - 48}px`;
        }

        if (!elem.style.top) {
          elem.style.top = `${this.offsetY - 48}px`;
        }

        this.coordX = parseInt(elem.style.left);
        this.coordY = parseInt(elem.style.top);
        this.drag = true;

        document.body.appendChild(elem);

        this.dragAnimationId = setInterval(() => {
          var curElem = document.getElementById("dragContainer");
          curElem.style.backgroundPosition = `-${position}px 0px`;
          //we use the ES6 template literal to insert the variable "position"
          if (position < 3552) {
            position = position + 96;
          } else {
            position = 0;
          }
        }, interval);

        document.onmousemove = dragDiv;
      }.bind(this);

      window.dragend_handler = function (ev) {
        console.log('dragend global');
        this.nodeHitFn(ev);
      }.bind(this);

      window.exitStreetview = function () {
        console.log('exit streetview');
        this.exitStreetView();
      }.bind(this);

      window.changeFOV = function(event) {
        console.log(event.target.value);
        const camera = this.view.camera.clone();
        camera.fov = event.target.value;
        this.view.camera = camera;
      }.bind(this)

      const exitDrag = function (e) {
        if (this.drag) {
          this.drag = false;
          var ghost = document.getElementById("dragContainer");
          if (ghost.parentNode) {
            ghost.parentNode.removeChild(ghost);
            clearInterval(this.dragAnimationId);
          }
          console.log('dragend global');

          if(e) {
            this.nodeHitFn(e);
          }
          // hide the coverage layer
          this.coverageLayer.visible = false;
        }
      }.bind(this);
      document.addEventListener("mouseup", exitDrag, false);

      window.dragDiv = function (e) {
        if (!this.drag) { return };
        if (!e) { var e = window.event };
        // var targ=e.target?e.target:e.srcElement;
        // move div element
        var targ = document.getElementById("dragContainer");
        targ.style.left = this.coordX + e.clientX - this.offsetX + 'px';
        targ.style.top = this.coordY + e.clientY - this.offsetY + 'px';
        return false;
      }.bind(this);


      document.onkeydown = function (evt) {
        evt = evt || window.event;
        var isEscape = false;
        if ("key" in evt) {
          isEscape = (evt.key === "Escape" || evt.key === "Esc");
        } else {
          isEscape = (evt.keyCode === 27);
        }
        if (isEscape) {
          if(this.drag) return exitDrag();
          if(this.lookAroundMode) return this.exitStreetView();
        }
      }.bind(this);
    }

    exports.EsriWrapper.prototype.getView = function () {
      return this.view;
    }

    exports.EsriWrapper.prototype.getElevationService = function () {
      return this.elevationService;
    }

    exports.EsriWrapper.prototype.mouseWheelHandler = function (event) {
      if (this.lookAroundMode) {
        event.stopPropagation();
      }
    }

    exports.EsriWrapper.prototype.dragHandler = function (event) {
      if (this.lookAroundMode) {
        // prevents panning with the mouse drag event
        switch (event.action) {
          case "start":
            this.isDragging = true;
            this.screenPoint = { x: event.x, y: event.y };
            this.camera = this.view.camera.clone();
            break;
          case "update":
            if (!this.isDragging) {
              return;
            }
            var dx = event.x - this.screenPoint.x;
            const heading = this.view.camera.heading - dx * 0.005;

            this.goToSync({
              heading,
              position: this.camera.position,
              scale: this.view.scale,
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

    exports.EsriWrapper.prototype.createUi = function () {
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

      var fovInput = document.createElement("input");
      fovInput.setAttribute("id", "fovInput");
      fovInput.setAttribute("type", "number");
      fovInput.setAttribute("min", "0");
      fovInput.setAttribute("max", "180");
      fovInput.setAttribute("onchange", "changeFOV(event)");
      fovInput.value = this.view.camera.fov;

      this.view.ui.add(fovInput, "top-right");

      const map = new Map({ basemap: "gray-vector" });

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
      const stopPropagation = function (event) { event.stopPropagation(); };
      this.mapView.on("click", stopPropagation);
      this.mapView.on("drag", stopPropagation);
      this.mapView.on("mouse-wheel", stopPropagation);
      this.mapView.on("double-click", stopPropagation);

    }

    exports.EsriWrapper.prototype.initCallback = function () {
      this.createGlobalFn();

      // TODO: refactor => index.js add setter
      const hoverHandler = function (mode) {
        this.currentHover = mode;
        this.mly && this.mly.setActive(mode === 'mappilary');
      }.bind(this);

      document.getElementById('viewDiv').onmouseenter = (function () {
        return hoverHandler('sceneviewer')
      }
      );
      document.getElementById('mly').onmouseenter = (() => hoverHandler('mappilary'));

      this.createUi();

      watchUtils.watch(this.view, "camera", (e) => {
        if (e.heading !== this.curCamHeading && this.currentHover === 'sceneviewer' && this.mly.mlyInitalized) {
          console.log('SV camera changed: Update MJS');
          this.curCamHeading = e.heading;
          this.mly.setBearing(this.curCamHeading);
        }

        // sync the map view
        this.mapView.center = e.position;
        this.mapView.zoom = 16;
        this.viewMarkerGraphic.geometry = e.position;
        this.viewMarkerGraphic.symbol = { ...NAV_SYMBOL };
        this.mapView.rotation = - e.heading;
      });
    }

    exports.EsriWrapper.prototype.loadData = function () {
      return new Promise(async function (resolve, reject) {
        resolve();
      }.bind(this));
    }
  });