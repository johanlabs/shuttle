const io = require('socket.io')(3000, {
  cors: { origin: '*' },
  transports: ['websocket']
});

const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-id', () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[id] = socket.id;
    socket.emit('id-generated', id);
  });

  socket.on('join-id', (id) => {
    const hostId = rooms[id];
    if (hostId && io.sockets.sockets.has(hostId)) {
      // Avisa o host que alguém entrou
      io.to(hostId).emit('peer-joined', socket.id);
      // Avisa o cliente quem é o host
      socket.emit('peer-joined', hostId);
    } else {
      socket.emit('error', 'ID Inválido ou Host Offline');
    }
  });

  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
  });

  socket.on('disconnect', () => {
    for (const id in rooms) {
      if (rooms[id] === socket.id) delete rooms[id];
    }
  });
});

console.log('Signaling server running on port 3000');