import { getConfigValue } from "../config/appProperties.js";
import { decryptClientData } from "../encryption/clientEncryption.js";
import { decryptCommonData, decryptCommonField, encryptCommonField } from "../encryption/commonEncryption.js";
import { getUserKey } from "../encryption/userKeyEncryption.js";
import User from "../models/userModel.js";
import {
  makeErrorResponse,
  makeSuccessResponse,
  sendEmail,
} from "../services/apiService.js";
import { getKey, putKey, putPublicKey } from "../services/cacheService.js";
import {
  decryptData,
  encryptRSA,
  extractBase64FromPem,
} from "../services/encryptionService.js";
import {
  generateMd5,
  generateOTP,
  generateRandomString,
  generateRSAKeyPair,
  generateTimestamp,
} from "../services/generateService.js";
import {
  comparePassword,
  createToken,
  encodePassword,
} from "../services/jwtService.js";
import { handleSendMsgLockDevice } from "../services/socketService.js";
import { setup2FA, verify2FA } from "../services/totpService.js";
import { CONFIG_KEY, ENCRYPT_FIELDS } from "../utils/constant.js";
import { Buffer } from "buffer";

const loginUser = async (req, res) => {
  try {
    const { username, password, totp } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.LOGIN_FORM
    );
    if (!username || !password) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const user = decryptCommonData(
      await User.findOne({ username: encryptCommonField(username) }),
      ENCRYPT_FIELDS.USER
    );
    if (
      !user.secret ||
      !user ||
      !(await comparePassword(password, user.password))
    ) {
      return makeErrorResponse({ res, message: "Bad credentials" });
    }
    const verified = await verify2FA(totp, user.secret);
    if (!verified) {
      return makeErrorResponse({ res, message: "Invalid TOTP" });
    }
    const secretKey = generateRandomString(16);
    const sessionId = generateMd5(username + generateTimestamp() + secretKey);
    const accessToken = createToken({
      id: user._id,
      username: user.username,
      secretKey: encryptCommonField(secretKey),
      sessionId,
    });
    handleSendMsgLockDevice(user.username);
    putKey(username, sessionId);
    return makeSuccessResponse({
      res,
      message: "Login success",
      data: { accessToken },
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const verifyCredential = async (req, res) => {
  try {
    const { username, password } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.LOGIN_FORM
    );
    if (!username || !password) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const user = decryptData(
      getConfigValue(CONFIG_KEY.COMMON_KEY),
      await User.findOne({ username: encryptCommonField(username) }),
      ENCRYPT_FIELDS.USER
    );
    if (!user || !(await comparePassword(password, user.password))) {
      return makeErrorResponse({ res, message: "Bad credentials" });
    }
    if (!user.secret) {
      const { qrCodeUrl, secret } = await setup2FA(username);
      await User.updateOne(
        { username },
        { secret: encryptCommonField(secret) }
      );
      return makeSuccessResponse({
        res,
        message: "Setup 2FA success",
        data: { qrCodeUrl },
      });
    }
    return makeSuccessResponse({
      res,
      message: "Verify success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const requestForgotPassword = async (req, res) => {
  try {
    const { email } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.REQUEST_FORGOT_PASSWORD_FORM
    );
    if (!email) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const user = decryptData(
      getConfigValue(CONFIG_KEY.COMMON_KEY),
      await User.findOne({ email: encryptCommonField(email) }),
      ENCRYPT_FIELDS.USER
    );
    if (!user) {
      return makeErrorResponse({ res, message: "Email not found" });
    }
    const otp = generateOTP(6);
    const userId = encryptCommonField(user._id.toString() + ";" + otp);
    await user.updateOne({ code: encryptCommonField(otp) });
    await sendEmail({ email, otp, subject: "RESET PASSWORD" });
    return makeSuccessResponse({
      res,
      data: { userId },
      message: "Request forgot password success, please check your email",
    });
  } catch (error) {
    return makeSuccessResponse({ res, message: error.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { userId, newPassword, otp } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.RESET_PASSWORD_FORM
    );
    if (!userId || !newPassword || !otp) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const extractId = decryptCommonField(userId).split(";")[0];

    const user = decryptCommonData(
      await User.findById(extractId),
      ENCRYPT_FIELDS.USER
    );
    if (!user) {
      return makeErrorResponse({ res, message: "User not found" });
    }
    if (user.code !== otp) {
      return makeErrorResponse({ res, message: "Invalid OTP" });
    }
    user.password = await encodePassword(newPassword);
    user.code = null;
    await user.save();
    return makeSuccessResponse({
      res,
      message: "Reset password success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const requestResetMfa = async (req, res) => {
  try {
    const { email, password } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.REQUEST_MFA_FORM
    );
    if (!email || !password) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const user = decryptData(
      getConfigValue(CONFIG_KEY.COMMON_KEY),
      await User.findOne({ email: encryptCommonField(email) }),
      ENCRYPT_FIELDS.USER
    );
    if (!user) {
      return makeErrorResponse({ res, message: "Email not found" });
    }
    if (!(await comparePassword(password, user.password))) {
      return makeErrorResponse({ res, message: "Invalid password" });
    }
    const otp = generateOTP(6);
    const userId = encryptCommonField(user._id.toString() + "&" + otp);
    await user.updateOne({ otp: encryptCommonField(otp) });
    await sendEmail({ email, otp, subject: "RESET MFA" });
    return makeSuccessResponse({
      res,
      data: { userId },
      message: "Request reset mfa success, please check your email",
    });
  } catch (error) {
    return makeSuccessResponse({ res, message: error.message });
  }
};

const resetUserMfa = async (req, res) => {
  try {
    const { userId, otp } = decryptClientData(
      req.body,
      ENCRYPT_FIELDS.RESET_PASSWORD_FORM
    );
    if (!userId || !otp) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const extractId = decryptCommonField(userId).split("&")[0];

    const user = decryptCommonData(
      await User.findById(extractId),
      ENCRYPT_FIELDS.USER
    );
    if (!user) {
      return makeErrorResponse({ res, message: "User not found" });
    }
    if (user.otp !== otp) {
      return makeErrorResponse({ res, message: "Invalid OTP" });
    }
    user.otp = null;
    await user.save();
    return makeSuccessResponse({
      res,
      message: "Reset mfa success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const getMyKey = async (req, res) => {
  try {
    const { secretKey, username } = req.token;
    const userPublicKey = getKey(username);
    const decryptedKey = decryptCommonField(secretKey);
    return makeSuccessResponse({
      res,
      data: { secretKey: encryptRSA(userPublicKey, decryptedKey) },
      message: "Get my key success",
    });
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

const requestKey = async (req, res) => {
  try {
    const { username } = req.token;
    const { password } = decryptData(
      getUserKey(req.token),
      req.body,
      ENCRYPT_FIELDS.REQUEST_KEY_FORM
    );
    if (!password) {
      return makeErrorResponse({ res, message: "Invalid form" });
    }
    const user = await User.findOne({ username: encryptCommonField(username) });
    if (!user || !(await comparePassword(password, user.password))) {
      return makeErrorResponse({ res, message: "Invalid password" });
    }
    const { publicKey, privateKey } = generateRSAKeyPair();
    putPublicKey(username, extractBase64FromPem(publicKey));
    const fileContent = privateKey;
    const buffer = Buffer.from(fileContent, "utf-8");
    const fileName = `request_key_${generateTimestamp()}.txt`;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    return makeErrorResponse({ res, message: error.message });
  }
};

export {
  loginUser,
  verifyCredential,
  requestForgotPassword,
  resetUserPassword,
  requestResetMfa,
  resetUserMfa,
  getMyKey,
  requestKey,
};
