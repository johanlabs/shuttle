const io = require('socket.io')(3000, {
  cors: { origin: '*' }
});
const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-id', () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[id] = socket.id;
    socket.emit('id-generated', id);
    console.log(`Room created: ${id}`);
  });

  socket.on('join-id', (id) => {
    const target = rooms[id];
    if (target) {
      socket.to(target).emit('peer-joined', socket.id);
      socket.emit('peer-joined', target);
      console.log(`Peer ${socket.id} joining room: ${id}`);
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

console.log('Signaling server on port 3000');