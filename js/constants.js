/**
 * 2.0T DOHC 16V 直列四缸涡轮增压直喷发动机 (I4 Turbo GDI)
 * 核心工程尺寸基准、四冲程相位与 34 项精密零部件工程百科数据库
 */
window.EngineApp = window.EngineApp || {};

(function (ns) {
  'use strict';

  const DEG2RAD = Math.PI / 180;

  // 统一机械尺寸基准 (1 unit ≈ 10 mm, 原点 (0,0,0) 位于曲轴旋转轴线中心)
  const ENGINE_SPEC = {
    cylinders: 4,
    bore: 1.16,               // 缸径 86mm 等比映射
    boreRadius: 0.58,
    boreSpacing: 1.48,        // 缸心距
    cylZ: [2.22, 0.74, -0.74, -2.22], // 1~4缸 Z 坐标 (+Z 前端正时侧, -Z 后端飞轮侧)
    mainZ: [2.96, 1.48, 0.0, -1.48, -2.96], // 5道主轴承座 Z 坐标

    crankRadius: 0.60,        // 曲柄半径 (冲程 1.20)
    rodLength: 2.02,          // 连杆大小头中心距
    pistonCompHeight: 0.45,   // 活塞销中心至活塞顶面压缩高度
    pistonPinRadius: 0.14,

    // 高度基准 (Y轴)
    blockBottomY: -0.96,      // 气缸体下分型面 (接油底壳)
    linerBottomY: 0.96,       // 气缸套下缘
    blockTopY: 3.16,          // 气缸体上平面 (Deck Surface)
    gasketThickness: 0.04,
    headBottomY: 3.20,        // 气缸盖下平面
    headTopY: 4.62,           // 气缸盖上分型面
    camY: 4.72,               // 双顶置凸轮轴中心高
    intakeCamX: -0.60,        // 进气凸轮轴 X 坐标 (-X 为进气冷侧)
    exhaustCamX: 0.60,        // 排气凸轮轴 X 坐标 (+X 为排气热侧)
    valveTiltRad: 15.5 * DEG2RAD, // 进排气门夹角半角 15.5° (总夹角31°屋脊燃烧室)
    maxValveLift: 0.21,       // 最大气门升程

    // 前后端基准 (Z轴)
    blockFrontZ: 3.30,
    blockRearZ: -3.30,
    timingChainZ: 3.55,
    timingCoverFrontZ: 3.84,
    serpentineBeltZ: 4.22,
    flywheelZ: -3.56,

    // 直列四缸点火顺序 1 - 3 - 4 - 2
    // 在 720° 四冲程循环中各缸做功上止点 (Power TDC) 起始角 (度)
    // i=0(1缸): 0°, i=1(2缸): 540°, i=2(3缸): 180°, i=3(4缸): 360°
    firingOrder: [1, 3, 4, 2],
    cylPhaseOffsetDeg: [0, 540, 180, 360],
    // 曲柄销机械安装角: 1、4缸为 0°, 2、3缸相差 180° (平面曲轴 I4 构型)
    crankPinPhaseRad: [0, Math.PI, Math.PI, 0]
  };

  // 8 大拆解子系统分组
  const SYSTEM_GROUPS = [
    { id: 'top_valvetrain', name: 'DOHC 配气与气缸盖系统', icon: '⚙️', color: '#38bdf8' },
    { id: 'crank_piston',   name: '曲柄连杆与活塞核心',   icon: '🔩', color: '#f59e0b' },
    { id: 'block_core',     name: '气缸体与主轴承总成',   icon: '🧱', color: '#94a3b8' },
    { id: 'ignition_fuel',  name: '点火与GDI高压直喷系统', icon: '⚡', color: '#ef4444' },
    { id: 'timing_fead',    name: '正时链条与前端轮系',   icon: '⛓️', color: '#a855f7' },
    { id: 'intake_system',  name: '谐振进气与节气门系统', icon: '🌀', color: '#06b6d4' },
    { id: 'exhaust_turbo',  name: '排气歧管与涡轮增压器', icon: '🔥', color: '#f97316' },
    { id: 'lube_flywheel',  name: '油底壳润滑与飞轮离合', icon: '🛢️', color: '#10b981' }
  ];

  // 34 个精密零部件完整工程档案库
  const PART_CATALOG = {
    // ================= 1. DOHC 配气与气缸盖系统 =================
    oil_filler_cap: {
      id: 'oil_filler_cap',
      name: '机油加注口盖',
      enName: 'Oil Filler Cap (SAE 0W-30)',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [0, 4.95, 0],
      explodeStage: [0.0, 0.25],
      materialDesc: 'PA66+GF30 耐热玻纤增强尼龙 + 氟橡胶(FKM)密封圈',
      summary: '旋装于气门室罩盖顶部前端，用于在保养时向发动机配气室加注全合成机油，内置双唇氟橡胶密封圈防止曲轴箱正压油气渗漏。',
      specs: ['密封形式: 旋转卡扣式氟橡胶O型圈', '推荐粘度标识: SAE 0W-30 / 5W-30', '耐受温度: -40°C ~ +165°C']
    },
    valve_cover: {
      id: 'valve_cover',
      name: '气门室罩盖总成',
      enName: 'DOHC Cylinder Head Valve Cover',
      group: 'top_valvetrain',
      isShell: true,
      explodeVec: [0, 4.15, 0],
      explodeStage: [0.05, 0.36],
      materialDesc: '压铸镁铝合金 + 红色静电皱纹烤漆装饰铭牌 + 丁腈橡胶密封垫',
      summary: '封闭气缸盖顶部的配气机构腔室，防止凸轮轴高速飞溅的润滑油外泄，同时集成4个独立点火线圈密封井与PCV曲轴箱强制通风迷宫油气分离器。',
      specs: ['固定螺栓: 10×M6 等压限位法兰螺栓', '集成结构: 油气分离迷宫 + 点火线圈护套孔', '紧固扭矩: 10 N·m (交叉对称顺序)']
    },
    cam_caps: {
      id: 'cam_caps',
      name: '凸轮轴轴承盖组 (10件)',
      enName: 'Camshaft Bearing Caps & Bolts',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [0, 3.05, 0],
      explodeStage: [0.22, 0.52],
      materialDesc: '高硅铝合金精密合膛镗削 + 10.9级法兰螺栓',
      summary: '将进、排气双顶置凸轮轴精密压紧固定在气缸盖半圆鞍座上，轴承孔与气缸盖一体合膛精密镗削，内置压力机油油膜润滑沟槽。',
      specs: ['数量: 进气侧5道 + 排气侧5道 (共20颗M6螺栓)', '配合油膜间隙: 0.035 ~ 0.070 mm', '安装要求: 严格按编号与朝向原位对号装配']
    },
    intake_camshaft: {
      id: 'intake_camshaft',
      name: '进气凸轮轴 (8凸轮桃尖)',
      enName: 'Intake Camshaft (DOHC 8-Lobe)',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [-0.65, 2.50, 0],
      explodeStage: [0.28, 0.60],
      materialDesc: '球墨铸铁冷激铸造 / 中空组合式高频淬火合金钢',
      summary: '以曲轴转速的 1/2 同步旋转，通过8枚精密设计的非对称升程凸轮桃尖，严格按照 1-3-4-2 点火顺序定时下压开启8支进气门。',
      specs: ['传动比: 曲轴:凸轮轴 = 2:1', '凸轮数: 8枚 (每缸2进气门同步驱动)', '桃尖表面硬度: HRC 58 ~ 62']
    },
    exhaust_camshaft: {
      id: 'exhaust_camshaft',
      name: '排气凸轮轴 (8凸轮桃尖)',
      enName: 'Exhaust Camshaft (DOHC 8-Lobe)',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [0.65, 2.50, 0],
      explodeStage: [0.28, 0.60],
      materialDesc: '中空锻造铬钼钢高频感应淬火 + HPFP四方驱动凸轮',
      summary: '控制4个气缸共8支钠冷排气门的开启与关闭时序，后端还集成了用于驱动GDI高压燃油泵的四方凸轮桃。',
      specs: ['排气持续角: 约 235° 曲轴转角', '气门重叠角: 可随双VVT动态调节', '同轴跳动公差: ≤ 0.015 mm']
    },
    valves_intake: {
      id: 'valves_intake',
      name: '进气门、变螺距弹簧与挺柱组 (×8)',
      enName: 'Intake Valves, Helical Springs & Tappets',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [-0.45, 1.85, 0],
      explodeStage: [0.48, 0.85],
      materialDesc: '4Cr9Si2 马氏体耐热气门钢 + CrSi油淬火弹簧钢',
      summary: '每缸配置2支大直径进气门以提升涡轮增压充气效率。采用高疲劳强度螺旋弹簧克服高转速气门浮动，液压挺柱自动补偿气门热膨胀间隙。',
      specs: ['数量: 8支气门 + 8根三维螺旋弹簧 + 8只挺柱', '气门倾角: 15.5° (屋脊形燃烧室)', '气门锥面密封角: 45° 精密研磨']
    },
    valves_exhaust: {
      id: 'valves_exhaust',
      name: '中空钠冷排气门与弹簧挺柱组 (×8)',
      enName: 'Sodium-Filled Exhaust Valves & Springs',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [0.45, 1.85, 0],
      explodeStage: [0.48, 0.85],
      materialDesc: '21-4N 奥氏体耐热钢(杆内充金属钠冷却) + 司太立合金堆焊锥面',
      summary: '直接承受高达 950°C 的涡轮增压高温燃气冲刷，气门杆内部中空封入金属钠，往复振荡时液态钠将气门头部热量快速传导至气门导管散出。',
      specs: ['耐受燃气温度: 最高 980°C', '冷却技术: 中空充钠振荡导热技术', '弹簧预紧力: 260 N / 最大压缩升程 9.8 mm']
    },
    cylinder_head: {
      id: 'cylinder_head',
      name: 'DOHC 16气门铝合金气缸盖与缸盖螺栓',
      enName: 'DOHC 16V Aluminum Cylinder Head & Head Bolts',
      group: 'top_valvetrain',
      isShell: true,
      explodeVec: [0, 1.35, 0],
      explodeStage: [0.35, 0.72],
      materialDesc: 'A356-T6 热处理铸造铝合金 + 粉末冶金气门座圈 + 12.9级塑性域螺栓',
      summary: '发动机最精密的核心铸件之一，底面加工有4个紧凑屋脊形(Pent-roof)燃烧室穹顶，内部铸有双层横流式冷却水套、高压润滑油道及8条高滚流进排气道。',
      specs: ['燃烧室构型: 4气门中心火花塞屋脊形燃烧室', '缸盖螺栓: 10×M11 高强度扭矩转角法紧固螺栓', '平面度公差: ≤ 0.03 mm']
    },
    head_gasket: {
      id: 'head_gasket',
      name: 'MLS 多层不锈钢气缸垫',
      enName: 'Multi-Layer Steel (MLS) Head Gasket',
      group: 'top_valvetrain',
      isShell: false,
      explodeVec: [0, 0.65, 0],
      explodeStage: [0.42, 0.76],
      materialDesc: '3层 SUS301 弹性不锈钢片 + 氟橡胶涂层 + 燃烧室卷边加强环',
      summary: '夹装在气缸盖与气缸体之间，既要承受涡轮增压爆发冲程超过 130 bar 的高温高压燃气冲击，又要严密隔离高压机油道与防冻冷却水道。',
      specs: ['压紧厚度: 0.75 mm 三层复合钢片', '耐受峰值爆发缸压: ≥ 160 bar', '孔位匹配: 4气缸孔 + 10螺栓孔 + 16水道/油道孔']
    },

    // ================= 2. 气缸体与主轴承总成 =================
    cylinder_block: {
      id: 'cylinder_block',
      name: '铝合金闭式水道气缸体 (四缸珩磨缸套)',
      enName: 'Closed-Deck Cast Aluminum Cylinder Block',
      group: 'block_core',
      isShell: true,
      explodeVec: [0, 0, 0],
      explodeStage: [0.0, 1.0],
      materialDesc: 'ADC12 / AlSi9Cu3 高压铸造铝合金 + 铸铁干式缸套(平台网纹激光珩磨)',
      summary: '整台发动机的骨架基准件。采用高刚性闭式顶面水道(Closed-Deck)与深裙式曲轴箱设计，缸壁经过平台激光交叉网纹珩磨，储油减摩并耐受高增压侧推力。',
      specs: ['排量与缸径冲程: 1998 cc (86.0 × 86.0 mm 示意构型)', '缸体结构: 直列四缸深裙式 + 外部网格加强筋', '缸壁粗糙度: 45°交叉珩磨网纹 Ra 0.2 μm']
    },
    main_bearing_caps: {
      id: 'main_bearing_caps',
      name: '锻钢主轴承盖与主轴承螺栓组 (5道)',
      enName: 'Main Bearing Caps & ARP Studs (5-Main)',
      group: 'block_core',
      isShell: false,
      explodeVec: [0, -0.85, 0],
      explodeStage: [0.52, 0.86],
      materialDesc: '球墨铸铁 GGG60 / 粉末锻造合金钢 + 三元巴氏合金轴瓦',
      summary: '位于曲轴箱底部5道鞍座上，配合10颗高强度主轴承螺栓将曲轴牢牢抱合在气缸体中心线上，中间第3道主轴承还集成有曲轴轴向止推片。',
      specs: ['支承方式: 全支承5道主轴承结构', '螺栓配置: 10×M10 12.9级高强度螺栓', '主油膜间隙: 0.025 ~ 0.048 mm']
    },

    // ================= 3. 曲柄连杆与活塞核心 =================
    crankshaft: {
      id: 'crankshaft',
      name: '全平衡锻钢曲轴 (8平衡重平面构型)',
      enName: 'Forged Steel Counterweighted Crankshaft',
      group: 'crank_piston',
      isShell: false,
      explodeVec: [0, -0.42, 0],
      explodeStage: [0.60, 0.95],
      materialDesc: '42CrMo4 模锻合金结构钢 + 轴颈圆角滚压强化与氮化处理',
      summary: '承受连杆传来的周期性爆发气体力并转化为旋转扭矩输出。1、4缸曲柄销与2、3缸曲柄销呈 180° 对称布置，8片扇形平衡重平衡旋转惯性力，内部钻有斜向压力润滑油孔。',
      specs: ['轴颈配置: 5道主轴颈 + 4道连杆曲柄销', '平衡块: 8片流线型空气动力学切角平衡重', '动平衡精度: ≤ 5 g·cm']
    },
    pistons: {
      id: 'pistons',
      name: '涡轮凹顶铝合金活塞组 (×4)',
      enName: 'Forged Dish-Top Pistons with Valve Reliefs (×4)',
      group: 'crank_piston',
      isShell: false,
      explodeVec: [0, 2.35, 0],
      explodeStage: [0.55, 0.92],
      materialDesc: '4032 高硅低膨胀锻造铝合金 + 裙部二硫化钼石墨减摩涂层',
      summary: '直接承受高达 2200°C 的燃烧火焰冲击，顶面设有浅盆形涡流燃烧坑与4处气门避让月牙槽，活塞内部设有机油喷嘴冷却油腔，裙部石墨涂层降低冷启动敲缸磨损。',
      specs: ['压缩比设定: 9.8 : 1 (涡轮增压直喷设定)', '活塞平均线速度: 17.2 m/s @ 6000 RPM', '表面处理: 顶面硬质阳极氧化 + 裙部石墨减摩层']
    },
    piston_rings: {
      id: 'piston_rings',
      name: '三道气环与刮油环组 (4缸×3道=12环)',
      enName: 'Compression & Oil Control Piston Rings (12 pcs)',
      group: 'crank_piston',
      isShell: false,
      explodeVec: [0, 3.15, 0],
      explodeStage: [0.65, 1.0],
      materialDesc: 'PVD氮化铬涂层球墨铸铁第一气环 + 磷化锥面二道环 + 氮化钢带组合油环',
      summary: '镶嵌在活塞环槽内的动态密封核心：第一道气环密封高压燃气并将活塞70%的热量传给缸壁水套；第二道环辅助密封并向下刮油；第三道油环刮除多余机油并留存均匀油膜。',
      specs: ['环组结构: 2道气环 + 1道组合刮油环 / 每缸', '第一道环开口端隙: 0.20 ~ 0.35 mm', '工作接触压力: 气体背压自紧密封']
    },
    wrist_pins: {
      id: 'wrist_pins',
      name: '全浮式冷挤压活塞销与卡簧组 (×4)',
      enName: 'Full-Floating DLC Wrist Pins & Circlips (×4)',
      group: 'crank_piston',
      isShell: false,
      explodeVec: [-0.85, 2.35, 0],
      explodeStage: [0.68, 1.0],
      materialDesc: '20CrMnTi 渗碳合金钢中空厚壁管 + 类金刚石(DLC)超硬减摩涂层',
      summary: '铰接活塞与连杆小头，承受数吨的交变冲击载荷。采用两端内孔卡簧限位的“全浮式”设计，工作时可在连杆衬套与活塞销座内自由微转以均匀磨损。',
      specs: ['外表面硬度: HRC 60 ~ 64 (DLC涂层)', '结构特征: 内孔精密镗削减重中空结构', '限位装置: 8枚高弹性钢丝挡圈']
    },
    connecting_rods: {
      id: 'connecting_rods',
      name: 'H型断面锻造钢连杆与涨断瓦盖组 (×4)',
      enName: 'H-Beam Forged Steel Connecting Rods & Caps (×4)',
      group: 'crank_piston',
      isShell: false,
      explodeVec: [0, 1.05, 0],
      explodeStage: [0.58, 0.94],
      materialDesc: '4340 (40CrNiMoA) 航空级锻造铬镍钼钢 + 激光涨断大头盖 + ARP螺栓',
      summary: '将活塞的往复直线运动精确转化为曲轴的旋转运动。采用抗弯抗压极强的工字/H型截面杆身、青铜小头衬套与激光定裂涨断(Fracture-Split)分体大头轴承盖。',
      specs: ['连杆比 (r/L): 0.297 (平顺性与侧推力黄金平衡)', '大头定位工艺: 激光缺口涨断三维微观咬合自定位', '质量配组公差: 四支连杆质量差 ≤ 1.5 g']
    },

    // ================= 4. 点火与GDI高压直喷系统 =================
    ignition_coils: {
      id: 'ignition_coils',
      name: '高性能红头独立点火线圈与线束轨 (×4)',
      enName: 'Red-Top Coil-on-Plug (COP) Ignition Coils & Harness',
      group: 'ignition_fuel',
      isShell: false,
      explodeVec: [0, 5.25, 0],
      explodeStage: [0.0, 0.28],
      materialDesc: '环氧树脂真空灌封初次级硅钢绕组 + 耐高压硅胶绝缘护套',
      summary: '直接插装在每支火花塞顶端，省去传统分电器与高压分缸线能量损耗，由ECU独立控制点火提前角，瞬间将 12V 车载电压升压至 35,000V 击穿压缩混合气。',
      specs: ['次级峰值电压: 32 ~ 38 kV', '点火能量: ≥ 85 mJ (支持高增压稀薄燃烧)', '控制方式: ECU 四通道独立闭环爆震自适应控制']
    },
    spark_plugs: {
      id: 'spark_plugs',
      name: '激光焊接双铱金火花塞组 (×4)',
      enName: 'Laser Iridium Spark Plugs (×4)',
      group: 'ignition_fuel',
      isShell: false,
      explodeVec: [0, 3.65, 0],
      explodeStage: [0.18, 0.45],
      materialDesc: '99.5%高纯氧化铝棱纹陶瓷绝缘体 + 0.6mm超细铱合金中心电极 + 镀镍壳体',
      summary: '旋入燃烧室穹顶正中央，在压缩冲程接近上止点时释放高能电弧引燃混合气。超细铱金电极降低了跳火所需电压并减少消焰效应，耐受增压高温电蚀。',
      specs: ['螺纹规格: M12×1.25 长螺纹伸入式', '电极间隙: 0.70 ~ 0.80 mm (涡轮增压小间隙设定)', '热值等级: 冷型热值 7 ~ 8 级防早燃']
    },
    fuel_rail_injectors: {
      id: 'fuel_rail_injectors',
      name: '350Bar 高压燃油共轨与GDI侧置直喷嘴 (×4)',
      enName: '350-Bar GDI Stainless Fuel Rail & Piezo Injectors',
      group: 'ignition_fuel',
      isShell: false,
      explodeVec: [-1.85, 0.85, 0],
      explodeStage: [0.12, 0.42],
      materialDesc: '316L 锻造厚壁不锈钢共轨管 + 6孔激光微孔电磁/压电高速喷油器',
      summary: '将高达 35 MPa (350 bar) 的高压汽油直接喷入气缸燃烧室内，微米级雾化油滴瞬间蒸发吸热，显著降低缸内温度、抑制爆震并允许更高增压值与压缩比。',
      specs: ['最高喷射压力: 350 bar (35 MPa)', '喷雾微孔: 6孔非对称激光钻孔束流', '单循环多次喷射: 支持进气+压缩冲程最多3次分段喷射']
    },
    hpfp_pump: {
      id: 'hpfp_pump',
      name: '凸轮驱动单柱塞高压燃油泵 (HPFP)',
      enName: 'Cam-Driven High-Pressure Fuel Pump (HPFP)',
      group: 'ignition_fuel',
      isShell: false,
      explodeVec: [0.95, 3.45, -1.35],
      explodeStage: [0.06, 0.34],
      materialDesc: '马氏体不锈钢泵体 + DLC涂层精密偶件柱塞 + 数字溢流电磁阀',
      summary: '安装在气缸盖后端排气凸轮轴上方，由凸轮轴上的四方驱动桃尖通过滚轮挺柱机械驱动，将低压油箱泵送来的 5 bar 燃油二次增压至 350 bar 送入共轨管。',
      specs: ['驱动方式: 排气凸轮轴四方凸轮机械直驱', '压力调节: 集成数字比例进油计量电磁阀', '集成阻尼器: 顶部膜片式燃油脉动阻尼腔']
    },

    // ================= 5. 正时链条与前端轮系 =================
    vvt_phasers: {
      id: 'vvt_phasers',
      name: '进排气双 VVT 可变气门正时相位调节器 (×2)',
      enName: 'Dual VVT Hydraulic Camshaft Phasers (Intake & Exhaust)',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [0, 0.35, 1.85],
      explodeStage: [0.26, 0.56],
      materialDesc: '粉末冶金转子定子叶片腔 + 高频淬火精密正时链齿圈',
      summary: '安装在进、排气凸轮轴最前端，通过OCV机油控制阀向内部叶片腔充排高压机油，在发动机运转时实时连续提前或推迟气门开闭相位，兼顾低扭平顺性与高转爆发力。',
      specs: ['进气调节范围: 连续可变 50° 曲轴转角', '排气调节范围: 连续可变 40° 曲轴转角', '锁止机构: 熄火回位弹簧插销锁止']
    },
    timing_chain_system: {
      id: 'timing_chain_system',
      name: '静音齿形正时链条、导轨与液压张紧器',
      enName: 'Silent Timing Chain, Guides & Hydraulic Tensioner',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [0, 0, 2.35],
      explodeStage: [0.22, 0.54],
      materialDesc: '合金渗碳钢多片滚子/齿形静音链 + PA46耐磨尼龙弧形导轨 + 液压棘轮张紧器',
      summary: '精准连接曲轴正时链轮与顶部两枚VVT凸轮链轮，确保曲轴与凸轮轴严格保持 2:1 同步相位。液压张紧器利用机油压力配合止回棘轮实时消除链条热伸长与鞭振。',
      specs: ['链条类型: 高强度免维护静音正时链', '导轨组成: 固定侧导向轨 + 摆动侧张紧轨 + 顶部止跳轨', '设计寿命: ≥ 250,000 km']
    },
    timing_cover: {
      id: 'timing_cover',
      name: '铝合金正时链条前盖总成',
      enName: 'Cast Aluminum Timing Chain Front Cover',
      group: 'timing_fead',
      isShell: true,
      explodeVec: [0, 0, 3.15],
      explodeStage: [0.12, 0.40],
      materialDesc: '高压压铸铝合金(带散热加强筋) + PTFE聚四氟乙烯曲轴前油封',
      summary: '密封发动机前端正时链条润滑腔室，防止正时链高速运转飞溅的润滑油泄漏，底部开孔安装曲轴前油封，侧面预留发动机右悬置安装支座。',
      specs: ['密封工艺: 液体硅酮密封胶 (FIPG) 平面密封', '集成油封: 氟橡胶/PTFE双向螺旋回油唇口油封', '紧固螺栓: 14×M6/M8 周边环绕法兰螺栓']
    },
    harmonic_balancer: {
      id: 'harmonic_balancer',
      name: '曲轴谐波扭转减振皮带轮 (带60-2曲轴信号盘)',
      enName: 'Crankshaft Harmonic Damper Pulley',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [0, 0, 3.95],
      explodeStage: [0.04, 0.30],
      materialDesc: '球墨铸铁轮毂与惯性外环 + 硫化EPDM高阻尼减振橡胶夹层',
      summary: '安装在曲轴前端鼻轴上，既负责通过多楔带驱动发电机、水泵与空调，更利用内外金属环之间的硫化橡胶层吸收曲轴高转速下的危险扭转谐振，防止曲轴疲劳折断。',
      specs: ['皮带槽型: 6PK 多楔带沟槽', '阻尼结构: 橡胶粘弹性惯性质量扭振吸收器', '中心主螺栓紧固力矩: 150 N·m + 180° 转角']
    },
    serpentine_belt: {
      id: 'serpentine_belt',
      name: '前端附件多楔蛇形皮带与自动张紧轮 (FEAD)',
      enName: '6PK EPDM Serpentine Belt & Auto Tensioner',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [0, 0, 4.65],
      explodeStage: [0.0, 0.24],
      materialDesc: 'EPDM 三元乙丙耐热合成橡胶 + 芳纶抗拉线绳 + 扭簧自动张紧器',
      summary: '以单根6沟槽闭合蛇形路径同时包络曲轴皮带轮、冷却水泵、交流发电机与空调压缩机，利用带阻尼扭簧的自动张紧轮始终维持恒定皮带张力。',
      specs: ['皮带规格: 6PK 多楔防打滑截面', '传动效率: ≥ 98%', '张紧机构: 螺旋扭簧自适应偏心摆臂张紧轮']
    },
    alternator: {
      id: 'alternator',
      name: '智能整流交流发电机 (可见内部紫铜定子绕组)',
      enName: 'Brushless / Claw-Pole 150A Alternator',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [-2.15, 0.20, 2.25],
      explodeStage: [0.06, 0.34],
      materialDesc: '镂空散热压铸铝前后壳 + 高纯无氧紫铜扁线定子绕组 + 爪极转子 + 单向离合皮带轮',
      summary: '由前端多楔带驱动高速旋转，将机械能转化为稳定的 14.2V 直流电为点火、电喷及全车电气供电并向蓄电池充电，配备OAD单向超越离合皮带轮吸收转速突变冲击。',
      specs: ['额定输出电流: 14V / 150A (峰值功率 2.1 kW)', '绕组结构: 三相高槽满率紫铜绕组 + 内置双冷却风扇', '能量回收: 支持LIN总线智能减速发电负载调节']
    },
    water_pump_ac: {
      id: 'water_pump_ac',
      name: '离心式冷却水泵与变排量空调压缩机组件',
      enName: 'Centrifugal Water Pump & Swash-Plate A/C Compressor',
      group: 'timing_fead',
      isShell: false,
      explodeVec: [2.05, 0.20, 2.25],
      explodeStage: [0.08, 0.36],
      materialDesc: '铝合金涡壳闭式叶轮水泵 + 斜盘轴向多柱塞铝合金压缩机 + 电磁离合器',
      summary: '水泵强制驱动防冻冷却液在气缸体水套、气缸盖燃烧室水套、涡轮轴承体与散热水箱间高速循环；下部斜盘式空调压缩机由电磁离合吸合皮带轮驱动制冷循环。',
      specs: ['水泵最大流量: 165 L/min @ 6000 RPM', '电子节温器开启温度: 88°C ~ 102°C 映射控制', '压缩机形式: 6柱塞无级变排量斜盘式']
    },

    // ================= 6. 谐振进气与节气门系统 =================
    intake_manifold: {
      id: 'intake_manifold',
      name: '等长四歧道谐振进气歧管与稳压腔',
      enName: 'Tuned-Length 4-Runner Intake Manifold & Plenum',
      group: 'intake_system',
      isShell: false,
      explodeVec: [-2.75, 0.25, 0],
      explodeStage: [0.08, 0.38],
      materialDesc: 'PA6-GF35 玻纤增强工程尼龙振动摩擦焊 / 轻量化喷砂铸铝法兰',
      summary: '增压中冷后的高压洁净空气首先进入大容量稳压腔(Plenum)消除压力波动，随后经4根等长平滑弧形歧管均匀分配至各缸进气道，内壁光滑显著降低进气泵气损失。',
      specs: ['稳压腔容积: 3.2 L (优化涡轮增压油门响应)', '歧管设计: 四缸等长流线弯管 + 滚流翻板接口', '集成传感器: MAP 歧管绝对压力与进气温度传感器']
    },
    throttle_air_filter: {
      id: 'throttle_air_filter',
      name: '电子节气门体(可动黄铜蝶阀)与高流量冬菇头空滤',
      enName: 'Drive-by-Wire Electronic Throttle Body & Cone Air Filter',
      group: 'intake_system',
      isShell: false,
      explodeVec: [-3.55, 0.35, 1.45],
      explodeStage: [0.0, 0.26],
      materialDesc: 'CNC铝合金节气门阀体 + 黄铜精密蝶阀片 + 直流伺服电机 + 多层棉纱金属网空滤',
      summary: '连接加速踏板电信号与进气量的咽喉执行器！当您拖动界面上的转速/油门滑块时，可透过进气口观察到内部黄铜节气门蝶阀片随负荷同步旋转张开！',
      specs: ['阀体口径: Ø64 mm 大口径电子节气门', '位置反馈: 双路冗余非接触霍尔角度传感器', '响应时间: 全关至全开 ≤ 85 ms']
    },

    // ================= 7. 排气歧管与涡轮增压器 =================
    exhaust_manifold: {
      id: 'exhaust_manifold',
      name: '四合一等长双流道耐热排气歧管',
      enName: '4-into-1 Tubular Stainless / Ni-Resist Exhaust Header',
      group: 'exhaust_turbo',
      isShell: false,
      explodeVec: [2.35, 0.40, 0],
      explodeStage: [0.10, 0.40],
      materialDesc: 'Inconel / SUS310S 高镍耐热奥氏体不锈钢厚壁弯管 + 激光切割法兰',
      summary: '汇集4个气缸排出的高温高速脉冲废气，1-4缸与2-3缸按点火间隔分组汇入涡轮增压器双流道入口，消除排气干涉并最大化回收废气脉冲动能。高转速下呈现真实暗红热辐射辉光！',
      specs: ['持续工作温度: 750°C ~ 960°C (高负荷热辐射发红)', '流道设计: 脉冲增压等长三维空间弯管汇流', '密封垫: 多层不锈钢压花排气歧管垫']
    },
    turbocharger: {
      id: 'turbocharger',
      name: '双流道废气涡轮增压器总成 (冷热双蜗壳+飞旋叶轮)',
      enName: 'Twin-Scroll Turbocharger (Compressor + Turbine + Wastegate)',
      group: 'exhaust_turbo',
      isShell: true,
      explodeVec: [3.65, 0.15, -0.25],
      explodeStage: [0.0, 0.30],
      materialDesc: '高镍球铁涡轮热端蜗壳 + 压铸铝压气机冷端蜗壳 + 5轴CNC锻铝叶轮 + 镍基高温合金涡轮',
      summary: '利用原本白白排向大气的高温废气冲刷后端热蜗壳内的涡轮叶轮，通过同轴浮动轴承带动前端冷蜗壳内的银色CNC铣削叶轮以最高 180,000 RPM 超高速飞旋，强行将大量压缩空气压入气缸，使升功率翻倍！',
      specs: ['叶轮最高转速: 185,000 RPM', '最大相对增压值: 1.45 bar (绝对压力 2.45 bar)', '冷却与控压: 水冷+油冷中间体(CHRA) + 电子旁通废气阀(Wastegate)']
    },

    // ================= 8. 油底壳润滑与飞轮离合 =================
    windage_oil_pump: {
      id: 'windage_oil_pump',
      name: '防浪挡油板、转子机油泵与集油器滤网',
      enName: 'Windage Tray, Gerotor Oil Pump & Oil Pickup Tube',
      group: 'lube_flywheel',
      isShell: false,
      explodeVec: [0, -1.65, 0],
      explodeStage: [0.28, 0.58],
      materialDesc: '冲压镀锌钢百叶防浪板 + 粉末冶金内外转子机油泵 + 不锈钢吸油弯管与金属滤网',
      summary: '防浪挡油板隔离高速旋转的曲轴平衡重与油底壳油面，防止机油被搅打起泡损失马力；下方集油器滤网从油底壳最深处吸油，经机油泵加压至 4.5 bar 输送至主油道润滑曲轴、连杆、凸轮轴与涡轮轴承。',
      specs: ['机油工作压力: 怠速 1.8 bar / 高转 4.5 bar (带限压阀)', '吸油滤网孔径: 0.6 mm 双层不锈钢丝网', '减阻功效: 高转降低曲轴搅油马力损耗约 3~5 HP']
    },
    oil_pan: {
      id: 'oil_pan',
      name: '纵向散热鳍片铝合金油底壳与放油螺栓',
      enName: 'Finned Cast Aluminum Oil Sump & Magnetic Drain Plug',
      group: 'lube_flywheel',
      isShell: true,
      explodeVec: [0, -2.85, 0],
      explodeStage: [0.06, 0.36],
      materialDesc: 'ADC12 压铸铝合金(底部密集纵向风冷散热翼片) + 黄铜强磁放油螺栓',
      summary: '封闭曲轴箱底部的贮油容器，不仅增强了气缸体裙部的整体抗扭刚度，底部的密集纵向散热鳍片还能利用车底高速气流为高温机油高效降温，磁力放油螺丝可吸附极微量磨合铁屑。',
      specs: ['机油加注容量: 5.2 L (含机油滤清器)', '放油螺栓规格: M14×1.5 配紫铜垫片 (扭矩 30 N·m)', '内部构造: 防侧倾断油横向隔板 (Baffled Sump)']
    },
    oil_filter_dipstick: {
      id: 'oil_filter_dipstick',
      name: '旋装式全流机油滤清器与黄色拉环机油尺',
      enName: 'Spin-On Oil Filter, Cooler Base & Oil Dipstick',
      group: 'lube_flywheel',
      isShell: false,
      explodeVec: [-1.85, -1.05, 0.45],
      explodeStage: [0.04, 0.32],
      materialDesc: '耐压冷轧钢旋装滤罐 + 高精度合成纤维折纸滤芯 + 硅胶止回阀 + 弹簧钢标尺',
      summary: '全流式过滤进入主油道前的全部润滑机油，滤除 10 微米以上的金属磨粒与积碳胶质，内置冷启动旁通安全阀与熄火防回流止回阀；旁侧配有黄色拉环机油液位标尺。',
      specs: ['过滤精度: ≥ 99% @ 20 μm 颗粒', '旁通阀开启压差: 1.5 bar (保障极寒浓稠机油不断流)', '底座集成: 水冷板式机油冷却器换热底座']
    },
    flywheel_clutch: {
      id: 'flywheel_clutch',
      name: '双质量飞轮(带72齿起动齿圈)与膜片弹簧离合器压盘',
      enName: 'Dual-Mass Flywheel (DMF), Clutch Disc & Pressure Plate',
      group: 'lube_flywheel',
      isShell: false,
      explodeVec: [0, 0, -3.15],
      explodeStage: [0.05, 0.42],
      materialDesc: '高强度灰口铸铁摩擦盘 + 高频淬火中碳钢外齿圈 + 碳纤芳纶摩擦片 + 50CrVA膜片弹簧',
      summary: '紧固在曲轴后端输出法兰上：大转动惯量飞轮储存做功冲程动能，帮助活塞平稳越过吸气、压缩、排气三个消耗冲程；外缘72齿精密齿圈供起动机啮合点火启动；后方连接带减振弹簧的离合器摩擦片与膜片弹簧压盘输出澎湃动力！',
      specs: ['外缘起动齿圈: 高频感应淬火精密直齿圈', '扭振隔离: 双质量弧形弹簧吸振 + 离合器4组螺旋减振簧', '传递扭矩容量: ≥ 450 N·m']
    }
  };

  // 预设专业观察机位
  const CAMERA_PRESETS = {
    iso: {
      name: '斜45°全景',
      pos: [7.6, 5.4, 8.2],
      target: [0.0, 1.85, 0.0]
    },
    front_timing: {
      name: '正时轮系端',
      pos: [0.4, 2.2, 10.6],
      target: [0.0, 1.65, 2.5]
    },
    rear_flywheel: {
      name: '飞轮离合端',
      pos: [-2.4, 2.0, -9.8],
      target: [0.0, 1.0, -2.5]
    },
    turbo_side: {
      name: '涡轮排气侧',
      pos: [9.2, 3.4, 2.6],
      target: [1.2, 2.2, -0.2]
    },
    intake_side: {
      name: '进气直喷侧',
      pos: [-9.2, 3.4, 2.8],
      target: [-1.0, 2.2, 0.2]
    },
    valvetrain_top: {
      name: 'DOHC配气俯视',
      pos: [3.2, 8.8, 3.8],
      target: [0.0, 4.1, 0.0]
    },
    cutaway_cyl1: {
      name: '1缸燃烧室微距',
      pos: [5.4, 3.5, 5.8],
      target: [0.0, 2.6, 2.22]
    }
  };

  ns.ENGINE_SPEC = ENGINE_SPEC;
  ns.SYSTEM_GROUPS = SYSTEM_GROUPS;
  ns.PART_CATALOG = PART_CATALOG;
  ns.CAMERA_PRESETS = CAMERA_PRESETS;
})(window.EngineApp);
