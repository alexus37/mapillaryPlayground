define(function (require, exports, module) {
  function MeshRenderer(externalRenderers, view, mapExtent) {
    this.renderer = null; // three.js renderer
    this.camera = null; // three.js camera
    this.scene = null; // three.js scene
    this.externalRenderers = externalRenderers;
    this.view = view;
    this.mapExtent = mapExtent;
    this.ambient = null; // three.js ambient light source
    this.sun = null; // three.js sun light source
    this.mesh = null; // mesh model
    this.meshScale = 0.07; // scale for the mesh model
    this.meshMaterial = new THREE.MeshLambertMaterial({ color: 0xe03110 }); // material for the mesh model
    this.positionHistory = []; // all mesh positions received so far
    this.mjsPosition = [8.5099, 47.389, 500];
    this.mjsRotation = 0;
    this.originTransform = new THREE.Matrix4();
    this.originTransformInverse = new THREE.Matrix4();
    this.scaleVec = new THREE.Vector3();  // not used (placeholder to not recreate every render call)
    this.lastPosition = null;
    this.lastTime = null;
    this.mixer = null;
    this.prevTime = Date.now();
  }

  MeshRenderer.prototype.setup = function (context) {
    this.initializeRenderer(context);
    this.initializeCamera(context);
    this.initializeScene(context);

    var loader = new THREE.GLTFLoader();
    loader.load("horse.glb",
    function (gltf) {
      this.mesh = gltf.scene.children[0];
      console.log("GLB Mesh loaded.");
      console.log(this.mesh);

      this.mixer = new THREE.AnimationMixer(this.mesh);
      this.mixer.clipAction(gltf.animations[0]).setDuration(1).play();
      this.mesh.scale.set(this.meshScale, this.meshScale, this.meshScale);
      this.scene.add(this.mesh);
    }.bind(this));
    context.resetWebGLState();
  }

  MeshRenderer.prototype.initializeRenderer = function (context) {
    // initialize the three.js renderer
    //////////////////////////////////////////////////////////////////////////////////////
    this.renderer = new THREE.WebGLRenderer({
      context: context.gl,
      premultipliedAlpha: false
    });

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setViewport(0, 0, this.view.width, this.view.height);

    // prevent three.js from clearing the buffers provided by the ArcGIS JS API.
    this.renderer.autoClearDepth = false;
    this.renderer.autoClearStencil = false;
    this.renderer.autoClearColor = false;

    // The ArcGIS JS API renders to custom offscreen buffers, and not to the default framebuffers.
    // We have to inject this bit of code into the three.js runtime in order for it to bind those
    // buffers instead of the default ones.
    var originalSetRenderTarget = this.renderer.setRenderTarget.bind(
      this.renderer
    );
    this.renderer.setRenderTarget = function (target) {
      originalSetRenderTarget(target);
      if (target == null) {
        context.bindRenderTarget();
      }
    };
  },

  MeshRenderer.prototype.initializeCamera = function (context) {
    const camera = context.camera;
    this.camera = new THREE.PerspectiveCamera(camera.fovY, camera.aspect, camera.near, camera.far);
  },

  MeshRenderer.prototype.initializeScene = function (context) {
    // setup the three.js scene
    ///////////////////////////////////////////////////////////////////////////////////////
    this.scene = new THREE.Scene();

    // setup scene lighting
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
    this.scene.add(this.sun);
  },

  MeshRenderer.prototype.updateCamera = function (context) {
    const camera = context.camera;
    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(this.originTransform);

    this.camera.position.set(camera.eye[0] - origin.x, camera.eye[1] - origin.y, camera.eye[2] - origin.z);
    this.camera.up.set(camera.up[0], camera.up[1], camera.up[2]);
    this.camera.lookAt(new THREE.Vector3(camera.center[0] - origin.x, camera.center[1] - origin.y, camera.center[2] - origin.z));

    this.camera.projectionMatrix.fromArray(camera.projectionMatrix);
  },

  MeshRenderer.prototype.computeLastPosition = function () {
    if (this.positionHistory.length == 0) {
      return [0, 0, 0];
    }

    if (this.positionHistory.length == 1) {
      var entry1 = this.positionHistory[
        this.positionHistory.length - 1
      ];
      return entry1.pos;
    }

    var now = Date.now() / 1000;
    var entry1 = this.positionHistory[this.positionHistory.length - 1];

    // initialize the remembered ISS position
    if (!this.lastPosition) {
      this.lastPosition = entry1.pos;
      this.lastTime = entry1.time;
    }

    // compute a new estimated position
    var dt1 = now - entry1.time;

    // animate for one sec
    if (dt1 > 1) {
      this.lastTime = now;
      return this.lastPosition;
    }

    // compute the delta of current and newly estimated position
    var dPos = [
      entry1.pos[0] - this.lastPosition[0],
      entry1.pos[1] - this.lastPosition[1]
    ];

    // move the current position towards the estimated position
    var newPos = [
      this.lastPosition[0] + dPos[0] * dt1,
      this.lastPosition[1] + dPos[1] * dt1,
      entry1.pos[2]
    ];

    this.lastPosition = newPos;
    this.lastTime = now;

    return newPos;
  },

  MeshRenderer.prototype.updateLights = function (context) {
    // update lighting
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    this.view.environment.lighting.date = Date.now();

    var l = context.sunLight;
    this.sun.position.set(
      l.direction[0],
      l.direction[1],
      l.direction[2]
    );
    this.sun.intensity = l.diffuse.intensity;
    this.sun.color = new THREE.Color(
      l.diffuse.color[0],
      l.diffuse.color[1],
      l.diffuse.color[2]
    );

    this.ambient.intensity = l.ambient.intensity;
    this.ambient.color = new THREE.Color(
      l.ambient.color[0],
      l.ambient.color[1],
      l.ambient.color[2]
    );
  },


  MeshRenderer.prototype.render = function (context) {
    // update mesh and region position
    ///////////////////////////////////////////////////////////////////////////////////
    if (this.mesh) {
      this.updateCamera(context);
      this.updateLights(context);

      // compute the current mesh position in [lat, lng, evel]
      var posEst = this.computeLastPosition();

      // compute matrix to position
      this.originTransform.fromArray(
        this.externalRenderers.renderCoordinateTransformAt(
          this.view,
          posEst,
          this.mapExtent.center.spatialReference,
          null,
        )
      );
      // compute the inverse
      this.originTransformInverse.getInverse(this.originTransform);

      // get render coordiantes for the position
      const location = this.externalRenderers.toRenderCoordinates(
        this.view,
        posEst,
        0,
        this.mapExtent.center.spatialReference,
        [0, 0, 0],
        0,
        1
      );

      // transform to three vec, apply roations and decompose into mesh pos and rot
      const localLocation = new THREE.Vector3(location[0], location[1], location[2]);
      localLocation.applyMatrix4(this.originTransformInverse);

      const transform = this.originTransform.clone();
      const rotation = new THREE.Matrix4();

      rotation.makeRotationZ(this.mjsRotation);
      transform.multiply(rotation);

      rotation.makeRotationX(Math.PI / 2);
      transform.multiply(rotation);

      transform.decompose(this.mesh.position, this.mesh.quaternion, this.scaleVec);

      // Use location as a local origin when rendering
      this.mesh.position.set(0, 0, 0);

    }

    // draw the scene
    /////////////////////////////////////////////////////////////////////////////////////////////////////
    this.renderer.state.reset();

    if (this.mixer) {
      var time = Date.now();
      this.mixer.update((time - this.prevTime) * 0.001);
      this.prevTime = time;
    }

    this.renderer.render(this.scene, this.camera);

    // as we want to smoothly animate the mesh movement, immediately request a re-render
    this.externalRenderers.requestRender(this.view);

    // cleanup
    context.resetWebGLState();
  }
  module.exports.MeshRenderer = MeshRenderer;
});