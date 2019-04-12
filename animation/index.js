require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/views/3d/externalRenderers",
  "esri/geometry/Polygon",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/layers/GeoJSONLayer",
  "esri/layers/ElevationLayer",
  "esri/geometry/Point",
  "esri/geometry/geometryEngine",
  'https://unpkg.com/mapillary-js@2.17.0/dist/mapillary.min.js',
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/103/three.js",
], (
  Map,
  SceneView,
  externalRenderers,
  Polygon,
  GraphicsLayer,
  Graphic,
  GeoJSONLayer,
  ElevationLayer,
  Point,
  geometryEngine,
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

      let mapExtent = null;
      let meshExternalRenderer = null;
      let mly = null;

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
            color: [127, 139, 179, 0.5],
            outline: {
              color: [255, 255, 255],
              width: 1
            }
          }
        }));

        // get buffer
        /*
        const bufferGeometry = geometryEngine.offset(polygon, 100, "meters"); // 9001 code for meters
        graphicsLayer.add(new Graphic({
          geometry: bufferGeometry,
          symbol: {
            type: "simple-fill", // autocasts as new SimpleFillSymbol()
            color: [0, 139, 179, 0.5],
            outline: {
              color: [255, 255, 255],
              width: 1
            }
          }
        }));
        */

        // query data from mapillary api and add to map
        const { xmin, ymin, xmax, ymax } = polygon.extent;
        const url = `${MAPILLARY_URL}?bbox=${xmin},${ymin},${xmax},${ymax}&per_page=${SEQ_TO_LOAD}&client_id=${CLIENT_ID}`;

        // add the points
        response = await fetch(url);
        const seqJson = await response.json();

        seqJson.features.forEach(feature => {
          feature.geometry.coordinates.forEach((lnglat, index) => {
            var geometry = {
              type: "point", // autocasts as new Point()
              x: lnglat[0],
              y: lnglat[1]
            };

            symbol = {
              type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
              color: [226, 119, 40],
              outline: {
                // autocasts as new SimpleLineSymbol()
                color: [255, 255, 255],
                width: 2
              }
            };

            var attributes = {
              key: feature.properties.coordinateProperties.image_keys[index],
              cas: feature.properties.coordinateProperties.cas[index]
            };

            var pointGraphic = new Graphic({ geometry, symbol, attributes });
            graphicsLayer.add(pointGraphic);
          });
        });

        const geojsonLayer = new GeoJSONLayer({
          url: url,
        });
        await geojsonLayer.load();

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

        map.add(geojsonLayer);

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