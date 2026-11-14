import { boot } from './boot-common.js?v=4.24';
boot({
  params: { antialias: true, powerPreference: 'high-performance' },
  gameSrc: 'assets/game-world.js'
});
