import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import importQry from "../../constants/query_constants";
import { executeQuery } from "../../config/db";

const insertDataToQueue = async () => {
  return new Promise(async (resolve, reject) => {
    let countQryPrefix = "SELECT COUNT(*) FROM (";
    let countQrySuffix = ") totalCount";
    let priceImportQry =
      countQryPrefix + importQry.PRICE_IMPORT + countQrySuffix;
    let priceRes = await executeQuery(priceImportQry, []);
    let currentCount = priceRes[0]["COUNT(*)"];
    let expectedRecordCount = 1;
    const clRecordLimit = 9999;
    if (currentCount > clRecordLimit) {
      expectedRecordCount = Math.ceil(currentCount / clRecordLimit);
    }
    for (let i = 0; i < expectedRecordCount; i++) {
      let limit = "LIMIT ";
      if (i === 0) {
        limit += `${i}, ${clRecordLimit}`;
      } else {
        if (clRecordLimit * i + clRecordLimit > currentCount) {
          let lastLimit =
            clRecordLimit - (clRecordLimit * i + clRecordLimit - currentCount);
          limit += `${clRecordLimit * i}, ${lastLimit}`;
        } else {
          limit += `${clRecordLimit * i}, ${clRecordLimit}`;
        }
      }
      let insertQry = `INSERT INTO import_queue (import_name, import_params, import_completed)
            VALUES('PRICE_IMPORT','${limit}','N');`;
      let insertRes = await executeQuery(insertQry, []);
      helper.logger(`LAST INSERTED ID ${insertRes.insertId}`, log_color.YELLOW)
      if(i === expectedRecordCount - 1) {
        resolve(true);
      }
    }
  });
};

export default async function handler(req, res) {
  try {
    await insertDataToQueue().then(() => {
      res.json({
        message: "ALL PROCESS HAS BEEN DONE",
        logs: helper.clImportFinalStatus(),
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
