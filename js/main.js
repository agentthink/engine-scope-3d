/**
 * 2.0T DOHC 16V 汽车发动机 3D 拆解与四冲程数字孪生主控引擎
 * 负责: WebGL2 PBR摄影棚场景、后期描边与辉光、运动学总调度、多模式分级拆解、动态剖切、BOM交互与遥测HUD
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const {
    ENGINE_SPEC,
    SYSTEM_GROUPS,
    PART_CATALOG,
    CAMERA_PRESETS,
    createMaterialLibrary,
    buildBlockParts,
    buildCranktrainParts,
    buildValvetrainParts,
    buildPeripheralParts,
    buildManifoldsAndTurboParts,
    buildCombustionAndGuides,
    EngineAudioSynth
  } = ns;

  // ==================== 全局仿真状态 ====================
  const state = {
    rpm: 22,                    // 默认启动即处于“四冲程慢动作教学”模式，直观展示内部机械联动!
    lastRunningRpm: 850,
    cycleAngleRad: 0.35,        // 0 ~ 4π (720° 曲轴转角)
    masterExplodeTarget: 0.0,   // 0.0 ~ 1.0 全局爆炸拆解目标值
    masterExplodeCurrent: 0.0,
    explodedGroups: new Set(),  // 被开启“按子系统单独拆解”的 groupId 集合
    poppedParts: new Set(),     // 被开启“单件单独拆出”的 partId 集合
    hiddenParts: new Set(),     // 被手动隐藏的 partId 集合
    soloPartId: null,           // 当前处于“隔离独显”的 partId
    selectedPartId: null,       // 当前选中的 partId
    hoveredPartId: null,

    renderMode: 'pbr',          // 'pbr' | 'xray' | 'cutaway' | 'wireframe'
    cutAxis: 'z',               // 'z' | 'x'
    cutOffset: 2.22,            // 默认精准剖开第1缸正中心 (Z = +2.22)

    showLabels: false,
    showGuides: true,
    showCombustion: true,
    autoRotate: false,
    thermalHeat: 0.0
  };

  // ==================== 1. 初始化 Three.js 渲染器、场景与相机 ====================
  const container = document.getElementById('canvas-container');
  const labelContainer = document.getElementById('label-container');

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = false;
  container.appendChild(renderer.domElement);

  const labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelContainer.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();

  // 使用 RoomEnvironment 构建真实工业金属反射 HDR 环境贴图
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGen.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.88;
  pmremGen.dispose();

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(...CAMERA_PRESETS.iso.pos);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAMERA_PRESETS.iso.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 2.2;
  controls.maxDistance = 28.0;
  controls.maxPolarAngle = Math.PI * 0.88;

  // 三点工业布光系统
  const keyLight = new THREE.DirectionalLight(0xfff8ed, 2.2);
  keyLight.position.set(8.5, 12.0, 9.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 32;
  const d = 7.5;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.15);
  rimLight.position.set(-9.0, 5.5, -8.0);
  scene.add(rimLight);

  const bottomFill = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.55);
  scene.add(bottomFill);

  // ==================== 2. 工业展示圆盘底座与刻度标线 ====================
  function buildStudioPedestal() {
    const ped = new THREE.Group();
    ped.position.y = -3.35;

    const baseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 7.2, 0.18, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.65,
        roughness: 0.45
      })
    );
    baseDisc.receiveShadow = true;
    ped.add(baseDisc);

    const ringOuter = new THREE.Mesh(
      new THREE.RingGeometry(6.55, 6.62, 64),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ringOuter.rotation.x = -Math.PI * 0.5;
    ringOuter.position.y = 0.095;
    ped.add(ringOuter);

    const grid = new THREE.GridHelper(11.5, 22, 0x1e3a5f, 0x132036);
    grid.position.y = 0.092;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    ped.add(grid);

    scene.add(ped);
  }
  buildStudioPedestal();

  // ==================== 3. 实时三维解剖剖切平面与材质库 ====================
  const activeClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), state.cutOffset);
  const matLib = createMaterialLibrary([activeClipPlane]);
  const { mats, textures } = matLib;

  function syncClipPlane() {
    if (state.cutAxis === 'z') {
      // 保留 Z <= cutOffset 的后半部分，切开前端观察第1缸内部!
      activeClipPlane.normal.set(0, 0, -1);
      activeClipPlane.constant = state.cutOffset;
    } else {
      // 保留 X <= cutOffset 的左半部分，切开右侧同时观察4个气缸纵剖面!
      activeClipPlane.normal.set(-1, 0, 0);
      activeClipPlane.constant = state.cutOffset;
    }
  }
  syncClipPlane();

  // ==================== 4. 装配全部 35 项精密发动机总成 ====================
  const engineRoot = new THREE.Group();
  engineRoot.position.y = 0.35; // 抬升整机中心使其优雅悬浮于检视台上方
  scene.add(engineRoot);

  const blockSys = buildBlockParts(mats);
  const crankSys = buildCranktrainParts(mats);
  const valveSys = buildValvetrainParts(mats);
  const periphSys = buildPeripheralParts(mats, textures);
  const manifoldTurboSys = buildManifoldsAndTurboParts(mats);

  const partObjects = {
    ...blockSys,
    ...crankSys.parts,
    ...valveSys.parts,
    ...periphSys.parts,
    ...manifoldTurboSys.parts
  };

  const pickableMeshes = [];
  Object.keys(partObjects).forEach((pid) => {
    const grp = partObjects[pid];
    engineRoot.add(grp);
    grp.traverse((ch) => {
      if (ch.isMesh) pickableMeshes.push(ch);
    });
  });

  // 四冲程热力学光效与装配引导虚线
  const fxAndGuides = buildCombustionAndGuides(scene, engineRoot);
  fxAndGuides.initGuideLines(partObjects, PART_CATALOG);

  // ==================== 5. 3D CSS2D 空间关键总成引线标注牌 ====================
  const calloutParts = [
    'valve_cover', 'ignition_coils', 'intake_camshaft', 'cylinder_head',
    'cylinder_block', 'pistons', 'crankshaft', 'turbocharger',
    'exhaust_manifold', 'intake_manifold', 'throttle_air_filter',
    'timing_chain_system', 'alternator', 'flywheel_clutch', 'oil_pan'
  ];
  const labelObjects = [];

  calloutParts.forEach((pid) => {
    const meta = PART_CATALOG[pid];
    const obj = partObjects[pid];
    if (!meta || !obj) return;

    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    box.getCenter(center);
    // 转为相对零件局部坐标，以便拆解移动时标签自动跟随零件!
    obj.worldToLocal(center);

    const el = document.createElement('div');
    el.className = 'callout-pin';
    el.textContent = meta.name.split(' ')[0];
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectPart(pid, true);
    });

    const cssObj = new THREE.CSS2DObject(el);
    cssObj.position.copy(center);
    cssObj.visible = false;
    obj.add(cssObj);
    labelObjects.push({ pid, cssObj, el });
  });

  // ==================== 6. 后期处理管线 (Outline 选中描边 + UnrealBloom 辉光) ====================
  const composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new THREE.OutlinePass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    scene,
    camera
  );
  outlinePass.edgeStrength = 3.8;
  outlinePass.edgeGlow = 0.65;
  outlinePass.edgeThickness = 1.6;
  outlinePass.visibleEdgeColor.set('#38bdf8');
  outlinePass.hiddenEdgeColor.set('#0ea5e9');
  composer.addPass(outlinePass);

  const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.26, // strength
    0.55, // radius
    0.86  // threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new THREE.OutputPass();
  composer.addPass(outputPass);

  // 引擎声浪合成器
  const audioSynth = new EngineAudioSynth();

  // ==================== 7. 渲染模式、零件显隐与隔离独显材质管理 ====================
  function applyVisualModes() {
    const isCutaway = (state.renderMode === 'cutaway');
    const isXray = (state.renderMode === 'xray');
    const isWire = (state.renderMode === 'wireframe');

    renderer.localClippingEnabled = isCutaway;

    Object.keys(partObjects).forEach((pid) => {
      const grp = partObjects[pid];
      const meta = PART_CATALOG[pid];
      const isHidden = state.hiddenParts.has(pid);
      grp.visible = !isHidden;

      grp.traverse((child) => {
        if (!child.isMesh) return;
        const orig = child.userData.origMat;
        if (!orig) return;

        // 1. 隔离独显模式 (Solo Mode) 优先级最高
        if (state.soloPartId && state.soloPartId !== pid) {
          child.material = mats.ghostMuted;
          return;
        }

        // 2. X-Ray 外壳半透明透视模式 (但保留涡轮飞旋叶轮等核心高光件清晰可见!)
        if (isXray && meta && meta.isShell) {
          child.material = mats.xrayShell;
          return;
        }

        // 3. 常规 PBR / 动态剖切 / 蓝图线框
        child.material = orig;
        orig.wireframe = isWire;
      });
    });

    refreshLabelsVisibility();
    refreshBOMTreeStates();
  }

  function refreshLabelsVisibility() {
    labelObjects.forEach(({ pid, cssObj }) => {
      const partVisible = !state.hiddenParts.has(pid);
      const allowedBySolo = !state.soloPartId || state.soloPartId === pid;
      cssObj.visible = state.showLabels && partVisible && allowedBySolo;
    });
  }

  // ==================== 8. 相机平滑运镜过渡动画 (Fly-To Tween) ====================
  const camTween = {
    active: false,
    progress: 0,
    duration: 0.72,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3()
  };

  function flyCameraTo(targetPosArrOrVec, lookAtArrOrVec, duration = 0.72) {
    camTween.active = true;
    camTween.progress = 0;
    camTween.duration = duration;
    camTween.startPos.copy(camera.position);
    camTween.startTarget.copy(controls.target);

    if (Array.isArray(targetPosArrOrVec)) camTween.endPos.set(...targetPosArrOrVec);
    else camTween.endPos.copy(targetPosArrOrVec);

    if (Array.isArray(lookAtArrOrVec)) camTween.endTarget.set(...lookAtArrOrVec);
    else camTween.endTarget.copy(lookAtArrOrVec);
  }

  function focusOnPart(pid) {
    const obj = partObjects[pid];
    if (!obj) return;

    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 0.9);
    const viewDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    if (viewDir.lengthSq() < 0.01) viewDir.set(0.6, 0.4, 0.7).normalize();

    const dist = Math.max(3.2, Math.min(11.5, maxDim * 2.35));
    const newCamPos = center.clone().addScaledVector(viewDir, dist);
    newCamPos.y = Math.max(center.y + 0.4, newCamPos.y);

    flyCameraTo(newCamPos, center, 0.68);
  }

  // ==================== 9. 零件选中、右侧工程百科抽屉与 BOM 目录树 ====================
  const inspectorCard = document.getElementById('inspector-card');
  const inspGroupBadge = document.getElementById('insp-group-badge');
  const inspName = document.getElementById('insp-name');
  const inspEn = document.getElementById('insp-en');
  const inspMaterial = document.getElementById('insp-material');
  const inspSummary = document.getElementById('insp-summary');
  const inspSpecs = document.getElementById('insp-specs');
  const btnSoloPart = document.getElementById('btn-solo-part');
  const btnPopPart = document.getElementById('btn-pop-part');
  const btnHidePart = document.getElementById('btn-hide-part');

  function updateOutlineSelection() {
    const selected = [];
    const targetPid = state.selectedPartId || state.hoveredPartId;
    if (targetPid && partObjects[targetPid] && !state.hiddenParts.has(targetPid)) {
      selected.push(partObjects[targetPid]);
      outlinePass.visibleEdgeColor.set(state.selectedPartId ? '#fbbf24' : '#38bdf8');
    }
    outlinePass.selectedObjects = selected;
  }

  function selectPart(pid, shouldFocusCam = false) {
    if (!pid || !PART_CATALOG[pid]) {
      state.selectedPartId = null;
      inspectorCard.classList.add('hidden');
      updateOutlineSelection();
      refreshBOMTreeStates();
      return;
    }

    state.selectedPartId = pid;
    const meta = PART_CATALOG[pid];
    const grpInfo = SYSTEM_GROUPS.find((g) => g.id === meta.group);

    inspGroupBadge.textContent = grpInfo ? `${grpInfo.icon} ${grpInfo.name}` : meta.group;
    if (grpInfo) {
      inspGroupBadge.style.borderColor = grpInfo.color;
      inspGroupBadge.style.color = grpInfo.color;
    }
    inspName.textContent = meta.name;
    inspEn.textContent = meta.enName;
    inspMaterial.textContent = meta.materialDesc;
    inspSummary.textContent = meta.summary;

    inspSpecs.innerHTML = '';
    (meta.specs || []).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `• ${s}`;
      inspSpecs.appendChild(li);
    });

    syncInspectorActionButtons();
    inspectorCard.classList.remove('hidden');
    updateOutlineSelection();
    refreshBOMTreeStates();

    if (shouldFocusCam) {
      if (state.hiddenParts.has(pid)) {
        state.hiddenParts.delete(pid);
        applyVisualModes();
      }
      focusOnPart(pid);
    }
  }

  function syncInspectorActionButtons() {
    const pid = state.selectedPartId;
    if (!pid) return;
    btnSoloPart.classList.toggle('active', state.soloPartId === pid);
    btnSoloPart.textContent = (state.soloPartId === pid) ? '✨ 退出独显' : '🔍 隔离独显';

    btnPopPart.classList.toggle('active', state.poppedParts.has(pid));
    btnPopPart.textContent = state.poppedParts.has(pid) ? '📥 收回原位' : '📤 单独拆出';

    btnHidePart.classList.toggle('active', state.hiddenParts.has(pid));
    btnHidePart.textContent = state.hiddenParts.has(pid) ? '👁️ 恢复显示' : '🙈 隐藏此件';
  }

  // 构建左侧 BOM 树
  const bomTreeContainer = document.getElementById('bom-tree-list');
  const bomItemDomMap = new Map();
  const groupExplodeBtnMap = new Map();

  function renderBOMTree(filterKeyword = '') {
    bomTreeContainer.innerHTML = '';
    bomItemDomMap.clear();
    groupExplodeBtnMap.clear();
    const kw = filterKeyword.trim().toLowerCase();

    SYSTEM_GROUPS.forEach((grp) => {
      const items = Object.values(PART_CATALOG).filter((p) => {
        if (p.group !== grp.id) return false;
        if (!kw) return true;
        return p.name.toLowerCase().includes(kw) || p.enName.toLowerCase().includes(kw);
      });
      if (items.length === 0) return;

      const grpBox = document.createElement('div');
      grpBox.className = 'bom-group';

      const head = document.createElement('div');
      head.className = 'bom-group-head';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'bom-group-title';
      titleWrap.innerHTML = `<span class="group-dot" style="background:${grp.color}"></span><span>${grp.name} (${items.length})</span>`;

      const expBtn = document.createElement('button');
      expBtn.className = 'group-explode-btn';
      expBtn.textContent = state.explodedGroups.has(grp.id) ? '收回本组' : '本组拆解';
      expBtn.classList.toggle('active', state.explodedGroups.has(grp.id));
      expBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.explodedGroups.has(grp.id)) {
          state.explodedGroups.delete(grp.id);
          showToast(`已收回「${grp.name}」`);
        } else {
          state.explodedGroups.add(grp.id);
          showToast(`💥 已单独拆解「${grp.name}」`);
        }
        refreshBOMTreeStates();
      });
      groupExplodeBtnMap.set(grp.id, expBtn);

      head.appendChild(titleWrap);
      head.appendChild(expBtn);
      grpBox.appendChild(head);

      const listWrap = document.createElement('div');
      listWrap.className = 'bom-items';

      items.forEach((p) => {
        const row = document.createElement('div');
        row.className = 'bom-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'bom-item-name';
        nameSpan.textContent = p.name;
        nameSpan.title = `${p.name}\n${p.enName}`;

        const visBtn = document.createElement('button');
        visBtn.className = 'vis-btn';
        visBtn.title = '显示 / 隐藏该零件';
        visBtn.textContent = state.hiddenParts.has(p.id) ? '🚫' : '👁️';

        visBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.hiddenParts.has(p.id)) state.hiddenParts.delete(p.id);
          else state.hiddenParts.add(p.id);
          applyVisualModes();
          syncInspectorActionButtons();
        });

        row.addEventListener('click', () => {
          selectPart(p.id, true);
        });

        row.appendChild(nameSpan);
        row.appendChild(visBtn);
        listWrap.appendChild(row);
        bomItemDomMap.set(p.id, { row, visBtn });
      });

      grpBox.appendChild(listWrap);
      bomTreeContainer.appendChild(grpBox);
    });

    refreshBOMTreeStates();
  }

  function refreshBOMTreeStates() {
    bomItemDomMap.forEach(({ row, visBtn }, pid) => {
      row.classList.toggle('selected', state.selectedPartId === pid);
      const hidden = state.hiddenParts.has(pid);
      row.classList.toggle('part-hidden', hidden);
      visBtn.textContent = hidden ? '🚫' : '👁️';
    });
    groupExplodeBtnMap.forEach((btn, gid) => {
      const exp = state.explodedGroups.has(gid);
      btn.classList.toggle('active', exp);
      btn.textContent = exp ? '收回本组' : '本组拆解';
    });
  }

  renderBOMTree();

  // ==================== 10. 鼠标射线拾取 (悬停提示 + 单击检视 + 双击微距聚焦) ====================
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const hoverTooltip = document.getElementById('hover-tooltip');
  let downPos = { x: 0, y: 0 };

  function pickPartAtEvent(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(pickableMeshes, false);

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const pid = hit.object.userData.partId;
      if (!pid || state.hiddenParts.has(pid)) continue;
      if (state.soloPartId && state.soloPartId !== pid) continue;

      // 在动态剖切模式下，忽略已被剖切平面裁掉的前半侧几何体交点!
      if (state.renderMode === 'cutaway') {
        if (activeClipPlane.distanceToPoint(hit.point) < -0.005) continue;
      }
      return pid;
    }
    return null;
  }

  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (ev.buttons !== 0) {
      hoverTooltip.classList.add('hidden');
      return;
    }
    const pid = pickPartAtEvent(ev);
    if (pid !== state.hoveredPartId) {
      state.hoveredPartId = pid;
      renderer.domElement.style.cursor = pid ? 'pointer' : 'grab';
      updateOutlineSelection();
    }
    if (pid && PART_CATALOG[pid]) {
      hoverTooltip.textContent = `${PART_CATALOG[pid].name} · 点击查看规格`;
      hoverTooltip.style.left = `${ev.clientX}px`;
      hoverTooltip.style.top = `${ev.clientY}px`;
      hoverTooltip.classList.remove('hidden');
    } else {
      hoverTooltip.classList.add('hidden');
    }
  });

  renderer.domElement.addEventListener('pointerdown', (ev) => {
    downPos.x = ev.clientX;
    downPos.y = ev.clientY;
    camTween.active = false; // 用户手动介入控制立即接管镜头
  });

  renderer.domElement.addEventListener('pointerup', (ev) => {
    if (ev.button !== 0) return;
    const dx = ev.clientX - downPos.x;
    const dy = ev.clientY - downPos.y;
    if (dx * dx + dy * dy > 25) return; // 拖动视角不触发点击拾取

    const pid = pickPartAtEvent(ev);
    if (pid) {
      selectPart(pid, false);
    } else if (!state.soloPartId) {
      selectPart(null, false);
    }
  });

  renderer.domElement.addEventListener('dblclick', (ev) => {
    const pid = pickPartAtEvent(ev);
    if (pid) {
      selectPart(pid, true);
      showToast(`🎯 已聚焦至「${PART_CATALOG[pid].name}」`);
    }
  });

  // ==================== 11. 绑定 UI 控件与快捷键 ====================
  const toastEl = document.getElementById('toast-msg');
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  // 爆炸拆解滑块与快捷按钮
  const sliderExplode = document.getElementById('slider-explode');
  const valExplodePct = document.getElementById('val-explode-pct');

  function setMasterExplode(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    state.masterExplodeTarget = clamped / 100;
    sliderExplode.value = clamped;
    valExplodePct.textContent = `${Math.round(clamped)}%`;
  }

  sliderExplode.addEventListener('input', (e) => {
    setMasterExplode(parseFloat(e.target.value));
  });

  document.getElementById('btn-assemble-all').addEventListener('click', () => {
    state.explodedGroups.clear();
    state.poppedParts.clear();
    setMasterExplode(0);
    syncInspectorActionButtons();
    refreshBOMTreeStates();
    showToast('🔩 全机 35 项总成已复位组装');
  });

  document.getElementById('btn-explode-half').addEventListener('click', () => {
    setMasterExplode(45);
    showToast('💥 已展开至 45% 半拆解观察姿态');
  });

  document.getElementById('btn-explode-all').addEventListener('click', () => {
    setMasterExplode(100);
    showToast('💥 已展开至 100% 全尺寸深度拆解姿态');
  });

  // 转速控制滑块与 5 档预设按钮
  const sliderRpm = document.getElementById('slider-rpm');
  const valRpm = document.getElementById('val-rpm');
  const rpmPresetBtns = document.querySelectorAll('.rpm-preset');

  function setEngineRPM(rpmVal) {
    const r = Math.max(0, Math.min(6000, Math.round(rpmVal)));
    if (r > 0) state.lastRunningRpm = r;
    state.rpm = r;
    sliderRpm.value = r;
    valRpm.textContent = r === 0 ? '静止' : (r <= 45 ? `${r} (慢放)` : `${r} RPM`);

    rpmPresetBtns.forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.rpm, 10) === r);
    });
  }

  sliderRpm.addEventListener('input', (e) => {
    setEngineRPM(parseFloat(e.target.value));
  });

  rpmPresetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetRpm = parseInt(btn.dataset.rpm, 10);
      setEngineRPM(targetRpm);
      if (targetRpm === 22) showToast('🔬 四冲程慢动作教学：清晰观察气门弹簧压缩、活塞往复与点火顺序');
      else if (targetRpm === 6000) showToast('🔥 6000 RPM 全负荷红线：涡轮满压飞旋，排气歧管高温烧红！');
    });
  });

  // 渲染模式胶囊切换 (PBR / X-Ray / Cutaway / Wireframe)
  const modeBtns = document.querySelectorAll('[data-render-mode]');
  const cutawayBar = document.getElementById('cutaway-bar');

  function setRenderMode(mode) {
    state.renderMode = mode;
    modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.renderMode === mode));
    cutawayBar.classList.toggle('hidden', mode !== 'cutaway');
    applyVisualModes();

    if (mode === 'xray') showToast('🩻 外壳半透明透视模式：内部曲轴连杆与配气机构一目了然');
    else if (mode === 'cutaway') showToast('🔪 实时三维动态剖切已激活：可拖动上方滑块移动解剖面');
    else if (mode === 'wireframe') showToast('📐 CAD 工程蓝图线框模式');
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setRenderMode(btn.dataset.renderMode));
  });

  // 动态剖切轴与位置控制
  const cutAxisBtns = document.querySelectorAll('[data-cut-axis]');
  const sliderCutPos = document.getElementById('slider-cut-pos');
  const labelCutVal = document.getElementById('label-cut-val');

  function updateCutUI() {
    syncClipPlane();
    const axisLabel = state.cutAxis.toUpperCase();
    const sign = state.cutOffset >= 0 ? '+' : '';
    labelCutVal.textContent = `${axisLabel} = ${sign}${state.cutOffset.toFixed(2)}`;
  }

  cutAxisBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cutAxis = btn.dataset.cutAxis;
      cutAxisBtns.forEach((b) => b.classList.toggle('active', b === btn));
      if (state.cutAxis === 'z') {
        sliderCutPos.min = '-3.4';
        sliderCutPos.max = '3.6';
        state.cutOffset = 2.22; // 对准第1缸中心
      } else {
        sliderCutPos.min = '-2.6';
        sliderCutPos.max = '2.8';
        state.cutOffset = 0.0;  // 对准四缸中心纵截面
      }
      sliderCutPos.value = state.cutOffset;
      updateCutUI();
    });
  });

  sliderCutPos.addEventListener('input', (e) => {
    state.cutOffset = parseFloat(e.target.value);
    updateCutUI();
  });

  // 顶部辅助功能开关
  const bomDrawer = document.getElementById('bom-drawer');
  const btnToggleBom = document.getElementById('btn-toggle-bom');
  btnToggleBom.addEventListener('click', () => {
    const collapsed = bomDrawer.classList.toggle('collapsed');
    btnToggleBom.classList.toggle('active', !collapsed);
  });

  const btnToggleLabels = document.getElementById('btn-toggle-labels');
  btnToggleLabels.addEventListener('click', () => {
    state.showLabels = !state.showLabels;
    btnToggleLabels.classList.toggle('active', state.showLabels);
    refreshLabelsVisibility();
  });

  const btnToggleGuides = document.getElementById('btn-toggle-guides');
  btnToggleGuides.addEventListener('click', () => {
    state.showGuides = !state.showGuides;
    btnToggleGuides.classList.toggle('active', state.showGuides);
  });

  const btnToggleCombustion = document.getElementById('btn-toggle-combustion');
  btnToggleCombustion.addEventListener('click', () => {
    state.showCombustion = !state.showCombustion;
    btnToggleCombustion.classList.toggle('active', state.showCombustion);
  });

  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  btnToggleAudio.addEventListener('click', () => {
    const on = audioSynth.toggle();
    btnToggleAudio.classList.toggle('active', on);
    btnToggleAudio.textContent = on ? '🔊 声浪开启' : '🔇 引擎声浪';
    showToast(on ? '🔊 已开启四缸涡轮实时声浪合成 (拉高转速体验涡轮哨音!)' : '🔇 已静音引擎声浪');
  });

  const btnAutoRotate = document.getElementById('btn-auto-rotate');
  btnAutoRotate.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = 1.6;
    btnAutoRotate.classList.toggle('active', state.autoRotate);
  });

  const btnHideHud = document.getElementById('btn-hide-hud');
  const btnRestoreHud = document.getElementById('btn-restore-hud');
  function togglePureHUD(forceShow) {
    const hide = (typeof forceShow === 'boolean') ? !forceShow : !document.body.classList.contains('hud-hidden');
    document.body.classList.toggle('hud-hidden', hide);
    btnRestoreHud.classList.toggle('hidden', !hide);
  }
  btnHideHud.addEventListener('click', () => togglePureHUD());
  btnRestoreHud.addEventListener('click', () => togglePureHUD(true));

  // BOM 搜索与全部复位
  document.getElementById('bom-search').addEventListener('input', (e) => {
    renderBOMTree(e.target.value);
  });

  document.getElementById('btn-reset-visibility').addEventListener('click', () => {
    state.hiddenParts.clear();
    state.soloPartId = null;
    state.explodedGroups.clear();
    state.poppedParts.clear();
    applyVisualModes();
    syncInspectorActionButtons();
    showToast('👁️ 已恢复显示全部 35 项零件并退出独显');
  });

  // 右侧详情面板按钮
  document.getElementById('btn-close-inspector').addEventListener('click', () => {
    if (state.soloPartId) {
      state.soloPartId = null;
      applyVisualModes();
    }
    selectPart(null, false);
  });

  btnSoloPart.addEventListener('click', () => {
    const pid = state.selectedPartId;
    if (!pid) return;
    state.soloPartId = (state.soloPartId === pid) ? null : pid;
    if (state.soloPartId) {
      state.hiddenParts.delete(pid);
      focusOnPart(pid);
      showToast(`🔍 已隔离独显「${PART_CATALOG[pid].name}」`);
    }
    applyVisualModes();
    syncInspectorActionButtons();
  });

  btnPopPart.addEventListener('click', () => {
    const pid = state.selectedPartId;
    if (!pid) return;
    if (state.poppedParts.has(pid)) {
      state.poppedParts.delete(pid);
    } else {
      state.poppedParts.add(pid);
      showToast(`📤 已将「${PART_CATALOG[pid].name}」沿装配轴线单独拆出`);
    }
    syncInspectorActionButtons();
  });

  btnHidePart.addEventListener('click', () => {
    const pid = state.selectedPartId;
    if (!pid) return;
    if (state.hiddenParts.has(pid)) {
      state.hiddenParts.delete(pid);
    } else {
      state.hiddenParts.add(pid);
      if (state.soloPartId === pid) state.soloPartId = null;
    }
    applyVisualModes();
    syncInspectorActionButtons();
  });

  // 预设观察机位按钮
  const camBtns = document.querySelectorAll('.cam-btn');
  camBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cam;
      const preset = CAMERA_PRESETS[key];
      if (!preset) return;
      camBtns.forEach((b) => b.classList.toggle('active', b === btn));
      flyCameraTo(preset.pos, preset.target, 0.78);

      // 若点击“1缸燃烧室微距特写”且尚未拆解或透视，自动贴心开启纵向1缸剖切方便观察内部!
      if (key === 'cutaway_cyl1' && state.renderMode === 'pbr' && state.masterExplodeTarget < 0.15) {
        state.cutAxis = 'z';
        state.cutOffset = 2.22;
        sliderCutPos.value = 2.22;
        updateCutUI();
        setRenderMode('cutaway');
      }
    });
  });

  document.getElementById('btn-reset-cam').addEventListener('click', () => {
    flyCameraTo(CAMERA_PRESETS.iso.pos, CAMERA_PRESETS.iso.target, 0.75);
  });

  // 键盘快捷键绑定
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      setEngineRPM(state.rpm > 0 ? 0 : state.lastRunningRpm);
    } else if (k === '1') setRenderMode('pbr');
    else if (k === '2' || k === 'x') setRenderMode(state.renderMode === 'xray' ? 'pbr' : 'xray');
    else if (k === '3' || k === 'c') setRenderMode(state.renderMode === 'cutaway' ? 'pbr' : 'cutaway');
    else if (k === '4') setRenderMode(state.renderMode === 'wireframe' ? 'pbr' : 'wireframe');
    else if (k === 'e') setMasterExplode(state.masterExplodeTarget > 0.5 ? 0 : 100);
    else if (k === 'l') btnToggleLabels.click();
    else if (k === 'm') btnToggleAudio.click();
    else if (k === 'h') togglePureHUD();
    else if (e.key === 'Escape') {
      if (state.soloPartId) {
        state.soloPartId = null;
        applyVisualModes();
      }
      selectPart(null, false);
    }
  });

  // 窗口自适应缩放
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    outlinePass.setSize(w, h);
    labelRenderer.setSize(w, h);
  });

  // ==================== 12. 实时主渲染与物理仿真循环 ====================
  const domCrankAngle = document.getElementById('val-crank-angle');
  const domBoost = document.getElementById('val-boost');
  const domThrottle = document.getElementById('val-throttle');
  const cylRowEls = Array.from(document.querySelectorAll('.cyl-row'));

  function smoothstep(edge0, edge1, x) {
    const span = Math.max(0.0001, edge1 - edge0);
    const t = Math.max(0, Math.min(1, (x - edge0) / span));
    return t * t * (3 - 2 * t);
  }

  const tmpTargetPos = new THREE.Vector3();
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());

    // 1. 推进发动机曲轴循环转角 (RPM -> rad/s: rpm * 2π / 60)
    // 为了在 2500~6000 RPM 高转速下依然看清活塞往复而不因 60Hz 显示器混叠静止，做合理的视觉防频闪平滑映射
    let visualOmega = (state.rpm * Math.PI * 2) / 60;
    if (visualOmega > 44.0) {
      visualOmega = 44.0 + (visualOmega - 44.0) * 0.18;
    }
    state.cycleAngleRad = (state.cycleAngleRad + visualOmega * dt) % (Math.PI * 4);

    // 2. 平滑插值全局拆解进度与 35 个零件各自的轴向爆炸位移
    const damp = 1.0 - Math.exp(-8.5 * dt);
    state.masterExplodeCurrent += (state.masterExplodeTarget - state.masterExplodeCurrent) * damp;

    Object.keys(partObjects).forEach((pid) => {
      const meta = PART_CATALOG[pid];
      const obj = partObjects[pid];
      if (!meta || !obj) return;

      const [t0, t1] = meta.explodeStage || [0, 1];
      let factor = smoothstep(t0, t1, state.masterExplodeCurrent);
      if (state.explodedGroups.has(meta.group)) factor = Math.max(factor, 0.88);
      if (state.poppedParts.has(pid)) factor = Math.max(factor, 0.96);

      const [vx, vy, vz] = meta.explodeVec;
      tmpTargetPos.set(vx * factor, vy * factor, vz * factor);
      obj.position.lerp(tmpTargetPos, damp);
    });

    // 3. 计算油门开度、增压压力与排气热负荷辉光
    const throttleRatio = state.rpm === 0 ? 0.04 : Math.min(1.0, 0.08 + Math.pow(state.rpm / 5600, 0.88) * 0.92);
    const boostBar = state.rpm < 950
      ? (-0.62 + (state.rpm / 950) * 0.25)
      : (-0.37 + Math.min(1.82, Math.pow((state.rpm - 950) / 4200, 0.9) * 1.82));

    const targetHeat = state.rpm > 2400 ? Math.min(1.0, (state.rpm - 2400) / 3600) : 0.0;
    state.thermalHeat += (targetHeat - state.thermalHeat) * (1.0 - Math.exp(-1.8 * dt));
    matLib.updateThermalGlow(state.thermalHeat);

    // 4. 驱动全机运动学子系统
    crankSys.updateKinematics(state.cycleAngleRad, state.masterExplodeCurrent);
    valveSys.updateValvetrain(state.cycleAngleRad, state.masterExplodeCurrent);
    periphSys.updatePeripherals(state.cycleAngleRad);
    manifoldTurboSys.updateManifoldsTurbo(dt, state.rpm, throttleRatio, state.masterExplodeCurrent);

    // 5. 更新四冲程热力学燃烧室特效与装配引导虚线
    const telemetry = fxAndGuides.updateCombustionFX(state.cycleAngleRad, state.showCombustion);
    fxAndGuides.updateGuideLines(state.showGuides);

    // 6. 更新底部四冲程点火时序遥测仪表盘
    const caDeg = Math.floor(((state.cycleAngleRad * 180) / Math.PI) % 720);
    domCrankAngle.textContent = `CA: ${String(caDeg).padStart(3, '0')}°`;
    domBoost.textContent = `${boostBar >= 0 ? '+' : ''}${boostBar.toFixed(2)} Bar`;
    domThrottle.textContent = `${Math.round(throttleRatio * 100)}%`;

    for (let i = 0; i < 4; i++) {
      const tInfo = telemetry[i];
      const rowEl = cylRowEls[i];
      if (rowEl && tInfo) {
        rowEl.dataset.stroke = tInfo.strokeKey;
        const fill = rowEl.querySelector('.stroke-fill');
        const txt = rowEl.querySelector('.stroke-txt');
        if (fill) fill.style.width = `${Math.round(tInfo.progress * 100)}%`;
        if (txt) txt.textContent = tInfo.strokeName;
      }
    }

    // 7. 更新声浪合成器
    audioSynth.update(state.rpm, boostBar);

    // 8. 推进相机平滑运镜过渡
    if (camTween.active) {
      camTween.progress = Math.min(1, camTween.progress + dt / camTween.duration);
      const ease = 1 - Math.pow(1 - camTween.progress, 3);
      camera.position.lerpVectors(camTween.startPos, camTween.endPos, ease);
      controls.target.lerpVectors(camTween.startTarget, camTween.endTarget, ease);
      if (camTween.progress >= 1) camTween.active = false;
    }

    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
  }

  // 支持通过可选 URL 查询参数快速预设演示状态 (如 ?explode=80&mode=xray&cam=turbo_side)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('explode')) {
      const ex = parseFloat(params.get('explode'));
      setMasterExplode(ex);
      state.masterExplodeCurrent = state.masterExplodeTarget;
    }
    if (params.has('rpm')) setEngineRPM(parseFloat(params.get('rpm')));
    if (params.has('mode')) setRenderMode(params.get('mode'));
    if (params.has('labels') && params.get('labels') === '1') {
      state.showLabels = true;
      btnToggleLabels.classList.add('active');
    }
    if (params.has('cam') && CAMERA_PRESETS[params.get('cam')]) {
      const cp = CAMERA_PRESETS[params.get('cam')];
      camera.position.set(...cp.pos);
      controls.target.set(...cp.target);
    }
    if (params.has('select')) selectPart(params.get('select'), false);
  } catch (_) { /* ignore URL parse issues */ }

  // 启动仿真并淡出加载帷幕
  applyVisualModes();
  animate();

  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.add('fade-out');
    showToast('💡 拖动下方「爆炸拆解度」滑块拆解全机，或点击任意零件查看机械结构百科！');
  }, 380);
})(window.EngineApp);
