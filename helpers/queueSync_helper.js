import log_color from "../constants/log_constants";
import importQry from "../constants/queueQuery_constants";
import { executeQuery } from "../config/db";
import Helper from "./helper";
class QueueSync extends Helper{
    //--------------------COMMON FUNCTIONS------------------------
    insertDataToImportQueueTable = async (importType,priority) => {
        return new Promise(async (resolve, reject) => {
            this.logger(`Preparing Count Query for ${importType} ... `, log_color.YELLOW)
            let countQryPrefix = "SELECT COUNT(*) FROM (";
            let countQrySuffix = ") totalCount";
            let importTypeQry =
                countQryPrefix + importQry[importType] + countQrySuffix;
            this.logger(`${importTypeQry}`, log_color.GREEN); //process.exit();
            let importTypeRes = await executeQuery(importTypeQry, []);
            let currentCount = importTypeRes[0]["COUNT(*)"];
            this.logger(`Count Query Executed.. Records Count is : ${currentCount}`, log_color.YELLOW)
            if (currentCount > 0) {
                let expectedRecordCount = 1;
                let clRecordLimit = 9999;
                if (currentCount > clRecordLimit) {
                    expectedRecordCount = Math.ceil(currentCount / clRecordLimit);
                } else {
                    // Adding LIMIT for only available records
                    clRecordLimit = currentCount;
                }
                this.logger(`Number of Records would be inserted : ${expectedRecordCount}`, log_color.YELLOW)
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
                    this.logger(`Inserting Record as : ${importType}, ${limit}`, log_color.BLUE)
                    let insertQry = `INSERT INTO import_queue (import_name, import_params, import_time, import_priority, import_completed)
                VALUES('${importType}','${limit}','${this.convertJSDatetimeToMYSQLDatetime(new Date())}','${priority}', 'N');`;
                    let insertRes = await executeQuery(insertQry, []);
                    this.logger(`LAST INSERTED ID:  ${insertRes.insertId}`, log_color.YELLOW)
                    if (i === expectedRecordCount - 1) {
                        resolve(true);
                    }
                }
            } else {
                this.logger(`Nothing to do as ${currentCount} record fetched. EXITTING...`, log_color.YELLOW)
                resolve(true);
            }
        });
    }
}
export default QueueSync;
