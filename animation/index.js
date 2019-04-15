require([
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
  'https://unpkg.com/mapillary-js@2.17.0/dist/mapillary.min.js',
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/103/three.js",
], (
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
  Mapillary,
  THREE,
  ) => {
    window.THREE = THREE;
    require([
      './externalRender.js',
      './mapillary.js',
      './GLTFLoader.js'
    ], (
      { MeshRenderer },
      { MapillaryWrapper }
    ) => {
      console.log('Requirements loaded');
      // ============== CONSTANTS ==================== //

      const elevationService = new ElevationLayer({
        url: "https://scene.arcgis.com/arcgis/rest/services/Zurich_DTM/ImageServer"
      });
      const SEQ_TO_LOAD = 1000;
      const OFFSET_DISTANCE = 150; // in meters

      let mapExtent = null;
      let meshExternalRenderer = null;
      let mly = null;
      let layerView = null;

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

      view.when(() => {
        console.log('Map loaded');
        var mapillaryContainer = document.createElement('div');
        mapillaryContainer.setAttribute("id", "mly");
        view.ui.add(mapillaryContainer, "bottom-left");

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

        view.on("click", function (event) {
          view.hitTest(event).then(function (response) {
            console.log('Node clicked');
            // check if a feature is returned from the layer
            // do something with the result graphic
            const graphic = response.results.filter(function (result) {
              return result.graphic.layer === graphicsLayer;
            })[0].graphic;

            const { key } = graphic.attributes;
            mly.moveToKey(key);
          });
        });


        // register the external renderer
        meshExternalRenderer = new MeshRenderer(externalRenderers, view, mapExtent);
        mly = new MapillaryWrapper(
          Mapillary,
          Point,
          meshExternalRenderer,
          elevationService,
          view
        );
        externalRenderers.add(view, meshExternalRenderer);
      };
    });
  }
);