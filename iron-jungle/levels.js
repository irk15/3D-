// The campaign: layout, enemies and look of each mission. Layout rule (so nobody gets wedged): ground
// obstacles, turrets and drums stay 1.8 clear of low platforms, 5.5 short of a ravine and 2 past it.
export const STAGES = [
  {
    name: 'IRON JUNGLE', short: 'Jungle', boss: 1, bossColor: [0x3b4148, 0xff3a18], enemy: { tint: 0xc8b078, visor: 0xff6a10 }, gunships: [148],
    gaps: [[48, 51.2], [96, 99.4], [152, 155.6]],
    platforms: [[18, 2.6, 6], [34, 2.8, 5], [41, 5, 4], [62, 2.6, 7], [78, 2.8, 5], [85, 5.2, 5], [110, 2.7, 6], [120, 5, 6], [136, 2.7, 8], [165, 2.8, 5], [173, 5.1, 5], [190, 2.7, 6]],
    obstacles: [[8, 'barrels', 1.3, 1.1], [26, 'sandbags', 1.5, 1], [86.5, 'crate', 1.2, 1.2], [117.5, 'barrels', 1.3, 1.1], [145, 'log', 1, 1], [173, 'crate', 1.2, 1.2], [178.5, 'sandbags', 1.5, 1], [197.5, 'barrels', 1.3, 1.1]],
    spawns: [[16, 'run'], [18, 'gun', 2.6], [24, 'run'], [11, 'drum'], [41.5, 'turret'], [34, 'gun', 2.8], [40, 'drone', 4.5], [43, 'run'], [56, 'run'], [58, 'run'], [63, 'gun', 2.6], [55.8, 'drum'], [70.3, 'turret'], [75, 'drone', 5], [85, 'gun', 5.2], [90, 'run'], [89.5, 'drum'], [110, 'gun', 2.7], [114, 'run'], [116, 'drone', 4], [120, 'turret', 5], [121.5, 'drum'], [124.8, 'turret'], [128, 'run'], [132, 'run'], [136, 'gun', 2.7], [145, 'drone', 5], [148, 'drone', 3.6], [182.5, 'turret'], [165, 'gun', 2.8], [173, 'gun', 5.1], [180, 'run'], [182, 'run'], [185, 'drone', 4.5], [190, 'turret', 2.7], [196, 'gun'], [200, 'run'], [203, 'turret'], [207, 'drum'], [212, 'drum']],
    extra: [[27, 'run'], [46, 'drone', 4.2], [66, 'run'], [80, 'gun', 2.8], [94, 'drone', 4.6], [112, 'run'], [137, 'turret', 2.7], [157, 'run'], [170, 'drone', 3.8], [188, 'run'], [199, 'drone', 4.4]],
    pickups: [[41, 6, 'spread'], [62, 4, 'nade'], [85, 6.6, 'laser'], [120, 7, 'rocket'], [136, 4.1, 'nade'], [173, 6.5, 'spread'], [192, 4.1, 'laser'], [209, 1.4, 'nade']],
    theme: {
      sky: [[.85, .34, .13], [.22, .14, .26], [.025, .05, .13], [1, .6, .25]], storm: [[.012, .02, .045], [.07, .1, .17]], aurora: 0,
      fog: [0x7a5560, 0x14223a], density: .0165, sun: [0xffa860, 0x7f9cff], sunPower: [3.9, 1.6], hemi: [0x8fa6d8, 0x2a2014, .55], rim: 0x5a8cff, exposure: 1.08,
      precip: 'rain', precipBase: 0, stormAt: [88, 132], lightning: true,
      rock: 0x77685f, ground: [0xa8a878, 'grass'], grass: [.17, .3, .45, .65, .1, .27], grassDensity: 1, foliage: 'jungle', floor: [0x3a4424, true], under: 0x101a0c, moss: 0x4c6a2c, canvas: 0x7c7248,
      mountains: [0x14201c, 0x30242f, 0x5a3640], water: 0x0d3a3c, mist: 0xb98a8c, shaft: [0xff9a4a, .13], dust: 0xffb46a,
      scenery: ['tent', 'supplies', 'jeep', 'fence', 'tower', 'head', 'tank', 'temple', 'antenna', 'heli']
    }
  },
  {
    name: 'SCORCHED CANYON', short: 'Canyon', boss: 1.3, bossColor: [0x7a5a38, 0xffa018], enemy: { tint: 0xe0c090, visor: 0x30e0ff, band: 0x7a2010 }, gunships: [112],
    gaps: [[40, 43.2], [80, 83.4], [122, 125.2], [164, 167.4]],
    platforms: [[14, 2.7, 6], [28, 2.8, 5], [33, 5, 4], [52, 2.6, 6], [66, 2.8, 6], [70, 5.2, 5], [92, 2.7, 6], [101, 5, 5], [112, 2.8, 6], [133, 2.7, 7], [148, 2.8, 5], [154, 5.1, 5], [175, 2.7, 6], [186, 2.6, 6], [192, 5, 5]],
    obstacles: [[7, 'barrels', 1.3, 1.1], [21, 'crate', 1.2, 1.2], [59, 'sandbags', 1.5, 1], [99, 'log', 1, 1], [140.8, 'crate', 1.2, 1.2], [156.5, 'barrels', 1.3, 1.1], [195.5, 'sandbags', 1.5, 1]],
    spawns: [[15, 'gun', 2.7], [18, 'run'], [24, 'drone', 4.6], [30, 'run'], [33, 'gun', 5], [38, 'drone', 4], [46, 'drum'], [47, 'run'], [53, 'gun', 2.6], [57, 'drone', 5], [64, 'run'], [67, 'gun', 2.8], [72.8, 'turret'], [77, 'drone', 4.2], [86.3, 'drum'], [90, 'run'], [93, 'gun', 2.7], [101, 'turret', 5], [104, 'turret'], [108, 'run'], [110, 'drone', 4.8], [113, 'gun', 2.8], [118, 'drone', 3.6], [130, 'run'], [134, 'gun', 2.7], [138, 'run'], [143, 'drone', 4.5], [149, 'gun', 2.8], [153.2, 'drum'], [154, 'turret', 5.1], [170, 'run'], [172, 'run'], [176, 'gun', 2.7], [180.5, 'drum'], [183, 'drone', 4.4], [187, 'turret', 2.6], [192, 'gun', 5], [202, 'turret'], [205, 'run'], [208, 'drone', 5], [210.5, 'drum']],
    extra: [[22, 'run'], [50, 'drone', 3.8], [69, 'run'], [95, 'drone', 4], [115, 'run'], [133, 'turret', 2.7], [146, 'run'], [168, 'drone', 3.8], [178, 'run'], [197, 'drone', 4.2]],
    pickups: [[33, 6.4, 'laser'], [52, 4, 'nade'], [70, 6.7, 'spread'], [101, 7, 'rocket'], [133, 4.1, 'nade'], [154, 6.8, 'laser'], [186, 4, 'spread'], [200, 1.4, 'nade']],
    theme: {
      sky: [[1, .66, .36], [.5, .56, .74], [.12, .26, .58], [1, .82, .5]], storm: [[.3, .14, .05], [.66, .36, .15]], aurora: 0,
      fog: [0xc89468, 0x9a5a2c], density: .012, sun: [0xffdcb0, 0xff9448], sunPower: [3.3, 2.1], hemi: [0xbfd4ff, 0x8a5a30, .6], rim: 0xffb070, exposure: .98,
      precip: 'sand', precipBase: 0, stormAt: [100, 140], lightning: false,
      rock: 0xb4674a, ground: [0xd8a868, 'rock'], grass: [.09, .13, .35, .55, .2, .38], grassDensity: .18, foliage: 'desert', floor: [0x9a6838, false], under: 0x3a2012, moss: 0xb08454, canvas: 0xa8895c,
      mountains: [0x7a3a24, 0xa45a40, 0xc08a72], water: 0x4a2412, mist: 0xe0b080, shaft: [0xffd090, .07], dust: 0xffd8a0,
      scenery: ['tent', 'supplies', 'jeep', 'fence', 'tower', 'tank', 'head', 'antenna', 'heli']
    }
  },
  {
    name: 'FROZEN OUTPOST', short: 'Frozen Base', boss: 1.6, bossColor: [0x4a5a6c, 0x30c8ff], enemy: { tint: 0xd8e4f0, visor: 0xff2060, band: 0x1a3a6a }, gunships: [86, 158],
    gaps: [[36, 39.2], [66, 69.4], [104, 107.2], [138, 141.4], [176, 179.2]],
    platforms: [[12, 2.7, 6], [24, 2.8, 5], [29, 5.1, 4], [48, 2.7, 7], [56, 5, 5], [78, 2.8, 6], [88, 2.6, 5], [93, 5.2, 5], [116, 2.7, 8], [127, 5, 5], [150, 2.8, 6], [160, 5, 5], [188, 2.7, 6], [200, 5, 5]],
    obstacles: [[5, 'log', 1, 1], [18.2, 'crate', 1.2, 1.2], [55.5, 'sandbags', 1.5, 1], [95.5, 'barrels', 1.3, 1.1], [123.5, 'crate', 1.2, 1.2], [130.8, 'log', 1, 1], [157.5, 'sandbags', 1.5, 1], [195, 'barrels', 1.3, 1.1], [205, 'crate', 1.2, 1.2]],
    spawns: [[13, 'gun', 2.7], [16, 'run'], [22, 'run'], [26, 'drone', 4.4], [29.4, 'drum'], [29, 'gun', 5.1], [44, 'run'], [49, 'gun', 2.7], [52, 'drone', 4.6], [56, 'turret', 5], [58.6, 'turret'], [63, 'run'], [72.3, 'drum'], [75, 'run'], [79, 'gun', 2.8], [89, 'gun', 2.6], [93, 'turret', 5.2], [97, 'drone', 4], [112, 'run'], [114, 'run'], [117, 'gun', 2.7], [120, 'drone', 5], [127.2, 'turret'], [133, 'drone', 3.8], [144.3, 'drum'], [147, 'run'], [151, 'gun', 2.8], [160, 'gun', 5], [163, 'turret'], [168, 'turret'], [172, 'run'], [183, 'run'], [186, 'drone', 4.5], [189, 'turret', 2.7], [192, 'run'], [200, 'turret', 5], [200.5, 'turret'], [203, 'drone', 4.2], [208, 'run'], [211, 'drum']],
    extra: [[20, 'run'], [46, 'drone', 3.8], [61, 'run'], [82, 'drone', 4.4], [100, 'run'], [116, 'turret', 2.7], [135, 'run'], [155, 'drone', 3.8], [174, 'drone', 4.6], [198, 'run']],
    pickups: [[29, 6.5, 'spread'], [48, 4, 'nade'], [56, 6.6, 'laser'], [93, 7, 'rocket'], [116, 4.1, 'nade'], [127, 6.5, 'spread'], [160, 6.5, 'rocket'], [188, 4.1, 'laser'], [208, 1.4, 'nade']],
    theme: {
      sky: [[.2, .46, .58], [.07, .12, .3], [.008, .016, .055], [.55, .75, 1]], storm: [[.14, .2, .3], [.36, .45, .58]], aurora: 1,
      fog: [0x36506e, 0x7e94ae], density: .0145, sun: [0xb4d0ff, 0xc4d8f4], sunPower: [2.2, 1.5], hemi: [0xaccaff, 0x506478, .75], rim: 0x60e0ff, exposure: 1.02,
      precip: 'snow', precipBase: .45, stormAt: [90, 150], lightning: false,
      rock: 0x66768c, ground: [0x9fb2d0, null], grass: [.5, .58, .08, .2, .3, .52], grassDensity: .15, foliage: 'pine', floor: [0xaab8d0, false], under: 0x142030, moss: 0xdce8f8, canvas: 0x5c6c78,
      mountains: [0x16263a, 0x304668, 0x56709a], water: 0x123850, mist: 0x9ab4d4, shaft: [0x70e0c0, .06], dust: 0xdcecff,
      scenery: ['tent', 'supplies', 'jeep', 'fence', 'tower', 'tank', 'antenna', 'heli']
    }
  }
];
