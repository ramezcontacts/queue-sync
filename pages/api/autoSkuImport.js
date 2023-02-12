import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

const getSQLQryForSku = (lastSkuID) => {
  let skuQry = "";
  switch (process.env.PRODUCT_CLASSIFICATION_ID) {
    case "1" || "3":
      skuQry = `SELECT
        AppProduct.id as parent_id,
        AppProduct.product_name,
        ChildProduct.id,
        AppProduct.has_valid_main_image_url,
        AppProduct.short_desc, ListPrice.price AS list_price, SellPrice.price AS sell_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS total_inventory, ProductDataFrame.frame_color_desc, CONCAT(ProductDataFrame.eye_lens_width, '-', ProductDataFrame.bridge_width, '-', ProductDataFrame.temple_arm_length) AS frame_size
        FROM products AppProduct
    LEFT JOIN products ChildProduct
        ON (ChildProduct.grouping_product_id = AppProduct.id
        AND ChildProduct.is_enabled = '1'
        AND ChildProduct.is_deleted = '0'
        AND ChildProduct.is_manual_sold_out = '0'
        AND ChildProduct.is_manual_unavailable = '0'
        AND ChildProduct.is_approved = '1')
    INNER JOIN product_prices AS ListPrice
        ON (ListPrice.product_id = ChildProduct.id
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0)
    INNER JOIN product_prices AS SellPrice
        ON (SellPrice.product_id = ChildProduct.id
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0)
    LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL)
    LEFT JOIN product_data_frames AS ProductDataFrame
        ON (ProductDataFrame.id = ChildProduct.id
        AND ProductDataFrame.frame_color_desc IS NOT NULL
        )
    WHERE
        AppProduct.grouping_product_id IS NULL
        AND AppProduct.is_deleted = '0'
        AND AppProduct.seller_account_id IS NULL
        AND AppProduct.is_demo = '0'
        AND AppProduct.is_enabled = '1'
        AND AppProduct.is_approved = '1'
        AND AppProduct.product_type_id = 2
        AND AppProduct.has_valid_price_currency_id_1 = '1'
        AND AppProduct.has_valid_image = '1'
        AND AppProduct.product_name IS NOT NULL
        AND AppProduct.product_name != ''
        AND AppProduct.cached_is_site_ezcontacts = '1'
        AND AppProduct.cached_has_valid_manufacturer = '1'
        AND AppProduct.is_show_browse = '1'
        AND AppProduct.is_hidden_visibility = '0'
        AND CONCAT(ProductDataFrame.eye_lens_width, '-', ProductDataFrame.bridge_width, '-', ProductDataFrame.temple_arm_length) IS NOT NULL    
        AND AppProduct.product_classification_id = ${process.env.PRODUCT_CLASSIFICATION_ID}
        AND ChildProduct.id > ${lastSkuID}
        GROUP BY ChildProduct.id
        ORDER BY ChildProduct.id ASC LIMIT ${process.env.RECORDS_LIMIT}`;
      break;
    case "2":
      skuQry = `SELECT AppProduct.id as parent_id,
        AppProduct.product_name,
        ChildProduct.id,
        AppProduct.has_valid_main_image_url,
        AppProduct.short_desc, ListPrice.price AS list_price, SellPrice.price AS sell_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS total_inventory
    FROM products ChildProduct
    INNER JOIN products AppProduct
        ON (ChildProduct.grouping_product_id = AppProduct.id)
    INNER JOIN product_prices AS ListPrice
        ON (ListPrice.product_id = AppProduct.id
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0)
    INNER JOIN product_prices AS SellPrice
        ON (SellPrice.product_id = AppProduct.id
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0)
    LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL) 
    WHERE
        AppProduct.grouping_product_id IS NULL
        AND AppProduct.is_deleted = '0'
        AND AppProduct.seller_account_id IS NULL
        AND AppProduct.is_demo = '0'
        AND AppProduct.is_enabled = '1'
        AND AppProduct.is_approved = '1'
        AND AppProduct.product_type_id = 2
        AND AppProduct.has_valid_price_currency_id_1 = '1'
        AND AppProduct.has_valid_image = '1'
        AND AppProduct.product_name IS NOT NULL
        AND AppProduct.product_name != ''
        AND AppProduct.cached_is_site_ezcontacts = '1'
        AND AppProduct.cached_has_valid_manufacturer = '1'
        AND AppProduct.is_show_browse = '1'
        AND AppProduct.is_hidden_visibility = '0'
        AND ChildProduct.is_enabled = '1'
        AND ChildProduct.is_deleted = '0'
        AND ChildProduct.is_manual_sold_out = '0'
        AND ChildProduct.is_manual_unavailable = '0'
        AND ChildProduct.is_approved = '1'
        AND AppProduct.product_classification_id = ${process.env.PRODUCT_CLASSIFICATION_ID}
        AND ChildProduct.id > ${lastSkuID}
        GROUP BY ChildProduct.id
        ORDER BY ChildProduct.id ASC LIMIT ${process.env.RECORDS_LIMIT}`;
      break;
    default:
      break;
  }
  return skuQry;
};
const getSkuNameSuffix = (childProduct) => {
  let skuSuffix = "";
  switch (process.env.PRODUCT_CLASSIFICATION_ID) {
    case "1" || "3":
      skuSuffix =
        " " + childProduct.frame_color_desc + " " + childProduct.frame_size;
      break;
    case "2":
      skuSuffix = " " + childProduct.id;
      break;
    default:
      break;
  }
  return skuSuffix;
};
const retrieveDataFromDB = (lastSkuID) => {
  return new Promise(async (resolve, reject) => {
    helper.logger(
      `Fetching Query For ${process.env.RECORDS_LIMIT} records...`,
      log_color.YELLOW
    );
    let skuDataQry = getSQLQryForSku(lastSkuID);

    let skuDataRes = await executeQuery(skuDataQry, []);
    helper.logger(`${skuDataRes.length} Records fetched.`, log_color.GREEN);
    if (skuDataRes.length > 0) {
      helper.logger(
        `Preparing JSON For ${process.env.RECORDS_LIMIT} records...`,
        log_color.YELLOW
      );
      await prepareJsonObjForImport(skuDataRes).then((allSkuObj) => {
        helper.logger(`JSON Created For Import`, log_color.GREEN);
        resolve(allSkuObj);
      });
    } else {
      helper.logger(
        `Query returned ${skuDataRes.length} records. Exiting...`,
        log_color.RED
      );
      process.exit();
    }
  });
};

const prepareJsonObjForImport = async (dbData) => {
  return new Promise((resolve, reject) => {
    let allSkuObj = {
      skuInput: [],
      priceInput: [],
      stockItemInput: [],
    };

    if (dbData.length > 0) {
      //JSON PREPARATION START
      for (let childProduct of dbData) {
        let skuNameSuffix = getSkuNameSuffix(childProduct);
        const skuCODE = childProduct.id;
        allSkuObj.skuInput.push({
          code: skuCODE,
          name: `${childProduct.product_name}${skuNameSuffix}`,
          image_url: `https://do6sydhp1s299.cloudfront.net/${process.env.CLOUDFRONT_ENV}/${childProduct.has_valid_main_image_url}`,
          description:
            (childProduct.short_desc === null
              ? ""
              : childProduct.short_desc + " ") + skuNameSuffix,
          reference: childProduct.parent_id,
          shipping_category_id: process.env.CL_SHIPPING_CATEGORY_ID,
          metadata: {
            color: childProduct.frame_color_desc,
            frame_size: childProduct.frame_size,
          },
        });
        allSkuObj.priceInput.push({
          currency_code: "USD",
          sku_code: skuCODE,
          amount_cents: helper.toCents(childProduct.sell_price),
          compare_at_amount_cents: helper.toCents(childProduct.list_price),
        });
        allSkuObj.stockItemInput.push({
          sku_code: skuCODE,
          quantity: helper.makeValidStock(childProduct.total_inventory),
        });
      }
      
      //JSON PREPARATION END
    }
    resolve(allSkuObj)
  });
};

const dataImportInCL = (allSkuData) => {
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
    console.log(importCheckUrl);
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
const importProcess = async () => {
  var m = new Date();
  var dateString =
    m.getUTCFullYear() +
    "/" +
    ("0" + (m.getUTCMonth() + 1)).slice(-2) +
    "/" +
    ("0" + m.getUTCDate()).slice(-2) +
    " " +
    ("0" + m.getUTCHours()).slice(-2) +
    ":" +
    ("0" + m.getUTCMinutes()).slice(-2) +
    ":" +
    ("0" + m.getUTCSeconds()).slice(-2);

  console.log("CALLING importProcess func at : " + dateString);
  await helper.getCommerceLayerAccessToken().then(async () => {
    helper.logger("Access Token fetched...", log_color.GREEN);
    await checkImportStatus().then(async (busySlots) => {
      helper.logger(`Currently Busy Slots is : ${busySlots}`, log_color.YELLOW);
      let importHitAvl = helper.getImportHitAvail(busySlots);
      helper.logger(`importHitAvl is : ${importHitAvl}`, log_color.YELLOW);
      if (importHitAvl > 0) {
        let lastSkuID = 0;
        for (let i = 1; i <= importHitAvl; i++) {
          await retrieveDataFromDB(lastSkuID).then(async (allSkuData) => {
            helper.logger(`importHit Running : ${i}`, log_color.YELLOW);
            await dataImportInCL(allSkuData).then(() => {
              const lastImportedSKUId =
                allSkuData.skuInput[allSkuData.skuInput.length - 1].code;
              helper.logger(
                `LAST IMPORTED SKU ID: ${lastImportedSKUId}`,
                log_color.YELLOW
              );
              lastSkuID = lastImportedSKUId;
            });
          });
        }
      } else {
        console.log("SCRIPT END");
        //process.exit();
      }
    });
  });
};
export default async function handler(req, res) {
  try {
    setInterval(importProcess, 60000);
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
