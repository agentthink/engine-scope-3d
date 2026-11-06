/**
 * 参数化机械工程几何构建工具库
 * 提供法兰六角螺栓、渐开线链轮/齿圈、水滴形凸轮桃尖、三维螺旋弹簧、带孔拉伸法兰等高精度特征造型
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  /**
   * 为零部件 Group 及其全部子 Mesh 绑定 partId、原始材质备份与阴影属性
   */
  function tagPartGroup(group, partId) {
    group.name = partId;
    group.userData.partId = partId;
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.partId = partId;
        child.userData.origMat = child.material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }

  /**
   * 创建带圆法兰垫圈的六角头螺栓 Mesh (默认轴线沿 +Y 朝上，法兰底面位于 Y=0)
   */
  function createBoltMesh(headRadius = 0.065, shaftLength = 0.22, material) {
    const geometries = [];

    // 法兰垫圈
    const flange = new THREE.CylinderGeometry(headRadius * 1.28, headRadius * 1.28, headRadius * 0.28, 14);
    flange.translate(0, headRadius * 0.14, 0);
    geometries.push(flange);

    // 六角螺帽头 (radialSegments = 6 即正六边形!)
    const hex = new THREE.CylinderGeometry(headRadius, headRadius, headRadius * 0.85, 6);
    hex.translate(0, headRadius * 0.28 + headRadius * 0.425, 0);
    geometries.push(hex);

    // 螺杆 (向下伸入螺孔)
    if (shaftLength > 0.01) {
      const shaft = new THREE.CylinderGeometry(headRadius * 0.56, headRadius * 0.56, shaftLength, 10);
      shaft.translate(0, -shaftLength * 0.5, 0);
      geometries.push(shaft);
    }

    const merged = THREE.mergeGeometries(geometries, false);
    return new THREE.Mesh(merged, material);
  }

  /**
   * 创建真实齿廓链轮 / 正时齿轮 / 飞轮起动齿圈 BufferGeometry (位于 XY 平面，沿 Z 轴中心对称厚度 thickness)
   */
  function createGearGeometry({
    outerRadius = 0.6,
    rootRadius = 0.53,
    boreRadius = 0.18,
    teeth = 32,
    thickness = 0.12,
    lighteningHoles = 0,
    holeRingRadius = 0.34,
    holeRadius = 0.065
  }) {
    const shape = new THREE.Shape();
    const step = (Math.PI * 2) / teeth;

    for (let i = 0; i < teeth; i++) {
      const a0 = i * step;
      const a1 = a0 + step * 0.20;
      const a2 = a0 + step * 0.34;
      const a3 = a0 + step * 0.66;
      const a4 = a0 + step * 0.80;

      const p0x = Math.cos(a0) * rootRadius, p0y = Math.sin(a0) * rootRadius;
      const p1x = Math.cos(a1) * rootRadius, p1y = Math.sin(a1) * rootRadius;
      const p2x = Math.cos(a2) * outerRadius, p2y = Math.sin(a2) * outerRadius;
      const p3x = Math.cos(a3) * outerRadius, p3y = Math.sin(a3) * outerRadius;
      const p4x = Math.cos(a4) * rootRadius, p4y = Math.sin(a4) * rootRadius;

      if (i === 0) shape.moveTo(p0x, p0y);
      else shape.lineTo(p0x, p0y);

      shape.lineTo(p1x, p1y);
      shape.lineTo(p2x, p2y);
      shape.lineTo(p3x, p3y);
      shape.lineTo(p4x, p4y);
    }
    shape.closePath();

    if (boreRadius > 0.005) {
      const centerHole = new THREE.Path();
      centerHole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
      shape.holes.push(centerHole);
    }

    if (lighteningHoles > 0) {
      for (let k = 0; k < lighteningHoles; k++) {
        const ang = (k / lighteningHoles) * Math.PI * 2;
        const hx = Math.cos(ang) * holeRingRadius;
        const hy = Math.sin(ang) * holeRingRadius;
        const hPath = new THREE.Path();
        hPath.absarc(hx, hy, holeRadius, 0, Math.PI * 2, true);
        shape.holes.push(hPath);
      }
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: Math.min(0.014, thickness * 0.12),
      bevelSize: Math.min(0.012, (outerRadius - rootRadius) * 0.18),
      bevelSegments: 1,
      curveSegments: 8
    });
    geo.translate(0, 0, -thickness * 0.5);
    return geo;
  }

  /**
   * 创建平滑水滴形凸轮桃尖 (Cam Lobe) Geometry
   * 桃尖最高点默认朝向 +Y (0 rad)，后续可通过 geo.rotateZ(-angleFromPlusY) 定向到任意相位角
   */
  function createCamLobeGeometry(baseRadius = 0.25, lift = 0.21, thickness = 0.15, halfDurationRad = 1.08) {
    const shape = new THREE.Shape();
    const segs = 64;
    for (let i = 0; i <= segs; i++) {
      // theta 从 +Y 顺时针测量: x = r * sin(theta), y = r * cos(theta)
      const theta = (i / segs) * Math.PI * 2 - Math.PI;
      let r = baseRadius;
      if (Math.abs(theta) < halfDurationRad) {
        const u = (theta / halfDurationRad) * (Math.PI * 0.5);
        const c = Math.cos(u);
        r += lift * (c * c * (0.75 + 0.25 * c));
      }
      const x = r * Math.sin(theta);
      const y = r * Math.cos(theta);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const hole = new THREE.Path();
    hole.absarc(0, 0, baseRadius * 0.52, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 1
    });
    geo.translate(0, 0, -thickness * 0.5);
    return geo;
  }

  /**
   * 创建真实三维螺旋弹簧 BufferGeometry (底端位于 Y=0，顶端位于 Y=height，支持通过 mesh.scale.y 实时压缩)
   */
  class HelicalSpringCurve extends THREE.Curve {
    constructor(radius, height, turns) {
      super();
      this.radius = radius;
      this.height = height;
      this.turns = turns;
    }
    getPoint(t, optionalTarget = new THREE.Vector3()) {
      // 首尾各半圈收平端圈 (Dead Coils) 更加真实贴合弹簧座
      const angle = t * Math.PI * 2 * this.turns;
      let yRatio = t;
      if (t < 0.08) yRatio = t * 0.35;
      else if (t > 0.92) yRatio = 1.0 - (1.0 - t) * 0.35;
      else yRatio = 0.028 + ((t - 0.08) / 0.84) * 0.944;

      return optionalTarget.set(
        Math.cos(angle) * this.radius,
        yRatio * this.height,
        Math.sin(angle) * this.radius
      );
    }
  }

  function createHelicalSpringGeometry(radius = 0.145, wireRadius = 0.022, height = 0.62, turns = 6.5) {
    const curve = new HelicalSpringCurve(radius, height, turns);
    return new THREE.TubeGeometry(curve, 84, wireRadius, 8, false);
  }

  /**
   * 创建多楔皮带轮组件 Group (轴线沿 Z 轴，中心位于 0,0,0)
   */
  function createMultiRibPulley({
    radius = 0.42,
    width = 0.28,
    hubRadius = 0.14,
    spokeHoles = 5,
    matRim,
    matHub
  }) {
    const g = new THREE.Group();

    // 外皮带轮圈 + 两侧挡边
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 36, 1, true),
      matRim
    );
    rim.rotation.x = Math.PI * 0.5;
    g.add(rim);

    [-1, 1].forEach((side) => {
      const lip = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, width * 0.12, 36),
        matRim
      );
      lip.rotation.x = Math.PI * 0.5;
      lip.position.z = side * (width * 0.46);
      g.add(lip);
    });

    // 带减重圆孔的轮辐腹板
    const webShape = new THREE.Shape();
    webShape.absarc(0, 0, radius * 0.98, 0, Math.PI * 2, false);
    const centerHole = new THREE.Path();
    centerHole.absarc(0, 0, hubRadius * 0.55, 0, Math.PI * 2, true);
    webShape.holes.push(centerHole);

    if (spokeHoles > 0 && radius > 0.28) {
      const ringR = (radius * 0.85 + hubRadius) * 0.52;
      const hR = Math.min((radius - hubRadius) * 0.24, (Math.PI * ringR / spokeHoles) * 0.52);
      for (let i = 0; i < spokeHoles; i++) {
        const a = (i / spokeHoles) * Math.PI * 2;
        const hp = new THREE.Path();
        hp.absarc(Math.cos(a) * ringR, Math.sin(a) * ringR, hR, 0, Math.PI * 2, true);
        webShape.holes.push(hp);
      }
    }

    const webGeo = new THREE.ExtrudeGeometry(webShape, {
      depth: width * 0.32,
      bevelEnabled: false,
      curveSegments: 20
    });
    webGeo.translate(0, 0, -width * 0.16);
    g.add(new THREE.Mesh(webGeo, matHub || matRim));

    // 中心轴毂与紧固螺栓
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubRadius, hubRadius, width * 0.85, 20),
      matHub || matRim
    );
    hub.rotation.x = Math.PI * 0.5;
    g.add(hub);

    const bolt = createBoltMesh(hubRadius * 0.55, 0.05, matHub || matRim);
    bolt.rotation.x = Math.PI * 0.5;
    bolt.position.z = width * 0.42;
    g.add(bolt);

    return g;
  }

  /**
   * 计算四冲程循环角 (0 ~ 720°) 下的平滑气门升程比例 (0.0 ~ 1.0)
   * centerDeg: 开启峰值所在的局部循环角, durationDeg: 开启持续总角度
   */
  function evalCamLiftRatio(localCycleDeg, centerDeg, durationDeg) {
    let diff = ((localCycleDeg - centerDeg + 360) % 720) - 360;
    if (diff < -360) diff += 720;
    const half = durationDeg * 0.5;
    if (Math.abs(diff) >= half) return 0;
    const u = (diff / half) * (Math.PI * 0.5);
    const c = Math.cos(u);
    return c * c * (0.78 + 0.22 * c);
  }

  ns.GeoHelpers = {
    tagPartGroup,
    createBoltMesh,
    createGearGeometry,
    createCamLobeGeometry,
    createHelicalSpringGeometry,
    createMultiRibPulley,
    evalCamLiftRatio
  };
})(window.EngineApp);
