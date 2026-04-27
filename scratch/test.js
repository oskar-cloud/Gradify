const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

let token = '';
try {
  const session = JSON.parse(fs.readFileSync(process.env.APPDATA + '\\Gradify\\session.json', 'utf8'));
  token = session.access_token;
} catch(e) {
  try {
    const session = JSON.parse(fs.readFileSync(process.env.APPDATA + '\\gradify\\session.json', 'utf8'));
    token = session.access_token;
  } catch(e2) {
    console.error('Could not find token', e2);
    process.exit(1);
  }
}

const html = `
<!DOCTYPE html>
<html>
<body>
  <h1>Spotify Headless Test</h1>
  <script src="https://sdk.scdn.co/spotify-player.js"></script>
  <script>
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('SDK Ready');
      const player = new Spotify.Player({
        name: 'Headless Edge',
        getOAuthToken: cb => { cb("${token}"); },
        volume: 0.5
      });

      player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });
      player.addListener('initialization_error', ({ message }) => { console.error('init err:', message); });
      player.addListener('authentication_error', ({ message }) => { console.error('auth err:', message); });
      player.addListener('account_error', ({ message }) => { console.error('acc err:', message); });
      player.addListener('playback_error', ({ message }) => { console.error('play err:', message); });

      player.connect().then(success => {
        console.log('Connected', success);
      });
    };
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(0, () => {
  const port = server.address().port;
  console.log('Server running on port', port);
  
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--enable-features=Widevine',
    '--user-data-dir=C:\\temp\\edge-spotify-test',
    '--enable-logging',
    '--v=1',
    `http://localhost:${port}`
  ]);

  edge.stdout.on('data', d => console.log('EDGE OUT:', d.toString()));
  edge.stderr.on('data', d => console.log('EDGE ERR:', d.toString()));
  
  setTimeout(() => {
    edge.kill();
    server.close();
    process.exit(0);
  }, 10000);
});
