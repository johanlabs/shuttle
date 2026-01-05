const io = require('socket.io')(3000, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000
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
    if (!hostId) {
      socket.emit('error', 'ID não encontrado');
      return;
    }

    socket.emit('peer-joined', hostId);
    io.to(hostId).emit('peer-ready', socket.id);
  });

  socket.on('peer-ready', ({ to }) => {
    io.to(to).emit('peer-ready', socket.id);
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('disconnect', () => {
    for (const id in rooms) {
      if (rooms[id] === socket.id) delete rooms[id];
    }
  });
});