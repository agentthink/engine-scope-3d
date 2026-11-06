/**
 * 气缸体总成模块 (Cylinder Block, Honed Liners, Main Bearing Caps, MLS Head Gasket)
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const { ENGINE_SPEC } = ns;
  const { tagPartGroup, createBoltMesh } = ns.GeoHelpers;

  /**
   * 构造带圆角的矩形 Shape (在 XZ 平面映射为 XY 平面后旋转)
   */
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

  function buildBlockParts(mats) {
    const S = ENGINE_SPEC;
    const blockHalfW = 1.06;
    const blockHalfL = S.blockFrontZ; // 3.30

    // ==================== 1. 铝合金气缸体 (cylinder_block) ====================
    const blockGroup = new THREE.Group();

    // 1.1 气缸体主体水套外框 (内部挖空4个大水道缸孔，避免遮挡内部活塞往复)
    const jacketHeight = S.blockTopY - S.linerBottomY - 0.08;
    const jacketShape = makeRoundedRectShape(blockHalfW, blockHalfL, 0.18);
    // 挖出一个长圆槽水道腔容纳4个气缸套
    const cavityPath = new THREE.Path();
    const cavW = S.boreRadius + 0.14;
    const cavL = S.cylZ[0] + S.boreRadius + 0.16;
    cavityPath.moveTo(-cavW, -cavL + 0.2);
    cavityPath.lineTo(cavW, -cavL + 0.2);
    cavityPath.lineTo(cavW, cavL - 0.2);
    cavityPath.quadraticCurveTo(cavW, cavL, cavW - 0.2, cavL);
    cavityPath.lineTo(-cavW + 0.2, cavL);
    cavityPath.quadraticCurveTo(-cavW, cavL, -cavW, cavL - 0.2);
    cavityPath.lineTo(-cavW, -cavL + 0.2);
    jacketShape.holes.push(cavityPath);

    const jacketGeo = new THREE.ExtrudeGeometry(jacketShape, {
      depth: jacketHeight,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2
    });
    jacketGeo.rotateX(-Math.PI * 0.5);
    const jacketMesh = new THREE.Mesh(jacketGeo, mats.castAluminum);
    jacketMesh.position.y = S.linerBottomY;
    blockGroup.add(jacketMesh);

    // 1.2 CNC 精密铣削闭式顶面板 (Closed-Deck Machined Surface，带4气缸孔+水道孔+10螺栓孔)
    const deckShape = makeRoundedRectShape(blockHalfW + 0.03, blockHalfL + 0.02, 0.18);
    S.cylZ.forEach((cz) => {
      // Shape 经过 rotateX(-PI/2) 后: shape.x -> X, shape.y -> -Z (故用 -cz)
      const boreHole = new THREE.Path();
      boreHole.absarc(0, -cz, S.boreRadius, 0, Math.PI * 2, true);
      deckShape.holes.push(boreHole);

      // 两侧月牙冷却水道孔
      [-0.76, 0.76].forEach((wx) => {
        const wHole = new THREE.Path();
        wHole.absellipse(wx, -cz, 0.075, 0.22, 0, Math.PI * 2, true, 0);
        deckShape.holes.push(wHole);
      });
    });

    // 10 个缸盖螺栓孔位 (位于5道隔板对应的两侧)
    S.mainZ.forEach((mz) => {
      [-0.88, 0.88].forEach((bx) => {
        const bHole = new THREE.Path();
        bHole.absarc(bx, -mz, 0.068, 0, Math.PI * 2, true);
        deckShape.holes.push(bHole);
      });
    });

    const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
      depth: 0.08,
      bevelEnabled: false,
      curveSegments: 28
    });
    deckGeo.rotateX(-Math.PI * 0.5);
    const deckMesh = new THREE.Mesh(deckGeo, mats.machinedAluminum);
    deckMesh.position.y = S.blockTopY - 0.08;
    blockGroup.add(deckMesh);

    // 1.3 四支激光交叉网纹珩磨气缸套 (Cylinder Liners)
    const linerH = S.blockTopY - S.linerBottomY;
    S.cylZ.forEach((cz) => {
      // 缸套内壁 (带交叉珩磨纹理)
      const innerLiner = new THREE.Mesh(
        new THREE.CylinderGeometry(S.boreRadius, S.boreRadius, linerH, 40, 1, true),
        mats.cylinderHoned
      );
      innerLiner.position.set(0, S.linerBottomY + linerH * 0.5, cz);
      blockGroup.add(innerLiner);

      // 缸套外壁 (浸泡在冷却水套腔内)
      const outerLiner = new THREE.Mesh(
        new THREE.CylinderGeometry(S.boreRadius + 0.075, S.boreRadius + 0.075, linerH - 0.02, 32, 1, true),
        mats.darkCastAluminum
      );
      outerLiner.position.set(0, S.linerBottomY + linerH * 0.5, cz);
      blockGroup.add(outerLiner);
    });

    // 1.4 深裙式曲轴箱两侧弧形裙部侧壁 (Crankcase Deep Skirt Walls)
    const skirtTopY = S.linerBottomY + 0.06;
    const skirtBotY = S.blockBottomY;
    const skirtH = skirtTopY - skirtBotY;

    [-1, 1].forEach((side) => {
      // 斜外扩裙壁
      const wallProfile = new THREE.Shape();
      wallProfile.moveTo(side * (blockHalfW - 0.14), skirtTopY);
      wallProfile.lineTo(side * blockHalfW, skirtTopY);
      wallProfile.lineTo(side * 1.32, skirtTopY - 0.65);
      wallProfile.lineTo(side * 1.32, skirtBotY + 0.12);
      wallProfile.lineTo(side * 1.42, skirtBotY + 0.12);
      wallProfile.lineTo(side * 1.42, skirtBotY);
      wallProfile.lineTo(side * 1.12, skirtBotY);
      wallProfile.lineTo(side * 1.12, skirtTopY - 0.62);
      wallProfile.closePath();

      const wallGeo = new THREE.ExtrudeGeometry(wallProfile, {
        depth: blockHalfL * 2,
        bevelEnabled: false
      });
      wallGeo.translate(0, 0, -blockHalfL);
      blockGroup.add(new THREE.Mesh(wallGeo, mats.castAluminum));

      // 缸体侧面网格加强筋 (7条竖筋 + 2条横筋)
      for (let i = 0; i < 7; i++) {
        const rz = -2.6 + i * 0.86;
        const vRib = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, jacketHeight * 0.82, 0.09),
          mats.castAluminum
        );
        vRib.position.set(side * (blockHalfW + 0.03), S.linerBottomY + jacketHeight * 0.48, rz);
        blockGroup.add(vRib);
      }
      [1.55, 2.45].forEach((ry) => {
        const hRib = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.09, blockHalfL * 1.84),
          mats.castAluminum
        );
        hRib.position.set(side * (blockHalfW + 0.03), ry, 0);
        blockGroup.add(hRib);
      });

      // 侧面发动机悬置安装支座凸台 (Engine Mount Bosses)
      const mountBoss = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.26, 18),
        mats.darkCastAluminum
      );
      mountBoss.rotation.z = Math.PI * 0.5;
      mountBoss.position.set(side * (blockHalfW + 0.14), 1.35, side > 0 ? 0.6 : -0.6);
      blockGroup.add(mountBoss);
    });

    // 1.5 曲轴箱内部 5 道主轴承隔板 (Main Bulkhead Webs，含上半圆主轴颈鞍孔)
    const journalR = 0.30;
    S.mainZ.forEach((mz, idx) => {
      const isEnd = (idx === 0 || idx === S.mainZ.length - 1);
      const bulkThickness = isEnd ? 0.26 : 0.22;
      const bulkShape = new THREE.Shape();
      bulkShape.moveTo(-1.16, 0.0);
      bulkShape.lineTo(-1.16, skirtTopY);
      bulkShape.lineTo(1.16, skirtTopY);
      bulkShape.lineTo(1.16, 0.0);
      // 挖去中心上半圆主轴承鞍座孔
      bulkShape.absarc(0, 0, journalR, 0, Math.PI, false);
      bulkShape.closePath();

      const bulkGeo = new THREE.ExtrudeGeometry(bulkShape, {
        depth: bulkThickness,
        bevelEnabled: false,
        curveSegments: 24
      });
      bulkGeo.translate(0, 0, mz - bulkThickness * 0.5);
      blockGroup.add(new THREE.Mesh(bulkGeo, mats.darkCastAluminum));
    });

    // 底部合箱法兰边连接前后两端
    [-1, 1].forEach((endSign) => {
      const endFlange = new THREE.Mesh(
        new THREE.BoxGeometry(2.84, 0.14, 0.22),
        mats.machinedAluminum
      );
      endFlange.position.set(0, skirtBotY + 0.07, endSign * (blockHalfL - 0.11));
      blockGroup.add(endFlange);
    });

    tagPartGroup(blockGroup, 'cylinder_block');

    // ==================== 2. 锻钢主轴承盖组 (main_bearing_caps) ====================
    const capsGroup = new THREE.Group();

    S.mainZ.forEach((mz) => {
      const capShape = new THREE.Shape();
      capShape.moveTo(-0.76, 0.0);
      capShape.lineTo(-0.30, 0.0);
      // 下半圆轴承孔
      capShape.absarc(0, 0, journalR, Math.PI, Math.PI * 2, false);
      capShape.lineTo(0.76, 0.0);
      capShape.lineTo(0.76, -0.44);
      capShape.lineTo(0.46, -0.44);
      capShape.lineTo(0.38, -0.58);
      capShape.lineTo(-0.38, -0.58);
      capShape.lineTo(-0.46, -0.44);
      capShape.lineTo(-0.76, -0.44);
      capShape.closePath();

      const capGeo = new THREE.ExtrudeGeometry(capShape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 1,
        curveSegments: 24
      });
      capGeo.translate(0, 0, mz - 0.12);
      capsGroup.add(new THREE.Mesh(capGeo, mats.forgedSteel));

      // 闪亮三元合金轴瓦下半片
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(journalR + 0.008, journalR + 0.008, 0.25, 24, 1, true, Math.PI * 0.5, Math.PI),
        mats.polishedChrome
      );
      shell.rotation.z = Math.PI * 0.5;
      shell.rotation.y = Math.PI * 0.5;
      shell.position.set(0, 0, mz);
      capsGroup.add(shell);

      // 每道主轴承盖配 2 颗自下而上拧入的 12.9级 ARP 主轴承螺栓
      [-0.58, 0.58].forEach((bx) => {
        const bolt = createBoltMesh(0.068, 0.55, mats.gunmetalSteel);
        bolt.rotation.x = Math.PI; // 螺帽朝下，螺杆朝上拧入缸体
        bolt.position.set(bx, -0.44, mz);
        capsGroup.add(bolt);
      });
    });

    tagPartGroup(capsGroup, 'main_bearing_caps');

    // ==================== 3. MLS 多层不锈钢气缸垫 (head_gasket) ====================
    const gasketGroup = new THREE.Group();
    const gShape = makeRoundedRectShape(blockHalfW + 0.05, blockHalfL + 0.04, 0.18);
    // 侧边铆接标识耳片
    S.cylZ.forEach((cz) => {
      const bh = new THREE.Path();
      bh.absarc(0, -cz, S.boreRadius + 0.012, 0, Math.PI * 2, true);
      gShape.holes.push(bh);

      [-0.76, 0.76].forEach((wx) => {
        const wh = new THREE.Path();
        wh.absellipse(wx, -cz, 0.07, 0.20, 0, Math.PI * 2, true, 0);
        gShape.holes.push(wh);
      });
    });
    S.mainZ.forEach((mz) => {
      [-0.88, 0.88].forEach((bx) => {
        const hole = new THREE.Path();
        hole.absarc(bx, -mz, 0.072, 0, Math.PI * 2, true);
        gShape.holes.push(hole);
      });
    });

    const gGeo = new THREE.ExtrudeGeometry(gShape, {
      depth: S.gasketThickness,
      bevelEnabled: false,
      curveSegments: 28
    });
    gGeo.rotateX(-Math.PI * 0.5);
    const gMesh = new THREE.Mesh(gGeo, mats.gunmetalSteel);
    gMesh.position.y = S.blockTopY;
    gasketGroup.add(gMesh);

    // 4 个燃烧室紫铜/黄铜密封卷边火环 (Fire Sealing Rings)
    S.cylZ.forEach((cz) => {
      const fireRing = new THREE.Mesh(
        new THREE.TorusGeometry(S.boreRadius + 0.018, 0.022, 12, 40),
        mats.copperWinding
      );
      fireRing.rotation.x = Math.PI * 0.5;
      fireRing.position.set(0, S.blockTopY + S.gasketThickness * 0.5, cz);
      gasketGroup.add(fireRing);
    });

    tagPartGroup(gasketGroup, 'head_gasket');

    return {
      cylinder_block: blockGroup,
      main_bearing_caps: capsGroup,
      head_gasket: gasketGroup
    };
  }

  ns.buildBlockParts = buildBlockParts;
})(window.EngineApp);
