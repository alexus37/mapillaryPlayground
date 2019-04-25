require([
  "esri/views/3d/externalRenderers",
  "esri/geometry/Point",
  'https://unpkg.com/mapillary-js@2.17.0/dist/mapillary.min.js',
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/103/three.js",
], (
  externalRenderers,
  Point,
  Mapillary,
  THREE,
  ) => {
    window.THREE = THREE;
    require([
      './esri.js',
      './externalRender.js',
      './mapillary.js',
      './GLTFLoader.js',
    ], (
      { EsriWrapper },
      { MeshRenderer },
      { MapillaryWrapper },
    ) => {

      const esriWrapper = new EsriWrapper();
      const loadData2 = esriWrapper.loadData.bind(esriWrapper);
      let meshExternalRenderer = null;
      let mly = null;

      loadData2().then(function() {
        meshExternalRenderer = new MeshRenderer(
          externalRenderers,
          esriWrapper.getView(),
          esriWrapper.getMapExtent()
        );
        mly = new MapillaryWrapper(
          Mapillary,
          Point,
          meshExternalRenderer,
          esriWrapper.getElevationService(),
          esriWrapper.getView(),
        );
        esriWrapper.setMappilary(mly);
        // Resize the viewer when the window is resized.
        window.addEventListener("resize", function() { mly.resize(); }); // TODO: fix me

        esriWrapper.addExternalRenderer(meshExternalRenderer);
      });
      return;
      console.log('Requirements loaded');
      // ============== CONSTANTS ==================== //

      const elevationService = new ElevationLayer({
        url: "https://scene.arcgis.com/arcgis/rest/services/Zurich_DTM/ImageServer"
      });
      const SEQ_TO_LOAD = 1000;
      const OFFSET_DISTANCE = 150; // in meters

      // current map extend
      let mapExtent = null;
      // the external threejs renderer
      // let meshExternalRenderer = null;
      // the mapillary object (wrapped)
      // let mly = null;
      let mlyInitalized = false;

      // which container is currently hovered
      let currentHover = null;

      // what is the current camera mode
      let lookAroundMode = false;

      // sceneview camera parameters
      let curCamHeading = 0;
      let isDragging = false;
      let center = null;
      let screenPoint = null;
      let scale = null;
      let camera = null;

      const map = new Map({
        basemap: "gray",
        ground: "world-elevation"
      });
      // allow underground nav
      map.ground.navigationConstraint = { type: "none" };

      var graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      var view = new SceneView({
        container: "viewDiv",
        map: map,
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

      Layer.fromPortalItem({
        portalItem: {
          id: "1a87758a24724a879f5a7c17e739ab21"
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

          map.add(layer);
          view.whenLayerView(layer).then(function(lView) {
          // do something with the layerView
            console.log("set layer view")
            layerView = lView;
          });
        })
        .catch(error => console.log("Layer failed to load: ", error));

      view.environment.lighting.cameraTrackingEnabled = false;

      const nodeHitFn = (event) => {
        view.hitTest(event).then(function (response) {
          console.log('Node clicked');
          // check if a feature is returned from the layer
          // do something with the result graphic
          const graphic = response.results.filter(function (result) {
            return result.graphic.layer === graphicsLayer;
          })[0].graphic;

          const { key } = graphic.attributes;
          if(!mlyInitalized) {
            mlyInitalized = true;
            lookAroundMode = true;
            document.getElementById('mly').style.width = '50%';
            document.getElementById('viewDiv').style.width = '50%';
            document.getElementById('viewDiv').style.left = '50%';

          }
          mly.moveToKey(key);
        });
      }

      view.when(() => {
        console.log('Map loaded');
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
          nodeHitFn(ev);
        }


        const hoverHandler = function ( mode) {
          currentHover = mode;
          mly && mly.setActive(mode === 'mappilary');
        };

        document.getElementById('viewDiv').onmouseenter = (function() {
          return hoverHandler('sceneviewer')}
        );
        document.getElementById('mly').onmouseenter = (() => hoverHandler('mappilary'));


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
        view.ui.add(dropContainer, "bottom-right");

        const viewModeSwitch = document.createElement('button');
        viewModeSwitch.setAttribute("id", "viewModeSwitch");
        viewModeSwitch.innerHTML = "toggle look around";
        window.toggleCamMode = () => {
          lookAroundMode = !lookAroundMode;
          document.getElementById('viewModeSwitch').innerHTML = lookAroundMode? "deactivate look around" : "activate look around";
        }
        viewModeSwitch.setAttribute("onclick", "toggleCamMode();");
        view.ui.add(viewModeSwitch, "top-right");

        view.on("click", nodeHitFn);
        view.on("drag", function(event) {
          if(lookAroundMode) {
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
        });

        watchUtils.watch(view, "camera", (e) => {
          if(e.heading !== curCamHeading && currentHover === 'sceneviewer' && mlyInitalized) {
            console.log('SV camera changed: Update MJS');
            curCamHeading = e.heading;
            mly.setBearing(curCamHeading);
          }
        });

        // fetch some stuff
        loadData();
      });

      const loadData = async () => {
        // add the study area
        let response = await fetch('studyAreaOffice.json')
        const data = await response.json();
        const polygon = new Polygon({
          rings: data.features[0].geometry.coordinates[0]
        });

        graphicsLayer.add(new Graphic({
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
        graphicsLayer.add(new Graphic({
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
              graphicsLayer.add(pointGraphic);
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

          graphicsLayer.add(polylineGraphic);
        });


        const geojsonLayer = new GeoJSONLayer({
          url: url,
        });
        await geojsonLayer.load();
        // map.add(geojsonLayer); do not add the geojson lay er TODO: this could be refactored


        mapExtent = geojsonLayer.fullExtent;


        // register the external renderer
        meshExternalRenderer = new MeshRenderer(externalRenderers, view, mapExtent);
        mly = new MapillaryWrapper(
          Mapillary,
          Point,
          meshExternalRenderer,
          elevationService,
          view
        );
        // Resize the viewer when the window is resized.
        window.addEventListener("resize", function() { mly.resize(); }); // TODO: fix me

        externalRenderers.add(view, meshExternalRenderer);
      };
    });
  }
);