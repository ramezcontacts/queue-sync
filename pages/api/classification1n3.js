import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

let allSkuObj = {
  skuInput: [],
  priceInput: [],
  stockItemInput: [],
};

const retrieveDataFromDB = () => {
  return new Promise(async (resolve, reject) => {
    helper.logger(
      `Fetching Query For ${process.env.RECORDS_LIMIT} records...`,
      log_color.YELLOW
    );
    let skuDataQry = `SELECT
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
    AND ChildProduct.id > ${process.env.LAST_SKU_ID}
    GROUP BY ChildProduct.id
    ORDER BY ChildProduct.id ASC LIMIT ${process.env.RECORDS_LIMIT}`;
    let skuDataRes = await executeQuery(skuDataQry, []);
    helper.logger(`${skuDataRes.length} Records fetched.`, log_color.GREEN);
    if (skuDataRes.length > 0) {
      helper.logger(
        `Preparing JSON For ${process.env.RECORDS_LIMIT} records...`,
        log_color.YELLOW
      );
      await prepareJsonObjForImport(skuDataRes);
      helper.logger(`JSON Created For Import`, log_color.GREEN);
      resolve(allSkuObj);
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
  if (dbData.length > 0) {
    //JSON PREPARATION START
    for (let childProduct of dbData) {
      let skuNameSuffix =
        " " + childProduct.frame_color_desc + " " + childProduct.frame_size;
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
      });
      allSkuObj.priceInput.push({
        currency_code: "USD",
        sku_code: skuCODE,
        amount_cents: childProduct.sell_price,
        compare_at_amount_cents: childProduct.list_price,
      });
      allSkuObj.stockItemInput.push({
        sku_code: skuCODE,
        quantity: childProduct.total_inventory,
      });
    }
    //JSON PREPARATION END
  }
};

const printImportStatus = (data, title) => {
  if (process.env.ERROR_LOG === 'ON') {
    const atr = data.attributes;
    helper.logger(
      `============ ${title} IMPORT STATUS ============`,
      log_color.YELLOW
    );
    helper.logger(`STARTED AT: ${atr.started_at}`, log_color.BLUE);
    helper.logger(`ERROR COUNT: ${atr.errors_count}`, log_color.RED);
    helper.logger(`WARNINGS COUNT: ${atr.warnings_count}`, log_color.RED);
    helper.logger(`DESTROYED COUNT: ${atr.destroyed_count}`, log_color.RED);
    helper.logger(`PROCCESSED COUNT: ${atr.processed_count}`, log_color.GREEN);
    helper.logger(
      `ERROR LOG: ${JSON.stringify(atr.errors_log)}`,
      log_color.RED
    );
    helper.logger(
      `WARNINGS LOG: ${JSON.stringify(atr.warnings_log)}`,
      log_color.RED
    );
    helper.logger(`COMPLETED AT: ${atr.completed_at}`, log_color.BLUE);
    helper.logger(
      "============================================",
      log_color.YELLOW
    );
  }
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
        printImportStatus(data.data, "SKUs");
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
            printImportStatus(data.data, "Prices");
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
                printImportStatus(data.data, "Stock Items");
                resolve(true);
              })
              .catch((err) => console.error(err));
          })
          .catch((err) => console.error(err));
      })
      .catch((err) => console.error(err));
  });
};

export default async function handler(req, res) {
  try {
    helper.logger("Fetching Access Token...", log_color.YELLOW);
    await helper.getCommerceLayerAccessToken();
    helper.logger("Access Token fetched...", log_color.GREEN);
    await retrieveDataFromDB().then(async (allSkuData) => {
      await dataImportInCL(allSkuData).then(() => {
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
          records: allSkuData,
        });
      });
      // return res.status(200).json({
      //   message: "Sample code - import api is not running",
      //   sku_length: allSkuData.skuInput.length,
      //   lastSKUId: allSkuData.skuInput[allSkuData.skuInput.length - 1].code,
      //   records: allSkuData
      // })
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
