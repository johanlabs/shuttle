const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl, {
      transports: ['websocket'],
      reconnection: true
    });
  }

  push(initialPayload) {
    return new Promise((resolve, reject) => {
      const setup = () => {
        this.socket.emit('create-id');
        this.socket.once('id-generated', (id) => {
          const peerPromise = new Promise((peerResolve) => {
            this.socket.on('peer-joined', (peerId) => {
              const p = new Peer({
                initiator: true,
                trickle: false,
                wrtc,
                config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
              });

              p.on('signal', (signal) => {
                this.socket.emit('signal', { to: peerId, signal });
              });

              const signalHandler = (data) => {
                if (data.from === peerId) p.signal(data.signal);
              };

              this.socket.on('signal', signalHandler);

              p.on('connect', () => {
                p.send(JSON.stringify(initialPayload));
                peerResolve(p);
              });

              p.on('close', () => this.socket.off('signal', signalHandler));
              p.on('error', (err) => console.error('P2P Push Error:', err));
            });
          });
          resolve({ id, peerPromise });
        });
      };

      if (this.socket.connected) setup();
      else this.socket.once('connect', setup);
    });
  }

  pull(id, onData) {
    return new Promise((resolve, reject) => {
      const setup = () => {
        this.socket.emit('join-id', id);
        
        this.socket.on('peer-joined', (peerId) => {
          const p = new Peer({
            initiator: false,
            trickle: false,
            wrtc,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
          });

          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });

          const signalHandler = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };

          this.socket.on('signal', signalHandler);

          p.on('data', (data) => {
            const parsed = JSON.parse(data.toString());
            onData(parsed);
          });

          p.on('connect', () => {
            // Conectado com sucesso
          });

          p.on('close', () => this.socket.off('signal', signalHandler));
          p.on('error', (err) => reject(err));
        });

        this.socket.once('error', (err) => reject(new Error(err)));
      };

      if (this.socket.connected) setup();
      else this.socket.once('connect', setup);
    });
  }
}

module.exports = Shuttle;