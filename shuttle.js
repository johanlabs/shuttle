const Peer = require('simple-peer');
const wrtc = require('wrtc');
const io = require('socket.io-client');

class Shuttle {
  constructor(signalUrl = 'http://localhost:3000') {
    this.socket = io(signalUrl);
  }

  push(payload) {
    return new Promise((resolve) => {
      this.socket.emit('create-id');
      this.socket.on('id-generated', (id) => {
        console.log(`Shuttle ID: ${id}`);
        this.socket.on('peer-joined', (peerId) => {
          const p = new Peer({ initiator: true, trickle: false, wrtc });
          p.on('signal', (signal) => {
            this.socket.emit('signal', { to: peerId, signal });
          });
          this.socket.on('signal', (data) => {
            if (data.from === peerId) p.signal(data.signal);
          });
          p.on('connect', () => {
            p.send(JSON.stringify(payload));
            console.log('Payload pushed successfully');
          });
        });
        resolve(id);
      });
    });
  }

  pull(id) {
    return new Promise((resolve, reject) => {
      this.socket.emit('join-id', id);
      this.socket.on('peer-joined', (peerId) => {
        const p = new Peer({ initiator: false, trickle: false, wrtc });
        p.on('signal', (signal) => {
          this.socket.emit('signal', { to: peerId, signal });
        });
        this.socket.on('signal', (data) => {
          if (data.from === peerId) p.signal(data.signal);
        });
        p.on('data', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });
      this.socket.on('error', reject);
    });
  }
}

module.exports = Shuttle;