import commercelayerjsAuth from "@commercelayer/js-auth";
import chalk from "chalk";
import { executeQuery } from "../config/db";
import log_color from "../constants/log_constants";
let skuImportStatus = [];

class Helper {
  //--------------------COMMON FUNCTIONS------------------------
  getCommerceLayerAccessToken = async () => {
    try {
      this.logger("Fetching Access Token...", log_color.YELLOW);
      this.logger(
        `Executing Function => getCommerceLayerAccessToken`,
        log_color.BLUE
      );
      const { accessToken } = await commercelayerjsAuth.getIntegrationToken({
        clientId: process.env.CL_CLIENT_ID,
        clientSecret: process.env.CL_CLIENT_SECRET,
        endpoint: process.env.CL_BASE_ENDPOINT,
      });
      this.accessToken = accessToken;
    } catch (err) {
      throw err;
    }
  };
  clAuthHeader = (additionalHeaders = "") => {
    const authHeaders = {
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/vnd.api+json",
      },
    };
    if (additionalHeaders !== "") {
      authHeaders.headers[Object.keys(additionalHeaders)[0]] =
        Object.values(additionalHeaders)[0];
    }
    return authHeaders.headers;
  };
  logger = (msg = "", msgColor = "green") => {
    skuImportStatus.push(msg);
    console.log(chalk[msgColor](msg));
  };
  skuImportFinalStatus() {
    let retVal = skuImportStatus;
    skuImportStatus = [];
    return retVal;
  }
  printImportStatus = (data, title) => {
    if (process.env.ERROR_LOG === "ON") {
      const atr = data.attributes;
      this.logger(
        `============ ${title} IMPORT STATUS ============`,
        log_color.YELLOW
      );
      this.logger(`IMPORT ID: ${data.id}`, log_color.BLUE);
      this.logger(
        `STARTED AT: ${new Date(atr.started_at).toLocaleString()}`,
        log_color.BLUE
      );
      this.logger(`ERROR COUNT: ${atr.errors_count}`, log_color.RED);
      this.logger(`WARNINGS COUNT: ${atr.warnings_count}`, log_color.RED);
      this.logger(`DESTROYED COUNT: ${atr.destroyed_count}`, log_color.RED);
      this.logger(`PROCCESSED COUNT: ${atr.processed_count}`, log_color.GREEN);
      this.logger(
        `ERROR LOG: ${JSON.stringify(atr.errors_log)}`,
        log_color.RED
      );
      this.logger(
        `WARNINGS LOG: ${JSON.stringify(atr.warnings_log)}`,
        log_color.RED
      );
      this.logger(
        `COMPLETED AT: ${atr.completed_at === null
          ? ""
          : new Date(atr.completed_at).toLocaleString()
        }`,
        log_color.BLUE
      );
      this.logger(
        "============================================",
        log_color.YELLOW
      );
    }
  };
  toCents(aValue) {
    return Math.round((Math.abs(aValue) / 100) * 10000);
  }
  makeValidStock(aValue) {
    if (aValue < 0) {
      aValue = 0;
    }
    return aValue;
  }
  createMetaDataForSku = (attribute_types, childProduct) => {
    return new Promise(async (resolve, reject) => {
      let retObj;
      if (childProduct.product_classification_id === 2) {
        let metaInfo = this.createMetaDataFromStr(attribute_types, childProduct.sku_attributes);
        retObj = {
          nameSuffix: metaInfo.nameSuffix,
          metadata: metaInfo.metaObj
        }
      } else {
        retObj = {
          nameSuffix: this.getSkuNameSuffix(childProduct),
          metadata: {
            color: childProduct.sku_color,
            frame_size: childProduct.sku_frame_size,
          }
        };
      }
      retObj.metadata.skuDisplayName = childProduct.sku_name;
      resolve(retObj);
    });
  }
  prepareJsonObjForImport = async (dbData) => {
    return new Promise(async (resolve, reject) => {
      let allSkuObj = {
        skuInput: [],
        priceInput: [],
        gspPriceInput: [],
        stockItemInput: [],
      };

      if (dbData.length > 0) {
        let attrQry = `SELECT id,name FROM product_shippable_setup_attribute_types`;
        let attribute_types = await executeQuery(attrQry, []);
        //JSON PREPARATION START
        for (let childProduct of dbData) {
          const skuCODE = childProduct.sku_code;
          let info = await this.createMetaDataForSku(attribute_types, childProduct);
          allSkuObj.skuInput.push({
            code: skuCODE,
            name: skuCODE,
            image_url: `https://do6sydhp1s299.cloudfront.net/${process.env.CLOUDFRONT_ENV}/${childProduct.sku_image}`,
            description: childProduct.sku_desc,
            reference: childProduct.parent_id,
            shipping_category_id: process.env.CL_SHIPPING_CATEGORY_ID,
            do_not_track: true,
            metadata: info.metadata,
          });
          allSkuObj.priceInput.push({
            currency_code: process.env.CL_CURRENCY_CODE,
            sku_code: skuCODE,
            amount_cents: this.toCents(childProduct.sku_sell_price),
            compare_at_amount_cents: this.toCents(childProduct.sku_list_price),
          });
          allSkuObj.gspPriceInput.push({
            currency_code: process.env.CL_CURRENCY_CODE,
            sku_code: skuCODE,
            amount_cents: this.toCents(childProduct.sku_gsp_price),
            compare_at_amount_cents: this.toCents(childProduct.sku_list_price),
          });
          allSkuObj.stockItemInput.push({
            sku_code: skuCODE,
            quantity: this.makeValidStock(childProduct.sku_stock),
          });
        }

        //JSON PREPARATION END
      }
      resolve(allSkuObj);
    });
  }
  dataImportInCL = (allSkuData) => {
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
      const gspPriceData = {
        data: {
          type: "imports",
          attributes: {
            resource_type: "prices",
            format: "json",
            parent_resource_id: process.env.CL_GSP_PRICE_LIST_ID,
            inputs: allSkuData.gspPriceInput,
          },
        },
      };
      //   IMPORTING ALL SKUs
      const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
      this.logger(
        `Importing ${allSkuData.skuInput.length} SKUs...`,
        log_color.YELLOW
      );
      fetch(skuAPIUrl, {
        body: JSON.stringify(skuData),
        method: "POST",
        headers: this.clAuthHeader(),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.errors) {
            this.logger(data.errors[0].detail, log_color.RED);
            res
              .status(parseInt(data.errors[0].status))
              .json({ error: data.errors[0].detail });
            process.exit();
          }
          this.logger(
            `${allSkuData.skuInput.length} SKUs has been imported.`,
            log_color.GREEN
          );
          this.printImportStatus(data.data, "SKUs");
          //   IMPORTING ALL Prices
          const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
          this.logger(
            `Importing Prices for ${allSkuData.priceInput.length} SKUs...`,
            log_color.YELLOW
          );
          fetch(skuAPIUrl, {
            body: JSON.stringify(priceData),
            method: "POST",
            headers: this.clAuthHeader(),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.errors) {
                this.logger(data.errors[0].detail, log_color.RED);
                res
                  .status(parseInt(data.errors[0].status))
                  .json({ error: data.errors[0].detail });
                process.exit();
              }
              this.logger(
                `${allSkuData.priceInput.length} Prices has been imported.`,
                log_color.GREEN
              );
              this.printImportStatus(data.data, "Prices");
              //   IMPORTING ALL Stock Items
              const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
              this.logger(
                `Importing Stock Items for ${allSkuData.priceInput.length} SKUs...`,
                log_color.YELLOW
              );
              fetch(skuAPIUrl, {
                body: JSON.stringify(stockItemsData),
                method: "POST",
                headers: this.clAuthHeader(),
              })
                .then((response) => response.json())
                .then((data) => {
                  if (data.errors) {
                    this.logger(data.errors[0].detail, log_color.RED);
                    res
                      .status(parseInt(data.errors[0].status))
                      .json({ error: data.errors[0].detail });
                    process.exit();
                  }
                  this.logger(
                    `${allSkuData.stockItemInput.length} Stock Items has been imported.`,
                    log_color.GREEN
                  );
                  this.printImportStatus(data.data, "Stock Items");
                  //   IMPORTING GSP Prices
                  const skuAPIUrl = `${process.env.CL_BASE_ENDPOINT}/api/imports`;
                  this.logger(
                    `Importing GSP Prices for ${allSkuData.priceInput.length} SKUs...`,
                    log_color.YELLOW
                  );
                  fetch(skuAPIUrl, {
                    body: JSON.stringify(gspPriceData),
                    method: "POST",
                    headers: this.clAuthHeader(),
                  })
                    .then((response) => response.json())
                    .then((data) => {
                      if (data.errors) {
                        this.logger(data.errors[0].detail, log_color.RED);
                        res
                          .status(parseInt(data.errors[0].status))
                          .json({ error: data.errors[0].detail });
                        process.exit();
                      }
                      this.logger(
                        `${allSkuData.stockItemInput.length} GSP Price has been imported.`,
                        log_color.GREEN
                      );
                      this.printImportStatus(data.data, "GSP Price");


                      
                          resolve(true);
                    })
                    .catch((err) => console.error(err));
                })
                .catch((err) => console.error(err));
            })
            .catch((err) => console.error(err));
        })
        .catch((err) => console.error(err));
    });
  }

  // Functions are being used in notableSkuImport.js file
  getImportHitAvail(busySlots) {
    let importHitAvl = 0;
    let freeSlots = parseInt(10 - busySlots);
    this.logger(`Currently Free Slots : ${freeSlots}`, log_color.YELLOW);
    switch (freeSlots) {
      case 3:
      case 4:
        importHitAvl = 1;
        break;
      case 6:
      case 7:
        importHitAvl = 2;
        break;
      case 9:
      case 10:
        importHitAvl = 3;
        break;
      default:
        importHitAvl = 0;
        break;
    }
    return importHitAvl;
  }


  // Functions are being used in skuImport.js file
  createMetaDataFromStr = (dbData, str) => {
    let nSuffix = '';
    let retObj = {};
    const splitStr = str.split(",");
    for (let d of dbData) {
      for (let spStr of splitStr) {
        let metaStr = spStr.split("::");

        if (parseInt(metaStr[0]) === d.id) {
          nSuffix = `${nSuffix} ${d.name}: ${metaStr[1]} /`;
          retObj[d.name] = metaStr[1];
        }
      }
    }
    return {
      metaObj: retObj,
      nameSuffix: ' ' + nSuffix.replace(/\/$/, "").trim()
    }

  }
  getSkuNameSuffix = (childProduct) => {
    let skuSuffix = "";
    if (
      childProduct.frame_color_desc !== null &&
      childProduct.frame_size !== null
    ) {
      skuSuffix =
        " " + childProduct.frame_color_desc + " " + childProduct.frame_size;
    } else {
      skuSuffix = " " + childProduct.id;
    }
    return skuSuffix;
  };

  getSQLQryForSku(
    skuQryType = "CL",
    productCategory = process.env.PRODUCT_CATEGORY
  ) {
    let skuQry = "";
    switch (productCategory) {
      case "EYEGLASSES":
        skuQry = `SELECT DISTINCT 
        ChildProduct.id as sku_code, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price, GspPrice.price AS sku_gsp_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS sku_stock, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size, NULL AS sku_power, NULL AS sku_attributes,AppProduct.pricing_set_separate_for_each_multi_item, Manufacturer.id as manufacturer_id, Manufacturer.name, Manufacturer.is_use_msrp_pricing_eyeglasses, Manufacturer.is_use_msrp_pricing_sunglasses, Manufacturer.default_markup_readers, Availability.days_min, Availability.days_max 
      FROM products AS ChildProduct 
      INNER JOIN product_prices AS CostPrice
        ON CostPrice.product_id = ChildProduct.id
      INNER JOIN products AS AppProduct
        ON AppProduct.id = ChildProduct.grouping_product_id
      INNER JOIN manufacturers AS Manufacturer
        ON Manufacturer.id = AppProduct.manufacturer_id
      INNER JOIN product_prices AS ListPrice
        ON ListPrice.product_id = ChildProduct.id
      INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ChildProduct.id 
      INNER JOIN product_prices AS GspPrice
        ON (GspPrice.product_id = ChildProduct.id)
      LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL)
      INNER JOIN product_shippable_to_attribute_type_values AS Color
        ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
      INNER JOIN product_shippable_to_attribute_type_values AS Size
        ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9 
      LEFT JOIN product_shipping_availability_types AS Availability
        ON (Availability.id = ChildProduct.product_shipping_availability_type_id)
      WHERE 
        AppProduct.is_deleted = '0' 
        AND AppProduct.seller_account_id IS NULL 
        AND AppProduct.is_demo = '0' 
        AND AppProduct.is_enabled = '1' 
        AND AppProduct.is_approved = '1' 
        AND AppProduct.grouping_product_id IS NULL 
        AND AppProduct.product_type_id = 2 
        AND AppProduct.has_valid_price_currency_id_1 = '1' 
        AND AppProduct.has_valid_image = '1' 
        AND AppProduct.product_name IS NOT NULL 
        AND AppProduct.product_name != ''  
        AND AppProduct.cached_is_site_ezcontacts = '1' 
        AND AppProduct.cached_has_valid_manufacturer = '1' 
        AND AppProduct.is_show_browse = '1' 
        AND AppProduct.is_hidden_visibility = '0'
        AND CostPrice.price_type_id = 3 
        AND CostPrice.is_deleted = 0 
        AND ChildProduct.is_deleted = 0
        AND ChildProduct.is_demo = 0
        AND ChildProduct.is_enabled = 1
        AND ChildProduct.is_approved = 1
        AND ChildProduct.has_valid_price_currency_id_1 = 1
        AND ChildProduct.has_valid_image = 1
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND GspPrice.price_type_id = 4
        AND GspPrice.is_deleted = 0 
        AND AppProduct.product_classification_id = 1`;
        break;
      case "SUNGLASSES":
        skuQry = `SELECT DISTINCT 
        ChildProduct.id as sku_code, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price, GspPrice.price AS sku_gsp_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS sku_stock, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size, NULL AS sku_power, NULL AS sku_attributes,Manufacturer.id as manufacturer_id, Manufacturer.name, Manufacturer.is_use_msrp_pricing_eyeglasses, Manufacturer.is_use_msrp_pricing_sunglasses, Manufacturer.default_markup_readers, Availability.days_min, Availability.days_max  
      FROM products AS ChildProduct 
      INNER JOIN product_prices AS CostPrice
        ON CostPrice.product_id = ChildProduct.id
      INNER JOIN products AS AppProduct
        ON AppProduct.id = ChildProduct.grouping_product_id
      INNER JOIN manufacturers AS Manufacturer
        ON Manufacturer.id = AppProduct.manufacturer_id
      INNER JOIN product_prices AS ListPrice
        ON ListPrice.product_id = ChildProduct.id
      INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ChildProduct.id 
      INNER JOIN product_prices AS GspPrice
        ON (GspPrice.product_id = ChildProduct.id)
      LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL)
      INNER JOIN product_shippable_to_attribute_type_values AS Color
        ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
      INNER JOIN product_shippable_to_attribute_type_values AS Size
        ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9 
      LEFT JOIN product_shipping_availability_types AS Availability
        ON (Availability.id = ChildProduct.product_shipping_availability_type_id)
      WHERE 
        AppProduct.is_deleted = '0' 
        AND AppProduct.seller_account_id IS NULL 
        AND AppProduct.is_demo = '0' 
        AND AppProduct.is_enabled = '1' 
        AND AppProduct.is_approved = '1' 
        AND AppProduct.grouping_product_id IS NULL 
        AND AppProduct.product_type_id = 2 
        AND AppProduct.has_valid_price_currency_id_1 = '1' 
        AND AppProduct.has_valid_image = '1' 
        AND AppProduct.product_name IS NOT NULL 
        AND AppProduct.product_name != ''  
        AND AppProduct.cached_is_site_ezcontacts = '1' 
        AND AppProduct.cached_has_valid_manufacturer = '1' 
        AND AppProduct.is_show_browse = '1' 
        AND AppProduct.is_hidden_visibility = '0'
        AND CostPrice.price_type_id = 3 
        AND CostPrice.is_deleted = 0 
        AND ChildProduct.is_deleted = 0
        AND ChildProduct.is_demo = 0
        AND ChildProduct.is_enabled = 1
        AND ChildProduct.is_approved = 1
        AND ChildProduct.has_valid_price_currency_id_1 = 1
        AND ChildProduct.has_valid_image = 1
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND GspPrice.price_type_id = 4
        AND GspPrice.is_deleted = 0 
        AND AppProduct.product_classification_id = 3`;
        break;
      case "EYECARE":
        skuQry = `SELECT DISTINCT 
        ChildProduct.id as sku_code, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price, GspPrice.price AS sku_gsp_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS sku_stock, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size, NULL AS sku_power, NULL AS sku_attributes,Manufacturer.id as manufacturer_id, Manufacturer.name, Manufacturer.is_use_msrp_pricing_eyeglasses, Manufacturer.is_use_msrp_pricing_sunglasses, Manufacturer.default_markup_readers, Availability.days_min, Availability.days_max 
      FROM products AS ChildProduct 
      INNER JOIN product_prices AS CostPrice
        ON CostPrice.product_id = ChildProduct.id
      INNER JOIN products AS AppProduct
        ON AppProduct.id = ChildProduct.grouping_product_id
      INNER JOIN manufacturers AS Manufacturer
        ON Manufacturer.id = AppProduct.manufacturer_id
      INNER JOIN product_prices AS ListPrice
        ON ListPrice.product_id = ChildProduct.id
      INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ChildProduct.id 
      INNER JOIN product_prices AS GspPrice
        ON (GspPrice.product_id = ChildProduct.id)
      LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL)
      INNER JOIN product_shippable_to_attribute_type_values AS Color
        ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
      INNER JOIN product_shippable_to_attribute_type_values AS Size
        ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9 
      LEFT JOIN product_shipping_availability_types AS Availability
        ON (Availability.id = ChildProduct.product_shipping_availability_type_id) 
      WHERE 
        AppProduct.is_deleted = '0' 
        AND AppProduct.seller_account_id IS NULL 
        AND AppProduct.is_demo = '0' 
        AND AppProduct.is_enabled = '1' 
        AND AppProduct.is_approved = '1' 
        AND AppProduct.grouping_product_id IS NULL 
        AND AppProduct.product_type_id = 2 
        AND AppProduct.has_valid_price_currency_id_1 = '1' 
        AND AppProduct.has_valid_image = '1' 
        AND AppProduct.product_name IS NOT NULL 
        AND AppProduct.product_name != ''  
        AND AppProduct.cached_is_site_ezcontacts = '1' 
        AND AppProduct.cached_has_valid_manufacturer = '1' 
        AND AppProduct.is_show_browse = '1' 
        AND AppProduct.is_hidden_visibility = '0'
        AND CostPrice.price_type_id = 3 
        AND CostPrice.is_deleted = 0 
        AND ChildProduct.is_deleted = 0
        AND ChildProduct.is_demo = 0
        AND ChildProduct.is_enabled = 1
        AND ChildProduct.is_approved = 1
        AND ChildProduct.has_valid_price_currency_id_1 = 1
        AND ChildProduct.has_valid_image = 1
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND GspPrice.price_type_id = 4
        AND GspPrice.is_deleted = 0 
        AND AppProduct.product_classification_id IN (12, 13, 14, 15, 16, 17)`;
        break;
      case "CONTACTLENS":
        skuQry = `SELECT DISTINCT 
        ChildProduct.id as sku_code, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price, GspPrice.price AS sku_gsp_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS sku_stock, NULL AS sku_color, NULL AS sku_frame_size, NULL AS sku_power, (SELECT GROUP_CONCAT(CONCAT(product_shippable_setup_attribute_type_id, '::', value_varchar)) FROM product_shippable_to_attribute_type_values WHERE product_id = ChildProduct.id) AS sku_attributes, Availability.days_min, Availability.days_max 
      FROM products ChildProduct
      INNER JOIN products AppProduct
        ON (AppProduct.id = ChildProduct.grouping_product_id)
      INNER JOIN product_prices AS ListPrice
        ON (ListPrice.product_id = AppProduct.id)
      INNER JOIN product_prices AS SellPrice
        ON (SellPrice.product_id = AppProduct.id)
      INNER JOIN product_prices AS GspPrice
        ON (GspPrice.product_id = AppProduct.id)
      LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL) 
      LEFT JOIN product_shipping_availability_types AS Availability
        ON (Availability.id = ChildProduct.product_shipping_availability_type_id)
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
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND GspPrice.price_type_id = 4
        AND GspPrice.is_deleted = 0 
        AND AppProduct.product_classification_id = 2`;
        break;
      case "READERS":
        skuQry = `SELECT DISTINCT 
        ChildProduct.id as sku_code, AppProduct.id as parent_id, AppProduct.product_classification_id as sku_cf_id, AppProduct.product_name as sku_name, AppProduct.has_valid_main_image_url as sku_image, AppProduct.short_desc as sku_desc, ListPrice.price AS sku_list_price, SellPrice.price AS sku_sell_price, GspPrice.price AS sku_gsp_price, COALESCE(ProductInventoryTotal.total_qty, 0) AS sku_stock, Color.value_varchar AS sku_color, Size.value_varchar AS sku_frame_size, NULL AS sku_power, NULL AS sku_attributes, Manufacturer.id as manufacturer_id, Manufacturer.name, Manufacturer.is_use_msrp_pricing_eyeglasses, Manufacturer.is_use_msrp_pricing_sunglasses, Manufacturer.default_markup_readers, Availability.days_min, Availability.days_max 
      FROM products AS ChildProduct 
      INNER JOIN product_prices AS CostPrice
        ON CostPrice.product_id = ChildProduct.id
      INNER JOIN products AS AppProduct
        ON AppProduct.id = ChildProduct.grouping_product_id
      INNER JOIN manufacturers AS Manufacturer
        ON Manufacturer.id = AppProduct.manufacturer_id
      INNER JOIN product_prices AS ListPrice
        ON ListPrice.product_id = ChildProduct.id
      INNER JOIN product_prices AS SellPrice
        ON SellPrice.product_id = ChildProduct.id 
      INNER JOIN product_prices AS GspPrice
        ON (GspPrice.product_id = ChildProduct.id) 
      INNER JOIN product_shippable_to_attribute_type_values AS Color
        ON Color.product_id = ChildProduct.id AND Color.product_shippable_setup_attribute_type_id = 8
      INNER JOIN product_shippable_to_attribute_type_values AS Size
        ON Size.product_id = ChildProduct.id AND Size.product_shippable_setup_attribute_type_id = 9
      LEFT JOIN product_inventory_totals AS ProductInventoryTotal
        ON (ProductInventoryTotal.product_id = ChildProduct.id AND ProductInventoryTotal.product_inventory_location_id IS NULL) 
      LEFT JOIN product_shipping_availability_types AS Availability
        ON (Availability.id = ChildProduct.product_shipping_availability_type_id)
      WHERE 
        AppProduct.is_deleted = '0' 
        AND AppProduct.seller_account_id IS NULL 
        AND AppProduct.is_demo = '0' 
        AND AppProduct.is_enabled = '1' 
        AND AppProduct.is_approved = '1' 
        AND AppProduct.grouping_product_id IS NULL 
        AND AppProduct.product_type_id = 2 
        AND AppProduct.has_valid_price_currency_id_1 = '1' 
        AND AppProduct.has_valid_image = '1' 
        AND AppProduct.product_name IS NOT NULL 
        AND AppProduct.product_name != ''  
        AND AppProduct.cached_is_site_ezcontacts = '1' 
        AND AppProduct.cached_has_valid_manufacturer = '1' 
        AND AppProduct.is_show_browse = '1' 
        AND AppProduct.is_hidden_visibility = '0' 
        AND AppProduct.is_reader_product = 1 
        AND CostPrice.price_type_id = 3 
        AND CostPrice.is_deleted = 0 
        AND ChildProduct.is_deleted = 0
        AND ChildProduct.is_demo = 0
        AND ChildProduct.is_enabled = 1
        AND ChildProduct.is_approved = 1
        AND ChildProduct.has_valid_price_currency_id_1 = 1
        AND ChildProduct.has_valid_image = 1
        AND ListPrice.price_type_id = 1
        AND ListPrice.is_deleted = 0
        AND SellPrice.price_type_id = 2
        AND SellPrice.is_deleted = 0 
        AND GspPrice.price_type_id = 4
        AND GspPrice.is_deleted = 0 
        AND AppProduct.product_classification_id IN (1, 3)`;
        break;
    }
    let skuQrySuffix = `
      AND ChildProduct.id > ${process.env.LAST_SKU_ID}
      GROUP BY ChildProduct.id 
      ORDER BY ChildProduct.id ASC LIMIT ${process.env.RECORDS_LIMIT}`;
    if (skuQryType === "EZ") {
      skuQrySuffix = ` AND AppProduct.notable_updates > DATE_SUB(NOW(),INTERVAL 450 MINUTE)
      GROUP BY ChildProduct.id 
      ORDER BY ChildProduct.id ASC`;
    }
    let finalQry = skuQry + skuQrySuffix;
    return finalQry;
  }
}

export default Helper;
