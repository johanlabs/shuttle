const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl, {
      transports: ['websocket'],
      reconnection: true
    });
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };
  }

  push(initialPayload) {
    return new Promise((resolve, reject) => {
      if (!this.socket.connected) {
        this.socket.once('connect', () => this._executePush(initialPayload, resolve));
      } else {
        this._executePush(initialPayload, resolve);
      }
      this.socket.once('connect_error', reject);
    });
  }

  _executePush(initialPayload, resolve) {
    this.socket.emit('create-id');
    this.socket.once('id-generated', (id) => {
      const peerPromise = new Promise((peerResolve) => {
        const onPeerJoined = (peerId) => {
          const p = new Peer({ initiator: true, trickle: false, wrtc, config: this.config });
          
          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });

          const onSignal = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };

          this.socket.on('signal', onSignal);

          p.on('connect', () => {
            p.send(JSON.stringify(initialPayload));
            peerResolve(p);
          });

          p.on('close', () => {
            this.socket.off('signal', onSignal);
          });
        };

        this.socket.on('peer-joined', onPeerJoined);
      });
      resolve({ id, peerPromise });
    });
  }

  pull(id, onData) {
    return new Promise((resolve, reject) => {
      const startPull = () => {
        this.socket.emit('join-id', id);
        
        this.socket.once('peer-joined', (peerId) => {
          const p = new Peer({ initiator: false, trickle: false, wrtc, config: this.config });

          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });

          const onSignal = (data) => {
            if (data.from === peerId) p.signal(data.signal);
          };

          this.socket.on('signal', onSignal);

          p.on('data', (data) => {
            try {
              const parsed = JSON.parse(data.toString());
              onData(parsed);
            } catch (e) {
              console.error('Data parse error');
            }
          });

          p.on('error', (err) => {
            this.socket.off('signal', onSignal);
            reject(err);
          });
          
          p.on('close', () => {
            this.socket.off('signal', onSignal);
          });
        });

        this.socket.once('error', (msg) => reject(new Error(msg)));
      };

      if (!this.socket.connected) {
        this.socket.once('connect', startPull);
      } else {
        startPull();
      }
    });
  }
}

module.exports = Shuttle;