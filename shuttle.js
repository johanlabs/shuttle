const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');
const fs = require('fs-extra');
const path = require('path');

const CHUNK_SIZE = 64 * 1024;

function chunkString(str) {
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    chunks.push(str.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE;
  }
  return chunks;
}

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl, { transports: ['websocket'] });
    this.activePeers = new Set();
  }

  push(initialPayload, options = {}) {
    return new Promise((resolve) => {
      this.socket.emit('create-id');

      this.socket.once('id-generated', (id) => {
        this.socket.on('peer-ready', (peerId) => {
          const p = new Peer({ initiator: true, trickle: true, wrtc });
          this.activePeers.add(p);

          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });

          const onSignal = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };
          this.socket.on('signal', onSignal);

          p.on('connect', () => {
            const payload = JSON.stringify(initialPayload);
            const chunks = chunkString(payload);
            for (let i = 0; i < chunks.length; i++) {
              p.send(JSON.stringify({ t: 'chunk', i, d: chunks[i] }));
            }
            p.send(JSON.stringify({ t: 'end' }));
          });

          p.on('data', async (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.t === 'propose-change' && options.allowChanges) {
              if (options.autoAccept && options.root) {
                const dest = path.resolve(options.root, msg.path);
                await fs.ensureDir(path.dirname(dest));
                await fs.writeFile(dest, Buffer.from(msg.content, 'base64'));
                p.send(JSON.stringify({ t: 'change-accepted', path: msg.path }));
              }
            }
          });

          p.on('close', () => {
            this.activePeers.delete(p);
            this.socket.off('signal', onSignal);
          });

          p.on('error', () => {
            this.activePeers.delete(p);
          });
        });

        resolve({
          id,
          peerPromise: new Promise((res) => {
            this.socket.on('peer-ready', () => {
              const check = setInterval(() => {
                for (const p of this.activePeers) {
                  if (p.connected) {
                    clearInterval(check);
                    res(p);
                  }
                }
              }, 300);
            });
          })
        });
      });
    });
  }

  pull(id, onData, options = {}) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-id', id);

      this.socket.once('peer-joined', (hostId) => {
        const p = new Peer({ initiator: false, trickle: true, wrtc });
        this.activePeers.add(p);
        let buffer = [];

        if (options.onPeer) options.onPeer(p);

        p.on('signal', (signal) => {
          this.socket.emit('signal', { to: hostId, signal });
        });

        const onSignal = (data) => {
          if (data.from === hostId) p.signal(data.signal);
        };
        this.socket.on('signal', onSignal);

        p.on('connect', () => resolve(p));

        p.on('data', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.t === 'chunk') buffer[msg.i] = msg.d;
          if (msg.t === 'end') {
            const json = JSON.parse(buffer.join(''));
            buffer = [];
            if (onData) onData(json);
            if (!options.live) p.destroy();
          }
        });

        p.on('error', (err) => {
          this.socket.off('signal', onSignal);
          reject(err);
        });

        p.on('close', () => {
          this.activePeers.delete(p);
          this.socket.off('signal', onSignal);
        });
      });
    });
  }
}

module.exports = Shuttle;