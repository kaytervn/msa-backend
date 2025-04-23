import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { DATE_FORMAT } from "./constant.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const formatDateUTC = () => dayjs().utc().format(DATE_FORMAT);

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const extractAppNameFromMongoUri = (uri) => {
  try {
    const url = new URL(uri);
    const appName = url.searchParams.get("appName");
    return appName || null;
  } catch (err) {
    console.error("Invalid URI:", err.message);
    return null;
  }
};

const getNestedValue = (obj, path, defaultValue = null) => {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? defaultValue;
};

export {
  formatDateUTC,
  isValidUrl,
  extractAppNameFromMongoUri,
  getNestedValue,
};
