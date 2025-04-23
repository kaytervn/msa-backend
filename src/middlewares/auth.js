import { getAppProperties, getConfigValue } from "../config/appProperties.js";
import { makeUnauthorizedExecption } from "../services/apiService.js";
import { isValidSession } from "../services/cacheService.js";
import { generateMd5 } from "../services/generateService.js";
import { verifyToken } from "../services/jwtService.js";
import { API_HEADER, CONFIG_KEY, ERROR_CODE } from "../utils/constant.js";
import { Buffer } from "buffer";

const basicAuth = (req, res, next) => {
  const err = makeUnauthorizedExecption({
    res,
    code: ERROR_CODE.UNAUTHORIZED,
    message: "Full authentication is required to access this resource",
  });

  const authHeader = req.headers[API_HEADER.AUTHHORIZATION];

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return err;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString(
    "ascii"
  );
  const [username, password] = credentials.split(":");
  if (
    username === getConfigValue(CONFIG_KEY.CLIENT_ID) &&
    password === getConfigValue(CONFIG_KEY.CLIENT_SECRET)
  ) {
    return next();
  }

  return err;
};

const bearerAuth = async (req, res, next) => {
  const err = makeUnauthorizedExecption({
    res,
    code: ERROR_CODE.UNAUTHORIZED,
    message: "Full authentication is required to access this resource",
  });

  const authHeader = req.headers[API_HEADER.AUTHHORIZATION];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return err;
  }

  const accessToken = authHeader.split(" ")[1];
  try {
    const token = verifyToken(accessToken);
    const { username, sessionId } = token;
    if (isValidSession(username, sessionId)) {
      req.token = token;
      return next();
    }
    return makeUnauthorizedExecption({
      res,
      code: ERROR_CODE.INVALID_SESSION,
      message: "Invalid session",
    });
  } catch (error) {
    return makeUnauthorizedExecption({ res, message: error.message });
  }
};

const socketAuth = (socket, next) => {
  const { token } = socket.handshake.auth;
  try {
    const { username, sessionId } = verifyToken(token);
    if (isValidSession(username, sessionId)) {
      return next();
    }
    return next(new Error("Unauthorized"));
  } catch (error) {
    return next(new Error(error.message));
  }
};

const checkSystemReady = (req, res, next) => {
  const err = makeUnauthorizedExecption({
    res,
    code: ERROR_CODE.SYSTEM_NOT_READY,
    message: "System not ready",
  });
  try {
    const props = getAppProperties();
    if (!props[CONFIG_KEY.MONGODB_URI]) {
      return err;
    }
    next();
  } catch {
    return err;
  }
};

const verifySignature = async (req, res, next) => {
  const err = makeUnauthorizedExecption({
    res,
    code: ERROR_CODE.INVALID_SIGNATURE,
    message: "Invalid message signature",
  });

  const messageSignature = req.headers[API_HEADER.MESSAGE_SIGNATURE];
  const timestamp = req.headers[API_HEADER.TIMESTAMP];

  if (!messageSignature || !timestamp) {
    return err;
  }

  try {
    const clientId = getConfigValue(CONFIG_KEY.CLIENT_ID);
    const clientSecret = getConfigValue(CONFIG_KEY.CLIENT_SECRET);
    const systemSignature = generateMd5(clientId + clientSecret + timestamp);
    if (messageSignature !== systemSignature) {
      return err;
    }
    return next();
  } catch (error) {
    return makeUnauthorizedExecption({ res, message: error.message });
  }
};

export { socketAuth, checkSystemReady, verifySignature, basicAuth, bearerAuth };
