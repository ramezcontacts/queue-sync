import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

const retrieveDataFromDBForManualImport = () => {
  return new Promise(async (resolve, reject) => {
    helper.logger(
      `Fetching Query For ${process.env.RECORDS_LIMIT} records...`,
      log_color.YELLOW
    );
    let skuDataQry = helper.getSQLQryForManualImport();
    let skuDataRes = await executeQuery(skuDataQry, []);
    helper.logger(`${skuDataRes.length} Records fetched.`, log_color.GREEN);
    if (skuDataRes.length > 0) {
      helper.logger(`Fetching attribute_types from product_shippable_setup_attribute_types table.`, log_color.GREEN);
      let attrQry = `SELECT id,name FROM product_shippable_setup_attribute_types`;
      let attribute_types = await executeQuery(attrQry, []);     
      helper.logger(
        `Preparing JSON For ${process.env.RECORDS_LIMIT} records...`,
        log_color.YELLOW
      );
      await helper.prepareJsonObjForManualImport(skuDataRes,attribute_types).then((allSkuObj) => {
        helper.logger(`JSON Created For Import`, log_color.GREEN);
        resolve(allSkuObj);
      })

    } else {
      helper.logger(
        `Query returned ${skuDataRes.length} records. Exiting...`,
        log_color.RED
      );
      process.exit();
    }
  });
};
const checkImportStatus = () => {
  return new Promise(async (resolve, reject) => {
    helper.logger("Checking for busy slots in CL...", log_color.YELLOW);
    let importCheckUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports?filter[q][status_eq]=in_progress`;
    await fetch(importCheckUrl, {
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          helper.logger(data.errors[0].detail, log_color.RED);
          process.exit();
        }
        resolve(data.meta.record_count);
      });
  });
};
export default async function handler(req, res) {
  try {
    await helper.getCommerceLayerAccessToken();
    helper.logger("Access Token fetched...", log_color.GREEN);
    await checkImportStatus().then(async (busySlots) => {
      helper.logger(`Currently busy slots : ${busySlots}`, log_color.YELLOW);
      let freeSlots = parseInt(10 - busySlots);
      helper.logger(`Free Slots available : ${freeSlots}`, log_color.YELLOW);
      if (freeSlots >= 4) {
        await retrieveDataFromDBForManualImport().then(async (allSkuData) => {
          await helper.dataImportInCLForManualImport(allSkuData).then(() => {
            const lastImportedSKUId =
              allSkuData.skuInput[allSkuData.skuInput.length - 1].code;
            helper.logger(
              `LAST IMPORTED SKU ID: ${lastImportedSKUId}`,
              log_color.YELLOW
            );
            res.status(200).json({
              message: "Product Sync Done Successfully...",
              sku_length: allSkuData.skuInput.length,
              lastSKUId: lastImportedSKUId,
              logs: helper.skuImportFinalStatus()
            });
          });
        });
      } else {
        helper.logger(
          `${freeSlots} importHit is available---EXITING`,
          log_color.RED
        );
        process.exit();
      }
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
