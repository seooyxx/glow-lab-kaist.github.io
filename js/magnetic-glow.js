(function () {
  "use strict";

  if (!window.THREE) return;

  var THREE = window.THREE;

  function initMagneticGlow(container) {
    var brandLink = container.closest("[data-brand-link]");
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.z = 5.2;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (_error) {
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 4));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    canvas.tabIndex = -1;
    canvas.addEventListener(
      "webglcontextlost",
      function (event) {
        event.preventDefault();
        container.classList.remove("is-enhanced");
      },
      false,
    );
    canvas.addEventListener(
      "webglcontextrestored",
      function () {
        invalidate();
      },
      false,
    );
    container.appendChild(canvas);

    var source = new THREE.IcosahedronGeometry(1, 0);
    var surface = source.index ? source.toNonIndexed() : source;
    var sourcePositions = surface.getAttribute("position").array;
    var faceCount = sourcePositions.length / 9;
    var floatsPerCell = 36;
    var tetrahedronPositions = new Float32Array(faceCount * floatsPerCell);
    var faceDirections = new Float32Array(faceCount * 3);
    var faceVariation = new Float32Array(faceCount);
    var sideBrightness = [1, 0.72, 0.84, 0.62];

    var pointA = new THREE.Vector3();
    var pointB = new THREE.Vector3();
    var pointC = new THREE.Vector3();
    var edge = new THREE.Vector3();
    var normal = new THREE.Vector3();
    var center = new THREE.Vector3();
    var cellCenter = new THREE.Vector3();
    var sideCenter = new THREE.Vector3();
    var sideNormal = new THREE.Vector3();

    function writeTriangle(offset, a, b, c, tetraCenter) {
      sideCenter.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      sideNormal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      var outward = sideNormal.dot(new THREE.Vector3().subVectors(sideCenter, tetraCenter)) >= 0;
      var points = outward ? [a, b, c] : [a, c, b];

      points.forEach(function (point, index) {
        var vertexOffset = offset + index * 3;
        tetrahedronPositions[vertexOffset] = point.x;
        tetrahedronPositions[vertexOffset + 1] = point.y;
        tetrahedronPositions[vertexOffset + 2] = point.z;
      });
    }

    for (var face = 0; face < faceCount; face += 1) {
      var sourceOffset = face * 9;
      pointA.fromArray(sourcePositions, sourceOffset);
      pointB.fromArray(sourcePositions, sourceOffset + 3);
      pointC.fromArray(sourcePositions, sourceOffset + 6);
      center.copy(pointA).add(pointB).add(pointC).multiplyScalar(1 / 3);
      normal.subVectors(pointB, pointA).cross(edge.subVectors(pointC, pointA)).normalize();
      if (normal.dot(center) < 0) normal.negate();

      var averageEdge =
        (pointA.distanceTo(pointB) + pointB.distanceTo(pointC) + pointC.distanceTo(pointA)) / 3;
      var apex = center.clone().addScaledVector(normal, -averageEdge * Math.sqrt(2 / 3));
      cellCenter.copy(pointA).add(pointB).add(pointC).add(apex).multiplyScalar(0.25);

      var cellOffset = face * floatsPerCell;
      writeTriangle(cellOffset, pointA, pointB, pointC, cellCenter);
      writeTriangle(cellOffset + 9, pointA, apex, pointB, cellCenter);
      writeTriangle(cellOffset + 18, pointB, apex, pointC, cellCenter);
      writeTriangle(cellOffset + 27, pointC, apex, pointA, cellCenter);

      var direction = center.clone().normalize();
      faceDirections[face * 3] = direction.x;
      faceDirections[face * 3 + 1] = direction.y;
      faceDirections[face * 3 + 2] = direction.z;
      faceVariation[face] = Math.abs(
        (Math.sin((face + 1) * 12.9898) * 43758.5453) % 1,
      );
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(tetrahedronPositions, 3));
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(tetrahedronPositions.length), 3),
    );
    geometry.computeVertexNormals();
    if (surface !== source) surface.dispose();
    source.dispose();

    var positionAttribute = geometry.getAttribute("position");
    var basePositions = new Float32Array(positionAttribute.array);
    var colorAttribute = geometry.getAttribute("color");
    var material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      flatShading: true,
      shininess: 24,
      specular: 0x242424,
      side: THREE.DoubleSide,
      emissive: 0x006d7d,
      emissiveIntensity: 0,
    });
    var mesh = new THREE.Mesh(geometry, material);
    var group = new THREE.Group();
    group.rotation.set(-0.22, 0.56, -0.08);
    group.add(mesh);
    scene.add(group);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.35));
    var keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(-3.5, 4.5, 5);
    scene.add(keyLight);
    var fillLight = new THREE.DirectionalLight(0xbfd8ff, 0.7);
    fillLight.position.set(4, -2, 3);
    scene.add(fillLight);

    var glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    var glowContext = glowCanvas.getContext("2d");
    var gradient = glowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(255,255,255,.72)");
    gradient.addColorStop(0.52, "rgba(255,255,255,.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 128, 128);

    var glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    var glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    var glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.position.z = -0.28;
    glowSprite.scale.set(2.5, 2.5, 1);
    scene.add(glowSprite);
    var innerCore = new THREE.Sprite(glowMaterial.clone());
    innerCore.material.depthTest = false;
    innerCore.position.z = -0.12;
    innerCore.scale.set(0.72, 0.72, 1);
    innerCore.renderOrder = 4;
    scene.add(innerCore);

    var screenPointer = new THREE.Vector3(0, 0, 1);
    var localPointer = new THREE.Vector3(0, 0, 1);
    var inverseQuaternion = new THREE.Quaternion();
    var dragStart = new THREE.Vector3();
    var dragCurrent = new THREE.Vector3();
    var dragStartQuaternion = new THREE.Quaternion();
    var dragDeltaQuaternion = new THREE.Quaternion();
    var frameId = null;
    var explosion = 0;
    var explosionTarget = 0;
    var explosionVelocity = 0;
    var dragging = false;
    var dragPointerId = null;
    var draggedDistance = 0;
    var dragOriginX = 0;
    var dragOriginY = 0;
    var firstRender = true;

    function updateColors() {
      var colors = colorAttribute.array;

      for (var cell = 0; cell < faceCount; cell += 1) {
        var directionOffset = cell * 3;
        var directionY = faceDirections[directionOffset + 1];
        var directionZ = faceDirections[directionOffset + 2];
        var light =
          0.52 +
          directionY * 0.12 +
          directionZ * 0.2 +
          faceVariation[cell] * 0.14;
        var baseLight = Math.min(0.82, Math.max(0.28, light));

        for (var triangle = 0; triangle < 4; triangle += 1) {
          var triangleLight = baseLight * sideBrightness[triangle];
          var triangleOffset = cell * floatsPerCell + triangle * 9;
          for (var vertex = 0; vertex < 3; vertex += 1) {
            var offset = triangleOffset + vertex * 3;
            colors[offset] = triangleLight;
            colors[offset + 1] = triangleLight;
            colors[offset + 2] = triangleLight;
          }
        }
      }
      colorAttribute.needsUpdate = true;
    }

    function updatePositions(amount) {
      var positions = positionAttribute.array;

      for (var cell = 0; cell < faceCount; cell += 1) {
        var directionOffset = cell * 3;
        var directionX = faceDirections[directionOffset];
        var directionY = faceDirections[directionOffset + 1];
        var directionZ = faceDirections[directionOffset + 2];
        var pointerDot = Math.min(
          1,
          Math.max(
            -1,
            directionX * localPointer.x +
              directionY * localPointer.y +
              directionZ * localPointer.z,
          ),
        );
        var attraction = Math.pow(Math.max(0, pointerDot), 3);
        var distance = amount * (0.06 + attraction * 0.405);
        var tangentAmount = amount * attraction * 0.11;
        var tangentX = localPointer.x - directionX * pointerDot;
        var tangentY = localPointer.y - directionY * pointerDot;
        var tangentZ = localPointer.z - directionZ * pointerDot;
        var dx = directionX * distance + tangentX * tangentAmount;
        var dy = directionY * distance + tangentY * tangentAmount;
        var dz = directionZ * distance + tangentZ * tangentAmount;
        var cellOffset = cell * floatsPerCell;

        for (var vertex = 0; vertex < 12; vertex += 1) {
          var offset = cellOffset + vertex * 3;
          positions[offset] = basePositions[offset] + dx;
          positions[offset + 1] = basePositions[offset + 1] + dy;
          positions[offset + 2] = basePositions[offset + 2] + dz;
        }
      }

      positionAttribute.needsUpdate = true;
    }

    function render() {
      renderer.render(scene, camera);
      if (firstRender) {
        firstRender = false;
        container.classList.add("is-enhanced");
      }
    }

    function invalidate() {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(tick);
    }

    function tick(time) {
      frameId = null;
      var delta = explosionTarget - explosion;
      explosionVelocity = (explosionVelocity + delta * 0.12) * 0.76;
      explosion += explosionVelocity;

      if (Math.abs(delta) < 0.0005 && Math.abs(explosionVelocity) < 0.0005) {
        explosion = explosionTarget;
        explosionVelocity = 0;
      }

      updatePositions(explosion);
      updateColors();
      var pulse = 0.88 + Math.sin(time * 0.006) * 0.12;
      glowSprite.material.opacity = explosion * 0.68 * pulse;
      glowSprite.scale.setScalar(2.35 + explosion * 0.5);
      innerCore.material.opacity = explosion * 0.78 * pulse;
      innerCore.scale.setScalar(0.62 + explosion * 0.2);
      glowSprite.material.color.set(0xffffff);
      innerCore.material.color.set(0xffffff);
      material.emissive.set(0x555555);
      material.emissiveIntensity = explosion * 0.72 * pulse;
      render();

      if (explosionVelocity !== 0 || dragging || explosion > 0.001) invalidate();
    }

    function setTarget(value) {
      var next = Math.min(1, Math.max(0, value));
      if (Math.abs(next - explosionTarget) < 0.002) return;
      explosionTarget = next;
      invalidate();
    }

    function updatePointerDirection(event, bounds) {
      var x = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
      var y = (bounds.top + bounds.height / 2 - event.clientY) / (bounds.height / 2);
      var lengthSquared = x * x + y * y;
      var z = 0;

      if (lengthSquared > 1) {
        var inverseLength = 1 / Math.sqrt(lengthSquared);
        x *= inverseLength;
        y *= inverseLength;
      } else {
        z = Math.sqrt(1 - lengthSquared);
      }

      screenPointer.set(x, y, z).normalize();
      inverseQuaternion.copy(group.quaternion).invert();
      localPointer.copy(screenPointer).applyQuaternion(inverseQuaternion).normalize();
    }

    function updateProximity(event) {
      if (event.pointerType === "touch") {
        if (!dragging) setTarget(0);
        return;
      }
      var bounds = container.getBoundingClientRect();
      updatePointerDirection(event, bounds);
      var centerX = bounds.left + bounds.width / 2;
      var centerY = bounds.top + bounds.height / 2;
      var distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
      var radius = Math.max(bounds.width, bounds.height) * 0.82;
      var proximity = Math.min(1, Math.max(0, 1 - distance / radius));
      var eased = proximity * proximity * (3 - 2 * proximity);
      setTarget(dragging ? Math.max(0.72, eased) : eased);
    }

    function projectArcball(event, target) {
      var bounds = canvas.getBoundingClientRect();
      var x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      var y = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
      var lengthSquared = x * x + y * y;

      if (lengthSquared > 1) {
        var inverseLength = 1 / Math.sqrt(lengthSquared);
        target.set(x * inverseLength, y * inverseLength, 0);
      } else {
        target.set(x, y, Math.sqrt(1 - lengthSquared));
      }
    }

    canvas.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      dragging = true;
      dragPointerId = event.pointerId;
      draggedDistance = 0;
      dragOriginX = event.clientX;
      dragOriginY = event.clientY;
      container.dataset.dragging = "true";
      canvas.setPointerCapture(event.pointerId);
      updatePointerDirection(event, container.getBoundingClientRect());
      projectArcball(event, dragStart);
      dragStartQuaternion.copy(group.quaternion);
      setTarget(Math.max(0.72, explosionTarget));
      if (brandLink) brandLink.focus({ preventScroll: true });
      invalidate();
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!dragging || event.pointerId !== dragPointerId) return;
      draggedDistance = Math.max(
        draggedDistance,
        Math.hypot(event.clientX - dragOriginX, event.clientY - dragOriginY),
      );
      projectArcball(event, dragCurrent);
      dragDeltaQuaternion.setFromUnitVectors(dragStart, dragCurrent);
      group.quaternion.copy(dragDeltaQuaternion).multiply(dragStartQuaternion).normalize();
      inverseQuaternion.copy(group.quaternion).invert();
      localPointer.copy(screenPointer).applyQuaternion(inverseQuaternion).normalize();
      invalidate();
    });

    function endDrag(event) {
      if (!dragging || event.pointerId !== dragPointerId) return;
      dragging = false;
      dragPointerId = null;
      container.dataset.dragging = "false";
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      updateProximity(event);
      invalidate();
    }

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointermove", updateProximity, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () {
      setTarget(0);
    });

    if (brandLink) {
      brandLink.addEventListener("click", function (event) {
        if (draggedDistance > 5) {
          event.preventDefault();
          draggedDistance = 0;
        }
      });
      brandLink.addEventListener("keydown", function (event) {
        var rotations = {
          ArrowLeft: [0, -0.12],
          ArrowRight: [0, 0.12],
          ArrowUp: [-0.12, 0],
          ArrowDown: [0.12, 0],
        };
        var rotation = rotations[event.key];
        if (!rotation) return;
        event.preventDefault();
        var delta = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rotation[0], rotation[1], 0, "XYZ"),
        );
        group.quaternion.premultiply(delta).normalize();
        setTarget(Math.max(0.42, explosionTarget));
        invalidate();
      });
    }

    var resizeObserver = new ResizeObserver(function () {
      var size = Math.max(1, Math.round(container.clientWidth));
      renderer.setSize(size, size, false);
      invalidate();
    });
    resizeObserver.observe(container);

    var themeObserver = new MutationObserver(function () {
      updateColors();
      invalidate();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    updatePositions(0);
    updateColors();
    container.dataset.faceCountActual = String(faceCount);
    container.dataset.cellType = "tetrahedron";
    container.dataset.verticesPerCell = "12";
    container.dataset.variantActual = "magnetic-glow";
    invalidate();
  }

  document.querySelectorAll("[data-magnetic-glow]").forEach(initMagneticGlow);
})();
