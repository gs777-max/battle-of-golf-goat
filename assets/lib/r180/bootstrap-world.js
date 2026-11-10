import { boot } from './boot-common.js?v=4.16';
boot({
  params: { antialias: true, powerPreference: 'high-performance' },
  gameSrc: 'assets/game-world.js'
});
