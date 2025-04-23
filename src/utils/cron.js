/* eslint-disable no-unused-vars */
import cron from "cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import https from "https";
import { CONFIG_KEY, ENV } from "./constant.js";
import { getConfigValue } from "../config/appProperties.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const jobs = {
  activeService: new cron.CronJob("*/10 * * * *", async function () {
    const url = getConfigValue(CONFIG_KEY.API_URL);
    if (!url) {
      console.log("[WARN] No app url found");
      return;
    }
    https
      .get(ENV.APP_URL, (res) => {
        if (res.statusCode == 200) {
          console.log(`[WARN] GET request sent successfully to ${url}`);
        } else {
          console.log("[WARN] GET request failed", res.statusCode);
        }
      })
      .on("error", (e) => {
        console.error("[ERROR] Error while sending request");
      });
  }),
};

const startAllJobs = () => {
  Object.values(jobs).forEach((job) => job.start());
  console.log("All cron jobs have been started");
};

export { jobs, startAllJobs };
