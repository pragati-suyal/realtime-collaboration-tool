const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const rooms = new Map();

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));


function createRoomId() {
  return crypto.randomBytes(4).toString("hex");
}


function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      document: "",
      language: "javascript",
      users: new Map(),
      createdAt: Date.now()
    });
  }

  return rooms.get(roomId);
}


function roomUsers(room) {
  return Array.from(room.users.values()).map(user => ({
    id: user.id,
    name: user.name,
    color: user.color
  }));
}


function makeColor() {
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#ea580c",
    "#059669",
    "#0891b2",
    "#4f46e5",
    "#65a30d"
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}


app.get("/api/room/:roomId", (req, res) => {
  const room = getOrCreateRoom(req.params.roomId);

  res.json({
    roomId: req.params.roomId,
    document: room.document,
    language: room.language,
    users: roomUsers(room)
  });
});


app.post("/api/rooms", (req, res) => {
  const roomId = createRoomId();

  getOrCreateRoom(roomId);

  res.json({
    roomId: roomId
  });
});


io.on("connection", socket => {

 
  socket.on("join-room", ({ roomId, name }) => {

    if (!roomId) {
      return;
    }

    const cleanName =
      String(name || "Anonymous")
        .trim()
        .slice(0, 30) || "Anonymous";

    const room = getOrCreateRoom(roomId);

    const user = {
      id: socket.id,
      name: cleanName,
      color: makeColor()
    };

    socket.join(roomId);

    socket.data.roomId = roomId;
    socket.data.user = user;

    
    room.users.set(socket.id, user);

   
    socket.emit("room-state", {
      document: room.document,
      language: room.language,
      users: roomUsers(room)
    });

    
    socket.to(roomId).emit("user-joined", {
      user: user,
      users: roomUsers(room)
    });

    
    io.to(roomId).emit(
      "users-updated",
      roomUsers(room)
    );
  });


 
  socket.on(
    "document-change",
    ({ roomId, content, version }) => {

      if (!roomId || typeof content !== "string") {
        return;
      }

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      
      room.document = content;

      
      socket.to(roomId).emit(
        "document-change",
        {
          content: content,
          version: version || Date.now(),
          senderId: socket.id
        }
      );
    }
  );


  
  socket.on(
    "language-change",
    ({ roomId, language }) => {

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      room.language =
        String(language || "javascript");

      socket.to(roomId).emit(
        "language-change",
        room.language
      );
    }
  );


  
  socket.on(
    "cursor-change",
    ({ roomId, cursor }) => {

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      const user = room.users.get(socket.id);

      socket.to(roomId).emit(
        "cursor-change",
        {
          userId: socket.id,
          name: user.name,
          color: user.color,
          cursor: cursor
        }
      );
    }
  );


  
  socket.on(
    "typing",
    ({ roomId, isTyping }) => {

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      const user = room.users.get(socket.id);

      socket.to(roomId).emit(
        "typing",
        {
          userId: socket.id,
          name: user.name,
          isTyping: Boolean(isTyping)
        }
      );
    }
  );


  
  socket.on(
    "chat-message",
    ({ roomId, message }) => {

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      const cleanMessage =
        String(message || "")
          .trim()
          .slice(0, 500);

      if (!cleanMessage) {
        return;
      }

      const user = room.users.get(socket.id);

      io.to(roomId).emit(
        "chat-message",
        {
          id: crypto.randomUUID(),
          userId: socket.id,
          name: user.name,
          message: cleanMessage,
          timestamp: Date.now()
        }
      );
    }
  );


 
  socket.on(
    "clear-document",
    ({ roomId }) => {

      const room = rooms.get(roomId);

      if (!room || !room.users.has(socket.id)) {
        return;
      }

      room.document = "";

      io.to(roomId).emit(
        "document-change",
        {
          content: "",
          version: Date.now(),
          senderId: socket.id
        }
      );
    }
  );


 
  socket.on("disconnect", () => {

    const roomId = socket.data.roomId;

    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    // Remove user
    room.users.delete(socket.id);

    
    socket.to(roomId).emit(
      "user-left",
      {
        userId: socket.id,
        users: roomUsers(room)
      }
    );

   
    io.to(roomId).emit(
      "users-updated",
      roomUsers(room)
    );

    
    if (room.users.size === 0) {

      setTimeout(() => {

        const currentRoom = rooms.get(roomId);

        if (
          currentRoom &&
          currentRoom.users.size === 0
        ) {
          rooms.delete(roomId);
        }

      }, 10 * 60 * 1000);
    }
  });
});



app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});



server.listen(PORT, () => {

  console.log(
    `Real-time collaboration tool running at http://localhost:${PORT}`
  );

});