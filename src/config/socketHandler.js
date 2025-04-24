import { socketAuth } from "../middlewares/auth.js";
import { SOCKET_CMD } from "../utils/constant.js";
import {
  handleSendMsgInvalidToken,
  socketSuccessResponse,
} from "../services/socketService.js";
import { isValidSession } from "../services/cacheService.js";
import { decodeToken } from "../services/jwtService.js";

const ACTIVE_SESSIONS = new Map(); // username - socket.id

const getActiveSessions = () => {
  return ACTIVE_SESSIONS;
};

const handleClearClientSessions = (socket) => {
  for (const [username, id] of ACTIVE_SESSIONS.entries()) {
    if (id === socket.id) {
      ACTIVE_SESSIONS.delete(username);
      break;
    }
  }
};

const clientPingHandler = (io, socket) => {
  socket.on(SOCKET_CMD.CLIENT_PING, (msg) => {
    try {
      const { username, sessionId } = decodeToken(msg.token);
      if (username) {
        if (!isValidSession(username, sessionId)) {
          handleSendMsgInvalidToken(socket);
        }
        ACTIVE_SESSIONS.set(username, socket.id);
        socket.join(username);
        io.to(username).emit(
          SOCKET_CMD.CLIENT_PING,
          socketSuccessResponse({
            message: "Ping success with username: " + username,
          })
        );
      } else {
        handleSendMsgInvalidToken(socket);
      }
    } catch {
      handleSendMsgInvalidToken(socket);
    }
  });
};

const setupSocket = (io) => {
  io.use(socketAuth);
  io.on("connection", (socket) => {
    console.log("Socket connected: ", socket.id);

    clientPingHandler(io, socket);

    socket.on("disconnect", () => {
      console.log("Socket disconnected: ", socket.id);
      handleClearClientSessions(socket);
    });
  });
};

export { setupSocket, getActiveSessions };
