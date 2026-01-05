const io = require('socket.io')(3000, {
  cors: { origin: '*' }
});
const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-id', () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[id] = socket.id;
    socket.emit('id-generated', id);
  });

  socket.on('join-id', (id) => {
    const target = rooms[id];
    if (target) {
      socket.to(target).emit('peer-joined', socket.id);
    } else {
      socket.emit('error', 'ID not found');
    }
  });

  socket.on('signal', ({ to, signal }) => {
    socket.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(id => {
      if (rooms[id] === socket.id) delete rooms[id];
    });
  });
});