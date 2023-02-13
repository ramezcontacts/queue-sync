import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

const getIsImportedSQLQryForSku = (lastSkuID) => {
  let skuQry = `SELECT * FROM product_import 
  WHERE is_sku_imported = 'N'
        AND sku_code > ${lastSkuID}
        ORDER BY sku_code ASC LIMIT ${process.env.RECORDS_LIMIT}`;
  return skuQry;
};

const retrieveDataFromProductImportTable = (lastSkuID) => {
  return new Promise(async (resolve, reject) => {
    helper.logger(
      `Fetching Query For ${process.env.RECORDS_LIMIT} records...`,
      log_color.YELLOW
    );
    let skuDataQry = getIsImportedSQLQryForSku(lastSkuID);
    let skuDataRes = await executeQuery(skuDataQry, []);
    helper.logger(`${skuDataRes.length} Records fetched.`, log_color.GREEN);
    if (skuDataRes.length > 0) {
      helper.logger(
        `Preparing JSON For ${process.env.RECORDS_LIMIT} records...`,
        log_color.YELLOW
      );
      resolve(skuDataRes);
    } else {
      helper.logger(
        `Query returned ${skuDataRes.length} records. Exiting...`,
        log_color.RED
      );
      process.exit();
    }
  });
};

const dataImportInCL_NOTINUSE = (allSkuData) => {
  return new Promise((resolve, reject) => {
    //   SKU IMPORT
    const skuData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "skus",
          inputs: allSkuData.skuInput,
        },
      },
    };
    const priceData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "prices",
          format: "json",
          parent_resource_id: process.env.CL_PRICE_LIST_ID,
          inputs: allSkuData.priceInput,
        },
      },
    };
    const stockItemsData = {
      data: {
        type: "imports",
        attributes: {
          resource_type: "stock_items",
          format: "json",
          parent_resource_id: process.env.CL_STOCK_LOCATION_ID,
          inputs: allSkuData.stockItemInput,
        },
      },
    };
    //   IMPORTING ALL SKUs
    const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
    helper.logger(
      `Importing ${allSkuData.skuInput.length} SKUs...`,
      log_color.YELLOW
    );
    fetch(skuAPIUrl, {
      body: JSON.stringify(skuData),
      method: "POST",
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          helper.logger(data.errors[0].detail, log_color.RED);
          res
            .status(parseInt(data.errors[0].status))
            .json({ error: data.errors[0].detail });
          process.exit();
        }
        helper.logger(
          `${allSkuData.skuInput.length} SKUs has been imported.`,
          log_color.GREEN
        );
        helper.printImportStatus(data.data, "SKUs");
        //   IMPORTING ALL Prices
        const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
        helper.logger(
          `Importing Prices for ${allSkuData.priceInput.length} SKUs...`,
          log_color.YELLOW
        );
        fetch(skuAPIUrl, {
          body: JSON.stringify(priceData),
          method: "POST",
          headers: helper.clAuthHeader(),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.errors) {
              helper.logger(data.errors[0].detail, log_color.RED);
              res
                .status(parseInt(data.errors[0].status))
                .json({ error: data.errors[0].detail });
              process.exit();
            }
            helper.logger(
              `${allSkuData.priceInput.length} Prices has been imported.`,
              log_color.GREEN
            );
            helper.printImportStatus(data.data, "Prices");
            //   IMPORTING ALL Stock Items
            const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
            helper.logger(
              `Importing Stock Items for ${allSkuData.priceInput.length} SKUs...`,
              log_color.YELLOW
            );
            fetch(skuAPIUrl, {
              body: JSON.stringify(stockItemsData),
              method: "POST",
              headers: helper.clAuthHeader(),
            })
              .then((response) => response.json())
              .then((data) => {
                if (data.errors) {
                  helper.logger(data.errors[0].detail, log_color.RED);
                  res
                    .status(parseInt(data.errors[0].status))
                    .json({ error: data.errors[0].detail });
                  process.exit();
                }
                helper.logger(
                  `${allSkuData.stockItemInput.length} Stock Items has been imported.`,
                  log_color.GREEN
                );
                helper.printImportStatus(data.data, "Stock Items");
                resolve(true);
              })
              .catch((err) => console.error(err));
          })
          .catch((err) => console.error(err));
      })
      .catch((err) => console.error(err));
  });
};
const checkImportStatus = () => {
  return new Promise(async (resolve, reject) => {
    let importCheckUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports?filter[q][status_eq]=in_progress`;
    await fetch(importCheckUrl, {
      headers: helper.clAuthHeader(),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.errors) {
          helper.logger(data.errors[0].detail, log_color.RED);
          res
            .status(parseInt(data.errors[0].status))
            .json({ error: data.errors[0].detail });
          process.exit();
        }
        resolve(data.meta.record_count);
      });
  });
};

const getCountOfSkusToImport = () => {
  return new Promise(async (resolve, reject) => {
    let skuImportQry = `SELECT COUNT(id) as skuCount FROM product_import WHERE is_sku_imported = 'N'`;
    let skuImportCount = await executeQuery(skuImportQry, []);
    let currSkuCount = skuImportCount[0].skuCount;
    if (currSkuCount > 0) {
      resolve(skuImportCount);
    } else {
      helper.logger(`${currSkuCount} sku for import---EXITING`, log_color.RED);
      process.exit();
    }
  });
};

const updateProductImportTable = (allSkuData) => {
    return new Promise(async (resolve, reject) => {
        let importedSkuId = []
        for(let sku of allSkuData) {
            importedSkuId.push(sku.id);
        }
        let updateQry = `UPDATE product_import SET is_sku_imported = 'Y' WHERE id IN (${importedSkuId.join(",")})`;
        let updateRes = await executeQuery(updateQry, []);
        resolve(updateRes.affectedRows)
    })
}

const importProcess = async () => {
  var dateString = new Date().toLocaleString()
  helper.logger("Started importProcess function at : " + dateString, log_color.GREEN);
  await helper.getCommerceLayerAccessToken().then(async () => {
    helper.logger("Access Token fetched...", log_color.GREEN);
    helper.logger("Checking currently running imports status in CL", log_color.YELLOW);
    await checkImportStatus().then(async (busySlots) => {
      helper.logger(`Currently busy slots : ${busySlots}`, log_color.YELLOW);
      let importHitAvl = helper.getImportHitAvail(busySlots);
      helper.logger(`Max SKU Import(conbination) calls available : ${importHitAvl}`, log_color.YELLOW);
      if (importHitAvl > 0) {
        await getCountOfSkusToImport().then(async (countOfSkus) => {
          helper.logger(
            `SKUs count for importing : ${parseInt(countOfSkus[0].skuCount)}`,
            log_color.YELLOW
          );
          let requiredImportHit = Math.ceil(
            parseInt(countOfSkus[0].skuCount) /
              parseInt(process.env.RECORDS_LIMIT)
          );
          helper.logger(
            `Required imports calls : ${requiredImportHit}`,
            log_color.YELLOW
          );
          if (requiredImportHit < importHitAvl) {
            importHitAvl = requiredImportHit;
          }
          helper.logger(
            `Overrided SKU Import(conbination) calls : ${importHitAvl}`,
            log_color.YELLOW
          );
          let lastSkuID = 0;
          for (let i = 1; i <= importHitAvl; i++) {
            await retrieveDataFromProductImportTable(lastSkuID).then(async (allSkuData) => {
              await helper.prepareJsonObjForImport(allSkuData).then(
                async (allSkuObj) => {
                  helper.logger(`JSON created for Import`, log_color.GREEN);
                  helper.logger(`Import loop running count : ${i}`, log_color.YELLOW);
                  await helper.dataImportInCL(allSkuObj).then(async () => {
                    const lastImportedSKUId =
                    allSkuObj.skuInput[allSkuObj.skuInput.length - 1].code;
                    helper.logger(
                      `LAST IMPORTED SKU ID: ${lastImportedSKUId}`,
                      log_color.YELLOW
                    );
                    lastSkuID = lastImportedSKUId;
                    await updateProductImportTable(allSkuData).then((affectedRows) => {
                        helper.logger(`${affectedRows} rows affected in product_import table for is_sku_imported field.`, log_color.YELLOW)
                    })
                  });
                }
              );
            });
            if(i == importHitAvl) {
                helper.logger("ALL PROCESS HAS BEEN DONE", log_color.GREEN)
            }
          }
        });
      } else {
        helper.logger(
          `${importHitAvl} importHit is available---EXITING`,
          log_color.RED
        );
        process.exit();
      }
    });
  });
};


export default async function handler(req, res) {
  try {
    // setInterval(importProcess, 5000);
    await importProcess().then(() => {
        res.json({message: "ALL PROCESS HAS BEEN DONE", logs: helper.clImportFinalStatus()})
    })
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
