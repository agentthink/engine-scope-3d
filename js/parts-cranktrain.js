/**
 * 曲柄连杆、活塞核心与飞轮离合模块
 * 包含: 全平衡锻钢曲轴、凹顶活塞×4、三道活塞环×12、全浮式活塞销×4、H型锻造连杆×4、双质量飞轮与膜片弹簧离合器
 * 支持任意拆解度下的 100% 精确曲柄滑块运动学 (Exact Slider-Crank Kinematics)
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const { tagPartGroup, createBoltMesh, createGearGeometry, createHelicalSpringGeometry } = ns.GeoHelpers;

  /**
   * 构造扇形空气动力学切角曲轴平衡重与曲柄臂一体几何 (位于 XY 平面，沿 Z 轴厚 thickness)
   * pinDir: +1 表示曲柄销在 +Y 方向 (1,4缸), -1 表示曲柄销在 -Y 方向 (2,3缸)
   */
  function createCrankWebCounterweightGeo(crankRadius, thickness, pinDir) {
    const shape = new THREE.Shape();
    // 曲柄臂颈部包裹主轴颈 (0,0) 与曲柄销 (0, pinDir * crankRadius)
    // 平衡重扇面朝向相反方向 (-pinDir)
    const dir = pinDir;
    // 我们先按 pin 在 +Y、平衡重在 -Y 建模，若 dir === -1 最后绕 Z 旋转 PI
    const rWeb = 0.34;
    const rPinWrap = 0.28;
    const rCounter = 0.86;

    // 从右侧主轴颈腰部往曲柄销顶端走
    shape.moveTo(rWeb, 0.05);
    shape.lineTo(rPinWrap, crankRadius);
    shape.absarc(0, crankRadius, rPinWrap, 0, Math.PI, false);
    shape.lineTo(-rWeb, 0.05);
    // 向外展开为宽大扇形平衡重 (角度从 PI + 0.22 到 2*PI - 0.22)
    shape.lineTo(-Math.cos(0.24) * rCounter, -Math.sin(0.24) * rCounter);
    shape.absarc(0, 0, rCounter, Math.PI + 0.24, Math.PI * 2 - 0.24, false);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 28
    });
    geo.translate(0, 0, -thickness * 0.5);
    if (dir < 0) {
      geo.rotateZ(Math.PI);
    }
    return geo;
  }

  function buildCranktrainParts(mats) {
    const S = ENGINE_SPEC;

    // ==================== 1. 全平衡锻钢曲轴 (crankshaft) ====================
    const crankshaftGroup = new THREE.Group();
    const crankRotor = new THREE.Group();
    crankshaftGroup.add(crankRotor);

    const mainJournalR = 0.29;
    const rodJournalR = 0.245;

    // 5 道镜面抛光主轴颈 (Main Journals)
    S.mainZ.forEach((mz, idx) => {
      const len = (idx === 0 || idx === 4) ? 0.42 : 0.36;
      const mj = new THREE.Mesh(
        new THREE.CylinderGeometry(mainJournalR, mainJournalR, len, 28),
        mats.polishedChrome
      );
      mj.rotation.x = Math.PI * 0.5;
      mj.position.set(0, 0, mz);
      crankRotor.add(mj);
    });

    // 前端曲轴鼻轴 (伸出正时链轮与谐波减振皮带轮安装轴颈)
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.24, 1.35, 24),
      mats.polishedChrome
    );
    snout.rotation.x = Math.PI * 0.5;
    snout.position.set(0, 0, S.mainZ[0] + 0.68);
    crankRotor.add(snout);

    // 曲轴正时主动链轮 (安装在曲轴前端 Z = timingChainZ)
    const crankSprocketGeo = createGearGeometry({
      outerRadius: 0.44,
      rootRadius: 0.385,
      boreRadius: 0.20,
      teeth: 21,
      thickness: 0.14
    });
    const crankSprocket = new THREE.Mesh(crankSprocketGeo, mats.gunmetalSteel);
    crankSprocket.position.set(0, 0, S.timingChainZ);
    crankRotor.add(crankSprocket);

    // 后端飞轮安装大法兰盘
    const rearFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.16, 28),
      mats.machinedAluminum
    );
    rearFlange.rotation.x = Math.PI * 0.5;
    rearFlange.position.set(0, 0, S.mainZ[4] - 0.30);
    crankRotor.add(rearFlange);

    // 4 道连杆轴颈 (Rod Crankpins) + 8 片锻钢平衡重曲柄臂 + 轴颈斜油孔细节
    S.cylZ.forEach((cz, i) => {
      const pinDir = (S.crankPinPhaseRad[i] === 0) ? 1 : -1;
      const pinY = pinDir * S.crankRadius;

      // 连杆轴颈
      const pinMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(rodJournalR, rodJournalR, 0.48, 28),
        mats.polishedChrome
      );
      pinMesh.rotation.x = Math.PI * 0.5;
      pinMesh.position.set(0, pinY, cz);
      crankRotor.add(pinMesh);

      // 轴颈表面润滑油孔黑点细节
      const oilHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, rodJournalR * 2.04, 10),
        mats.blackPolymer
      );
      oilHole.position.set(0, pinY, cz);
      crankRotor.add(oilHole);

      // 前后两片曲柄臂与扇形平衡重 (8 Counterweights total)
      const webGeo = createCrankWebCounterweightGeo(S.crankRadius, 0.19, pinDir);
      [-0.34, 0.34].forEach((dz) => {
        const webMesh = new THREE.Mesh(webGeo, mats.forgedSteel);
        webMesh.position.set(0, 0, cz + dz);
        crankRotor.add(webMesh);
      });
    });

    tagPartGroup(crankshaftGroup, 'crankshaft');

    // ==================== 2. 涡轮凹顶铝合金活塞组 (pistons ×4) ====================
    const pistonsGroup = new THREE.Group();
    const pistonUnits = [];

    const pRadius = S.boreRadius - 0.012; // 0.568

    for (let i = 0; i < 4; i++) {
      const unit = new THREE.Group(); // 原点设在活塞销中心 (0, 0, 0)

      // 2.1 活塞头部环岸带 (Crown & Ring Lands: 从 Y = +0.08 到 +pistonCompHeight)
      const crownH = S.pistonCompHeight - 0.06; // 0.39
      const crownLathePts = [
        new THREE.Vector2(0.0, crownH - 0.055),          // 涡流凹坑底中心
        new THREE.Vector2(pRadius * 0.66, crownH - 0.055), // 凹坑边缘
        new THREE.Vector2(pRadius * 0.76, crownH),       // 挤气环带顶面 (Squish Band)
        new THREE.Vector2(pRadius, crownH),              // 火力岸外缘
        new THREE.Vector2(pRadius, crownH - 0.08),
        // 第一道环槽
        new THREE.Vector2(pRadius - 0.055, crownH - 0.08),
        new THREE.Vector2(pRadius - 0.055, crownH - 0.115),
        new THREE.Vector2(pRadius, crownH - 0.115),
        new THREE.Vector2(pRadius, crownH - 0.175),
        // 第二道环槽
        new THREE.Vector2(pRadius - 0.055, crownH - 0.175),
        new THREE.Vector2(pRadius - 0.055, crownH - 0.21),
        new THREE.Vector2(pRadius, crownH - 0.21),
        new THREE.Vector2(pRadius, crownH - 0.27),
        // 第三道组合油环槽
        new THREE.Vector2(pRadius - 0.065, crownH - 0.27),
        new THREE.Vector2(pRadius - 0.065, crownH - 0.32),
        new THREE.Vector2(pRadius, crownH - 0.32),
        new THREE.Vector2(pRadius, 0.0),
        new THREE.Vector2(pRadius * 0.78, 0.0)
      ];
      const crownGeo = new THREE.LatheGeometry(crownLathePts, 36);
      const crownMesh = new THREE.Mesh(crownGeo, mats.pistonAlloy);
      crownMesh.position.y = 0.06;
      unit.add(crownMesh);

      // 活塞顶面 4 个气门避让月牙坑 (Valve Relief Pockets)
      [-0.24, 0.24].forEach((vx) => {
        [-0.23, 0.23].forEach((vz) => {
          const pocket = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.12, 0.025, 18),
            mats.darkCastAluminum
          );
          pocket.rotation.z = vx < 0 ? -0.22 : 0.22;
          pocket.position.set(vx, S.pistonCompHeight - 0.012, vz);
          unit.add(pocket);
        });
      });

      // 2.2 活塞减重短裙部 (承推力面在 ±X 两侧，带黑色二硫化钼石墨减摩涂层!)
      [-1, 1].forEach((xSide) => {
        const startAng = (xSide > 0 ? -0.34 : 0.66) * Math.PI;
        const skirtArc = new THREE.Mesh(
          new THREE.CylinderGeometry(pRadius - 0.004, pRadius - 0.008, 0.44, 24, 1, false, startAng, Math.PI * 0.68),
          mats.graphiteSkirt
        );
        skirtArc.position.y = -0.16;
        unit.add(skirtArc);
      });

      // 2.3 活塞销座凸台 (Pin Bosses，沿 Z 轴方向布置以容纳沿 Z 轴横穿的活塞销!)
      [-0.30, 0.30].forEach((bz) => {
        const boss = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.24, 0.24, 20),
          mats.pistonAlloy
        );
        boss.rotation.x = Math.PI * 0.5;
        boss.position.set(0, 0, bz);
        unit.add(boss);
      });

      unit.position.set(0, 2.0, S.cylZ[i]);
      pistonsGroup.add(unit);
      pistonUnits.push(unit);
    }

    tagPartGroup(pistonsGroup, 'pistons');

    // ==================== 3. 三道气环与刮油环组 (piston_rings ×12) ====================
    const ringsGroup = new THREE.Group();
    const ringUnits = [];

    for (let i = 0; i < 4; i++) {
      const rUnit = new THREE.Group();
      const subRings = [];
      const baseHeights = [
        S.pistonCompHeight - 0.097, // 第1道镀铬气环
        S.pistonCompHeight - 0.192, // 第2道磷化刮油气环
        S.pistonCompHeight - 0.295  // 第3道组合油环
      ];
      const ringMats = [mats.polishedChrome, mats.gunmetalSteel, mats.copperWinding];

      for (let rIdx = 0; rIdx < 3; rIdx++) {
        // 留出 10° 开口端隙 (Ring End Gap) 展现真实活塞环开口弹性细节!
        const ringGeo = new THREE.TorusGeometry(pRadius - 0.012, rIdx === 2 ? 0.022 : 0.017, 10, 42, Math.PI * 1.94);
        const rMesh = new THREE.Mesh(ringGeo, ringMats[rIdx]);
        rMesh.rotation.x = Math.PI * 0.5;
        rMesh.rotation.z = rIdx * 2.1; // 三道环开口错开 120° 标准装配规范!
        rMesh.position.y = baseHeights[rIdx];
        rMesh.userData.baseLocalY = baseHeights[rIdx];
        rMesh.userData.spreadOrder = 2 - rIdx; // 拆解时分层展开系数
        rUnit.add(rMesh);
        subRings.push(rMesh);
      }

      rUnit.position.set(0, 2.0, S.cylZ[i]);
      ringsGroup.add(rUnit);
      ringUnits.push({ group: rUnit, subRings });
    }

    tagPartGroup(ringsGroup, 'piston_rings');

    // ==================== 4. 全浮式DLC活塞销与卡簧组 (wrist_pins ×4) ====================
    const pinsGroup = new THREE.Group();
    const pinUnits = [];

    for (let i = 0; i < 4; i++) {
      const pUnit = new THREE.Group();

      // 厚壁中空活塞销外柱 (沿 Z 轴与曲轴平行，铰接连杆在 XY 平面的摆动!)
      const pinOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.88, 24, 1, true),
        mats.polishedChrome
      );
      pinOuter.rotation.x = Math.PI * 0.5;
      pUnit.add(pinOuter);

      const pinInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.882, 18),
        mats.gunmetalSteel
      );
      pinInner.rotation.x = Math.PI * 0.5;
      pUnit.add(pinInner);

      // 两端钢丝限位卡簧 (Circlips)
      [-0.45, 0.45].forEach((cz) => {
        const clip = new THREE.Mesh(
          new THREE.TorusGeometry(0.128, 0.012, 8, 24, Math.PI * 1.75),
          mats.brassMetal
        );
        clip.position.set(0, 0, cz);
        pUnit.add(clip);
      });

      pUnit.position.set(0, 2.0, S.cylZ[i]);
      pinsGroup.add(pUnit);
      pinUnits.push(pUnit);
    }

    tagPartGroup(pinsGroup, 'wrist_pins');

    // ==================== 5. H型断面锻造钢连杆与涨断瓦盖组 (connecting_rods ×4) ====================
    const rodsGroup = new THREE.Group();
    const rodUnits = [];

    const L = S.rodLength;
    const bigEndR = 0.255;

    for (let i = 0; i < 4; i++) {
      // 原点 (0,0,0) 在小头活塞销中心，大头中心在 (0, -L, 0)
      const rUnit = new THREE.Group();

      // 5.1 小头圆环与青铜衬套 (Small End & Bronze Bushing)
      const smallRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.28, 24),
        mats.forgedSteel
      );
      smallRing.rotation.x = Math.PI * 0.5;
      rUnit.add(smallRing);

      const bushing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.132, 0.132, 0.29, 20),
        mats.copperWinding
      );
      bushing.rotation.x = Math.PI * 0.5;
      rUnit.add(bushing);

      // 5.2 H型/工字型锻造杆身 (腹板 + 两侧高刚性翼缘肋条)
      const shankLen = L - 0.48;
      const shankMidY = -0.19 - shankLen * 0.5;
      const web = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, shankLen, 0.10),
        mats.forgedSteel
      );
      web.position.y = shankMidY;
      rUnit.add(web);

      [-0.11, 0.11].forEach((rx) => {
        const flange = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, shankLen + 0.08, 0.24),
          mats.forgedSteel
        );
        // 微斜渐变使下端向大头过渡更宽厚
        flange.rotation.z = rx > 0 ? 0.035 : -0.035;
        flange.position.set(rx * 1.12, shankMidY, 0);
        rUnit.add(flange);
      });

      // 5.3 连杆大头上半肩座 (Upper Big-End Saddle)
      const upperSaddleShape = new THREE.Shape();
      upperSaddleShape.moveTo(-0.46, 0);
      upperSaddleShape.lineTo(-bigEndR, 0);
      upperSaddleShape.absarc(0, 0, bigEndR, Math.PI, 0, true);
      upperSaddleShape.lineTo(0.46, 0);
      upperSaddleShape.lineTo(0.46, 0.18);
      upperSaddleShape.lineTo(0.24, 0.34);
      upperSaddleShape.lineTo(-0.24, 0.34);
      upperSaddleShape.lineTo(-0.46, 0.18);
      upperSaddleShape.closePath();

      const upperSaddleGeo = new THREE.ExtrudeGeometry(upperSaddleShape, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 1,
        curveSegments: 24
      });
      upperSaddleGeo.translate(0, -L, -0.17);
      rUnit.add(new THREE.Mesh(upperSaddleGeo, mats.forgedSteel));

      // 5.4 可在深度拆解时分离下移的涨断连杆大头盖 + 轴瓦 + 2颗ARP连杆螺栓!
      const rodCapGroup = new THREE.Group();
      rodCapGroup.position.set(0, -L, 0);

      const lowerCapShape = new THREE.Shape();
      lowerCapShape.moveTo(-0.46, 0);
      lowerCapShape.lineTo(-bigEndR, 0);
      lowerCapShape.absarc(0, 0, bigEndR, Math.PI, Math.PI * 2, false);
      lowerCapShape.lineTo(0.46, 0);
      lowerCapShape.lineTo(0.46, -0.16);
      lowerCapShape.lineTo(0.30, -0.36);
      lowerCapShape.lineTo(-0.30, -0.36);
      lowerCapShape.lineTo(-0.46, -0.16);
      lowerCapShape.closePath();

      const lowerCapGeo = new THREE.ExtrudeGeometry(lowerCapShape, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 1,
        curveSegments: 24
      });
      lowerCapGeo.translate(0, 0, -0.17);
      rodCapGroup.add(new THREE.Mesh(lowerCapGeo, mats.forgedSteel));

      // 下半片精密轴瓦
      const bearingShell = new THREE.Mesh(
        new THREE.CylinderGeometry(bigEndR - 0.004, bigEndR - 0.004, 0.35, 24, 1, true, Math.PI * 0.5, Math.PI),
        mats.polishedChrome
      );
      bearingShell.rotation.z = Math.PI * 0.5;
      bearingShell.rotation.y = Math.PI * 0.5;
      rodCapGroup.add(bearingShell);

      // 2颗 ARP 连杆螺栓
      [-0.36, 0.36].forEach((bx) => {
        const rBolt = createBoltMesh(0.052, 0.38, mats.gunmetalSteel);
        rBolt.rotation.x = Math.PI;
        rBolt.position.set(bx, -0.16, 0);
        rodCapGroup.add(rBolt);
      });

      rUnit.add(rodCapGroup);
      rUnit.position.set(0, 2.0, S.cylZ[i]);
      rodsGroup.add(rUnit);
      rodUnits.push({ group: rUnit, rodCapGroup });
    }

    tagPartGroup(rodsGroup, 'connecting_rods');

    // ==================== 6. 双质量飞轮与膜片弹簧离合器压盘 (flywheel_clutch) ====================
    const flywheelGroup = new THREE.Group();
    const flywheelRotor = new THREE.Group();
    flywheelGroup.add(flywheelRotor);

    // 子组件1: 双质量飞轮 + 72齿高频淬火起动外齿圈
    const fwSub = new THREE.Group();
    fwSub.position.z = S.flywheelZ;

    // 72齿精密外齿圈
    const ringGearGeo = createGearGeometry({
      outerRadius: 1.66,
      rootRadius: 1.57,
      boreRadius: 1.44,
      teeth: 64,
      thickness: 0.16
    });
    fwSub.add(new THREE.Mesh(ringGearGeo, mats.gunmetalSteel));

    // CNC 同心拉丝灰铸铁飞轮主盘
    const fwDiscGeo = createGearGeometry({
      outerRadius: 1.46,
      rootRadius: 1.46,
      boreRadius: 0.22,
      teeth: 36,
      thickness: 0.26,
      lighteningHoles: 8,
      holeRingRadius: 0.98,
      holeRadius: 0.13
    });
    fwSub.add(new THREE.Mesh(fwDiscGeo, mats.machinedAluminum));

    // 中心 8 颗高强度飞轮紧固螺栓
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * Math.PI * 2;
      const bolt = createBoltMesh(0.052, 0.18, mats.gunmetalSteel);
      bolt.rotation.x = -Math.PI * 0.5;
      bolt.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, -0.13);
      fwSub.add(bolt);
    }
    flywheelRotor.add(fwSub);

    // 子组件2: 离合器碳纤摩擦片 (含花键毂 + 4组扭振减振螺旋弹簧!)
    const clutchDiscSub = new THREE.Group();
    clutchDiscSub.position.z = S.flywheelZ - 0.24;

    const frictionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.32, 40),
      mats.clutchFriction
    );
    const frictionThick = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.32, 0.08, 40),
      mats.clutchFriction
    );
    frictionThick.rotation.x = Math.PI * 0.5;
    clutchDiscSub.add(frictionRing);
    clutchDiscSub.add(frictionThick);

    // 中心金属减振盘与内花键轴套
    const damperPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 0.84, 0.05, 32),
      mats.forgedSteel
    );
    damperPlate.rotation.x = Math.PI * 0.5;
    clutchDiscSub.add(damperPlate);

    const splineHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.28, 18),
      mats.gunmetalSteel
    );
    splineHub.rotation.x = Math.PI * 0.5;
    clutchDiscSub.add(splineHub);

    // 4 只周向布置的扭转减振螺旋弹簧!
    const damperSpringGeo = createHelicalSpringGeometry(0.085, 0.018, 0.30, 4.5);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      const sp = new THREE.Mesh(damperSpringGeo, mats.copperWinding);
      sp.position.set(Math.cos(a) * 0.54, Math.sin(a) * 0.54, -0.04);
      sp.rotation.z = a; // 沿切向布置弹簧!
      sp.translateY(-0.15);
      clutchDiscSub.add(sp);
    }
    flywheelRotor.add(clutchDiscSub);

    // 子组件3: 膜片弹簧离合器压盘盖总成 (Pressure Plate & 18 Diaphragm Spring Fingers)
    const pressurePlateSub = new THREE.Group();
    pressurePlateSub.position.z = S.flywheelZ - 0.48;

    // 冲压钢外压盘罩壳环
    const coverRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.18, 14, 40),
      mats.machinedAluminum
    );
    pressurePlateSub.add(coverRing);

    const outerFlange = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.42, 0.06, 36, 1, true),
      mats.castAluminum
    );
    outerFlange.rotation.x = Math.PI * 0.5;
    pressurePlateSub.add(outerFlange);

    // 18 片放射状锥形膜片弹簧分离指爪 (Diaphragm Spring Fingers)
    for (let f = 0; f < 18; f++) {
      const a = (f / 18) * Math.PI * 2;
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.58, 0.025),
        mats.gunmetalSteel
      );
      finger.position.set(Math.cos(a) * 0.68, Math.sin(a) * 0.68, -0.06);
      finger.rotation.z = a - Math.PI * 0.5;
      finger.rotation.x = 0.16;
      pressurePlateSub.add(finger);
    }
    flywheelRotor.add(pressurePlateSub);

    tagPartGroup(flywheelGroup, 'flywheel_clutch');

    /**
     * 每帧实时更新曲轴、4支活塞、12道活塞环、4支活塞销、4支连杆与飞轮离合器的运动学姿态
     * @param {number} cycleAngleRad 0 ~ 4π 四冲程循环角 (等于曲轴机械转角)
     * @param {number} masterExplode 0.0 ~ 1.0 全局拆解进度 (用于控制三道活塞环分层、连杆瓦盖与离合器三件套子级微距展开!)
     */
    function updateKinematics(cycleAngleRad, masterExplode = 0) {
      crankRotor.rotation.z = -cycleAngleRad;
      flywheelRotor.rotation.z = -cycleAngleRad;

      const subSpread = Math.max(0, (masterExplode - 0.45) / 0.55);

      // 飞轮、离合器片、压盘三层子展开
      clutchDiscSub.position.z = S.flywheelZ - 0.24 - subSpread * 0.85;
      pressurePlateSub.position.z = S.flywheelZ - 0.48 - subSpread * 1.75;

      const r = S.crankRadius;
      const l = S.rodLength;

      for (let i = 0; i < 4; i++) {
        const theta = cycleAngleRad + S.crankPinPhaseRad[i];
        const xPin = r * Math.sin(theta);
        const yPin = r * Math.cos(theta);
        // 精确曲柄滑块活塞销高度: y = y_pin + sqrt(l^2 - x_pin^2)
        const yPiston = yPin + Math.sqrt(l * l - xPin * xPin);
        // 精确连杆摆角: beta = asin(x_pin / l)
        const rodAngle = Math.asin(xPin / l);

        pistonUnits[i].position.y = yPiston;
        pinUnits[i].position.y = yPiston;

        const rObj = ringUnits[i];
        rObj.group.position.y = yPiston;
        for (let k = 0; k < rObj.subRings.length; k++) {
          const sr = rObj.subRings[k];
          sr.position.y = sr.userData.baseLocalY + sr.userData.spreadOrder * subSpread * 0.26;
        }

        const rodObj = rodUnits[i];
        rodObj.group.position.y = yPiston;
        rodObj.group.rotation.z = rodAngle;
        // 深度拆解时连杆涨断瓦盖沿杆身轴线向下微拆分离
        rodObj.rodCapGroup.position.y = -l - subSpread * 0.52;
      }
    }

    // 初始化在 0° 状态
    updateKinematics(0, 0);

    return {
      parts: {
        crankshaft: crankshaftGroup,
        pistons: pistonsGroup,
        piston_rings: ringsGroup,
        wrist_pins: pinsGroup,
        connecting_rods: rodsGroup,
        flywheel_clutch: flywheelGroup
      },
      updateKinematics
    };
  }

  ns.buildCranktrainParts = buildCranktrainParts;
})(window.EngineApp);
