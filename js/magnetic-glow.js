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

    function renderPixelRatio() {
      var deviceScale = window.devicePixelRatio || 1;
      return Math.min(7, Math.max(5, deviceScale * 2.5));
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(renderPixelRatio());
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
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    var mesh = new THREE.Mesh(geometry, material);
    var group = new THREE.Group();
    group.rotation.set(-0.22, 0.56, -0.08);
    group.add(mesh);
    scene.add(group);
    var homeQuaternion = group.quaternion.clone();

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
    var spectrumGradient = glowContext.createLinearGradient(0, 0, 128, 128);
    spectrumGradient.addColorStop(0, "rgb(13,148,136)");
    spectrumGradient.addColorStop(0.48, "rgb(79,70,229)");
    spectrumGradient.addColorStop(1, "rgb(147,51,234)");
    glowContext.fillStyle = spectrumGradient;
    glowContext.fillRect(0, 0, 128, 128);
    var alphaGradient = glowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
    alphaGradient.addColorStop(0, "rgba(255,255,255,.2)");
    alphaGradient.addColorStop(0.32, "rgba(255,255,255,.22)");
    alphaGradient.addColorStop(0.68, "rgba(255,255,255,.1)");
    alphaGradient.addColorStop(1, "rgba(255,255,255,0)");
    glowContext.globalCompositeOperation = "destination-in";
    glowContext.fillStyle = alphaGradient;
    glowContext.fillRect(0, 0, 128, 128);
    glowContext.globalCompositeOperation = "source-over";

    var glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    var glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    var glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.position.z = -0.34;
    glowSprite.scale.set(2.4, 2.4, 1);
    scene.add(glowSprite);

    var glowTeal = new THREE.Color(0x0d9488);
    var glowIndigo = new THREE.Color(0x4f46e5);
    var glowPurple = new THREE.Color(0x9333ea);
    var glowColor = new THREE.Color();
    var screenPointer = new THREE.Vector3(0, 0, 1);
    var localPointer = new THREE.Vector3(0, 0, 1);
    var vertexDirection = new THREE.Vector3();
    var gradientDirection = new THREE.Vector3();
    var inverseQuaternion = new THREE.Quaternion();
    var dragStart = new THREE.Vector3();
    var dragCurrent = new THREE.Vector3();
    var dragStartQuaternion = new THREE.Quaternion();
    var dragDeltaQuaternion = new THREE.Quaternion();
    var springDeltaQuaternion = new THREE.Quaternion();
    var springInverseQuaternion = new THREE.Quaternion();
    var springStepQuaternion = new THREE.Quaternion();
    var rotationError = new THREE.Vector3();
    var rotationAxis = new THREE.Vector3();
    var rotationVelocity = new THREE.Vector3();
    var frameId = null;
    var lastFrameTime = performance.now();
    var explosion = 0;
    var explosionTarget = 0;
    var explosionVelocity = 0;
    var dragging = false;
    var returning = false;
    var dragPointerId = null;
    var draggedDistance = 0;
    var dragOriginX = 0;
    var dragOriginY = 0;
    var firstRender = true;

    function setGlowColor(value) {
      if (value <= 0.48) {
        glowColor.copy(glowTeal).lerp(glowIndigo, value / 0.48);
      } else {
        glowColor.copy(glowIndigo).lerp(glowPurple, (value - 0.48) / 0.52);
      }
    }

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
        var pointerFacing = Math.max(
          0,
          faceDirections[directionOffset] * localPointer.x +
            directionY * localPointer.y +
            directionZ * localPointer.z,
        );
        var cursorGlow = explosion * Math.pow(pointerFacing, 2.2);

        for (var triangle = 0; triangle < 4; triangle += 1) {
          var triangleLight = baseLight * sideBrightness[triangle];
          var surfaceGlow =
            triangle === 0
              ? Math.min(0.58, explosion * 0.08 + cursorGlow * 0.5)
              : Math.min(0.64, explosion * 0.24 + cursorGlow * 0.42);
          var triangleOffset = cell * floatsPerCell + triangle * 9;
          for (var vertex = 0; vertex < 3; vertex += 1) {
            var offset = triangleOffset + vertex * 3;
            vertexDirection.fromArray(basePositions, offset).normalize();
            gradientDirection.copy(vertexDirection).applyQuaternion(group.quaternion);
            var gradientValue = Math.min(
              1,
              Math.max(0, 0.5 + (gradientDirection.x - gradientDirection.y) * 0.35),
            );
            setGlowColor(gradientValue);
            var vertexGlow = surfaceGlow;
            if (triangle === 0) {
              var vertexFacing = Math.max(0, vertexDirection.dot(localPointer));
              vertexGlow = Math.min(
                0.58,
                explosion * 0.06 + explosion * Math.pow(vertexFacing, 2.2) * 0.52,
              );
            }
            colors[offset] = THREE.MathUtils.lerp(
              triangleLight,
              glowColor.r,
              vertexGlow,
            );
            colors[offset + 1] = THREE.MathUtils.lerp(
              triangleLight,
              glowColor.g,
              vertexGlow,
            );
            colors[offset + 2] = THREE.MathUtils.lerp(
              triangleLight,
              glowColor.b,
              vertexGlow,
            );
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

    function updateRotationSpring(frameScale) {
      if (!returning || dragging) return;

      springDeltaQuaternion
        .copy(homeQuaternion)
        .multiply(springInverseQuaternion.copy(group.quaternion).invert())
        .normalize();
      if (springDeltaQuaternion.w < 0) {
        springDeltaQuaternion.x *= -1;
        springDeltaQuaternion.y *= -1;
        springDeltaQuaternion.z *= -1;
        springDeltaQuaternion.w *= -1;
      }

      var sinHalfAngle = Math.hypot(
        springDeltaQuaternion.x,
        springDeltaQuaternion.y,
        springDeltaQuaternion.z,
      );
      var angle = 2 * Math.atan2(sinHalfAngle, Math.max(0, springDeltaQuaternion.w));

      if (sinHalfAngle > 0.000001) {
        rotationError
          .set(
            springDeltaQuaternion.x,
            springDeltaQuaternion.y,
            springDeltaQuaternion.z,
          )
          .multiplyScalar(angle / sinHalfAngle);
      } else {
        rotationError.set(0, 0, 0);
      }

      rotationVelocity.addScaledVector(rotationError, 0.075 * frameScale);
      rotationVelocity.multiplyScalar(Math.pow(0.82, frameScale));
      var speed = rotationVelocity.length();

      if (angle < 0.0008 && speed < 0.00035) {
        group.quaternion.copy(homeQuaternion);
        rotationVelocity.set(0, 0, 0);
        returning = false;
      } else if (speed > 0.000001) {
        rotationAxis.copy(rotationVelocity).multiplyScalar(1 / speed);
        springStepQuaternion.setFromAxisAngle(
          rotationAxis,
          Math.min(0.16, speed * frameScale),
        );
        group.quaternion.premultiply(springStepQuaternion).normalize();
      }

      inverseQuaternion.copy(group.quaternion).invert();
      localPointer.copy(screenPointer).applyQuaternion(inverseQuaternion).normalize();
    }

    function tick(time) {
      frameId = null;
      var frameScale = Math.min(
        2,
        Math.max(0.25, (time - lastFrameTime) / (1000 / 60)),
      );
      lastFrameTime = time;
      var delta = explosionTarget - explosion;
      explosionVelocity = (explosionVelocity + delta * 0.12) * 0.76;
      explosion += explosionVelocity;

      if (Math.abs(delta) < 0.0005 && Math.abs(explosionVelocity) < 0.0005) {
        explosion = explosionTarget;
        explosionVelocity = 0;
      }

      updateRotationSpring(frameScale);
      updatePositions(explosion);
      updateColors();
      var pulse = 0.92 + Math.sin(time * 0.0055) * 0.08;
      glowSprite.material.opacity = explosion * 0.72 * pulse;
      glowSprite.scale.setScalar(2.26 + explosion * 0.18);
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      render();

      if (explosionVelocity !== 0 || dragging || returning || explosion > 0.001) {
        invalidate();
      }
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
      returning = false;
      rotationVelocity.set(0, 0, 0);
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
      returning = true;
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
        returning = true;
        setTarget(Math.max(0.42, explosionTarget));
        invalidate();
      });
      brandLink.addEventListener("keyup", function (event) {
        if (!event.key.startsWith("Arrow")) return;
        setTarget(0);
      });
    }

    function resizeRenderer() {
      var size = Math.max(1, Math.round(container.clientWidth));
      renderer.setPixelRatio(renderPixelRatio());
      renderer.setSize(size, size, false);
      invalidate();
    }

    var resizeObserver = new ResizeObserver(resizeRenderer);
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeRenderer, { passive: true });

    var resolutionMedia;
    function watchResolution() {
      if (resolutionMedia) resolutionMedia.removeEventListener("change", handleResolutionChange);
      resolutionMedia = window.matchMedia(
        "(resolution: " + (window.devicePixelRatio || 1) + "dppx)",
      );
      resolutionMedia.addEventListener("change", handleResolutionChange, { once: true });
    }

    function handleResolutionChange() {
      resizeRenderer();
      watchResolution();
    }

    watchResolution();

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
    resizeRenderer();
    var pendingPointerX = Number(container.dataset.pendingPointerX);
    var pendingPointerY = Number(container.dataset.pendingPointerY);
    delete container.dataset.pendingPointerX;
    delete container.dataset.pendingPointerY;
    if (Number.isFinite(pendingPointerX) && Number.isFinite(pendingPointerY)) {
      updateProximity({
        clientX: pendingPointerX,
        clientY: pendingPointerY,
        pointerType: "mouse",
      });
    }
    invalidate();
  }

  document.querySelectorAll("[data-magnetic-glow]").forEach(initMagneticGlow);
})();
