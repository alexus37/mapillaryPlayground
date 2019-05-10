require([
  "esri/views/3d/externalRenderers",
  "esri/geometry/Point",
  'https://unpkg.com/mapillary-js@2.17.0/dist/mapillary.min.js'
], (
  externalRenderers,
  Point,
  Mapillary,
  ) => {
    require([
      './esri.js',
      './mapillary.js',
    ], (
      { EsriWrapper },
      { MapillaryWrapper },
    ) => {

      const esriWrapper = new EsriWrapper();
      const loadDataBinded = esriWrapper.loadData.bind(esriWrapper);
      let mly = null;

      loadDataBinded().then(function() {
        mly = new MapillaryWrapper(
          Mapillary,
          Point,
          null,
          esriWrapper.getElevationService(),
          esriWrapper.goToSync.bind(esriWrapper),
        );
        esriWrapper.setMappilary(mly);
        // Resize the viewer when the window is resized.
      });
    });
  }
);