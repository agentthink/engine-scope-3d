/**
 * 谐振进气歧管、可动蝶阀电子节气门与空滤、四合一等长排气歧管、双蜗壳废气涡轮增压器模块
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const { tagPartGroup, createBoltMesh } = ns.GeoHelpers;

  /**
   * 构造真实阿基米德变径渐开线蜗壳 (Snail Volute) BufferGeometry!
   * 从大口径切向进出口平滑渐缩盘绕 330° 包裹叶轮室
   */
  function createSnailVoluteGeometry({
    orbitStartR = 0.66,
    orbitEndR = 0.42,
    tubeStartR = 0.28,
    tubeEndR = 0.085,
    tubularSegs = 64,
    radialSegs = 20,
    mirrorX = false
  }) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const totalAngle = Math.PI * 1.88;

    for (let i = 0; i <= tubularSegs; i++) {
      const t = i / tubularSegs;
      const a = t * totalAngle;
      const orbitR = orbitStartR + (orbitEndR - orbitStartR) * t;
      const tubeR = tubeStartR + (tubeEndR - tubeStartR) * Math.pow(t, 0.85);

      const dirSign = mirrorX ? -1 : 1;
      const cx = dirSign * Math.cos(a) * orbitR;
      const cy = Math.sin(a) * orbitR;

      // 切线近似正交基: 径向向外 (cos a, sin a, 0) 与 轴向 (0, 0, 1)
      const rx = dirSign * Math.cos(a);
      const ry = Math.sin(a);

      for (let j = 0; j <= radialSegs; j++) {
        const v = (j / radialSegs) * Math.PI * 2;
        const cosV = Math.cos(v);
        const sinV = Math.sin(v);

        const nx = rx * cosV;
        const ny = ry * cosV;
        const nz = sinV;

        positions.push(cx + nx * tubeR, cy + ny * tubeR, nz * tubeR);
        normals.push(nx, ny, nz);
        uvs.push(t, j / radialSegs);
      }
    }

    const stride = radialSegs + 1;
    for (let i = 0; i < tubularSegs; i++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + (j + 1);
        const d = i * stride + (j + 1);
        if (mirrorX) {
          indices.push(a, c, b);
          indices.push(a, d, c);
        } else {
          indices.push(a, b, c);
          indices.push(a, c, d);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function buildManifoldsAndTurboParts(mats) {
    const S = ENGINE_SPEC;

    // ==================== 1. 等长四歧道谐振进气歧管与稳压腔 (intake_manifold) ====================
    const intakeGroup = new THREE.Group();
    const portX = -1.22;
    const portY = S.headBottomY + 0.56; // 3.76
    const plenumX = -2.42;
    const plenumY = 2.82;

    // 1.1 气缸盖侧 CNC 铝合金进气安装长法兰板 + 8 颗安装螺栓
    const inFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.54, 5.45),
      mats.machinedAluminum
    );
    inFlange.position.set(portX, portY, 0);
    intakeGroup.add(inFlange);

    S.cylZ.forEach((cz) => {
      [-0.36, 0.36].forEach((bz) => {
        const bolt = createBoltMesh(0.042, 0.16, mats.polishedChrome);
        bolt.rotation.z = Math.PI * 0.5;
        bolt.position.set(portX - 0.08, portY + 0.18, cz + bz);
        intakeGroup.add(bolt);
      });

      // 4 根优美向上拱起避让高压油轨的等长谐振进气弯管 (Tuned Intake Runners)
      const runnerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(portX - 0.04, portY, cz),
        new THREE.Vector3(portX - 0.42, portY + 0.46, cz * 0.96),
        new THREE.Vector3(plenumX + 0.25, plenumY + 0.72, cz * 0.86),
        new THREE.Vector3(plenumX, plenumY + 0.15, cz * 0.78)
      ]);
      const runnerMesh = new THREE.Mesh(
        new THREE.TubeGeometry(runnerCurve, 32, 0.21, 18, false),
        mats.blackPolymer
      );
      intakeGroup.add(runnerMesh);

      // 歧管强化筋环
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.024, 10, 20),
        mats.darkCastAluminum
      );
      collar.rotation.y = Math.PI * 0.5;
      collar.position.set(portX - 0.12, portY + 0.06, cz);
      intakeGroup.add(collar);
    });

    // 1.2 大容量玻纤尼龙进气稳压腔 (Intake Plenum Chamber)
    const plenumBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.44, 4.15, 28),
      mats.blackPolymer
    );
    plenumBody.rotation.x = Math.PI * 0.5;
    plenumBody.position.set(plenumX, plenumY, -0.05);
    intakeGroup.add(plenumBody);

    // 后端半球封头
    const rearCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 24, 16),
      mats.blackPolymer
    );
    rearCap.position.set(plenumX, plenumY, -2.12);
    intakeGroup.add(rearCap);

    // 前端变径节气门连接颈与方法兰
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.46, 0.45, 24),
      mats.blackPolymer
    );
    neck.rotation.x = Math.PI * 0.5;
    neck.position.set(plenumX, plenumY, 2.20);
    intakeGroup.add(neck);

    const tbMountFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.76, 0.10),
      mats.machinedAluminum
    );
    tbMountFlange.position.set(plenumX, plenumY, 2.44);
    intakeGroup.add(tbMountFlange);

    // 顶部 MAP 增压歧管绝对压力与温度传感器 (MAP/IAT Sensor)
    const mapSensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.18, 0.32),
      mats.blackPolymer
    );
    mapSensor.position.set(plenumX - 0.18, plenumY + 0.52, 0.65);
    intakeGroup.add(mapSensor);

    tagPartGroup(intakeGroup, 'intake_manifold');

    // ==================== 2. 电子节气门体(可动黄铜蝶阀)与高流量空滤 (throttle_air_filter) ====================
    const throttleGroup = new THREE.Group();
    const tbZ = 2.68;

    // 2.1 CNC 精铣铝合金节气门阀体 (中空圆膛，直接露出内部可动黄铜蝶阀!)
    const tbHousingShape = new THREE.Shape();
    tbHousingShape.moveTo(-0.38, -0.38);
    tbHousingShape.lineTo(0.38, -0.38);
    tbHousingShape.lineTo(0.38, 0.38);
    tbHousingShape.lineTo(-0.38, 0.38);
    tbHousingShape.closePath();

    const tbBoreHole = new THREE.Path();
    tbBoreHole.absarc(0, 0, 0.28, 0, Math.PI * 2, true);
    tbHousingShape.holes.push(tbBoreHole);

    const tbBodyGeo = new THREE.ExtrudeGeometry(tbHousingShape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 28
    });
    const tbBodyMesh = new THREE.Mesh(tbBodyGeo, mats.machinedAluminum);
    tbBodyMesh.position.set(plenumX, plenumY, tbZ - 0.19);
    throttleGroup.add(tbBodyMesh);

    // 4颗节气门紧固螺栓
    [[-0.29, -0.29], [0.29, -0.29], [-0.29, 0.29], [0.29, 0.29]].forEach(([bx, by]) => {
      const b = createBoltMesh(0.038, 0.20, mats.polishedChrome);
      b.rotation.x = Math.PI * 0.5;
      b.position.set(plenumX + bx, plenumY + by, tbZ + 0.21);
      throttleGroup.add(b);
    });

    // 侧面黑色电子步进直流伺服电机壳与6针电控插头
    const servoMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.56, 20),
      mats.blackPolymer
    );
    servoMotor.position.set(plenumX - 0.52, plenumY - 0.05, tbZ);
    throttleGroup.add(servoMotor);

    // 核心动态件: 精密黄铜节气门蝶阀片与转轴 (Butterfly Valve Plate)!
    const butterflyPivot = new THREE.Group();
    butterflyPivot.position.set(plenumX, plenumY, tbZ);

    const throttleShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.72, 12),
      mats.gunmetalSteel
    );
    throttleShaft.rotation.z = Math.PI * 0.5;
    butterflyPivot.add(throttleShaft);

    const brassDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.272, 0.272, 0.024, 28),
      mats.brassMetal
    );
    // 默认垂向近乎闭合 (怠速微开 10°)
    brassDisc.rotation.x = Math.PI * 0.5;
    butterflyPivot.add(brassDisc);
    throttleGroup.add(butterflyPivot);

    // 2.2 侧向弯折的进气硅胶导流管 + 高流量冬菇头锥形空滤 (向右前上方微偏，让正面也能直视节气门蝶阀开合!)
    const filterSubGroup = new THREE.Group();
    const intakePipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(plenumX, plenumY, tbZ + 0.22),
      new THREE.Vector3(plenumX - 0.18, plenumY + 0.18, tbZ + 0.62),
      new THREE.Vector3(plenumX - 0.55, plenumY + 0.42, tbZ + 0.92)
    ]);
    const siliconeHose = new THREE.Mesh(
      new THREE.TubeGeometry(intakePipeCurve, 24, 0.29, 24, false),
      mats.oilFilterBlue
    );
    filterSubGroup.add(siliconeHose);

    // 不锈钢蜗杆卡箍 (Hose Clamps)
    const clamp1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.018, 8, 28),
      mats.polishedChrome
    );
    clamp1.position.set(plenumX, plenumY, tbZ + 0.26);
    filterSubGroup.add(clamp1);

    // 高流量锥形折纸棉网冬菇头空气滤清器 (High-Flow Cone Air Filter)
    const coneFilter = new THREE.Group();
    coneFilter.position.set(plenumX - 0.78, plenumY + 0.56, tbZ + 1.24);
    coneFilter.rotation.y = -0.52;
    coneFilter.rotation.x = -0.28;

    const filterBaseRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.31, 0.12, 28),
      mats.blackPolymer
    );
    filterBaseRing.rotation.x = Math.PI * 0.5;
    coneFilter.add(filterBaseRing);

    const filterConeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.46, 0.78, 32),
      mats.airFilterMesh
    );
    filterConeMesh.rotation.x = Math.PI * 0.5;
    filterConeMesh.position.z = 0.44;
    coneFilter.add(filterConeMesh);

    const filterChromeCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.06, 28),
      mats.polishedChrome
    );
    filterChromeCap.rotation.x = Math.PI * 0.5;
    filterChromeCap.position.z = 0.84;
    coneFilter.add(filterChromeCap);

    filterSubGroup.add(coneFilter);
    throttleGroup.add(filterSubGroup);

    tagPartGroup(throttleGroup, 'throttle_air_filter');

    // ==================== 3. 四合一等长耐热不锈钢排气歧管 (exhaust_manifold) ====================
    const exhaustGroup = new THREE.Group();
    const exPortX = 1.22;
    const exPortY = S.headBottomY + 0.52; // 3.72
    const collectorPos = new THREE.Vector3(2.48, 2.74, -0.32);

    // 气缸盖侧激光切割不锈钢排气总法兰
    const exFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.48, 5.40),
      mats.exhaustStainless
    );
    exFlange.position.set(exPortX, exPortY, 0);
    exhaustGroup.add(exFlange);

    // 4 根三维盘绕等长不锈钢排气支管 (4-into-1 Equal-Length Header Tubes)
    S.cylZ.forEach((cz, idx) => {
      // 镀铜耐高温自锁排气螺母
      [-0.34, 0.34].forEach((bz) => {
        const nut = createBoltMesh(0.042, 0.14, mats.copperWinding);
        nut.rotation.z = -Math.PI * 0.5;
        nut.position.set(exPortX + 0.07, exPortY + 0.16, cz + bz);
        exhaustGroup.add(nut);
      });

      const zSpread = (idx - 1.5) * 0.14;
      const xPeak = 2.25 + (idx === 1 || idx === 2 ? 0.32 : 0.08); // 中间两缸向外多盘绕以实现等长!
      const yMid = exPortY + (idx === 0 || idx === 3 ? -0.15 : 0.22);

      const headerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(exPortX + 0.04, exPortY, cz),
        new THREE.Vector3(exPortX + 0.58, yMid, cz * 0.88),
        new THREE.Vector3(xPeak, 3.22, collectorPos.z + (cz - collectorPos.z) * 0.38),
        new THREE.Vector3(collectorPos.x + (idx % 2 === 0 ? -0.11 : 0.11), collectorPos.y + 0.12, collectorPos.z + zSpread)
      ]);
      const tubeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(headerCurve, 36, 0.185, 18, false),
        mats.exhaustStainless
      );
      exhaustGroup.add(tubeMesh);
    });

    // 底部汇流 T3 双流道涡轮安装厚法兰与4颗双头螺柱
    const t3Flange = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.12, 0.78),
      mats.exhaustStainless
    );
    t3Flange.position.copy(collectorPos);
    exhaustGroup.add(t3Flange);

    [[-0.26, -0.30], [0.26, -0.30], [-0.26, 0.30], [0.26, 0.30]].forEach(([fx, fz]) => {
      const stud = createBoltMesh(0.042, 0.16, mats.copperWinding);
      stud.position.set(collectorPos.x + fx, collectorPos.y + 0.06, collectorPos.z + fz);
      exhaustGroup.add(stud);
    });

    tagPartGroup(exhaustGroup, 'exhaust_manifold');

    // ==================== 4. 双流道废气涡轮增压器总成 (turbocharger) ====================
    const turboGroup = new THREE.Group();
    const turboCenter = new THREE.Vector3(2.48, 2.02, -0.32);

    // 4.1 后端热端高镍球铁阿基米德蜗壳 (Turbine Hot-Side Snail Housing, Z = -0.68)
    const hotZ = turboCenter.z - 0.36;
    const turbineVoluteGeo = createSnailVoluteGeometry({
      orbitStartR: 0.62,
      orbitEndR: 0.38,
      tubeStartR: 0.25,
      tubeEndR: 0.09,
      mirrorX: true
    });
    const turbineVolute = new THREE.Mesh(turbineVoluteGeo, mats.turbineCastIron);
    turbineVolute.position.set(turboCenter.x, turboCenter.y, hotZ);
    turbineVolute.rotation.z = Math.PI * 0.52;
    turboGroup.add(turbineVolute);

    // 涡轮热端中心套筒与顶部对接排气歧管的进气方喉口
    const turbineCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.38, 28),
      mats.turbineCastIron
    );
    turbineCore.rotation.x = Math.PI * 0.5;
    turbineCore.position.set(turboCenter.x, turboCenter.y, hotZ);
    turboGroup.add(turbineCore);

    const turbineInletNeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.58, 0.46),
      mats.turbineCastIron
    );
    turbineInletNeck.position.set(turboCenter.x, turboCenter.y + 0.46, hotZ + 0.14);
    turboGroup.add(turbineInletNeck);

    // 涡轮后端头段排气管 (Downpipe) + 不锈钢 V-Band 快拆抱箍 + 宽频氧传感器 (O2 Sensor)!
    const vBandClamp = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.038, 10, 32),
      mats.polishedChrome
    );
    vBandClamp.position.set(turboCenter.x, turboCenter.y, hotZ - 0.22);
    turboGroup.add(vBandClamp);

    const downpipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(turboCenter.x, turboCenter.y, hotZ - 0.24),
      new THREE.Vector3(turboCenter.x + 0.06, turboCenter.y - 0.18, hotZ - 0.88),
      new THREE.Vector3(turboCenter.x - 0.08, turboCenter.y - 0.95, hotZ - 1.38),
      new THREE.Vector3(turboCenter.x - 0.18, turboCenter.y - 1.75, hotZ - 1.62)
    ]);
    const downpipeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(downpipeCurve, 32, 0.34, 22, false),
      mats.exhaustStainless
    );
    turboGroup.add(downpipeMesh);

    const o2Sensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.38, 12),
      mats.polishedChrome
    );
    o2Sensor.rotation.z = -0.65;
    o2Sensor.position.set(turboCenter.x + 0.32, turboCenter.y + 0.08, hotZ - 0.68);
    turboGroup.add(o2Sensor);

    // 4.2 中间水冷+油冷浮动轴承芯体 (CHRA — Center Housing Rotating Assembly)
    const chra = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.48, 24),
      mats.darkCastAluminum
    );
    chra.rotation.x = Math.PI * 0.5;
    chra.position.copy(turboCenter);
    turboGroup.add(chra);

    for (let zf = -0.14; zf <= 0.15; zf += 0.09) {
      const chraFin = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.018, 8, 24),
        mats.castAluminum
      );
      chraFin.position.set(turboCenter.x, turboCenter.y, turboCenter.z + zf);
      turboGroup.add(chraFin);
    }

    // 4.3 前端冷端压铸铝阿基米德压气机蜗壳 (Compressor Cold-Side Snail Housing, Z = +0.10)
    const coldZ = turboCenter.z + 0.42;
    const compVoluteGeo = createSnailVoluteGeometry({
      orbitStartR: 0.68,
      orbitEndR: 0.42,
      tubeStartR: 0.27,
      tubeEndR: 0.095,
      mirrorX: false
    });
    const compVolute = new THREE.Mesh(compVoluteGeo, mats.castAluminum);
    compVolute.position.set(turboCenter.x, turboCenter.y, coldZ);
    compVolute.rotation.z = Math.PI * 0.38;
    turboGroup.add(compVolute);

    // 压气机切向增压出气管嘴与蓝色耐高压硅胶增压软管接口
    const chargeOutlet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.62, 22),
      mats.castAluminum
    );
    chargeOutlet.rotation.z = -0.25;
    chargeOutlet.position.set(turboCenter.x + 0.64, turboCenter.y + 0.42, coldZ);
    turboGroup.add(chargeOutlet);

    const blueChargeCoupler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.265, 0.265, 0.28, 22),
      mats.oilFilterBlue
    );
    blueChargeCoupler.rotation.z = -0.25;
    blueChargeCoupler.position.set(turboCenter.x + 0.72, turboCenter.y + 0.74, coldZ);
    turboGroup.add(blueChargeCoupler);

    // 压气机前端 CNC 车削敞口进气喇叭钟罩 (Polished Bellmouth Inlet，直接露出内部飞旋叶轮!)
    const bellmouthPts = [
      new THREE.Vector2(0.35, -0.18),
      new THREE.Vector2(0.35, 0.08),
      new THREE.Vector2(0.39, 0.18),
      new THREE.Vector2(0.49, 0.24),
      new THREE.Vector2(0.52, 0.20),
      new THREE.Vector2(0.46, -0.18),
      new THREE.Vector2(0.35, -0.18)
    ];
    const bellGeo = new THREE.LatheGeometry(bellmouthPts, 32);
    bellGeo.rotateX(Math.PI * 0.5);
    const bellMesh = new THREE.Mesh(bellGeo, mats.machinedAluminum);
    bellMesh.position.set(turboCenter.x, turboCenter.y, coldZ + 0.08);
    turboGroup.add(bellMesh);

    // 4.4 超高速旋转的 12叶片 5轴CNC锻铝压气机叶轮 (Billet Compressor Impeller Wheel)!
    const impellerRotor = new THREE.Group();
    impellerRotor.position.set(turboCenter.x, turboCenter.y, coldZ + 0.08);

    const impHub = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.28, 24),
      mats.polishedChrome
    );
    impHub.rotation.x = Math.PI * 0.5;
    impellerRotor.add(impHub);

    // 6片主叶片 + 6片分流短叶片 (6+6 Splitter Blades 真实涡轮叶轮构型!)
    for (let b = 0; b < 12; b++) {
      const isSplitter = (b % 2 === 1);
      const a = (b / 12) * Math.PI * 2;
      const bladeLen = isSplitter ? 0.25 : 0.32;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, bladeLen, isSplitter ? 0.15 : 0.22),
        mats.polishedChrome
      );
      blade.position.set(Math.cos(a) * (bladeLen * 0.52), Math.sin(a) * (bladeLen * 0.52), isSplitter ? -0.03 : 0.0);
      blade.rotation.z = a;
      blade.rotation.y = 0.52; // 后掠扭曲气动攻角!
      impellerRotor.add(blade);
    }

    // 阳极氧化蓝尖锥锁紧螺母
    const noseNut = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.14, 6),
      mats.oilFilterBlue
    );
    noseNut.rotation.x = Math.PI * 0.5;
    noseNut.position.z = 0.18;
    impellerRotor.add(noseNut);

    turboGroup.add(impellerRotor);

    // 4.5 旁通废气阀金色执行器膜片罐与推拉连杆 (Wastegate Actuator & Rod)
    const wgCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.22, 0.30, 22),
      mats.brassMetal
    );
    wgCanister.rotation.x = Math.PI * 0.5;
    wgCanister.position.set(turboCenter.x + 0.62, turboCenter.y - 0.42, coldZ - 0.10);
    turboGroup.add(wgCanister);

    const wgRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.68, 10),
      mats.polishedChrome
    );
    wgRod.rotation.x = Math.PI * 0.5;
    wgRod.rotation.z = 0.22;
    wgRod.position.set(turboCenter.x + 0.56, turboCenter.y - 0.36, turboCenter.z - 0.08);
    turboGroup.add(wgRod);

    tagPartGroup(turboGroup, 'turbocharger');

    /**
     * 每帧实时更新涡轮增压器叶轮超高速飞旋与电子节气门黄铜蝶阀开度!
     * @param {number} dt 帧间隔秒
     * @param {number} rpm 当前发动机转速
     * @param {number} throttleRatio 0.0 ~ 1.0 油门负荷比
     * @param {number} masterExplode 0.0 ~ 1.0 拆解度 (拆解时高流量空滤自动与节气门体额外分离以便看清内部蝶阀!)
     */
    let turboSpinAngle = 0;
    function updateManifoldsTurbo(dt, rpm, throttleRatio, masterExplode = 0) {
      // 压气机叶轮转速远高于曲轴 (视觉上做高速飞旋且不产生频闪倒转错觉)
      const spinSpeed = (rpm > 5) ? (4.5 + (rpm / 6000) * 52.0) : 0;
      turboSpinAngle += dt * spinSpeed;
      impellerRotor.rotation.z = -turboSpinAngle;

      // 电子节气门黄铜蝶阀随油门负荷从微开 (10°) 旋转至水平全开 (86°)
      const openAngle = 0.17 + throttleRatio * 1.32;
      butterflyPivot.rotation.x = openAngle;

      // 拆解时冬菇头空滤与节气门体产生额外子级位移，完整露出节气门腔内的黄铜蝶阀!
      const subSpread = Math.max(0, (masterExplode - 0.15) / 0.85);
      filterSubGroup.position.set(-subSpread * 0.55, subSpread * 0.25, subSpread * 0.85);
    }

    updateManifoldsTurbo(0, 0, 0, 0);

    return {
      parts: {
        intake_manifold: intakeGroup,
        throttle_air_filter: throttleGroup,
        exhaust_manifold: exhaustGroup,
        turbocharger: turboGroup
      },
      updateManifoldsTurbo
    };
  }

  ns.buildManifoldsAndTurboParts = buildManifoldsAndTurboParts;
})(window.EngineApp);
