import QueueSync from "../../helpers/queueSync_helper";
import log_color from "../../constants/log_constants";
const queueHelper = new QueueSync();
import importQry from "../../constants/queueQuery_constants";
import { executeQuery } from "../../config/db";

const retrieveDataFromImportQueueTable = (freeSlots) => {
  return new Promise(async (resolve, reject) => {
    queueHelper.logger(`Fetching import_queue table records...`, log_color.YELLOW);
    let queueDataQry = `SELECT id,import_name,import_params, import_time,import_priority  
      FROM import_queue 
      WHERE import_completed = 'N' 
      ORDER BY import_priority ASC LIMIT ${freeSlots}
      `;
    let queueDataRes = await executeQuery(queueDataQry, []);
    queueHelper.logger(`${queueDataRes.length} Records fetched from import_queue table.`, log_color.GREEN);
    resolve(queueDataRes);
  });
};
const prepareJsonObjForImportType = (dbData, importType, attribute_types) => {
  return new Promise(async (resolve, reject) => {
    if (dbData.length > 0) {
      switch (importType) {
        case "SKU_IMPORT":
          let skuInput = [];
          for (let sku of dbData) {
            let info = await queueHelper.createMetaDataForSku(attribute_types, sku);
            skuInput.push({
              code: sku.sku_code,
              name: sku.sku_code,
              image_url: `https://do6sydhp1s299.cloudfront.net/${process.env.CLOUDFRONT_ENV}/${sku.sku_image}`,
              description: sku.sku_desc,
              reference: sku.parent_id,
              shipping_category_id: process.env.CL_SHIPPING_CATEGORY_ID,
              do_not_track: true,
              metadata: info.metadata,
            });
          }
          //   SKU IMPORT
          const skuData = {
            data: {
              type: "imports",
              attributes: {
                resource_type: "skus",
                inputs: skuInput,
              },
            },
          };
          resolve(skuData);
          break;
        case "PRICE_IMPORT":
          let priceInput = [];
          for (let price of dbData) {
            priceInput.push({
              currency_code: process.env.CL_CURRENCY_CODE,
              sku_code: price.sku_code,
              amount_cents: queueHelper.toCents(price.sku_sell_price),
              compare_at_amount_cents: queueHelper.toCents(price.sku_list_price),
            });
          }

          const priceData = {
            data: {
              type: "imports",
              attributes: {
                resource_type: "prices",
                format: "json",
                parent_resource_id: process.env.CL_PRICE_LIST_ID,
                inputs: priceInput,
              },
            },
          };
          resolve(priceData);
          break;
        case "STOCK_IMPORT":
          let stockInput = [];
          for (let stock of dbData) {
            stockInput.push({
              stock_location_id: stock.cl_stock_location_id,
              sku_code: stock.sku_code,
              quantity: queueHelper.makeValidStock(stock.sku_stock),
            });
          }
          const stockData = {
            data: {
              type: "imports",
              attributes: {
                resource_type: "stock_items",
                format: "json",
                inputs: stockInput,
              },
            },
          };
          resolve(stockData);
          break;
        default:
          break;
      }
    }
  });
};
const productTypeImportInCL = (importObj, productType) => {
  return new Promise((resolve, reject) => {
    const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
    queueHelper.logger(`Importing Product Type (${productType}) in CL...`, log_color.YELLOW);
    fetch(skuAPIUrl, {
      body: JSON.stringify(importObj),
      method: "POST",
      headers: queueHelper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          queueHelper.logger(data.errors[0].detail, log_color.RED);
          res
            .status(parseInt(data.errors[0].status))
            .json({ error: data.errors[0].detail });
          process.exit();
        }
        queueHelper.printImportStatus(data.data, productType);
        resolve(true);
      })
      .catch((err) => console.error(err));
  });
};
const checkImportStatus = () => {
  return new Promise(async (resolve, reject) => {
    let importCheckUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports?filter[q][status_eq]=in_progress`;
    await fetch(importCheckUrl, {
      headers: queueHelper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          queueHelper.logger(data.errors[0].detail, log_color.RED);
          res
            .status(parseInt(data.errors[0].status))
            .json({ error: data.errors[0].detail });
          process.exit();
        }
        resolve(data.meta.record_count);
      });
  });
};

const updateImportQueueTable = (id) => {
  return new Promise(async (resolve, reject) => {
    let updateQry = `UPDATE import_queue SET import_completed = 'Y' WHERE id = ${id}`;
    let updateRes = await executeQuery(updateQry, []);
    resolve(updateRes.affectedRows);
  });
};
const importProcess = async () => {
  await queueHelper.getCommerceLayerAccessToken().then(async () => {
    queueHelper.logger("Access Token fetched...", log_color.GREEN);
    queueHelper.logger(
      "Checking currently running imports status in CL",
      log_color.YELLOW
    );
    await checkImportStatus().then(async (busySlots) => {
      queueHelper.logger(`Currently busy slots : ${busySlots}`, log_color.YELLOW);
      let freeSlots = parseInt(10 - busySlots);
      queueHelper.logger(`Free Slots available : ${freeSlots}`, log_color.YELLOW);
      if (freeSlots > 0) {
        await retrieveDataFromImportQueueTable(freeSlots).then(
          async (queueDataRes) => {
            if (queueDataRes.length > 0) {
              queueHelper.logger(`Fetching attribute_types from product_shippable_setup_attribute_types table.`, log_color.GREEN);
              let attrQry = `SELECT id,name FROM product_shippable_setup_attribute_types`;
              let attribute_types = await executeQuery(attrQry, []);
              for (let queRec of queueDataRes) {
                //Replacing NOW() with the timstamp stored in import_queue table
                let importSql =
                  importQry[queRec.import_name].replace("NOW()", "'" + queueHelper.convertJSDatetimeToMYSQLDatetime(queRec.import_time) + "'") + " " + queRec.import_params;
                let allImportData = await executeQuery(importSql, []);

                await prepareJsonObjForImportType(
                  allImportData,
                  queRec.import_name, attribute_types
                ).then(async (importObj) => {
                  queueHelper.logger(`JSON created for Import. Object Count is : ${allImportData.length}`, log_color.GREEN);
                  //console.log(importObj.data.attributes.inputs);process.exit();
                  await productTypeImportInCL(importObj, queRec.import_name).then(
                    async () => {
                      await updateImportQueueTable(queRec.id).then(
                        (affectedRows) => {
                          queueHelper.logger(
                            `${affectedRows} rows affected in import_queue table for import_completed field.`,
                            log_color.YELLOW
                          );
                        }
                      );
                    }
                  );
                });

              }
            }
          }
        );
      } else {
        queueHelper.logger(
          `${freeSlots} importHit is available---EXITING`,
          log_color.RED
        );
        process.exit();
      }
    });
  });
};

export default async function handler(req, res) {
  try {
    var dateString = new Date().toLocaleString();
    queueHelper.logger(
      "Started importProcess function at : " + dateString,
      log_color.GREEN
    );
    await importProcess().then(() => {
      var dateString = new Date().toLocaleString();
      queueHelper.logger(
        "Completed importProcess function at : " + dateString,
        log_color.GREEN
      );
      res.json({
        message: "ALL PROCESS HAS BEEN DONE",
        logs: queueHelper.clImportFinalStatus(),
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}