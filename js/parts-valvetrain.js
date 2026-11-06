/**
 * DOHC 16气门气缸盖与配气机构总成模块
 * 包含: 铝合金气缸盖、16支进排气门、16根实时动态压缩三维螺旋弹簧、16只液压挺柱、
 *       进排气双顶置凸轮轴(精确1:2转速与点火顺序相位)、10道凸轮轴承盖、红头气门室罩盖、机油加注口盖
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const {
    tagPartGroup,
    createBoltMesh,
    createCamLobeGeometry,
    createHelicalSpringGeometry,
    evalCamLiftRatio
  } = ns.GeoHelpers;

  const DEG2RAD = Math.PI / 180;

  function makeRoundedRectShape(halfW, halfL, r) {
    const s = new THREE.Shape();
    s.moveTo(-halfW + r, -halfL);
    s.lineTo(halfW - r, -halfL);
    s.quadraticCurveTo(halfW, -halfL, halfW, -halfL + r);
    s.lineTo(halfW, halfL - r);
    s.quadraticCurveTo(halfW, halfL, halfW - r, halfL);
    s.lineTo(-halfW + r, halfL);
    s.quadraticCurveTo(-halfW, halfL, -halfW, halfL - r);
    s.lineTo(-halfW, -halfL + r);
    s.quadraticCurveTo(-halfW, -halfL, -halfW + r, -halfL);
    return s;
  }

  /**
   * 生成气门室盖顶部性能铭牌纹理 ("2.0T DOHC 16V TURBO GDI")
   */
  function createBadgeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b91c28';
    ctx.fillRect(0, 0, 512, 128);

    // 金属拉丝边框
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);

    // 银色散热装饰斜纹
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 24; x < 120; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 22);
      ctx.lineTo(x + 10, 22);
      ctx.lineTo(x - 6, 106);
      ctx.lineTo(x - 16, 106);
      ctx.fill();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2.0T  DOHC  16V', 285, 50);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText('DIRECT INJECTION · TWIN-SCROLL TURBO', 285, 90);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function buildValvetrainParts(mats) {
    const S = ENGINE_SPEC;
    const headHalfW = 1.12;
    const headHalfL = S.blockFrontZ; // 3.30

    // ==================== 1. DOHC 16气门气缸盖 (cylinder_head) ====================
    const headGroup = new THREE.Group();

    // 1.1 气缸盖下半层燃烧室与气道座体 (Y = 3.20 ~ 3.92)
    const lowerHeadH = 0.72;
    const lowerShape = makeRoundedRectShape(headHalfW, headHalfL, 0.16);
    // 挖出 4 个中心火花塞孔 + 16 个气门导管通孔
    S.cylZ.forEach((cz) => {
      const spHole = new THREE.Path();
      spHole.absarc(0, -cz, 0.14, 0, Math.PI * 2, true);
      lowerShape.holes.push(spHole);

      [-0.25, 0.25].forEach((vz) => {
        [-0.32, 0.32].forEach((vx) => {
          const vHole = new THREE.Path();
          vHole.absarc(vx, -(cz + vz), 0.11, 0, Math.PI * 2, true);
          lowerShape.holes.push(vHole);
        });
      });
    });

    const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, {
      depth: lowerHeadH,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
      curveSegments: 24
    });
    lowerGeo.rotateX(-Math.PI * 0.5);
    const lowerMesh = new THREE.Mesh(lowerGeo, mats.castAluminum);
    lowerMesh.position.y = S.headBottomY;
    headGroup.add(lowerMesh);

    // 1.2 气缸盖上半层凸轮轴油池边框墙 (Y = 3.92 ~ 4.62，中间掏空露出内部16根气门弹簧与挺柱!)
    const trayWallH = S.headTopY - (S.headBottomY + lowerHeadH); // 0.70
    const trayShape = makeRoundedRectShape(headHalfW, headHalfL, 0.16);
    const innerTray = new THREE.Path();
    const inW = 0.92;
    const inL = headHalfL - 0.26;
    innerTray.moveTo(-inW, -inL);
    innerTray.lineTo(inW, -inL);
    innerTray.lineTo(inW, inL);
    innerTray.lineTo(-inW, inL);
    innerTray.closePath();
    trayShape.holes.push(innerTray);

    const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
      depth: trayWallH,
      bevelEnabled: false
    });
    trayGeo.rotateX(-Math.PI * 0.5);
    const trayMesh = new THREE.Mesh(trayGeo, mats.castAluminum);
    trayMesh.position.y = S.headBottomY + lowerHeadH;
    headGroup.add(trayMesh);

    // 1.3 4 根中心火花塞铝合金隔离井管 (Spark Plug Tubes) + 屋脊燃烧室青铜气门座圈
    S.cylZ.forEach((cz) => {
      const wellTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, trayWallH + 0.08, 22, 1, true),
        mats.machinedAluminum
      );
      wellTube.position.set(0, S.headBottomY + lowerHeadH + trayWallH * 0.5, cz);
      headGroup.add(wellTube);

      // 4只青铜粉末冶金气门座圈镶嵌在燃烧室顶面
      [-0.24, 0.24].forEach((vz) => {
        // 进气座圈稍大 (直径大进气足)，排气座圈稍小
        const inSeat = new THREE.Mesh(
          new THREE.TorusGeometry(0.175, 0.022, 10, 24),
          mats.copperWinding
        );
        inSeat.rotation.x = Math.PI * 0.5;
        inSeat.rotation.y = S.valveTiltRad;
        inSeat.position.set(-0.24, S.headBottomY + 0.16, cz + vz);
        headGroup.add(inSeat);

        const exSeat = new THREE.Mesh(
          new THREE.TorusGeometry(0.155, 0.022, 10, 24),
          mats.copperWinding
        );
        exSeat.rotation.x = Math.PI * 0.5;
        exSeat.rotation.y = -S.valveTiltRad;
        exSeat.position.set(0.24, S.headBottomY + 0.16, cz + vz);
        headGroup.add(exSeat);
      });

      // 进气侧 (-X) 与排气侧 (+X) 气道凸台接口法兰
      const inPortBoss = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.42, 0.92),
        mats.machinedAluminum
      );
      inPortBoss.position.set(-headHalfW - 0.04, S.headBottomY + 0.56, cz);
      headGroup.add(inPortBoss);

      const inPortHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.19, 20),
        mats.blackPolymer
      );
      inPortHole.rotation.z = Math.PI * 0.5;
      inPortHole.scale.set(1, 1, 1.45);
      inPortHole.position.set(-headHalfW - 0.05, S.headBottomY + 0.56, cz);
      headGroup.add(inPortHole);

      const exPortBoss = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.40, 0.88),
        mats.machinedAluminum
      );
      exPortBoss.position.set(headHalfW + 0.04, S.headBottomY + 0.52, cz);
      headGroup.add(exPortBoss);

      const exPortHole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.19, 20),
        mats.blackPolymer
      );
      exPortHole.rotation.z = Math.PI * 0.5;
      exPortHole.scale.set(1, 1, 1.35);
      exPortHole.position.set(headHalfW + 0.05, S.headBottomY + 0.52, cz);
      headGroup.add(exPortHole);
    });

    // 1.4 5 道下半圆凸轮轴承支承横梁 + 10 颗长杆 12.9级缸盖紧固螺栓
    S.mainZ.forEach((mz) => {
      [S.intakeCamX, S.exhaustCamX].forEach((cx) => {
        const pedestal = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.62, 0.22),
          mats.darkCastAluminum
        );
        pedestal.position.set(cx, S.camY - 0.42, mz);
        headGroup.add(pedestal);
      });

      [-0.88, 0.88].forEach((bx) => {
        const hBolt = createBoltMesh(0.066, 1.45, mats.gunmetalSteel);
        hBolt.position.set(bx, S.headBottomY + lowerHeadH + 0.02, mz);
        headGroup.add(hBolt);
      });
    });

    tagPartGroup(headGroup, 'cylinder_head');

    // ==================== 2. 16支进排气门、螺旋弹簧与液压挺柱 ====================
    const intakeValvesGroup = new THREE.Group();
    const exhaustValvesGroup = new THREE.Group();
    const valveAnimItems = []; // 记录全部16支气门动画句柄

    const springFreeH = 0.54;
    const sharedSpringGeo = createHelicalSpringGeometry(0.125, 0.020, springFreeH, 6.5);

    /**
     * 创建单支气门+弹簧+挺柱斜置单元
     * isIntake: true 进气门(-X侧, 向上往左偏 +tilt), false 排气门(+X侧, 向上往右偏 -tilt)
     */
    function createSingleValveUnit(cylIdx, zOffset, isIntake) {
      const slot = new THREE.Group();
      const headRadius = isIntake ? 0.182 : 0.162;
      const tilt = isIntake ? S.valveTiltRad : -S.valveTiltRad;
      const baseX = isIntake ? -0.255 : 0.255;
      const baseY = S.headBottomY + 0.16;
      const baseZ = S.cylZ[cylIdx] + zOffset;

      slot.position.set(baseX, baseY, baseZ);
      // 绕 Z 轴旋转: 当 tilt > 0 时，局部 +Y 轴指向 (-sin(tilt), cos(tilt), 0) 正好对准进气凸轮轴!
      slot.rotation.z = tilt;

      // 下弹簧座垫圈与青铜气门导管 (随缸盖静态定位)
      const guide = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.068, 0.44, 14),
        mats.brassMetal
      );
      guide.position.y = 0.28;
      slot.add(guide);

      // 实时可压缩三维螺旋气门弹簧 (底端固定在局部 y = 0.34)
      const springMesh = new THREE.Mesh(sharedSpringGeo, mats.gunmetalSteel);
      springMesh.position.y = 0.34;
      slot.add(springMesh);

      // 随凸轮升程往复运动的气门杆盘头组件
      const valveMover = new THREE.Group();

      // 喇叭形气门盘头 (45°密封锥面 + 弧形颈部过渡)
      const headPts = [
        new THREE.Vector2(0.0, -0.02),
        new THREE.Vector2(headRadius, -0.02),
        new THREE.Vector2(headRadius, 0.012),
        new THREE.Vector2(0.055, 0.085),
        new THREE.Vector2(0.036, 0.18),
        new THREE.Vector2(0.036, 0.90),
        new THREE.Vector2(0.0, 0.90)
      ];
      const vGeo = new THREE.LatheGeometry(headPts, 24);
      const vMesh = new THREE.Mesh(vGeo, isIntake ? mats.polishedChrome : mats.forgedSteel);
      valveMover.add(vMesh);

      // 上弹簧座钛合金锁盘 (Retainer)
      const retainer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.132, 0.095, 0.06, 18),
        mats.machinedAluminum
      );
      retainer.position.y = 0.34 + springFreeH;
      valveMover.add(retainer);

      // 杯形液压挺柱 (Hydraulic Bucket Tappet)
      const tappetGroup = new THREE.Group();
      const tappetCup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.158, 0.158, 0.20, 22),
        mats.polishedChrome
      );
      tappetCup.position.y = 0.98;
      tappetGroup.add(tappetCup);
      valveMover.add(tappetGroup);

      slot.add(valveMover);

      return {
        slot,
        cylIdx,
        isIntake,
        springMesh,
        valveMover,
        tappetGroup
      };
    }

    for (let i = 0; i < 4; i++) {
      [-0.245, 0.245].forEach((vz) => {
        const inItem = createSingleValveUnit(i, vz, true);
        intakeValvesGroup.add(inItem.slot);
        valveAnimItems.push(inItem);

        const exItem = createSingleValveUnit(i, vz, false);
        exhaustValvesGroup.add(exItem.slot);
        valveAnimItems.push(exItem);
      });
    }

    tagPartGroup(intakeValvesGroup, 'valves_intake');
    tagPartGroup(exhaustValvesGroup, 'valves_exhaust');

    // ==================== 3. 进气凸轮轴与排气凸轮轴 (intake_camshaft / exhaust_camshaft) ====================
    function buildCamshaft(isIntake) {
      const camGroup = new THREE.Group();
      const camRotor = new THREE.Group();
      const camX = isIntake ? S.intakeCamX : S.exhaustCamX;
      camRotor.position.set(camX, S.camY, 0);
      camGroup.add(camRotor);

      // 中空淬火凸轮轴主轴杆
      const shaftLen = 6.65;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.135, shaftLen, 24),
        mats.forgedSteel
      );
      shaft.rotation.x = Math.PI * 0.5;
      shaft.position.z = 0.10;
      camRotor.add(shaft);

      // 5 道镜面凸轮轴颈 (Cam Journals)
      S.mainZ.forEach((mz) => {
        const jMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.195, 0.195, 0.25, 24),
          mats.polishedChrome
        );
        jMesh.rotation.x = Math.PI * 0.5;
        jMesh.position.z = mz;
        camRotor.add(jMesh);
      });

      // 8 枚精确相位角水滴形凸轮桃尖 (Cam Lobes)
      // 进气挺柱相对于进气凸轮轴在右下方: 从+Y顺时针角 = 180° - 15.5° = 164.5°
      // 排气挺柱相对于排气凸轮轴在左下方: 从+Y顺时针角 = 180° + 15.5° = 195.5°
      const targetWorldAngleDeg = isIntake ? (180 - 15.5) : (180 + 15.5);
      const peakLocalCycleDeg = isIntake ? 455 : 265;

      for (let i = 0; i < 4; i++) {
        const globalPeakCycleDeg = S.cylPhaseOffsetDeg[i] + peakLocalCycleDeg;
        const installAngleDeg = targetWorldAngleDeg - globalPeakCycleDeg * 0.5;

        const lobeGeo = createCamLobeGeometry(0.245, S.maxValveLift, 0.15, 1.02);
        // createCamLobeGeometry 默认桃尖在 +Y (0°)，顺时针旋转 installAngleDeg 等价于绕 +Z 旋转 -installAngleRad
        lobeGeo.rotateZ(-installAngleDeg * DEG2RAD);

        [-0.245, 0.245].forEach((vz) => {
          const lobeMesh = new THREE.Mesh(lobeGeo, mats.polishedChrome);
          lobeMesh.position.z = S.cylZ[i] + vz;
          camRotor.add(lobeMesh);
        });
      }

      // 排气凸轮轴后端额外集成驱动 GDI 高压燃油泵的四方凸轮桃 (4-Lobe HPFP Cam)!
      if (!isIntake) {
        const quadShape = new THREE.Shape();
        const segs = 64;
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          const r = 0.22 + 0.055 * Math.pow(Math.cos(2 * a), 2);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (s === 0) quadShape.moveTo(x, y);
          else quadShape.lineTo(x, y);
        }
        const quadGeo = new THREE.ExtrudeGeometry(quadShape, { depth: 0.20, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 });
        quadGeo.translate(0, 0, -0.10);
        const quadCam = new THREE.Mesh(quadGeo, mats.polishedChrome);
        quadCam.position.z = -2.68;
        camRotor.add(quadCam);
      }

      tagPartGroup(camGroup, isIntake ? 'intake_camshaft' : 'exhaust_camshaft');
      return { group: camGroup, rotor: camRotor };
    }

    const intakeCamObj = buildCamshaft(true);
    const exhaustCamObj = buildCamshaft(false);

    // ==================== 4. 凸轮轴轴承盖组 (cam_caps 10件 + 20颗螺栓) ====================
    const camCapsGroup = new THREE.Group();
    const capJRadius = 0.202;

    S.mainZ.forEach((mz) => {
      [S.intakeCamX, S.exhaustCamX].forEach((cx) => {
        const cShape = new THREE.Shape();
        cShape.moveTo(-0.34, 0);
        cShape.lineTo(-capJRadius, 0);
        cShape.absarc(0, 0, capJRadius, Math.PI, 0, true);
        cShape.lineTo(0.34, 0);
        cShape.lineTo(0.34, 0.14);
        cShape.lineTo(0.22, 0.28);
        cShape.lineTo(-0.22, 0.28);
        cShape.lineTo(-0.34, 0.14);
        cShape.closePath();

        const cGeo = new THREE.ExtrudeGeometry(cShape, {
          depth: 0.22,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.012,
          bevelSegments: 1,
          curveSegments: 20
        });
        cGeo.translate(cx, S.camY, mz - 0.11);
        camCapsGroup.add(new THREE.Mesh(cGeo, mats.machinedAluminum));

        [-0.27, 0.27].forEach((bx) => {
          const bolt = createBoltMesh(0.042, 0.26, mats.gunmetalSteel);
          bolt.position.set(cx + bx, S.camY + 0.14, mz);
          camCapsGroup.add(bolt);
        });
      });
    });

    tagPartGroup(camCapsGroup, 'cam_caps');

    // ==================== 5. 气门室罩盖总成 (valve_cover) ====================
    const coverGroup = new THREE.Group();
    const vcBotY = S.headTopY;
    const vcH = 0.72;

    // 5.1 黑色丁腈橡胶气门室密封圈 (Valve Cover Gasket)
    const gasketShape = makeRoundedRectShape(headHalfW - 0.02, headHalfL - 0.02, 0.15);
    const gasketHole = makeRoundedRectShape(headHalfW - 0.12, headHalfL - 0.12, 0.10);
    gasketShape.holes.push(new THREE.Path(gasketHole.getPoints(32)));
    const vcGasketGeo = new THREE.ExtrudeGeometry(gasketShape, { depth: 0.045, bevelEnabled: false });
    vcGasketGeo.rotateX(-Math.PI * 0.5);
    const vcGasketMesh = new THREE.Mesh(vcGasketGeo, mats.blackPolymer);
    vcGasketMesh.position.y = vcBotY;
    coverGroup.add(vcGasketMesh);

    // 5.2 压铸镁铝合金罩盖外主体 (带4个中心点火线圈孔)
    const coverShape = makeRoundedRectShape(headHalfW - 0.03, headHalfL - 0.03, 0.16);
    S.cylZ.forEach((cz) => {
      const wellHole = new THREE.Path();
      wellHole.absarc(0, -cz, 0.21, 0, Math.PI * 2, true);
      coverShape.holes.push(wellHole);
    });

    const coverGeo = new THREE.ExtrudeGeometry(coverShape, {
      depth: vcH,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 24
    });
    coverGeo.rotateX(-Math.PI * 0.5);
    const coverMesh = new THREE.Mesh(coverGeo, mats.darkCastAluminum);
    coverMesh.position.y = vcBotY + 0.045;
    coverGroup.add(coverMesh);

    // 两侧凸轮轴拱形加强隆起包 (Dual Cam Humps) + 横向散热筋
    [S.intakeCamX, S.exhaustCamX].forEach((cx, sideIdx) => {
      const hump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.42, headHalfL * 1.88, 24, 1, false, 0, Math.PI),
        sideIdx === 0 ? mats.redWrinkle : mats.redWrinkle
      );
      hump.rotation.z = Math.PI * 0.5;
      hump.rotation.y = Math.PI * 0.5;
      hump.scale.set(1, 0.55, 1);
      hump.position.set(cx, vcBotY + vcH + 0.04, 0);
      coverGroup.add(hump);
    });

    // 顶部金属拉丝装饰铭牌 ("2.0T DOHC 16V TURBO GDI")
    const badgeMat = new THREE.MeshStandardMaterial({
      map: createBadgeTexture(),
      metalness: 0.45,
      roughness: 0.32
    });
    const badgePlane = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.035, 2.35), badgeMat);
    // 让铭牌字正面朝上可读
    badgePlane.rotation.y = Math.PI * 0.5;
    badgePlane.scale.set(2.35 / 0.56, 1, 0.56 / 2.35);
    // 直接用精确尺寸 Box 贴在进气侧上方
    const cleanBadge = new THREE.Mesh(new THREE.PlaneGeometry(2.40, 0.56), badgeMat);
    cleanBadge.rotation.x = -Math.PI * 0.5;
    cleanBadge.rotation.z = -Math.PI * 0.5;
    cleanBadge.position.set(S.intakeCamX, vcBotY + vcH + 0.25, -0.32);
    coverGroup.add(cleanBadge);

    // 加机油口底座圆颈 (位于前端进气侧上方)
    const fillerNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.27, 0.20, 24),
      mats.machinedAluminum
    );
    fillerNeck.position.set(S.intakeCamX, vcBotY + vcH + 0.24, 2.35);
    coverGroup.add(fillerNeck);

    // 周边 10 颗气门室盖紧固螺栓
    for (let zIdx = 0; zIdx < 5; zIdx++) {
      const bz = -2.85 + zIdx * 1.425;
      [-headHalfW + 0.08, headHalfW - 0.08].forEach((bx) => {
        const vBolt = createBoltMesh(0.048, 0.16, mats.polishedChrome);
        vBolt.position.set(bx, vcBotY + vcH + 0.06, bz);
        coverGroup.add(vBolt);
      });
    }

    tagPartGroup(coverGroup, 'valve_cover');

    // ==================== 6. 机油加注口盖 (oil_filler_cap) ====================
    const fillerCapGroup = new THREE.Group();
    fillerCapGroup.position.set(S.intakeCamX, vcBotY + vcH + 0.36, 2.35);

    const capBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.26, 0.12, 28),
      mats.blackPolymer
    );
    fillerCapGroup.add(capBase);

    // 手拧防滑凸脊横梁
    const gripBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 0.13),
      mats.blackPolymer
    );
    gripBar.position.y = 0.09;
    fillerCapGroup.add(gripBar);

    // 黄色机油壶图标圆标贴环
    const capRing = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.23, 24),
      mats.safetyYellow
    );
    capRing.rotation.x = -Math.PI * 0.5;
    capRing.position.y = 0.062;
    fillerCapGroup.add(capRing);

    // 底部氟橡胶密封O型圈
    const oRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.025, 10, 24),
      mats.redWrinkle
    );
    oRing.rotation.x = Math.PI * 0.5;
    oRing.position.y = -0.07;
    fillerCapGroup.add(oRing);

    tagPartGroup(fillerCapGroup, 'oil_filler_cap');

    /**
     * 每帧实时更新双顶置凸轮轴旋转、16支气门开闭位移与16根螺旋弹簧压缩形变
     */
    function updateValvetrain(cycleAngleRad, masterExplode = 0) {
      // 凸轮轴转速精确为曲轴转速的 1/2
      const camRot = -cycleAngleRad * 0.5;
      intakeCamObj.rotor.rotation.z = camRot;
      exhaustCamObj.rotor.rotation.z = camRot;

      const cycleDeg = ((cycleAngleRad / DEG2RAD) % 720 + 720) % 720;
      const subSpread = Math.max(0, (masterExplode - 0.50) / 0.50);

      for (let k = 0; k < valveAnimItems.length; k++) {
        const item = valveAnimItems[k];
        const localDeg = (cycleDeg - S.cylPhaseOffsetDeg[item.cylIdx] + 720) % 720;

        // 进气门峰值在 455° (持续 225°), 排气门峰值在 265° (持续 225°), 在 360° 附近呈现真实气门重叠角!
        const liftRatio = item.isIntake
          ? evalCamLiftRatio(localDeg, 455, 225)
          : evalCamLiftRatio(localDeg, 265, 225);

        const lift = liftRatio * S.maxValveLift;

        // 气门下压开启 + 深度拆解时气门与挺柱沿轴线分层微拆
        item.valveMover.position.y = -lift - subSpread * 0.35;
        item.tappetGroup.position.y = subSpread * 0.72;

        // 三维螺旋弹簧实时随气门下压压缩，上端紧贴锁盘!
        const compressedH = Math.max(0.18, springFreeH - lift);
        item.springMesh.scale.y = compressedH / springFreeH;
      }
    }

    updateValvetrain(0, 0);

    return {
      parts: {
        cylinder_head: headGroup,
        valves_intake: intakeValvesGroup,
        valves_exhaust: exhaustValvesGroup,
        intake_camshaft: intakeCamObj.group,
        exhaust_camshaft: exhaustCamObj.group,
        cam_caps: camCapsGroup,
        valve_cover: coverGroup,
        oil_filler_cap: fillerCapGroup
      },
      updateValvetrain
    };
  }

  ns.buildValvetrainParts = buildValvetrainParts;
})(window.EngineApp);
