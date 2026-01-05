const Peer = require('simple-peer');
const wrtc = require('@roamhq/wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl);
    this.config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
  }

  push(initialPayload) {
    return new Promise((resolve) => {
      this.socket.emit('create-id');
      this.socket.on('id-generated', (id) => {
        const peerPromise = new Promise((peerResolve) => {
          this.socket.on('peer-joined', (peerId) => {
            const p = new Peer({ initiator: true, trickle: false, wrtc, config: this.config });
            p.on('signal', (signal) => this.socket.emit('signal', { to: peerId, signal }));
            this.socket.on('signal', (data) => { if (data.from === peerId) p.signal(data.signal); });
            p.on('connect', () => {
              p.send(JSON.stringify(initialPayload));
              peerResolve(p);
            });
          });
        });
        resolve({ id, peerPromise });
      });
    });
  }

  pull(id, onData) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-id', id);
      this.socket.on('peer-joined', (peerId) => {
        const p = new Peer({ initiator: false, trickle: false, wrtc, config: this.config });
        p.on('signal', (signal) => this.socket.emit('signal', { to: peerId, signal }));
        this.socket.on('signal', (data) => { if (data.from === peerId) p.signal(data.signal); });
        p.on('data', (data) => onData(JSON.parse(data.toString())));
        p.on('error', reject);
      });
    });
  }
}

module.exports = Shuttle;