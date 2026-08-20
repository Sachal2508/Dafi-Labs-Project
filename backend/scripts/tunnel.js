const localtunnel = require('localtunnel');

(async () => {
  let tunnel;
  async function connect() {
    try {
      tunnel = await localtunnel({ port: 3001, subdomain: 'opsagent-assistant' });
      console.log(`[Tunnel Active] Forwarding URL: ${tunnel.url}`);

      tunnel.on('close', () => {
        console.log('[Tunnel Closed] Reconnecting in 3s...');
        setTimeout(connect, 3000);
      });

      tunnel.on('error', (err) => {
        console.error('[Tunnel Error]', err.message);
        tunnel.close();
      });
    } catch (err) {
      console.error('[Tunnel Connect Error]', err.message);
      setTimeout(connect, 4000);
    }
  }

  await connect();
})();
