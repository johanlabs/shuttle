const io = require('socket.io')(3000, {
  cors: { origin: '*' },
  transports: ['websocket']
});
const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-id', () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[id] = socket.id;
    socket.emit('id-generated', id);
    console.log(`Room created: ${id} by ${socket.id}`);
  });

  socket.on('join-id', (id) => {
    const target = rooms[id];
    if (target && io.sockets.sockets.has(target)) {
      socket.emit('peer-joined', target);
      io.to(target).emit('peer-joined', socket.id);
      console.log(`Peer ${socket.id} matched with ${target} via ID ${id}`);
    } else {
      socket.emit('error', 'ID not found or host offline');
    }
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(id => {
      if (rooms[id] === socket.id) {
        console.log(`Room ${id} removed (host disconnected)`);
        delete rooms[id];
      }
    });
  });
});

console.log('Signaling server on port 3000');