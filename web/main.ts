const root = document.getElementById('game')!;
const c = document.createElement('canvas');
c.width = window.innerWidth;
c.height = window.innerHeight;
root.appendChild(c);

const ctx = c.getContext('2d')!;
ctx.fillStyle = '#1b2a1b';
ctx.fillRect(0, 0, c.width, c.height);
ctx.fillStyle = '#eaeaea';
ctx.font = '24px system-ui';
ctx.fillText('The Mosaic — booting…', 40, 60);
