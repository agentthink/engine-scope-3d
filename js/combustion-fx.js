/**
 * 四冲程热力学燃烧室可视化特效与三维爆炸装配引导线系统
 * 实时同步各缸活塞行程: 吸气(冰蓝+GDI喷雾) -> 压缩(升温琥珀) -> 点火电弧与做功爆发(炽热金橙火焰) -> 排气(暗红废气)
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const DEG2RAD = Math.PI / 180;

  function createSparkGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.22, 'rgba(147, 197, 253, 0.95)');
    grad.addColorStop(0.55, 'rgba(59, 130, 246, 0.45)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    // 十字放电星芒
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 8); ctx.lineTo(64, 120);
    ctx.moveTo(8, 64); ctx.lineTo(120, 64);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  function buildCombustionAndGuides(scene, engineRoot) {
    const S = ENGINE_SPEC;
    const fxGroup = new THREE.Group();
    fxGroup.name = 'combustion_fx_group';
    engineRoot.add(fxGroup);

    const sparkTex = createSparkGlowTexture();
    const cylFX = [];

    const colIntake = new THREE.Color(0x38bdf8);
    const colComp = new THREE.Color(0xf59e0b);
    const colPowerHot = new THREE.Color(0xfff3b0);
    const colPowerMid = new THREE.Color(0xff4d00);
    const colExhaust = new THREE.Color(0x9f3a24);
    const tmpColor = new THREE.Color();

    // 共享一盏动态跳转到当前点火气缸的高亮燃烧室内点光源，性能极佳且照明逼真!
    const sparkPointLight = new THREE.PointLight(0x93c5fd, 0, 2.8, 2.0);
    fxGroup.add(sparkPointLight);

    for (let i = 0; i < 4; i++) {
      const cz = S.cylZ[i];

      // 1. 气缸内动态气体/火焰容积圆柱 (高度 1.0，顶面对齐 y=0，向下延伸至 y=-1.0)
      const volGeo = new THREE.CylinderGeometry(S.boreRadius - 0.025, S.boreRadius - 0.025, 1.0, 28, 1, false);
      volGeo.translate(0, -0.5, 0);
      const volMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const volMesh = new THREE.Mesh(volGeo, volMat);
      volMesh.position.set(0, S.headBottomY + 0.14, cz);
      volMesh.renderOrder = 8;
      fxGroup.add(volMesh);

      // 2. 火花塞电极跳火电弧 Sprite + 锯齿闪电折线
      const sparkMat = new THREE.SpriteMaterial({
        map: sparkTex,
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const sparkSprite = new THREE.Sprite(sparkMat);
      sparkSprite.position.set(0, 3.29, cz);
      sparkSprite.scale.set(0.55, 0.55, 1);
      sparkSprite.renderOrder = 10;
      fxGroup.add(sparkSprite);

      // 3. 做功初期燃烧火焰核膨胀球 (Flame Kernel Sphere)
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const flameBall = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), flameMat);
      flameBall.position.set(0, 3.24, cz);
      flameBall.renderOrder = 9;
      fxGroup.add(flameBall);

      // 4. GDI 侧置直喷雾化燃油束锥 (Direct Injection Fuel Spray Cone)
      const sprayGeo = new THREE.ConeGeometry(0.24, 0.72, 18, 1, true);
      sprayGeo.translate(0, -0.36, 0);
      const sprayMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const sprayCone = new THREE.Mesh(sprayGeo, sprayMat);
      sprayCone.position.set(-0.52, 3.24, cz);
      sprayCone.rotation.z = 0.78; // 朝向气缸中心下方斜喷!
      sprayCone.renderOrder = 9;
      fxGroup.add(sprayCone);

      cylFX.push({
        volMesh,
        volMat,
        sparkSprite,
        sparkMat,
        flameBall,
        flameMat,
        sprayCone,
        sprayMat,
        cz
      });
    }

    // ==================== 三维爆炸拆解装配引导虚线 (Assembly Guide Lines) ====================
    const guidesGroup = new THREE.Group();
    guidesGroup.name = 'assembly_guides_group';
    engineRoot.add(guidesGroup);

    const guideMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.14,
      gapSize: 0.09,
      transparent: true,
      opacity: 0.58,
      depthTest: true
    });

    const dotGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75
    });

    const guideRecords = new Map();

    function initGuideLines(partObjectsMap, partCatalog) {
      Object.keys(partObjectsMap).forEach((pid) => {
        const meta = partCatalog[pid];
        const obj = partObjectsMap[pid];
        if (!meta || !obj) return;
        const vec = meta.explodeVec;
        if (!vec || (vec[0] === 0 && vec[1] === 0 && vec[2] === 0)) return;

        // 计算零件在组装原位时的几何包围盒中心作为引导线起点锚点!
        const box = new THREE.Box3().setFromObject(obj);
        const anchor = new THREE.Vector3();
        box.getCenter(anchor);

        const pts = [anchor.clone(), anchor.clone()];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(lineGeo, guideMat);
        line.computeLineDistances();
        line.visible = false;

        const endDot = new THREE.Mesh(dotGeo, dotMat);
        endDot.visible = false;

        guidesGroup.add(line);
        guidesGroup.add(endDot);

        guideRecords.set(pid, {
          anchor,
          line,
          endDot,
          partObj: obj
        });
      });
    }

    function updateGuideLines(showGuides) {
      guidesGroup.visible = showGuides;
      if (!showGuides) return;

      guideRecords.forEach((rec) => {
        const offset = rec.partObj.position;
        const distSq = offset.lengthSq();
        if (!rec.partObj.visible || distSq < 0.015) {
          rec.line.visible = false;
          rec.endDot.visible = false;
          return;
        }
        rec.line.visible = true;
        rec.endDot.visible = true;

        const posArr = rec.line.geometry.attributes.position.array;
        posArr[0] = rec.anchor.x;
        posArr[1] = rec.anchor.y;
        posArr[2] = rec.anchor.z;
        posArr[3] = rec.anchor.x + offset.x;
        posArr[4] = rec.anchor.y + offset.y;
        posArr[5] = rec.anchor.z + offset.z;
        rec.line.geometry.attributes.position.needsUpdate = true;
        rec.line.computeLineDistances();

        rec.endDot.position.set(
          rec.anchor.x + offset.x,
          rec.anchor.y + offset.y,
          rec.anchor.z + offset.z
        );
      });
    }

    /**
     * 每帧更新四冲程热力学燃烧室特效，并返回4个气缸各自的冲程遥测状态供 HUD 显示
     */
    function updateCombustionFX(cycleAngleRad, enabled = true) {
      fxGroup.visible = enabled;
      const cycleDeg = ((cycleAngleRad / DEG2RAD) % 720 + 720) % 720;
      const r = S.crankRadius;
      const l = S.rodLength;

      let activeSparkLightIntensity = 0;
      let activeSparkZ = 0;
      const telemetry = [];

      for (let i = 0; i < 4; i++) {
        const localDeg = (cycleDeg - S.cylPhaseOffsetDeg[i] + 720) % 720;

        // 活塞顶面当前世界高度
        const theta = cycleAngleRad + S.crankPinPhaseRad[i];
        const xPin = r * Math.sin(theta);
        const yPin = r * Math.cos(theta);
        const pistonCrownY = yPin + Math.sqrt(l * l - xPin * xPin) + S.pistonCompHeight;
        const chamberTopY = S.headBottomY + 0.14;
        const chamberHeight = Math.max(0.12, chamberTopY - pistonCrownY);

        const fx = cylFX[i];
        fx.volMesh.scale.y = chamberHeight;

        let strokeKey = 'power';
        let strokeName = '做功冲程';
        let strokeProgress = 0;

        fx.sparkMat.opacity = 0;
        fx.flameMat.opacity = 0;
        fx.sprayMat.opacity = 0;

        if (localDeg >= 0 && localDeg < 180) {
          // 1. 做功冲程 (Power / Expansion: 0° ~ 180°)
          strokeKey = 'power';
          strokeName = '🔥 做功';
          strokeProgress = localDeg / 180;

          // 上止点附近 0° ~ 24° 火花塞强电弧闪光!
          if (localDeg < 24) {
            const spk = 1.0 - localDeg / 24;
            fx.sparkMat.opacity = spk;
            fx.sparkSprite.scale.setScalar(0.35 + spk * 0.42);
            if (spk > activeSparkLightIntensity) {
              activeSparkLightIntensity = spk;
              activeSparkZ = fx.cz;
            }
          }

          // 火焰核迅速膨胀充满气缸
          if (localDeg < 65) {
            const flm = localDeg / 65;
            fx.flameMat.opacity = (1.0 - flm) * 0.85;
            fx.flameBall.scale.set(0.35 + flm * 0.85, 0.25 + flm * 0.75, 0.35 + flm * 0.85);
            fx.flameBall.position.y = chamberTopY - chamberHeight * 0.35;
          }

          tmpColor.copy(colPowerHot).lerp(colPowerMid, Math.min(1, strokeProgress * 1.35));
          fx.volMat.color.copy(tmpColor);
          fx.volMat.opacity = (1.0 - strokeProgress * 0.68) * 0.58;

        } else if (localDeg >= 180 && localDeg < 360) {
          // 2. 排气冲程 (Exhaust: 180° ~ 360°)
          strokeKey = 'exhaust';
          strokeName = '💨 排气';
          strokeProgress = (localDeg - 180) / 180;

          fx.volMat.color.copy(colExhaust);
          fx.volMat.opacity = (1.0 - strokeProgress * 0.55) * 0.26;

        } else if (localDeg >= 360 && localDeg < 540) {
          // 3. 吸气冲程 (Intake: 360° ~ 540°)
          strokeKey = 'intake';
          strokeName = '❄️ 吸气';
          strokeProgress = (localDeg - 360) / 180;

          fx.volMat.color.copy(colIntake);
          fx.volMat.opacity = Math.sin(strokeProgress * Math.PI) * 0.34 + 0.08;

          // GDI 高压喷油嘴在 395° ~ 505° 喷射锥形油雾!
          if (localDeg > 395 && localDeg < 505) {
            const spRatio = Math.sin(((localDeg - 395) / 110) * Math.PI);
            fx.sprayMat.opacity = spRatio * 0.62;
            fx.sprayCone.scale.set(0.8 + spRatio * 0.35, 0.65 + strokeProgress * 0.55, 0.8 + spRatio * 0.35);
          }

        } else {
          // 4. 压缩冲程 (Compression: 540° ~ 720°)
          strokeKey = 'compression';
          strokeName = '⚡ 压缩';
          strokeProgress = (localDeg - 540) / 180;

          // 气体被压缩升温: 冰蓝 -> 暖琥珀橙，密度不透明度升高
          tmpColor.copy(colIntake).lerp(colComp, Math.pow(strokeProgress, 1.2));
          fx.volMat.color.copy(tmpColor);
          fx.volMat.opacity = 0.16 + strokeProgress * 0.38;

          // 上止点前点火提前角 (712° ~ 720°) 预跳火!
          if (localDeg > 710) {
            const preSpk = (localDeg - 710) / 10;
            fx.sparkMat.opacity = preSpk * 0.9;
          }
        }

        telemetry.push({
          cylNumber: i + 1,
          strokeKey,
          strokeName,
          progress: strokeProgress,
          localDeg
        });
      }

      if (enabled && activeSparkLightIntensity > 0.02) {
        sparkPointLight.intensity = activeSparkLightIntensity * 6.5;
        sparkPointLight.position.set(0, 3.15, activeSparkZ);
      } else {
        sparkPointLight.intensity = 0;
      }

      return telemetry;
    }

    return {
      fxGroup,
      guidesGroup,
      initGuideLines,
      updateGuideLines,
      updateCombustionFX
    };
  }

  ns.buildCombustionAndGuides = buildCombustionAndGuides;
})(window.EngineApp);
