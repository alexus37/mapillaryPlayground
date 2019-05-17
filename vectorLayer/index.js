require([
  "esri/views/3d/externalRenderers",
  "esri/geometry/Point",
  'https://unpkg.com/mapillary-js@2.18.0/dist/mapillary.min.js'
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

      const cityToId = {
        zurich: '1a87758a24724a879f5a7c17e739ab21',
        detroit: 'ed712ea37d0440ebb8536c04bb2a330a',
      };
      let id = cityToId['zurich'];
      var urlParams = new URLSearchParams(window.location.search);

      if(urlParams.has('city') && cityToId[urlParams.get('city')]) {
        id = cityToId[urlParams.get('city')];
      }

      // get the url parameters

      const esriWrapper = new EsriWrapper(id);
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