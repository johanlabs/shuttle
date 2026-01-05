const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl, { transports: ['websocket'] });
  }

  push(initialPayload) {
    return new Promise((resolve) => {
      this.socket.emit('create-id');
      this.socket.once('id-generated', (id) => {
        const peerReadyHandler = (peerId) => {
          const p = new Peer({
            initiator: true,
            trickle: false,
            wrtc,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
          });

          p.on('signal', (signal) => this.socket.emit('signal', { to: peerId, signal }));
          
          const signalHandler = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };
          this.socket.on('signal', signalHandler);

          p.on('connect', () => {
            p.send(JSON.stringify(initialPayload));
            this.connectedPeer = p;
          });

          p.on('close', () => {
            this.socket.off('signal', signalHandler);
          });
        };

        this.socket.on('peer-ready', peerReadyHandler);

        resolve({
          id,
          peerPromise: new Promise((res) => {
            this.socket.once('peer-ready', () => {
              const checkConnection = setInterval(() => {
                if (this.connectedPeer && this.connectedPeer.connected) {
                  clearInterval(checkConnection);
                  res(this.connectedPeer);
                }
              }, 100);
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
          trickle: false,
          wrtc,
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }
        });

        this.socket.emit('peer-ready', { to: hostId });

        p.on('signal', (signal) => this.socket.emit('signal', { to: hostId, signal }));
        
        const signalHandler = (data) => {
          if (data.from === hostId) p.signal(data.signal);
        };
        this.socket.on('signal', signalHandler);

        p.on('connect', () => {
          resolve(p);
        });

        p.on('data', (data) => {
          try {
            const parsed = JSON.parse(data.toString());
            if (onData) onData(parsed);
          } catch (e) {
            console.error("Erro ao processar dados recebidos", e);
          }
        });

        p.on('error', (err) => {
          this.socket.off('signal', signalHandler);
          reject(err);
        });

        p.on('close', () => {
          this.socket.off('signal', signalHandler);
        });
      });
    });
  }
}

module.exports = Shuttle;