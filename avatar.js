(function () {
  const mount = document.getElementById("threeMount");
  if (!mount) {
    console.warn("avatar.js: #threeMount not found");
    return;
  }

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 3);

  // Renderer (TRANSPARENT, no shadows)
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(1, 1, false);

  // Force transparency (no black rectangle)
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);

  // Remove shadow functionality entirely
  renderer.shadowMap.enabled = false;

  mount.appendChild(renderer.domElement);

  // Lights (keep it simple & clean)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 2, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(-3, 1, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.0);
  rim.position.set(-2, 2, -3);
  scene.add(rim);

  // Resize
  function resize() {
    const w = mount.clientWidth || 1;
    const h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // Mouse follow
  let targetX = 0;
    let targetY = 0;

    function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
    }

    window.addEventListener("mousemove", (e) => {
    const nx = (e.clientX / window.innerWidth - 0.5);
    const ny = (e.clientY / window.innerHeight - 0.5);

    // smaller multipliers = less aggressive
    targetX = nx * 0.75;

    // NOT inverted: mouse up (ny negative) -> targetY negative -> head tilts up
    targetY = ny * 0.35;
    });

  const loader = new THREE.GLTFLoader();
  let helmet = null;

  loader.load(
    "assets/black_helmet.glb",
    (gltf) => {
      const pivot = new THREE.Group();
      scene.add(pivot);

      helmet = gltf.scene;
      pivot.add(helmet);

      helmet.traverse((o) => {
        if (o.isMesh) {
          // no shadows at all
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });

      // Center geometry
      let box = new THREE.Box3().setFromObject(helmet);
      const center = box.getCenter(new THREE.Vector3());
      helmet.position.sub(center);

      // Fit camera
      box = new THREE.Box3().setFromObject(helmet);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      const fov = camera.fov * (Math.PI / 180);
      const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.05;
      camera.position.set(0, 0, distance);
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      // Visual centering
      pivot.position.x = -0.25;
      pivot.position.y = -0.05;

      // Initial pose
      pivot.rotation.set(0.05, 0, 0);
      pivot.position.set(0, -0.05, 0);

      pivot.scale.setScalar(0.82);

      helmet.userData.pivot = pivot;

      resize();
    },
    undefined,
    (err) => console.error("Failed to load GLB:", err)
  );

  function animate() {
    requestAnimationFrame(animate);

    // keep clearing transparent
    renderer.setClearAlpha(0);

    if (helmet && helmet.userData.pivot) {
      const follow = 0.08; // was 0.16 (slower / smoother)

      const maxY = 0.55;   // was 1.0 (less left-right)
      const maxX = 0.30;   // was 0.65 (less up-down)

      const tx = clamp(targetX, -maxY, maxY);
      const ty = clamp(targetY, -maxX, maxX);

      const pivot = helmet.userData.pivot;
      const t = performance.now() * 0.0006;

      pivot.rotation.y += Math.sin(t) * 0.002;
      pivot.rotation.x += Math.cos(t * 0.9) * 0.0015;

      pivot.rotation.y += (tx - pivot.rotation.y) * follow;
      pivot.rotation.x += (ty - pivot.rotation.x) * follow;
    }

    renderer.render(scene, camera);
  }

  animate();
})();
