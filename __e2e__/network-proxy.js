const net = require('net');

// TLS passes through unchanged. Outages close real WebView transport connections.
module.exports = () => {
  const sockets = new Set();
  const state = { offline: false, attempts: [], blocked: [], dropped: 0 };
  return {
    state,
    setOffline(offline) {
      state.offline = offline;
      if (offline) {
        state.dropped += sockets.size;
        for (const socket of sockets) {
          socket.destroy();
        }
      }
    },
    connect(req, client, head) {
      let target;
      try {
        target = new URL(`https://${req.url}`);
      } catch {
        client.destroy();
        return;
      }
      state.attempts.push(target.hostname);
      client.on('error', () => client.destroy());
      if (state.offline) {
        state.blocked.push(target.hostname);
        client.destroy();
        return;
      }
      const upstream = net.connect(Number(target.port || 443), target.hostname);
      sockets.add(client);
      client.on('close', () => {
        sockets.delete(client);
        upstream.destroy();
      });
      upstream.on('error', () => client.destroy());
      upstream.on('close', () => client.destroy());
      upstream.on('connect', () => {
        if (state.offline) {
          client.destroy();
          return;
        }
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) {
          upstream.write(head);
        }
        upstream.pipe(client);
        client.pipe(upstream);
      });
    },
  };
};
