import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";

const deleteImportById = (importId) => {
  return new Promise(async (resolve, reject) => {
    let importCheckUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports/${importId}`;
    console.log(importCheckUrl);
    await fetch(importCheckUrl, {
        method: "DELETE",
      headers: helper.clAuthHeader()
      
    })
      .then((response) => response.text())
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
    let importId = "mMPEIpeQOP";
    await deleteImportById(importId).then(async (deleteImportStatus) => {
      helper.logger(`ImportId ${importId} has been deleted`, log_color.YELLOW);
      res.status(200).json({
        message: `ImportId ${importId} has been deleted`,
        importStatusDetails: deleteImportStatus,
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
