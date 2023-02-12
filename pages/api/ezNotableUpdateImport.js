import Helper from "../../helpers/helper";
const helper = new Helper();
import log_color from "../../constants/log_constants";
import { executeQuery } from "../../config/db";

const productClassificationObj = {
  EYEGLASSES: 1,
  SUNGLASSES: 3,
  CONTACTLENS: 2,
  EYECARE: "12, 13, 14, 15, 16, 17",
  READERS: 1,
};

const getUpdatedPriceForReaders = () => {
  return new Promise(async (resolve, reject) => {
    let updatedPriceArr = {
      listPrice: 1000,
      sellPrice: 1000,
    };
    resolve(updatedPriceArr);
  });
};

const retrieveDataFromDB = (skuDataQry) => {
  return new Promise(async (resolve, reject) => {
    let skuDataRes = await executeQuery(skuDataQry, []);
    helper.logger(`${skuDataRes.length} Records fetched.`, log_color.GREEN);
    if (skuDataRes.length > 0) {
      resolve(skuDataRes);
    }else{
        resolve(true);
    }
  });
};
const makePriceUpdateInResult = (dbData) => {
  return new Promise(async (resolve, reject) => {
    for (let recProduct of dbData) {
      if (
        recProduct.product_classification_id === 1 &&
        recProduct.is_reader_product === 1
      ) {
        helper.logger(
          `Reader Product Found, Updating the prices...`,
          log_color.YELLOW
        );
        await getUpdatedPriceForReaders().then((updatedPriceArr) => {
          recProduct.sku_sell_price = updatedPriceArr.sellPrice;
          recProduct.sku_list_price = updatedPriceArr.listPrice;
        });
      }
    }
    resolve(dbData);
  });
};

const addUpdateRecInProductImportTable = (updatedRes) => {
  return new Promise(async (resolve, reject) => {
    let countObj = {
        updateCount : 0,
        insertCount: 0
    }
    for (let recProduct of updatedRes) {
        let checkStr = `SELECT COUNT(id) as skuCount FROM product_import WHERE sku_code = ${recProduct.id}`;
        let checkRes = await executeQuery(checkStr, []);
         if(checkRes[0].skuCount === 1){
            let updateQry = `UPDATE product_import SET 
            parent_id = ${recProduct.parent_id}, sku_code = ${recProduct.sku_code}, sku_name = '${recProduct.sku_name}', sku_desc = '${recProduct.sku_desc}', sku_list_price = ${recProduct.sku_list_price}, sku_sell_price = ${recProduct.sku_sell_price}, sku_stock = ${recProduct.sku_stock}, sku_image = '${recProduct.sku_image}', sku_color = '${recProduct.frame_color_desc}', sku_frame_size = '${recProduct.sku_frame_size}', sku_power = '${recProduct.sku_power}', sku_attributes = '${recProduct.sku_attributes}', is_sku_imported = 'N'
            WHERE sku_code = ${recProduct.id}`;
            let updateRes = await executeQuery(updateQry, []);
            countObj.updateCount++;
        }else{
            let insertQry = `INSERT INTO product_import (id, parent_id, sku_code, sku_name, sku_desc, sku_list_price, sku_sell_price, sku_stock, sku_image, sku_color, sku_frame_size, sku_power, sku_attributes, is_sku_imported) VALUES
            (0, ${recProduct.parent_id}, ${recProduct.sku_code}, '${recProduct.sku_name}', '${recProduct.sku_desc}', ${recProduct.sku_list_price}, ${recProduct.sku_sell_price}, ${recProduct.sku_stock}, '${recProduct.sku_image}', '${recProduct.sku_color}', '${recProduct.sku_frame_size}', '${recProduct.sku_power}', '${recProduct.sku_attributes}', 'N')`;
             let insertRes = await executeQuery(insertQry, []);
             countObj.insertCount++;
        }
    }
    resolve(countObj);
  });
};

const importProcess = async () => {
  var dateString = new Date().toLocaleString();
  helper.logger(
    "Started importProcess function at : " + dateString,
    log_color.GREEN
  );
  helper.logger(
    "Looping the ProductCategories to make SQL Query",
    log_color.YELLOW
  );
  for (const [key, value] of Object.entries(productClassificationObj)) {
    let currQry = helper.getSQLQryForSku("EZ", key);
    helper.logger(`Created SQL Query for ${key}`, log_color.GREEN);
    await retrieveDataFromDB(currQry).then(async (skuDataRes) => {
      if (skuDataRes.length > 0) {
        helper.logger(`Making Price Adjusments for Products`, log_color.GREEN);
        await makePriceUpdateInResult(skuDataRes).then(async (updatedRes) => {
          await addUpdateRecInProductImportTable(updatedRes).then((countObj) => {
            helper.logger(
              `Updated Rows: ${countObj.updateCount} and Inserted Rows: ${countObj.insertCount} in product_import table.`,
              log_color.YELLOW
            );
          });
        });
      }
    });
  }
  helper.logger("ALL PROCESS HAS BEEN DONE", log_color.GREEN)
};

export default async function handler(req, res) {
  try {
    // setInterval(importProcess, 5000);
    await importProcess().then(() => {
      res.json({
        message: "ALL PROCESS HAS BEEN DONE",
        logs: helper.skuImportFinalStatus(),
      });
    });
  } catch (error) {
    res.json(error);
    res.status(500).end();
  }
}
