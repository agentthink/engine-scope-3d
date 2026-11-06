/**
 * 工业级程序化 PBR 材质与微表面纹理工厂
 * 包含铸铝喷砂、气缸壁交叉珩磨网纹、CNC车削拉丝、红头皱纹漆、紫铜绕组、X-Ray透视与热辐射控制
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  function createCastNoiseTexture(size = 256, contrast = 26, base = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;
    // 确定性伪随机使质感均匀细腻
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < data.length; i += 4) {
      const n = (rand() + rand() - 1.0) * contrast;
      const v = Math.max(0, Math.min(255, base + n));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  function createHoningCrosshatchTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9ea6b0';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(235, 242, 250, 0.28)';
    ctx.lineWidth = 1.1;
    const step = 8;
    for (let i = -size; i < size * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size * 0.65, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + size * 0.65, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(45, 52, 60, 0.24)';
    ctx.lineWidth = 0.8;
    for (let i = -size + 4; i < size * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size * 0.65, size);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
  }

  function createRadialMachinedTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    ctx.fillStyle = '#b8c0c8';
    ctx.fillRect(0, 0, size, size);

    for (let r = 6; r < cx; r += 2.2) {
      const alpha = 0.08 + ((r * 7) % 13) * 0.015;
      ctx.strokeStyle = (r % 4 < 2)
        ? `rgba(255,255,255,${alpha})`
        : `rgba(50,58,68,${alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function createRibbedBeltTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b1d21';
    ctx.fillRect(0, 0, size, size);

    // 6PK 纵向多楔沟槽 + 横向微纹理以便观察皮带高速运转
    for (let y = 0; y < size; y += size / 6) {
      ctx.fillStyle = '#2a2e35';
      ctx.fillRect(0, y + 3, size, size / 12);
      ctx.fillStyle = '#101215';
      ctx.fillRect(0, y + size / 12 + 3, size, 4);
    }
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      ctx.fillRect(x, 0, 4, size);
    }
    // 白色皮带型号印字条纹增强转动可读性
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(24, 10, 42, size - 20);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 1);
    return tex;
  }

  function createFilterMeshTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8f1d24';
    ctx.fillRect(0, 0, size, size);

    // 折纸波纹阴影
    for (let x = 0; x < size; x += 8) {
      ctx.fillStyle = (x % 16 === 0) ? '#b9252e' : '#581016';
      ctx.fillRect(x, 0, 4, size);
    }
    // 不锈钢菱形护网
    ctx.strokeStyle = 'rgba(215, 222, 230, 0.48)';
    ctx.lineWidth = 1.0;
    for (let i = -size; i < size * 2; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + size, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
  }

  function createMaterialLibrary(clippingPlanes) {
    const castBump = createCastNoiseTexture(256, 34, 128);
    const fineBump = createCastNoiseTexture(256, 16, 128);
    const honingMap = createHoningCrosshatchTexture(256);
    const radialMap = createRadialMachinedTexture(256);
    const beltMap = createRibbedBeltTexture(256);
    const filterMap = createFilterMeshTexture(256);

    const common = {
      side: THREE.DoubleSide,
      clippingPlanes: clippingPlanes || [],
      clipShadows: true
    };

    const mats = {
      // 喷砂铸造铝合金 (缸体、缸盖、油底壳、正时前盖)
      castAluminum: new THREE.MeshStandardMaterial({
        ...common,
        name: 'castAluminum',
        color: 0xc8d0da,
        metalness: 0.78,
        roughness: 0.44,
        bumpMap: castBump,
        bumpScale: 0.012
      }),

      // 深色压铸铝合金 (进气法兰、附件支架、轴承盖)
      darkCastAluminum: new THREE.MeshStandardMaterial({
        ...common,
        name: 'darkCastAluminum',
        color: 0x8f99a6,
        metalness: 0.80,
        roughness: 0.40,
        bumpMap: castBump,
        bumpScale: 0.01
      }),

      // CNC 精密机加工铝合金亮面 (合箱平面、压气机叶轮、节气门体)
      machinedAluminum: new THREE.MeshStandardMaterial({
        ...common,
        name: 'machinedAluminum',
        color: 0xe6ecf2,
        metalness: 0.92,
        roughness: 0.18,
        roughnessMap: radialMap
      }),

      // 气缸套激光交叉珩磨内壁
      cylinderHoned: new THREE.MeshStandardMaterial({
        ...common,
        name: 'cylinderHoned',
        color: 0xd4dce4,
        map: honingMap,
        bumpMap: honingMap,
        bumpScale: 0.006,
        metalness: 0.88,
        roughness: 0.22
      }),

      // 42CrMo4 锻造合金钢 (曲轴本体、连杆杆身、凸轮轴杆)
      forgedSteel: new THREE.MeshStandardMaterial({
        ...common,
        name: 'forgedSteel',
        color: 0x7c8591,
        metalness: 0.88,
        roughness: 0.32,
        bumpMap: fineBump,
        bumpScale: 0.006
      }),

      // 镜面抛光镀铬/淬火轴颈 (曲轴轴颈、活塞销、气门杆、第一道镀铬环)
      polishedChrome: new THREE.MeshStandardMaterial({
        ...common,
        name: 'polishedChrome',
        color: 0xf3f7fb,
        metalness: 0.97,
        roughness: 0.09
      }),

      // 氮化弹簧钢 / 高强度深灰螺栓钢 (气门弹簧、ARP螺栓、正时链条、起动齿圈)
      gunmetalSteel: new THREE.MeshStandardMaterial({
        ...common,
        name: 'gunmetalSteel',
        color: 0x3b424c,
        metalness: 0.85,
        roughness: 0.34
      }),

      // 活塞顶硬质阳极氧化银灰金属
      pistonAlloy: new THREE.MeshStandardMaterial({
        ...common,
        name: 'pistonAlloy',
        color: 0xd8dfe8,
        metalness: 0.86,
        roughness: 0.24
      }),

      // 活塞裙部二硫化钼石墨减摩涂层
      graphiteSkirt: new THREE.MeshStandardMaterial({
        ...common,
        name: 'graphiteSkirt',
        color: 0x262b31,
        metalness: 0.55,
        roughness: 0.42
      }),

      // 性能红头静电皱纹烤漆 (红头点火线圈、气门室铭牌饰盖)
      redWrinkle: new THREE.MeshStandardMaterial({
        ...common,
        name: 'redWrinkle',
        color: 0xd61f2c,
        metalness: 0.28,
        roughness: 0.46,
        bumpMap: castBump,
        bumpScale: 0.015
      }),

      // 玻纤增强工程黑尼龙 (进气歧管稳压腔、链条导轨、电控插头、机油口盖)
      blackPolymer: new THREE.MeshStandardMaterial({
        ...common,
        name: 'blackPolymer',
        color: 0x1e2229,
        metalness: 0.12,
        roughness: 0.52,
        bumpMap: fineBump,
        bumpScale: 0.008
      }),

      // 耐磨尼龙正时导轨 (棕橙色工程塑料 PA46)
      nylonGuide: new THREE.MeshStandardMaterial({
        ...common,
        name: 'nylonGuide',
        color: 0x9a4e1c,
        metalness: 0.10,
        roughness: 0.42
      }),

      // EPDM 多楔蛇形皮带 (带动态UV偏移支持)
      serpentineBelt: new THREE.MeshStandardMaterial({
        ...common,
        name: 'serpentineBelt',
        color: 0xffffff,
        map: beltMap,
        bumpMap: beltMap,
        bumpScale: 0.015,
        metalness: 0.08,
        roughness: 0.72
      }),

      // 耐高温不锈钢排气歧管 (支持随RPM动态升温红热发光!)
      exhaustStainless: new THREE.MeshStandardMaterial({
        ...common,
        name: 'exhaustStainless',
        color: 0xb59e88,
        metalness: 0.86,
        roughness: 0.30,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1.0
      }),

      // 高镍球铁涡轮热端蜗壳 (支持随RPM动态升温红热发光!)
      turbineCastIron: new THREE.MeshStandardMaterial({
        ...common,
        name: 'turbineCastIron',
        color: 0x5c463b,
        metalness: 0.74,
        roughness: 0.56,
        bumpMap: castBump,
        bumpScale: 0.018,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 1.0
      }),

      // 无氧紫铜/黄铜 (发电机定子绕组、气缸垫密封圈、节气门蝶阀、放油螺丝)
      copperWinding: new THREE.MeshStandardMaterial({
        ...common,
        name: 'copperWinding',
        color: 0xd97736,
        metalness: 0.90,
        roughness: 0.24
      }),

      brassMetal: new THREE.MeshStandardMaterial({
        ...common,
        name: 'brassMetal',
        color: 0xe0b243,
        metalness: 0.88,
        roughness: 0.25
      }),

      // 火花塞高纯氧化铝白陶瓷绝缘体
      ceramicWhite: new THREE.MeshStandardMaterial({
        ...common,
        name: 'ceramicWhite',
        color: 0xf4f6f9,
        metalness: 0.05,
        roughness: 0.14
      }),

      // 旋装机油滤清器深海蓝金属烤漆
      oilFilterBlue: new THREE.MeshStandardMaterial({
        ...common,
        name: 'oilFilterBlue',
        color: 0x164e87,
        metalness: 0.45,
        roughness: 0.28
      }),

      // 机油尺亮黄拉环
      safetyYellow: new THREE.MeshStandardMaterial({
        ...common,
        name: 'safetyYellow',
        color: 0xfacc15,
        metalness: 0.12,
        roughness: 0.35
      }),

      // 高流量冬菇头空滤棉网
      airFilterMesh: new THREE.MeshStandardMaterial({
        ...common,
        name: 'airFilterMesh',
        color: 0xffffff,
        map: filterMap,
        bumpMap: filterMap,
        bumpScale: 0.02,
        metalness: 0.35,
        roughness: 0.55
      }),

      // 离合器碳纤芳纶摩擦衬片
      clutchFriction: new THREE.MeshStandardMaterial({
        ...common,
        name: 'clutchFriction',
        color: 0x4b433b,
        metalness: 0.22,
        roughness: 0.78,
        bumpMap: castBump,
        bumpScale: 0.02
      }),

      // X-Ray 外部壳体科技蓝半透明透视材质
      xrayShell: new THREE.MeshPhysicalMaterial({
        side: THREE.DoubleSide,
        color: 0x38bdf8,
        emissive: 0x072b42,
        emissiveIntensity: 0.45,
        metalness: 0.15,
        roughness: 0.18,
        transparent: true,
        opacity: 0.19,
        depthWrite: false,
        clippingPlanes: clippingPlanes || []
      }),

      // 非焦点零件半透明淡化材质 (单零件隔离检视 Solo 模式专用)
      ghostMuted: new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        color: 0x475569,
        metalness: 0.2,
        roughness: 0.7,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        clippingPlanes: clippingPlanes || []
      })
    };

    return {
      mats,
      textures: {
        beltMap,
        honingMap,
        radialMap
      },
      // 根据转速和负荷实时更新排气歧管与涡轮热端的热辐射红热辉光
      updateThermalGlow(heatFactor) {
        const h = Math.max(0, Math.min(1, heatFactor));
        // 超过一定热负荷呈现暗樱桃红 -> 亮橙红辉光
        const r = Math.pow(h, 1.4) * 0.92;
        const g = Math.pow(h, 2.6) * 0.22;
        const b = Math.pow(h, 3.8) * 0.03;
        mats.exhaustStainless.emissive.setRGB(r, g, b);
        mats.turbineCastIron.emissive.setRGB(r * 1.15, g * 0.95, b);
      }
    };
  }

  ns.createMaterialLibrary = createMaterialLibrary;
})(window.EngineApp);
