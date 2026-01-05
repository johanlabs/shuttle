const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl, { transports: ['websocket'] });
    this.activePeers = new Set();
  }

  push(initialPayload) {
    return new Promise((resolve) => {
      this.socket.emit('create-id');
      
      this.socket.once('id-generated', (id) => {
        this.socket.on('peer-ready', (peerId) => {
          const p = new Peer({
            initiator: true,
            trickle: true,
            wrtc,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
          });

          this.activePeers.add(p);

          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });

          const onSignal = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };
          this.socket.on('signal', onSignal);

          p.on('connect', () => {
            p.send(JSON.stringify(initialPayload));
            // Mantemos a conexão viva para o modo watch
          });

          p.on('close', () => {
            this.activePeers.delete(p);
            this.socket.off('signal', onSignal);
          });

          p.on('error', (err) => {
            console.error('Peer Error:', err);
            this.activePeers.delete(p);
          });
        });

        // Resolvemos o ID imediatamente para o CLI mostrar, 
        // mas o peerPromise aguarda o evento de conexão real
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
              }, 500);
            });
          })
        });
      });
    });
  }

  pull(id, onData) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-id', id);

      this.socket.once('peer-joined', (hostId) => {
        const p = new Peer({
          initiator: false,
          trickle: true,
          wrtc,
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
        });

        this.activePeers.add(p);

        p.on('signal', (signal) => {
          this.socket.emit('signal', { to: hostId, signal });
        });

        const onSignal = (data) => {
          if (data.from === hostId) p.signal(data.signal);
        };
        this.socket.on('signal', onSignal);

        p.on('connect', () => {
          resolve(p);
        });

        p.on('data', (data) => {
          try {
            const json = JSON.parse(data.toString());
            if (onData) onData(json);
          } catch (e) {
            console.error('Data Parse Error');
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