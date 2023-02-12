import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";

const checkImportStatus = (importId) => {
  return new Promise(async (resolve, reject) => {
    let importCheckUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports/${importId}`;
    console.log(importCheckUrl);
    await fetch(importCheckUrl, {
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        if (data.errors) {
          helper.logger(data.errors[0].detail, log_color.RED);
          res
            .status(parseInt(data.errors[0].status))
            .json({ error: data.errors[0].detail });
          process.exit();
        }
        resolve(data);
      });
  });
};

export default async function handler(req, res) {
  try {
    helper.logger("Fetching Access Token...", log_color.YELLOW);
    await helper.getCommerceLayerAccessToken();
    helper.logger("Access Token fetched...", log_color.GREEN);
    let importId = "qKnWIvDnlV";
    await checkImportStatus(importId).then(async (importStatus) => {
      helper.logger(`Import Status: Checked`, log_color.YELLOW);
      res.status(200).json({
        message: "Import Check Done...",
        importStatusDetails: importStatus,
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
