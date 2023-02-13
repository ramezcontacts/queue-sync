import QueueSync from "../../helpers/queueSync_helper";
import log_color from "../../constants/log_constants";
const queueHelper = new QueueSync();
export default async function handler(req, res) {
  try {
    const importType = 'REGULAR_PRICE_IMPORT';
    const priority = 2;
    queueHelper.logger(`Process Started for ${importType}`, log_color.YELLOW);
    await queueHelper.insertDataToImportQueueTable(importType,priority).then(() => {
        queueHelper.logger(`ALL PROCESS HAS BEEN DONE !!`, log_color.GREEN);
      res.json({
        logs: queueHelper.clImportFinalStatus(),
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
