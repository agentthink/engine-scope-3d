/**
 * 外围附件、点火直喷、正时链条轮系、前端多楔带FEAD与润滑油底壳总成模块
 * 共构建 14 个独立可拆解高精度机械总成，并支持链节循环运动与按真实轮径比同步旋转
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const { tagPartGroup, createBoltMesh, createGearGeometry, createMultiRibPulley } = ns.GeoHelpers;

  function buildPeripheralParts(mats, textures) {
    const S = ENGINE_SPEC;

    // ==================== 1. 高性能红头独立点火线圈组 (ignition_coils ×4) ====================
    const coilsGroup = new THREE.Group();
    const coilTopY = S.headTopY + 0.82;

    S.cylZ.forEach((cz) => {
      const cUnit = new THREE.Group();
      cUnit.position.set(0, coilTopY, cz);

      // 细长耐高压黑色绝缘硅胶护套杆 (伸入火花塞井孔)
      const boot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.135, 1.48, 20),
        mats.blackPolymer
      );
      boot.position.y = -0.70;
      cUnit.add(boot);

      // 顶部经典性能车红头变压器方壳
      const headBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.24, 0.44),
        mats.redWrinkle
      );
      headBox.position.y = 0.12;
      cUnit.add(headBox);

      // 侧面 4 针线束插接器卡座与固定耳螺栓
      const plug = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.15, 0.22),
        mats.blackPolymer
      );
      plug.position.set(-0.32, 0.11, 0);
      cUnit.add(plug);

      const earBolt = createBoltMesh(0.042, 0.18, mats.polishedChrome);
      earBolt.position.set(0.26, 0.14, 0.18);
      cUnit.add(earBolt);

      coilsGroup.add(cUnit);
    });

    // 纵向主点火线束导轨槽 (Wiring Harness Conduit)
    const harnessRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.16, 5.15),
      mats.blackPolymer
    );
    harnessRail.position.set(-0.52, coilTopY + 0.11, 0);
    coilsGroup.add(harnessRail);

    tagPartGroup(coilsGroup, 'ignition_coils');

    // ==================== 2. 激光双铱金火花塞组 (spark_plugs ×4) ====================
    const plugsGroup = new THREE.Group();

    S.cylZ.forEach((cz) => {
      const sp = new THREE.Group();
      // 电极尖端位于燃烧室屋脊中心 Y = 3.36
      sp.position.set(0, 3.36, cz);

      // 白色高纯氧化铝陶瓷绝缘体 + 5道防闪络波纹棱环
      const ceramic = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.088, 0.56, 20),
        mats.ceramicWhite
      );
      ceramic.position.y = 0.66;
      sp.add(ceramic);

      for (let r = 0; r < 4; r++) {
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.086, 0.012, 8, 18),
          mats.ceramicWhite
        );
        rib.rotation.x = Math.PI * 0.5;
        rib.position.y = 0.56 + r * 0.065;
        sp.add(rib);
      }

      // 顶端金属接线螺帽
      const terminal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.045, 0.14, 14),
        mats.polishedChrome
      );
      terminal.position.y = 1.00;
      sp.add(terminal);

      // 中部六角扳手拧紧螺壳 (Hex Shell)
      const hexShell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.22, 6),
        mats.polishedChrome
      );
      hexShell.position.y = 0.34;
      sp.add(hexShell);

      // 下部旋入气缸盖的外螺纹段
      const threadShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.092, 0.092, 0.24, 18),
        mats.gunmetalSteel
      );
      threadShaft.position.y = 0.12;
      sp.add(threadShaft);

      // 中心超细铱金电极针 + J形弯曲接地侧电极!
      const centerElectrode = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.008, 0.06, 10),
        mats.polishedChrome
      );
      centerElectrode.position.y = -0.025;
      sp.add(centerElectrode);

      const groundStrapV = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.075, 0.025),
        mats.gunmetalSteel
      );
      groundStrapV.position.set(0.065, -0.035, 0);
      sp.add(groundStrapV);

      const groundStrapH = new THREE.Mesh(
        new THREE.BoxGeometry(0.082, 0.018, 0.025),
        mats.gunmetalSteel
      );
      groundStrapH.position.set(0.032, -0.072, 0);
      sp.add(groundStrapH);

      plugsGroup.add(sp);
    });

    tagPartGroup(plugsGroup, 'spark_plugs');

    // ==================== 3. 350Bar 高压燃油共轨与GDI喷油器 (fuel_rail_injectors) ====================
    const fuelRailGroup = new THREE.Group();
    const railX = -1.32;
    const railY = 3.55;

    // 316L 锻造不锈钢高压共轨主管
    const mainRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 5.25, 24),
      mats.polishedChrome
    );
    mainRail.rotation.x = Math.PI * 0.5;
    mainRail.position.set(railX, railY, 0);
    fuelRailGroup.add(mainRail);

    // 前端 350Bar 共轨油压传感器 (Rail Pressure Sensor)
    const railSensor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.36, 6),
      mats.brassMetal
    );
    railSensor.rotation.x = Math.PI * 0.5;
    railSensor.position.set(railX, railY, 2.78);
    fuelRailGroup.add(railSensor);

    const sensorPlug = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.24),
      mats.blackPolymer
    );
    sensorPlug.position.set(railX, railY, 3.02);
    fuelRailGroup.add(sensorPlug);

    // 4 支侧置斜插式压电高速直喷喷油器 (GDI Injectors)
    S.cylZ.forEach((cz) => {
      const inj = new THREE.Group();
      inj.position.set(railX, railY, cz);
      inj.rotation.z = -0.78; // 呈 ~45° 斜插入气缸燃烧室侧壁!

      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.095, 0.22, 16),
        mats.machinedAluminum
      );
      inj.add(cup);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.068, 0.42, 16),
        mats.oilFilterBlue
      );
      body.position.y = -0.26;
      inj.add(body);

      // 伸入燃烧室的超细不锈钢6孔喷嘴头 + 聚四氟乙烯白色燃烧密封环
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.032, 0.34, 14),
        mats.polishedChrome
      );
      nozzle.position.y = -0.58;
      inj.add(nozzle);

      const teflonSeal = new THREE.Mesh(
        new THREE.TorusGeometry(0.038, 0.010, 8, 16),
        mats.ceramicWhite
      );
      teflonSeal.rotation.x = Math.PI * 0.5;
      teflonSeal.position.y = -0.68;
      inj.add(teflonSeal);

      fuelRailGroup.add(inj);
    });

    tagPartGroup(fuelRailGroup, 'fuel_rail_injectors');

    // ==================== 4. 凸轮驱动高压燃油泵 (hpfp_pump) ====================
    const hpfpGroup = new THREE.Group();
    hpfpGroup.position.set(S.exhaustCamX, S.headTopY + 0.72, -2.68);

    const pumpBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.24, 0.52, 24),
      mats.machinedAluminum
    );
    hpfpGroup.add(pumpBody);

    // 顶部圆形膜片脉动阻尼器盖 (Pulsation Damper)
    const damperDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.14, 28),
      mats.polishedChrome
    );
    damperDome.position.y = 0.32;
    hpfpGroup.add(damperDome);

    // 底部伸向排气凸轮轴四方桃尖的淬火柱塞与回位弹簧
    const plunger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.48, 18),
      mats.gunmetalSteel
    );
    plunger.position.y = -0.38;
    hpfpGroup.add(plunger);

    // 侧面数字溢流计量电磁阀插头
    const solenoid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.38, 16),
      mats.blackPolymer
    );
    solenoid.rotation.z = Math.PI * 0.5;
    solenoid.position.set(0.32, 0.06, 0);
    hpfpGroup.add(solenoid);

    // 高压不锈钢输油硬管弯头 (通向进气侧共轨)
    const hpPipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.22, 0.05, 0),
      new THREE.Vector3(-0.95, 0.22, -0.35),
      new THREE.Vector3(-1.88, -0.85, -0.25),
      new THREE.Vector3(railX - S.exhaustCamX, railY - (S.headTopY + 0.72), 0.12)
    ]);
    const hpPipe = new THREE.Mesh(
      new THREE.TubeGeometry(hpPipeCurve, 28, 0.036, 10, false),
      mats.polishedChrome
    );
    hpfpGroup.add(hpPipe);

    tagPartGroup(hpfpGroup, 'hpfp_pump');

    // ==================== 5. 进排气双 VVT 可变气门正时相位调节器 (vvt_phasers ×2) ====================
    const vvtGroup = new THREE.Group();
    const vvtRotors = [];

    // 42齿正时链轮 (与曲轴21齿链轮精确形成 2:1 齿数比!)
    const vvtGearGeo = createGearGeometry({
      outerRadius: 0.54,
      rootRadius: 0.485,
      boreRadius: 0.14,
      teeth: 42,
      thickness: 0.13
    });

    [S.intakeCamX, S.exhaustCamX].forEach((cx) => {
      const phaserRotor = new THREE.Group();
      phaserRotor.position.set(cx, S.camY, S.timingChainZ);

      // 外齿圈
      phaserRotor.add(new THREE.Mesh(vvtGearGeo, mats.gunmetalSteel));

      // 内部液压叶片调节腔圆柱壳 + 黄铜端盖细节
      const chamber = new THREE.Mesh(
        new THREE.CylinderGeometry(0.41, 0.41, 0.24, 28),
        mats.darkCastAluminum
      );
      chamber.rotation.x = Math.PI * 0.5;
      chamber.position.z = 0.06;
      phaserRotor.add(chamber);

      const frontPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.04, 24),
        mats.brassMetal
      );
      frontPlate.rotation.x = Math.PI * 0.5;
      frontPlate.position.z = 0.19;
      phaserRotor.add(frontPlate);

      // 5 颗防拆螺栓与中心 OCV 油道螺塞
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const b = createBoltMesh(0.032, 0.06, mats.gunmetalSteel);
        b.rotation.x = Math.PI * 0.5;
        b.position.set(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.21);
        phaserRotor.add(b);
      }

      const centerPlug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.06, 6),
        mats.polishedChrome
      );
      centerPlug.rotation.x = Math.PI * 0.5;
      centerPlug.position.z = 0.22;
      phaserRotor.add(centerPlug);

      vvtGroup.add(phaserRotor);
      vvtRotors.push(phaserRotor);
    });

    tagPartGroup(vvtGroup, 'vvt_phasers');

    // ==================== 6. 静音齿形正时链条、导轨与液压张紧器 (timing_chain_system) ====================
    const timingChainGroup = new THREE.Group();
    const cz = S.timingChainZ;

    // 闭合正时链条路径 (精确包络下方曲轴链轮 (0,0) 与上方左右 VVT 链轮 (±0.60, 4.72))
    const chainControlPts = [
      new THREE.Vector3(0.0, -0.45, cz),
      new THREE.Vector3(-0.43, -0.14, cz),
      new THREE.Vector3(-0.74, 1.85, cz),
      new THREE.Vector3(-1.14, 4.55, cz),
      new THREE.Vector3(-0.98, 5.14, cz),
      new THREE.Vector3(-0.55, 5.28, cz),
      new THREE.Vector3(0.0, 5.25, cz),
      new THREE.Vector3(0.55, 5.28, cz),
      new THREE.Vector3(0.98, 5.14, cz),
      new THREE.Vector3(1.14, 4.55, cz),
      new THREE.Vector3(0.76, 1.95, cz),
      new THREE.Vector3(0.43, -0.14, cz)
    ];
    const chainCurve = new THREE.CatmullRomCurve3(chainControlPts, true, 'catmullrom', 0.35);

    // 72 节独立双排金属正时链节 (随曲轴转角沿闭合曲线实时循环滚动!)
    const linkCount = 72;
    const linkGeo = createChainLinkGeometry();
    const chainLinks = [];
    for (let i = 0; i < linkCount; i++) {
      const lm = new THREE.Mesh(linkGeo, i % 2 === 0 ? mats.gunmetalSteel : mats.forgedSteel);
      timingChainGroup.add(lm);
      chainLinks.push(lm);
    }

    // 左侧固定导向长弧形尼龙轨 (Fixed Timing Guide)
    const leftGuideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.56, 0.55, cz),
      new THREE.Vector3(-0.84, 2.25, cz),
      new THREE.Vector3(-1.18, 4.15, cz)
    ]);
    const leftGuide = new THREE.Mesh(
      new THREE.TubeGeometry(leftGuideCurve, 24, 0.065, 8, false),
      mats.nylonGuide
    );
    leftGuide.scale.set(1.0, 1.0, 2.2);
    timingChainGroup.add(leftGuide);

    // 右侧摆动张紧尼龙弧形轨 (Pivoting Tensioner Shoe)
    const rightGuideCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.58, 0.55, cz),
      new THREE.Vector3(0.84, 2.25, cz),
      new THREE.Vector3(1.18, 4.15, cz)
    ]);
    const rightGuide = new THREE.Mesh(
      new THREE.TubeGeometry(rightGuideCurve, 24, 0.065, 8, false),
      mats.nylonGuide
    );
    rightGuide.scale.set(1.0, 1.0, 2.2);
    timingChainGroup.add(rightGuide);

    // 顶部两链轮间防跳齿上导轨 (Upper Chain Damper)
    const topGuide = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.09, 0.22),
      mats.nylonGuide
    );
    topGuide.position.set(0, 5.34, cz);
    timingChainGroup.add(topGuide);

    // 液压柱塞链条张紧器总成 (Hydraulic Timing Tensioner)
    const tensionerBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.28, 0.26),
      mats.machinedAluminum
    );
    tensionerBody.position.set(1.16, 2.25, cz);
    tensionerBody.rotation.z = 0.22;
    timingChainGroup.add(tensionerBody);

    const tensionerPlunger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.28, 16),
      mats.polishedChrome
    );
    tensionerPlunger.rotation.z = Math.PI * 0.5 + 0.22;
    tensionerPlunger.position.set(0.95, 2.20, cz);
    timingChainGroup.add(tensionerPlunger);

    tagPartGroup(timingChainGroup, 'timing_chain_system');

    // ==================== 7. 铝合金正时链条前盖总成 (timing_cover) ====================
    const coverGroup = new THREE.Group();
    const cShape = new THREE.Shape();
    cShape.moveTo(-1.18, -0.88);
    cShape.lineTo(1.18, -0.88);
    cShape.lineTo(1.26, 0.85);
    cShape.lineTo(1.24, 4.88);
    cShape.quadraticCurveTo(1.20, 5.45, 0.65, 5.48);
    cShape.lineTo(-0.65, 5.48);
    cShape.quadraticCurveTo(-1.20, 5.45, -1.24, 4.88);
    cShape.lineTo(-1.26, 0.85);
    cShape.closePath();

    // 曲轴前鼻端油封圆孔
    const sealHole = new THREE.Path();
    sealHole.absarc(0, 0, 0.32, 0, Math.PI * 2, true);
    cShape.holes.push(sealHole);

    const tcGeo = new THREE.ExtrudeGeometry(cShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 20
    });
    const tcMesh = new THREE.Mesh(tcGeo, mats.castAluminum);
    tcMesh.position.z = S.timingCoverFrontZ - 0.16;
    coverGroup.add(tcMesh);

    // 曲轴前油封凸台与棕色氟橡胶油封圈
    const sealBoss = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.055, 12, 32),
      mats.machinedAluminum
    );
    sealBoss.position.set(0, 0, S.timingCoverFrontZ + 0.08);
    coverGroup.add(sealBoss);

    const oilSeal = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.33, 28),
      mats.nylonGuide
    );
    oilSeal.position.set(0, 0, S.timingCoverFrontZ + 0.11);
    coverGroup.add(oilSeal);

    // 前盖表面加强筋与周边 12 颗紧固螺栓
    for (let ry = 0.8; ry <= 4.2; ry += 1.1) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 0.07, 0.06),
        mats.castAluminum
      );
      rib.position.set(0, ry, S.timingCoverFrontZ + 0.09);
      coverGroup.add(rib);
    }

    const boltCoords = [
      [-1.08, -0.72], [1.08, -0.72], [-1.14, 0.65], [1.14, 0.65],
      [-1.12, 2.05], [1.12, 2.05], [-1.12, 3.45], [1.12, 3.45],
      [-1.08, 4.75], [1.08, 4.75], [-0.45, 5.34], [0.45, 5.34]
    ];
    boltCoords.forEach(([bx, by]) => {
      const b = createBoltMesh(0.045, 0.14, mats.polishedChrome);
      b.rotation.x = Math.PI * 0.5;
      b.position.set(bx, by, S.timingCoverFrontZ + 0.10);
      coverGroup.add(b);
    });

    tagPartGroup(coverGroup, 'timing_cover');

    // ==================== 8. 曲轴谐波扭转减振皮带轮 (harmonic_balancer) ====================
    const balancerGroup = new THREE.Group();
    const balancerRotor = new THREE.Group();
    balancerRotor.position.set(0, 0, S.serpentineBeltZ);
    balancerGroup.add(balancerRotor);

    const crankPulleyR = 0.66;
    const crankPulleyMesh = createMultiRibPulley({
      radius: crankPulleyR,
      width: 0.34,
      hubRadius: 0.22,
      spokeHoles: 6,
      matRim: mats.gunmetalSteel,
      matHub: mats.forgedSteel
    });
    balancerRotor.add(crankPulleyMesh);

    // 黑色 EPDM 硫化阻尼橡胶环特征层
    const rubberDamper = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.036, 10, 36),
      mats.blackPolymer
    );
    rubberDamper.position.z = 0.15;
    balancerRotor.add(rubberDamper);

    tagPartGroup(balancerGroup, 'harmonic_balancer');

    // ==================== 9. 150A 智能交流发电机 (alternator — 含内部紫铜绕组!) ====================
    const altGroup = new THREE.Group();
    const altPos = { x: -1.52, y: 0.52 };
    const altPulleyR = 0.30;

    // 铝合金镂空前后端壳体 (位于 Z = serpentineBeltZ - 0.85)
    const altBodyZ = S.serpentineBeltZ - 0.86;
    const altHousing = new THREE.Group();
    altHousing.position.set(altPos.x, altPos.y, altBodyZ);

    // 内部饱满的高纯紫铜定子扁线绕组圈 (透过散热窗清晰可见!)
    const statorCopper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.56, 28),
      mats.copperWinding
    );
    statorCopper.rotation.x = Math.PI * 0.5;
    altHousing.add(statorCopper);

    // 前后压铸铝端盖 + 12根镂空散热笼肋条
    [-0.32, 0.32].forEach((ez) => {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.50, 0.18, 24),
        mats.castAluminum
      );
      cap.rotation.x = Math.PI * 0.5;
      cap.position.z = ez;
      altHousing.add(cap);
    });

    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.055, 0.66),
        mats.castAluminum
      );
      strut.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0);
      strut.rotation.z = a;
      altHousing.add(strut);
    }

    // 后端黑色整流调节器罩与 B+ 紫铜主供电接线柱
    const rectifierCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.22, 24),
      mats.blackPolymer
    );
    rectifierCap.rotation.x = Math.PI * 0.5;
    rectifierCap.position.z = -0.48;
    altHousing.add(rectifierCap);

    const bPlusStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.18, 12),
      mats.copperWinding
    );
    bPlusStud.position.set(-0.28, 0.36, -0.52);
    altHousing.add(bPlusStud);

    // 挂接在缸体侧面的铸铝安装支臂
    const altBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.22, 0.55),
      mats.darkCastAluminum
    );
    altBracket.position.set(0.44, -0.18, 0.05);
    altHousing.add(altBracket);

    altGroup.add(altHousing);

    // 发电机前端 OAD 单向离合皮带轮转子
    const altRotor = new THREE.Group();
    altRotor.position.set(altPos.x, altPos.y, S.serpentineBeltZ);
    altRotor.add(createMultiRibPulley({
      radius: altPulleyR,
      width: 0.32,
      hubRadius: 0.12,
      spokeHoles: 0,
      matRim: mats.gunmetalSteel,
      matHub: mats.polishedChrome
    }));
    const altShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.55, 16),
      mats.polishedChrome
    );
    altShaft.rotation.x = Math.PI * 0.5;
    altShaft.position.z = -0.28;
    altRotor.add(altShaft);
    altGroup.add(altRotor);

    tagPartGroup(altGroup, 'alternator');

    // ==================== 10. 离心式冷却水泵与空调压缩机 (water_pump_ac) ====================
    const wpAcGroup = new THREE.Group();

    // 10.1 离心式冷却水泵 (位于右上方 +0.58, 1.56)
    const wpPos = { x: 0.58, y: 1.56 };
    const wpPulleyR = 0.38;

    const wpVolute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.48, 0.32, 24),
      mats.castAluminum
    );
    wpVolute.rotation.x = Math.PI * 0.5;
    wpVolute.position.set(wpPos.x, wpPos.y, S.timingCoverFrontZ + 0.12);
    wpAcGroup.add(wpVolute);

    // 水泵进出水铝管接口 + 电子节温器壳
    const wpPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.56, 18),
      mats.machinedAluminum
    );
    wpPipe.rotation.z = -0.65;
    wpPipe.position.set(wpPos.x + 0.38, wpPos.y + 0.24, S.timingCoverFrontZ + 0.08);
    wpAcGroup.add(wpPipe);

    const wpRotor = new THREE.Group();
    wpRotor.position.set(wpPos.x, wpPos.y, S.serpentineBeltZ);
    wpRotor.add(createMultiRibPulley({
      radius: wpPulleyR,
      width: 0.30,
      hubRadius: 0.12,
      spokeHoles: 5,
      matRim: mats.gunmetalSteel,
      matHub: mats.machinedAluminum
    }));
    wpAcGroup.add(wpRotor);

    // 10.2 斜盘变排量空调压缩机 (位于右下方 +1.46, -0.28)
    const acPos = { x: 1.46, y: -0.28 };
    const acPulleyR = 0.42;

    const acBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 1.15, 26),
      mats.castAluminum
    );
    acBody.rotation.x = Math.PI * 0.5;
    acBody.position.set(acPos.x, acPos.y, S.serpentineBeltZ - 0.92);
    wpAcGroup.add(acBody);

    // 压缩机散热环肋与顶部冷媒高低压管接头
    for (let r = -0.35; r <= 0.35; r += 0.22) {
      const fin = new THREE.Mesh(
        new THREE.TorusGeometry(0.53, 0.022, 8, 28),
        mats.darkCastAluminum
      );
      fin.position.set(acPos.x, acPos.y, S.serpentineBeltZ - 0.92 + r);
      wpAcGroup.add(fin);
    }

    [-0.14, 0.14].forEach((pz, pIdx) => {
      const port = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.28, 14),
        mats.machinedAluminum
      );
      port.position.set(acPos.x + 0.18, acPos.y + 0.58, S.serpentineBeltZ - 0.88 + pz);
      wpAcGroup.add(port);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.08, 14),
        pIdx === 0 ? mats.oilFilterBlue : mats.redWrinkle // 经典蓝(L低压)/红(H高压)冷媒加注口防尘帽!
      );
      cap.position.set(acPos.x + 0.18, acPos.y + 0.74, S.serpentineBeltZ - 0.88 + pz);
      wpAcGroup.add(cap);
    });

    const acBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.24, 0.68),
      mats.darkCastAluminum
    );
    acBracket.position.set(acPos.x - 0.38, acPos.y + 0.12, S.serpentineBeltZ - 0.88);
    wpAcGroup.add(acBracket);

    const acRotor = new THREE.Group();
    acRotor.position.set(acPos.x, acPos.y, S.serpentineBeltZ);
    acRotor.add(createMultiRibPulley({
      radius: acPulleyR,
      width: 0.32,
      hubRadius: 0.18,
      spokeHoles: 3,
      matRim: mats.gunmetalSteel,
      matHub: mats.brassMetal
    }));
    wpAcGroup.add(acRotor);

    tagPartGroup(wpAcGroup, 'water_pump_ac');

    // ==================== 11. 前端附件多楔蛇形皮带与自动张紧轮 (serpentine_belt) ====================
    const beltGroup = new THREE.Group();
    const bz = S.serpentineBeltZ;

    // 自动张紧器摆臂与光滑惰轮 (-0.64, 1.38)
    const idlerPos = { x: -0.64, y: 1.38 };
    const idlerR = 0.24;

    const tensionerSpringCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.26, 22),
      mats.machinedAluminum
    );
    tensionerSpringCup.rotation.x = Math.PI * 0.5;
    tensionerSpringCup.position.set(-0.32, 1.82, bz - 0.24);
    beltGroup.add(tensionerSpringCup);

    const tensionerArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.16, 0.10),
      mats.machinedAluminum
    );
    tensionerArm.position.set(-0.48, 1.60, bz - 0.16);
    tensionerArm.rotation.z = 0.78;
    beltGroup.add(tensionerArm);

    const idlerRotor = new THREE.Group();
    idlerRotor.position.set(idlerPos.x, idlerPos.y, bz);
    idlerRotor.add(createMultiRibPulley({
      radius: idlerR,
      width: 0.30,
      hubRadius: 0.09,
      spokeHoles: 0,
      matRim: mats.polishedChrome,
      matHub: mats.gunmetalSteel
    }));
    beltGroup.add(idlerRotor);

    // 闭合蛇形皮带轮廓曲线 (精确包绕曲轴轮 -> 发电机轮 -> 张紧惰轮 -> 水泵轮 -> 空调轮 -> 回曲轴轮底缘!)
    const beltPts = [
      new THREE.Vector3(0.0, -crankPulleyR, bz),
      new THREE.Vector3(-0.56, -0.40, bz),
      new THREE.Vector3(altPos.x - 0.18, altPos.y - altPulleyR, bz),
      new THREE.Vector3(altPos.x - altPulleyR, altPos.y + 0.06, bz),
      new THREE.Vector3(altPos.x - 0.08, altPos.y + altPulleyR, bz),
      new THREE.Vector3(idlerPos.x - 0.14, idlerPos.y - idlerR * 0.85, bz), // 背靠张紧轮下侧压紧!
      new THREE.Vector3(wpPos.x - 0.16, wpPos.y + wpPulleyR, bz),
      new THREE.Vector3(wpPos.x + wpPulleyR * 0.92, wpPos.y + 0.18, bz),
      new THREE.Vector3(acPos.x + 0.22, acPos.y + acPulleyR * 0.95, bz),
      new THREE.Vector3(acPos.x + acPulleyR, acPos.y - 0.08, bz),
      new THREE.Vector3(acPos.x + 0.06, acPos.y - acPulleyR, bz),
      new THREE.Vector3(0.55, -0.44, bz)
    ];
    const beltCurve = new THREE.CatmullRomCurve3(beltPts, true, 'catmullrom', 0.22);
    const beltRibbonGeo = createFlatBeltRibbonGeometry(beltCurve, 0.28, 0.036, 160);
    const beltMesh = new THREE.Mesh(beltRibbonGeo, mats.serpentineBelt);
    beltGroup.add(beltMesh);

    tagPartGroup(beltGroup, 'serpentine_belt');

    // ==================== 12. 防浪挡油板、机油泵与集油器滤网 (windage_oil_pump) ====================
    const windageGroup = new THREE.Group();

    // 冲压百叶槽镀锌钢防浪挡油板 (Windage Tray)
    const trayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.04, 6.10),
      mats.machinedAluminum
    );
    trayMesh.position.set(0, S.blockBottomY - 0.04, 0);
    windageGroup.add(trayMesh);

    // 挡油板回油百叶窗条纹细节
    for (let z = -2.4; z <= 2.4; z += 0.6) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.06, 0.18),
        mats.gunmetalSteel
      );
      louver.rotation.x = 0.25;
      louver.position.set(0, S.blockBottomY - 0.05, z);
      windageGroup.add(louver);
    }

    // 前端转子式机油泵壳体 (Oil Pump)
    const oilPump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.38, 22),
      mats.darkCastAluminum
    );
    oilPump.rotation.x = Math.PI * 0.5;
    oilPump.position.set(-0.38, S.blockBottomY - 0.30, 2.35);
    windageGroup.add(oilPump);

    // 不锈钢吸油弯管 (Oil Pickup Tube) + 底部飞碟形金属丝网吸油盘 (Strainer)
    const pickupCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.38, S.blockBottomY - 0.35, 2.25),
      new THREE.Vector3(-0.22, S.blockBottomY - 0.72, 1.35),
      new THREE.Vector3(0.0, S.blockBottomY - 0.92, -0.35),
      new THREE.Vector3(0.0, S.blockBottomY - 1.02, -0.85)
    ]);
    const pickupPipe = new THREE.Mesh(
      new THREE.TubeGeometry(pickupCurve, 28, 0.075, 14, false),
      mats.polishedChrome
    );
    windageGroup.add(pickupPipe);

    const strainerBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.42, 0.16, 24),
      mats.machinedAluminum
    );
    strainerBell.position.set(0, S.blockBottomY - 1.06, -0.85);
    windageGroup.add(strainerBell);

    const strainerScreen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.39, 0.02, 24),
      mats.brassMetal
    );
    strainerScreen.position.set(0, S.blockBottomY - 1.14, -0.85);
    windageGroup.add(strainerScreen);

    tagPartGroup(windageGroup, 'windage_oil_pump');

    // ==================== 13. 纵向散热鳍片铝合金油底壳 (oil_pan) ====================
    const oilPanGroup = new THREE.Group();
    const panTopY = S.blockBottomY - 0.06;

    // 油底壳上安装宽边法兰圈 + 16 颗紧固螺丝
    const flangeFrameShape = new THREE.Shape();
    flangeFrameShape.moveTo(-1.38, -3.28);
    flangeFrameShape.lineTo(1.38, -3.28);
    flangeFrameShape.lineTo(1.38, 3.28);
    flangeFrameShape.lineTo(-1.38, 3.28);
    flangeFrameShape.closePath();

    const flangeHole = new THREE.Path();
    flangeHole.moveTo(-1.12, -3.02);
    flangeHole.lineTo(1.12, -3.02);
    flangeHole.lineTo(1.12, 3.02);
    flangeHole.lineTo(-1.12, 3.02);
    flangeHole.closePath();
    flangeFrameShape.holes.push(flangeHole);

    const panFlangeGeo = new THREE.ExtrudeGeometry(flangeFrameShape, { depth: 0.10, bevelEnabled: false });
    panFlangeGeo.rotateX(-Math.PI * 0.5);
    const panFlange = new THREE.Mesh(panFlangeGeo, mats.machinedAluminum);
    panFlange.position.y = panTopY - 0.10;
    oilPanGroup.add(panFlange);

    // 阶梯形油池壳体 (前浅后深油槽设计 Sump Bowl，且上方敞口便于拆开观察内部防浪隔板!)
    const sumpOuter = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.62, 6.22),
      mats.castAluminum
    );
    sumpOuter.position.set(0, panTopY - 0.40, 0);
    // 用带壁厚中空槽替代实心块，拆开后看到真实的贮油凹槽与防倾隔板!
    const sumpWalls = createHollowBoxSump(2.38, 1.18, 6.20, 0.12, mats.castAluminum);
    sumpWalls.position.set(0, panTopY - 0.10, 0);
    oilPanGroup.add(sumpWalls);

    // 油底壳内部 2 道横向防侧倾断油挡板 (Internal Sump Baffles)
    [-1.65, 0.85].forEach((bzPos) => {
      const baffle = new THREE.Mesh(
        new THREE.BoxGeometry(2.10, 0.45, 0.06),
        mats.darkCastAluminum
      );
      baffle.position.set(0, panTopY - 0.92, bzPos);
      oilPanGroup.add(baffle);
    });

    // 底部 11 条密集纵向风冷散热翼片 (Cooling Fins)!
    for (let fx = -0.95; fx <= 0.96; fx += 0.19) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.14, 5.85),
        mats.castAluminum
      );
      fin.position.set(fx, panTopY - 1.34, 0);
      oilPanGroup.add(fin);
    }

    // 后端黄铜强磁放油螺栓与紫铜密封垫圈 (Magnetic Oil Drain Plug)
    const drainPlug = createBoltMesh(0.085, 0.12, mats.brassMetal);
    drainPlug.rotation.x = -Math.PI * 0.5;
    drainPlug.position.set(0.55, panTopY - 1.05, -3.12);
    oilPanGroup.add(drainPlug);

    // 周边 14 颗自下而上拧紧的油底壳螺栓
    for (let bzIdx = -2.8; bzIdx <= 2.81; bzIdx += 0.93) {
      [-1.26, 1.26].forEach((bx) => {
        const pb = createBoltMesh(0.042, 0.14, mats.gunmetalSteel);
        pb.rotation.x = Math.PI;
        pb.position.set(bx, panTopY - 0.10, bzIdx);
        oilPanGroup.add(pb);
      });
    }

    tagPartGroup(oilPanGroup, 'oil_pan');

    // ==================== 14. 旋装式全流机油滤清器与机油尺 (oil_filter_dipstick) ====================
    const filterDipGroup = new THREE.Group();

    // 水冷板式机油换热器铝合金底座 (安装在缸体进气侧中部下方)
    const coolerBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.52, 0.58),
      mats.machinedAluminum
    );
    coolerBase.position.set(-1.32, 0.15, -1.15);
    filterDipGroup.add(coolerBase);

    // 深蓝色旋装式高压机油滤清器罐 (Spin-on Oil Filter Canister)
    const canister = new THREE.Group();
    canister.position.set(-1.68, -0.12, -1.15);
    canister.rotation.z = 0.72;

    const canBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.78, 28),
      mats.oilFilterBlue
    );
    canister.add(canBody);

    const canSeal = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.032, 10, 24),
      mats.blackPolymer
    );
    canSeal.rotation.x = Math.PI * 0.5;
    canSeal.position.y = 0.39;
    canister.add(canSeal);

    filterDipGroup.add(canister);

    // 细长不锈钢机油尺导管 + 顶部醒目亮黄色机油拉环 (Oil Dipstick)
    const dipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.26, -0.78, -0.35),
      new THREE.Vector3(-1.42, 0.85, -0.20),
      new THREE.Vector3(-1.48, 2.65, 0.25),
      new THREE.Vector3(-1.36, 4.35, 0.65)
    ]);
    const dipTube = new THREE.Mesh(
      new THREE.TubeGeometry(dipCurve, 28, 0.034, 10, false),
      mats.gunmetalSteel
    );
    filterDipGroup.add(dipTube);

    const yellowHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.032, 10, 22),
      mats.safetyYellow
    );
    yellowHandle.position.set(-1.34, 4.52, 0.70);
    yellowHandle.rotation.y = Math.PI * 0.5;
    filterDipGroup.add(yellowHandle);

    const handleStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.18, 12),
      mats.safetyYellow
    );
    handleStem.position.set(-1.35, 4.38, 0.66);
    filterDipGroup.add(handleStem);

    tagPartGroup(filterDipGroup, 'oil_filter_dipstick');

    /**
     * 每帧实时更新正时链节循环滚动、双VVT相位器、曲轴皮带轮、发电机/水泵/压缩机/惰轮及多楔皮带动画
     */
    function updatePeripherals(cycleAngleRad) {
      // 双 VVT 链轮以 1/2 曲轴转速旋转
      const camRot = -cycleAngleRad * 0.5;
      vvtRotors[0].rotation.z = camRot;
      vvtRotors[1].rotation.z = camRot;

      // 曲轴减振皮带轮 1:1 曲轴转速
      balancerRotor.rotation.z = -cycleAngleRad;

      // 各附件皮带轮严格按半径反比同步旋转!
      altRotor.rotation.z = -cycleAngleRad * (crankPulleyR / altPulleyR);
      wpRotor.rotation.z = -cycleAngleRad * (crankPulleyR / wpPulleyR);
      acRotor.rotation.z = -cycleAngleRad * (crankPulleyR / acPulleyR);
      // 惰轮背靠皮带反面，反向高速自转!
      idlerRotor.rotation.z = +cycleAngleRad * (crankPulleyR / idlerR);

      // 多楔蛇形皮带表面纹理实时沿带长飞驰
      if (textures && textures.beltMap) {
        textures.beltMap.offset.x = -(cycleAngleRad * 0.42) % 1.0;
      }

      // 72 节金属正时链节沿闭合导轨曲线实时循环滚动!
      // 曲轴链轮有效节圆周长对应曲线归一化位移
      const chainLinearShift = (cycleAngleRad * 0.41) / chainCurve.getLength();
      const pt = new THREE.Vector3();
      const tan = new THREE.Vector3();

      for (let i = 0; i < linkCount; i++) {
        let u = (i / linkCount + chainLinearShift) % 1.0;
        if (u < 0) u += 1.0;
        chainCurve.getPointAt(u, pt);
        chainCurve.getTangentAt(u, tan);

        const lm = chainLinks[i];
        lm.position.copy(pt);
        lm.rotation.z = Math.atan2(tan.y, tan.x);
      }
    }

    updatePeripherals(0);

    return {
      parts: {
        ignition_coils: coilsGroup,
        spark_plugs: plugsGroup,
        fuel_rail_injectors: fuelRailGroup,
        hpfp_pump: hpfpGroup,
        vvt_phasers: vvtGroup,
        timing_chain_system: timingChainGroup,
        timing_cover: coverGroup,
        harmonic_balancer: balancerGroup,
        alternator: altGroup,
        water_pump_ac: wpAcGroup,
        serpentine_belt: beltGroup,
        windage_oil_pump: windageGroup,
        oil_pan: oilPanGroup,
        oil_filter_dipstick: filterDipGroup
      },
      updatePeripherals
    };
  }

  /**
   * 构造单节双排金属滚子正时链节几何体
   */
  function createChainLinkGeometry() {
    const geos = [];
    const plate1 = new THREE.BoxGeometry(0.15, 0.075, 0.028);
    plate1.translate(0, 0, 0.065);
    geos.push(plate1);

    const plate2 = new THREE.BoxGeometry(0.15, 0.075, 0.028);
    plate2.translate(0, 0, -0.065);
    geos.push(plate2);

    const pin = new THREE.CylinderGeometry(0.024, 0.024, 0.17, 8);
    pin.rotateX(Math.PI * 0.5);
    geos.push(pin);

    return THREE.mergeGeometries(geos, false);
  }

  /**
   * 沿闭合 2D/3D 曲线构造扁平宽带几何体 (带连续 UV 供多楔皮带贴图滚动!)
   */
  function createFlatBeltRibbonGeometry(curve, width, thickness, segments) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const halfW = width * 0.5;
    const halfT = thickness * 0.5;
    const pt = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();

    // 每个截面4个顶点 (矩形断面)
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      curve.getPointAt(u % 1.0, pt);
      curve.getTangentAt(u % 1.0, tan);
      // 平面在 XY，法向向外 (-tan.y, tan.x, 0) 或 (tan.y, -tan.x, 0)
      nrm.set(tan.y, -tan.x, 0).normalize();

      const sectionOffsets = [
        [halfT, -halfW, nrm.x, nrm.y, 0, 0],
        [halfT, halfW, nrm.x, nrm.y, 0, 1],
        [-halfT, halfW, -nrm.x, -nrm.y, 0, 0],
        [-halfT, -halfW, -nrm.x, -nrm.y, 0, 1]
      ];

      for (let k = 0; k < 4; k++) {
        const [dn, dz, nx, ny, nz, vCoord] = sectionOffsets[k];
        positions.push(pt.x + nrm.x * dn, pt.y + nrm.y * dn, pt.z + dz);
        normals.push(nx, ny, nz);
        uvs.push(u * 6.0, vCoord);
      }
    }

    for (let i = 0; i < segments; i++) {
      const base = i * 4;
      const next = (i + 1) * 4;
      for (let k = 0; k < 4; k++) {
        const k1 = (k + 1) % 4;
        indices.push(base + k, next + k, next + k1);
        indices.push(base + k, next + k1, base + k1);
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

  /**
   * 构造敞口中空厚壁铝合金油底壳池体 (底面位于 -height，敞口顶位于 0)
   */
  function createHollowBoxSump(w, h, l, wallT, material) {
    const g = new THREE.Group();
    // 底板
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, l), material);
    bottom.position.y = -h + wallT * 0.5;
    g.add(bottom);

    // 左右长侧板
    [-w * 0.5 + wallT * 0.5, w * 0.5 - wallT * 0.5].forEach((wx) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, h - wallT, l), material);
      side.position.set(wx, -(h - wallT) * 0.5, 0);
      g.add(side);
    });

    // 前后短端板
    [-l * 0.5 + wallT * 0.5, l * 0.5 - wallT * 0.5].forEach((lz) => {
      const end = new THREE.Mesh(new THREE.BoxGeometry(w - wallT * 2, h - wallT, wallT), material);
      end.position.set(0, -(h - wallT) * 0.5, lz);
      g.add(end);
    });

    return g;
  }

  ns.buildPeripheralParts = buildPeripheralParts;
})(window.EngineApp);
