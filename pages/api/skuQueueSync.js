import QueueSync from "../../helpers/queueSync_helper";
import log_color from "../../constants/log_constants";
const queueHelper = new QueueSync();
export default async function handler(req, res) {
  try {
    const importType = 'SKU_IMPORT';
    queueHelper.logger(`Process Started for ${importType}`, log_color.YELLOW);
    await queueHelper.insertDataToImportQueueTable('SKU_IMPORT').then(() => {
        queueHelper.logger(`ALL PROCESS HAS BEEN DONE !!`, log_color.GREEN);
      res.json({
        logs: queueHelper.queueImportFinalStatus(),
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
