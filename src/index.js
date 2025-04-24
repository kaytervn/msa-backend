import express from "express";
import cors from "cors";
import { CORS_OPTIONS, ENV, JSON_LIMIT } from "./utils/constant.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { startAllJobs } from "./utils/cron.js";
import { checkSystemReady, verifySignature } from "./middlewares/auth.js";
import { keyRouter } from "./routes/keyRouter.js";
import { initKey } from "./config/appProperties.js";
import { setupSocket } from "./config/socketHandler.js";
import { userRouter } from "./routes/userRouter.js";
import { platformRouter } from "./routes/platformRouter.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: CORS_OPTIONS });

app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: JSON_LIMIT }));

app.use("/v1/key", keyRouter);
app.use(checkSystemReady);
app.use(verifySignature);
app.use("/v1/user", userRouter);
app.use("/v1/platform", platformRouter);

const PORT = ENV.SERVER_PORT || 6677;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

startAllJobs();
initKey();
setupSocket(io);

export { io };
