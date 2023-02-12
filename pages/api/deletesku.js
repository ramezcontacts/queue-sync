import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";

export default async function handler(req, res) {
  try {
    helper.logger("Fetching Access Token...", log_color.YELLOW);
    await helper.getCommerceLayerAccessToken();
    helper.logger("Access Token fetched...", log_color.GREEN);
    const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/cleanups`;
    helper.logger("Deleting all SKUs...", log_color.YELLOW);
    const cleanUpData = {
      data: {
        type: "cleanups",
        attributes: {
          resource_type: "skus",
          filters: {
            code_start: "Product",
          },
        },
      },
    };
    fetch(skuAPIUrl, {
      body: JSON.stringify(cleanUpData),
      method: "POST",
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        helper.logger("All Skus has been deleted", log_color.GREEN);
        res.status(200).json({ message: "All Skus has been deleted" });
      })
      .catch((err) => console.error(err));
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
