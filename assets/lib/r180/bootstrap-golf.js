import { boot } from './boot-common.js?v=4.36';
boot({
  params: {
    canvas: document.getElementById('canvas'),
    antialias: !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    powerPreference: 'high-performance',
    alpha: false
  },
  gameSrc: 'assets/game-golf.js'
});
