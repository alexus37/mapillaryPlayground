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
      const loadDataBinded = esriWrapper.loadData.bind(esriWrapper);
      let meshExternalRenderer = null;
      let mly = null;

      loadDataBinded().then(function() {
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
    });
  }
);